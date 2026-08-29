import { useEffect, useRef, useState } from "react";
import { scrollProgress, litCount } from "../lib/shell.js";

// The scroll indicator, as a runway centreline light bar — and a structural row
// of the shell, so it is visible at every scroll position on every route.
//
// Cumulative fill, the way approach lighting works: the run fills as you scroll
// down and empties as you come back up, rather than a single lamp travelling.
// A light stays lit while you are below it. White through amber to red, which is
// real centreline lighting read backwards — amber over the last stretch, red at
// the end — so arriving at the bottom of a page reads as touchdown.
//
// Progress comes from the scroller it is given, not the window: the window no
// longer scrolls.
//
// Always visible. §9 of the brief says to hide it when there is nothing to
// indicate and §12 says it is never hidden, not on short pages and not on
// pages that do not scroll — §12 is the emphatic one and repeats the previous
// round's decision, so that is the one followed. A page with no scroll shows
// the run unlit: an empty run is honest, a full one would claim you had read
// something you never scrolled through.

const LIGHTS = 12;
const colourAt = (i) => (i < 8 ? "is-white" : i < 10 ? "is-amber" : "is-red");

function RunwayLights({ route }) {
  const rootRef = useRef(null);
  const [lit, setLit] = useState(0);

  // Window scroll, not a container's. This is the only line that changes when
  // the shell comes out — mountRunway coalesces into one rAF and writes only
  // when the lit count actually changes, which is about twelve times over a
  // whole page. Updating on every scroll event is the same mistake that made
  // the video swim: a handler runs after paint, so the indicator is a frame
  // behind whatever it is indicating.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    let last = -1;
    let ticking = false;
    const paint = () => {
      const p = scrollProgress();
      if (p === null) { el.dataset.idle = "1"; if (last !== 0) { last = 0; setLit(0); } return; }
      el.dataset.idle = "0";
      el.style.setProperty("--progress", String(p));
      const n = litCount(p, LIGHTS);
      if (n === last) return;
      last = n;
      setLit(n);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; paint(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", paint);
    paint();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", paint);
    };
  }, [route]);

  return (
    <div className="flight-progress" aria-hidden="true" ref={rootRef} style={{ "--progress": 0 }}>
      <div className="runway-lights">
        <div className="runway-trail" />
        {Array.from({ length: LIGHTS }, (_, i) => (
          <span key={i}
                className={`runway-dot ${colourAt(i)} ${i < lit ? "is-lit" : "is-unlit"}`} />
        ))}
      </div>

      <style>{`
        /* A structural row of the shell — never sticky, never fixed. The row
           keeps its height whether or not there is anything to indicate, so
           nothing shifts when a page turns out not to scroll. */
        .flight-progress {
          /* Fixed to the foot of the viewport, and a SIBLING OF THE ROUTER so
             no ancestor with a transform, filter or contain can capture it —
             the aurora rig has both, and anything fixed inside it silently
             stops being fixed. That is what made a shell look necessary.

             pointer-events: none, because a full-width strip across the foot
             of the viewport is exactly the kind of thing that quietly eats
             taps on the last row of every list. */
          position: fixed; inset: auto 0 0 0; z-index: 5;
          pointer-events: none;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding-inline: 16px;
          padding-block: 14px max(6px, env(safe-area-inset-bottom));
          background: var(--panel);
          border-top: 1px solid var(--border-soft);
        }
        /* Nothing to scroll is not a full runway — it is no runway. */
        .flight-progress[data-idle="1"] { display: none; }

        .runway-lights { position: relative; display: flex; gap: 4px; }

        .flight-progress .runway-trail {
          position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          height: 3px;
          width: calc(var(--progress, 0) * 100%);
          background: linear-gradient(90deg, transparent, var(--accent));
          filter: blur(3px);
          opacity: 0.55;
          transition: width 0.15s ease;
          pointer-events: none;
        }

        /* Quick and flat. No stagger, no bounce: twelve lamps easing
           individually would read as decoration rather than as position. */
        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border);
          transition: background-color .12s linear, box-shadow .12s linear; }
        .runway-dot.is-unlit { background: var(--border); box-shadow: none; }

        .runway-dot.is-lit.is-white { background: #F4F6FB; box-shadow: 0 0 5px rgba(244,246,251,0.8); }
        .runway-dot.is-lit.is-amber { background: #F2A93B; box-shadow: 0 0 5px rgba(242,169,59,0.8); }
        .runway-dot.is-lit.is-red   { background: #E5484D; box-shadow: 0 0 5px rgba(229,72,77,0.8); }

        /* The trail and the fill snap rather than ease. Not faster — off.
           Each switch is independent: the media query is the device asking and
           Smooth Air is the person asking, and either alone turns it off. */
        @media (prefers-reduced-motion: reduce) {
          .flight-progress .runway-trail,
          .flight-progress .runway-dot { transition: none; }
        }
        .app.smooth-air .flight-progress .runway-trail,
        .app.smooth-air .flight-progress .runway-dot { transition: none; }
      `}</style>
    </div>
  );
}

export default RunwayLights;
