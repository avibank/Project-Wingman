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
