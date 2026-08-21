import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, Check, Lock, ThumbsUp, MessageSquareOff, Compass, BookMarked, Flame } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { useDisplayName } from "../lib/identity.js";
import { useIsAdmin } from "../lib/admin.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchRecentActivity, postComment, toggleReaction } from "../lib/comments.js";

// Needle travel: 240 degrees, swept symmetrically about vertical.
const DIAL_START_DEG = -120;
const DIAL_SWEEP_DEG = 240;
// Cyclable dial: auto-advance cadence, and how long a manual interaction wins.
const DATA_PAGE_MS = 4000;
const DATA_PAUSE_MS = 9000;
// Streak is shown as a ratio of a weekly goal so it has something to fill against.
const STREAK_GOAL_DAYS = 7;
// Horizon travel limits, kept small so the instrument reads alive rather than loose.
const TILT_MAX_DEG = 11;
const TILT_MAX_SHIFT = 9;

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
  const code = String(chapter?.code || "").split(".")[0];
  return MODULES.find((m) => m.code === code) || MODULES[0];
}

// Only JT has authored chapters today; every other module is legitimately empty
// until its content is built.
function chaptersForModule(moduleCode) {
  return moduleCode === "JT" ? CHAPTERS : [];
}

// Same formula ChaptersPanel uses, so a chapter reads identically in both places.
function chapterPct(chapter, chapterProgress, completed) {
  if (!chapter) return 0;
  if (completed.has(chapter.id)) return 100;
  const seen = chapterProgress[chapter.id] || 0;
  const total = chapter.questions?.length || 0;
  if (!total) return 0;
  return Math.min(100, Math.round((seen / total) * 100));
}

// Deterministic avatar tint, matching DiscussPanel so one person reads the
// same colour everywhere in the app.
function nameToGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 60%, 42%), hsl(${(hue + 45) % 360}, 60%, 32%))`;
}

function degForPct(pct) {
  return DIAL_START_DEG + (Math.max(0, Math.min(100, pct)) / 100) * DIAL_SWEEP_DEG;
}

// Quartile marks only — five ticks, not a ring of clutter.
const QUARTILE_TICKS = [0, 25, 50, 75, 100];

function Ticks({ marks = QUARTILE_TICKS }) {
  return (
    <>
      {marks.map((m) => (
        <div key={m} className="fd-tickwrap" style={{ transform: `rotate(${degForPct(m)}deg)` }}>
          <div className={`fd-tick ${m === 0 || m === 100 ? "fd-tick--major" : ""}`} />
        </div>
      ))}
    </>
  );
}

// Thin completion arc riding the dial's edge. Used by the two needle-less dials.
function EdgeRing({ size, pct, quiet = false }) {
  const stroke = 3;
  const r = size / 2 - stroke / 2 - 1;
  const circumference = 2 * Math.PI * r;
  // Match the needle dials' 240-degree sweep so the cluster reads as one family.
  const arcLen = circumference * (DIAL_SWEEP_DEG / 360);
  const filled = arcLen * (Math.max(0, Math.min(100, pct)) / 100);
  const common = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: "none",
    strokeWidth: stroke,
    strokeLinecap: "round",
    transform: `rotate(${90 + DIAL_START_DEG} ${size / 2} ${size / 2})`,
  };
  return (
    <svg className="fd-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle {...common} stroke="var(--fd-ring-track)" strokeDasharray={`${arcLen} ${circumference}`} />
      {!quiet && (
        <circle
          {...common}
          stroke="var(--accent)"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      )}
    </svg>
  );
}

// Left dial: attitude indicator. Horizon reads whole-module progress via the
// edge ring; the horizon itself is motion-reactive but carries no data.
function AttitudeDial({ size, pct, motionRef }) {
  return (
    <div className="fd-shell" style={{ width: size, height: size }}>
      <div className="fd-bezel" />
      <div className="fd-face" style={{ width: size, height: size }}>
        <div className="fd-horizon-layer" ref={motionRef}>
          <div className="fd-horizon-inner">
            <div className="fd-sky" />
            <div className="fd-ground" />
            <div className="fd-horizon-line" />
          </div>
        </div>
        <Ticks />
        <div className="fd-vignette" />
        <div className="fd-glass" />
      </div>
      <EdgeRing size={size} pct={pct} />
      <div className="fd-overlay">
        <div className="fd-readout fd-readout--sm">
          <span className="fd-value" style={{ fontSize: 15 }}>
            {pct}
            <small>%</small>
          </span>
        </div>
      </div>
    </div>
  );
}

// Centre dial: airspeed-style face with the one needle in the cluster.
function ChapterDial({ size, pct }) {
  return (
    <div className="fd-shell" style={{ width: size, height: size }}>
      <div className="fd-bezel" />
      <div className="fd-face fd-face--instrument" style={{ width: size, height: size }}>
        <Ticks />
        <div className="fd-arcmark" />
        <div className="fd-needle-wrap">
          <div className="fd-needle" style={{ transform: `translateX(-50%) rotate(${degForPct(pct)}deg)` }} />
        </div>
        <div className="fd-hub" />
        <div className="fd-vignette" />
        <div className="fd-glass" />
      </div>
      <div className="fd-overlay fd-overlay--low">
        <div className="fd-readout">
          <span className="fd-value" style={{ fontSize: 20 }}>
            {pct}
            <small>%</small>
          </span>
        </div>
      </div>
    </div>
  );
}

// Right dial: pages through whatever else is worth reading. Ring goes quiet for
// pages that aren't naturally a ratio.
function DataDial({ size, page, pageIndex }) {
  return (
    <div className="fd-shell" style={{ width: size, height: size }}>
      <div className="fd-bezel" />
      <div className="fd-face fd-face--instrument" style={{ width: size, height: size }}>
        <Ticks />
        <div className="fd-vignette" />
        <div className="fd-glass" />
      </div>
      <EdgeRing size={size} pct={page.percent ?? 0} quiet={page.percent == null} />
      <div className="fd-overlay">
        <div key={pageIndex} className="fd-data-content">
          {page.percent == null ? (
            <span className="fd-data-text">{page.display}</span>
          ) : (
            <span className="fd-value" style={{ fontSize: 16 }}>
              {page.display}
              {page.unit ? <small>{page.unit}</small> : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HubPage({ activeModuleCode, onEnterModule, onGoToChapter, onGoToDiscuss, onReviewBookmarks, onSignIn, streak = 0 }) {
  const { isSignedIn, user } = useUser();
  const progress = useUserProgress();
  const displayName = useDisplayName();
  const isAdmin = useIsAdmin();

  const [enrolledCodes, setEnrolledCodes] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [feedScope, setFeedScope] = useState("module");
  const [reacted, setReacted] = useState(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [dataPageIndex, setDataPageIndex] = useState(0);
  const [needsMotionPermission, setNeedsMotionPermission] = useState(false);

  const pausedUntil = useRef(0);
  const horizonRef = useRef(null);
  const motionEnabled = useRef(false);

  const completed = new Set(progress.get("pw-completed", []));
  const quizScores = progress.get("pw-quiz-scores", {});
  const bookmarkIds = progress.get("pw-bookmarks", []);
  const bookmarkCount = bookmarkIds.length;
  const recentChapterIds = progress.get("pw-recent-chapters", []);
  const chapterProgress = progress.get("pw-chapter-progress", {});
  const viewedIds = new Set(progress.get("pw-viewed-chapters", []));
  const reduceMotion = progress.get("pw-reduce-motion", false);
  const lastChapterId = progress.get("pw-last-chapter", null);

  const scoreValues = Object.values(quizScores);
  const quizAccuracy = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  // ---- what the hero is about -------------------------------------------------
  const currentChapter =
    CHAPTERS.find((ch) => ch.id === lastChapterId) ||
    CHAPTERS.find((ch) => ch.id === recentChapterIds[0]) ||
    CHAPTERS.find((ch) => !completed.has(ch.id)) ||
    CHAPTERS[0];
  const heroModule = moduleForChapter(currentChapter) || MODULES.find((m) => m.status === "active") || MODULES[0];
  const heroChapters = chaptersForModule(heroModule.code);
  const chapterPercent = chapterPct(currentChapter, chapterProgress, completed);
  const modulePercent = heroChapters.length
    ? Math.round(heroChapters.reduce((sum, ch) => sum + chapterPct(ch, chapterProgress, completed), 0) / heroChapters.length)
    : 0;
  const currentIndex = heroChapters.findIndex((ch) => ch.id === currentChapter?.id);
  const nextChapter = heroChapters.slice(currentIndex + 1).find((ch) => !completed.has(ch.id)) || null;

  // Only pages backed by real data are offered — no padded or invented readings.
  const dataPages = [];
  if (quizAccuracy !== null) dataPages.push({ label: "Quiz Accuracy", display: quizAccuracy, unit: "%", percent: quizAccuracy });
  if (streak > 0)
    dataPages.push({
      label: "Study Streak",
      display: streak,
      unit: "d",
      percent: Math.min(100, Math.round((streak / STREAK_GOAL_DAYS) * 100)),
    });
  if (bookmarkCount > 0) dataPages.push({ label: "Bookmarked", display: bookmarkCount, unit: "", percent: null });
  if (nextChapter) dataPages.push({ label: "Next Checkpoint", display: nextChapter.code, unit: "", percent: null });
  if (!dataPages.length) dataPages.push({ label: "Standby", display: "No data yet", unit: "", percent: null });
  const safePageIndex = dataPageIndex % dataPages.length;
  const dataPage = dataPages[safePageIndex];

  useEffect(() => {
    if (!progress.loaded) return;
    if (isSignedIn && user) {
      fetchEnrollments(user.id).then(setEnrolledCodes);
    } else {
      setEnrolledCodes([]);
    }
  }, [progress.loaded, isSignedIn, user?.id]);

  useEffect(() => {
    fetchRecentActivity(30).then((data) => {
      setActivity(data);
      setActivityLoading(false);
    });
  }, []);

  // ---- cyclable dial ----------------------------------------------------------
  useEffect(() => {
    // Smooth Air: no unattended movement. The dots and arrows still page it.
    if (reduceMotion || dataPages.length < 2) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setDataPageIndex((i) => i + 1);
    }, DATA_PAGE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion, dataPages.length]);

  const goToDataPage = (i) => {
    pausedUntil.current = Date.now() + DATA_PAUSE_MS;
    setDataPageIndex(((i % dataPages.length) + dataPages.length) % dataPages.length);
  };

  // ---- horizon motion ---------------------------------------------------------
  // Written straight to the node so a mousemove or a tilt event never costs a
  // React render.
  const applyTilt = useCallback((deg, shift) => {
    const node = horizonRef.current;
    if (!node) return;
    node.style.transform = `rotate(${deg}deg) translateY(${shift}px)`;
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      applyTilt(0, 0);
      return;
    }
    const onOrientation = (e) => {
      // Desktop browsers define DeviceOrientationEvent but have no sensor, so
      // the event either never fires or arrives with null angles. Only a reading
      // with real values proves a sensor exists and should take over from the
      // cursor — flagging that at listener-registration time left desktop with
      // neither input driving the horizon.
      if (e.gamma == null && e.beta == null) return;
      motionEnabled.current = true;
      const gamma = Math.max(-30, Math.min(30, e.gamma || 0));
      const beta = Math.max(-30, Math.min(30, (e.beta || 0) - 45));
      applyTilt(gamma * 0.5, beta * 0.35);
    };
    const onMouseMove = (e) => {
      if (motionEnabled.current) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      applyTilt(nx * TILT_MAX_DEG, ny * TILT_MAX_SHIFT);
    };

    const hasOrientation = typeof window.DeviceOrientationEvent !== "undefined";
    const needsPermission = hasOrientation && typeof window.DeviceOrientationEvent.requestPermission === "function";
    setNeedsMotionPermission(needsPermission);
    if (hasOrientation && !needsPermission) {
      window.addEventListener("deviceorientation", onOrientation);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.__wingmanOrientationHandler = onOrientation;
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("mousemove", onMouseMove);
      delete window.__wingmanOrientationHandler;
    };
  }, [reduceMotion, applyTilt]);

  const requestMotion = () => {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE || typeof DOE.requestPermission !== "function") return;
    DOE.requestPermission()
      .then((state) => {
        if (state === "granted" && window.__wingmanOrientationHandler) {
          window.addEventListener("deviceorientation", window.__wingmanOrientationHandler);
        }
        setNeedsMotionPermission(false);
      })
      .catch(() => setNeedsMotionPermission(false));
  };

  // ---- enrollment -------------------------------------------------------------
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

  // ---- checklist --------------------------------------------------------------
  // Derived from what a chapter actually has: one clip and its question set.
  const toggleViewed = (chapterId) => {
    const next = new Set(viewedIds);
    next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
    progress.set("pw-viewed-chapters", [...next]);
  };

  const toggleCompleted = (chapterId) => {
    const next = new Set(completed);
    next.has(chapterId) ? next.delete(chapterId) : next.add(chapterId);
    progress.set("pw-completed", [...next]);
  };

  const checklist = currentChapter
    ? [
        {
          id: `${currentChapter.id}-watch`,
          label: `Watch: ${currentChapter.title}`,
          done: viewedIds.has(currentChapter.id),
          toggle: () => toggleViewed(currentChapter.id),
        },
        {
          id: `${currentChapter.id}-quiz`,
          label: `Quiz: ${currentChapter.questions?.length || 0} questions`,
          done: completed.has(currentChapter.id),
          toggle: () => toggleCompleted(currentChapter.id),
        },
      ]
    : [];

  // ---- feed -------------------------------------------------------------------
  const heroChapterIds = new Set(heroChapters.map((ch) => ch.id));
  const scopedActivity = activity.filter((c) => (feedScope === "module" ? c.chapter_id && heroChapterIds.has(c.chapter_id) : true));

  const handleLike = async (comment) => {
    const key = `${comment.id}-thumbsUp`;
    const already = reacted.has(key);
    // toggleReaction indexes reactions directly, so hand it a normalised object.
    const safe = { ...comment, reactions: { ...(comment.reactions || {}), thumbsUp: comment.reactions?.thumbsUp || 0 } };
    const nextReactions = await toggleReaction(safe, "thumbsUp", already);
    setActivity((cs) => cs.map((c) => (c.id === comment.id ? { ...c, reactions: nextReactions } : c)));
    setReacted((r) => {
      const next = new Set(r);
      already ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const submitPost = async () => {
    const text = draft.trim();
    if (!text || !isSignedIn) return;
    setPosting(true);
    const created = await postComment(null, displayName, text, user.id, null, user.fullName || null, isAdmin);
    setPosting(false);
    if (created) {
      setActivity((cs) => [created, ...cs]);
      setDraft("");
      setComposerOpen(false);
      // A Discussion post is out of module scope, so show where it landed.
      setFeedScope("all");
    }
  };

  const directoryModules = MODULES.filter((m) => m.code !== heroModule.code);

  return (
    <div className="fd">
      <div className="pagehead">
        <p className="fd-eyebrow">Aviation Fundamentals</p>
        <h1 className="fd-title">Flight Deck</h1>
        <p className="fd-sub">Your modules, your progress, all in one place.</p>
      </div>

      {/* ---- hero: the one element allowed to glow ---- */}
      <div className="fd-hero-wrap">
        <div className="fd-hero-glow" aria-hidden="true" />
        <div className="fd-hero">
          <div className="fd-hero-top">
            <div>
              <p className="fd-eyebrow">Currently Flying</p>
              <div className="fd-hero-title">{heroModule.name}</div>
            </div>
            <div className="fd-hero-chips">
              {streak > 0 && (
                <span className="fd-quiet-chip">
                  <Flame size={12} /> {streak}d streak
                </span>
              )}
              {bookmarkCount > 0 && (
                <button className="fd-quiet-chip fd-quiet-chip--btn" onClick={onReviewBookmarks}>
                  <BookMarked size={12} /> {bookmarkCount} saved
                </button>
              )}
              {needsMotionPermission && (
                <button className="fd-motion-btn" onClick={requestMotion}>
                  <Compass size={12} /> Enable Motion
                </button>
              )}
            </div>
          </div>

          <div className="fd-cluster">
            <div className="fd-dial-row">
              <div className="fd-dial-col">
                <AttitudeDial size={116} pct={modulePercent} motionRef={horizonRef} />
                <div className="fd-dial-label">Module</div>
              </div>

              <div className="fd-dial-col fd-dial-col--center">
                <ChapterDial size={168} pct={chapterPercent} />
                <div className="fd-dial-label">Current Chapter</div>
              </div>

              <div className="fd-dial-col">
                <div className="fd-data-wrap">
                  {dataPages.length > 1 && (
                    <button className="fd-data-arrow" onClick={() => goToDataPage(safePageIndex - 1)} aria-label="Previous reading">
                      <ChevronLeft size={13} />
                    </button>
                  )}
                  <DataDial size={116} page={dataPage} pageIndex={safePageIndex} />
                  {dataPages.length > 1 && (
                    <button className="fd-data-arrow" onClick={() => goToDataPage(safePageIndex + 1)} aria-label="Next reading">
                      <ChevronRight size={13} />
                    </button>
                  )}
                </div>
                <div className="fd-dial-label">{dataPage.label}</div>
                {dataPages.length > 1 && (
                  <div className="fd-data-dots">
                    {dataPages.map((p, i) => (
                      <button
                        key={p.label}
                        className={`fd-data-dot ${i === safePageIndex ? "is-active" : ""}`}
                        onClick={() => goToDataPage(i)}
                        aria-label={p.label}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="fd-divider" />

          {currentChapter && (
            <>
              <div className="fd-lesson-row">
                <div>
                  <div className="fd-lesson-label">Current Lesson</div>
                  <div className="fd-lesson-title">
                    {currentChapter.code} — {currentChapter.title}
                  </div>
                </div>
                <div className="fd-lesson-pct">{chapterPercent}% through this chapter</div>
              </div>

              <div className="fd-checklist">
                {checklist.map((row) => (
                  <button key={row.id} className="fd-check-row" onClick={row.toggle}>
                    <span className={`fd-check-box ${row.done ? "is-done" : ""}`}>{row.done && <Check size={10} />}</span>
                    <span className={`fd-check-text ${row.done ? "is-done" : ""}`}>{row.label}</span>
                  </button>
                ))}
              </div>

              <div className="fd-hero-actions">
                <div className="fd-next-up">
                  <div className="fd-next-up-label">Next Up</div>
                  <div className="fd-next-up-title">{nextChapter ? `${nextChapter.code} — ${nextChapter.title}` : "Module complete"}</div>
                </div>
                <button className="fd-resume" onClick={() => onGoToChapter(currentChapter.id)}>
                  Resume Flight <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- modules directory ---- */}
      <section className="fd-section">
        <h2 className="fd-h2">Modules</h2>
        <p className="fd-section-sub">Everything in the syllabus, flying or not.</p>

        <div className="fd-active-strip fd-surface">
          <div className="fd-active-strip-left">
            <span className="fd-flying-badge">Currently Flying</span>
            <span className="fd-active-strip-name">{heroModule.name}</span>
            <span className="fd-active-strip-meta">{modulePercent}%</span>
          </div>
          <button className="fd-view-hero" onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })}>
            View flight deck
          </button>
        </div>

        <div className="fd-module-grid">
          {directoryModules.map((m) => {
            const isEnrolled = enrolledCodes.includes(m.code);
            const locked = m.status !== "active";
            return (
              <div key={m.code} className="fd-module-card fd-surface">
                <div className="fd-module-code">{m.code}</div>
                <div className="fd-module-name">{m.name}</div>
                {locked ? (
                  <>
                    <div className="fd-lock-row">
                      <Lock size={11} />
                      <span className="fd-lock-note">Unlocks at 100% {heroModule.name}</span>
                    </div>
                    <div className="fd-unlock-track">
                      <div className="fd-unlock-fill" style={{ width: `${modulePercent}%` }} />
                    </div>
                  </>
                ) : isEnrolled ? (
                  <>
                    <button className="fd-module-btn" onClick={() => onEnterModule(m)}>
                      Continue
                    </button>
                    <button className="fd-module-unenroll" onClick={() => handleUnenroll(m.code)} disabled={enrolling === m.code}>
                      {enrolling === m.code ? "Unenrolling…" : "Unenroll"}
                    </button>
                  </>
                ) : (
                  <button className="fd-module-btn" onClick={() => handleEnroll(m.code)} disabled={enrolling === m.code}>
                    {enrolling === m.code ? "Enrolling…" : "Enroll"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- telemetry feed ---- */}
      <section className="fd-section">
        <div className="fd-feed-head">
          <h2 className="fd-h2">Telemetry Feed</h2>
          <div className="fd-feed-controls">
            <div className="fd-scope-toggle">
              <button className={`fd-scope-btn ${feedScope === "module" ? "is-active" : ""}`} onClick={() => setFeedScope("module")}>
                This Module
              </button>
              <button className={`fd-scope-btn ${feedScope === "all" ? "is-active" : ""}`} onClick={() => setFeedScope("all")}>
                All Activity
              </button>
            </div>
            <button className="fd-ask-btn" onClick={() => (isSignedIn ? setComposerOpen((o) => !o) : onSignIn())}>
              Ask the Crew
            </button>
          </div>
        </div>

        {composerOpen && (
          <div className="fd-composer fd-surface">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask the crew a question…"
              rows={3}
            />
            <div className="fd-composer-actions">
              <button className="fd-composer-cancel" onClick={() => setComposerOpen(false)}>
                Cancel
              </button>
              <button className="fd-composer-post" onClick={submitPost} disabled={posting || !draft.trim()}>
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}

        <div className="fd-feed-list">
          {activityLoading ? (
            <div className="fd-empty fd-surface">Reading telemetry…</div>
          ) : scopedActivity.length === 0 ? (
            <div className="fd-empty fd-surface">
              <MessageSquareOff size={20} className="fd-empty-icon" />
              <span>{feedScope === "module" ? "No telemetry from this module yet." : "No telemetry received yet."}</span>
              <button className="fd-empty-link" onClick={onGoToDiscuss}>
                Open discussion
              </button>
            </div>
          ) : (
            scopedActivity.map((c) => {
              const chapter = c.chapter_id ? CHAPTERS.find((ch) => ch.id === c.chapter_id) : null;
              const context = chapter ? `${chapter.code} — ${chapter.title}` : "Discussion";
              const author = c.author || "Unknown";
              const liked = reacted.has(`${c.id}-thumbsUp`);
              return (
                <div key={c.id} className="fd-feed-item fd-surface">
                  <div className="fd-feed-avatar-wrap">
                    <div className="fd-feed-avatar-glow" style={{ background: nameToGradient(author) }} aria-hidden="true" />
                    <div className="fd-feed-avatar" style={{ background: nameToGradient(author) }}>
                      {author.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="fd-feed-body">
                    <div className="fd-feed-line">
                      <b>{author}</b> in <span className="fd-feed-tag">{context}</span>
                    </div>
                    {c.text && <div className="fd-feed-text">{c.text}</div>}
                    <div className="fd-feed-meta">{timeAgo(c.created_at)}</div>
                    <div className="fd-feed-actions">
                      <button className={`fd-feed-action ${liked ? "is-liked" : ""}`} onClick={() => handleLike(c)} disabled={!isSignedIn}>
                        <ThumbsUp size={13} /> {c.reactions?.thumbsUp || 0}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <style>{`
        .fd { --fd-ease: cubic-bezier(0.22, 1, 0.36, 1);
              --fd-surface: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white 4%) 0%, var(--panel) 100%);
              /* Instrument surface, derived from the active theme. Every detail on
                 the face (ticks, bezel, glass, vignette, readout plate) is a token
                 so Day Ops re-tones the whole dial instead of only its fill.
                 Accent-coloured parts stay on var(--accent) and follow the
                 user's chosen livery. */
              --fd-face-1: color-mix(in srgb, var(--panel) 80%, white 20%);
              --fd-face-2: color-mix(in srgb, var(--bg) 88%, black 12%);
              --fd-tick: rgba(255,255,255,0.55);
              --fd-tick-major: rgba(255,255,255,0.8);
              --fd-bezel-hi: rgba(255,255,255,0.42); --fd-bezel-mid: rgba(255,255,255,0.24); --fd-bezel-lo: rgba(255,255,255,0.03);
              --fd-vignette: rgba(0,0,0,0.5);
              --fd-glass-hi: rgba(255,255,255,0.22); --fd-glass-mid: rgba(255,255,255,0.05);
              --fd-ring-track: rgba(255,255,255,0.09);
              --fd-plate-bg: rgba(6,12,24,0.55); --fd-plate-border: rgba(255,255,255,0.08); --fd-plate-text: #fff;
              --fd-hub-1: #ffffff; --fd-hub-2: #d6dce6; --fd-hub-3: #788294;
              --fd-face-shadow: rgba(0,0,0,0.5); --fd-face-inset: rgba(0,0,0,0.4);
              --fd-arcmark: rgba(255,255,255,0.06);
              --fd-horizon-dim: saturate(0.72) brightness(0.7); }
        /* Day Ops: the same instrument, lit rather than inverted. */
        .app.theme-light .fd {
              --fd-face-1: #ffffff;
              --fd-face-2: color-mix(in srgb, var(--bg) 82%, black 4%);
              --fd-tick: rgba(22,32,46,0.42);
              --fd-tick-major: rgba(22,32,46,0.68);
              --fd-bezel-hi: rgba(22,32,46,0.22); --fd-bezel-mid: rgba(22,32,46,0.12); --fd-bezel-lo: rgba(255,255,255,0.5);
              --fd-vignette: rgba(22,32,46,0.16);
              --fd-glass-hi: rgba(255,255,255,0.75); --fd-glass-mid: rgba(255,255,255,0.2);
              --fd-ring-track: rgba(22,32,46,0.13);
              --fd-plate-bg: rgba(255,255,255,0.82); --fd-plate-border: rgba(22,32,46,0.12); --fd-plate-text: var(--text);
              --fd-hub-1: #ffffff; --fd-hub-2: #c3ccda; --fd-hub-3: #6b7789;
              --fd-face-shadow: rgba(22,32,46,0.18); --fd-face-inset: rgba(22,32,46,0.10);
              --fd-arcmark: rgba(22,32,46,0.08);
              --fd-horizon-dim: saturate(0.85) brightness(0.95); }
        .fd-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
        .fd-title { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; margin: 0 0 6px; color: var(--text); }
        .fd-sub { color: var(--muted); font-size: 14px; margin: 0; }

        /* ---- hero ---- */
        .fd-hero-wrap { position: relative; margin-top: 30px; }
        .fd-hero-glow { position: absolute; inset: -80px; z-index: 0; pointer-events: none;
          background: radial-gradient(58% 58% at 50% 42%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 74%);
          filter: blur(42px); animation: fdHeroPulse 6s ease-in-out infinite; }
        @keyframes fdHeroPulse { 0%, 100% { opacity: 0.72; transform: scale(1); } 50% { opacity: 1; transform: scale(1.035); } }
        .fd-hero { position: relative; z-index: 1; padding: 30px 32px 26px; border-radius: 16px;
          background: var(--fd-surface); border: 1px solid var(--border);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px rgba(0,0,0,0.30); }
        .fd-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .fd-hero-title { font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; color: var(--text); margin-top: 4px; }
        .fd-hero-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .fd-quiet-chip { display: flex; align-items: center; gap: 6px; color: var(--muted); border-radius: 20px; padding: 5px 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px; white-space: nowrap; background: none; border: none; }
        .fd-quiet-chip--btn { cursor: pointer; }
        .fd-quiet-chip--btn:hover { color: var(--text); }
        .fd-motion-btn { display: flex; align-items: center; gap: 6px; color: var(--accent); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); border-radius: 20px; padding: 5px 11px; font-family: 'JetBrains Mono', monospace; font-size: 11px; cursor: pointer; }
        .fd-motion-btn:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }

        /* ---- dial cluster ---- */
        .fd-cluster { margin: 26px 0 6px; display: flex; justify-content: center; }
        .fd-dial-row { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; }
        .fd-dial-col { display: flex; flex-direction: column; align-items: center; gap: 9px; }
        .fd-dial-col--center { z-index: 2; }
        .fd-shell { position: relative; flex-shrink: 0; }
        .fd-bezel { position: absolute; inset: -7px; border-radius: 50%;
          background: conic-gradient(from 220deg, var(--fd-bezel-hi), var(--fd-bezel-lo) 32%, var(--fd-bezel-mid) 62%, var(--fd-bezel-lo) 100%);
          -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px));
          mask: radial-gradient(closest-side, transparent calc(100% - 7px), black calc(100% - 7px)); }
        .fd-face { position: relative; border-radius: 50%; overflow: hidden;
          box-shadow: 0 16px 32px var(--fd-face-shadow), inset 0 0 22px var(--fd-face-inset); }
        .fd-face--instrument { background: radial-gradient(circle at 34% 26%, var(--fd-face-1) 0%, var(--fd-face-2) 70%); }
        /* Oversized so rotation never exposes a corner; rotating about its own
           centre keeps the horizon pivoting on the dial's centre. */
        /* Held back so the supporting dial never out-shouts the centre one. */
        .fd-horizon-layer { position: absolute; left: -50%; top: -50%; width: 200%; height: 200%; transition: transform 0.08s linear; filter: var(--fd-horizon-dim); }
        .fd-horizon-inner { position: absolute; inset: 0; }
        .fd-sky { position: absolute; left: 0; right: 0; top: 0; height: 50%; background: linear-gradient(180deg, #8fbdf3 0%, #4d84c9 65%, #3a689f 100%); }
        .fd-ground { position: absolute; left: 0; right: 0; top: 50%; bottom: 0; background: linear-gradient(180deg, #b07f4b 0%, #8a5a30 55%, #5c3a1e 100%); }
        .fd-horizon-line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: rgb(240,244,248); box-shadow: 0 0 6px rgba(255,255,255,0.6); }
        .fd-vignette { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 50% 50%, transparent 52%, var(--fd-vignette) 100%); }
        .fd-glass { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: linear-gradient(128deg, var(--fd-glass-hi) 0%, var(--fd-glass-mid) 26%, transparent 42%); }
        .fd-tickwrap { position: absolute; inset: 0; }
        .fd-tick { position: absolute; left: 50%; top: 5%; width: 2px; height: 5%; border-radius: 1px; background: var(--fd-tick); transform: translateX(-50%); }
        .fd-tick--major { height: 7%; background: var(--fd-tick-major); }
        .fd-arcmark { position: absolute; inset: 9%; border-radius: 50%; border: 1px solid var(--fd-arcmark); }
        .fd-ring { position: absolute; inset: 0; pointer-events: none; }

        /* liquid-glass needle: translucent, internally blurred, one bright edge */
        .fd-needle-wrap { position: absolute; inset: 0; }
        .fd-needle { position: absolute; left: 50%; bottom: 50%; width: 13px; height: 38%; transform-origin: 50% 100%;
          background: linear-gradient(100deg,
            color-mix(in srgb, var(--accent) 35%, white) 0%,
            color-mix(in srgb, var(--accent) 90%, white 10%) 34%,
            var(--accent) 66%,
            color-mix(in srgb, var(--accent) 55%, black 45%) 100%);
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          opacity: 0.86;
          -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
          filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55));
          transition: transform 0.8s var(--fd-ease); }
        .fd-needle::after { content: ""; position: absolute; left: 46%; top: 4%; width: 1.5px; height: 92%; border-radius: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.10)); }
        .fd-hub { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%,-50%);
          background: radial-gradient(circle at 34% 28%, var(--fd-hub-1) 0%, var(--fd-hub-2) 35%, var(--fd-hub-3) 100%);
          box-shadow: 0 0 0 3px var(--fd-face-2), 0 2px 4px rgba(0,0,0,0.55); }

        .fd-overlay { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
        .fd-overlay--low { justify-content: flex-end; padding-bottom: 13%; }
        .fd-readout { display: inline-flex; align-items: center; justify-content: center; background: var(--fd-plate-bg); border: 1px solid var(--fd-plate-border); border-radius: 8px; padding: 3px 11px; -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
        .fd-readout--sm { padding: 2px 8px; }
        .fd-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: var(--fd-plate-text); line-height: 1; text-shadow: 0 1px 0 rgba(255,255,255,0.15), 0 3px 10px rgba(0,0,0,0.6); }
        .fd-value small { font-family: 'JetBrains Mono', monospace; opacity: 0.8; font-size: 0.62em; margin-left: 1px; }
        .fd-data-content { display: flex; align-items: center; justify-content: center; animation: fdFade 0.42s var(--fd-ease); }
        @keyframes fdFade { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .fd-data-text { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text-soft); text-align: center; max-width: 84px; line-height: 1.35; }
        .fd-dial-label { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: center; }
        .fd-data-wrap { display: flex; align-items: center; gap: 8px; }
        .fd-data-arrow { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--muted); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; }
        .fd-data-arrow:hover { color: var(--text); background: rgba(255,255,255,0.08); }
        .fd-data-dots { display: flex; gap: 5px; }
        .fd-data-dot { width: 5px; height: 5px; padding: 0; border-radius: 50%; border: none; background: var(--border); cursor: pointer; }
        .fd-data-dot.is-active { background: var(--accent); box-shadow: 0 0 5px color-mix(in srgb, var(--accent) 70%, transparent); }

        .fd-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 24px 0 20px; }
        .fd-lesson-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .fd-lesson-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
        .fd-lesson-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: var(--text); margin-top: 3px; }
        .fd-lesson-pct { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
        .fd-checklist { display: flex; flex-direction: column; }
        .fd-check-row { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-soft); padding: 9px 2px; text-align: left; cursor: pointer; }
        .fd-check-row:last-child { border-bottom: none; }
        .fd-check-row:hover .fd-check-text { color: var(--text); }
        .fd-check-box { flex-shrink: 0; width: 16px; height: 16px; border-radius: 5px; border: 1px solid var(--border-hover); display: flex; align-items: center; justify-content: center; color: var(--on-accent); }
        .fd-check-box.is-done { background: var(--accent); border-color: var(--accent); }
        .fd-check-text { font-size: 13.5px; color: var(--text-soft); }
        .fd-check-text.is-done { color: var(--muted2); text-decoration: line-through; }
        .fd-hero-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
        .fd-next-up { display: flex; flex-direction: column; gap: 2px; }
        .fd-next-up-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
        .fd-next-up-title { font-size: 13px; color: var(--accent-hover); }
        .fd-resume { display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: var(--on-accent); border: none; border-radius: 10px; padding: 12px 18px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; cursor: pointer; box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 25%, transparent); transition: background 0.2s var(--fd-ease), transform 0.2s var(--fd-ease); }
        .fd-resume:hover { background: var(--accent-hover); }
        .fd-resume:active { transform: scale(0.97); transition-duration: 0.08s; }

        /* ---- calm surfaces below the hero ---- */
        .fd-surface { background: color-mix(in srgb, var(--panel) 55%, transparent); border: 1px solid var(--border-soft); border-radius: 14px; transition: border-color 0.15s ease, background 0.15s ease; }
        .fd-surface:hover { border-color: var(--border); background: color-mix(in srgb, var(--panel) 80%, transparent); }
        .fd-section { margin-top: 42px; }
        .fd-h2 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 6px; }
        .fd-section-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 16px; }
        .fd-active-strip { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 16px; margin-bottom: 14px; flex-wrap: wrap; }
        .fd-active-strip-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fd-flying-badge { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--good); background: color-mix(in srgb, var(--good) 12%, transparent); border-radius: 20px; padding: 3px 9px; white-space: nowrap; }
        .fd-active-strip-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: var(--text); }
        .fd-active-strip-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
        .fd-view-hero { font-size: 12.5px; color: var(--accent); background: none; border: none; cursor: pointer; white-space: nowrap; }
        .fd-module-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        @media (max-width: 720px) { .fd-module-grid { grid-template-columns: 1fr; } }
        .fd-module-card { padding: 17px; display: flex; flex-direction: column; gap: 9px; }
        .fd-module-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); }
        .fd-module-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15.5px; color: var(--text); }
        .fd-module-btn { align-self: flex-start; margin-top: 4px; background: var(--accent-soft); color: var(--accent); border: none; border-radius: 8px; padding: 7px 12px; font-weight: 600; font-size: 12px; cursor: pointer; }
        .fd-module-btn:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
        .fd-module-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fd-module-unenroll { align-self: flex-start; background: none; border: none; color: var(--muted2); font-size: 10.5px; cursor: pointer; padding: 0; }
        .fd-module-unenroll:hover { color: var(--bad); }
        .fd-lock-row { display: flex; align-items: center; gap: 8px; color: var(--muted2); }
        .fd-lock-note { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        .fd-unlock-track { height: 4px; border-radius: 3px; background: var(--panel-alt); overflow: hidden; margin-top: 2px; }
        .fd-unlock-fill { height: 100%; background: var(--muted2); border-radius: 3px; transition: width 0.7s var(--fd-ease); }

        /* ---- feed ---- */
        .fd-feed-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .fd-feed-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fd-scope-toggle { display: flex; gap: 4px; background: var(--panel-alt); border-radius: 9px; padding: 3px; }
        .fd-scope-btn { background: none; border: none; padding: 6px 11px; border-radius: 7px; font-size: 12px; color: var(--muted); cursor: pointer; }
        .fd-scope-btn.is-active { background: color-mix(in srgb, var(--panel) 80%, white 6%); color: var(--text); box-shadow: 0 0 0 1px var(--border), 0 0 10px color-mix(in srgb, var(--accent) 12%, transparent); }
        .fd-ask-btn { background: var(--accent-soft); color: var(--accent); border: none; border-radius: 9px; padding: 8px 13px; font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .fd-ask-btn:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
        .fd-composer { padding: 14px 16px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; }
        .fd-composer textarea { width: 100%; resize: vertical; min-height: 56px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; padding: 10px; }
        .fd-composer-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .fd-composer-cancel { background: none; border: none; color: var(--muted); font-size: 12.5px; padding: 8px 10px; cursor: pointer; }
        .fd-composer-post { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 8px 14px; font-weight: 600; font-size: 12.5px; cursor: pointer; }
        .fd-composer-post:disabled { opacity: 0.5; cursor: not-allowed; }
        .fd-feed-list { display: flex; flex-direction: column; gap: 10px; }
        .fd-feed-item { padding: 14px 15px; display: flex; gap: 12px; }
        /* Sized explicitly: as a stretched flex child the glow would smear down
           the full height of the card instead of haloing the avatar. */
        .fd-feed-avatar-wrap { position: relative; flex-shrink: 0; width: 32px; height: 32px; }
        .fd-feed-avatar-glow { position: absolute; inset: -4px; border-radius: 50%; filter: blur(6px); opacity: 0.45; }
        .fd-feed-avatar { position: relative; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12px; color: #fff; }
        .fd-feed-body { flex: 1; min-width: 0; }
        .fd-feed-line { font-size: 13px; color: var(--text-soft); }
        .fd-feed-line b { color: var(--text); }
        .fd-feed-tag { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); }
        .fd-feed-text { font-size: 13px; color: var(--text-soft); margin-top: 4px; line-height: 1.5; word-break: break-word; }
        .fd-feed-meta { margin-top: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); }
        .fd-feed-actions { margin-top: 9px; display: flex; align-items: center; gap: 15px; }
        .fd-feed-action { display: flex; align-items: center; gap: 5px; background: none; border: none; font-size: 11.5px; color: var(--muted); cursor: pointer; padding: 0; }
        .fd-feed-action:hover:not(:disabled) { color: var(--text-soft); }
        .fd-feed-action:disabled { cursor: not-allowed; opacity: 0.6; }
        .fd-feed-action.is-liked { color: var(--accent); }
        .fd-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); font-size: 12.5px; padding: 26px; text-align: center; }
        .fd-empty-icon { color: var(--muted2); opacity: 0.6; }
        .fd-empty-link { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; }

        /* Smooth Air / OS reduced motion: keep the depth, stop the movement. */
        .app.reduce-motion .fd-hero-glow { animation: none; opacity: 0.85; }
        .app.reduce-motion .fd-horizon-layer,
        .app.reduce-motion .fd-needle,
        .app.reduce-motion .fd-unlock-fill { transition: none; }
        .app.reduce-motion .fd-data-content { animation: none; }
        .app.reduce-motion .fd-resume { transform: none !important; }
        @media (prefers-reduced-motion: reduce) {
          .fd-hero-glow { animation: none; opacity: 0.85; }
          .fd-horizon-layer, .fd-needle, .fd-unlock-fill { transition: none; }
          .fd-data-content { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default HubPage;
