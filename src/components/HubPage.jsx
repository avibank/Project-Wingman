import { useState, useEffect } from "react";
import { Radio, Star, Lock, ChevronRight, CheckCircle2, Target, Flame, BookMarked, MessageSquareOff, Layers, RotateCcw, Compass, Search } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { fetchEnrollments, enrollInModule, unenrollFromModule } from "../lib/enrollments.js";
import { fetchAllPresence } from "../lib/presence.js";
import { fetchWingmen } from "../lib/partners.js";
import { fetchThreadsForModules } from "../lib/discussion.js";
import { displayNameFor } from "../lib/social.js";
import { ValueTape, N1Dial, SplitFlap, ModuleMotif, InstrumentStyles } from "./instruments.jsx";

// Only surface a module filter once the roster is big enough to need one.
const MODULE_FILTER_THRESHOLD = 4;
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
        stroke="var(--accent)"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

function HubPage({ onEnterModule, onGoToChapter, onGoToDiscuss, onGoToSocial, onReviewBookmarks, onSignIn, streak = 0 }) {
  const { isSignedIn, user } = useUser();
  const progress = useUserProgress();
  const [enrolledCodes, setEnrolledCodes] = useState([]);
  const [enrolling, setEnrolling] = useState(null);
  const [moduleQuery, setModuleQuery] = useState("");
  const [snippet, setSnippet] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [sectorSignals, setSectorSignals] = useState([]);

  const completed = new Set(progress.get("pw-completed", []));
  const quizScores = progress.get("pw-quiz-scores", {});
  const bookmarkIds = progress.get("pw-bookmarks", []);
  const bookmarkCount = bookmarkIds.length;
  const recentChapterIds = progress.get("pw-recent-chapters", []);
  const chapterProgress = progress.get("pw-chapter-progress", {});
  const viewedIds = new Set(progress.get("pw-viewed-chapters", []));
  const reduceMotion = progress.get("pw-reduce-motion", false);

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

  // A single social line for Home: prefer a wingman, else anyone studying now.
  useEffect(() => {
    let live = true;
    (async () => {
      const [present, wing] = await Promise.all([
        fetchAllPresence(user?.id),
        user?.id ? fetchWingmen(user.id) : Promise.resolve([]),
      ]);
      if (!live) return;
      const wingIds = new Set(wing.map((w) => w.wingman_user_id));
      const pick = present.find((p) => wingIds.has(p.user_id)) || present[0] || null;
      setSnippet(pick ? { ...pick, isWingman: wingIds.has(pick.user_id) } : null);
      setContacts(present);
      // Home is a status board: at most one line per module, never its content.
      const rows = await fetchThreadsForModules(MODULES.map((m) => m.code), 40);
      if (!live) return;
      const seen = new Set();
      setSectorSignals(
        rows.filter((r) => (seen.has(r.module_code) ? false : (seen.add(r.module_code), true))).slice(0, 5)
      );
    })();
    return () => { live = false; };
  }, [user?.id]);

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

  // Stats are context, not destinations — each carries its own empty copy so a
  // new account never renders a bare 0, a dash, or an empty ring.
  // METAR-style readout: condition reflects whether anything needs attention.
  const weakCount = Object.entries(quizScores).filter(([id, s]) => completed.has(id) && s < LOW_SCORE_PCT).length;
  const condition = weakCount > 1 ? "IFR" : weakCount === 1 ? "MVFR" : "VFR";
  const metar = weakCount
    ? `${weakCount} chapter${weakCount === 1 ? "" : "s"} worth another pass`
    : `${completed.size} chapter${completed.size === 1 ? "" : "s"} complete`;

  const stats = [
    {
      icon: CheckCircle2,
      label: "Checklist",
      value: completed.size ? `${completed.size}/${CHAPTERS.length}` : null,
      empty: "Open your first chapter",
    },
    {
      icon: Target,
      label: "Quiz accuracy",
      value: quizAccuracy === null ? null : `${quizAccuracy}%`,
      empty: "Take a quiz to set your accuracy",
    },
    {
      icon: Flame,
      label: "Streak",
      // Clamp so the count-up never flashes a bare 0 on its first frame.
      value: streak ? `${Math.max(1, streakDisplay)}d` : null,
      empty: "Study today to start a streak",
    },
    {
      icon: BookMarked,
      label: "Bookmarks",
      value: bookmarkCount ? `${bookmarkCount}` : null,
      empty: "Flag a question to revisit it here",
    },
  ];

  const checklistLine = completed.size
    ? `${completed.size}/${CHAPTERS.length} items complete`
    : `${CHAPTERS.length} items to fly`;

  // Per-module progress, used for ordering and for the Suggested Next hint.
  const moduleStats = MODULES.map((m) => {
    const chs = chaptersForModule(m.code);
    const done = chs.filter((ch) => completed.has(ch.id)).length;
    return { m, chs, done, pct: chs.length ? Math.round((done / chs.length) * 100) : 0 };
  });
  const inProgressCode = lastModule?.code ?? moduleStats.find((s) => s.pct > 0 && s.pct < 100)?.m.code ?? null;
  // A soft recommendation only — every module is open to everyone at any time.
  const suggestedCode =
    moduleStats
      .filter((s) => s.m.code !== inProgressCode && s.pct < 100)
      .sort((a, b) => (a.m.order ?? 99) - (b.m.order ?? 99))[0]?.m.code ?? null;
  // Pinned first, in scroll order: what you are flying, then what we suggest.
  const orderedModules = [...moduleStats].sort((a, b) => {
    const rank = (s) => (s.m.code === inProgressCode ? 0 : s.m.code === suggestedCode ? 1 : 2);
    return rank(a) - rank(b) || (a.m.order ?? 99) - (b.m.order ?? 99);
  });


  return (
    <div className="hub">
      <header className="hub-head">
        <h1 className="hub-title">Flight Deck</h1>
        <p className="hub-sub">{greetingLine}</p>
      </header>

      {/* ---- 1. Jump back in ------------------------------------------------ */}
      <p className="metar"><span className="metar-dot" aria-hidden="true" />{metar}</p>

      <section className="card hub-hero">
        <div className="hero-body">
          <p className="kicker">Continue</p>
          {lastChapter ? (
            <>
              <h2 className="hero-chapter">
                <span className="mono-code">{lastChapter.code}</span> {lastChapter.title}
              </h2>
              <p className="hero-module">{lastModule?.name}</p>
              <div className="hero-bar" role="progressbar" aria-valuenow={lastChapterPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="hero-fill" style={{ width: `${lastChapterPct}%` }} />
              </div>
              <p className="hero-meta">
                {lastChapterPct}% through this chapter · {checklistLine}
              </p>
            </>
          ) : (
            <>
              <h2 className="hero-chapter">Open your first chapter</h2>
              <p className="hero-module">
                {(MODULES.find((m) => m.code === "JT") || MODULES[0])?.name} · {CHAPTERS.length} chapters
              </p>
              <p className="hero-meta">Your first chapter starts the logbook.</p>
            </>
          )}

          <div className="hero-actions">
            <button className="btn-primary" onClick={lastChapter ? resumeFlight : startFirstFlight}>
              {lastChapter ? "Resume flight" : "Start first chapter"} <ChevronRight size={16} />
            </button>
            {suggestion && (
              <button className="btn-quiet" onClick={suggestion.onAct}>
                <suggestion.icon size={14} />
                <span className="btn-quiet-label">{suggestion.label}</span>
                <span className="btn-quiet-title">{suggestion.title}</span>
              </button>
            )}
          </div>
        </div>

        <div className="hero-stats">
          <div className="instr-cell"><N1Dial pct={quizAccuracy ?? 0} label={quizAccuracy === null ? "Take a quiz to set your accuracy" : "Quiz accuracy"} size={96} /></div>
          <div className="instr-cell"><ValueTape value={streak} label="Streak" unit="days" /></div>
          <div className="instr-cell instr-cell--text">
            <div className="instr-value">{completed.size ? `${completed.size}/${CHAPTERS.length}` : "—"}</div>
            <div className="instr-label">Checklist</div>
          </div>
          <div className="instr-cell instr-cell--text">
            <div className="instr-value">{bookmarkCount || "—"}</div>
            <div className="instr-label">Bookmarks</div>
          </div>
        </div>
      </section>

      {snippet && (
        <button className="card social-snippet" onClick={() => onGoToSocial(snippet.module_code)}>
          {snippet.isWingman ? <Star size={13} className="snippet-icon" /> : <Radio size={13} className="snippet-icon" />}
          <span className="snippet-text">
            <strong>{snippet.display_name || "A pilot"}</strong>
            {snippet.isWingman ? " (your wingman) is studying now" : " is studying now"}
          </span>
          <ChevronRight size={14} className="snippet-arrow" />
        </button>
      )}

      {sectorSignals.length > 0 && (
        <section className="board">
          <p className="kicker">Recent activity</p>
          <ul className="board-list">
            {sectorSignals.map((s) => (
              <li key={s.id} className="board-row">
                <span className="board-code" >{s.module_code}</span>
                <SplitFlap text={`${displayNameFor(s)} posted in ${s.chapter_id ? (CHAPTERS.find((c) => c.id === s.chapter_id)?.code || s.module_code) : s.module_code}`} className="board-text" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- 2. Module launcher --------------------------------------------- */}
      <section className="hub-section">
        <div className="section-head">
          <h2 className="section-title">Modules</h2>
          {MODULES.length > MODULE_FILTER_THRESHOLD && (
            <label className="module-filter">
              <Search size={13} />
              <input
                type="search"
                value={moduleQuery}
                onChange={(e) => setModuleQuery(e.target.value)}
                placeholder="Filter modules"
                aria-label="Filter modules"
              />
            </label>
          )}
        </div>

        <div className="launcher">
          {orderedModules
            .filter(({ m }) => m.name.toLowerCase().includes(moduleQuery.trim().toLowerCase()))
            .map(({ m, chs, done, pct }) => {
              const isEnrolled = enrolledCodes.includes(m.code);
              const isPinned = m.code === inProgressCode || m.code === suggestedCode;
              const isSuggested = m.code === suggestedCode;
              const state = pct > 0 ? "live" : isEnrolled ? "ready" : "open";
              const upNext = chs.find((c) => !completed.has(c.id));
              return (
                <article
                  key={m.code}
                  className={`card mod is-${state} ${isPinned ? "is-pinned" : ""} ${isSuggested ? "is-suggested" : ""}`}
                  style={{ "--id-hue": m.hue }}
                >
                  <ModuleMotif motif={m.motif} />
                  <span className="mod-rail" aria-hidden="true" />
                  <div className="mod-top">
                    <span className="mono-code">{m.code}</span>
                    {pct > 0 && <ProgressRing pct={pct} size={30} />}
                  </div>
                  <h3 className="mod-name">{m.name}</h3>
                  <div className="mod-bar">
                    <div className="mod-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mod-meta">
                    {done}/{chs.length} chapters{upNext ? ` · up next ${upNext.code}` : ""}
                  </p>
                  <div className="mod-actions">
                    {isEnrolled ? (
                      <>
                        <button className="btn-secondary" onClick={() => onEnterModule(m)}>
                          {pct > 0 ? "Continue" : "Begin"} <ChevronRight size={13} />
                        </button>
                        <button className="btn-link" onClick={() => handleUnenroll(m.code)} disabled={enrolling === m.code}>
                          {enrolling === m.code ? "Leaving…" : "Leave"}
                        </button>
                      </>
                    ) : (
                      <button className="btn-secondary" onClick={() => handleEnroll(m.code)} disabled={enrolling === m.code}>
                        {enrolling === m.code ? "Joining…" : "Enroll"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </section>

      <InstrumentStyles />
      <style>{`
        .metar { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 11px;
          letter-spacing: 0.08em; color: var(--muted); margin: 0 0 14px; }
        .metar-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
           }
        .instr-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px 10px;
          border-right: 1px solid var(--border-soft); }
        .instr-cell:last-child { border-right: none; }
        .instr-cell--text .instr-value { font-family: var(--font-mono); font-size: 20px; color: var(--text);
          font-variant-numeric: tabular-nums; }
        .board { margin-top: 12px; }
        .board-list { list-style: none; margin: 0; padding: 0; border-radius: var(--r-md); overflow: hidden;
          border: 1px solid var(--border-soft); background: var(--well); box-shadow: var(--shadow-inset); }
        .board-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border-soft); }
        .board-row:last-child { border-bottom: none; }
        .board-code { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; width: 46px; flex-shrink: 0; }
        .board-text { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-soft); }
        .mod { position: relative; }
        .mod .instr-motif { color: var(--id-hue, var(--accent)); right: -60px; width: 170px; height: 170px; opacity: 0.07; }
        .mod .mono-code { color: var(--id-hue, var(--accent-tint)); }
        /* Amber is the "come here next" signal, never identity. */
        .mod.is-suggested { border-color: color-mix(in srgb, var(--presence) 34%, transparent); }
        .mod.is-suggested::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
          box-shadow: inset 0 0 34px var(--presence-glow); }
        .mod { transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), border-color 0.15s ease, box-shadow 0.22s ease; }
        .mod:hover { transform: translateY(-3px); box-shadow: var(--shadow-2), 0 0 28px var(--presence-glow); }
        .app.reduce-motion .mod { transition: none; }
        .app.reduce-motion .mod:hover { transform: none; }

        /* ---------- one card system ---------- */
        .card { background: var(--elev-1); border: 1px solid var(--border-soft); border-radius: var(--r-lg);
          box-shadow: var(--shadow-1); padding: 20px; }

        /* ---------- type scale ----------
           One heading style, one body style. Uppercase mono is reserved for
           chapter codes and a single kicker per section. */
        .hub-head { margin-bottom: 22px; }
        .hub-title { font-family: var(--font-display); font-size: 28px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); margin: 0 0 4px; }
        .hub-sub { font-size: 14px; color: var(--muted); margin: 0; }
        .kicker { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--accent-tint); opacity: 0.85; margin: 0 0 10px; }
        .mono-code { font-family: var(--font-mono); font-size: 0.82em; color: var(--accent-tint); letter-spacing: 0.04em; }
        .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; min-height: 34px; }
        .section-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--text); margin: 0; }
        .section-title--sm { font-size: 14px; color: var(--text-soft); }
        .hub-section { margin-top: 30px; }
        .hub-section--quiet { margin-top: 34px; opacity: 0.92; }

        /* ---------- 1. hero ---------- */
        .hub-hero { padding: 0; overflow: hidden; }
        .hero-body { padding: 22px 22px 20px; }
        .hero-chapter { font-family: var(--font-display); font-size: 19px; font-weight: 700; color: var(--text); margin: 0 0 4px; line-height: 1.3; }
        .hero-module { font-size: 13px; color: var(--muted); margin: 0 0 14px; }
        .hero-bar { height: 6px; border-radius: var(--r-pill); background: var(--well); box-shadow: var(--shadow-inset); overflow: hidden; max-width: 460px; }
        .hero-fill { height: 100%; border-radius: var(--r-pill); background: var(--accent); transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
        .hero-meta { font-size: 12.5px; color: var(--muted); margin: 9px 0 0; }
        .hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: var(--on-accent); border: none;
          border-radius: var(--r-md); padding: 12px 18px; font-family: var(--font-display); font-weight: 700; font-size: 13.5px;
          cursor: pointer; min-height: 44px; box-shadow: var(--hairline), 0 0 0 1px var(--accent-dim), 0 6px 20px var(--accent-glow);
          transition: background 0.18s ease, transform 0.18s ease; }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-primary:active { transform: scale(0.98); }
        .btn-quiet { display: inline-flex; align-items: center; gap: 8px; background: none; border: 1px solid var(--border-soft);
          border-radius: var(--r-md); padding: 10px 14px; min-height: 44px; cursor: pointer; color: var(--text-soft); font-size: 13px;
          transition: border-color 0.15s ease, color 0.15s ease; }
        .btn-quiet:hover { border-color: var(--border); color: var(--text); }
        .btn-quiet-label { color: var(--muted); font-size: 12px; }
        .btn-quiet-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 210px; }

        /* stats: a supporting strip, not a second grid of destinations */
        .hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--border-soft); background: color-mix(in srgb, var(--well) 45%, transparent); }
        .stat { padding: 13px 16px; border-right: 1px solid var(--border-soft); min-width: 0; }
        .stat:last-child { border-right: none; }
        .stat-icon { color: var(--muted2); }
        .stat-label { font-size: 11px; color: var(--muted); margin: 5px 0 3px; }
        .stat-value { font-family: var(--font-mono); font-weight: 500; font-size: 17px; color: var(--text); font-variant-numeric: tabular-nums; }
        .stat-empty { font-size: 11.5px; color: var(--muted2); line-height: 1.35; }

        .social-snippet { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer;
          margin-top: 12px; padding: 13px 16px; min-height: 44px; transition: border-color 0.15s ease, background 0.15s ease; }
        .social-snippet:hover { border-color: var(--border); background: var(--elev-2); }
        .snippet-icon { color: var(--accent); flex-shrink: 0; }
        .snippet-text { flex: 1; min-width: 0; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .snippet-text strong { color: var(--text); font-weight: 600; }
        .snippet-arrow { color: var(--muted2); flex-shrink: 0; }

        /* ---------- 2. module launcher ---------- */
        .module-filter { display: flex; align-items: center; gap: 7px; background: var(--well); border: 1px solid var(--border);
          border-radius: var(--r-sm); padding: 7px 11px; box-shadow: var(--shadow-inset); color: var(--muted); }
        .module-filter input { background: none; border: none; outline: none; color: var(--text); font-family: var(--font-body); font-size: 12.5px; width: 150px; }
        /* Six modules is small enough to scroll rather than paginate. */
        .launcher { display: flex; gap: 14px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x proximity;
          scrollbar-width: thin; scrollbar-color: var(--border-hover) transparent; }
        .launcher > .mod { flex: 0 0 262px; scroll-snap-align: start; }
        .launcher > .mod.is-pinned { flex-basis: 292px; }
        .mod-suggested { align-self: flex-start; font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--accent); background: var(--accent-soft);
          border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent); border-radius: var(--r-pill); padding: 3px 9px; }
        .mod { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 9px; padding: 18px 18px 18px 20px;
          transition: border-color 0.15s ease, background 0.15s ease; }
        .mod:hover { border-color: var(--border); background: var(--elev-2); }
        /* the rail is the status signal — no word badge */
        .mod-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--id-hue, var(--accent)); }
        .mod.is-live .mod-rail { opacity: 1; }
        .mod.is-ready .mod-rail { opacity: 0.45; }
        .mod.is-open .mod-rail { opacity: 0.22; }
        .mod.is-locked .mod-rail { background: var(--muted2); opacity: 0.3; }
        .mod.is-locked { opacity: 0.62; }
        .mod-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 30px; }
        .mod-lock { color: var(--muted2); }
        .mod-name { font-family: var(--font-display); font-size: 15.5px; font-weight: 700; color: var(--text); margin: 0; line-height: 1.3; }
        .mod-bar { height: 4px; border-radius: var(--r-pill); background: var(--well); overflow: hidden; box-shadow: var(--shadow-inset); }
        .mod-fill { height: 100%; border-radius: var(--r-pill); background: var(--id-hue, var(--accent)); transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
        .mod-fill.is-muted { background: var(--muted2); }
        .mod-meta { font-size: 12px; color: var(--muted); margin: 0; }
        .mod-actions { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 4px; }
        .btn-secondary { display: inline-flex; align-items: center; gap: 5px; background: var(--accent-soft); color: var(--accent);
          border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent); border-radius: var(--r-sm); padding: 9px 14px;
          font-weight: 600; font-size: 12.5px; cursor: pointer; min-height: 40px; transition: background 0.15s ease; }
        .btn-secondary:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-link { background: none; border: none; color: var(--muted); font-size: 12.5px; cursor: pointer; padding: 6px 2px; min-height: 36px; }
        .btn-link:hover { color: var(--text); }


        @media (max-width: 760px) {
          .hub-hero { padding: 0; }
          .hero-body { padding: 18px 16px 16px; }
          .hero-stats { grid-template-columns: repeat(2, 1fr); }
          .instr-cell { border-right: none; border-bottom: 1px solid var(--border-soft); }
          .stat:nth-child(2) { border-right: none; }
          .stat:nth-child(-n+2) { border-bottom: 1px solid var(--border-soft); }
          .launcher > .mod { flex-basis: 78vw; }
          .launcher > .mod.is-pinned { flex-basis: 82vw; }
          .btn-quiet-title { max-width: 140px; }
        }

        .app.reduce-motion .hero-fill,
        .app.reduce-motion .mod-fill,
        .app.reduce-motion .btn-primary { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .hero-fill, .mod-fill, .btn-primary { transition: none; }
        }
      `}</style>
    </div>
  );
}

export default HubPage;
