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


/* WHAT KIND OF MOVE THIS IS, and Mission Control needs the answer because it
   moves three different things.

   Depth decides forward from back: the screen you are going deeper into
   arrives from in front, the one you are returning to comes forward from
   behind. A tab is not a move at all — the frame holds and only the panel
   travels — so it is answered separately and carries the side it travelled.

   THE DECK IS NOT A PARENT OF A MODULE, it is the drawer the module was in, so
   opening one is its own kind rather than plain depth. */
export function transitionKind(fromRoute, toPath) {
  if (!toPath) return null;
  const a = placeOf(fromRoute);
  const to = parseRoute(toPath);
  const b = placeOf(to);

  /* Tabs first: they are the same section at the same depth, so every test
     below would call them nothing at all and the panel would cut. The index
     difference IS the direction — a later tab arrives from the right. */
  if (a.sec === "account" && fromRoute?.name === "profile" && to.name === "profile") {
    const i = PROFILE_TABS.indexOf(fromRoute.tab);
    const j = PROFILE_TABS.indexOf(to.tab);
    if (i < 0 || j < 0 || i === j) return null;
    return j > i ? "tabR" : "tabL";
  }
  if (fromRoute?.name === "module" && to.name === "module" && a.id === b.id) {
    const i = MODULE_TAB_ORDER.indexOf(fromRoute.tab);
    const j = MODULE_TAB_ORDER.indexOf(to.tab);
    if (i >= 0 && j >= 0 && i !== j) return j > i ? "tabR" : "tabL";
  }

  if (a.sec === "deck" && b.sec === "module") return "morph";
  if (a.sec === "module" && b.sec === "deck") return "morphBack";
  if (a.sec !== b.sec) return "swap";

  // Same module, different chapter is sideways rather than deeper.
  if (b.depth === a.depth) return a.id && b.id && a.id !== b.id ? "swap" : null;
  return b.depth > a.depth ? "fwd" : "back";
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

/* WHICH LAYER GETS ITS OWN SNAPSHOT, AND WHY IT IS EXACTLY ONE.
 *
 * Mission Control moves three different things depending on what changed: a
 * whole screen, a tab panel inside a screen, or the Ready Room's pane beside
 * its rail. Each needs its own snapshot to move independently of the chrome.
 *
 * But only the one that is actually moving may be named. Naming a tab panel
 * during a whole-screen change lifts it OUT of the screen and animates it on a
 * clock of its own, which is how a transition comes apart — two children of one
 * movement, running at different speeds, sliding against each other.
 *
 * So this clears every name first and then sets exactly the set the scope calls
 * for. It is a full reset rather than a diff because a name left behind from
 * the previous navigation is not visible in any way until it silently aborts
 * the next one.
 */
const CONTENT = [".deck-inner", ".content"];
const PANELS = [".mcard > .pane", ".profile .panel-swap"];
const PANE = [".room > .pane"];
const RAIL = [".room > .rail"];
const ALL = [...CONTENT, ...PANELS, ...PANE, ...RAIL];

export function clearNames() {
  for (const sel of ALL) {
    for (const el of document.querySelectorAll(sel)) el.style.viewTransitionName = "";
  }
}

export function nameLayers(scope) {
  clearNames();
  /* The screen itself, always — it is what recedes and arrives. First match
     wins: .deck-inner is the page, .content is the fallback for a route that
     does not use it. */
  for (const sel of CONTENT) {
    const el = document.querySelector(sel);
    if (el) { el.style.viewTransitionName = "wg-content"; break; }
  }
  if (scope === "tab") {
    for (const sel of PANELS) {
      const el = document.querySelector(sel);
      if (el) el.style.viewTransitionName = "wg-tabpanel";
    }
  }
  if (scope === "pane") {
    for (const sel of PANE) {
      const el = document.querySelector(sel);
      if (el) el.style.viewTransitionName = "wg-pane";
    }
    /* Pinned so it does not travel with the pane. The rail is furniture. */
    for (const sel of RAIL) {
      const el = document.querySelector(sel);
      if (el) el.style.viewTransitionName = "wg-rail";
    }
  }
}

/* A tab move animates the panel; everything else animates the screen. */
export const scopeOf = (kind) => (String(kind).startsWith("tab") ? "tab" : "screen");

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
