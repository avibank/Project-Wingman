import { useState } from "react";
import { Play, Search, Check, ChevronRight, ThumbsUp, ThumbsDown, Award } from "lucide-react";
import ChapterQuiz from "./ChapterQuiz.jsx";
import { RankInsignia } from "./icons.jsx";
import { CHAPTERS } from "../data.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { rankForXP, tierColor, tierLabel } from "../lib/gamification.js";

function ChaptersPanel() {
  const [openId, setOpenId] = useState(CHAPTERS[0].id);
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState(() => new Set(loadJSON("pw-completed", [])));
  const [bookmarks, setBookmarks] = useState(() => new Set(loadJSON("pw-bookmarks", [])));
  const [feedback, setFeedback] = useState(() => loadJSON("pw-feedback", {}));
  const [seen, setSeen] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [bestScores, setBestScores] = useState(() => loadJSON("pw-best-scores", {}));
  const [badges, setBadges] = useState(() => new Set(loadJSON("pw-badges", [])));
  const [reviewQueue, setReviewQueue] = useState(() => loadJSON("pw-review", []));
  const [reviewing, setReviewing] = useState(false);
  const [statsTick, setStatsTick] = useState(0); // bump to re-read localStorage-backed stats
  const [loadedVideos, setLoadedVideos] = useState(new Set());

  const markComplete = (id, pct, wrongQuestions) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveJSON("pw-completed", [...next]);
      return next;
    });

    setBestScores((prev) => {
      const next = { ...prev, [id]: Math.max(prev[id] || 0, pct) };
      saveJSON("pw-best-scores", next);
      return next;
    });

    const xp = parseInt(localStorage.getItem("pw-xp") || "0", 10) + 20;
    localStorage.setItem("pw-xp", String(xp));

    if (wrongQuestions?.length) {
      const due = new Date(Date.now() + 86400000).toDateString();
      setReviewQueue((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const additions = wrongQuestions.filter((wq) => !existingIds.has(wq.id)).map((wq) => ({ ...wq, due }));
        const next = [...prev, ...additions];
        saveJSON("pw-review", next);
        return next;
      });
    }

    const newBadges = new Set(badges);
    if (pct === 100) newBadges.add("perfect");
    const totalAnswered = parseInt(localStorage.getItem("pw-total-answered") || "0", 10);
    if (totalAnswered >= 100) newBadges.add("century");
    if (new Date().getHours() < 8) newBadges.add("early");
    if (newBadges.size !== badges.size) {
      setBadges(newBadges);
      saveJSON("pw-badges", [...newBadges]);
    }

    setStatsTick((t) => t + 1);
  };

  const toggleBookmark = (qId) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      saveJSON("pw-bookmarks", [...next]);
      return next;
    });
  };

  const giveFeedback = (chapterId, value) => {
    setFeedback((prev) => {
      const next = { ...prev, [chapterId]: value };
      saveJSON("pw-feedback", next);
      return next;
    });
  };

  const startReview = () => setReviewing(true);

  const finishReview = (pct, stillWrong) => {
    const today = new Date().toDateString();
    // Clear anything due today from the queue; anything missed again gets rescheduled
    setReviewQueue((prev) => {
      const dueIds = new Set(dueReview.map((q) => q.id));
      const stillWrongIds = new Set(stillWrong.map((q) => q.id));
      const kept = prev.filter((q) => !dueIds.has(q.id) || stillWrongIds.has(q.id));
      const rescheduled = kept.map((q) => (stillWrongIds.has(q.id) ? { ...q, due: new Date(Date.now() + 86400000).toDateString() } : q));
      saveJSON("pw-review", rescheduled);
      return rescheduled;
    });
    setReviewing(false);
    setStatsTick((t) => t + 1);
  };

  const openChapter = (ch) => {
    const isOpen = openId === ch.id;
    if (isOpen) {
      setOpenId(null);
      return;
    }
    setOpenId(ch.id);
    if (!seen.has(ch.id)) {
      setToast(`NOW BOARDING — ${ch.code}`);
      setSeen((s) => new Set(s).add(ch.id));
      setTimeout(() => setToast(null), 2200);
    }
  };

  const filtered = CHAPTERS.filter((ch) => ch.title.toLowerCase().includes(query.toLowerCase()) || ch.code.toLowerCase().includes(query.toLowerCase()));
  const allDone = completed.size === CHAPTERS.length;
  const streakVal = parseInt(localStorage.getItem("pw-streak") || "0", 10);

  // Gamification stats (re-read whenever statsTick changes, since they live in localStorage)
  const xp = parseInt(localStorage.getItem("pw-xp") || "0", 10);
  const rank = rankForXP(xp);
  const totalAnswered = parseInt(localStorage.getItem("pw-total-answered") || "0", 10);
  const flightHours = (totalAnswered * 3 / 60).toFixed(1);
  const today = new Date().toDateString();
  const dailyCount = localStorage.getItem("pw-daily-date") === today ? parseInt(localStorage.getItem("pw-daily-count") || "0", 10) : 0;
  const dailyGoal = 10;
  const dueReview = reviewQueue.filter((q) => new Date(q.due) <= new Date());

  const BADGE_INFO = {
    perfect: { label: "Perfect Landing", hint: "Scored 100% on a chapter" },
    century: { label: "Century Club", hint: "Answered 100 questions" },
    early: { label: "Early Riser", hint: "Studied before 8am" },
  };

  if (reviewing) {
    return (
      <div className="chapters-wrap">
        <div className="review-head">
          <button className="review-back" onClick={() => setReviewing(false)}>← Back to chapters</button>
          <span>Review Queue</span>
        </div>
        <ChapterQuiz
          questions={dueReview}
          chapterTitle="Review Queue"
          onComplete={finishReview}
          bookmarks={bookmarks}
          onToggleBookmark={toggleBookmark}
        />
        <style>{`
          .review-head { display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.06em; }
          .review-back { background: transparent; border: none; color: var(--accent); cursor: pointer; font-size: 12px; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="chapters-wrap">
      <div className="cloud-layer" aria-hidden="true">
        <span className="cloud cloud-a" />
        <span className="cloud cloud-b" />
        <span className="cloud cloud-c" />
      </div>
      {toast && <div className="boarding-toast">{toast}</div>}

      <div className="flightlog">
        <div className="flightlog-rank">
          <RankInsignia stripes={rank.stripes} gold={rank.gold} size={16} />
          <span>{xp} XP</span>
        </div>
        <div className="flightlog-goal">
          <div className="flightlog-goal-label">
            <span>Daily goal</span>
            <span>{Math.min(dailyCount, dailyGoal)}/{dailyGoal}</span>
          </div>
          <div className="flightlog-goal-bar"><div className="flightlog-goal-fill" style={{ width: `${Math.min(100, (dailyCount / dailyGoal) * 100)}%` }} /></div>
        </div>
        <div className="flightlog-hours">✈ {flightHours} flight hrs</div>
        {badges.size > 0 && (
          <div className="trophy-case">
            {[...badges].map((b) => (
              <span key={b} className="trophy-badge" title={BADGE_INFO[b]?.hint}><Award size={12} /> {BADGE_INFO[b]?.label}</span>
            ))}
          </div>
        )}
      </div>

      {dueReview.length > 0 && (
        <div className="review-card">
          <div>
            <strong>{dueReview.length}</strong> question{dueReview.length === 1 ? "" : "s"} ready for review
          </div>
          <button className="btn-primary" onClick={startReview}>Start Review</button>
        </div>
      )}

      {allDone && (
        <div className="blackbox">
          <div className="blackbox-title"><Check size={12} /> FLIGHT RECORDER — ALL CHAPTERS COMPLETE</div>
          <div className="blackbox-grid">
            <div><span>{CHAPTERS.length}</span><label>Chapters flown</label></div>
            <div><span>{streakVal}</span><label>Day streak</label></div>
            <div><span>{bookmarks.size}</span><label>Bookmarked Qs</label></div>
          </div>
        </div>
      )}
      <div className="chapters-search">
        <Search size={15} />
        <input placeholder="Search chapters…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!seen.size && (
        <div className="chapters-hint">Tap a chapter below to begin ↓</div>
      )}
      <div className="chapters">
        {filtered.map((ch) => {
          const isOpen = openId === ch.id;
          const isDone = completed.has(ch.id);
          const best = bestScores[ch.id];
          const fb = feedback[ch.id];
          const videoLoaded = loadedVideos.has(ch.id);
          return (
            <div key={ch.id} className={`chapter ${isOpen ? "is-open" : ""}`}>
              <button className="chapter-head" onClick={() => openChapter(ch)}>
                <span className="chapter-code">{ch.code}</span>
                <span className="chapter-title">{ch.title}</span>
                {isDone && (
                  <span className="chapter-done" style={{ background: tierColor(best) }} title={`${tierLabel(best)} — best score ${best}%`}><Check size={12} strokeWidth={3} /></span>
                )}
                <span className="chapter-meta">{ch.questions.length} questions · {ch.duration}</span>
                <ChevronRight size={16} className="chapter-chevron" />
              </button>
              {isOpen && (
                <div className="chapter-body chapter-body-opening">
                  <div className="chapter-video">
                    {!videoLoaded && !ch.isPlaceholder && <div className="video-skeleton" />}
                    {ch.clip.includes("youtube.com/embed") ? (
                      <iframe
                        key={ch.id}
                        className="player-video"
                        src={ch.clip}
                        title={ch.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        onLoad={() => setLoadedVideos((prev) => new Set(prev).add(ch.id))}
                      />
                    ) : (
                      <video key={ch.id} className="player-video" controls preload="metadata" onLoadedData={() => setLoadedVideos((prev) => new Set(prev).add(ch.id))}>
                        <source src={ch.clip} type="video/mp4" />
                      </video>
                    )}
                    {ch.isPlaceholder && (
                      <div className="player-tag"><Play size={11} /> Placeholder clip — swap for your recording</div>
                    )}
                  </div>
                  {ch.clip.includes("youtube.com/embed") && (
                    <a className="video-fallback" href={ch.clip.replace("/embed/", "/watch?v=")} target="_blank" rel="noreferrer">
                      Trouble loading? Open on YouTube directly
                    </a>
                  )}
                  <div>
                    <div className="chapter-quiz-head">Practice questions for this chapter</div>
                    <ChapterQuiz
                      key={ch.id}
                      questions={ch.questions}
                      chapterTitle={ch.title}
                      onComplete={(pct, wrongQuestions) => markComplete(ch.id, pct, wrongQuestions)}
                      bookmarks={bookmarks}
                      onToggleBookmark={toggleBookmark}
                    />
                    <div className="chapter-feedback">
                      {fb ? (
                        <span className="chapter-feedback-thanks">Thanks for the feedback!</span>
                      ) : (
                        <>
                          <span>Was this chapter helpful?</span>
                          <button onClick={() => giveFeedback(ch.id, "up")} aria-label="Helpful"><ThumbsUp size={14} /></button>
                          <button onClick={() => giveFeedback(ch.id, "down")} aria-label="Not helpful"><ThumbsDown size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="chapters-empty">No chapters match "{query}".</p>}
      </div>
      <style>{`
        .chapters-wrap { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .cloud-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .cloud { position: absolute; width: 220px; height: 60px; background: radial-gradient(ellipse at center, var(--text) 0%, transparent 70%); opacity: 0.035; border-radius: 50%; filter: blur(6px); }
        .cloud-a { top: 4%; left: -15%; animation: driftA 60s linear infinite; }
        .cloud-b { top: 32%; left: -25%; animation: driftB 90s linear infinite; }
        .cloud-c { top: 62%; left: -20%; animation: driftA 75s linear infinite reverse; }
        @keyframes driftA { from { transform: translateX(0); } to { transform: translateX(140vw); } }
        @keyframes driftB { from { transform: translateX(0); } to { transform: translateX(160vw); } }
        .boarding-toast { position: relative; z-index: 2; background: var(--accent); color: var(--on-accent); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; padding: 8px 14px; border-radius: 10px; text-align: center; animation: toastFade 2.2s ease forwards; }
        @keyframes toastFade { 0% { opacity: 0; transform: translateY(-6px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
        .flightlog { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; }
        .flightlog-rank { display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text); }
        .flightlog-goal { flex: 1; min-width: 140px; }
        .flightlog-goal-label { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); margin-bottom: 4px; }
        .flightlog-goal-bar { height: 5px; border-radius: 3px; background: var(--border); overflow: hidden; }
        .flightlog-goal-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s ease; }
        .flightlog-hours { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted2); white-space: nowrap; }
        .trophy-case { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
        .trophy-badge { display: flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #D4AF37; border: 1px solid rgba(212,175,55,0.4); background: rgba(212,175,55,0.1); padding: 3px 8px; border-radius: 20px; }
        .review-card { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--panel-alt); border: 1px solid var(--border-hover); border-radius: 12px; padding: 10px 14px; font-size: 13px; color: var(--text); }
        .review-card .btn-primary { padding: 8px 14px; font-size: 12.5px; }
        .chapters-hint { position: relative; z-index: 1; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted2); padding: 4px 0; }
        .blackbox { position: relative; z-index: 1; background: var(--panel-alt); border: 1px solid var(--border-hover); border-radius: 14px; padding: 14px 16px; }
        .blackbox-title { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; color: var(--good); display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
        .blackbox-grid { display: flex; gap: 22px; }
        .blackbox-grid div { display: flex; flex-direction: column; }
        .blackbox-grid span { font-family: 'Space Grotesk', sans-serif; font-size: 20px; color: var(--text); font-weight: 700; }
        .blackbox-grid label { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.04em; }
        .chapters-search { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; color: var(--muted2); }
        .chapters-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .chapters-search input:focus { outline: none; }
        .chapters { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .chapters-empty { color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .chapter { border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--panel); }
        .chapter.is-open { border-color: var(--border-hover); }
        .chapter-head { display: grid; grid-template-columns: auto 1fr auto auto auto; align-items: center; gap: 10px; width: 100%; padding: 16px 16px; background: transparent; border: none; cursor: pointer; text-align: left; }
        .chapter-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); }
        .chapter-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); }
        .chapter-done { width: 18px; height: 18px; border-radius: 50%; background: var(--good); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chapter-meta { font-size: 11.5px; color: var(--muted2); font-family: 'JetBrains Mono', monospace; }
        .chapter-chevron { color: var(--muted2); transition: transform 0.2s ease; }
        .chapter.is-open .chapter-chevron { transform: rotate(90deg); }
        .chapter-body { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; padding: 16px 16px 20px; border-top: 1px solid var(--border-soft); min-height: 60px; }
        @media (max-width: 720px) { .chapter-body { grid-template-columns: 1fr; } }
        .chapter-body-opening { animation: chapterOpen 0.28s ease-out; }
        @keyframes chapterOpen { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .video-skeleton { position: absolute; inset: 0; background: linear-gradient(90deg, var(--panel-alt) 25%, var(--border) 50%, var(--panel-alt) 75%); background-size: 200% 100%; animation: skeletonShine 1.4s ease-in-out infinite; border-radius: 14px; }
        @keyframes skeletonShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .video-fallback { display: block; font-size: 11px; color: var(--muted2); text-decoration: none; margin-top: 6px; }
        .video-fallback:hover { color: var(--accent); }
        .chapter-video { aspect-ratio: 16/9; border-radius: 14px; background: var(--bg); border: 1px solid var(--border); position: relative; overflow: hidden; }
        .player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: var(--bg); border: none; }
        .player-tag { position: absolute; top: 10px; left: 10px; display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.03em; color: #cfe0ff; background: rgba(11,21,38,0.72); backdrop-filter: blur(4px); padding: 5px 9px; border-radius: 8px; border: 1px solid rgba(111,160,240,0.3); pointer-events: none; }
        .chapter-quiz-head { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted2); margin-bottom: 12px; }
        .chapter-feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-soft); font-size: 12.5px; color: var(--muted); }
        .chapter-feedback button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chapter-feedback button:hover { border-color: var(--accent); color: var(--accent); }
        .chapter-feedback-thanks { color: var(--good); }
      `}</style>
    </div>
  );
}

export default ChaptersPanel;
