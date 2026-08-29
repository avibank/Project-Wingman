import { useEffect, useReducer, useState } from "react";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import {
  LABELS, estimate, passAt, newAttempt, answer, flag, goTo, next, prev,
  submitWarning, submit, score, review, retakeWrong,
  saveAttempt, loadAttempt, clearAttempt, resumeLine, quizKey, navigator as navSquares,
} from "../../lib/quiz.js";
import "./quiz.css";

// The quiz, shaped after the exam these students will actually sit.
//
// EASA Part-66 basic examinations use three alternatives labelled (A), (B) and
// (C), one correct and two plausible-but-incomplete, with a 75% pass mark and a
// nominal 75 seconds a question. So three options is not a style preference: it
// is the format they are training toward, and it settles the pass mark and the
// time estimate for free.
//
// IT IS NOT A PART-66 EXAMINATION and nothing here may imply that it is. No
// certificates, no "you passed", no module numbers mirroring the real syllabus.
// "Pass mark is 6" is a study target.
export default function QuizRunner({ chapter, questions, onFinish, onQuit, onOpenLesson }) {
  const quiz = { id: chapter.id, questions };

  // Restored rather than started, if there is something to restore. The worst
  // thing that could happen in the beta is eight answers vanishing because
  // somebody walked past a dead spot on campus wifi.
  const [attempt, dispatch] = useReducer((a, ev) => {
    switch (ev.type) {
      case "answer": return saveAttempt(answer(a, a.at, ev.choice));
      case "flag":   return saveAttempt(flag(a, a.at));
      case "goTo":   return saveAttempt(goTo(a, ev.index, questions.length));
      case "next":   return saveAttempt(next(a, questions.length));
      case "prev":   return saveAttempt(prev(a, questions.length));
      case "submit": return saveAttempt(submit(a));
      default: return a;
    }
  }, null, () => loadAttempt(chapter.id) || newAttempt(quiz));

  const [warned, setWarned] = useState(null);
  const [started] = useState(() => Boolean(loadAttempt(chapter.id)));
  const done = Boolean(attempt.submittedAt);
  const s = done ? score(attempt, quiz) : null;

  // 1/2/3 to answer, Enter to advance, f to flag — and dead while anything is
  // being typed into, the same guard as everywhere else.
  useEffect(() => {
    if (done) return undefined;
    const onKey = (e) => {
      const a = quizKey(e);
      if (!a) return;
      e.preventDefault();
      if (a.type === "answer" && a.choice < questions.length) dispatch({ type: "answer", choice: a.choice });
      else if (a.type === "next") dispatch({ type: "next" });
      else if (a.type === "prev") dispatch({ type: "prev" });
      else if (a.type === "flag") dispatch({ type: "flag" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [done, questions.length]);

  // Cleared only once the score is recorded, never before.
  useEffect(() => {
    if (!done) return;
    onFinish?.(s.right, s.total);
    clearAttempt(chapter.id);
  }, [done]);

  if (done) return <Result s={s} attempt={attempt} quiz={quiz} onQuit={onQuit} onOpenLesson={onOpenLesson} />;

  const q = questions[attempt.at];
  const resumed = !warned && started ? resumeLine(attempt) : null;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <div>
          <span className="quiz-where">{chapter.title}</span>
          <span className="quiz-name">Question {attempt.at + 1}</span>
        </div>
        <span className="quiz-count">of {questions.length}</span>
        <button type="button" className="quiz-leave" onClick={onQuit}>Leave</button>
      </div>

      {/* A half-finished paper says so rather than silently filling itself in. */}
      {resumed && <p className="q-rev-line">{resumed}</p>}

      <div className="quiz-body">
        <div className="q-card">
          <p className="q-text">{q.question}</p>

          {/* Stacked and lettered, never a 2x2 grid: real maintenance options
              are full sentences and a grid of sentences is a mess. The letter
              also gives students a shared vocabulary — "what did you get for 4?
              I put C." */}
          <div className="opts">
            {q.options.map((opt, i) => (
              <button key={i} type="button" className="opt"
                      aria-pressed={attempt.answers[attempt.at] === i}
                      onClick={() => dispatch({ type: "answer", choice: i })}>
                <span className="opt-l">{LABELS[i]}</span>
                <span className="opt-t">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* One square per question: answered, current, blank — and flagged as a
            separate mark, because a question can be both. */}
        <div className="nav" role="group" aria-label="Questions">
          {navSquares(attempt).map((sq) => (
            <button key={sq.index} type="button" className="nav-sq"
                    data-state={sq.state} data-flagged={sq.flagged ? "1" : undefined}
                    aria-label={`Question ${sq.n}${sq.flagged ? ", flagged" : ""}`}
                    onClick={() => dispatch({ type: "goTo", index: sq.index })}>
              {sq.n}
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-foot">
        <button type="button" className="q-move" onClick={() => dispatch({ type: "prev" })}
                disabled={attempt.at === 0} aria-label="Previous question">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" className="q-flag" aria-pressed={attempt.flagged[attempt.at]}
                onClick={() => dispatch({ type: "flag" })}>
          <Flag aria-hidden="true" /> Flag
        </button>

        {attempt.at === questions.length - 1 ? (
          <button type="button" className="q-btn" data-primary=""
                  onClick={() => {
                    const wrn = submitWarning(attempt);
                    // Allowed, but it has to say so first: leaving one blank by
                    // accident is the commonest way to lose a mark you knew.
                    if (wrn && warned !== wrn) { setWarned(wrn); return; }
                    dispatch({ type: "submit" });
                  }}>
            {warned ? `${warned} Submit anyway` : "Submit"}
          </button>
        ) : (
          <button type="button" className="q-move" onClick={() => dispatch({ type: "next" })}
                  aria-label="Next question">
            <ChevronRight aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="q-rev-line">{estimate(questions.length)} · pass mark is {passAt(questions.length)}</p>
    </div>
  );
}

// The review is the teaching moment: what you chose, what was right, why, and
// the lesson it came from — a join on lessonId, never a semantic match.
function Result({ s, attempt, quiz, onQuit, onOpenLesson }) {
  const [retake, setRetake] = useState(null);
  const wrong = review(attempt, quiz);

  if (retake) {
    return (
      <QuizRunner chapter={{ id: retake.quiz.id, title: "Just the misses" }}
                  questions={retake.quiz.questions}
                  onQuit={() => setRetake(null)} onOpenLesson={onOpenLesson} />
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-head">
        <span className="quiz-name">Marked</span>
        <button type="button" className="quiz-leave" onClick={onQuit}>Close</button>
      </div>

      <div className="quiz-body">
        {/* A count against what you needed, never a percentage. */}
        <p className="q-score">{s.right}<span className="q-score-line"> of {s.total}</span></p>
        <p className="q-score-line">pass mark is {s.need}</p>

        {wrong.length > 0 && (
          <div className="q-review">
            {wrong.map((r) => (
              <div key={r.index} className="q-rev">
                <p className="q-rev-q">{r.index + 1}. {r.question}</p>
                <p className="q-rev-line">
                  {/* The word as well as the colour: about one man in twelve
                      cannot separate those two hues. */}
                  <span data-mark="wrong">You chose {r.choseLabel || "nothing"}</span>
                  {r.chose ? ` — ${r.chose}` : ""}
                </p>
                <p className="q-rev-line">
                  <span data-mark="right">Right answer {r.correctLabel}</span> — {r.correct}
                </p>
                {r.explain && <p className="q-rev-explain">{r.explain}</p>}
                {r.lessonId && (
                  <button type="button" className="q-rev-lesson"
                          onClick={() => onOpenLesson?.(r.lessonId)}>
                    Watch the lesson this came from
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="quiz-foot">
        {/* The most useful revision feature for the least work. */}
        {wrong.length > 0 && (
          <button type="button" className="q-btn" data-primary=""
                  onClick={() => setRetake(retakeWrong(attempt, quiz))}>
            Retake the {wrong.length} you missed
          </button>
        )}
        <button type="button" className="q-btn" onClick={onQuit}>Done</button>
      </div>
    </div>
  );
}
