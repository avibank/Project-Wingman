import { useMemo } from "react";
import { dotTile, glitterTile } from "../lib/liveryEngine.js";

// The room. In wingman-poc.html the whole page is the deck — the top bar sits
// inside it, so the key light lands on the bar as well as on the content, and
// there is no seam anywhere. This wraps the shell for exactly that reason: the
// build had .deck starting 81px down, below the top bar, which put the
// brightest corner of the design outside the lit room and shifted the whole
// gradient down.
//
// Every token it reads is on :root, written by App from deckVars().

const ROOM_CSS = `
.app .content--deck, .app .content--profile { max-width: none; margin: 0; padding: 0; zoom: 1; }
/* One ambient source per screen. The shell's cheatline and its fixed glow are
   a second rig, and the glow paints over the deck's own light. */
.app:has(.deck)::before, .app:has(.deck)::after { display: none; }

.deck {
  position: relative; overflow: hidden; background: var(--ground);
  padding: 0 40px 46px; color: var(--t1); isolation: isolate;
  min-height: 100vh;
  font-family: var(--font-ui);
}
@media (max-width: 640px) { .deck { padding: 0 16px 36px; } }
.deck .inner { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; }
/* the shell's own children sit in the same column and above the light */
.deck > .topbar, .deck > main { position: relative; z-index: 1; max-width: 1240px;
  margin-left: auto; margin-right: auto; width: 100%; }
.deck > *:not(.spill):not(.stars):not(.grain) { position: relative; z-index: 1; }
.deck *:focus-visible { outline: 2px solid var(--active); outline-offset: 2px; }

/* Light ADDS, it does not veil: screen, never a translucent overlay. */
.deck::before, .deck::after {
  content: ""; position: absolute; inset: -55%; pointer-events: none; z-index: 0;
  mix-blend-mode: screen; filter: blur(var(--soft)) saturate(1.28);
}
.deck::before { background: var(--key-img); opacity: var(--key-int); animation: pwdrift 26s ease-in-out infinite; }
.deck::after { background: var(--fill-img); opacity: var(--fill-int);
  filter: blur(calc(var(--soft) * 1.35)) saturate(1.2); animation: pwdrift 41s ease-in-out infinite reverse; }
.deck.aur::before { filter: url(#pw-aurWarp) blur(30px) saturate(1.24); animation: pwdrift 34s ease-in-out infinite; }
@keyframes pwdrift {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  34% { transform: translate3d(6%,-4%,0) scale(1.08); }
  67% { transform: translate3d(-4%,4%,0) scale(1); }
}
/* the same light again, over the top — the part that lands ON the panels */
.deck .spill { position: absolute; inset: -55%; z-index: 2; pointer-events: none;
  background: var(--key-img); filter: blur(calc(var(--soft) * 1.2)) saturate(1.22);
  mix-blend-mode: screen; opacity: var(--spill); animation: pwdrift 26s ease-in-out infinite; }
/* behind the panels but ABOVE the lights, so they show through the curtains */
.deck .stars { position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: var(--stars, 0);
  background-image: var(--stars-a, none), var(--stars-b, none); background-repeat: repeat;
  background-size: 430px 430px, 310px 310px; mix-blend-mode: screen;
  animation: pwtwinkle 13s ease-in-out infinite alternate; }
.deck .stars::after { content: ""; position: absolute; inset: 0; background-image: var(--stars-c, none);
  background-repeat: repeat; background-size: 520px 520px; mix-blend-mode: screen;
  animation: pwtwinkle2 8.5s ease-in-out infinite alternate-reverse; }
@keyframes pwtwinkle { from { opacity: var(--stars, 0); } to { opacity: calc(var(--stars, 0) * .5); } }
@keyframes pwtwinkle2 { from { opacity: 1; } to { opacity: .45; } }
/* dark gradients band; noise kills it and gives the light a tooth */
.deck .grain { position: absolute; inset: 0; z-index: 4; pointer-events: none; opacity: var(--grain);
  mix-blend-mode: overlay; background-size: 150px 150px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='150' height='150' filter='url(%23n)'/%3E%3C/svg%3E"); }

`;

function Deck({ aurora, children }) {
  const stars = useMemo(() => ({
    "--stars-a": dotTile(30, 20260824, 1.4, 0.8),
    "--stars-b": dotTile(20, 77003311, 1.0, 0.58),
    "--stars-c": glitterTile(7, 5150429, 460),
  }), []);

  return (
    <div className={`deck ${aurora ? "aur" : ""}`} style={stars}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs>
        <filter id="pw-aurWarp" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0055 0.017" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="96" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs></svg>

      {children}

      <div className="stars" aria-hidden="true" />
      <div className="spill" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <style>{ROOM_CSS}</style>
    </div>
  );
}


export default Deck;
