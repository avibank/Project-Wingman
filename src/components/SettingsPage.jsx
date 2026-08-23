import { ChevronLeft, FlaskConical, Minus, Plus } from "lucide-react";
import BlockedList from "./BlockedList.jsx";
import PilotSettings from "./PilotSettings.jsx";

function SettingsPage({ page, onBack, testStreakOverrideOn, onToggleTestStreakOverride, testStreakValue, onChangeTestStreakValue }) {
  return (
    <div className="settings-page">
      <button className="settings-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="settings-title">Features</h1>

      <div className="settings-block">
        <p className="settings-note settings-note-top">
          <FlaskConical size={13} /> Temporary testing area — lets you preview toggleable features in both states without needing real data. Not meant for the final version.
        </p>
        <div className="settings-row" onClick={onToggleTestStreakOverride}>
          <span className={`settings-switch ${testStreakOverrideOn ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
          <div>
            <div className="settings-row-title">Override streak value</div>
            <div className="settings-row-sub">Preview the windsock and weekly propellers at any streak count</div>
          </div>
        </div>
        {testStreakOverrideOn && (
          <div className="settings-stepper">
            <button className="settings-stepper-btn" onClick={() => onChangeTestStreakValue(Math.max(0, testStreakValue - 1))} aria-label="Decrease">
              <Minus size={14} />
            </button>
            <span className="settings-stepper-value">{testStreakValue}</span>
            <button className="settings-stepper-btn" onClick={() => onChangeTestStreakValue(testStreakValue + 1)} aria-label="Increase">
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .settings-page { max-width: 560px; }
        .settings-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent-muted); font-size: 14px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .settings-title { font-family: var(--font-display); font-size: 20px; color: var(--text); margin: 0 0 20px; }
        .settings-block { background: var(--elev-1); border: 1px solid var(--border); box-shadow: var(--shadow-1); border-radius: var(--r-lg); padding: 8px; }
        .settings-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: var(--r-md); cursor: pointer; }
        .settings-row:hover { background: var(--panel-alt); }
        .settings-note { font-size: 12px; color: var(--muted2); line-height: 1.5; padding: 12px 14px 4px; }
        .settings-note-top { display: flex; align-items: flex-start; gap: 6px; padding: 4px 8px 12px; }
        .settings-switch { width: 34px; height: 20px; border-radius: var(--r-md); background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
        .settings-stepper { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 10px 14px 14px; }
        .settings-stepper-btn { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .settings-stepper-btn:hover { border-color: var(--accent); color: var(--accent); }
        .settings-stepper-value { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--text); min-width: 24px; text-align: center; }
      `}</style>
      <PilotSettings />
      <BlockedList />

    </div>
  );
}

export default SettingsPage;
