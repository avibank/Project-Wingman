import { useState, useEffect } from "react";
import { Lock, ChevronRight, CheckCircle2, Target, Flame, BookMarked, MessageSquareOff } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchRecentActivity } from "../lib/comments.js";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HubPage({ onEnterModule, onGoToDiscuss, onSignIn }) {
  const { isSignedIn, user } = useUser();
  const progress = useUserProgress();
  const [enrolledCodes, setEnrolledCodes] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const completed = new Set(progress.get("pw-completed", []));
  const quizScores = progress.get("pw-quiz-scores", {});
  const bookmarkCount = progress.get("pw-bookmarks", []).length;
  const longestStreak = progress.get("pw-longest-streak", 0);
  const recentChapterIds = progress.get("pw-recent-chapters", []);

  const scoreValues = Object.values(quizScores);
  const quizAccuracy = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  useEffect(() => {
    if (!progress.loaded) return;
    if (isSignedIn && user) {
      fetchEnrollments(user.id).then(setEnrolledCodes);
    } else {
      setEnrolledCodes([]);
    }
  }, [progress.loaded, isSignedIn, user?.id]);

  useEffect(() => {
    fetchRecentActivity(8).then((data) => {
      setActivity(data);
      setActivityLoading(false);
    });
  }, []);

  const handleEnroll = async (moduleCode) => {
    if (!isSignedIn) {
      onSignIn();
      return;
    }
    setEnrolling(moduleCode);
    const ok = await enrollInModule(user.id, moduleCode);
    if (ok) setEnrolledCodes((prev) => [...prev, moduleCode]);
    setEnrolling(null);
  };

  const handleUnenroll = async (moduleCode) => {
    if (!window.confirm("Unenroll from this module? Your progress is kept, but the module will move back to Open Enrollment.")) return;
    setEnrolling(moduleCode);
    const ok = await unenrollFromModule(user.id, moduleCode);
    if (ok) setEnrolledCodes((prev) => prev.filter((c) => c !== moduleCode));
    setEnrolling(null);
  };

  const recentChapters = recentChapterIds.map((id) => CHAPTERS.find((ch) => ch.id === id)).filter(Boolean);

  return (
    <div className="hub">
      <p className="hub-eyebrow">Aviation Fundamentals</p>
      <h1 className="hub-title">Hub</h1>
      <p className="hub-sub">Your modules, your progress, all in one place.</p>

      <div className="hub-stats">
        <div className="hub-stat-tile">
          <CheckCircle2 size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{completed.size}<small>/{CHAPTERS.length}</small></div>
          <div className="hub-stat-label">Chapters completed</div>
        </div>
        <div className="hub-stat-tile">
          <Target size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{quizAccuracy === null ? "—" : quizAccuracy}<small>{quizAccuracy === null ? "" : "%"}</small></div>
          <div className="hub-stat-label">Quiz accuracy</div>
        </div>
        <div className="hub-stat-tile">
          <Flame size={15} className="hub-stat-icon hub-stat-icon--flame" />
          <div className="hub-stat-value">{longestStreak}<small>d</small></div>
          <div className="hub-stat-label">Longest streak</div>
        </div>
        <div className="hub-stat-tile">
          <BookMarked size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{bookmarkCount}</div>
          <div className="hub-stat-label">Bookmarked questions</div>
        </div>
      </div>

      <div className="hub-section-head">
        <div className="hub-section-title">Modules</div>
      </div>
      <div className="hub-modules">
        {MODULES.map((m) => {
          const hasContent = m.status === "active";
          const isEnrolled = enrolledCodes.includes(m.code);
          const chapterCount = m.code === "JT" ? CHAPTERS.length : 0;
          const doneCount = m.code === "JT" ? completed.size : 0;
          const pct = chapterCount ? Math.round((doneCount / chapterCount) * 100) : 0;

          if (!hasContent) {
            return (
              <div key={m.code} className="hub-module-card is-locked">
                <div className="hub-module-chip hub-module-chip--locked"><Lock size={9} /> Coming soon</div>
                <div className="hub-module-code">{m.code}</div>
                <div className="hub-module-name">{m.name}</div>
              </div>
            );
          }

          if (!isEnrolled) {
            return (
              <div key={m.code} className="hub-module-card">
                <div className="hub-module-chip hub-module-chip--open">Open enrollment</div>
                <div className="hub-module-code">{m.code}</div>
                <div className="hub-module-name">{m.name}</div>
                <button className="hub-module-enroll" onClick={() => handleEnroll(m.code)} disabled={enrolling === m.code}>
                  {enrolling === m.code ? "Enrolling…" : "Enroll"}
                </button>
              </div>
            );
          }

          return (
            <div key={m.code} className="hub-module-card">
              <div className="hub-module-chip hub-module-chip--active">In progress</div>
              <div className="hub-module-code">{m.code}</div>
              <div className="hub-module-name">{m.name}</div>
              <div className="hub-module-pips">
                {CHAPTERS.map((ch) => (
                  <div key={ch.id} className={`hub-pip ${completed.has(ch.id) ? "is-done" : ""}`} />
                ))}
              </div>
              <div className="hub-module-foot">
                <span className="hub-module-progress-text">{pct}% · {doneCount}/{chapterCount} chapters</span>
                <button className="hub-module-continue" onClick={() => onEnterModule(m)}>
                  Continue <ChevronRight size={13} />
                </button>
              </div>
              <button className="hub-module-unenroll" onClick={() => handleUnenroll(m.code)} disabled={enrolling === m.code}>
                {enrolling === m.code ? "Unenrolling…" : "Unenroll"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="hub-columns">
        <div>
          <div className="hub-section-head">
            <div className="hub-section-title">Continue studying</div>
          </div>
          <div className="hub-recent-list">
            {recentChapters.length === 0 ? (
              <div className="hub-empty">Open a chapter to see it here.</div>
            ) : (
              recentChapters.map((ch) => (
                <button key={ch.id} className="hub-recent-item" onClick={() => onEnterModule(MODULES[0])}>
                  <span className="hub-recent-code">{ch.code}</span>
                  <span className="hub-recent-title">{ch.title}</span>
                  <ChevronRight size={13} className="hub-recent-arrow" />
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="hub-section-head">
            <div className="hub-section-title">Recent activity</div>
            <button className="hub-section-link" onClick={onGoToDiscuss}>Open discussion →</button>
          </div>
          <div className="hub-activity-list">
            {activityLoading ? (
              <div className="hub-empty">Loading…</div>
            ) : activity.length === 0 ? (
              <div className="hub-empty">
                <MessageSquareOff size={22} className="hub-empty-icon" />
                <span>No activity yet.</span>
              </div>
            ) : (
              activity.map((c) => {
                const chapter = c.chapter_id ? CHAPTERS.find((ch) => ch.id === c.chapter_id) : null;
                const context = chapter ? chapter.title : "Discussion";
                return (
                  <div key={c.id} className="hub-activity-item">
                    <div className="hub-activity-avatar">{c.author.charAt(0).toUpperCase()}</div>
                    <div className="hub-activity-body">
                      <div className="hub-activity-text">
                        <strong>{c.author}</strong> in <span className="hub-activity-tag">{context}</span>
                        {c.text && <> — "{c.text.length > 70 ? c.text.slice(0, 70) + "…" : c.text}"</>}
                      </div>
                      <div className="hub-activity-meta">{timeAgo(c.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <style>{`
        .hub-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin: 0 0 6px; }
        .hub-title { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 6px; color: var(--text); }
        .hub-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 24px; }
        .hub-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
        @media (max-width: 720px) { .hub-stats { grid-template-columns: repeat(2, 1fr); } }
        .hub-stat-tile { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
        .hub-stat-icon { color: var(--muted2); margin-bottom: 10px; }
        .hub-stat-icon--flame { color: var(--accent); }
        .hub-stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 20px; color: var(--text); }
        .hub-stat-value small { font-weight: 400; font-size: 11px; color: var(--muted2); }
        .hub-stat-label { font-size: 11.5px; color: var(--muted); margin-top: 4px; }
        .hub-section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
        .hub-section-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); }
        .hub-section-link { background: transparent; border: none; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); cursor: pointer; padding: 0; }
        .hub-section-link:hover { color: var(--accent); }
        .hub-modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 28px; }
        .hub-module-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
        .hub-module-card.is-locked { opacity: 0.6; }
        .hub-module-chip { align-self: flex-start; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 20px; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }
        .hub-module-chip--active { background: var(--accent-soft); color: var(--accent); }
        .hub-module-chip--open { background: var(--panel-alt); color: var(--muted); border: 1px solid var(--border); }
        .hub-module-chip--locked { background: var(--panel-alt); color: var(--muted2); }
        .hub-module-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); margin-bottom: 3px; }
        .hub-module-name { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
        .hub-module-pips { display: flex; gap: 4px; margin-bottom: 12px; }
        .hub-pip { flex: 1; height: 4px; border-radius: 2px; background: var(--panel-alt); }
        .hub-pip.is-done { background: var(--good); }
        .hub-module-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .hub-module-progress-text { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        .hub-module-continue { display: flex; align-items: center; gap: 4px; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 6px 11px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
        .hub-module-continue:hover { background: var(--accent-hover); }
        .hub-module-unenroll { align-self: flex-start; margin-top: 8px; background: transparent; border: none; color: var(--muted2); font-size: 10.5px; cursor: pointer; padding: 0; }
        .hub-module-unenroll:hover { color: var(--bad); }
        .hub-module-unenroll:disabled { opacity: 0.5; cursor: not-allowed; }
        .hub-module-enroll { margin-top: auto; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .hub-module-enroll:hover { background: var(--accent-hover); }
        .hub-module-enroll:disabled { opacity: 0.6; cursor: not-allowed; }
        .hub-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 880px) { .hub-columns { grid-template-columns: 1fr; } }
        .hub-recent-list { display: flex; flex-direction: column; gap: 6px; }
        .hub-recent-item { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; }
        .hub-recent-item:hover { border-color: var(--accent); }
        .hub-recent-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); flex-shrink: 0; }
        .hub-recent-title { font-size: 12.5px; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hub-recent-arrow { color: var(--muted2); flex-shrink: 0; }
        .hub-activity-list { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .hub-activity-item { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border-soft); }
        .hub-activity-item:last-child { border-bottom: none; }
        .hub-activity-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 600; flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; }
        .hub-activity-body { flex: 1; min-width: 0; }
        .hub-activity-text { font-size: 12px; color: var(--text-soft); line-height: 1.5; }
        .hub-activity-tag { color: var(--accent); }
        .hub-activity-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); margin-top: 3px; }
        .hub-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; padding: 20px; text-align: center; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
        .hub-empty-icon { color: var(--muted2); opacity: 0.6; }
      `}</style>
    </div>
  );
}

export default HubPage;
