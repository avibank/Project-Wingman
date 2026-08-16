import { useState, useEffect } from "react";
import { ChevronLeft, Mail, LogOut, UserCog, TrendingUp, BookMarked, Sun, Moon, Settings, Check, X, Flame, CheckCircle2, RotateCcw } from "lucide-react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { loadJSON, saveJSON, getNum } from "../lib/storage.js";
import { CHAPTERS } from "../data.js";

function ProfilePage({ onBack, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, calmDiscussLights, onToggleCalmDiscussLights, onResetProgress }) {
  const [tab, setTab] = useState("overview");
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

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

  const completedChapters = loadJSON("pw-completed", []);
  const [bookmarkIds, setBookmarkIds] = useState(() => loadJSON("pw-bookmarks", []));
  const longestStreak = getNum("pw-longest-streak", 0);
  const totalChapters = CHAPTERS.length;
  const allQuestions = CHAPTERS.flatMap((ch) => ch.questions.map((q) => ({ ...q, chapterTitle: ch.title, chapterCode: ch.code })));
  const bookmarkedQuestions = allQuestions.filter((q) => bookmarkIds.includes(q.id));

  const removeBookmark = (qId) => {
    const next = bookmarkIds.filter((id) => id !== qId);
    setBookmarkIds(next);
    saveJSON("pw-bookmarks", next);
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <button className="profile-page-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="profile-page-title">Profile</h1>

      <div className="profile-page-tabs">
        <button className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button className={tab === "bookmarks" ? "is-active" : ""} onClick={() => setTab("bookmarks")}>Bookmarks</button>
        <button className={tab === "preferences" ? "is-active" : ""} onClick={() => setTab("preferences")}>Preferences</button>
        <button className={tab === "account" ? "is-active" : ""} onClick={() => setTab("account")}>Account</button>
      </div>

      {tab === "overview" && (
        <>
          <div className="settings-block">
            <div className="profile-identity-row">
              {user.imageUrl ? (
                <img className="profile-identity-photo" src={user.imageUrl} alt="" />
              ) : (
                <div className="profile-identity-icon"><Mail size={16} /></div>
              )}
              <div>
                <div className="profile-identity-label">Signed in as</div>
                <div className="profile-identity-name">{user.fullName || user.primaryEmailAddress?.emailAddress}</div>
              </div>
            </div>
            <button className="profile-manage-btn" onClick={() => openUserProfile()}>
              <UserCog size={15} /> Manage account (photo, name, email, password)
            </button>
            <button className="profile-signout-btn" onClick={() => signOut().then(onBack)}>
              <LogOut size={15} /> Sign out
            </button>
          </div>

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
                <div className="progress-stat-value">{bookmarkIds.length}</div>
                <div className="progress-stat-label">Bookmarked questions</div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "bookmarks" && (
        <div className="settings-block">
          {bookmarkedQuestions.length === 0 ? (
            <p className="settings-note settings-note-top">No bookmarked questions yet — tap the star on any quiz question to save it here.</p>
          ) : (
            <div className="bookmarks-list">
              {bookmarkedQuestions.map((q) => (
                <div key={q.id} className="bookmark-item">
                  <div className="bookmark-item-chapter">{q.chapterCode} · {q.chapterTitle}</div>
                  <div className="bookmark-item-stem">{q.stem}</div>
                  <button className="bookmark-item-remove" onClick={() => removeBookmark(q.id)} aria-label="Remove bookmark">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "preferences" && (
        <div className="settings-block">
          <div className="settings-row" onClick={onToggleTheme}>
            <div className="settings-row-icon">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</div>
            <div>
              <div className="settings-row-title">Theme</div>
              <div className="settings-row-sub">Currently {theme === "light" ? "light" : "dark"} mode — tap to switch</div>
            </div>
          </div>
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

      {tab === "account" && (
        <div className="settings-block">
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
        .profile-page { max-width: 560px; }
        .profile-page-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .profile-page-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--text); margin: 0 0 16px; }
        .profile-page-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
        .profile-page-tabs button { flex: 1; background: transparent; border: none; color: var(--muted2); font-size: 12.5px; padding: 8px 4px; border-radius: 8px; cursor: pointer; }
        .profile-page-tabs button.is-active { background: var(--panel); color: var(--text); }
        .settings-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 6px; margin-bottom: 12px; }
        .settings-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; cursor: pointer; }
        .settings-row:hover { background: var(--panel-alt); }
        .settings-row--danger:hover { background: rgba(224,102,90,0.08); }
        .settings-row-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .settings-row--danger .settings-row-icon { color: var(--bad); }
        .settings-row-title { font-size: 14px; color: var(--text); font-weight: 600; }
        .settings-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .settings-note { font-size: 12px; color: var(--muted2); line-height: 1.5; padding: 12px 14px 4px; }
        .settings-note-top { padding: 12px; }
        .settings-switch { width: 34px; height: 20px; border-radius: 12px; background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
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
        .bookmarks-list { display: flex; flex-direction: column; gap: 2px; padding: 4px; }
        .bookmark-item { position: relative; padding: 12px 36px 12px 14px; border-radius: 10px; }
        .bookmark-item:hover { background: var(--panel-alt); }
        .bookmark-item-chapter { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); margin-bottom: 4px; }
        .bookmark-item-stem { font-size: 13px; color: var(--text); line-height: 1.4; }
        .bookmark-item-remove { position: absolute; top: 10px; right: 8px; background: transparent; border: none; color: var(--muted2); width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bookmark-item-remove:hover { background: rgba(224,102,90,0.12); color: var(--bad); }
        .profile-identity-row { display: flex; align-items: center; gap: 12px; padding: 14px; }
        .profile-identity-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .profile-identity-photo { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .profile-identity-label { font-size: 11px; color: var(--muted); }
        .profile-identity-name { font-size: 14px; color: var(--text); font-weight: 600; }
        .profile-manage-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--accent); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; width: calc(100% - 12px); margin: 0 6px 6px; }
        .profile-manage-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
        .profile-signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--bad); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; width: calc(100% - 12px); margin: 0 6px 6px; }
        .profile-signout-btn:hover { background: rgba(224,102,90,0.08); }
      `}</style>
    </div>
  );
}

export default ProfilePage;
