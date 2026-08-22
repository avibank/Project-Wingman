import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft, Check, Lock, ThumbsUp, Radio, Compass, BookMarked, Flame } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { useDisplayName } from "../lib/identity.js";
import { useIsAdmin } from "../lib/admin.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchRecentActivity, postComment, toggleReaction } from "../lib/comments.js";

// Dial geometry: 240 degrees of travel, swept symmetrically about vertical.
const DIAL_START_DEG = -120;
const DIAL_SWEEP_DEG = 240;
// Cyclable dial: auto-advance cadence, and how long a manual interaction wins.
const DATA_PAGE_MS = 4000;
const DATA_PAUSE_MS = 9000;
// Value animation, per the eased-sweep spec.
const SWEEP_MS = 520;
// Tilt limit, kept small so the glass reads curved rather than loose.
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

// Samples the shared accent ramp at a value: deep and desaturated at the low
// end, full accent through the middle, hot flare approaching redline. Built from
// the tokens with color-mix so it tracks whichever livery is selected.
function rampColor(pct) {
  const v = Math.max(0, Math.min(100, pct));
  if (v <= 50) return `color-mix(in srgb, var(--g-mid) ${Math.round((v / 50) * 100)}%, var(--g-low))`;
  return `color-mix(in srgb, var(--g-high) ${Math.round(((v - 50) / 50) * 100)}%, var(--g-mid))`;
}

function degForPct(pct) {
  return DIAL_START_DEG + (Math.max(0, Math.min(100, pct)) / 100) * DIAL_SWEEP_DEG;
}

// Eases a displayed number toward its real value so gauges sweep instead of
// snapping. Returns the target immediately when motion is suppressed.
function useAnimatedValue(target, animate) {
  const [display, setDisplay] = useState(animate ? 0 : target);
  const fromRef = useRef(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / SWEEP_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + delta * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      fromRef.current = target;
      cancelAnimationFrame(raf);
    };
  }, [target, animate]);
  return display;
}

const MAJOR_TICKS = [0, 25, 50, 75, 100];
const MINOR_TICKS = [12.5, 37.5, 62.5, 87.5];

// One instrument face, shared by all three widgets: same bezel, same tick
// hierarchy, same cover glass. Only `needle` and `arc` vary between them.
function Gauge({ size, value = 0, arc = true, needle = false, empty = false, label, children }) {
  const stroke = Math.round(size * 0.055);
  const r = size / 2 - stroke / 2 - size * 0.085;
  const circumference = 2 * Math.PI * r;
  const arcLen = circumference * (DIAL_SWEEP_DEG / 360);
  const filled = arcLen * (Math.max(0, Math.min(100, value)) / 100);
  const cx = size / 2;
  const tickOuter = size / 2 - size * 0.035;
  const labelR = size / 2 - size * 0.165;
  const gradId = `ndl-${size}`;

  const tick = (pct, major) => {
    const a = ((degForPct(pct) - 90) * Math.PI) / 180;
    const len = major ? size * 0.072 : size * 0.04;
    return (
      <line
        key={`${major ? "M" : "m"}${pct}`}
        x1={cx + Math.cos(a) * tickOuter}
        y1={cx + Math.sin(a) * tickOuter}
        x2={cx + Math.cos(a) * (tickOuter - len)}
        y2={cx + Math.sin(a) * (tickOuter - len)}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
        className={major ? "g-tick g-tick--major" : "g-tick"}
      />
    );
  };

  return (
    <div className={`g ${empty ? "is-empty" : ""}`} style={{ width: size, height: size, "--pctn": Math.round(value) }}>
      <div className="g-bezel" />
      <div className="g-face">
        <div className="g-bloom" style={{ background: `radial-gradient(circle, ${rampColor(value)} 0%, transparent 68%)` }} />
        <svg className="g-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" style={{ stopColor: "color-mix(in srgb, var(--g-low) 55%, black)" }} />
              <stop offset="52%" style={{ stopColor: "var(--g-mid)" }} />
              <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--g-high) 78%, white)" }} />
            </linearGradient>
          </defs>
          <g>
            {MINOR_TICKS.map((t) => tick(t, false))}
            {MAJOR_TICKS.map((t) => tick(t, true))}
          </g>
          <g>
            {MAJOR_TICKS.map((t) => {
              const a = ((degForPct(t) - 90) * Math.PI) / 180;
              return (
                <text
                  key={t}
                  x={cx + Math.cos(a) * labelR}
                  y={cx + Math.sin(a) * labelR}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="g-ticklabel"
                >
                  {t}
                </text>
              );
            })}
          </g>
          {arc && (
            <>
              <circle
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{ stroke: "var(--g-track)" }}
                strokeDasharray={`${arcLen} ${circumference}`}
                transform={`rotate(${90 + DIAL_START_DEG} ${cx} ${cx})`}
              />
              <circle
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                style={{ stroke: rampColor(value), transition: "stroke-dasharray 0.1s linear" }}
                strokeDasharray={`${filled} ${circumference}`}
                transform={`rotate(${90 + DIAL_START_DEG} ${cx} ${cx})`}
                className="g-arc"
              />
            </>
          )}
          {needle && (
            <g transform={`rotate(${degForPct(value)} ${cx} ${cx})`}>
              <polygon
                points={`${cx - size * 0.027},${cx + size * 0.03} ${cx + size * 0.027},${cx + size * 0.03} ${cx},${cx - r - stroke * 0.15}`}
                fill={`url(#${gradId})`}
                className="g-needle"
              />
            </g>
          )}
        </svg>
        {needle && <div className="g-pivot" />}
        <div className="g-tickglow" />
      </div>
      <div className="g-glass" />
      <div className="g-spec" />
      <div className="g-readout">{children}</div>
      {label && <div className="g-label">{label}</div>}
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
  const clusterRef = useRef(null);
  const sensorActive = useRef(false);
  const rafRef = useRef(null);

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

  const nothingStarted = modulePercent === 0 && chapterPercent === 0 && viewedIds.size === 0;

  // A streak has no fixed ceiling, so it is never drawn as a filled arc — it
  // reads as a digital stat inside the same instrument rather than implying a
  // maximum that does not exist.
  const dataPages = [];
  if (quizAccuracy !== null) dataPages.push({ key: "acc", label: "Quiz Accuracy", value: quizAccuracy, arc: true, display: quizAccuracy, unit: "%" });
  if (streak > 0) dataPages.push({ key: "streak", label: "Study Streak", value: 0, arc: false, display: streak, unit: "d", icon: Flame });
  if (bookmarkCount > 0) dataPages.push({ key: "saved", label: "Bookmarked", value: 0, arc: false, display: bookmarkCount, unit: "" });
  if (nextChapter) dataPages.push({ key: "next", label: "Next Checkpoint", value: 0, arc: false, display: nextChapter.code, unit: "" });
  if (!dataPages.length) dataPages.push({ key: "none", label: "Standby", value: 0, arc: false, display: "—", unit: "" });
  const safePageIndex = ((dataPageIndex % dataPages.length) + dataPages.length) % dataPages.length;
  const dataPage = dataPages[safePageIndex];

  const animate = !reduceMotion;
  const modShown = useAnimatedValue(modulePercent, animate);
  const chapShown = useAnimatedValue(chapterPercent, animate);
  const dataShown = useAnimatedValue(dataPage.arc ? dataPage.value : 0, animate);

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

  useEffect(() => {
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

  // ---- pointer / device reactivity -------------------------------------------
  // One listener writes CSS custom properties per gauge; every gradient and
  // transform that consumes them is painted by CSS, not by per-frame JS.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster || reduceMotion) return;

    const writePointer = (clientX, clientY) => {
      cluster.querySelectorAll(".g").forEach((g) => {
        const b = g.getBoundingClientRect();
        const px = ((clientX - b.left) / b.width) * 100;
        const py = ((clientY - b.top) / b.height) * 100;
        g.style.setProperty("--px", `${Math.max(-40, Math.min(140, px))}%`);
        g.style.setProperty("--py", `${Math.max(-40, Math.min(140, py))}%`);
        if (!sensorActive.current) {
          const inside = px >= 0 && px <= 100 && py >= 0 && py <= 100;
          g.style.setProperty("--tx", `${inside ? ((50 - py) / 50) * TILT_MAX_DEG : 0}deg`);
          g.style.setProperty("--ty", `${inside ? ((px - 50) / 50) * TILT_MAX_DEG : 0}deg`);
        }
      });
    };

    const onPointerMove = (e) => {
      if (e.pointerType === "touch") return;
      if (rafRef.current) return;
      const { clientX, clientY } = e;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        writePointer(clientX, clientY);
      });
    };

    const onLeave = () => {
      if (sensorActive.current) return;
      cluster.querySelectorAll(".g").forEach((g) => {
        g.style.setProperty("--tx", "0deg");
        g.style.setProperty("--ty", "0deg");
      });
    };

    // Device tilt replaces pointer tilt where a real sensor exists. Presence of
    // the API is not proof of a sensor — desktop Chrome defines it and never
    // fires — so only a reading with real angles takes over.
    const onOrientation = (e) => {
      if (e.gamma == null && e.beta == null) return;
      sensorActive.current = true;
      const gamma = Math.max(-30, Math.min(30, e.gamma || 0));
      const beta = Math.max(-30, Math.min(30, (e.beta || 0) - 45));
      cluster.querySelectorAll(".g").forEach((g) => {
        g.style.setProperty("--ty", `${(gamma / 30) * TILT_MAX_DEG}deg`);
        g.style.setProperty("--tx", `${(-beta / 30) * TILT_MAX_DEG}deg`);
      });
    };

    const hasOrientation = typeof window.DeviceOrientationEvent !== "undefined";
    const needsPermission = hasOrientation && typeof window.DeviceOrientationEvent.requestPermission === "function";
    setNeedsMotionPermission(needsPermission);
    if (hasOrientation && !needsPermission) window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    cluster.addEventListener("pointerleave", onLeave);
    window.__wingmanOrientationHandler = onOrientation;
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("pointermove", onPointerMove);
      cluster.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      delete window.__wingmanOrientationHandler;
    };
  }, [reduceMotion]);

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
      setFeedScope("all");
    }
  };

  const directoryModules = MODULES.filter((m) => m.code !== heroModule.code);
  const PageIcon = dataPage.icon;

  return (
    <div className="fd">
      <div className="pagehead">
        <p className="fd-eyebrow">Aviation Fundamentals</p>
        <h1 className="fd-title">Flight Deck</h1>
        <p className="fd-sub">Your modules, your progress, all in one place.</p>
      </div>

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

          <div className="fd-cluster" ref={clusterRef}>
            <div className="fd-dial-row">
              <div className="fd-dial-col fd-dial-col--module">
                <Gauge size={128} value={modShown} empty={nothingStarted} label="Module">
                  <span className="g-value">
                    {Math.round(modShown)}
                    <small>%</small>
                  </span>
                </Gauge>
              </div>

              <div className="fd-dial-col fd-dial-col--chapter">
                <Gauge size={182} value={chapShown} needle empty={nothingStarted} label="Current Chapter">
                  <span className="g-value g-value--lg">
                    {Math.round(chapShown)}
                    <small>%</small>
                  </span>
                </Gauge>
              </div>

              <div className="fd-dial-col fd-dial-col--data">
                <Gauge size={128} value={dataShown} arc={dataPage.arc} label={dataPage.label}>
                  <div key={dataPage.key} className="g-face-slide">
                    <span className="g-value">
                      {PageIcon && <PageIcon size={13} className="g-value-icon" />}
                      {dataPage.display}
                      {dataPage.unit ? <small>{dataPage.unit}</small> : null}
                    </span>
                  </div>
                </Gauge>
                {dataPages.length > 1 && (
                  <div className="fd-data-nav">
                    <button className="fd-data-arrow" onClick={() => goToDataPage(safePageIndex - 1)} aria-label="Previous reading">
                      <ChevronLeft size={14} />
                    </button>
                    <div className="fd-data-dots">
                      {dataPages.map((p, i) => (
                        <button
                          key={p.key}
                          className={`fd-data-dot ${i === safePageIndex ? "is-active" : ""}`}
                          onClick={() => goToDataPage(i)}
                          aria-label={p.label}
                        />
                      ))}
                    </div>
                    <button className="fd-data-arrow" onClick={() => goToDataPage(safePageIndex + 1)} aria-label="Next reading">
                      <ChevronRight size={14} />
                    </button>
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
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask the crew a question…" rows={3} />
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
            <div className="fd-empty fd-surface">
              <div className="fd-scan" aria-hidden="true" />
              <span className="fd-empty-body">Reading telemetry…</span>
            </div>
          ) : scopedActivity.length === 0 ? (
            <div className="fd-empty fd-surface">
              <div className="fd-empty-dial" aria-hidden="true">
                <Radio size={18} />
              </div>
              <span className="fd-empty-title">Channel quiet</span>
              <span className="fd-empty-body">
                {feedScope === "module" ? "Nothing logged against this module yet." : "No transmissions received yet."}
              </span>
              <button className="fd-empty-link" onClick={() => (isSignedIn ? setComposerOpen(true) : onSignIn())}>
                Ask the crew a question
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
        /* Registered so the ambient highlight can be animated on touch devices,
           where there is no cursor to follow. */
        /* Must inherit: the pointer position is written on .g, but the layers
           that consume it (.g-spec, .g-tickglow) are its children. */
        @property --px { syntax: '<percentage>'; inherits: true; initial-value: 30%; }
        @property --py { syntax: '<percentage>'; inherits: true; initial-value: 18%; }

        .fd { --fd-ease: cubic-bezier(0.22, 1, 0.36, 1); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
        .fd-eyebrow, .fd-lesson-label, .fd-next-up-label, .g-label {
          font-family: 'JetBrains Mono', monospace; font-weight: 400; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--muted); opacity: 0.72; }
        .fd-eyebrow { font-size: 10.5px; margin: 0 0 6px; }
        .fd-title { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; margin: 0 0 6px; color: var(--text); letter-spacing: -0.01em; }
        .fd-sub { color: var(--muted); font-size: 14px; margin: 0; }

        /* ---- hero ---- */
        .fd-hero-wrap { position: relative; margin-top: 30px; }
        .fd-hero-glow { position: absolute; inset: -80px; z-index: 0; pointer-events: none;
          background: radial-gradient(58% 58% at 50% 42%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 74%);
          filter: blur(42px); animation: fdHeroPulse 6s ease-in-out infinite; }
        @keyframes fdHeroPulse { 0%, 100% { opacity: 0.72; transform: scale(1); } 50% { opacity: 1; transform: scale(1.035); } }
        .fd-hero { position: relative; z-index: 1; padding: 30px 32px 26px; border-radius: var(--r-lg);
          background: linear-gradient(180deg, var(--elev-2) 0%, var(--elev-1) 100%);
          border: 1px solid var(--border); box-shadow: var(--hairline), var(--shadow-2); }
        .fd-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .fd-hero-title { font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; color: var(--text); margin-top: 4px; }
        .fd-hero-chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .fd-quiet-chip { display: flex; align-items: center; gap: 6px; color: var(--muted); border-radius: var(--r-pill); padding: 5px 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px; white-space: nowrap; background: none; border: none; font-variant-numeric: tabular-nums; }
        .fd-quiet-chip--btn { cursor: pointer; min-height: 34px; }
        .fd-quiet-chip--btn:hover { color: var(--text); }
        .fd-motion-btn { display: flex; align-items: center; gap: 6px; color: var(--accent-muted); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent); border-radius: var(--r-pill); padding: 7px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; cursor: pointer; min-height: 36px; }
        .fd-motion-btn:hover { color: var(--accent); }

        /* ---- instrument system: one language for all three gauges ---- */
        .fd-cluster { margin: 26px 0 6px; display: flex; justify-content: center; }
        .fd-dial-row { display: flex; align-items: center; justify-content: center; gap: 30px; }
        .fd-dial-col { display: flex; flex-direction: column; align-items: center; position: relative; }

        .g { position: relative; flex-shrink: 0; --px: 30%; --py: 18%; --tx: 0deg; --ty: 0deg;
          transform: perspective(760px) rotateX(var(--tx)) rotateY(var(--ty));
          transition: transform 0.35s var(--fd-ease); }
        .g-bezel { position: absolute; inset: -9px; border-radius: 50%;
          background:
            conic-gradient(from 218deg, var(--bezel-hi), var(--bezel-lo) 30%, var(--bezel-mid) 58%, var(--bezel-lo) 100%),
            linear-gradient(180deg, var(--elev-2), var(--well));
          box-shadow: var(--shadow-1), inset 0 1px 0 var(--sheen); }
        .g-face { position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
          background: radial-gradient(circle at 36% 26%, var(--elev-1) 0%, var(--well) 76%);
          box-shadow: var(--shadow-inset), inset 0 0 0 1px rgba(255,255,255,0.04); }
        .g-svg { position: absolute; inset: 0; }
        .g-tick { stroke: color-mix(in srgb, var(--accent) 25%, var(--muted2)); opacity: 0.55; }
        .g-tick--major { stroke: color-mix(in srgb, var(--accent) 45%, var(--text)); opacity: 0.88; }
        .g-ticklabel { fill: var(--muted); font-family: 'JetBrains Mono', monospace; font-size: 8.5px; opacity: 0.6; }
        .g-arc { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--g-mid) 50%, transparent)); }
        .g-needle { filter: drop-shadow(0 3px 4px rgba(0,0,0,0.55)); }
        .g-pivot { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; border-radius: 50%; transform: translate(-50%,-50%);
          background: radial-gradient(circle at 33% 27%, #fff 0%, color-mix(in srgb, var(--g-high) 62%, #fff) 26%, color-mix(in srgb, var(--g-low) 72%, #000) 100%);
          box-shadow: 0 0 0 2px var(--well), 0 2px 5px rgba(0,0,0,0.6); }
        .g-bloom { position: absolute; inset: 4%; border-radius: 50%; pointer-events: none;
          opacity: calc(var(--pctn) / 100 * 0.30); filter: blur(15px); mix-blend-mode: screen; transition: opacity 0.5s var(--fd-ease); }
        .g-glass { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
          background: linear-gradient(128deg, color-mix(in srgb, var(--sheen) 85%, transparent) 0%, color-mix(in srgb, var(--sheen) 22%, transparent) 24%, transparent 44%); }
        .g-spec { position: absolute; inset: -9px; border-radius: 50%; pointer-events: none; mix-blend-mode: screen;
          background: radial-gradient(circle at var(--px) var(--py), color-mix(in srgb, var(--sheen) 80%, transparent) 0%, transparent 46%); }
        .g-tickglow { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; mix-blend-mode: screen;
          background: radial-gradient(circle at var(--px) var(--py), color-mix(in srgb, var(--g-high) 38%, transparent) 0%, transparent 30%); }
        .g-readout { position: absolute; left: 0; right: 0; bottom: 16%; display: flex; justify-content: center; pointer-events: none; }
        .g-value { display: inline-flex; align-items: center; gap: 4px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums;
          color: var(--text); background: color-mix(in srgb, var(--well) 70%, transparent); border: 1px solid rgba(255,255,255,0.07);
          border-radius: var(--r-sm); padding: 3px 10px; -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
        .g-value--lg { font-size: 22px; padding: 4px 13px; }
        .g-value small { font-family: 'JetBrains Mono', monospace; font-size: 0.6em; opacity: 0.75; }
        .g-value-icon { color: var(--accent); }
        .g-label { position: absolute; left: 50%; transform: translateX(-50%); bottom: -27px; font-size: 10px; white-space: nowrap; }
        .g.is-empty .g-arc { display: none; }
        .g.is-empty .g-face::after { content: ""; position: absolute; inset: 11%; border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--g-mid) 30%, transparent) 42deg, transparent 84deg);
          animation: gSweep 3.2s linear infinite; }
        @keyframes gSweep { to { transform: rotate(360deg); } }
        .g-face-slide { animation: gRecalibrate 0.3s var(--fd-ease); }
        @keyframes gRecalibrate { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }

        .fd-data-nav { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 26px; display: flex; align-items: center; gap: 2px; }
        .fd-data-arrow { background: none; border: none; color: var(--muted); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; }
        .fd-data-arrow:hover { color: var(--text); background: color-mix(in srgb, var(--elev-2) 70%, transparent); }
        .fd-data-dots { display: flex; }
        .fd-data-dot { position: relative; width: 26px; height: 44px; padding: 0; background: none; border: none; cursor: pointer; }
        /* Coarse pointers get the full 44x44 target; the visible dot stays 5px. */
        @media (pointer: coarse) { .fd-data-dot { width: 44px; } }
        .fd-data-dot::after { content: ""; position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%; background: var(--border-hover); transition: background 0.2s ease, box-shadow 0.2s ease; }
        .fd-data-dot.is-active::after { background: var(--accent); box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 70%, transparent); }

        .fd-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 46px 0 20px; }
        .fd-lesson-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .fd-lesson-label { font-size: 10px; }
        .fd-lesson-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: var(--text); margin-top: 3px; }
        .fd-lesson-pct { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .fd-checklist { display: flex; flex-direction: column; }
        .fd-check-row { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border-soft); padding: 11px 2px; text-align: left; cursor: pointer; min-height: 44px; }
        .fd-check-row:last-child { border-bottom: none; }
        .fd-check-row:hover .fd-check-text { color: var(--text); }
        .fd-check-box { flex-shrink: 0; width: 17px; height: 17px; border-radius: 5px; border: 1px solid var(--border-hover); display: flex; align-items: center; justify-content: center; color: var(--on-accent); transition: background 0.18s ease, border-color 0.18s ease; }
        .fd-check-box.is-done { background: var(--accent-muted); border-color: var(--accent-muted); }
        .fd-check-text { font-size: 13.5px; color: var(--text-soft); }
        .fd-check-text.is-done { color: var(--muted2); text-decoration: line-through; }
        .fd-hero-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
        .fd-next-up { display: flex; flex-direction: column; gap: 2px; }
        .fd-next-up-label { font-size: 9.5px; }
        .fd-next-up-title { font-size: 13px; color: var(--accent-muted); }
        .fd-resume { display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-md); padding: 13px 20px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; cursor: pointer; min-height: 44px;
          box-shadow: var(--hairline), 0 6px 18px color-mix(in srgb, var(--accent) 28%, transparent); transition: background 0.2s var(--fd-ease), transform 0.2s var(--fd-ease); }
        .fd-resume:hover { background: var(--accent-hover); }
        .fd-resume:active { transform: scale(0.97); transition-duration: 0.08s; }

        /* ---- calm surfaces below the hero ---- */
        .fd-surface { background: var(--elev-1); border: 1px solid var(--border-soft); border-radius: var(--r-md); box-shadow: var(--shadow-1); transition: border-color 0.15s ease, background 0.15s ease; }
        .fd-surface:hover { border-color: var(--border); background: var(--elev-2); }
        .fd-section { margin-top: 44px; }
        .fd-h2 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 6px; }
        .fd-section-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 16px; }
        .fd-active-strip { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 18px; margin-bottom: 14px; flex-wrap: wrap; }
        .fd-active-strip-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fd-flying-badge { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--good); background: color-mix(in srgb, var(--good) 12%, transparent); border-radius: var(--r-pill); padding: 4px 10px; white-space: nowrap; opacity: 0.9; }
        .fd-active-strip-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: var(--text); }
        .fd-active-strip-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .fd-view-hero { font-size: 12.5px; color: var(--accent-muted); background: none; border: none; cursor: pointer; white-space: nowrap; min-height: 44px; padding: 0 4px; }
        .fd-view-hero:hover { color: var(--accent); }
        .fd-module-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .fd-module-card { padding: 18px; display: flex; flex-direction: column; gap: 9px; }
        .fd-module-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); letter-spacing: 0.08em; }
        .fd-module-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15.5px; color: var(--text); }
        .fd-module-btn { align-self: flex-start; margin-top: 4px; background: var(--accent-soft); color: var(--accent-muted); border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent); border-radius: var(--r-sm); padding: 9px 14px; font-weight: 600; font-size: 12px; cursor: pointer; min-height: 40px; }
        .fd-module-btn:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
        .fd-module-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fd-module-unenroll { align-self: flex-start; background: none; border: none; color: var(--muted2); font-size: 10.5px; cursor: pointer; padding: 6px 0; min-height: 32px; }
        .fd-module-unenroll:hover { color: var(--bad); }
        .fd-lock-row { display: flex; align-items: center; gap: 8px; color: var(--muted2); }
        .fd-lock-note { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted); }
        .fd-unlock-track { height: 5px; border-radius: var(--r-pill); background: var(--well); overflow: hidden; margin-top: 2px; box-shadow: var(--shadow-inset); }
        .fd-unlock-fill { height: 100%; background: linear-gradient(90deg, var(--g-low), var(--g-mid)); border-radius: var(--r-pill); transition: width 0.6s var(--fd-ease); }

        /* ---- feed ---- */
        .fd-feed-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .fd-feed-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fd-scope-toggle { display: flex; gap: 4px; background: var(--well); border-radius: var(--r-sm); padding: 3px; box-shadow: var(--shadow-inset); }
        .fd-scope-btn { background: none; border: none; padding: 9px 13px; border-radius: 6px; font-size: 12px; color: var(--muted); cursor: pointer; min-height: 38px; }
        .fd-scope-btn.is-active { background: var(--elev-2); color: var(--text); box-shadow: var(--hairline), 0 1px 3px rgba(0,0,0,0.25); }
        .fd-ask-btn { background: var(--accent-soft); color: var(--accent-muted); border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent); border-radius: var(--r-sm); padding: 10px 14px; font-weight: 600; font-size: 12.5px; cursor: pointer; min-height: 40px; }
        .fd-ask-btn:hover { color: var(--accent); }
        .fd-composer { padding: 16px 18px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 10px; }
        .fd-composer textarea { width: 100%; resize: vertical; min-height: 60px; background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; padding: 11px; box-shadow: var(--shadow-inset); }
        .fd-composer-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .fd-composer-cancel { background: none; border: none; color: var(--muted); font-size: 12.5px; padding: 10px 12px; cursor: pointer; min-height: 40px; }
        .fd-composer-post { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm); padding: 10px 16px; font-weight: 600; font-size: 12.5px; cursor: pointer; min-height: 40px; }
        .fd-composer-post:disabled { opacity: 0.5; cursor: not-allowed; }
        .fd-feed-list { display: flex; flex-direction: column; gap: 10px; }
        .fd-feed-item { padding: 16px 18px; display: flex; gap: 12px; }
        .fd-feed-avatar-wrap { position: relative; flex-shrink: 0; width: 32px; height: 32px; }
        .fd-feed-avatar-glow { position: absolute; inset: -4px; border-radius: 50%; filter: blur(6px); opacity: 0.4; }
        .fd-feed-avatar { position: relative; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12px; color: #fff; }
        .fd-feed-body { flex: 1; min-width: 0; }
        .fd-feed-line { font-size: 13px; color: var(--text-soft); }
        .fd-feed-line b { color: var(--text); }
        .fd-feed-tag { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent-muted); }
        .fd-feed-text { font-size: 13px; color: var(--text-soft); margin-top: 4px; line-height: 1.5; word-break: break-word; }
        .fd-feed-meta { margin-top: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); }
        .fd-feed-actions { margin-top: 9px; display: flex; align-items: center; gap: 15px; }
        .fd-feed-action { display: flex; align-items: center; gap: 5px; background: none; border: none; font-size: 11.5px; color: var(--muted); cursor: pointer; padding: 6px 4px; min-height: 36px; font-variant-numeric: tabular-nums; }
        .fd-feed-action:hover:not(:disabled) { color: var(--text-soft); }
        .fd-feed-action:disabled { cursor: not-allowed; opacity: 0.6; }
        .fd-feed-action.is-liked { color: var(--accent); }

        /* ---- designed empty / loading states ---- */
        .fd-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 34px 24px; text-align: center; }
        .fd-empty-dial { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--muted); position: relative;
          background: radial-gradient(circle at 36% 28%, var(--elev-2), var(--well)); box-shadow: var(--shadow-inset), inset 0 0 0 1px rgba(255,255,255,0.05); }
        .fd-empty-dial::after { content: ""; position: absolute; inset: -1px; border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--g-mid) 34%, transparent) 44deg, transparent 88deg);
          animation: gSweep 3.4s linear infinite; }
        .fd-empty-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; color: var(--text-soft); margin-top: 2px; }
        .fd-empty-body { color: var(--muted); font-size: 12.5px; }
        .fd-empty-link { background: none; border: none; color: var(--accent-muted); font-size: 12.5px; cursor: pointer; min-height: 40px; padding: 0 6px; }
        .fd-empty-link:hover { color: var(--accent); }
        .fd-scan { width: 120px; height: 2px; border-radius: 2px; overflow: hidden; background: var(--well); position: relative; }
        .fd-scan::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 40%; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--g-mid), transparent); animation: fdScan 1.3s ease-in-out infinite; }
        @keyframes fdScan { 0% { transform: translateX(-110%); } 100% { transform: translateX(360%); } }

        /* ---- touch input: no cursor to track ---- */
        @media (hover: none), (pointer: coarse) {
          .g-spec { animation: gDrift 9s ease-in-out infinite alternate; }
          .g-tickglow { opacity: 0.4; }
        }
        @keyframes gDrift { from { --px: 16%; --py: 14%; } to { --px: 84%; --py: 42%; } }

        /* ---- narrow viewports: one legible gauge at a time, swipeable ---- */
        @media (max-width: 760px) {
          .fd-hero { padding: 24px 18px 22px; }
          .fd-cluster { margin-left: -18px; margin-right: -18px; }
          .fd-dial-row { display: grid; grid-auto-flow: column; grid-auto-columns: 100%; gap: 0;
            overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .fd-dial-row::-webkit-scrollbar { display: none; }
          .fd-dial-col { scroll-snap-align: center; padding: 10px 0 12px; }
          .fd-dial-col--chapter { order: -1; }
          .g { transform: none; }
          .g-value { font-size: 21px; padding: 5px 13px; }
          .g-value--lg { font-size: 27px; padding: 6px 16px; }
          .g-ticklabel { font-size: 11px; opacity: 0.78; }
          .g-label { font-size: 11px; bottom: -29px; }
          .fd-module-grid { grid-template-columns: 1fr; }
          .fd-divider { margin-top: 30px; }
        }

        /* Smooth Air / OS reduced motion: a still fallback for every effect above. */
        .app.reduce-motion .fd-hero-glow,
        .app.reduce-motion .g.is-empty .g-face::after,
        .app.reduce-motion .fd-empty-dial::after,
        .app.reduce-motion .fd-scan::after,
        .app.reduce-motion .g-face-slide,
        .app.reduce-motion .g-spec { animation: none; }
        .app.reduce-motion .fd-hero-glow { opacity: 0.85; }
        .app.reduce-motion .g { transform: none; }
        .app.reduce-motion .g,
        .app.reduce-motion .g-bloom,
        .app.reduce-motion .fd-unlock-fill { transition: none; }
        .app.reduce-motion .fd-resume { transform: none !important; }
        @media (prefers-reduced-motion: reduce) {
          .fd-hero-glow, .g.is-empty .g-face::after, .fd-empty-dial::after, .fd-scan::after, .g-face-slide, .g-spec { animation: none; }
          .g { transform: none; }
          .g, .g-bloom, .fd-unlock-fill { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default HubPage;
