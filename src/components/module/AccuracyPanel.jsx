import { useEffect } from "react";
import { passAt } from "../../lib/quiz.js";
import "./instruments.css";

// What the ammeter is reading, chapter by chapter. It exists because the needle
// shows ONE number and a student is owed the working: which chapters are under
// the pass mark, and that the figure is the first attempt rather than the best
// one. Without that, someone grinds a quiz to full marks, watches the needle
// refuse to move, and concludes the app is broken.
export default function AccuracyPanel({ chapters = [], scores = {}, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const taken = chapters
    .map((c) => ({ c, s: scores[c.id] }))
    .filter((r) => r.s);
  const pct = (s) => Math.round((s.correct / s.total) * 100);
  const mark = (s) => Math.round((passAt(s.total) / s.total) * 100);
  const mean = taken.length
    ? Math.round(taken.reduce((n, r) => n + pct(r.s), 0) / taken.length) : null;

  return (
    <div className="ipanel" role="dialog" aria-modal="true" aria-label="Accuracy">
      <div className="ipanel-card">
        <div className="ipanel-head">
          <span className="ipanel-title">Accuracy</span>
          <button type="button" className="ipanel-close" onClick={onClose}>Close</button>
        </div>

        {taken.length === 0 ? (
          <p className="ipanel-empty">
            The needle picks this up from your first attempt at each chapter quiz.
          </p>
        ) : (
          <>
            <ul className="ipanel-list">
              {taken.map(({ c, s }) => {
                const p = pct(s), m = mark(s);
                return (
                  <li key={c.id} className="ipanel-row">
                    <span className="ipanel-name">{c.title}</span>
                    <span className="ipanel-fig" data-under={p < m ? "1" : undefined}>
                      {p}%
                    </span>
                    <span className="ipanel-mark">pass {m}%</span>
                  </li>
                );
              })}
            </ul>
            <p className="ipanel-foot">
              Module average {mean}% across {taken.length} quiz{taken.length === 1 ? "" : "zes"} —
              first attempts only. A retake does not move it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
