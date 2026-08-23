import { useState, useEffect } from "react";
import { ChevronLeft, X, Layers, Briefcase } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { CHAPTERS } from "../data.js";
import FlashcardMode from "./FlashcardMode.jsx";

function BookmarksPage({ onBack, initialMode = "list" }) {
  const progress = useUserProgress();
  const [bookmarkIds, setBookmarkIds] = useState([]);
  const [mode, setMode] = useState(initialMode); // "list" | "cards"
  const allQuestions = CHAPTERS.flatMap((ch) => ch.questions.map((q) => ({ ...q, chapterTitle: ch.title, chapterCode: ch.code })));
  const bookmarkedQuestions = allQuestions.filter((q) => bookmarkIds.includes(q.id));

  useEffect(() => {
    if (!progress.loaded) return;
    setBookmarkIds(progress.get("pw-bookmarks", []));
  }, [progress.loaded, progress.isSignedIn]);

  const removeBookmark = (qId) => {
    const next = bookmarkIds.filter((id) => id !== qId);
    setBookmarkIds(next);
    progress.set("pw-bookmarks", next);
  };

  if (mode === "cards" && bookmarkedQuestions.length > 0) {
    return (
      <div className="bookmarks-page">
        <FlashcardMode questions={bookmarkedQuestions} onExit={() => setMode("list")} />
        <style>{`.bookmarks-page { max-width: 560px; }`}</style>
      </div>
    );
  }

  return (
    <div className="bookmarks-page">
      <button className="bookmarks-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <div className="bookmarks-title-row">
        <h1 className="bookmarks-title">Saved</h1>
        {bookmarkedQuestions.length > 0 && (
          <button className="bookmarks-flashcard-btn" onClick={() => setMode("cards")}>
            <Layers size={14} /> Flashcards
          </button>
        )}
      </div>
      <div className="bookmarks-block">
        {bookmarkedQuestions.length === 0 ? (
          <div className="bookmarks-empty">
            <Briefcase size={28} className="bookmarks-empty-icon" />
            <p>Star a question during a quiz and it lands here.</p>
          </div>
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
      <style>{`
        .bookmarks-page { max-width: 560px; }
        .bookmarks-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent-muted); font-size: 12px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .bookmarks-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .bookmarks-title { font-family: var(--font-display); font-size: 20px; color: var(--text); margin: 0; }
        .bookmarks-flashcard-btn { display: flex; align-items: center; gap: 6px; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-md); padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .bookmarks-flashcard-btn:hover { background: var(--accent-hover); }
        .bookmarks-block { background: var(--elev-1); border: 1px solid var(--border); box-shadow: var(--shadow-1); border-radius: var(--r-lg); padding: 8px; }
        .bookmarks-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 24px 16px; }
        .bookmarks-empty-icon { color: var(--muted2); opacity: 0.6; }
                .bookmarks-empty p { margin: 0; font-size: 12px; color: var(--muted); max-width: 260px; }
        .bookmarks-list { display: flex; flex-direction: column; gap: 2px; padding: 4px; }
        .bookmark-item { position: relative; padding: 12px 36px 12px 14px; border-radius: var(--r-md); }
        .bookmark-item:hover { background: var(--panel-alt); }
        .bookmark-item-chapter { font-family: var(--font-mono); font-size: 12px; color: var(--accent); margin-bottom: 4px; }
        .bookmark-item-stem { font-size: 12px; color: var(--text); line-height: 1.4; }
        .bookmark-item-remove { position: absolute; top: 10px; right: 8px; background: transparent; border: none; color: var(--muted2); width: 24px; height: 24px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bookmark-item-remove:hover { background: rgba(224,102,90,0.12); color: var(--bad); }
      `}</style>
    </div>
  );
}

export default BookmarksPage;
