import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle2 } from "lucide-react";

function FlashcardMode({ questions, onExit }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const q = questions[index];

  const goNext = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % questions.length);
  };

  const goPrev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + questions.length) % questions.length);
  };

  if (!q) return null;

  return (
    <div className="flashcards">
      <div className="flashcards-head">
        <button className="flashcards-exit" onClick={onExit}>
          <ChevronLeft size={16} /> Back to list
        </button>
        <span className="flashcards-count">{index + 1} of {questions.length}</span>
      </div>

      <button className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <div className="flashcard-face flashcard-front">
            <span className="flashcard-hint">{q.chapterCode}</span>
            <p>{q.stem}</p>
            <span className="flashcard-tap"><RotateCw size={13} /> Tap to reveal answer</span>
          </div>
        ) : (
          <div className="flashcard-face flashcard-back">
            <span className="flashcard-hint">Answer</span>
            <p className="flashcard-answer"><CheckCircle2 size={16} /> {q.options[q.answer]}</p>
            <div className="flashcard-options">
              {q.options.map((opt, idx) => (
                <div key={idx} className={`flashcard-option ${idx === q.answer ? "is-correct" : ""}`}>
                  {String.fromCharCode(65 + idx)}. {opt}
                </div>
              ))}
            </div>
            <span className="flashcard-tap"><RotateCw size={13} /> Tap to flip back</span>
          </div>
        )}
      </button>

      <div className="flashcards-nav">
        <button onClick={goPrev} aria-label="Previous card"><ChevronLeft size={18} /></button>
        <button onClick={goNext} aria-label="Next card"><ChevronRight size={18} /></button>
      </div>

      <style>{`
        .flashcards { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .flashcards-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .flashcards-exit { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 12.5px; cursor: pointer; padding: 0; }
        .flashcards-count { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--muted); }
        .flashcard { width: 100%; max-width: 420px; min-height: 240px; background: var(--panel); border: 1px solid var(--border-hover); border-radius: 18px; padding: 0; cursor: pointer; perspective: 800px; }
        .flashcard-face { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px 22px; gap: 14px; min-height: 240px; }
        .flashcard-hint { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: var(--accent); text-transform: uppercase; }
        .flashcard-front p { font-family: 'Space Grotesk', sans-serif; font-size: 17px; color: var(--text); line-height: 1.4; margin: 0; }
        .flashcard-answer { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-size: 15px; color: var(--good); margin: 0; }
        .flashcard-options { display: flex; flex-direction: column; gap: 5px; width: 100%; text-align: left; margin-top: 4px; }
        .flashcard-option { font-size: 11.5px; color: var(--muted); padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); }
        .flashcard-option.is-correct { color: var(--good); border-color: var(--good); background: rgba(76,175,125,0.08); }
        .flashcard-tap { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted2); margin-top: 6px; }
        .flashcards-nav { display: flex; gap: 12px; }
        .flashcards-nav button { width: 40px; height: 40px; border-radius: 50%; background: var(--panel); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .flashcards-nav button:hover { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </div>
  );
}

export default FlashcardMode;
