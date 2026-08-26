import { useMemo } from "react";
import { dotTile } from "../lib/liveryEngine.js";

// The room. In wingman-poc.html the whole page is the deck — the top bar sits
// inside it, so the key light lands on the bar as well as on the content, and
// there is no seam anywhere. This wraps the shell for exactly that reason: the
// build had .deck starting 81px down, below the top bar, which put the
// brightest corner of the design outside the lit room and shifted the whole
// gradient down.
//
// Every token it reads is on :root, written by App from deckVars().

const ROOM_CSS = `
/* THE ROOM.
 *
 * The rig used to live inside .deck. Now that .deck is the scroller, it cannot:
 * an absolutely-positioned child of a scroll container scrolls with the
 * content, so the key light, the fill, the spill, the starfield and the grain
 * would all slide up the page as you read. The room has to stay still while
 * the content moves through it.
 *
 * So it is a layer of its own, behind all three grid rows, clipping its own
 * light — which is also why the header keeps its key light despite now being a
 * sibling of the scroller rather than a child of the room.
 */
.deck-light { position: absolute; inset: 0; z-index: 0; pointer-events: none;
  overflow: clip; isolation: isolate; }

/* Light ADDS, it does not veil: screen, never a translucent overlay. */
.deck-light::before, .deck-light::after {
  content: ""; position: absolute; inset: -55%; pointer-events: none; z-index: 0;
  mix-blend-mode: screen; filter: blur(var(--soft)) saturate(1.28);
}
.deck-light::before { background: var(--key-img); opacity: var(--key-int); animation: pwdrift 26s ease-in-out infinite; }
.deck-light::after { background: var(--fill-img); opacity: var(--fill-int);
  filter: blur(calc(var(--soft) * 1.35)) saturate(1.2); animation: pwdrift 41s ease-in-out infinite reverse; }
/* Aurora's curtain used to be shaped by an SVG displacement warp here:
     filter: url(#pw-aurWarp) blur(30px) saturate(1.24)
   feTurbulence plus feDisplacementMap, over a surface inset -55% on every side,
   so roughly twice the viewport in each direction — and animated, so it was
   recomputed rather than cached. Measured on a desktop: 0.1fps with it, 59.2
   without. That is the flicker, and on a phone it is worse.
   DO NOT REINSTATE the url() filter here. Aurora still reads as aurora: the
   curtain is its gradient and the stars are their own layer. */
.deck-light.aur::before { filter: blur(30px) saturate(1.24); animation: pwdrift 34s ease-in-out infinite; }
/* Translate only. scale() changes the rasterised size of a surface that is
   blurred by 82px and screen-blended, so every frame repainted it instead of
   compositing a layer that already existed. The drift is unchanged. */
@keyframes pwdrift {
  0%, 100% { transform: translate3d(0,0,0); }
  34% { transform: translate3d(6%,-4%,0); }
  67% { transform: translate3d(-4%,4%,0); }
}
/* the same light again, over the top — the part that lands ON the panels */
.deck-light .spill { position: absolute; inset: -55%; z-index: 2; pointer-events: none;
  background: var(--key-img); filter: blur(calc(var(--soft) * 1.2)) saturate(1.22);
  mix-blend-mode: screen; opacity: var(--spill); animation: pwdrift 26s ease-in-out infinite; }
/* behind the panels but ABOVE the lights, so they show through the curtains */
.deck-light .stars { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: var(--stars, 0);
  background-image: var(--star-img, none); background-repeat: repeat;
  background-size: cover; mix-blend-mode: screen;
  animation: pwtwinkle 13s ease-in-out infinite alternate; }
@keyframes pwtwinkle { from { opacity: var(--stars, 0); } to { opacity: calc(var(--stars, 0) * .5); } }
/* dark gradients band; noise kills it and gives the light a tooth */
.deck-light .grain { position: absolute; inset: 0; z-index: 4; pointer-events: none; opacity: var(--grain);
  mix-blend-mode: overlay; background-size: 150px 150px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23n)'/%3E%3C/svg%3E"); }


/* ============================================================
   THE FINISH SYSTEM.
   Ported from design/wingman-finish-source.css. Values verbatim.
   Selectors are remapped: the reference targets .deck .lite, but here the
   light rig is .deck-light and it is a SIBLING of the scroller rather than a
   child of it, so the state lives on .app and the rig is reached from there.
   ============================================================ */

/* aurora gets more lift than the standard rig — this is the glow */
.app[data-aur="1"] .deck-light::before { filter: blur(var(--soft)) saturate(1.70) brightness(1.30); }
.app[data-aur="1"] .deck-light::after { filter: blur(calc(var(--soft)*1.15)) saturate(1.62) brightness(1.34); }

/* overcast layer, used by Tarmac's aurora only */
.a-cloud { position: absolute; inset: 0; z-index: 1; pointer-events: none; mix-blend-mode: multiply;
  background: var(--cloud-img); filter: blur(30px); opacity: var(--cloud-op, 0); }

/* ruled-lines layer for the Manual finish */
.rules { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0; }

/* MANUAL — printed by day, microfiche by night */
.app[data-paper="1"] { --rule: oklch(.58 .012 85 / .55); --hair: oklch(.58 .012 85 / .30); }
.app[data-paper="1"][data-fiche="1"] { --rule: oklch(.62 .010 85 / .48); --hair: oklch(.62 .010 85 / .26); }
.app[data-paper="1"] .card, .app[data-paper="1"] .mod, .app[data-paper="1"] .crew {
  border-radius: 3px; border-color: var(--rule); box-shadow: var(--paper-drop); }
.app[data-paper="1"] .strip, .app[data-paper="1"] .crew { background: var(--hair); }
.app[data-paper="1"] .frame { border-radius: 2px; border-color: var(--hair); background: transparent; }
.app[data-paper="1"] .cap { letter-spacing: 1.7px; }
.app[data-paper="1"] .cel .cap::before { content: ""; display: block; width: 16px; height: 1px;
  background: var(--rule); margin: 0 auto 7px; }
.app[data-paper="1"] .hobbs { background: transparent; border: 0; border-bottom: 1.5px solid var(--rule);
  border-radius: 0; color: var(--t1); padding: 2px 6px 3px; }
.app[data-paper="1"] .mcur { background: transparent; color: var(--active); border: 1.5px solid var(--active);
  border-radius: 2px; padding: 2px 6px; transform: rotate(-3.5deg); display: inline-block; letter-spacing: 1.6px; }
.app[data-paper="1"] .mname { color: var(--t1); }
.app[data-paper="1"] .box { border-radius: 1px; background: transparent; border: 1.2px solid var(--rule); }
.app[data-paper="1"] .box.on { background: transparent; border-color: var(--active); }
.app[data-paper="1"] .resume { background: transparent; color: var(--active); border: 1.5px solid var(--active); border-radius: 2px; }
.app[data-paper="1"] .play { background: transparent; border: 1.4px solid var(--active); }
.app[data-paper="1"] .play svg { color: var(--active); }
.app[data-paper="1"] .rev { position: absolute; left: -1px; top: 14px; bottom: 14px; width: 2px; background: var(--active); }
.app[data-paper="1"] .pref { position: absolute; right: 12px; bottom: 11px; font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: .9px; color: var(--t3); opacity: .75; }
/* The scanlines sit on the shell, not the scroller: an absolutely positioned
   overlay inside a scroll container scrolls with the content. */
.app[data-fiche="1"]::after { content: ""; position: absolute; inset: 0; z-index: 5; pointer-events: none;
  background: repeating-linear-gradient(180deg, rgba(255,255,255,.028) 0 1px, transparent 1px 3px);
  box-shadow: inset 0 0 150px 45px oklch(.10 .008 85 / .60); }
.ink { stroke: var(--active); fill: none; stroke-width: 1.15; vector-effect: non-scaling-stroke; }
.inkh { stroke: var(--hair); fill: none; stroke-width: 1; vector-effect: non-scaling-stroke; }
.inkf { fill: var(--active); stroke: none; }
.cn { font-family: "Geist Mono", ui-monospace, monospace; font-size: 7px; fill: var(--t3); }

/* THE SCROLLER — the only thing on the page that scrolls. */
.deck {
  position: relative; z-index: 1;
  /* REQUIRED. A grid child defaults to min-height:auto and grows to fit its
     content instead of scrolling, which puts the whole page back on the
     window and undoes everything else here. */
  min-height: 0;
  /* REQUIRED, and for the same reason as min-height above but horizontally.
     A grid item's automatic minimum size is min-content, so the implicit
     column was sized by the widest thing on the page rather than by the
     scroller. On a phone that resolved to a 780px track inside a 390px deck
     and overflow-x clipped the difference: the page rendered at desktop width
     with the right-hand half simply cut off and no way to reach it. */
  grid-template-columns: minmax(0, 1fr);
  overflow-y: auto; overflow-x: hidden;
  /* grid with safe centring, not margin-block:auto. An auto vertical margin
     computes to zero in a block container — it only centres in flex or grid.
     The safe keyword is the important half: when the content is taller than
     the scroller it falls back to start, so nothing gets clipped off the top
     and made unreachable, which is the classic way this goes wrong. */
  display: grid; align-content: safe center;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scroll-padding-block: 16px;
  padding: 0 40px; color: var(--t1);
  font-family: var(--font-ui);
}
@media (max-width: 640px) { .deck { padding: 0 16px; } }
.deck:focus-visible { outline: 2px solid var(--active); outline-offset: -2px; }

/* Short content sits optically centred between the header and the lights
   rather than hanging from the top. Never stretched, never padded to fill. */
.deck-inner { display: flex; flex-direction: column; gap: clamp(14px, 2.4vh, 28px);
  max-width: 1240px; margin-inline: auto; width: 100%;
  /* the fade into the chrome sits on the content, not the scroller — a mask on
     an overflow container also masks the scrollbar gutter in some engines */
  mask-image: linear-gradient(to bottom, transparent 0, #000 20px,
    #000 calc(100% - 24px), transparent 100%);
}
.deck-inner > main { width: 100%; }
.deck *:focus-visible { outline: 2px solid var(--active); outline-offset: 2px; }
`;

function Deck({ aurora, rules }) {
  const stars = useMemo(() => ({
    "--stars-a": dotTile(30, 20260824, 1.4, 0.8),
    "--stars-b": dotTile(20, 77003311, 1.0, 0.58),
  }), []);

  return (
    <div className={`deck-light ${aurora ? "aur" : ""}`} style={stars} aria-hidden="true">
      <div className="stars" />
      <div className="a-cloud" />
      <div className="rules" style={rules || undefined} />
      <div className="spill" />
      <div className="grain" />
      <style>{ROOM_CSS}</style>
    </div>
  );
}

export default Deck;
