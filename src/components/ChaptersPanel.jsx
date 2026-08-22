import { useState, useEffect } from "react";
import { Play, Search, SearchX, Check, ChevronRight, ThumbsUp, ThumbsDown, ClipboardCheck, MessageSquare, History, Plane } from "lucide-react";
import ChapterQuiz from "./ChapterQuiz.jsx";
import ChapterComments from "./ChapterComments.jsx";
import { CHAPTERS } from "../data.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { useUserProgress } from "../lib/userProgress.js";

const MAX_RECENT = 5;

function ChaptersPanel({ onSignIn, initialChapterId = null, onInitialChapterConsumed }) {
  const progress = useUserProgress();
  const [parallaxY, setParallaxY] = useState(0);
  const [openId, setOpenId] = useState(CHAPTERS[0].id);
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState(new Set());
  const [bookmarks, setBookmarks] = useState(new Set());
  const [feedback, setFeedback] = useState({});
  const [seen, setSeen] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [loadedVideos, setLoadedVideos] = useState(new Set());
  const [rightTab, setRightTab] = useState("quiz");
  const [recentIds, setRecentIds] = useState([]);
  const [chapterProgress, setChapterProgress] = useState({});
  const [viewedIds, setViewedIds] = useState(new Set());
  const [quizScores, setQuizScores] = useState({});

  useEffect(() => {
    if (!progress.loaded) return;
    setOpenId(progress.get("pw-last-chapter", CHAPTERS[0].id) ?? CHAPTERS[0].id);
    setCompleted(new Set(progress.get("pw-completed", [])));
    setBookmarks(new Set(progress.get("pw-bookmarks", [])));
    setFeedback(progress.get("pw-feedback", {}));
    setRecentIds(progress.get("pw-recent-chapters", []));
    setChapterProgress(progress.get("pw-chapter-progress", {}));
    setViewedIds(new Set(progress.get("pw-viewed-chapters", [])));
    setQuizScores(progress.get("pw-quiz-scores", {}));
  }, [progress.loaded, progress.isSignedIn]);

  // An explicit chapter handed down from the Flight Deck wins over the
  // restored pw-last-chapter. Passing it as a prop rather than routing it
  // through storage avoids racing this panel's own progress hydration.
  useEffect(() => {
    if (!progress.loaded || !initialChapterId) return;
    setOpenId(initialChapterId);
    progress.set("pw-last-chapter", initialChapterId);
    setViewedIds((prev) => {
      if (prev.has(initialChapterId)) return prev;
      const next = new Set(prev);
      next.add(initialChapterId);
      progress.set("pw-viewed-chapters", [...next]);
      return next;
    });
    setRecentIds((prev) => {
      const next = [initialChapterId, ...prev.filter((x) => x !== initialChapterId)].slice(0, MAX_RECENT);
      progress.set("pw-recent-chapters", next);
      return next;
    });
    onInitialChapterConsumed?.();
  }, [progress.loaded, initialChapterId]);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setParallaxY(window.scrollY * 0.04);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const markComplete = (id, pct) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      progress.set("pw-completed", [...next]);
      return next;
    });
    if (typeof pct === "number") {
      setQuizScores((prev) => {
        const next = { ...prev, [id]: pct };
        progress.set("pw-quiz-scores", next);
        return next;
      });
    }
  };

  const toggleBookmark = (qId) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      progress.set("pw-bookmarks", [...next]);
      return next;
    });
  };

  const giveFeedback = (chapterId, value) => {
    setFeedback((prev) => {
      const next = { ...prev, [chapterId]: value };
      progress.set("pw-feedback", next);
      return next;
    });
  };

  const pushRecent = (id) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      progress.set("pw-recent-chapters", next);
      return next;
    });
  };

  const updateChapterProgress = (chapterId, seenCount) => {
    setChapterProgress((prev) => {
      const next = { ...prev, [chapterId]: seenCount };
      progress.set("pw-chapter-progress", next);
      return next;
    });
  };

  const openChapter = (ch) => {
    const isOpen = openId === ch.id;
    if (isOpen) {
      setOpenId(null);
      progress.set("pw-last-chapter", null);
      return;
    }
    setOpenId(ch.id);
    progress.set("pw-last-chapter", ch.id);
    // Timestamped so the Flight Deck can report how long since real study
    // activity — pw-last-visit is day-granular and rewritten on every load.
    progress.set("pw-last-flown", new Date().toISOString());
    pushRecent(ch.id);
    setRightTab("quiz");
    if (!viewedIds.has(ch.id)) {
      setViewedIds((prev) => {
        const next = new Set(prev);
        next.add(ch.id);
        progress.set("pw-viewed-chapters", [...next]);
        return next;
      });
    }
    if (!seen.has(ch.id)) {
      setToast(`NOW BOARDING — ${ch.code}`);
      setSeen((s) => new Set(s).add(ch.id));
      setTimeout(() => setToast(null), 2200);
    }
  };

  const filtered = CHAPTERS.filter((ch) => ch.title.toLowerCase().includes(query.toLowerCase()) || ch.code.toLowerCase().includes(query.toLowerCase()));
  const recentChapters = recentIds.map((id) => CHAPTERS.find((ch) => ch.id === id)).filter(Boolean);

  return (
    <div className="chapters-wrap">
      <div className="cloud-layer" aria-hidden="true" style={{ transform: `translateY(${parallaxY}px)` }}>
        <span className="cloud cloud-a" />
        <span className="cloud cloud-b" />
        <span className="cloud cloud-c" />
      </div>
      {toast && (
        <div className="boarding-toast">
          <Plane size={13} className="boarding-toast-plane" style={{ transform: "rotate(45deg)" }} />
          {toast}
        </div>
      )}

      <div className="chapters-search">
        <Search size={15} />
        <input placeholder="Search chapters…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {recentChapters.length > 0 && !query && (
        <div className="recent-row">
          <div className="recent-row-label"><History size={12} /> Recently viewed</div>
          <div className="recent-row-scroll">
            {recentChapters.map((ch) => (
              <button key={ch.id} className="recent-chip" onClick={() => openChapter(ch)}>
                <span className="recent-chip-code">{ch.code}</span>
                <span className="recent-chip-title">{ch.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!seen.size && (
        <div className="chapters-hint">Tap a chapter below to begin ↓</div>
      )}
      <div className="chapters">
        {filtered.map((ch) => {
          const isOpen = openId === ch.id;
          const isDone = completed.has(ch.id);
          const fb = feedback[ch.id];
          const videoLoaded = loadedVideos.has(ch.id);
          const seenCount = chapterProgress[ch.id] || 0;
          const progressPct = Math.min(100, Math.round((seenCount / ch.questions.length) * 100));
          return (
            <div key={ch.id} className={`chapter ${isOpen ? "is-open" : ""}`}>
              <button className="chapter-head" onClick={() => openChapter(ch)}>
                {!viewedIds.has(ch.id) && !isDone && <span className="chapter-unread-dot" aria-label="Unopened" />}
                <span className="chapter-code">{ch.code}</span>
                <span className="chapter-title">{ch.title}</span>
                {isDone && (
                  <span className="chapter-done" title="Completed"><Check size={12} strokeWidth={3} /></span>
                )}
                <span className="chapter-meta">{ch.questions.length} questions · {ch.duration}</span>
                <ChevronRight size={16} className="chapter-chevron" />
              </button>
              {progressPct > 0 && !isDone && (
                <div className="chapter-progress-track">
                  <div className="chapter-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}
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
                  <div className="chapter-side">
                    <div className="chapter-side-tabs">
                      <button className={`chapter-side-tab ${rightTab === "quiz" ? "is-active" : ""}`} onClick={() => setRightTab("quiz")}>
                        <ClipboardCheck size={13} /> Quiz
                      </button>
                      <button className={`chapter-side-tab ${rightTab === "comments" ? "is-active" : ""}`} onClick={() => setRightTab("comments")}>
                        <MessageSquare size={13} /> Comments
                      </button>
                    </div>

                    {rightTab === "quiz" ? (
                      <>
                        <ChapterQuiz
                          key={ch.id}
                          questions={ch.questions}
                          chapterTitle={ch.title}
                          onComplete={(pct) => markComplete(ch.id, pct)}
                          bookmarks={bookmarks}
                          onToggleBookmark={toggleBookmark}
                          onProgressChange={(seenCount) => updateChapterProgress(ch.id, seenCount)}
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
                      </>
                    ) : (
                      <ChapterComments key={ch.id} chapterId={ch.id} onSignIn={onSignIn} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="chapters-empty">
            <SearchX size={28} className="chapters-empty-icon" />
            <p>No chapters match "{query}" — check your heading and try again.</p>
          </div>
        )}
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
        .boarding-toast { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent); color: var(--on-accent); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; letter-spacing: 0.08em; padding: 8px 14px; border-radius: var(--r-md); text-align: center; animation: toastFade 2.2s ease forwards; overflow: hidden; }
        .boarding-toast-plane { animation: toastPlaneSlide 2.2s ease-in-out; }
        @keyframes toastPlaneSlide {
          0% { transform: translateX(-14px) rotate(45deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(14px) rotate(45deg); opacity: 0; }
        }
        @keyframes toastFade { 0% { opacity: 0; transform: translateY(-6px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
        .chapters-hint { position: relative; z-index: 1; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); padding: 4px 0; }
        .chapters-search { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; background: var(--well); border: 1px solid var(--border); box-shadow: var(--shadow-inset); border-radius: var(--r-md); padding: 10px 14px; color: var(--muted2); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .chapters-search:focus-within { border-color: var(--accent-soft); box-shadow: 0 0 12px 1px var(--accent-soft); }
        .chapters-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .chapters-search input::placeholder { color: var(--muted); }
        .chapters-search input:focus { outline: none; }
        .recent-row { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; }
        .recent-row-label { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; color: var(--muted2); text-transform: uppercase; }
        .recent-row-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .recent-chip { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; background: var(--elev-1); border: 1px solid var(--border); border-radius: var(--r-md); padding: 8px 12px; cursor: pointer; max-width: 160px; text-align: left; }
        .recent-chip:hover { border-color: var(--accent); }
        .recent-chip-code { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--accent); }
        .recent-chip-title { font-size: 11.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .chapters { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .chapters-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .chapters-empty-icon { color: var(--muted2); opacity: 0.6; }
        .chapters-empty p { margin: 0; max-width: 300px; }
        .chapter { border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--panel); box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
        .chapter:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.16); }
        .chapter.is-open { border-color: var(--border-hover); }
        .chapter.is-open:hover { transform: none; }
        .chapter-head { display: grid; grid-template-columns: auto auto 1fr auto auto auto; align-items: center; gap: 10px; width: 100%; padding: 16px 16px; background: transparent; border: none; cursor: pointer; text-align: left; }
        .chapter-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent-soft); flex-shrink: 0; }
        .chapter-code { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--accent); }
        .chapter-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--text); }
        .chapter-done { width: 18px; height: 18px; border-radius: 50%; background: var(--good); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chapter-meta { font-size: 11.5px; color: var(--muted); font-family: 'JetBrains Mono', monospace; }
        .chapter-chevron { color: var(--muted2); transition: transform 0.2s ease; }
        .chapter.is-open .chapter-chevron { transform: rotate(90deg); }
        .chapter-progress-track { height: 3px; background: var(--border); margin: 0 16px 4px; border-radius: 2px; overflow: hidden; }
        .chapter-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
        .chapter-body { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; padding: 16px 16px 20px; border-top: 1px solid var(--border-soft); min-height: 60px; }
        @media (max-width: 720px) { .chapter-body { grid-template-columns: 1fr; } }
        @media (min-width: 1024px) { .chapter-body { grid-template-columns: 1.7fr 1fr; gap: 28px; } }
        .chapter-body-opening { animation: chapterOpen 0.28s ease-out; }
        @keyframes chapterOpen { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .video-skeleton { position: absolute; inset: 0; background: linear-gradient(90deg, var(--panel-alt) 25%, var(--border) 50%, var(--panel-alt) 75%); background-size: 200% 100%; animation: skeletonShine 1.4s ease-in-out infinite; border-radius: var(--r-md); }
        @keyframes skeletonShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .video-fallback { display: block; font-size: 11.5px; color: var(--muted); text-decoration: none; margin-top: 6px; }
        .video-fallback:hover { color: var(--accent); }
        .chapter-video { aspect-ratio: 16/9; border-radius: var(--r-md); background: var(--bg); border: 1px solid var(--border); position: relative; overflow: hidden; }
        .player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: var(--bg); border: none; }
        .player-tag { position: absolute; top: 10px; left: 10px; display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.03em; color: #cfe0ff; background: rgba(11,21,38,0.72); backdrop-filter: blur(4px); padding: 5px 9px; border-radius: var(--r-sm); border: 1px solid rgba(111,160,240,0.3); pointer-events: none; }
        .chapter-side-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: var(--r-md); padding: 4px; margin-bottom: 14px; }
        .chapter-side-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; background: transparent; border: none; color: var(--muted2); font-size: 11.5px; padding: 7px; border-radius: var(--r-sm); cursor: pointer; }
        .chapter-side-tab.is-active { background: var(--panel); color: var(--text); }
        .chapter-feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-soft); font-size: 12.5px; color: var(--muted); }
        .chapter-feedback button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 28px; height: 28px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chapter-feedback button:hover { border-color: var(--accent); color: var(--accent); }
        .chapter-feedback-thanks { color: var(--good); }
      `}</style>
    </div>
  );
}

export default ChaptersPanel;
