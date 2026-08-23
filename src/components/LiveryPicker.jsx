import { LIVERIES, unlockedLiveries, resolveLivery, SWATCH_STEPS } from "../lib/liveries.js";

// §3.4 — each swatch is a thin strip of that livery's full ramp, dark to light.
// A single dot cannot honestly show the difference between two monochromes:
// what separates them is the tint of the whole ramp and the presence
// temperature at the end of it, and both need the strip to be visible at all.

function LiveryPicker({ current, modulesCompleted = 0, onSelect }) {
  const unlocked = unlockedLiveries(modulesCompleted);
  const active = resolveLivery(current);

  return (
    <ul className="lp">
      {LIVERIES.map((l) => {
        const locked = !unlocked.has(l.id);
        const isCurrent = l.id === active;
        return (
          <li key={l.id}>
            <button
              className={`lp-row ${isCurrent ? "is-current" : ""}`}
              disabled={locked}
              aria-pressed={isCurrent}
              onClick={() => onSelect?.(l.id)}
            >
              {/* the ramp, plus the presence temperature it warms to */}
              <span className="lp-strip" data-livery={l.id} aria-hidden="true">
                {SWATCH_STEPS.map((step) => (
                  <span key={step} style={{ background: `var(--mono-${step})` }} />
                ))}
                <span className="lp-presence" style={{ background: `var(--tail-${l.id})` }} />
              </span>
              <span className="lp-text">
                <span className="lp-name">{l.name}</span>
                <span className="lp-mood">{locked ? "Complete a module to unlock" : l.mood}</span>
              </span>
              {isCurrent && <span className="lp-on">On</span>}
            </button>
          </li>
        );
      })}

      <style>{`
        .lp { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .lp-row { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 64px;
          padding: 10px 14px; background: var(--bg-panel); border: none; cursor: pointer;
          text-align: left; color: var(--text-primary); }
        .lp-row:hover:not(:disabled) { background: var(--bg-raised); }
        .lp-row.is-current { background: var(--bg-raised); box-shadow: inset 3px 0 0 var(--accent-interactive); }
        .lp-row:disabled { cursor: default; }
        .lp-row:disabled .lp-strip { opacity: 0.4; }

        .lp-strip { display: flex; width: 96px; height: 24px; border-radius: 6px;
          overflow: hidden; flex-shrink: 0; box-shadow: inset 0 0 0 1px var(--hairline); }
        .lp-strip > span { flex: 1; }
        /* the delta the whole system turns on: the room, then the people in it */
        .lp-presence { flex: 0 0 18px !important; }

        .lp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .lp-name { font-size: 16px; }
        .lp-mood { font-size: 14px; color: var(--text-secondary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-on { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); }
      `}</style>
    </ul>
  );
}

export default LiveryPicker;
