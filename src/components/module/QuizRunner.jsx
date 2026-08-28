import { useState } from "react";
import { Check } from "lucide-react";

// The quiz engine. One question at a time, answer, see why, move on.
//
// Wrong answers are never red. Red in this system means a genuine danger
// state — deleting an account, losing work — and getting a question wrong on
// a practice quiz is neither. It is marked with --calm and the right answer is
// shown beside it, because the point of a practice question is the sentence
// that comes after it, not the mark.
export default function QuizRunner({ chapter, questions, onFinish, onQuit, run, onRun }) {
  // A quiz you walked away from resumes where you stopped, with what you had
  // already answered. Keeping the answers is the point: restoring only the
  // question number would score the run as though the earlier ones were wrong.
  const [at, setAt] = useState(run?.at || 0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState(run?.answers || []);

  const q = questions[at];
  const last = at === questions.length - 1;
  const correct = picked !== null && picked === q.correct;

  const choose = (i) => { if (picked === null) setPicked(i); };

  const next = () => {
    const kept = [...answers, { q: at, picked, right: picked === q.correct }];
    setAnswers(kept);
    setPicked(null);
    if (last) {
      onRun?.(null);
      onFinish(kept.filter((a) => a.right).length, questions.length);
    } else {
      setAt(at + 1);
      onRun?.({ at: at + 1, answers: kept, total: questions.length });
    }
  };

  return (
    <div className="quiz">
      <div className="qhead">
        <p className="cap">{chapter.title} · question {at + 1} of {questions.length}</p>
        <button type="button" className="qquit" onClick={onQuit}>Leave</button>
      </div>

      {/* Answered so far, as a run of lights — the same language the chapter
          rows use, so progress reads the same way everywhere. */}
      <div className="lights qlights" aria-hidden="true">
        {questions.map((_, i) => (
          <i key={i} className={`lg${i < answers.length ? " lit" : i === at ? " now" : ""}`} />
        ))}
      </div>

      <h2 className="qtext">{q.question}</h2>

      <div className="qopts" role="radiogroup" aria-label="Answers">
        {q.options.map((opt, i) => {
          const state = picked === null ? ""
            : i === q.correct ? " right"
            : i === picked ? " chosen"
            : "";
          return (
            <button key={i} type="button" role="radio" className={`qopt${state}`}
                    aria-checked={picked === i} disabled={picked !== null}
                    onClick={() => choose(i)}>
              <span className="qmark">
                {picked !== null && i === q.correct ? <Check aria-hidden="true" /> : null}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="qwhy" role="status">
          <p className="qverdict">{correct ? "That's it." : "Not this time."}</p>
          {q.explain && <p className="qexplain">{q.explain}</p>}
          <button type="button" className="nextgo" onClick={next}>
            {last ? "See how you did" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
