import { useState, useEffect } from "react";
import { Lock, ChevronRight, CheckCircle2, Target, Flame, BookMarked, MessageSquareOff } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchRecentActivity } from "../lib/comments.js";

// Max tilt in degrees applied to a module card as the cursor moves across it.
const TILT_MAX_DEG = 5;

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

// Chapter codes are "<MODULE>.<NN>" (e.g. "JT.01"), so the module a chapter
// belongs to is recoverable from its code.
function moduleForChapter(chapter) {
  const code = String(chapter.code || "").split(".")[0];
  return MODULES.find((m) => m.code === code) || MODULES[0];
}

// Only JT has authored chapters today; every other module is legitimately empty
// until its content is built.
function chaptersForModule(moduleCode) {
  return moduleCode === "JT" ? CHAPTERS : [];
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

  // Tilt + cursor-follow glow are written straight to the node's style so the
  // pointer stays ahead of React — re-rendering per mousemove would visibly lag.
  const handleCardMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    card.style.setProperty("--tilt-y", `${(px - 0.5) * TILT_MAX_DEG * 2}deg`);
    card.style.setProperty("--tilt-x", `${(0.5 - py) * TILT_MAX_DEG * 2}deg`);
    card.style.setProperty("--glow-x", `${px * 100}%`);
    card.style.setProperty("--glow-y", `${py * 100}%`);
    card.style.setProperty("--glow-o", "1");
  };

  const handleCardLeave = (e) => {
    const card = e.currentTarget;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--glow-o", "0");
  };

  const tiltProps = { onMouseMove: handleCardMove, onMouseLeave: handleCardLeave };

  const recentChapters = recentChapterIds.map((id) => CHAPTERS.find((ch) => ch.id === id)).filter(Boolean);

  return (
    <div className="hub">
      <p className="hub-eyebrow">Aviation Fundamentals</p>
      <h1 className="hub-title">Flight Deck</h1>
      <p className="hub-sub">Your modules, your progress, all in one place.</p>

      <div className="hub-stats">
        <div className="hub-stat-tile">
          <CheckCircle2 size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{completed.size}<small>/{CHAPTERS.length}</small></div>
          <div className="hub-stat-label">Checklist items complete</div>
        </div>
        <div className="hub-stat-tile">
          <Target size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{quizAccuracy === null ? "—" : quizAccuracy}<small>{quizAccuracy === null ? "" : "%"}</small></div>
          <div className="hub-stat-label">Quiz accuracy</div>
        </div>
        <div className="hub-stat-tile">
          <Flame size={15} className="hub-stat-icon hub-stat-icon--flame" />
          <div className="hub-stat-value">{longestStreak}<small>d</small></div>
          <div className="hub-stat-label">Consecutive Days Flown</div>
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
          const moduleChapters = chaptersForModule(m.code);
          const chapterCount = moduleChapters.length;
          const doneCount = moduleChapters.filter((ch) => completed.has(ch.id)).length;
          const pct = chapterCount ? Math.round((doneCount / chapterCount) * 100) : 0;

          if (!hasContent) {
            return (
              <div key={m.code} className="hub-module-card is-locked">
                <div className="hub-module-chip hub-module-chip--locked"><Lock size={9} /> Standby</div>
                <div className="hub-module-code">{m.code}</div>
                <div className="hub-module-name">{m.name}</div>
              </div>
            );
          }

          if (!isEnrolled) {
            return (
              <div key={m.code} className="hub-module-card hub-module-card--live" {...tiltProps}>
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
            <div key={m.code} className="hub-module-card hub-module-card--live" {...tiltProps}>
              <div className="hub-module-chip hub-module-chip--active">
                <span className="hub-module-dot" aria-hidden="true" /> In progress
              </div>
              <div className="hub-module-code">{m.code}</div>
              <div className="hub-module-name">{m.name}</div>
              <div className="hub-module-pips">
                {moduleChapters.map((ch) => (
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
            <div className="hub-section-title">Active Checklist</div>
          </div>
          <div className="hub-recent-list">
            {recentChapters.length === 0 ? (
              <div className="hub-empty">Open a checklist item to log it here.</div>
            ) : (
              recentChapters.map((ch) => (
                <button key={ch.id} className="hub-recent-item" onClick={() => onEnterModule(moduleForChapter(ch))}>
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
            <div className="hub-section-title">Telemetry Feed</div>
            <button className="hub-section-link" onClick={onGoToDiscuss}>Open discussion →</button>
          </div>
          <div className="hub-activity-list">
            {activityLoading ? (
              <div className="hub-empty">Reading telemetry…</div>
            ) : activity.length === 0 ? (
              <div className="hub-empty">
                <MessageSquareOff size={22} className="hub-empty-icon" />
                <span>No telemetry received yet.</span>
              </div>
            ) : (
              activity.map((c) => {
                const chapter = c.chapter_id ? CHAPTERS.find((ch) => ch.id === c.chapter_id) : null;
                const context = chapter ? chapter.title : "Discussion";
                const author = c.author || "Unknown";
                return (
                  <div key={c.id} className="hub-activity-item">
                    <div className="hub-activity-avatar">{author.charAt(0).toUpperCase()}</div>
                    <div className="hub-activity-body">
                      <div className="hub-activity-text">
                        <strong>{author}</strong> in <span className="hub-activity-tag">{context}</span>
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
        /* Shared surface treatment: a top-lit gradient fill plus a layered
           shadow — inset hairline highlight above, ambient drop below. */
        .hub {
          --hub-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --hub-surface: linear-gradient(180deg, color-mix(in srgb, var(--panel) 95%, white 5%) 0%, var(--panel) 100%);
          --hub-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.16), 0 6px 18px rgba(0,0,0,0.20);
          --hub-shadow-hover: inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.18), 0 14px 32px rgba(0,0,0,0.28);
          position: relative;
        }
        /* Ambient light from the top-left, scoped to the Flight Deck only. */
        .hub::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(900px 620px at 10% -12%, color-mix(in srgb, var(--accent) 11%, transparent) 0%, transparent 62%);
        }
        .hub > * { position: relative; z-index: 1; }
        .hub-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin: 0 0 6px; }
        .hub-title { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 6px; color: var(--text); }
        .hub-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 24px; }
        .hub-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
        @media (max-width: 720px) { .hub-stats { grid-template-columns: repeat(2, 1fr); } }
        .hub-stat-tile {
          background: var(--hub-surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px;
          box-shadow: var(--hub-shadow);
          transition: transform 0.2s var(--hub-ease), border-color 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease);
        }
        .hub-stat-tile:hover { transform: translateY(-2px) scale(1.015); border-color: var(--border-hover); box-shadow: var(--hub-shadow-hover); }
        .hub-stat-icon { color: var(--muted2); margin-bottom: 10px; }
        .hub-stat-icon--flame { color: var(--accent); }
        .hub-stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 20px; color: var(--text); }
        .hub-stat-value small { font-weight: 400; font-size: 11px; color: var(--muted2); }
        .hub-stat-label { font-size: 11.5px; color: var(--muted); margin-top: 4px; }
        .hub-section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
        .hub-section-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); }
        .hub-section-link { background: transparent; border: none; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); cursor: pointer; padding: 0; transition: color 0.2s var(--hub-ease); }
        .hub-section-link:hover { color: var(--accent); }
        .hub-modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 28px; }
        .hub-module-card {
          position: relative;
          background: var(--hub-surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px;
          display: flex; flex-direction: column;
          box-shadow: var(--hub-shadow);
        }
        .hub-module-card.is-locked { opacity: 0.6; }
        /* Interactive cards only: cursor-tracked tilt, lift, and follow glow. */
        .hub-module-card--live {
          --tilt-x: 0deg; --tilt-y: 0deg; --lift: 0px; --card-scale: 1;
          --glow-x: 50%; --glow-y: 50%; --glow-o: 0;
          transform: perspective(900px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) translateY(var(--lift)) scale(var(--card-scale));
          transform-style: preserve-3d;
          transition: transform 0.2s var(--hub-ease), border-color 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease);
        }
        .hub-module-card--live::before {
          content: "";
          position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          background: radial-gradient(320px circle at var(--glow-x) var(--glow-y), color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 70%);
          opacity: var(--glow-o);
          transition: opacity 0.2s var(--hub-ease);
        }
        .hub-module-card--live:hover { --lift: -3px; --card-scale: 1.015; border-color: var(--border-hover); box-shadow: var(--hub-shadow-hover); }
        .hub-module-card--live:active { --lift: -1px; --card-scale: 0.985; transition-duration: 0.08s; }
        .hub-module-chip { align-self: flex-start; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 20px; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }
        .hub-module-chip--active { background: var(--accent-soft); color: var(--accent); }
        .hub-module-chip--open { background: var(--panel-alt); color: var(--muted); border: 1px solid var(--border); }
        .hub-module-chip--locked { background: var(--panel-alt); color: var(--muted2); }
        /* Focal element: the live-module indicator is allowed to glow. */
        .hub-module-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px 2px color-mix(in srgb, var(--accent) 45%, transparent); }
        .hub-module-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); margin-bottom: 3px; }
        .hub-module-name { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
        .hub-module-pips { display: flex; gap: 4px; margin-bottom: 12px; }
        .hub-pip { flex: 1; height: 4px; border-radius: 2px; background: var(--panel-alt); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }
        .hub-pip.is-done { background: var(--good); }
        .hub-module-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .hub-module-progress-text { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        /* Focal element: primary CTAs carry a low-opacity accent glow. */
        .hub-module-continue {
          display: flex; align-items: center; gap: 4px; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
          padding: 6px 11px; font-size: 11.5px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 14%, transparent);
          transition: background 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease), transform 0.2s var(--hub-ease);
        }
        .hub-module-continue:hover { background: var(--accent-hover); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 22%, transparent); }
        .hub-module-continue:active { transform: scale(0.96); transition-duration: 0.08s; }
        .hub-module-unenroll { align-self: flex-start; margin-top: 8px; background: transparent; border: none; color: var(--muted2); font-size: 10.5px; cursor: pointer; padding: 0; transition: color 0.2s var(--hub-ease); }
        .hub-module-unenroll:hover { color: var(--bad); }
        .hub-module-unenroll:disabled { opacity: 0.5; cursor: not-allowed; }
        .hub-module-enroll {
          margin-top: auto; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
          padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 14%, transparent);
          transition: background 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease), transform 0.2s var(--hub-ease);
        }
        .hub-module-enroll:hover { background: var(--accent-hover); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 22%, transparent); }
        .hub-module-enroll:active { transform: scale(0.97); transition-duration: 0.08s; }
        .hub-module-enroll:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
        .hub-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 880px) { .hub-columns { grid-template-columns: 1fr; } }
        .hub-recent-list { display: flex; flex-direction: column; gap: 6px; }
        .hub-recent-item {
          display: flex; align-items: center; gap: 10px; background: var(--hub-surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left;
          box-shadow: var(--hub-shadow);
          transition: transform 0.2s var(--hub-ease), border-color 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease);
        }
        .hub-recent-item:hover { transform: translateY(-2px) scale(1.015); border-color: var(--border-hover); box-shadow: var(--hub-shadow-hover); }
        .hub-recent-item:active { transform: translateY(0) scale(0.99); transition-duration: 0.08s; }
        .hub-recent-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); flex-shrink: 0; }
        .hub-recent-title { font-size: 12.5px; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hub-recent-arrow { color: var(--muted2); flex-shrink: 0; }
        .hub-activity-list { background: var(--hub-surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: var(--hub-shadow); }
        .hub-activity-item { display: flex; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border-soft); transition: background 0.2s var(--hub-ease); }
        .hub-activity-item:last-child { border-bottom: none; }
        .hub-activity-item:hover { background: color-mix(in srgb, var(--panel) 92%, white 8%); }
        .hub-activity-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 600; flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; }
        .hub-activity-body { flex: 1; min-width: 0; }
        .hub-activity-text { font-size: 12px; color: var(--text-soft); line-height: 1.5; }
        .hub-activity-tag { color: var(--accent); }
        .hub-activity-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); margin-top: 3px; }
        .hub-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; padding: 20px; text-align: center; background: var(--hub-surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--hub-shadow); }
        .hub-empty-icon { color: var(--muted2); opacity: 0.6; }

        /* Smooth Air (and OS-level reduced motion): keep the depth, drop the movement. */
        .app.reduce-motion .hub-module-card--live,
        .app.reduce-motion .hub-stat-tile,
        .app.reduce-motion .hub-recent-item,
        .app.reduce-motion .hub-module-continue,
        .app.reduce-motion .hub-module-enroll { transform: none !important; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s; }
        .app.reduce-motion .hub-module-card--live::before { opacity: 0 !important; }
        @media (prefers-reduced-motion: reduce) {
          .hub-module-card--live, .hub-stat-tile, .hub-recent-item, .hub-module-continue, .hub-module-enroll { transform: none !important; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s; }
          .hub-module-card--live::before { opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}

export default HubPage;
