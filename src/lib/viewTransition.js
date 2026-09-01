/* THE TRANSITION LAYER.
 *
 * One question decides everything here: did you go deeper, come back, or move
 * sideways? A screen that always animates the same way tells you nothing; a
 * screen that slides the way you travelled tells you where you are without a
 * word of copy.
 *
 * This is the prototype's behaviour built natively. Three of its mechanisms
 * are deliberately NOT carried over, because they only existed to work from
 * outside the app:
 *
 *   the capture-phase click hijack   it swallowed every click on a nav
 *                                    control and re-fired a synthetic one.
 *                                    Inside the app the navigation is a
 *                                    function call, so there is nothing to
 *                                    intercept.
 *   the MutationObserver settle()    it watched the DOM to guess when React
 *                                    had finished. React Router 7 takes
 *                                    { viewTransition: true } and commits the
 *                                    update inside the transition itself, so
 *                                    the guess is replaced by a guarantee.
 *   post-hoc DOM sniffing            it read the direction back off the page
 *                                    AFTER navigating. Here the target path is
 *                                    known before the move, so the direction is
 *                                    derived rather than observed.
 *
 * Section and depth come from parseRoute, the app's own parser, so this can
 * never disagree with the router about where a URL leads.
 */
import { flushSync } from "react-dom";
import { parseRoute, PROFILE_TABS } from "./routes.js";

/* Which top-level place a route belongs to, and how deep it sits inside it.
   Depth is what makes "forward" and "back" different from "sideways": moving
   between two modules is a swap, opening a lesson inside one is a descent. */
const PLACE = {
  home: ["deck", 0],
  modules: ["deck", 1],
  module: ["module", 1],
  // A chapter, a lesson and a review all live INSIDE a module.
  chapter: ["module", 2],
  lesson: ["module", 2],
  review: ["module", 2],
  ready: ["ready", 0],
  profile: ["account", 0],
  settings: ["account", 0],
  logbook: ["logbook", 0],
  saved: ["saved", 0],
  signin: ["signin", 0],
  notfound: ["notfound", 0],
};

const MODULE_TAB_ORDER = ["chapters", "pdf", "people"];

export function placeOf(route) {
  const [sec, depth] = PLACE[route?.name] || ["other", 0];
  return { sec, depth, id: route?.moduleCode || "" };
}

/* THE KIND IS NOW ONLY USED TO PICK A DURATION, not to pick a choreography.
   Everything that moves does the same thing; a scene change is the one case
   that behaves differently, because nothing moves and only the colour changes.
   The direction of travel is deliberately no longer expressed: it was carried
   by scaling the incoming layer below 1, which is exactly what exposed the
   holes. It can come back when it can be done without them. */
export function transitionKind(fromRoute, toPath) {
  if (!toPath) return null;
  const a = placeOf(fromRoute);
  const b = placeOf(parseRoute(toPath));
  // Same place and same depth in the same module is not a navigation at all.
  if (a.sec === b.sec && a.depth === b.depth && a.id === b.id) return "move";
  return "move";
}

/* MOTION IS A PREFERENCE, AND IT IS ALREADY DECLARED TWICE IN THIS APP.
   Smooth Air is the in-app switch and prefers-reduced-motion is the system
   one; every other ambient motion honours both, so this does too. When either
   says no, the navigation is a plain navigation: not a faster transition, no
   transition, which is what "reduce motion" actually asks for. */
export function motionOff() {
  if (typeof window === "undefined") return true;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  } catch { /* matchMedia is absent in some embedded webviews */ }
  return Boolean(document.querySelector(".app.smooth-air, .app.reduce-motion"));
}

/* Chromium and Safari 18 have this; Firefox does not yet. Where it is missing
   the option is simply not passed and the app navigates as it always has —
   there is no polyfill and no degraded imitation of one. */
export const supported = () =>
  typeof document !== "undefined" && typeof document.startViewTransition === "function";

export const canTransition = () => supported() && !motionOff();

/* WHICH TRANSITION IS THE LIVE ONE.
 *
 * Navigate back and forth quickly and two transitions overlap: the first is
 * aborted the instant the second starts. Its `finished` promise then settles —
 * as a rejection, because it was aborted — and used to run the teardown, which
 * deleted data-vt. That attribute belonged to the SECOND transition, still
 * mid-flight, so its rules stopped matching between one frame and the next.
 *
 * A counter fixes it: each transition takes the next number and only the one
 * still holding the current number may tear anything down. A superseded
 * transition settles, finds it is no longer current, and does nothing — which
 * is right, because the transition that replaced it owns the teardown now.
 *
 * This survives the rebuild unchanged. It is not about shared elements; it is
 * about two transitions existing at once, which is still possible and still
 * the thing that happens when somebody taps twice.
 */
let generation = 0;

export function beginTransition(kind) {
  document.documentElement.dataset.vt = kind;
  return ++generation;
}

export function endTransition(token) {
  if (token !== generation) return false;
  delete document.documentElement.dataset.vt;
  return true;
}

/* NO SHARED ELEMENTS, AND THAT IS THE POINT OF THE REBUILD.
 *
 * There used to be two — a module card growing into its page, and a lesson
 * thumbnail growing into the player — plus the chrome and the tab parts, eight
 * names in all. Each one had to be written onto an element by hand, kept
 * unique across two overlapping navigations, and cleared again afterwards, and
 * each one punched a transparent hole in both root snapshots that the incoming
 * layer then shrank away from.
 *
 * The marking machinery went with them: markShared, markMorph, markMedia and
 * markMorphTarget, along with the return-trip MutationObserver that waited for
 * a card to exist so it could be named before the after-snapshot was taken.
 * None of it is needed to dissolve one picture into another, and all of it was
 * a place for the transition to break.
 *
 * If a morph is wanted back, it needs two things this file no longer has to
 * provide, in this order: a scale at or above 1 so a layer never shrinks away
 * from its own hole, and uniqueness that survives two navigations overlapping.
 */

/* WAIT FOR REACT TO ACTUALLY COMMIT.
 *
 * flushSync alone is not enough when the route is code-split. React.lazy
 * suspends on its FIRST render whatever the module cache holds — warming the
 * chunk removes the network wait, not the suspension — so a synchronous flush
 * commits nothing and the browser photographs the old page as the "after"
 * frame. Measured: the path already read /ready-room while the DOM still
 * showed the Flight Deck, so the transition animated the deck against itself
 * and the room appeared afterwards, outside it. A hitch, then a jump.
 *
 * startViewTransition's callback may be async, and the snapshot is held until
 * it settles. That is the supported hook for exactly this: the wait happens
 * between the two snapshots rather than after them.
 *
 * Bounded twice — a short idle so it returns the instant the commit lands, and
 * a hard cap so a route that never settles cannot hold the page frozen behind
 * a still image. The chunk is already warm by the time this runs, so the
 * common case is one or two frames.
 */
export function settleDom({ max = 260 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let mo = null;
    let hard = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (mo) mo.disconnect();
      clearTimeout(hard);
      resolve();
    };

    /* WAIT FOR THE SKELETON TO GO, not for the first mutation.
     *
     * The previous version resolved as soon as anything in the document
     * changed. When the route suspends, the FIRST thing that changes is the
     * Suspense fallback being mounted — so the browser took its after-snapshot
     * of a skeleton, animated that in as the new page, and the real content
     * appeared after the transition had already finished. A pulse of grey
     * blocks, then a pop.
     *
     * flushSync has already run by the time this is called, so the DOM
     * reflects the commit: either the real screen, in which case there is
     * nothing to wait for and this resolves without costing a frame, or the
     * fallback, in which case the thing to wait for is precisely its removal.
     * aria-busy is what marks it, and it is on the fallback because it is true
     * — not as a hook for this.
     */
    const settled = () => !document.querySelector('.deck [aria-busy="true"]');
    const check = () => { if (settled()) queueMicrotask(finish); };

    // A MutationObserver rather than a timer: setTimeout is throttled to about
    // a second in a background tab, and an earlier version of this sat frozen
    // behind the snapshot for 989ms because of it.
    mo = new MutationObserver(check);
    mo.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ["aria-busy"],
    });
    // Nothing may ever change — a route that renders identically, or a chunk
    // that never arrives — so this is the ceiling as well as the backstop.
    hard = setTimeout(finish, max);
    // The common case: the commit was synchronous and we are already done.
    check();
  });
}


/* A CHANGE THAT IS NOT A NAVIGATION.
 *
 * Picking a livery, a finish, a greeter or a social preset does not move you
 * anywhere — the screen stays exactly where it is and something on it becomes
 * something else. That is a scene change, and in a single frame it is a cut:
 * the palette snaps, or the name and the blurb above a picker swap between one
 * frame and the next while your eye is still on the control you just pressed.
 *
 * It lives here rather than in App because the settings that need it are not
 * all in App. Threading a wrapper down through Profile as a prop would put the
 * transition layer in the signature of every component that owns a preference;
 * importing a function does not.
 *
 * Nothing is named for these kinds — see the CSS. The whole point is that the
 * page dissolves as ONE picture, so the root is the only thing that animates
 * and every part of the screen that did not change is identical on both sides
 * of it and therefore invisible.
 */
export function transitionState(kind, change) {
  if (!canTransition()) { change(); return; }
  // Same race as a navigation: press two liveries quickly and the first one's
  // teardown would strip the second one's kind while it is still running.
  const token = beginTransition(kind);
  const vt = document.startViewTransition(() => flushSync(change));
  // Both settle-handlers are needed. An interrupted transition rejects `ready`,
  // and an unhandled rejection there is a console error on a perfectly ordinary
  // action — pressing two liveries quickly.
  vt.ready?.catch(() => {});
  vt.finished?.catch(() => {}).finally?.(() => { endTransition(token); });
}

/* A palette change: everything on screen is a different colour afterwards. */
export const withTheme = (change) => transitionState("theme", change);

/* A preference: a small region changes and the rest of the page does not. Same
   mechanism, shorter, because there is less to dissolve. */
export const withSetting = (change) => transitionState("setting", change);
