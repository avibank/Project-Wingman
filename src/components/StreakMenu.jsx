import { useState, useEffect, useRef } from "react";
import { WindsockIcon } from "./icons.jsx";
import { useUserProgress } from "../lib/userProgress.jsx";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
// Real milestones with a visible payoff. Acknowledged once and stated plainly —
// no pressure to protect the number, and nothing is said when a streak ends.
const MILESTONES = [7, 14, 30, 60, 100];
function milestoneFor(n) {
  return MILESTONES.includes(n) ? n : null;
}

function PropellerIcon({ size = 24, active }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`propeller ${active ? "is-active" : "is-idle"}`}>
      <g className="propeller-blades">
        <ellipse cx="12" cy="5.5" rx="3.4" ry="7" />
        <ellipse cx="12" cy="18.5" rx="3.4" ry="7" />
        <ellipse cx="5.5" cy="12" rx="7" ry="3.4" />
        <ellipse cx="18.5" cy="12" rx="7" ry="3.4" />
      </g>
      <circle className="propeller-hub" cx="12" cy="12" r="3" />
      <circle className="propeller-hub-shine" cx="10.7" cy="10.7" r="0.9" />
    </svg>
  );
}

function StreakMenu({ streak, overrideStreak }) {
  const progress = useUserProgress();
  const [open, setOpen] = useState(false);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastVisit, setLastVisit] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!progress.loaded) return;
    setLongestStreak(progress.get("pw-longest-streak", 0));
    setLastVisit(progress.get("pw-last-visit", null));
  }, [progress.loaded, progress.isSignedIn]);

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

  const displayStreak = overrideStreak !== null && overrideStreak !== undefined ? overrideStreak : streak;
  const longest = Math.max(longestStreak, streak);
  // §14 — never a bare dash. With no history it says what starts one.
  const lastActiveLabel =
    lastVisit === new Date().toDateString() ? "Today" : lastVisit || "Open a chapter to log a day";
  const litCount = Math.min(displayStreak, 7);

  return (
    <div className="streak-menu" ref={ref}>
      <button className="streak-trigger is-inline" onClick={() => setOpen((o) => !o)} aria-label={`${displayStreak} day${displayStreak === 1 ? "" : "s"} on the trot`} aria-expanded={open}>
        <WindsockIcon size={21} active={displayStreak > 0} />
        <span>{displayStreak}</span>
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

          {milestoneFor(displayStreak) && (
            <p className="streak-milestone">
              <span className="streak-milestone-mark" aria-hidden="true">✦</span>
              {displayStreak} days flown. That is the habit doing the work.
            </p>
          )}

          <div className="streak-stats">
            <div className="streak-stat">
              <span className="streak-stat-value">{displayStreak}</span>
              <span className="streak-stat-label">day{displayStreak === 1 ? "" : "s"} active</span>
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
        .streak-trigger { height: 40px; min-height: 40px; display: flex; align-items: center; gap: 7px;
          font-family: var(--font-mono); font-size: 12.5px; color: var(--t2); border: 1px solid var(--line);
          background: color-mix(in oklab, var(--panel), transparent 25%); padding: 0 15px 0 11px;
          border-radius: 999px; cursor: pointer; }
        .streak-trigger svg { display: block; color: var(--active); }
        /* the sock flies from the mast — pivots at its throat, never at its centre */
        .sockbody { transform-origin: 4px 9.5px; animation: sock 5.2s ease-in-out infinite; }
        @keyframes sock {
          0%, 100% { transform: rotate(-5deg) scaleX(.94); }
          38% { transform: rotate(3.5deg) scaleX(1.03); }
          67% { transform: rotate(-1.5deg) scaleX(.98); }
        }
        @media (prefers-reduced-motion: reduce) { .sockbody { animation: none; } }
        .app.smooth-air .sockbody { animation: none; }
        .streak-trigger:hover { border-color: var(--t3); color: var(--t1); }
        .streak-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 280px; background: var(--panel); border: 1px solid var(--border-hover); border-radius: var(--r-lg); padding: 14px; box-shadow: 0 12px 28px var(--shadow-c); z-index: 50; animation: streakIn 0.15s ease-out; }
        @keyframes streakIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .streak-milestone { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-soft);
          background: var(--presence-soft); border: 1px solid color-mix(in srgb, var(--presence) 26%, transparent);
          border-radius: var(--r-md); padding: 9px 12px; margin: 0 0 12px; }
        .streak-milestone-mark { color: var(--presence); }
        .streak-week { display: flex; justify-content: space-between; background: var(--panel-alt); border-radius: var(--r-md); padding: 14px 8px; }
        .streak-day { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .streak-day-letter { font-family: var(--font-mono); font-size: 12px; color: var(--muted2); }
        .propeller-blades { transform-origin: 50% 50%; stroke: var(--panel); stroke-width: 1; }
        .propeller.is-idle .propeller-blades { fill: var(--muted2); opacity: 0.45; }
        .propeller.is-idle .propeller-hub { fill: var(--muted2); opacity: 0.45; }
        .propeller.is-idle .propeller-hub-shine { opacity: 0; }
        .propeller.is-active .propeller-blades { fill: var(--text-primary); opacity: 1; }
        .propeller.is-active .propeller-hub { fill: var(--accent); opacity: 1; }
        .propeller.is-active .propeller-hub-shine { fill: rgba(255,255,255,0.7); }
        .app.reduce-motion .propeller.is-active .propeller-blades { animation: none; }
        .streak-stats { display: flex; justify-content: space-between; margin-top: 12px; gap: 6px; }
        .streak-stat { display: flex; flex-direction: column; align-items: center; flex: 1; }
        .streak-stat-value { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--text); }
        .streak-stat-label { font-family: var(--font-ui); font-size: 12px; color: var(--muted2); text-align: center; margin-top: 2px; }
        .streak-last { text-align: center; font-size: 12px; color: var(--muted); margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-soft); }
        .streak-last strong { color: var(--text); }
      `}</style>
    </div>
  );
}

export default StreakMenu;
