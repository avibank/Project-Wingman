import { useState, useEffect } from "react";

// §7.11 — not a settings row. A gallery of tail fins, the way an airline fleet
// page shows its aircraft, over a live preview that repaints as you scroll.

export const LIVERIES = [
  { id: "aurora", name: "Aurora", mood: "Rose over jade", hw: 350 },
  { id: "sunset-approach", name: "Sunset Approach", mood: "Coral over teal", hw: 20 },
  { id: "carrier-deck", name: "Carrier Deck", mood: "High-vis orange over steel", hw: 40 },
  { id: "dawn-patrol", name: "Dawn Patrol", mood: "Amber over sky. First light.", hw: 55 },
  { id: "contrail", name: "Contrail", mood: "Pale gold over high blue", hw: 70 },
  { id: "night-ops", name: "Night Ops", mood: "Instrument gold over deep indigo", hw: 88 },
];

// §2.11 — two at signup, then one per completed module in a fixed global order.
export const UNLOCK_ORDER = ["contrail", "carrier-deck", "sunset-approach", "aurora"];
export function unlockedLiveries(modulesCompleted = 0) {
  return new Set(["dawn-patrol", "night-ops", ...UNLOCK_ORDER.slice(0, modulesCompleted)]);
}

// A tail fin, painted in that livery's own channels. Rendered from the livery's
// tokens rather than hardcoded colour, so it stays correct if hues ever move.
function TailFin({ livery, locked, selected, onPick }) {
  return (
    <button
      className={`fin ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
      data-livery={livery.id}
      data-variant="night"
      onClick={() => !locked && onPick(livery.id)}
      aria-label={locked ? `${livery.name}, locked` : livery.name}
      aria-pressed={selected}
      disabled={locked}
    >
      <svg viewBox="0 0 88 104" className="fin-art" aria-hidden="true">
        {/* vertical stabiliser: leading edge raked, trailing edge vertical */}
        <path d="M18 100 L58 6 L80 6 L80 100 Z" className="fin-body" />
        {/* the cheatline, carried onto the tail */}
        <path d="M18 100 L58 6 L80 6 L80 100 Z" className="fin-cheat" />
        <rect x="18" y="74" width="62" height="7" className="fin-stripe" />
      </svg>
      <span className="fin-name">{livery.name}</span>
      <span className="fin-mood">{locked ? "Complete any module" : livery.mood}</span>
    </button>
  );
}

function LiveryPicker({ current, modulesCompleted = 0, onSelect, onClose }) {
  const [washing, setWashing] = useState(false);
  const unlocked = unlockedLiveries(modulesCompleted);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // §7.11 — the wash: a full-viewport overlay in the incoming surface-0,
  // revealed by a clip-path inset, tokens swapped at the halfway point.
  const pick = (id) => {
    if (id === current) return;
    if (reduced) { onSelect(id); return; }
    setWashing(id);
    setTimeout(() => onSelect(id), 300);
    setTimeout(() => setWashing(false), 620);
  };

  return (
    <div className="picker">
      <header className="picker-head">
        <h2 className="picker-title">Your livery</h2>
        <p className="picker-sub">What you fly. Other pilots see your tail.</p>
        {onClose && <button className="picker-close" onClick={onClose}>Done</button>}
      </header>

      <div className="fleet">
        {LIVERIES.map((l) => (
          <TailFin key={l.id} livery={l} locked={!unlocked.has(l.id)} selected={l.id === current} onPick={pick} />
        ))}
      </div>

      {washing && <div className="wash" data-livery={washing} data-variant="night" aria-hidden="true" />}

      <style>{`
        .picker-head { margin-bottom: 24px; position: relative; }
        .picker-title { font-family: var(--font-ui); font-size: 28px; font-weight: 600; color: var(--text-1); margin: 0 0 4px; }
        .picker-sub { font-size: 16px; color: var(--text-2); margin: 0; }
        .picker-close { position: absolute; right: 0; top: 0; background: none; border: none;
          color: var(--cold); font-size: 16px; cursor: pointer; min-height: 44px; padding: 0 8px; }
        .fleet { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
        .fin { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;
          background: var(--surface-1); border: none; border-radius: 16px; padding: 20px 12px 16px;
          min-height: 44px; position: relative; overflow: hidden;
          transition: transform 240ms cubic-bezier(0.2,0.8,0.2,1); }
        .fin::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 40%;
          background: linear-gradient(to top, var(--warm), transparent); opacity: 0.06; pointer-events: none; }
        .fin:hover:not(.is-locked) { transform: translateY(-3px); }
        .fin.is-selected { outline: 2px solid var(--cold); outline-offset: 2px; }
        .fin.is-locked { cursor: default; }
        .fin.is-locked .fin-body { fill: var(--surface-2); }
        .fin.is-locked .fin-cheat, .fin.is-locked .fin-stripe { display: none; }
        .fin-art { width: 72px; height: 86px; }
        .fin-body { fill: var(--cold); }
        .fin-cheat { fill: var(--warm); opacity: 0.22; }
        .fin-stripe { fill: var(--warm); }
        .fin-name { font-size: 16px; color: var(--text-1); }
        .fin-mood { font-size: 12px; color: var(--text-3); text-align: center; line-height: 1.35; }
        .wash { position: fixed; inset: 0; z-index: 999; pointer-events: none;
          background: var(--surface-0);
          animation: liveryWash 600ms cubic-bezier(0.2,0.8,0.2,1) forwards; }
        @keyframes liveryWash {
          from { clip-path: inset(100% 0 0 0); }
          60%  { clip-path: inset(0 0 0 0); }
          to   { clip-path: inset(0 0 0 0); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fin { transition: none; }
          .wash { animation: none; display: none; }
        }
      `}</style>
    </div>
  );
}

export default LiveryPicker;
