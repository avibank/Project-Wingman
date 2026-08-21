import { useState, useEffect } from "react";
import { Lock, ChevronRight, CheckCircle2, Target, Flame, BookMarked, MessageSquareOff, Layers, RotateCcw, Compass } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchRecentActivity } from "../lib/comments.js";

// Max tilt in degrees applied to a module card as the cursor moves across it.
const TILT_MAX_DEG = 5;
// A completed chapter scoring below this is worth suggesting a retake of.
const LOW_SCORE_PCT = 70;

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

// Same formula ChaptersPanel uses, so a chapter reads identically in both places.
function chapterPct(chapter, chapterProgress) {
  const seen = chapterProgress[chapter.id] || 0;
  return Math.min(100, Math.round((seen / chapter.questions.length) * 100));
}

// Counts up to the target on mount. Returns the target immediately when
// animation is suppressed, so Smooth Air users never see a number climb.
function useCountUp(target, animate) {
  const [n, setN] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setN(target);
      return;
    }
    const duration = 700;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);
  return n;
}

// 270-degree arc gauge drawn behind the accuracy readout.
function AccuracyArc({ pct, size = 58 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const arcLen = circumference * 0.75;
  const filled = arcLen * (Math.max(0, Math.min(100, pct)) / 100);
  const common = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: "none",
    strokeWidth: stroke,
    strokeLinecap: "round",
    transform: `rotate(135 ${size / 2} ${size / 2})`,
  };
  return (
    <svg className="hub-gauge-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle {...common} stroke="var(--border)" strokeDasharray={`${arcLen} ${circumference}`} />
      <circle
        {...common}
        stroke="var(--accent)"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

// Quick-glance completion ring for enrolled module cards.
function ProgressRing({ pct, size = 34 }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * (Math.max(0, Math.min(100, pct)) / 100);
  const common = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: "none",
    strokeWidth: stroke,
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle {...common} stroke="var(--border)" />
      <circle
        {...common}
        stroke="var(--good)"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

function HubPage({ onEnterModule, onGoToChapter, onGoToDiscuss, onReviewBookmarks, onSignIn, streak = 0 }) {
  const { isSignedIn, user } = useUser();
  const progress = useUserProgress();
  const [enrolledCodes, setEnrolledCodes] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const completed = new Set(progress.get("pw-completed", []));
  const quizScores = progress.get("pw-quiz-scores", {});
  const bookmarkIds = progress.get("pw-bookmarks", []);
  const bookmarkCount = bookmarkIds.length;
  const longestStreak = progress.get("pw-longest-streak", 0);
  const recentChapterIds = progress.get("pw-recent-chapters", []);
  const chapterProgress = progress.get("pw-chapter-progress", {});
  const viewedIds = new Set(progress.get("pw-viewed-chapters", []));
  const reduceMotion = progress.get("pw-reduce-motion", false);
  const lastFlown = progress.get("pw-last-flown", null);

  const scoreValues = Object.values(quizScores);
  const quizAccuracy = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  const streakDisplay = useCountUp(streak, !reduceMotion);

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

  // --- Pre-flight briefing -------------------------------------------------
  // pw-last-chapter is cleared when a chapter is collapsed, so fall back to the
  // top of the recent list before declaring the user has never flown.
  const lastChapterId = progress.get("pw-last-chapter", null) || recentChapterIds[0] || null;
  const lastChapter = lastChapterId ? CHAPTERS.find((ch) => ch.id === lastChapterId) : null;
  const lastModule = lastChapter ? moduleForChapter(lastChapter) : null;
  const lastChapterPct = lastChapter ? chapterPct(lastChapter, chapterProgress) : 0;

  const firstName = user?.username || user?.firstName || (user?.fullName ? user.fullName.split(" ")[0] : null);
  const greeting = new Date().getHours() < 12 ? "Cleared for departure" : "Evening ops";
  const greetingLine = firstName ? `${greeting}, ${firstName}` : greeting;

  const resumeFlight = () => {
    if (!lastChapter || !lastModule) return;
    onGoToChapter(lastModule.code, lastChapter.id);
  };

  const startFirstFlight = () => {
    const jt = MODULES.find((m) => m.code === "JT") || MODULES[0];
    if (CHAPTERS.length) onGoToChapter(jt.code, CHAPTERS[0].id);
    else onEnterModule(jt);
  };

  // --- Smart next action ---------------------------------------------------
  // First rule that matches wins; deliberately simple and data-driven.
  let suggestion = null;
  const unstarted = CHAPTERS.find((ch) => !completed.has(ch.id) && !viewedIds.has(ch.id));
  if (unstarted) {
    suggestion = {
      icon: Compass,
      label: "Next up",
      title: unstarted.title,
      action: "Open",
      onAct: () => onGoToChapter(moduleForChapter(unstarted).code, unstarted.id),
    };
  } else if (bookmarkCount > 0) {
    suggestion = {
      icon: Layers,
      label: "Review flagged",
      title: `${bookmarkCount} bookmarked question${bookmarkCount === 1 ? "" : "s"}`,
      action: "Flashcards",
      onAct: onReviewBookmarks,
    };
  } else {
    const weakest = Object.entries(quizScores)
      .filter(([id, score]) => completed.has(id) && score < LOW_SCORE_PCT)
      .sort((a, b) => a[1] - b[1])[0];
    const weakChapter = weakest ? CHAPTERS.find((ch) => ch.id === weakest[0]) : null;
    if (weakChapter) {
      suggestion = {
        icon: RotateCcw,
        label: `Retake · scored ${weakest[1]}%`,
        title: weakChapter.title,
        action: "Retake",
        onAct: () => onGoToChapter(moduleForChapter(weakChapter).code, weakChapter.id),
      };
    }
  }

  return (
    <div className="hub">
      <p className="hub-eyebrow">Aviation Fundamentals</p>
      <h1 className="hub-title">Flight Deck</h1>
      <p className="hub-sub">Your modules, your progress, all in one place.</p>

      <div className="hub-briefing">
        <div className="hub-briefing-sweep" aria-hidden="true" />
        <div className="hub-briefing-head">
          <div>
            <div className="hub-briefing-label">Pre-flight briefing</div>
            <div className="hub-briefing-greet">{greetingLine}</div>
          </div>
          <div className="hub-briefing-meta">
            <span>{lastFlown ? `Last flown ${timeAgo(lastFlown)}` : "No flights logged"}</span>
            <span className="hub-briefing-dot" aria-hidden="true">·</span>
            <span>{streak} day streak</span>
          </div>
        </div>

        {lastChapter ? (
          <div className="hub-briefing-body">
            <div className="hub-briefing-chapter">
              <div className="hub-briefing-module">{lastModule?.name}</div>
              <div className="hub-briefing-title">
                <span className="hub-briefing-code">{lastChapter.code}</span> {lastChapter.title}
              </div>
              <div className="hub-briefing-bar">
                <div className="hub-briefing-fill" style={{ width: `${lastChapterPct}%` }} />
              </div>
              <div className="hub-briefing-pct">{lastChapterPct}% through this chapter</div>
            </div>
            <button className="hub-briefing-cta" onClick={resumeFlight}>
              Resume Flight <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="hub-briefing-body">
            <div className="hub-briefing-chapter">
              <div className="hub-briefing-title">Nothing logged yet</div>
              <div className="hub-briefing-pct">Start with the first chapter of Jet Turbine Fundamentals.</div>
            </div>
            <button className="hub-briefing-cta" onClick={startFirstFlight}>
              Start first flight <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {suggestion && (
        <button className="hub-suggest" onClick={suggestion.onAct}>
          <suggestion.icon size={15} className="hub-suggest-icon" />
          <div className="hub-suggest-body">
            <div className="hub-suggest-label">{suggestion.label}</div>
            <div className="hub-suggest-title">{suggestion.title}</div>
          </div>
          <span className="hub-suggest-action">{suggestion.action} <ChevronRight size={12} /></span>
        </button>
      )}

      <div className="hub-stats">
        <div className="hub-stat-tile">
          <CheckCircle2 size={15} className="hub-stat-icon" />
          <div className="hub-stat-value">{completed.size}<small>/{CHAPTERS.length}</small></div>
          <div className="hub-stat-label">Checklist items complete</div>
        </div>
        <div className="hub-stat-tile hub-stat-tile--gauge">
          <Target size={15} className="hub-stat-icon" />
          <div className="hub-gauge">
            <AccuracyArc pct={quizAccuracy ?? 0} />
            <div className="hub-gauge-value">
              {quizAccuracy === null ? "—" : quizAccuracy}
              {quizAccuracy !== null && <small>%</small>}
            </div>
          </div>
          <div className="hub-stat-label">Quiz accuracy</div>
        </div>
        <div className="hub-stat-tile">
          <Flame size={15} className="hub-stat-icon hub-stat-icon--flame" />
          <div className="hub-stat-value">{streakDisplay}<small>d</small></div>
          <div className="hub-stat-label">Consecutive Days Flown</div>
          <div className="hub-stat-sub">Longest {longestStreak}d</div>
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
                <div className="hub-module-topline">
                  <div className="hub-module-chip-row">
                    <span className="hub-status-light is-standby" title="Standby" />
                    <div className="hub-module-chip hub-module-chip--locked"><Lock size={9} /> Standby</div>
                  </div>
                </div>
                <div className="hub-module-code">{m.code}</div>
                <div className="hub-module-name">{m.name}</div>
              </div>
            );
          }

          if (!isEnrolled) {
            return (
              <div key={m.code} className="hub-module-card hub-module-card--live" {...tiltProps}>
                <div className="hub-module-topline">
                  <div className="hub-module-chip-row">
                    <span className="hub-status-light is-standby" title="Not enrolled" />
                    <div className="hub-module-chip hub-module-chip--open">Open enrollment</div>
                  </div>
                </div>
                <div className="hub-module-code">{m.code}</div>
                <div className="hub-module-name">{m.name}</div>
                <button className="hub-module-enroll" onClick={() => handleEnroll(m.code)} disabled={enrolling === m.code}>
                  {enrolling === m.code ? "Enrolling…" : "Enroll"}
                </button>
              </div>
            );
          }

          const started = doneCount > 0;
          return (
            <div key={m.code} className="hub-module-card hub-module-card--live" {...tiltProps}>
              <div className="hub-module-topline">
                <div className="hub-module-chip-row">
                  <span
                    className={`hub-status-light ${started ? "is-live" : "is-ready"}`}
                    title={started ? "In progress" : "Enrolled, not started"}
                  />
                  <div className="hub-module-chip hub-module-chip--active">{started ? "In progress" : "Ready"}</div>
                </div>
                <ProgressRing pct={pct} />
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
                <button key={ch.id} className="hub-recent-item" onClick={() => onGoToChapter(moduleForChapter(ch).code, ch.id)}>
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
          --hub-surface: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white 4%) 0%, var(--panel) 100%);
          --hub-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.24), 0 10px 26px rgba(0,0,0,0.30);
          --hub-shadow-hover: inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 8px rgba(0,0,0,0.28), 0 18px 44px rgba(0,0,0,0.38);
          --hub-amber: #D4A03C;
          position: relative;
        }
        .app.theme-light .hub {
          --hub-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(22,32,46,0.06), 0 8px 20px rgba(22,32,46,0.08);
          --hub-shadow-hover: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 5px rgba(22,32,46,0.08), 0 16px 36px rgba(22,32,46,0.14);
          --hub-amber: #B07D1E;
        }
        /* Ambient light from the top-left, scoped to the Flight Deck only. */
        .hub::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(900px 620px at 10% -12%, color-mix(in srgb, var(--accent) 7%, transparent) 0%, transparent 62%);
        }
        .hub > * { position: relative; z-index: 1; }
        .hub-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin: 0 0 6px; }
        .hub-title { font-family: 'Space Grotesk', sans-serif; font-size: 26px; margin: 0 0 6px; color: var(--text); }
        .hub-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 20px; }

        /* --- Pre-flight briefing --- */
        .hub-briefing {
          position: relative; overflow: hidden;
          background: var(--hub-surface); border: 1px solid var(--border); border-radius: 14px;
          padding: 16px 18px; margin-bottom: 12px; box-shadow: var(--hub-shadow);
        }
        /* One-time needle sweep on load — runs once, never loops. */
        .hub-briefing-sweep {
          position: absolute; top: 0; bottom: 0; width: 1px; left: 0; pointer-events: none;
          background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--accent) 50%, transparent) 50%, transparent 100%);
          animation: hub-sweep 1.15s var(--hub-ease) 1 both;
        }
        @keyframes hub-sweep {
          from { left: 0%; opacity: 0; }
          12% { opacity: 1; }
          to { left: 100%; opacity: 0; }
        }
        .hub-briefing-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .hub-briefing-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin-bottom: 3px; }
        .hub-briefing-greet { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); }
        .hub-briefing-meta { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        .hub-briefing-dot { color: var(--muted2); }
        .hub-briefing-body { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .hub-briefing-chapter { flex: 1; min-width: 200px; }
        .hub-briefing-module { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); margin-bottom: 3px; }
        .hub-briefing-title { font-size: 13.5px; color: var(--text); margin-bottom: 8px; }
        .hub-briefing-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); margin-right: 4px; }
        .hub-briefing-bar { height: 4px; border-radius: 2px; background: var(--panel-alt); overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
        .hub-briefing-fill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.6s var(--hub-ease); }
        .hub-briefing-pct { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); margin-top: 5px; }
        .hub-briefing-cta {
          display: flex; align-items: center; gap: 5px; flex-shrink: 0;
          background: var(--accent); color: var(--on-accent); border: none; border-radius: 9px;
          padding: 9px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 9%, transparent);
          transition: background 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease), transform 0.2s var(--hub-ease);
        }
        .hub-briefing-cta:hover { background: var(--accent-hover); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 14%, transparent); }
        .hub-briefing-cta:active { transform: scale(0.97); transition-duration: 0.08s; }

        /* --- Smart suggestion --- */
        .hub-suggest {
          display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
          background: var(--hub-surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 11px 14px; margin-bottom: 24px; cursor: pointer; box-shadow: var(--hub-shadow);
          transition: transform 0.2s var(--hub-ease), border-color 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease);
        }
        .hub-suggest:hover { transform: translateY(-2px) scale(1.008); border-color: var(--border-hover); box-shadow: var(--hub-shadow-hover); }
        .hub-suggest:active { transform: translateY(0) scale(0.994); transition-duration: 0.08s; }
        .hub-suggest-icon { color: var(--accent); flex-shrink: 0; }
        .hub-suggest-body { flex: 1; min-width: 0; }
        .hub-suggest-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted2); margin-bottom: 2px; }
        .hub-suggest-title { font-size: 12.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hub-suggest-action { display: flex; align-items: center; gap: 3px; flex-shrink: 0; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); }

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
        .hub-stat-sub { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: var(--muted2); margin-top: 3px; }
        /* Accuracy tile: arc gauge sits behind the numeric readout. */
        .hub-stat-tile--gauge .hub-gauge { position: relative; display: flex; align-items: center; justify-content: center; height: 58px; }
        .hub-gauge-svg { position: absolute; inset: 0; margin: auto; }
        .hub-gauge-value { position: relative; z-index: 1; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 18px; color: var(--text); }
        .hub-gauge-value small { font-weight: 400; font-size: 10px; color: var(--muted2); }

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
        .hub-module-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .hub-module-chip-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
        /* Annunciator lights: the only status colour on the card. */
        .hub-status-light { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .hub-status-light.is-live { background: var(--good); box-shadow: 0 0 7px 1px color-mix(in srgb, var(--good) 35%, transparent); }
        .hub-status-light.is-ready { background: var(--hub-amber); box-shadow: 0 0 7px 1px color-mix(in srgb, var(--hub-amber) 30%, transparent); }
        .hub-status-light.is-standby { background: var(--muted2); opacity: 0.55; }
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
          background: radial-gradient(320px circle at var(--glow-x) var(--glow-y), color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%);
          opacity: var(--glow-o);
          transition: opacity 0.2s var(--hub-ease);
        }
        .hub-module-card--live:hover { --lift: -3px; --card-scale: 1.015; border-color: var(--border-hover); box-shadow: var(--hub-shadow-hover); }
        .hub-module-card--live:active { --lift: -1px; --card-scale: 0.985; transition-duration: 0.08s; }
        .hub-module-chip { align-self: flex-start; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 20px; display: flex; align-items: center; gap: 4px; }
        .hub-module-chip--active { background: var(--accent-soft); color: var(--accent); }
        .hub-module-chip--open { background: var(--panel-alt); color: var(--muted); border: 1px solid var(--border); }
        .hub-module-chip--locked { background: var(--panel-alt); color: var(--muted2); }
        .hub-module-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); margin-bottom: 3px; }
        .hub-module-name { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
        .hub-module-pips { display: flex; gap: 4px; margin-bottom: 12px; }
        .hub-pip { flex: 1; height: 4px; border-radius: 2px; background: var(--panel-alt); box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
        .hub-pip.is-done { background: var(--good); }
        .hub-module-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .hub-module-progress-text { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        /* Focal element: primary CTAs carry a low-opacity accent glow. */
        .hub-module-continue {
          display: flex; align-items: center; gap: 4px; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
          padding: 6px 11px; font-size: 11.5px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 9%, transparent);
          transition: background 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease), transform 0.2s var(--hub-ease);
        }
        .hub-module-continue:hover { background: var(--accent-hover); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 14%, transparent); }
        .hub-module-continue:active { transform: scale(0.96); transition-duration: 0.08s; }
        .hub-module-unenroll { align-self: flex-start; margin-top: 8px; background: transparent; border: none; color: var(--muted2); font-size: 10.5px; cursor: pointer; padding: 0; transition: color 0.2s var(--hub-ease); }
        .hub-module-unenroll:hover { color: var(--bad); }
        .hub-module-unenroll:disabled { opacity: 0.5; cursor: not-allowed; }
        .hub-module-enroll {
          margin-top: auto; background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px;
          padding: 8px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 9%, transparent);
          transition: background 0.2s var(--hub-ease), box-shadow 0.2s var(--hub-ease), transform 0.2s var(--hub-ease);
        }
        .hub-module-enroll:hover { background: var(--accent-hover); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 14%, transparent); }
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
        .hub-activity-item:hover { background: color-mix(in srgb, var(--panel) 94%, white 6%); }
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
        .app.reduce-motion .hub-suggest,
        .app.reduce-motion .hub-briefing-cta,
        .app.reduce-motion .hub-module-continue,
        .app.reduce-motion .hub-module-enroll { transform: none !important; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s; }
        .app.reduce-motion .hub-module-card--live::before { opacity: 0 !important; }
        .app.reduce-motion .hub-briefing-sweep { display: none; }
        .app.reduce-motion .hub-briefing-fill { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .hub-module-card--live, .hub-stat-tile, .hub-recent-item, .hub-suggest, .hub-briefing-cta, .hub-module-continue, .hub-module-enroll { transform: none !important; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, color 0.2s; }
          .hub-module-card--live::before { opacity: 0 !important; }
          .hub-briefing-sweep { display: none; }
          .hub-briefing-fill { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default HubPage;
