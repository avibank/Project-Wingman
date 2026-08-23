import { useState, useEffect } from "react";
import { NotebookPen, Play, Search, SearchX, Check, ChevronRight, ChevronLeft, ThumbsUp, ThumbsDown, ClipboardCheck, MessageSquare, History, Plane } from "lucide-react";
import ChapterQuiz from "./ChapterQuiz.jsx";
import ChapterComments from "./ChapterComments.jsx";
import { CHAPTERS, chaptersForModule } from "../data.js";
import SlideOver from "./SlideOver.jsx";
import NotebookPanel from "./NotebookPanel.jsx";
import ThreadsPanel from "./ThreadsPanel.jsx";
import { countAnnotations } from "../lib/notebook.js";
import { countThreads } from "../lib/discussion.js";
import { heartbeat } from "../lib/presence.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useUser } from "@clerk/clerk-react";
import { useDisplayName } from "../lib/identity.js";
import { useSocialPrefs } from "../lib/social.js";
import { fetchWingmen, recordStudyDay, recordCompletion, fetchSharedCompletions } from "../lib/partners.js";
import StudyGlow from "./StudyGlow.jsx";
import Formation from "./Formation.jsx";
import { fetchProfile } from "../lib/squadron.js";

const MAX_RECENT = 5;

function ChaptersPanel({ onSignIn, activeModuleCode = "JT", initialChapterId = null, onInitialChapterConsumed, onReadingChange }) {
  // Only this module's chapters — the global list now spans five modules.
  const moduleChapters = chaptersForModule(activeModuleCode);
  // Slide-over state for the notebook / discussion entry points.
  const [panel, setPanel] = useState(null); // { kind: "notebook"|"threads", chapter }
  const [counts, setCounts] = useState({});
  // §7.6 — the glow is the user's own hue when nobody else is here, and it has
  // a settings toggle. Default on; the body stays fully usable at 0% glow.
  const [profile, setProfile] = useState(null);
  const ownLivery = profile?.livery || "dawn-patrol";
  const glowEnabled = profile ? profile.glow_enabled !== false : true;
  const progress = useUserProgress();
  const { user } = useUser();
  const displayName = useDisplayName();
  const { prefs: socialPrefs } = useSocialPrefs();
  const [parallaxY, setParallaxY] = useState(0);
  const [openId, setOpenId] = useState(null);
  // §7.6 — the body is its own surface, not a row that grew. `openId` still
  // means "where you left off"; `reading` means you are in it.
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState(new Set());
  const [bookmarks, setBookmarks] = useState(new Set());
  const [feedback, setFeedback] = useState({});
  const [seen, setSeen] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [loadedVideos, setLoadedVideos] = useState(new Set());
  // Chapters whose player the user has actually started; until then we show a
  // themed poster instead of YouTube's own chrome.
  const [startedVideos, setStartedVideos] = useState(new Set());
  const [bump, setBump] = useState(null);
  const [rightTab, setRightTab] = useState("quiz");
  const [recentIds, setRecentIds] = useState([]);
  const [chapterProgress, setChapterProgress] = useState({});
  const [viewedIds, setViewedIds] = useState(new Set());
  const [quizScores, setQuizScores] = useState({});

  useEffect(() => { onReadingChange?.(reading && !!openId); }, [reading, openId, onReadingChange]);

  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    fetchProfile(user.id).then((p) => live && setProfile(p)).catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!progress.loaded) return;
    const stored = progress.get("pw-last-chapter", null);
    setOpenId(moduleChapters.some((ch) => ch.id === stored) ? stored : moduleChapters[0]?.id ?? null);
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
    setReading(true);
    progress.set("pw-last-chapter", initialChapterId);

    const nextViewed = new Set(viewedIds);
    if (!nextViewed.has(initialChapterId)) {
      nextViewed.add(initialChapterId);
      setViewedIds(nextViewed);
      progress.set("pw-viewed-chapters", [...nextViewed]);
    }
    const nextRecent = [initialChapterId, ...recentIds.filter((x) => x !== initialChapterId)].slice(0, MAX_RECENT);
    setRecentIds(nextRecent);
    progress.set("pw-recent-chapters", nextRecent);

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

  // Completing a chapter is what "studied today" means for a joint streak; the
  // shared count only advances on a day both pilots did so.
  const logStudyDay = async () => {
    if (!user?.id) return;
    const pairs = await fetchWingmen(user.id);
    await Promise.all(pairs.map((w) => recordStudyDay(user.id, w.wingman_user_id)));
  };

  const markComplete = (id, pct) => {
    logStudyDay();
    if (user?.id) {
      recordCompletion(user.id, id, activeModuleCode);
      // If a wingman finished this same chapter nearby in time, say so.
      fetchWingmen(user.id).then(async (pairs) => {
        for (const w of pairs) {
          const shared = await fetchSharedCompletions(user.id, w.wingman_user_id, 24);
          if (shared.some((s) => s.chapter_id === id)) {
            setBump(w.display_name || "Your wingman");
            setTimeout(() => setBump(null), 6000);
            break;
          }
        }
      });
    }
    const nextCompleted = new Set(completed);
    nextCompleted.add(id);
    setCompleted(nextCompleted);
    progress.set("pw-completed", [...nextCompleted]);
    if (typeof pct === "number") {
      const nextScores = { ...quizScores, [id]: pct };
      setQuizScores(nextScores);
      progress.set("pw-quiz-scores", nextScores);
    }
  };

  const toggleBookmark = (qId) => {
    const next = new Set(bookmarks);
    next.has(qId) ? next.delete(qId) : next.add(qId);
    setBookmarks(next);
    progress.set("pw-bookmarks", [...next]);
  };

  const giveFeedback = (chapterId, value) => {
    const next = { ...feedback, [chapterId]: value };
    setFeedback(next);
    progress.set("pw-feedback", next);
  };

  const pushRecent = (id) => {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, MAX_RECENT);
    setRecentIds(next);
    progress.set("pw-recent-chapters", next);
  };

  const updateChapterProgress = (chapterId, seenCount) => {
    const next = { ...chapterProgress, [chapterId]: seenCount };
    setChapterProgress(next);
    progress.set("pw-chapter-progress", next);
  };

  // Chip counts and co-presence for whichever chapter is open.
  useEffect(() => {
    if (!openId) return;
    let live = true;
    Promise.all([countAnnotations(openId), countThreads(openId)]).then(([notes, threads]) => {
      if (live) setCounts((c) => ({ ...c, [openId]: { notes, threads } }));
    });
    const ping = () => {
      heartbeat({ userId: user?.id, displayName, moduleCode: activeModuleCode, chapterId: openId });
    };
    ping();
    const t = setInterval(ping, 45000);
    return () => { live = false; clearInterval(t); };
  }, [openId, activeModuleCode, user?.id, displayName]);

  const readingChapter = reading ? moduleChapters.find((c) => c.id === openId) || null : null;
  const readingPct = readingChapter
    ? Math.min(100, Math.round(((chapterProgress[readingChapter.id] || 0) / readingChapter.questions.length) * 100))
    : 0;

  const openChapter = (ch) => {
    setReading(true);
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

  const filtered = moduleChapters.filter((ch) => ch.title.toLowerCase().includes(query.toLowerCase()) || ch.code.toLowerCase().includes(query.toLowerCase()));
  const recentChapters = recentIds.map((id) => moduleChapters.find((ch) => ch.id === id)).filter(Boolean);

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
      {readingChapter && (
        <div className="reader-bar">
          <button className="reader-back" onClick={() => setReading(false)}>
            <ChevronLeft size={16} /> All chapters
          </button>
          <span className="reader-code">{readingChapter.code}</span>
          {/* §7.6 — a 2px cold-channel progress hairline at the top edge. */}
          <span className="reader-hairline" aria-hidden="true">
            <span className="reader-hairline-fill" style={{ width: `${readingPct}%` }} />
          </span>
        </div>
      )}

      <div className={`chapters ${readingChapter ? "is-reading" : ""}`}>
        {(readingChapter ? [readingChapter] : filtered).map((ch) => {
          const isOpen = openId === ch.id;
          const isDone = completed.has(ch.id);
          const fb = feedback[ch.id];
          const videoLoaded = loadedVideos.has(ch.id);
          const seenCount = chapterProgress[ch.id] || 0;
          const progressPct = Math.min(100, Math.round((seenCount / ch.questions.length) * 100));
          return (
            <div key={ch.id} className={`leg ${isOpen ? "is-open" : ""} ${isDone ? "is-done" : ""} ${isOpen && !isDone ? "is-current" : ""}`}>
              <span className="leg-rail" aria-hidden="true">
                <span className="leg-node">{isDone ? <Check size={11} strokeWidth={3} /> : <span className="leg-pip" />}</span>
              </span>
              <div className={`chapter ${isOpen ? "is-open" : ""}`}>
              <button className="chapter-head" onClick={() => openChapter(ch)}>
                {!viewedIds.has(ch.id) && !isDone && <span className="chapter-unread-dot" aria-label="Unopened" />}
                <span className="chapter-code">{ch.code}</span>
                <span className="chapter-title">{ch.title}</span>
                <span className="chapter-meta">{ch.questions.length} questions · {ch.duration}</span>
                <ChevronRight size={16} className="chapter-chevron" />
              </button>
              {progressPct > 0 && !isDone && (
                <div className="chapter-progress-track">
                  <div className="chapter-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              {/* §7.9 — Formation chrome sits around the body, never inside
                  it: the body keeps the social-free rule. */}
              {isOpen && (
                <div className="chapter-formation">
                  <Formation chapterId={ch.id} chapterCode={ch.code} moduleCode={activeModuleCode} />
                </div>
              )}

              {isOpen && (
                <div className="chapter-body chapter-body-opening">
                  {/* §7.6 — the body's one social element, and it is lighting,
                      not an element. At n = 0 it is 3% of the user's own hue. */}
                  <StudyGlow chapterId={ch.id} ownLivery={ownLivery} enabled={glowEnabled}
                    onSayHi={() => setPanel({ kind: "threads", chapter: ch })} />
                  <div className="chapter-video">
                    {!ch.clip ? (
                      <div className="video-none">
                        <Play size={16} />
                        <span>Briefing video not recorded yet — study material below.</span>
                      </div>
                    ) : null}
                    {ch.clip && !videoLoaded && !ch.isPlaceholder && startedVideos.has(ch.id) && <div className="video-skeleton" />}
                    {ch.clip && ch.clip.includes("youtube.com/embed") && !startedVideos.has(ch.id) ? (
                      <button
                        className="video-facade"
                        style={{ backgroundImage: `url(https://img.youtube.com/vi/${ch.clip.split("/embed/")[1]?.split(/[?&]/)[0]}/hqdefault.jpg)` }}
                        onClick={() => setStartedVideos((prev) => new Set(prev).add(ch.id))}
                        aria-label={`Play briefing video: ${ch.title}`}
                      >
                        <span className="video-facade-scrim" aria-hidden="true" />
                        <span className="video-facade-kicker">Briefing video · {ch.duration}</span>
                        <span className="video-facade-play" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
                      </button>
                    ) : ch.clip && ch.clip.includes("youtube.com/embed") ? (
                      <iframe
                        key={ch.id}
                        className="player-video"
                        src={`${ch.clip}${ch.clip.includes("?") ? "&" : "?"}autoplay=1`}
                        title={ch.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        onLoad={() => setLoadedVideos((prev) => new Set(prev).add(ch.id))}
                      />
                    ) : ch.clip ? (
                      <video key={ch.id} className="player-video" controls preload="metadata" onLoadedData={() => setLoadedVideos((prev) => new Set(prev).add(ch.id))}>
                        <source src={ch.clip} type="video/mp4" />
                      </video>
                    ) : null}
                    {ch.isPlaceholder && ch.clip && (
                      <div className="player-tag"><Play size={11} /> Placeholder clip — swap for your recording</div>
                    )}
                  </div>
                  {ch.clip && ch.clip.includes("youtube.com/embed") && (
                    <a className="video-fallback" href={ch.clip.replace("/embed/", "/watch?v=")} target="_blank" rel="noreferrer">
                      Trouble loading? Open on YouTube directly
                    </a>
                  )}
                  {Array.isArray(ch.body) && ch.body.length > 0 && (
                    <article className="chapter-material">
                      <p className="material-kicker">Study material</p>
                      {ch.body.map((sec) => (
                        <section key={sec.heading} className="material-section">
                          <h4 className="material-heading">{sec.heading}</h4>
                          <p className="material-text">{sec.text}</p>
                        </section>
                      ))}
                    </article>
                  )}
                  <aside className="manifest">
                    <p className="manifest-label">In this module</p>
                    <ol className="manifest-list">
                      {moduleChapters.map((mc) => (
                        <li key={mc.id} className={`manifest-item ${mc.id === ch.id ? "is-here" : ""} ${completed.has(mc.id) ? "is-done" : ""}`}>
                          <button onClick={() => mc.id !== ch.id && openChapter(mc)}>
                            <span className="manifest-code">{mc.code}</span>
                            <span className="manifest-title">{mc.title}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="manifest-meta">{completed.size} of {moduleChapters.length} logged</p>
                  </aside>
                  <div className="chapter-side">
                    <div className="chapter-side-tabs">
                      <button className={`chapter-side-tab ${rightTab === "quiz" ? "is-active" : ""}`} onClick={() => setRightTab("quiz")}>
                        <ClipboardCheck size={13} /> Quiz
                      </button>
                      <button className={`chapter-side-tab ${rightTab === "comments" ? "is-active" : ""}`} onClick={() => setRightTab("comments")}>
                        <MessageSquare size={13} /> Comments
                      </button>
                    </div>

                    {(readingChapter || rightTab === "quiz") ? (
                      <>
                        <ChapterQuiz
                          key={ch.id}
                          questions={ch.questions}
                          chapterTitle={ch.title}
                          onComplete={(pct) => markComplete(ch.id, pct)}
                          bookmarks={bookmarks}
                          onToggleBookmark={toggleBookmark}
                          chapterId={ch.id}
                          chapterCode={ch.code}
                          moduleCode={activeModuleCode}
                          onProgressChange={(seenCount) => updateChapterProgress(ch.id, seenCount)}
                        />
                        {/* §7.7 — the thumbs belong after the last question,
                            not beside a quiz you have not started. */}
                        {/* §7.6 — these carry counts, so they sit after the
                            quiz rather than in the body. The copresence line
                            they used to sit beside is gone: the glow says it. */}
                        <div className="chapter-social">
                          <button className="chip" onClick={() => setPanel({ kind: "notebook", chapter: ch })}>
                            <NotebookPen size={12} /> Notebook · {counts[ch.id]?.notes ?? 0} notes
                          </button>
                          <button className="chip" onClick={() => setPanel({ kind: "threads", chapter: ch })}>
                            <MessageSquare size={12} /> Discussion · {counts[ch.id]?.threads ?? 0} threads
                          </button>
                        </div>

                        <div className={`chapter-feedback ${isDone ? "" : "is-hidden"}`}>
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
      {bump && (
        <div className="bump" role="status">
          <span className="bump-icon" aria-hidden="true">✦</span>
          {bump} finished this one too. Nice formation.
        </div>
      )}
      {panel && (
        <SlideOver
          open
          title={panel.kind === "notebook" ? "Notebook" : "Discussion"}
          subtitle={`${panel.chapter.code} — ${panel.chapter.title}`}
          onClose={() => setPanel(null)}
        >
          {panel.kind === "notebook" ? (
            <NotebookPanel
              chapter={panel.chapter}
              moduleCode={activeModuleCode}
              prefs={socialPrefs}
              onCountChange={(n) => setCounts((c) => ({ ...c, [panel.chapter.id]: { ...c[panel.chapter.id], notes: n } }))}
            />
          ) : (
            <ThreadsPanel
              chapter={panel.chapter}
              moduleCode={activeModuleCode}
              prefs={socialPrefs}
              onCountChange={(n) => setCounts((c) => ({ ...c, [panel.chapter.id]: { ...c[panel.chapter.id], threads: n } }))}
            />
          )}
        </SlideOver>
      )}
      <style>{`
        /* ---- §7.6 the chapter body -------------------------------------- */
        /* Full-bleed, single column, no tab bar. The list, the leg rail, the
           filter and the recent row are all gone while you are reading. */
        .reader-bar { position: sticky; top: 0; z-index: 12; display: flex; align-items: center; gap: 10px;
          padding: 10px 0 12px; margin: 0 0 8px; background: var(--surface-0); }
        .reader-back { display: inline-flex; align-items: center; gap: 4px; min-height: 44px;
          padding: 0 8px 0 0; background: none; border: none; cursor: pointer;
          color: var(--text-2); font-size: 16px; }
        .reader-back:hover { color: var(--text-1); }
        .reader-code { font-family: var(--font-mono); font-size: 14px; color: var(--cold); }
        .reader-hairline { position: absolute; left: 0; right: 0; bottom: 0; height: 2px;
          background: var(--hairline); border-radius: 2px; overflow: hidden; }
        .reader-hairline-fill { display: block; height: 100%; background: var(--cold);
          transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }

        .chapters.is-reading { display: block; }
        .chapters.is-reading .leg-rail,
        .chapters.is-reading .chapter-chevron,
        .chapters.is-reading .chapter-meta,
        .chapters.is-reading .chapter-unread-dot,
        .chapters.is-reading .chapter-progress-track,
        .chapters.is-reading .manifest,
        .chapters.is-reading .chapter-side-tabs { display: none; }
        /* The leg is a two-column grid: rail, then chapter. Hiding the rail
           left the chapter sitting in the 34px rail column. */
        .chapters.is-reading .leg { display: block; }
        .chapters.is-reading .leg,
        .chapters.is-reading .chapter { border: none; background: none; padding-left: 0; margin: 0; }
        .chapters.is-reading .chapter-head { cursor: default; padding-left: 0; }
        /* single column at every width */
        .chapters.is-reading .chapter-body { grid-template-columns: 1fr; padding: 0; border-top: none; }

        /* Study material in the serif, 17/1.7, 66-character measure. */
        /* The ch unit is the width of zero in the element's own font. Setting the
           measure on a sans container while the prose renders in the serif
           resolved 66ch against the wrong font -- 665px came out at 64
           characters, not 66. */
        .chapters.is-reading .chapter-material { font-family: var(--font-serif);
          font-size: 17px; max-width: 66ch; margin: 24px auto 0; }
        .chapters.is-reading .material-text { font-family: var(--font-serif);
          font-size: 17px; line-height: 1.7; color: var(--text-1); }
        .chapters.is-reading .material-heading { font-family: var(--font-serif);
          font-size: 20px; font-weight: 600; color: var(--text-1); margin: 0 0 8px; }
        .chapters.is-reading .material-section { margin-bottom: 28px; }
        .chapters.is-reading .material-kicker { display: none; }
        .chapters.is-reading .chapter-video,
        .chapters.is-reading .exam,
        .chapters.is-reading .exam-done,
        .chapters.is-reading .chapter-feedback,
        .chapters.is-reading .chapter-social { max-width: 66ch; margin-left: auto; margin-right: auto; }

        .bump { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 35;
          display: flex; align-items: center; gap: 9px; background: var(--elev-1);
          border: 1px solid color-mix(in srgb, var(--presence) 34%, transparent); border-radius: var(--r-pill);
          padding: 10px 18px; font-size: 14px; color: var(--text); white-space: nowrap;
          animation: bumpIn 0.4s cubic-bezier(0.22,1,0.36,1); }
        .bump-icon { color: var(--presence); }
        @keyframes bumpIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .app.reduce-motion .bump { animation: none; }
        @media (prefers-reduced-motion: reduce) { .bump { animation: none; } }
        .manifest { grid-column: 1 / -1; border-top: 1px solid var(--border-soft); margin-top: 16px; padding-top: 14px; }
        .manifest-label { font-family: var(--font-ui); font-size: 12px;
          color: var(--muted); margin: 0 0 9px; }
        .manifest-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .manifest-item button { display: flex; align-items: baseline; gap: 9px; width: 100%; text-align: left; background: none;
          border: none; padding: 7px 2px; cursor: pointer; font-size: 12px; color: var(--muted); }
        .manifest-item button:hover { color: var(--text-soft); }
        .manifest-item.is-here button { color: var(--text); cursor: default; }
        .manifest-item.is-here .manifest-code { color: var(--text-primary); }
        .manifest-item.is-done .manifest-title { color: var(--muted); }
        .manifest-code { font-family: var(--font-mono); font-size: 12px; color: var(--accent-tint); flex-shrink: 0; }
        .manifest-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
        .manifest-meta { font-family: var(--font-mono); font-size: 12px; color: var(--muted2); margin: 8px 0 0; }
        @media (min-width: 900px) { .manifest { grid-column: auto; border-top: none; border-left: 1px solid var(--border-soft);
          margin-top: 0; padding-top: 0; padding-left: 18px; } }
        .chapter-social { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
        .chip { display: inline-flex; align-items: center; gap: 6px; background: var(--elev-1); border: 1px solid var(--border-soft);
          border-radius: var(--r-pill); padding: 7px 13px; color: var(--text-soft); font-size: 12px; cursor: pointer; min-height: 36px;
          transition: border-color 0.15s ease, color 0.15s ease; }
        .chip:hover { border-color: var(--border); color: var(--text); }
        .chapters-wrap { position: relative; display: flex; flex-direction: column; gap: 16px; }
        .cloud-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .cloud { position: absolute; width: 220px; height: 60px; background: radial-gradient(ellipse at center, var(--text) 0%, transparent 70%); opacity: 0.035; border-radius: 50%; filter: blur(6px); }
        .cloud-a { top: 4%; left: -15%; animation: driftA 60s linear infinite; }
        .cloud-b { top: 32%; left: -25%; animation: driftB 90s linear infinite; }
        .cloud-c { top: 62%; left: -20%; animation: driftA 75s linear infinite reverse; }
        @keyframes driftA { from { transform: translateX(0); } to { transform: translateX(140vw); } }
        @keyframes driftB { from { transform: translateX(0); } to { transform: translateX(160vw); } }
        .boarding-toast { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent); color: var(--on-accent); font-family: var(--font-ui); font-size: 12px; padding: 8px 14px; border-radius: var(--r-md); text-align: center; animation: toastFade 2.2s ease forwards; overflow: hidden; }
        .boarding-toast-plane { animation: toastPlaneSlide 2.2s ease-in-out; }
        @keyframes toastPlaneSlide {
          0% { transform: translateX(-14px) rotate(45deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(14px) rotate(45deg); opacity: 0; }
        }
        @keyframes toastFade { 0% { opacity: 0; transform: translateY(-6px); } 15% { opacity: 1; transform: translateY(0); } 80% { opacity: 1; } 100% { opacity: 0; } }
        .chapters-hint { position: relative; z-index: 1; text-align: center; font-family: var(--font-ui); font-size: 12px; color: var(--muted); padding: 4px 0; }
        .chapters-search { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; background: var(--well); border: 1px solid var(--border); box-shadow: var(--shadow-inset); border-radius: var(--r-md); padding: 10px 14px; color: var(--muted2); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .chapters-search:focus-within { border-color: var(--accent-soft); box-shadow: 0 0 12px 1px var(--accent-soft); }
        .chapters-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 14px; }
        .chapters-search input::placeholder { color: var(--muted); }
        .chapters-search input:focus { outline: none; }
        .recent-row { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; }
        .recent-row-label { display: flex; align-items: center; gap: 5px; font-family: var(--font-ui); font-size: 12px; color: var(--muted2); }
        .recent-row-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
        .recent-chip { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; background: var(--elev-1); border: 1px solid var(--border); border-radius: var(--r-md); padding: 8px 12px; cursor: pointer; max-width: 160px; text-align: left; }
        .recent-chip:hover { border-color: var(--accent); }
        .recent-chip-code { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }
        .recent-chip-title { font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .chapters { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .chapters-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; text-align: center; padding: 20px 0; }
        .chapters-empty-icon { color: var(--muted2); opacity: 0.6; }
        .chapters-empty p { margin: 0; max-width: 300px; }
        /* Chapters as a flight plan: one connected route, waypoint per leg. */
        .leg { position: relative; display: grid; grid-template-columns: 34px 1fr; align-items: start; }
        .leg-rail { position: relative; display: flex; justify-content: center; padding-top: 22px; align-self: stretch; }
        /* the route line, drawn between waypoints rather than around them */
        .leg-rail::before { content: ""; position: absolute; top: 0; bottom: -14px; width: 2px;
          background: linear-gradient(180deg, var(--border) 0%, var(--border) 100%); }
        .leg:first-child .leg-rail::before { top: 22px; }
        .leg:last-child .leg-rail::before { bottom: auto; height: 22px; }
        .leg.is-done .leg-rail::before { background: color-mix(in srgb, var(--accent) 55%, var(--border)); }
        .leg-node { position: relative; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; background: var(--elev-1); border: 1px solid var(--border-hover); color: var(--on-accent);
          flex-shrink: 0; transition: box-shadow 0.25s ease, background 0.25s ease, border-color 0.25s ease; }
        .leg-pip { width: 5px; height: 5px; border-radius: 50%; background: var(--muted2); }
        /* completed legs read as stamped */
        .leg.is-done .leg-node { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        /* the leg you are flying is the only thing that glows */
        .leg.is-current .leg-node { border-color: var(--presence); background: var(--elev-2);
          box-shadow: 0 0 0 4px var(--presence-glow); animation: legPulse 3.4s ease-in-out infinite; }
        .leg.is-current .leg-pip { background: var(--presence); }
        @keyframes legPulse {
          0%,100% { box-shadow: 0 0 0 3px var(--presence-glow); }
          50%     { box-shadow: 0 0 0 7px var(--presence-glow); }
        }
        .app.reduce-motion .leg.is-current .leg-node { animation: none; }
        @media (prefers-reduced-motion: reduce) { .leg.is-current .leg-node { animation: none; } }
        @media (max-width: 560px) { .leg { grid-template-columns: 24px 1fr; } }
        .chapter { border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--panel); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
        .chapter:hover { transform: translateY(-2px); }
        .chapter.is-open { border-color: var(--border-hover); }
        .chapter.is-open:hover { transform: none; }
        .chapter-head { display: grid; grid-template-columns: auto auto 1fr auto auto auto; align-items: center; gap: 10px; width: 100%; padding: 16px 16px; background: transparent; border: none; cursor: pointer; text-align: left; }
        .chapter-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent-soft); flex-shrink: 0; }
        .chapter-code { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }
        .chapter-title { font-family: var(--font-display); font-size: 16px; color: var(--text); }
        .chapter-done { width: 18px; height: 18px; border-radius: 50%; background: var(--good); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .chapter-meta { font-size: 12px; color: var(--muted); font-family: var(--font-mono); }
        .chapter-chevron { color: var(--muted2); transition: transform 0.2s ease; }
        .chapter.is-open .chapter-chevron { transform: rotate(90deg); }
        .chapter-progress-track { height: 3px; background: var(--border); margin: 0 16px 4px; border-radius: 2px; overflow: hidden; }
        .chapter-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }
        .chapter-formation { padding: 12px 16px 0; }
        .chapter-body { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; align-items: start; padding: 16px 16px 20px; border-top: 1px solid var(--border-soft); min-height: 60px; }
        @media (max-width: 720px) { .chapter-body { grid-template-columns: 1fr; } }
        @media (min-width: 1024px) { .chapter-body { grid-template-columns: 1.7fr 1fr; gap: 28px; } }
        .chapter-body-opening { animation: chapterOpen 0.28s ease-out; }
        @keyframes chapterOpen { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .video-facade { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: none; cursor: pointer;
          background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
        .video-facade-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7,14,26,0.35) 0%, rgba(7,14,26,0.78) 100%); }
        /* Sits over a YouTube thumbnail, so the scrim alone cannot guarantee
           a ratio -- the image underneath is arbitrary. It carries its own
           backing and full-strength text: it measured 2.33:1 before. */
        .video-facade-kicker { position: absolute; left: 12px; bottom: 11px; font-family: var(--font-ui); font-size: 12px; color: #FFF;
          background: rgb(0 0 0 / 0.62); padding: 3px 7px; border-radius: 6px; }
        .video-facade-play { position: relative; display: flex; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 50%;
          background: color-mix(in srgb, var(--accent) 92%, transparent); color: var(--on-accent);
          box-shadow: 0 6px 22px color-mix(in srgb, var(--accent) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.28);
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), background 0.18s ease; }
        .video-facade:hover .video-facade-play { transform: scale(1.06); background: var(--accent-hover); }
        .video-facade:active .video-facade-play { transform: scale(0.97); }
        .app.reduce-motion .video-facade-play { transition: none; }
        .video-none { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          color: var(--muted); font-size: 12px; text-align: center; padding: 20px;
          background: radial-gradient(circle at 50% 40%, var(--elev-2), var(--well)); }
        .chapter-material { margin-top: 16px; max-width: 62ch; }
        .material-kicker { font-family: var(--font-ui); font-size: 12px;
          color: var(--accent); opacity: 0.85; margin: 0 0 12px; }
        .material-section { margin-bottom: 16px; }
        .material-section:last-child { margin-bottom: 0; }
        .material-heading { font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--text); margin: 0 0 5px; }
        .material-text { font-size: 14px; line-height: 1.62; color: var(--text-soft); margin: 0; }
        .video-skeleton { position: absolute; inset: 0; background: linear-gradient(90deg, var(--panel-alt) 25%, var(--border) 50%, var(--panel-alt) 75%); background-size: 200% 100%; animation: skeletonShine 1.4s ease-in-out infinite; border-radius: var(--r-md); }
        @keyframes skeletonShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .video-fallback { display: block; font-size: 12px; color: var(--muted); text-decoration: none; margin-top: 6px; }
        .video-fallback:hover { color: var(--accent); }
        .chapter-video { aspect-ratio: 16/9; border-radius: var(--r-md); background: var(--bg); border: 1px solid var(--border); position: relative; overflow: hidden; }
        .player-video { width: 100%; height: 100%; display: block; object-fit: cover; background: var(--bg); border: none; }
        .player-tag { position: absolute; top: 10px; left: 10px; display: flex; align-items: center; gap: 5px; font-family: var(--font-ui); font-size: 12px; color: #cfe0ff; background: rgba(11,21,38,0.72); backdrop-filter: blur(4px); padding: 5px 9px; border-radius: var(--r-sm); border: 1px solid rgba(111,160,240,0.3); pointer-events: none; }
        .chapter-side-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: var(--r-md); padding: 4px; margin-bottom: 14px; }
        .chapter-side-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; background: transparent; border: none; color: var(--muted2); font-size: 12px; padding: 7px; border-radius: var(--r-sm); cursor: pointer; }
        .chapter-side-tab.is-active { background: var(--panel); color: var(--text); }
        .chapter-feedback.is-hidden { display: none; }
        .chapter-feedback { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-soft); font-size: 12px; color: var(--muted); }
        .chapter-feedback button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 28px; height: 28px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chapter-feedback button:hover { border-color: var(--accent); color: var(--accent); }
        .chapter-feedback-thanks { color: var(--good); }
      `}</style>
    </div>
  );
}

export default ChaptersPanel;
