import { useEffect, useRef, useState } from "react";

// §5.5 — ported verbatim from wingman-poc.html.
//
// Edge lighting read the way centreline lighting is read: not where you are,
// but how much runway is left. One lamp is yours; the ones ahead come up as the
// end approaches. No runway when there's no distance to run.
//
// §11 says the retune is not designed. This is the POC's behaviour and geometry
// unchanged — do not invent a new version.

const LAMPS = 13;

function RunwayLights() {
  const ref = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const lamps = [...el.children];
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const on = max > 40;
      setLive(on);
      if (!on) return;
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      const here = Math.round(p * (LAMPS - 1));
      const left = LAMPS - 1 - here;
      lamps.forEach((lamp, i) => {
        lamp.classList.toggle("here", i === here);
        lamp.classList.toggle("near", i > here && left <= 3);
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(document.body);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);

  return (
    <>
      <div className={`runway ${live ? "on" : ""}`} ref={ref} aria-hidden="true">
        {Array.from({ length: LAMPS }, (_, i) => (
          <i key={i} className={i === 0 || i === LAMPS - 1 ? "bar" : ""} />
        ))}
      </div>
      <style>{`
        .runway { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; pointer-events: none;
          display: flex; align-items: center; justify-content: center; gap: 11px;
          padding: 12px 20px 14px; opacity: 0; transition: opacity .35s; }
        .runway.on { opacity: 1; }
        .runway i { display: block; width: 5px; height: 5px; border-radius: 2px; background: var(--line);
          transition: background .2s, box-shadow .2s, transform .2s, width .2s; }
        .runway i.bar { width: 15px; }
        .runway i.near { background: var(--t3); }
        .runway i.here { background: var(--on); transform: scaleY(2.2);
          box-shadow: 0 0 var(--emit) color-mix(in oklab, var(--on), transparent 40%); }
        @media (max-width: 640px) { .runway { gap: 8px; } .runway i.bar { width: 12px; } }
        @media (prefers-reduced-motion: reduce) { .runway, .runway i { transition: none; } }
        .app.smooth-air .runway, .app.smooth-air .runway i { transition: none; }
      `}</style>
    </>
  );
}

export default RunwayLights;
