import { useState, useEffect, useRef } from "react";

// §7.2 — the horizon. Not a stack of two panels.
//
// Above the cheatline is your flight, and it is small on purpose: greeting,
// status line, one instrument, one card. Resist a fifth. Below is Traffic.
// As you descend into the social layer your own flight compresses into a single
// line — the metaphor and the interaction are the same gesture.

// §5 — the altimeter tape. Kept because it is the most distinctive thing in the
// product. Current value in the cold channel, neighbours at 30%.
function AltimeterTape({ value = 0, label = "streak" }) {
  const rows = [value + 2, value + 1, value, value - 1, value - 2];
  return (
    <div className="tape" role="img" aria-label={`${value} day ${label}`}>
      <div className="tape-window">
        {rows.map((n, i) => (
          <div key={i} className={`tape-row ${i === 2 ? "is-current" : ""}`}>
            {n < 0 ? "" : n}
          </div>
        ))}
        <span className="tape-bracket" aria-hidden="true" />
      </div>
      {/* §13 — every instrument carries a plain numeric readout */}
      <span className="tape-label">{value} day {label}</span>
    </div>
  );
}

function FlightDeck({
  greeting,
  status,
  streak = 0,
  nextChapter,
  onResume,
  children,          // Traffic
}) {
  const [condensed, setCondensed] = useState(false);
  const sentinel = useRef(null);

  // §4 — scroll-linked where supported. Where it is not, a passive
  // IntersectionObserver toggling one class. Never a per-frame scroll handler.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`deck ${condensed ? "is-condensed" : ""}`}>
      <div className="deck-flight">
        <p className="deck-greeting">{greeting}</p>
        <p className="deck-status">{status}</p>

        <div className="deck-row">
          <AltimeterTape value={streak} />

          {nextChapter && (
            <button className="deck-card" onClick={onResume}>
              <span className="deck-card-code">{nextChapter.code}</span>
              <span className="deck-card-title">{nextChapter.title}</span>
              <span className="deck-card-go">Resume</span>
            </button>
          )}
        </div>
      </div>

      {/* the collapsed form: next chapter and streak, nothing else */}
      <div className="deck-strip" aria-hidden={!condensed}>
        <span className="deck-strip-code">{nextChapter?.code}</span>
        <span className="deck-strip-title">{nextChapter?.title}</span>
        <span className="deck-strip-streak">{streak}d</span>
        <button className="deck-strip-go" onClick={onResume}>Resume</button>
      </div>

      <div ref={sentinel} className="deck-seam" aria-hidden="true" />

      <div className="deck-traffic">{children}</div>

      <style>{`
        .deck { position: relative; }
        .deck-flight { padding: 8px 0 28px; transition: opacity 240ms cubic-bezier(0.2,0.8,0.2,1), transform 240ms cubic-bezier(0.2,0.8,0.2,1); }
        .deck.is-condensed .deck-flight { opacity: 0; transform: translateY(-12px); pointer-events: none; }

        .deck-greeting { font-family: var(--font-ui); font-size: 28px; font-weight: 500; color: var(--text-1); margin: 0 0 6px; }
        .deck-status { font-family: var(--font-ui); font-size: 14px; color: var(--text-2); margin: 0 0 24px; }

        .deck-row { display: flex; align-items: stretch; gap: 16px; flex-wrap: wrap; }

        /* the altimeter tape */
        .tape { display: flex; flex-direction: column; align-items: center; gap: 8px;
          flex-shrink: 0; min-width: 96px; }
        .tape-window { position: relative; width: 96px; height: 96px; overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent);
          mask-image: linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent);
          display: flex; flex-direction: column; justify-content: center; }
        .tape-row { height: 19px; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-mono); font-size: 14px; color: var(--text-3); opacity: 0.3;
          font-variant-numeric: tabular-nums; transition: all 240ms cubic-bezier(0.2,0.8,0.2,1); }
        .tape-row.is-current { font-size: 20px; color: var(--cold); opacity: 1; }
        .tape-bracket { position: absolute; left: 6px; right: 6px; top: 50%; height: 26px; transform: translateY(-50%);
          border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); }
        .tape-label { font-family: var(--font-mono); font-size: 12px; color: var(--text-2);
          white-space: nowrap; font-variant-numeric: tabular-nums; }

        /* the one primary card — large tap target */
        .deck-card { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 4px;
          background: var(--surface-1); border: none; border-radius: 16px; padding: 20px;
          text-align: left; cursor: pointer; min-height: 96px; position: relative; overflow: hidden;
          transition: transform 240ms cubic-bezier(0.2,0.8,0.2,1); }
        .deck-card:hover { transform: translateY(-2px); }
        .deck-card-code { font-family: var(--font-mono); font-size: 14px; color: var(--cold); }
        .deck-card-title { font-family: var(--font-ui); font-size: 17px; color: var(--text-1); }
        .deck-card-go { font-size: 14px; color: var(--text-2); margin-top: auto; }

        /* §4 — the one element in the app permitted backdrop blur */
        .deck-strip { position: fixed; top: 0; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; gap: 12px;
          padding: 12px max(16px, env(safe-area-inset-left)); border-radius: 0 0 16px 16px;
          background: color-mix(in srgb, var(--surface-1) 82%, transparent);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          opacity: 0; transform: translateY(-8px); pointer-events: none;
          transition: opacity 240ms cubic-bezier(0.2,0.8,0.2,1), transform 240ms cubic-bezier(0.2,0.8,0.2,1); }
        .deck.is-condensed .deck-strip { opacity: 1; transform: none; pointer-events: auto; }
        .deck-strip-code { font-family: var(--font-mono); font-size: 14px; color: var(--cold); flex-shrink: 0; }
        .deck-strip-title { font-size: 16px; color: var(--text-1); flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .deck-strip-streak { font-family: var(--font-mono); font-size: 14px; color: var(--text-2); font-variant-numeric: tabular-nums; }
        .deck-strip-go { background: none; border: none; color: var(--cold); font-size: 16px;
          cursor: pointer; min-height: 44px; padding: 0 4px; flex-shrink: 0; }

        /* §2.6 — on a screen that splits solo from social, the cheatline moves
           to the seam and becomes the transition. Never a border. */
        .deck-seam { height: 132px; margin: 0 -24px -44px; opacity: 0.5; pointer-events: none;
          background: radial-gradient(120% 100% at 50% 100%,
            color-mix(in srgb, var(--warm) 12%, transparent) 0%, transparent 72%); }

        .deck-traffic { padding-top: 8px; }

        @media (prefers-reduced-motion: reduce) {
          .deck-flight, .deck-strip, .deck-card, .tape-row { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default FlightDeck;
