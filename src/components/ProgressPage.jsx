import { useState, useEffect } from "react";
import { ChevronLeft, Flame, BookMarked, CheckCircle2 } from "lucide-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { CHAPTERS } from "../data.js";

function ProgressPage({ onBack }) {
  const progress = useUserProgress();
  const [completedChapters, setCompletedChapters] = useState([]);
  const [bookmarkIds, setBookmarkIds] = useState([]);
  const [longestStreak, setLongestStreak] = useState(0);
  const totalChapters = CHAPTERS.length;

  useEffect(() => {
    if (!progress.loaded) return;
    setCompletedChapters(progress.get("pw-completed", []));
    setBookmarkIds(progress.get("pw-bookmarks", []));
    setLongestStreak(progress.get("pw-longest-streak", 0));
  }, [progress.loaded, progress.isSignedIn]);

  return (
    <div className="progress-page">
      <button className="progress-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="progress-title">My Progress</h1>
      <div className="progress-block">
        <div className="progress-stat">
          <div className="progress-stat-icon"><CheckCircle2 size={18} /></div>
          <div>
            <div className="progress-stat-value">{completedChapters.length} <span className="progress-stat-of">/ {totalChapters}</span></div>
            <div className="progress-stat-label">Chapters completed</div>
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-icon"><Flame size={18} /></div>
          <div>
            <div className="progress-stat-value">{longestStreak}</div>
            <div className="progress-stat-label">Longest streak (days)</div>
          </div>
        </div>
        <div className="progress-stat">
          <div className="progress-stat-icon"><BookMarked size={18} /></div>
          <div>
            <div className="progress-stat-value">{bookmarkIds.length}</div>
            <div className="progress-stat-label">Bookmarked questions</div>
          </div>
        </div>
      </div>
      <style>{`
        .progress-page { max-width: 560px; }
        .progress-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent-muted); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .progress-title { font-family: var(--font-display); font-size: 22px; color: var(--text); margin: 0 0 16px; }
        .progress-block { background: var(--elev-1); border: 1px solid var(--border); box-shadow: var(--shadow-1); border-radius: var(--r-lg); padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .progress-stat { display: flex; align-items: center; gap: 14px; padding: 12px; }
        .progress-stat-icon { width: 40px; height: 40px; border-radius: var(--r-md); background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .progress-stat-value { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text); }
        .progress-stat-of { font-size: 14px; color: var(--muted2); font-weight: 500; }
        .progress-stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}

export default ProgressPage;
