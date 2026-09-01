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
import { parseRoute } from "./routes.js";

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

export function placeOf(route) {
  const [sec, depth] = PLACE[route?.name] || ["other", 0];
  return { sec, depth, id: route?.moduleCode || "" };
}

/* THE DECK IS NOT A PARENT OF A MODULE, it is the drawer the module was in.
   Opening one is a card growing into a page, and closing it is that card
   settling back — which is why those two get their own kinds rather than
   plain forward and back. Everything else is depth. */
export function transitionKind(fromRoute, toPath) {
  if (!toPath) return null;
  const a = placeOf(fromRoute);
  const b = placeOf(parseRoute(toPath));
  if (a.sec === "deck" && b.sec === "module") return "morph";
  if (a.sec === "module" && b.sec === "deck") return "morphBack";
  if (a.sec !== b.sec) return "swap";
  // Same module, different chapter — sideways, not deeper.
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

/* THE SHARED ELEMENT, and why it is assigned by hand rather than in CSS.
   A view-transition-name has to be unique in the document, so the deck's
   module cards cannot all carry the morph name — only the one being opened
   may. It is written on the element for the length of the transition and
   taken off again, and `clearMorph` is safe to call when nothing was set. */
const MORPH = "wg-morph";
let morphed = null;

export function markMorph(el) {
  clearMorph();
  if (!el) return;
  morphed = el;
  el.style.viewTransitionName = MORPH;
}

export function clearMorph() {
  if (morphed) morphed.style.viewTransitionName = "";
  morphed = null;
}

/* THE RETURN TRIP, and the reason it needs its own call.
 *
 * Going in is easy: the card exists when you click it, so it can be named
 * before the move. Coming back, the card you are returning to does not exist
 * yet — the deck has not rendered. Naming it "after the navigation" in the
 * ordinary sense is too late, because by then the browser has already taken
 * its after-snapshot and the transition is decided.
 *
 * The window is inside the transition callback, after flushSync has committed
 * the new screen and before the callback returns — the deck is in the DOM and
 * the snapshot has not been taken, so the card can be found and named and the
 * heading shrinks back into it instead of fading out.
 *
 * Which card: the one for the module being left. Matched on data-code rather
 * than on the name shown, because a title is a label and a code is an
 * identifier — the prototype matched on the visible text and would have picked
 * the wrong card the moment two modules shared a name.
 *
 * AND IT HAS TO WAIT, which was not obvious. flushSync commits the deck, but
 * the module cards are not in that commit — measured at the snapshot instant,
 * .deck was present with ZERO cards, and four appeared a moment later. They
 * come from state that settles after the first paint, so "synchronously after
 * flushSync" is still too early.
 *
 * startViewTransition takes an async callback and holds the snapshot until the
 * promise settles, which is exactly the hook for this. It waits on a
 * MutationObserver rather than a poll, so the common case costs one microtask
 * when the cards are inserted instead of an interval, and it is hard-bounded:
 * if the card has not arrived in time the transition proceeds without it and
 * the heading fades. A missing flourish is a fine outcome; a page frozen
 * behind a snapshot waiting for data is not.
 */
const TARGET_WAIT_MS = 220;

export function markMorphTarget(kind, fromRoute) {
  if (kind !== "morphBack") return Promise.resolve();
  const code = fromRoute?.moduleCode;
  if (!code) return Promise.resolve();
  const find = () => document.querySelector(`.deck .mod[data-code="${CSS.escape(code)}"]`);

  const now = find();
  if (now) { markMorph(now); return Promise.resolve(); }

  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    let mo = null;
    let deadline = null;
    const finish = (card) => {
      if (done) return;
      done = true;
      if (mo) mo.disconnect();
      clearTimeout(deadline);
      // THE DEADLINE IS CHECKED BEFORE MARKING, not after finding. Checking it
      // second meant a late arrival still got the name, and in a BACKGROUND TAB
      // setTimeout is throttled to about a second — so the transition sat on a
      // frozen snapshot for 1000ms waiting for a flourish nobody was watching.
      // Measured: the forward callback runs in 1ms, this one ran in 1000.
      if (card && Date.now() - started < TARGET_WAIT_MS) markMorph(card);
      resolve();
    };
    // A MutationObserver fires when the cards are actually inserted, so the
    // common case costs one microtask rather than a polling interval.
    mo = new MutationObserver(() => { const c = find(); if (c) finish(c); });
    mo.observe(document.body, { childList: true, subtree: true });
    deadline = setTimeout(() => finish(null), TARGET_WAIT_MS);
  });
}
