import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Reading-progress bar, styled as a runway centreline light bar.
//
// Twelve lights, coloured by position rather than by state — the
// runway-remaining convention, where the last thousand feet are red and the
// two before it amber. A light shows its colour only once reached; unlit it is
// the neutral border grey. The lights never blink; only the trail moves.
//
// This supersedes the thirteen-lamp version ported from wingman-poc.html.
//
// NOTE: --panel, --border, --border-soft and --accent are written exactly as
// specified, so on this codebase they resolve to the live livery rather than to
// the hex values the spec documents. That is deliberate: the bar then repaints
// with the rest of the room instead of pinning one blue against seven liveries.
// The three lit colours are hardcoded, as specified.

const LIGHTS = 12;
const colourAt = (i) => (i < 8 ? "is-white" : i < 10 ? "is-amber" : "is-red");

function RunwayLights() {
  const [progress, setProgress] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const max = useRef(0);
  const remeasure = useRef(null);

  useEffect(() => {
    const el = document.documentElement;
    // scrollHeight forces layout, so it is measured on resize rather than on
    // every scroll event. scrollTop is free.
    const read = () => setProgress(
      max.current > 0 ? Math.min(1, Math.max(0, el.scrollTop / max.current)) : 0);
    // Against the real scrollable distance, not a fixed pixel span, so p
    // reaches 1 at the bottom of a short page and a long one alike.
    const measure = () => {
      max.current = el.scrollHeight - el.clientHeight;
      setScrollable(max.current > 1);
      read();
    };

    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", measure);
    // documentElement rather than body: body's box does not track scrollHeight
    // when the deck is the thing growing.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(document.documentElement);
    ro?.observe(document.body);
    remeasure.current = measure;
    measure();
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      remeasure.current = null;
    };
  }, []);

  // The strip is content now, so rendering it makes the page taller — and the
  // distance it measures itself against is the distance it just changed. One
  // re-measure after it appears, or it reads 100% at half way down.
  useLayoutEffect(() => { remeasure.current?.(); }, [scrollable]);

  const lit = Math.min(LIGHTS, Math.floor(progress * LIGHTS));

  // A page that does not scroll has no distance to run, so there is no strip —
  // rather than a strip showing a completed runway you never flew.
  if (!scrollable) return null;

  return (
    <div className="flight-progress" aria-hidden="true">
      <div className="runway-lights">
        <div className="runway-trail" style={{ width: `${progress * 100}%` }} />
        {Array.from({ length: LIGHTS }, (_, i) => (
          <span key={i} className={`runway-dot ${i < lit ? "is-lit" : ""} ${colourAt(i)}`} />
        ))}
      </div>

      <style>{`
        .flight-progress {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 8px 16px;
          background: var(--panel);
          border-top: 1px solid var(--border-soft);
        }

        .runway-lights { position: relative; display: flex; gap: 4px; }

        /* .flight-progress qualifies every rule here: the shell declares a
           blanket transition on .app star, which ties on specificity and wins
           on source order, and it was overriding the trail's own. */
        .flight-progress .runway-trail {
          position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--accent));
          filter: blur(3px);
          opacity: 0.55;
          transition: width 0.15s ease;
          pointer-events: none;
        }

        .runway-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--border); }

        .runway-dot.is-lit.is-white { background: #F4F6FB; box-shadow: 0 0 5px rgba(244,246,251,0.8); }
        .runway-dot.is-lit.is-amber { background: #F2A93B; box-shadow: 0 0 5px rgba(242,169,59,0.8); }
        .runway-dot.is-lit.is-red   { background: #E5484D; box-shadow: 0 0 5px rgba(229,72,77,0.8); }

        /* The trail is the only thing that moves, and it is decorative. */
        @media (prefers-reduced-motion: reduce) { .flight-progress .runway-trail { transition: none; } }
        .app.smooth-air .flight-progress .runway-trail { transition: none; }
      `}</style>
    </div>
  );
}

export default RunwayLights;
