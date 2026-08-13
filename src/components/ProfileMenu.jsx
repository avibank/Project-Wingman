import { useState, useEffect, useRef } from "react";
import { User, Sun, Moon, RotateCcw } from "lucide-react";
import { WindsockIcon } from "./icons.jsx";

function ProfileMenu({ streak, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, onResetProgress }) {
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

  return (
    <div className="profile-menu" ref={ref}>
      <button className="profile-avatar" onClick={() => setOpen((o) => !o)} aria-label="Profile menu" aria-expanded={open}>
        <User size={16} />
      </button>
      {open && (
        <div className="profile-dropdown">
          <div className="profile-section">
            <div className="profile-section-label">Streak</div>
            <div className="profile-streak-row">
              <WindsockIcon size={20} active={streak > 0} />
              <span>{streak} day{streak === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-label">Personalize</div>
            <button className="profile-row" onClick={onToggleTheme}>
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              <span>{theme === "light" ? "Switch to dark mode" : "Switch to light mode"}</span>
            </button>
          </div>

          <div className="profile-section">
            <div className="profile-section-label">Accessibility</div>
            <button className="profile-row" onClick={onToggleReduceMotion}>
              <span className={`profile-switch ${reduceMotion ? "is-on" : ""}`}><span className="profile-switch-knob" /></span>
              <span>Reduce motion</span>
            </button>
            <p className="profile-hint">Quizzes also support keyboard shortcuts: 1-4 or A-D to answer, Enter to continue.</p>
          </div>

          <div className="profile-section">
            <div className="profile-section-label">Account Settings</div>
            <button className="profile-row profile-row--danger" onClick={onResetProgress}>
              <RotateCcw size={15} />
              <span>Reset progress</span>
            </button>
          </div>

          <p className="profile-footnote">Progress is saved locally on this device only.</p>
        </div>
      )}
      <style>{`
        .profile-menu { position: relative; }
        .profile-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--avatar-bg); border: 1px solid var(--border); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .profile-avatar:hover { border-color: var(--accent); }
        .profile-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: var(--panel); border: 1px solid var(--border-hover); border-radius: 14px; padding: 14px; box-shadow: 0 12px 28px rgba(0,0,0,0.25); z-index: 50; animation: profileIn 0.15s ease-out; }
        @keyframes profileIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .profile-section { padding: 8px 0; border-bottom: 1px solid var(--border-soft); }
        .profile-section:last-of-type { border-bottom: none; }
        .profile-section-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin-bottom: 8px; }
        .profile-streak-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); }
        .profile-row { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; color: var(--text); font-size: 13px; padding: 7px 4px; border-radius: 8px; cursor: pointer; text-align: left; }
        .profile-row:hover { background: var(--panel-alt); }
        .profile-row--danger:hover { color: var(--bad); }
        .profile-hint { font-size: 11px; color: var(--muted2); line-height: 1.4; margin: 6px 4px 0; }
        .profile-footnote { font-size: 10.5px; color: var(--muted2); text-align: center; margin: 10px 0 0; }
        .profile-switch { width: 30px; height: 17px; border-radius: 10px; background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .profile-switch.is-on { background: var(--accent); }
        .profile-switch-knob { position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .profile-switch.is-on .profile-switch-knob { transform: translateX(13px); }
        .windsock.is-active { animation: sockWave 1.8s ease-in-out infinite; transform-origin: left center; }
        .windsock.is-idle { transform: rotate(6deg); }
        @keyframes sockWave { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        .app.reduce-motion .windsock.is-active { animation: none; }
      `}</style>
    </div>
  );
}

export default ProfileMenu;
