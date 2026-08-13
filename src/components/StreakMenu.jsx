import { useState, useEffect, useRef } from "react";
import { WindsockIcon } from "./icons.jsx";

function StreakMenu({ streak }) {
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

  const longest = Math.max(parseInt(localStorage.getItem("pw-longest-streak") || "0", 10), streak);
  const daysToWeek = Math.max(0, 7 - streak);
  const lastVisit = localStorage.getItem("pw-last-visit");
  const lastActiveLabel = lastVisit === new Date().toDateString() ? "Today" : lastVisit || "—";

  return (
    <div className="streak-menu" ref={ref}>
      <button className="streak-trigger" onClick={() => setOpen((o) => !o)} aria-label="Streak details" aria-expanded={open}>
        <WindsockIcon size={18} active={streak > 0} />
        <span>{streak}</span>
      </button>
      {open && (
        <div className="streak-dropdown">
          <div className="streak-scene">
            <svg viewBox="0 0 220 110" className="streak-scene-bg">
              <defs>
                <linearGradient id="streakSky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4FA6E8" />
                  <stop offset="100%" stopColor="#BFE3FF" />
                </linearGradient>
                <linearGradient id="streakGrass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7ED957" />
                  <stop offset="100%" stopColor="#4CAF50" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="220" height="110" fill="url(#streakSky)" />
              <g className="streak-clouds" fill="#FFFFFF">
                <ellipse cx="40" cy="24" rx="18" ry="8" opacity="0.95" />
                <ellipse cx="55" cy="20" rx="14" ry="7" opacity="0.95" />
                <ellipse cx="150" cy="16" rx="16" ry="7" opacity="0.9" />
                <ellipse cx="165" cy="20" rx="12" ry="6" opacity="0.9" />
              </g>
              <path d="M0,66 Q55,58 110,66 T220,64 L220,110 L0,110 Z" fill="url(#streakGrass)" />
              <line x1="60" y1="80" x2="60" y2="32" stroke="#8A5A44" strokeWidth="3" strokeLinecap="round" />
              <circle cx="60" cy="32" r="2.5" fill="#8A5A44" />
            </svg>
            <div className="streak-scene-sock">
              <WindsockIcon size={44} active={streak > 0} />
            </div>
          </div>

          <div className="streak-stats">
            <div className="streak-stat">
              <span className="streak-stat-value">{streak}</span>
              <span className="streak-stat-label">day{streak === 1 ? "" : "s"} active</span>
            </div>
            <div className="streak-stat">
              <span className="streak-stat-value">{daysToWeek === 0 ? "🎉" : daysToWeek}</span>
              <span className="streak-stat-label">{daysToWeek === 0 ? "past a week" : "to a week"}</span>
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
        .streak-scene { position: relative; width: 100%; height: 110px; border-radius: 10px; overflow: hidden; background: var(--panel-alt); }
        .streak-scene-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .streak-scene-sock { position: absolute; left: 40px; top: 4px; color: var(--accent); }
        .streak-clouds { animation: cloudDrift 14s ease-in-out infinite alternate; }
        @keyframes cloudDrift { from { transform: translateX(0); } to { transform: translateX(10px); } }
        .app.reduce-motion .streak-clouds { animation: none; }
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
