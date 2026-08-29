/* ============================================================================
   Wingman — the shell
   Scroll, the chin and the runway lights, the player dock, and thumbnails.

   Copy the pure functions verbatim.

   This file removes the app-shell scroll container. That container was built
   for a good reason — to keep the runway lights pinned — and it is the root
   cause of four separate problems. Everything here keeps the feature and drops
   the container.
   ========================================================================= */


/* ============================================================================
   1 · THE SCROLL ARCHITECTURE
   ----------------------------------------------------------------------------
   Rule: the DOCUMENT scrolls. Nothing sets overflow:hidden on html or body,
   and there is no inner scroll container.
   ========================================================================= */

/* WHAT THE SHELL WAS COSTING

   `overflow:hidden` on html/body with an inner `.deck` scroller was there so
   the runway lights could sit at the bottom of a fixed-height box. It caused:

   1 · The wheel over the video does nothing. Measured on the live site at five
       points: everywhere else reaches `.deck`; over the <video> nothing at all.
       The video is 402px of an 888px viewport — the middle 45% of the screen
       and exactly where the cursor sits after you press play.
   2 · The mini player docks inconsistently, because the IntersectionObserver
       root and the real scroller disagree.
   3 · On iOS the URL bar never collapses, so ~60-100px of screen is gone for
       good.
   4 · Browser scroll restoration does not work, and `position: sticky` — which
       the new route sidebar depends on — measures against the wrong box.

   THE FIX IS PLACEMENT, NOT ARCHITECTURE. `position: fixed` already pins a
   thing to the viewport while the page scrolls underneath. It appeared not to
   work because of the trap below. */

/* THE TRAP, AND IT EXPLAINS TWO BUGS AT ONCE

   If ANY ancestor has `transform`, `filter`, `perspective`, `backdrop-filter`,
   `contain: paint` or `will-change: transform`, every `position: fixed`
   descendant is positioned against THAT element instead of the viewport.

   The aurora rig has `filter: blur()` and `will-change: transform` in its
   subtree. So anything fixed inside the deck silently stops being fixed — which
   looks exactly like "fixed doesn't work here", and the natural workaround is
   the shell.

   The chin and the player layer must therefore be SIBLINGS OF THE ROUTER, at
   the top of the DOM, outside the aurora subtree:

     <body>
       <Router />          ← scrolls normally
       <PlayerLayer />     ← the one video
       <Chin />            ← runway lights
     </body>

   Add this to CI. It is invisible until it breaks and then it is baffling. */
export function assertNoFixedTrap(el) {
  const bad = [];
  for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' ||
        cs.backdropFilter && cs.backdropFilter !== 'none' ||
        /paint|strict|content/.test(cs.contain) || /transform/.test(cs.willChange)) {
      bad.push({ el: n.className || n.tagName, transform: cs.transform, filter: cs.filter,
                 contain: cs.contain, willChange: cs.willChange });
    }
  }
  return bad;     // empty means position:fixed will behave
}


/* ============================================================================
   2 · THE CHIN AND THE RUNWAY LIGHTS
   ----------------------------------------------------------------------------
   Rule: a fixed strip at the foot of the viewport with the lights at its
   start, reading window scroll. It never moves and it never takes a tap.
   ========================================================================= */

export const RUNWAY_N = 12;

/* Read from the window, not from a container. This is the only line that
   changes when the shell comes out. */
export const scrollProgress = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max <= 4 ? null : Math.min(1, Math.max(0, window.scrollY / max));
};

export const litCount = (p, n = RUNWAY_N) => Math.round(p * n);

/* ONE rAF, ONE DOM WRITE, AND ONLY WHEN THE COUNT CHANGES.

   Updating a scroll indicator on every scroll event is the same mistake that
   made the video swim — a handler runs after paint, so the indicator is always
   a frame behind. Coalesce into rAF, and only touch the DOM when the number of
   lit dots actually changes, which is about twelve times over a whole page. */
export function mountRunway(chinEl, dots) {
  let ticking = false, last = -1;
  const paint = () => {
    const p = scrollProgress();
    if (p === null) { chinEl.hidden = true; return; }   // nothing to scroll
    chinEl.hidden = false;
    const lit = litCount(p, dots.length);
    if (lit === last) return;
    last = lit;
    for (let i = 0; i < dots.length; i++) dots[i].dataset.lit = i < lit ? '1' : '0';
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { paint(); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', paint);
  paint();
  return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', paint); };
}

/* `pointer-events: none` on the chin. A full-width strip across the foot of the
   viewport is exactly the kind of thing that quietly eats taps on the last row
   of every list. If any part of it ever becomes interactive, that part gets
   `pointer-events: auto` and nothing else does.

   And reserve its height. Every page adds --chin-h to its bottom padding, or
   the last row of every list sits behind it — invisible in a mockup, annoying
   on every screen. The mini player stacks on top of it, not over it. */
export const CHIN_H = 26;


/* ============================================================================
   3 · THE PLAYER DOCK — no tracking
   ----------------------------------------------------------------------------
   Rule: inline, the player fills its slot and scrolls with the page. When the
   slot leaves the viewport — by scrolling OR by navigating away — it docks.
   ========================================================================= */

/* WHY THE VIDEO SWIMS TODAY, AND IT IS MY FAULT

   The player is `position: fixed` and its transform is recomputed in a scroll
   handler. A fixed element repositioned from a scroll event is ALWAYS a frame
   behind the content, so the video visibly slides against the page. Not
   imagination — it is structural.

   THE FIX IS TO STOP TRACKING. One element, always a child of the slot, that
   toggles between two positions:

     inline:  position: absolute; inset: 0     ← fills the slot, scrolls
                                                 naturally, zero JavaScript
     mini:    position: fixed                  ← docked corner

   No re-parenting, no per-frame maths, no jank. One state change.

   This needs §1's trap to be clear — the slot's ancestors must not create a
   containing block, or the mini state will be positioned against the deck. */

export const DOCK_THRESHOLD = 0.4;

export function dockReducer(p, ev) {
  switch (ev.type) {
    case 'load':
      return p.lessonId === ev.lessonId
        ? { ...p, dock: 'inline' }
        : { ...p, lessonId: ev.lessonId, moduleId: ev.moduleId,
            seconds: ev.seconds ?? 0, playing: false, dock: 'inline' };

    case 'slot':
      if (ev.visible) return { ...p, dock: 'inline' };
      return { ...p, dock: p.playing ? 'mini' : 'none' };

    /* Leaving the page docks it too — same rule, different trigger. The player
       lives above the router, so navigating away is just the slot ceasing to
       exist. */
    case 'route':
      if (ev.onLesson === p.lessonId) return p;
      return { ...p, dock: p.playing ? 'mini' : 'none' };

    case 'play':  return { ...p, playing: true };
    case 'pause': return { ...p, playing: false };
    case 'close': return { ...p, playing: false, dock: 'none' };   // close = stop
    case 'time':
    case 'seek':  return { ...p, seconds: ev.seconds };
    default: return p;
  }
}

/* The observer's root must be the actual scroller. With the shell gone that is
   the viewport, so root stays null — but state it, because it was the cause of
   the inconsistent docking and someone will reintroduce a container. */
export function observeSlot(slotEl, dispatch) {
  const io = new IntersectionObserver(
    ([e]) => dispatch({ type: 'slot', visible: e.intersectionRatio >= DOCK_THRESHOLD }),
    { root: null, threshold: [0, DOCK_THRESHOLD, 1] }   // null = the viewport
  );
  io.observe(slotEl);
  return () => io.disconnect();
}


/* ============================================================================
   4 · THE MINI PLAYER — shaped like Picture-in-Picture
   ----------------------------------------------------------------------------
   Rule: no chrome. Just the video, draggable, press to pause, two buttons on
   hover in the corners.
   ========================================================================= */

/* YOU DESCRIBED NATIVE PICTURE-IN-PICTURE almost feature for feature: a
   borderless floating window, free to move, click to pause, a corner button
   back to the tab.

   The catch is that `requestPictureInPicture()` requires a user gesture, so it
   cannot be the automatic behaviour. Hence both:
     · this custom dock, which is automatic and looks like PiP
     · a PiP button in the control bar, for the real OS window when wanted */

export const MINI_W = 320;
export const MINI_MARGIN = 20;
export const SNAP_MS = 200;

/* Position as a FRACTION of the free space, exactly as the note bar does — so
   the window is mathematically incapable of leaving the viewport at any size,
   and survives a rotation or a resize. */
const clamp01 = v => Math.min(1, Math.max(0, v));
export function miniPosition(frac, view, box) {
  const freeX = Math.max(0, view.width  - box.width  - MINI_MARGIN * 2);
  const freeY = Math.max(0, view.height - box.height - MINI_MARGIN * 2 - (view.chin || 0));
  return { x: MINI_MARGIN + clamp01(frac.fx) * freeX,
           y: MINI_MARGIN + clamp01(frac.fy) * freeY };
}
export function miniFraction(px, view, box) {
  const freeX = Math.max(1, view.width  - box.width  - MINI_MARGIN * 2);
  const freeY = Math.max(1, view.height - box.height - MINI_MARGIN * 2 - (view.chin || 0));
  return { fx: clamp01((px.x - MINI_MARGIN) / freeX),
           fy: clamp01((px.y - MINI_MARGIN) / freeY) };
}

/* Release snaps to the nearest corner, which is what PiP does and what stops a
   dragged window ending up half over the thing you were reading. */
export const snapCorner = frac => ({ fx: frac.fx < .5 ? 0 : 1, fy: frac.fy < .5 ? 0 : 1 });

export const DEFAULT_MINI_POS = { fx: 1, fy: 1 };   // bottom trailing corner

/* Two controls, both on hover, both in corners — the same pair PiP shows.
     top-trailing  → back to the lesson, at this position
     top-leading   → stop
   Pressing the video itself pauses. Nothing else. */
export const miniTarget = p =>
  p.lessonId ? { lessonId: p.lessonId, moduleId: p.moduleId, seconds: p.seconds } : null;

/* Drag with pointer events and setPointerCapture — one path for mouse, finger
   and pen. `touch-action: none` goes on the mini player ONLY while it is
   docked, never on the inline player: on the inline one it stops a finger
   dragging the page, which is the wheel bug again and worse. */


/* ============================================================================
   5 · THUMBNAILS — real first frames
   ----------------------------------------------------------------------------
   Rule: a lesson row shows a frame from its own video. Generated tiles are the
   fallback, not the target.
   ========================================================================= */

/* THREE WAYS, AND THE RIGHT ONE DEPENDS ON WHEN

   Production: pull a frame with ffmpeg at upload and store a poster URL. Costs
   the browser nothing. Do this the moment there is real content.

   Now: capture client-side, once per lesson, and cache it. The video host must
   send CORS headers and the element must carry crossorigin="anonymous", or the
   canvas is tainted and toDataURL throws.

   Nicest: capture on first play, so a module fills in with real pictures as the
   cohort works through it. */

export const POSTER_W = 256, POSTER_H = 144;   // 2x the 128x72 row. No larger —
                                               // a full-resolution frame per row
                                               // is the classic way a list
                                               // becomes slow.
export const posterKey = lessonId => `wingman.poster.${lessonId}`;

export function cachedPoster(lessonId) {
  try { return localStorage.getItem(posterKey(lessonId)); } catch { return null; }
}

/* One offscreen video element for the whole app, reused. Twenty-four hidden
   <video> elements is twenty-four network connections and a stalled page. */
/* eslint-disable no-use-before-define --
   once() and withTimeout() are const arrows declared just below. Nothing runs
   at module-evaluation time, so there is no temporal dead zone in practice,
   and this file is copied verbatim from the brief rather than reordered. */
export async function captureFrame(src, { at = 0.1, timeout = 6000 } = {}) {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.preload = 'metadata';
  v.muted = true;
  v.playsInline = true;
  v.src = src;
  try {
    await withTimeout(once(v, 'loadedmetadata'), timeout);
    v.currentTime = Math.min(at, (v.duration || 1) - 0.05);
    await withTimeout(once(v, 'seeked'), timeout);
    const c = document.createElement('canvas');
    c.width = POSTER_W; c.height = POSTER_H;
    c.getContext('2d').drawImage(v, 0, 0, POSTER_W, POSTER_H);
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;                    // tainted canvas, CORS, or a dead source
  } finally {
    v.removeAttribute('src'); v.load();
  }
}
/* eslint-enable no-use-before-define */
const once = (el, ev) => new Promise(res => el.addEventListener(ev, res, { once: true }));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(rej, ms))]);

/* Never block a render on this. Rows paint with the generated tile immediately;
   a captured frame replaces it when it arrives, and because both are exactly
   128x72 nothing shifts. */
export async function posterFor(lesson) {
  if (lesson.thumb) return lesson.thumb;                 // a real poster URL wins
  const hit = cachedPoster(lesson.id);
  if (hit) return hit;
  const frame = await captureFrame(lesson.video?.src);
  if (frame) { try { localStorage.setItem(posterKey(lesson.id), frame); } catch {} }
  return frame;                                          // null -> keep the tile
}


/* ============================================================================
   6 · THE BORDER — the deck's, not a darkened accent
   ----------------------------------------------------------------------------
   Rule: every resting border is the deck's translucent hairline. Full accent
   belongs to the current thing and nothing else.
   ========================================================================= */

/* An opaque accent-derived edge was built and rejected: it read as harsh, made
   every card shout, and cost the accent its meaning — if everything is
   outlined in the accent then nothing is *the current thing*.

   The deck draws a light, barely tinted, translucent hairline. Alpha is what
   makes it sit down. Values in wingman-module-v2-source.css:

     dark   --edge      oklch(.720 <chroma*.34> <hue> / .26)
            --edge-soft oklch(.720 <chroma*.28> <hue> / .16)
     light  --edge      oklch(.440 <chroma*.26> <hue> / .22)
            --edge-soft oklch(.440 <chroma*.20> <hue> / .13)

   A module card and a deck card are then the same object, which is the point.

   ONE MEASUREMENT NOTE: a translucent border cannot be checked with a plain
   contrast ratio — the number is meaningless because the sampled colour is not
   what is painted. Composite it over the surface first, then measure. A test
   that reports 6.89 for a hairline you can barely see is measuring the wrong
   thing. */


/* ============================================================================
   7 · THE TYPE FLOOR WAS NOT A FLOOR
   ----------------------------------------------------------------------------
   `--fs-xs: calc(.8125rem * var(--sc))` with `--sc: .9375` on phones renders at
   **12.19px** — so the stated 13px floor was 12.19px on every phone, on every
   screen in the app.

     --fs-xs: max(13px, calc(.8125rem * var(--sc)));

   Belongs in wingman-foundations.css. Check it by grepping the built CSS for
   computed sizes under 13 at a 390px viewport, not by reading the token.
   ========================================================================= */
