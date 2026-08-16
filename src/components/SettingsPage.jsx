import { useState, useEffect } from "react";
import { ChevronLeft, Sun, Moon, RotateCcw, FlaskConical, Minus, Plus, Check, BookMarked, Flame, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { loadJSON, getNum } from "../lib/storage.js";
import { CHAPTERS } from "../data.js";

function SettingsPage({ page, onBack, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, calmDiscussLights, onToggleCalmDiscussLights, onResetProgress, testStreakOverrideOn, onToggleTestStreakOverride, testStreakValue, onChangeTestStreakValue }) {
  const { user } = useUser();
  const [nickname, setNickname] = useState("");
  const [showNicknameOnly, setShowNicknameOnly] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setNickname(user.unsafeMetadata?.nickname || "");
      setShowNicknameOnly(!!user.unsafeMetadata?.showNicknameOnly);
    }
  }, [user]);

  const saveNickname = async () => {
    if (!user) return;
    await user.update({ unsafeMetadata: { ...user.unsafeMetadata, nickname: nickname.trim(), showNicknameOnly } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  const TITLES = {
    personalize: "Personalize",
    accessibility: "Accessibility",
    account: "Account Settings",
    features: "Features",
    progress: "My Progress",
  };

  const completedChapters = loadJSON("pw-completed", []);
  const bookmarkCount = loadJSON("pw-bookmarks", []).length;
  const longestStreak = getNum("pw-longest-streak", 0);
  const totalChapters = CHAPTERS.length;

  return (
    <div className="settings-page">
      <button className="settings-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="settings-title">{TITLES[page]}</h1>

      {page === "progress" && (
        <div className="settings-block settings-progress">
          <div className="progress-stat">
            <div className="progress-stat-icon"><CheckCircle2 size={18} /></div>
            <div>
              <div className="progress-stat-value">{completedChapters.length} <span className="progress-stat-of">/ {totalChapters}</span></div>
              <div className="progress-stat-label">Chapters completed</div>
            </div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-icon"><Flame size={18} /></div>
            <div>
              <div className="progress-stat-value">{longestStreak}</div>
              <div className="progress-stat-label">Longest streak (days)</div>
            </div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-icon"><BookMarked size={18} /></div>
            <div>
              <div className="progress-stat-value">{bookmarkCount}</div>
              <div className="progress-stat-label">Bookmarked questions</div>
            </div>
          </div>
          <p className="settings-note">Progress is tracked on this device only.</p>
        </div>
      )}

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
          <div className="settings-row" onClick={onToggleCalmDiscussLights}>
            <span className={`settings-switch ${calmDiscussLights ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
            <div>
              <div className="settings-row-title">Calm discussion lights</div>
              <div className="settings-row-sub">Replaces the pulsing red/green buttons in Discussion with a plain navy style</div>
            </div>
          </div>
          <p className="settings-note">Quizzes support keyboard shortcuts: press 1-4 or A-D to answer, and Enter to continue.</p>
        </div>
      )}

      {page === "account" && (
        <div className="settings-block">
          {user && (
            <div className="settings-nickname-block">
              <div className="settings-row-title" style={{ padding: "10px 14px 0" }}>Nickname</div>
              <div className="settings-row-sub" style={{ padding: "0 14px 10px" }}>Shown alongside (or instead of) your real name in Comments and Discussion</div>
              <div className="settings-nickname-input-row">
                <input
                  className="settings-nickname-input"
                  placeholder="e.g. SkyCadet"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <button className="settings-nickname-save" onClick={saveNickname}>
                  {saved ? <Check size={14} /> : "Save"}
                </button>
              </div>
              <div className="settings-row" onClick={() => setShowNicknameOnly((s) => !s)}>
                <span className={`settings-switch ${showNicknameOnly ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
                <div>
                  <div className="settings-row-title">Show nickname only</div>
                  <div className="settings-row-sub">Hides your real name for privacy — only your nickname is shown</div>
                </div>
              </div>
            </div>
          )}
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

      {page === "features" && (
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
        .settings-note-top { display: flex; align-items: flex-start; gap: 6px; padding: 4px 8px 12px; }
        .settings-switch { width: 34px; height: 20px; border-radius: 12px; background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
        .settings-stepper { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 10px 14px 14px; }
        .settings-stepper-btn { width: 32px; height: 32px; border-radius: 8px; background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .settings-stepper-btn:hover { border-color: var(--accent); color: var(--accent); }
        .settings-stepper-value { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: var(--text); min-width: 24px; text-align: center; }
        .settings-nickname-block { border-bottom: 1px solid var(--border-soft); margin-bottom: 6px; padding-bottom: 6px; }
        .settings-nickname-input-row { display: flex; gap: 8px; padding: 0 14px 10px; }
        .settings-nickname-input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: var(--text); font-size: 13.5px; }
        .settings-nickname-input:focus { outline: none; border-color: var(--accent); }
        .settings-nickname-save { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 52px; }
        .settings-progress { display: flex; flex-direction: column; gap: 2px; padding: 8px; }
        .progress-stat { display: flex; align-items: center; gap: 14px; padding: 12px; }
        .progress-stat-icon { width: 40px; height: 40px; border-radius: 12px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .progress-stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); }
        .progress-stat-of { font-size: 14px; color: var(--muted2); font-weight: 500; }
        .progress-stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}

export default SettingsPage;
