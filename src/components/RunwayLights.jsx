import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

function RunwayLights({ scroller, route }) {
  // Only the lit count is state. It changes twelve times over a whole page;
  // scroll position changes on every frame, and putting that in state
  // re-rendered twelve lamps sixty times a second, which is what made the run
  // flicker on a phone.
  const [lit, setLit] = useState(0);
  const litRef = useRef(0);
  const rootRef = useRef(null);
  const max = useRef(0);
  const remeasure = useRef(null);

  useEffect(() => {
    const el = scroller?.current;
    if (!el) return undefined;

    const read = () => {
      const m = max.current;
      const p = m > 0 ? Math.min(1, Math.max(0, el.scrollTop / m)) : 0;
      // The trail is a style, not state. Written straight to the node so a
      // scroll costs one property set instead of a React render.
      rootRef.current?.style.setProperty("--progress", p);
      const next = m > 0 ? Math.round(p * LIGHTS) : 0;
      if (next !== litRef.current) { litRef.current = next; setLit(next); }
    };
    // scrollHeight forces layout, so it is measured on resize rather than on
    // every scroll event. scrollTop is free.
    const measure = () => {
      max.current = el.scrollHeight - el.clientHeight;
      read();
    };

    // No rAF throttle. scrollTop is a free read, and the guarded version of
    // this latches: if the frame it schedules never runs — a backgrounded tab,
    // a dropped frame — the guard stays set and the indicator dies for good.
    // The expensive read is scrollHeight, and that is on resize only.
    el.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    remeasure.current = measure;
    measure();

    return () => {
      el.removeEventListener("scroll", read);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      remeasure.current = null;
    };
  }, [scroller]);

  // Route changes swap the content inside the scroller, which changes how far
  // there is to run. Keyed to the route rather than left to run after every
  // render: measure reads scrollHeight, which forces layout, and with no
  // dependencies that happened on every scroll event.
  useLayoutEffect(() => { remeasure.current?.(); }, [route]);

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
          position: static; z-index: 5;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          padding-inline: 16px;
          padding-block: 14px max(6px, env(safe-area-inset-bottom));
          background: var(--panel);
          border-top: 1px solid var(--border-soft);
        }

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
