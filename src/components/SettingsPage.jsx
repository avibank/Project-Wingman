import { ChevronLeft, Sun, Moon, RotateCcw } from "lucide-react";

function SettingsPage({ page, onBack, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, onResetProgress }) {
  const TITLES = {
    personalize: "Personalize",
    accessibility: "Accessibility",
    account: "Account Settings",
  };

  return (
    <div className="settings-page">
      <button className="settings-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="settings-title">{TITLES[page]}</h1>

      {page === "personalize" && (
        <div className="settings-block">
          <div className="settings-row" onClick={onToggleTheme}>
            <div className="settings-row-icon">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</div>
            <div>
              <div className="settings-row-title">Theme</div>
              <div className="settings-row-sub">Currently {theme === "light" ? "light" : "dark"} mode — tap to switch</div>
            </div>
          </div>
        </div>
      )}

      {page === "accessibility" && (
        <div className="settings-block">
          <div className="settings-row" onClick={onToggleReduceMotion}>
            <span className={`settings-switch ${reduceMotion ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
            <div>
              <div className="settings-row-title">Reduce motion</div>
              <div className="settings-row-sub">Turns off animated transitions across the app</div>
            </div>
          </div>
          <p className="settings-note">Quizzes support keyboard shortcuts: press 1-4 or A-D to answer, and Enter to continue.</p>
        </div>
      )}

      {page === "account" && (
        <div className="settings-block">
          <div className="settings-row settings-row--danger" onClick={onResetProgress}>
            <div className="settings-row-icon"><RotateCcw size={16} /></div>
            <div>
              <div className="settings-row-title">Reset progress</div>
              <div className="settings-row-sub">Clears completed chapters, bookmarks, and streak on this device</div>
            </div>
          </div>
          <p className="settings-note">Progress is saved locally on this device only — nothing is sent anywhere.</p>
        </div>
      )}

      <style>{`
        .settings-page { max-width: 560px; }
        .settings-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .settings-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--text); margin: 0 0 20px; }
        .settings-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 6px; }
        .settings-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; cursor: pointer; }
        .settings-row:hover { background: var(--panel-alt); }
        .settings-row--danger:hover { background: rgba(224,102,90,0.08); }
        .settings-row-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .settings-row--danger .settings-row-icon { color: var(--bad); }
        .settings-row-title { font-size: 14px; color: var(--text); font-weight: 600; }
        .settings-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .settings-note { font-size: 12px; color: var(--muted2); line-height: 1.5; padding: 12px 14px 4px; }
        .settings-switch { width: 34px; height: 20px; border-radius: 12px; background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
      `}</style>
    </div>
  );
}

export default SettingsPage;
