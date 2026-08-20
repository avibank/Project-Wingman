import { useState, useEffect } from "react";
import { ChevronRight, Star, CheckCircle2, XCircle, Plane } from "lucide-react";

function ChapterQuiz({ questions, chapterTitle, onComplete, bookmarks, onToggleBookmark, onProgressChange }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ correct: 0, seen: 0 });
  const [done, setDone] = useState(false);
  const [flashIdx, setFlashIdx] = useState(null);
  const q = questions[i];

  const advance = (currentScore) => {
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
    } else {
      const pct = Math.round((currentScore.correct / questions.length) * 100);
      setDone(true);
      onComplete?.(pct);
    }
  };

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    const correct = idx === q.answer;
    const updatedScore = { correct: score.correct + (correct ? 1 : 0), seen: score.seen + 1 };
    onProgressChange?.(updatedScore.seen);
    if (correct) {
      setFlashIdx(idx);
      setTimeout(() => setFlashIdx(null), 500);
      setTimeout(() => advance(updatedScore), 900);
    }
    setScore(updatedScore);
  };

  const next = () => advance(score);

  // Keyboard support: 1-4 or A-D to pick an answer, Enter to continue after a wrong answer
  useEffect(() => {
    if (done) return;
    const handler = (e) => {
      const key = e.key.toLowerCase();
      const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
      if (key in map && map[key] < q.options.length) {
        choose(map[key]);
      } else if (key === "enter" && picked !== null) {
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const restart = () => {
    setI(0);
    setPicked(null);
    setScore({ correct: 0, seen: 0 });
    setDone(false);
    onProgressChange?.(0);
  };

  if (done) {
    const pct = Math.round((score.correct / questions.length) * 100);
    const isRough = pct < 50;
    const statusLine =
      pct >= 90 ? "Cruising" :
      pct >= 70 ? "Steady altitude" :
      pct >= 50 ? "Light turbulence" :
      "Holding pattern";

    return (
      <div className="exam-done">
        <div className="landing-strip">
          <Plane size={20} className={`landing-plane ${isRough ? "is-rough" : "is-smooth"}`} />
          <div className="runway" />
        </div>
        <h3>{statusLine}</h3>
        <p>{chapterTitle}</p>
        <button className="btn-primary" onClick={restart}>Retake set</button>
        <style>{`
          .exam-done { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px 20px; text-align: center; overflow: hidden; }
          .exam-done h3 { font-family: 'Space Grotesk', sans-serif; color: var(--text); margin: 6px 0 0; font-size: 16px; }
          .exam-done p { color: var(--muted); font-size: 12.5px; margin: 0 0 8px; }
          .landing-strip { position: relative; height: 50px; width: 100%; max-width: 220px; margin: 4px 0; }
          .runway { position: absolute; left: 0; right: 0; bottom: 8px; height: 2px; background: var(--border); }
          .landing-plane { position: absolute; color: var(--accent); }
          .landing-plane.is-smooth { animation: landSmooth 1.6s ease-out forwards; }
          .landing-plane.is-rough { animation: landRough 1.8s ease-out forwards; }
          @keyframes landSmooth {
            0% { left: -10%; top: -6px; opacity: 0; transform: rotate(-14deg); }
            20% { opacity: 1; }
            75% { left: 62%; top: 22px; transform: rotate(-5deg); }
            100% { left: 85%; top: 34px; transform: rotate(0deg); opacity: 1; }
          }
          @keyframes landRough {
            0% { left: -10%; top: -6px; opacity: 0; transform: rotate(-16deg); }
            20% { opacity: 1; }
            60% { left: 55%; top: 24px; transform: rotate(-8deg); }
            72% { top: 34px; }
            80% { top: 14px; }
            90% { top: 30px; }
            100% { left: 85%; top: 34px; transform: rotate(-2deg); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  const bookmarked = bookmarks.has(q.id);

  return (
    <div className="exam">
      <div className="exam-head">
        <span className="exam-count">Question {i + 1} of {questions.length}</span>
        <div className="exam-head-right">
          <button
            className={`exam-bookmark ${bookmarked ? "is-on" : ""}`}
            onClick={() => onToggleBookmark(q.id)}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this question"}
          >
            <Star size={15} fill={bookmarked ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <p className="exam-stem">{q.stem}</p>
      <div className="exam-options">
        {q.options.map((opt, idx) => {
          const state = picked === null ? "idle" : idx === q.answer ? "correct" : idx === picked ? "wrong" : "idle";
          return (
            <button key={idx} className={`exam-opt exam-opt--${state} ${flashIdx === idx ? "is-flash" : ""}`} onClick={() => choose(idx)}>
              <span className="exam-opt-letter">{String.fromCharCode(65 + idx)}</span>
              <span>{opt}</span>
              {state === "correct" && <CheckCircle2 size={16} color="var(--good)" />}
              {state === "wrong" && <XCircle size={16} color="var(--bad)" />}
            </button>
          );
        })}
      </div>
      {picked !== null && picked !== q.answer && (
        <button className="btn-primary exam-continue" onClick={next}>
          {i + 1 < questions.length ? "Next question" : "See results"} <ChevronRight size={16} />
        </button>
      )}
      <style>{`
        .exam-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .exam-head-right { display: flex; align-items: center; gap: 10px; }
        .exam-count { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); }
        .exam-bookmark { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .exam-bookmark:hover { border-color: var(--accent); color: var(--accent); }
        .exam-bookmark.is-on { color: #F2C230; border-color: #F2C230; }
        .exam-stem { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: var(--text); line-height: 1.4; margin: 0 0 16px; }
        .exam-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .exam-opt { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 13px; border-radius: 14px; border: 1px solid var(--border); background: var(--panel-alt); color: var(--text); font-size: 13.5px; cursor: pointer; }
        .exam-opt:hover { border-color: var(--border-hover); }
        .exam-opt-letter { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted2); border: 1px solid var(--border); border-radius: 8px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .exam-opt--correct { border-color: var(--good); background: rgba(76,175,125,0.08); }
        .exam-opt--wrong { border-color: var(--bad); background: rgba(224,102,90,0.08); }
        .exam-opt--correct span:last-child, .exam-opt--wrong span:last-child { margin-left: auto; }
        .exam-opt.is-flash { animation: flashGlow 0.5s ease-out; }
        @keyframes flashGlow {
          0% { box-shadow: 0 0 0 rgba(76,175,125,0); }
          40% { box-shadow: 0 0 18px rgba(76,175,125,0.55); }
          100% { box-shadow: 0 0 0 rgba(76,175,125,0); }
        }
        .exam-opt:focus-visible, .exam-bookmark:focus-visible, .btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        @media (max-width: 720px) {
          .exam-continue { position: sticky; bottom: 12px; width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default ChapterQuiz;
