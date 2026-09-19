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
  // A chapter, a lesson, a review and a card set all live INSIDE a module.
  chapter: ["module", 2],
  lesson: ["module", 2],
  review: ["module", 2],
  cards: ["module", 2],
  ready: ["ready", 0],
  profile: ["account", 0],
  logbook: ["logbook", 0],
  // Bookmarks is one section with two depths: the folders, and inside a folder.
  bookmarks: ["bookmarks", 0],
  signin: ["signin", 0],
  notfound: ["notfound", 0],
};

const MODULE_TAB_ORDER = ["chapters", "pdf", "crew", "people"];

export function placeOf(route) {
  const [sec, depth] = PLACE[route?.name] || ["other", 0];
  // Opening a folder is a descent inside Bookmarks, so it arrives from in
  // front and Back returns to the folders rather than crossfading with them.
  if (route?.name === "bookmarks" && route.folder) return { sec, depth: 1, id: "" };
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
export function transitionKind(fromRoute, toPath, { lessonOrder } = {}) {
  if (!toPath) return null;
  const a = placeOf(fromRoute);
  const to = parseRoute(toPath);
  const b = placeOf(to);

  /* The same place is not a move. Everything past this line is one, and every
     one of them returns a kind: a navigation that cannot be classified still
     crossfades rather than cutting. */
  const same = (x, y) => ["name", "moduleCode", "chapterId", "lessonId", "tab", "sub", "paperId", "page", "flow", "folder", "chapter"]
    .every((k) => (x?.[k] ?? null) === (y?.[k] ?? null));
  if (same(fromRoute, to)) return null;

  /* LESSON TO LESSON IN ONE CHAPTER is a panel move, in lesson order: the
     player and the notes slide, and the chapter's own list beside them holds,
     because it is the list you chose from. It used to return nothing at all —
     same section, same depth, same module — so the player, the title, the
     scrubber and the notes all snapped. */
  if (fromRoute?.name === "lesson" && to.name === "lesson" && fromRoute.chapterId === to.chapterId) {
    const i = lessonOrder?.(fromRoute);
    const j = lessonOrder?.(to);
    if (Number.isFinite(i) && Number.isFinite(j) && i >= 0 && j >= 0 && i !== j) return j > i ? "tabR" : "tabL";
    return "swap";
  }

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

  /* Same section, same depth, somewhere else: sideways. This used to demand two
     different module ids and return nothing otherwise, which is why Settings to
     Licence — siblings in one section with no module id at all — cut hard. */
  if (b.depth === a.depth) return "swap";
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
  const root = document.documentElement;
  root.dataset.vt = kind;
  // A flag a superseded transition raised belongs to that transition only.
  delete root.dataset.vtBackdrop;
  return ++generation;
}

export function endTransition(token) {
  if (token !== generation) return false;
  delete document.documentElement.dataset.vt;
  delete document.documentElement.dataset.vtBackdrop;
  return true;
}

/* DID THE BACKDROP CHANGE UNDER THIS NAVIGATION?
 *
 * The root — the ground colour and the scenery behind every screen — paints
 * once on a navigation, because between two ordinary screens it is the same
 * picture and a dissolve of a thing into itself only costs frames. One screen
 * re-grounds the whole document: the exam puts <html data-screen="exam">, a
 * flat matte ground with the scenery off. Walking into or out of it swapped
 * the entire background in a single frame under a sliding screen.
 *
 * So the callback compares the screen flag either side of the commit and
 * raises data-vt-backdrop when it moved; the stylesheet then holds the old
 * root and dissolves the new one over it. Keyed on the flag rather than on a
 * route name, so any screen that re-grounds the page later gets it for free. */
export const screenFlag = () => document.documentElement.dataset.screen || "";
export function markBackdrop(before) {
  if (screenFlag() !== before) document.documentElement.dataset.vtBackdrop = "1";
}

/* WHICH LAYER GETS ITS OWN SNAPSHOT, AND WHY IT IS EXACTLY ONE.
 *
 * Mission Control moves a different thing depending on what changed: a whole
 * screen (with the app bar beside it, which leaves only for the Ready Room), a
 * tab panel inside a screen, the Ready Room's pane beside its rail, or, between
 * two questions in one module, the question column alone. Each needs its own
 * snapshot to move independently of the chrome.
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
/* `.deck`, NOT `.deck-inner`. The inner element is keyed by route and sits
   inside <Suspense>: it is replaced on every navigation and hidden whenever a
   route suspends, so a name written on it can be lost between the moment it
   is written and the moment the browser photographs the page. `.deck` is the
   scroller around it, outside Suspense and never remounted, so the name
   survives both. It is also the viewport rather than the whole page — a
   snapshot the size of the screen instead of 1300px of it, and no size tween
   between two pages of different heights. */
const CONTENT = [".deck", ".content"];
const PANELS = [".mcard > .pane", ".profile .panel-swap", ".mscreen.lesson .watch"];
/* A lesson's own list sits inside .watch but does not travel with it, and the
   video is drawn by an overlay outside the page entirely — it moves with the
   panel under a name of its own, on the same keyframes, so the picture stays
   in its frame. */
const LESSON_LIST = [".mscreen.lesson .watch > .sd"];
const PLAYER = [".player-layer"];
const CARD = [".mscreen .mcard"];
/* The app bar. It sits above the screen (z-index 20), so a receding screen
   scaled past its own edge used to paint over it; named, it keeps its place in
   the stack. And the Ready Room has none — it takes the whole window — so this
   is also what lets the bar leave and come back rather than blink. */
const TOPBAR = ["header.topbar"];
/* THE READY ROOM'S OWN ELEMENTS. These said `.room > .pane` and `.room > .rail`
   — the room before its rebuild — and in the live DOM `.room` holds only its
   veil, modal and toast, so the pane layer named nothing and the room's panes
   had never once moved. */
const PANE = [".rr-app > .rr-pane"];
const RAIL = [".rr-app > .rr-rail"];
/* The question column alone, for moves between questions in one module: the
   feed on its left is the thing you are choosing from and should hold still. */
const DETAIL = [".rr-app .rr-detail"];
const FEED = [".rr-app .rr-feed"];
/* On screen at all. A narrow room shows one column at a time and hides the
   others with display: none, and an element that is not rendered cannot be
   photographed — naming it only guarantees an old side or a new side with
   nothing on the other. */
const shown = (el) => Boolean(el && el.getClientRects().length);
/* THE ONE OBJECT THAT IS ON BOTH SCREENS: a module's card in the Flight Deck's
   launcher, and the heading it opens into inside the module. Exactly one of
   the two is ever on screen, so they can share a name and the browser tweens
   the box between them. */
const MCARD_DECK = (code) => `.deck .mod[data-code="${code}"]`;
const MCARD_HERO = ".mscreen .mhero";
const ALL = [...CONTENT, ...PANELS, ...PANE, ...RAIL, ...DETAIL, ...LESSON_LIST, ...PLAYER, ...CARD, ...TOPBAR,
  ".deck .mod[data-code]", MCARD_HERO];

export function clearNames() {
  for (const sel of ALL) {
    for (const el of document.querySelectorAll(sel)) el.style.viewTransitionName = "";
  }
}

export function nameLayers(scope) {
  clearNames();
  /* The screen, for a SCREEN change only. It used to be named for every kind,
     and a tab or a pane move then ran the whole page through a crossfade of
     its own on top of the panel's slide: the title and the tab strip blinked
     while the panel moved, and the active pill could not travel because the
     live page was hidden under a snapshot of itself. When only a panel moves,
     everything else stays in the root, which is instant — and instant is what
     "the frame holds still" means. */
  if (scope === "screen") {
    for (const sel of CONTENT) {
      const el = document.querySelector(sel);
      if (el) { el.style.viewTransitionName = "wg-content"; break; }
    }
    const bar = document.querySelector(TOPBAR[0]);
    if (bar) bar.style.viewTransitionName = "wg-topbar";
  }
  if (scope === "tab") {
    for (const sel of PANELS) {
      const el = document.querySelector(sel);
      if (el) el.style.viewTransitionName = "wg-tabpanel";
    }
    /* The module screen's card: its height changes as a morph around the
       panel rather than a jump. The selected tab's pill is deliberately NOT
       named — as a layer of its own it painted over the tab labels; it slides
       in the page instead (useTabPill), and the card's new picture is live, so
       the slide shows through it. */
    const card = document.querySelector(CARD[0]);
    if (card) card.style.viewTransitionName = "wg-card";
    const list = document.querySelector(LESSON_LIST[0]);
    if (list) {
      list.style.viewTransitionName = "wg-rail";
      const player = document.querySelector(PLAYER[0]);
      if (player) player.style.viewTransitionName = "wg-player";
    }
  }
  /* THE ROOM TAKES TURNS WHEN IT IS NARROW. Wide, the rail, the feed and a
     question sit side by side and only the part that changed moves: the pane
     beside a pinned rail, or the question beside a pinned feed. At 900px and
     under the rail and the pane take turns on screen, and at 1180px and under
     so do the feed and a question — so a move between them was the old column
     vanishing and the new one arriving over nothing, a blink. There, whichever
     column is on screen carries the name, on both sides of the move: the one
     you left crossfades into the one you opened. Only one of them is ever
     rendered at a time, so the name is never held twice. */
  if (scope === "pane") {
    const pane = document.querySelector(PANE[0]);
    const rail = document.querySelector(RAIL[0]);
    if (shown(pane) && shown(rail)) {
      pane.style.viewTransitionName = "wg-pane";
      /* Pinned so it does not travel with the pane. The rail is furniture. */
      rail.style.viewTransitionName = "wg-rail";
    } else {
      const on = shown(pane) ? pane : shown(rail) ? rail : null;
      if (on) on.style.viewTransitionName = "wg-pane";
    }
  }
  if (scope === "detail") {
    const detail = document.querySelector(DETAIL[0]);
    if (shown(detail) && shown(document.querySelector(FEED[0]))) {
      detail.style.viewTransitionName = "wg-detail";
    } else {
      const pane = document.querySelector(PANE[0]);
      const rail = document.querySelector(RAIL[0]);
      if (shown(pane)) pane.style.viewTransitionName = "wg-detail";
      if (shown(rail)) rail.style.viewTransitionName = "wg-rail";
    }
  }
}

/* NAME THE CARD THAT OPENS. Called with the module the move is about — the one
   being opened on the way in, the one being left on the way out — on both
   sides of the transition, exactly like nameLayers. Whichever of the two
   elements is on screen takes the name; if neither is (a module that is not on
   the deck's rail, say), nothing is named and the screens simply dissolve,
   which is the same movement without the card. */
export function nameMorph(code) {
  for (const el of document.querySelectorAll('.deck .mod[data-code]')) el.style.viewTransitionName = "";
  const hero = document.querySelector(MCARD_HERO);
  if (hero) hero.style.viewTransitionName = "";
  if (!code) return;
  const card = document.querySelector(MCARD_DECK(code));
  if (card) card.style.viewTransitionName = "wg-mcard";
  else if (hero) hero.style.viewTransitionName = "wg-mcard";
}

/* Which layer a kind moves. `pane` could never come back from this — it only
   knew tab and screen — so the pane branch above was unreachable and the Ready
   Room's rules were dead CSS. */
export const scopeOf = (kind) => {
  const k = String(kind);
  return k.startsWith("tab") ? "tab" : k.startsWith("pane") ? "pane" : "screen";
};

/* A MOVE INSIDE THE READY ROOM, which is not a navigation: the address does not
   change, the rail holds, and only the pane — or, between two questions in one
   module, only the question column — travels. Direction is the caller's to
   decide, because only the caller knows the order it moved through: down the
   rail or deeper into a thread is `paneR`, up or back out is `paneL`. */
export function paneTransition(kind, update, { scope = "pane" } = {}) {
  if (!canTransition()) { update(); return; }
  const token = beginTransition(kind);
  nameLayers(scope);
  const vt = document.startViewTransition(() => {
    flushSync(update);
    nameLayers(scope);
  });
  vt.ready?.catch(() => {});
  vt.finished?.catch(() => {}).finally?.(() => { if (endTransition(token)) clearNames(); });
}

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
