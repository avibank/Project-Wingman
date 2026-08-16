import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { CHAPTERS } from "../data.js";

function BookmarksPage({ onBack }) {
  const [bookmarkIds, setBookmarkIds] = useState(() => loadJSON("pw-bookmarks", []));
  const allQuestions = CHAPTERS.flatMap((ch) => ch.questions.map((q) => ({ ...q, chapterTitle: ch.title, chapterCode: ch.code })));
  const bookmarkedQuestions = allQuestions.filter((q) => bookmarkIds.includes(q.id));

  const removeBookmark = (qId) => {
    const next = bookmarkIds.filter((id) => id !== qId);
    setBookmarkIds(next);
    saveJSON("pw-bookmarks", next);
  };

  return (
    <div className="bookmarks-page">
      <button className="bookmarks-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="bookmarks-title">My Bookmarks</h1>
      <div className="bookmarks-block">
        {bookmarkedQuestions.length === 0 ? (
          <p className="bookmarks-empty">No bookmarked questions yet — tap the star on any quiz question to save it here.</p>
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
        .bookmarks-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .bookmarks-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--text); margin: 0 0 16px; }
        .bookmarks-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 6px; }
        .bookmarks-empty { font-size: 12.5px; color: var(--muted2); padding: 16px; text-align: center; }
        .bookmarks-list { display: flex; flex-direction: column; gap: 2px; padding: 4px; }
        .bookmark-item { position: relative; padding: 12px 36px 12px 14px; border-radius: 10px; }
        .bookmark-item:hover { background: var(--panel-alt); }
        .bookmark-item-chapter { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); margin-bottom: 4px; }
        .bookmark-item-stem { font-size: 13px; color: var(--text); line-height: 1.4; }
        .bookmark-item-remove { position: absolute; top: 10px; right: 8px; background: transparent; border: none; color: var(--muted2); width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .bookmark-item-remove:hover { background: rgba(224,102,90,0.12); color: var(--bad); }
      `}</style>
    </div>
  );
}

export default BookmarksPage;
