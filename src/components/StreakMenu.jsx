import { useState, useEffect, useRef } from "react";
import { WindsockIcon } from "./icons.jsx";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function PropellerIcon({ size = 18, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`propeller ${active ? "is-active" : "is-idle"}`}>
      <g className="propeller-blades">
        <ellipse cx="12" cy="6" rx="3" ry="7" />
        <ellipse cx="12" cy="18" rx="3" ry="7" />
        <ellipse cx="6" cy="12" rx="7" ry="3" />
        <ellipse cx="18" cy="12" rx="7" ry="3" />
      </g>
      <circle className="propeller-hub" cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function StreakMenu({ streak, forceInactive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayStreak = forceInactive ? 0 : streak;
  const longest = Math.max(parseInt(localStorage.getItem("pw-longest-streak") || "0", 10), streak);
  const lastVisit = localStorage.getItem("pw-last-visit");
  const lastActiveLabel = lastVisit === new Date().toDateString() ? "Today" : lastVisit || "—";
  const litCount = Math.min(displayStreak, 7);

  return (
    <div className="streak-menu" ref={ref}>
      <button className="streak-trigger" onClick={() => setOpen((o) => !o)} aria-label="Streak details" aria-expanded={open}>
        <WindsockIcon size={18} active={displayStreak > 0} />
        <span>{streak}</span>
      </button>
      {open && (
        <div className="streak-dropdown">
          <div className="streak-week">
            {DAY_LETTERS.map((letter, i) => (
              <div key={i} className="streak-day">
                <PropellerIcon active={i < litCount} />
                <span className="streak-day-letter">{letter}</span>
              </div>
            ))}
          </div>

          <div className="streak-stats">
            <div className="streak-stat">
              <span className="streak-stat-value">{streak}</span>
              <span className="streak-stat-label">day{streak === 1 ? "" : "s"} active</span>
            </div>
            <div className="streak-stat">
              <span className="streak-stat-value">{longest}</span>
              <span className="streak-stat-label">longest streak</span>
            </div>
          </div>
          <div className="streak-last">Last active: <strong>{lastActiveLabel}</strong></div>
        </div>
      )}
      <style>{`
        .streak-menu { position: relative; }
        .streak-trigger { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text); background: var(--panel); border: 1px solid var(--border); padding: 5px 9px; border-radius: 10px; cursor: pointer; }
        .streak-trigger:hover { border-color: var(--accent); }
        .streak-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: var(--panel); border: 1px solid var(--border-hover); border-radius: 14px; padding: 14px; box-shadow: 0 12px 28px rgba(0,0,0,0.25); z-index: 50; animation: streakIn 0.15s ease-out; }
        @keyframes streakIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .streak-week { display: flex; justify-content: space-between; background: var(--panel-alt); border-radius: 10px; padding: 12px 8px; }
        .streak-day { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .streak-day-letter { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--muted2); }
        .propeller-blades { transform-origin: 50% 50%; color: var(--muted2); opacity: 0.45; }
        .propeller-hub { fill: var(--muted2); opacity: 0.45; }
        .propeller.is-active .propeller-blades { color: var(--accent); opacity: 1; animation: propSpin 1s linear infinite; filter: drop-shadow(0 0 3px var(--accent)); }
        .propeller.is-active .propeller-hub { fill: var(--accent); opacity: 1; }
        @keyframes propSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .app.reduce-motion .propeller.is-active .propeller-blades { animation: none; }
        .streak-stats { display: flex; justify-content: space-between; margin-top: 12px; gap: 6px; }
        .streak-stat { display: flex; flex-direction: column; align-items: center; flex: 1; }
        .streak-stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: var(--text); }
        .streak-stat-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.03em; color: var(--muted2); text-align: center; margin-top: 2px; }
        .streak-last { text-align: center; font-size: 11.5px; color: var(--muted); margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-soft); }
        .streak-last strong { color: var(--text); }
        .windsock.is-active { animation: sockWave 1.8s ease-in-out infinite; transform-origin: left center; }
        .windsock.is-idle { transform: rotate(6deg); }
        @keyframes sockWave { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        .app.reduce-motion .windsock.is-active { animation: none; }
      `}</style>
    </div>
  );
}

export default StreakMenu;
