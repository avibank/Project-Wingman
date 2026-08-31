import QuizResults from "./QuizResults.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { LABELS } from "../../lib/quiz.js";
import { shuffleOptions, movedLine } from "../../lib/retention.js";
import "./quiz.css";

// ONE component, three uses: the chapter quiz, the calibration re-check, and
// putting caution questions right. Built once so the three cannot drift apart —
// they are the same interaction and a student should not have to learn it three
// times.
//
// This REVERSES Part 14's quiz, deliberately and on instruction. That brief
// said answer everything, submit, then review, because the model was the exam.
// This one says immediate feedback: answer, see why, move on, and never
// withhold results to the end. The newer instruction wins; the reversal is
// recorded here rather than resolved silently.
export default function Review({
  title, questions, isRetake = false,
  resumeAt = 0, onProgress, onAnswer, onDone, onLeave, onOpenLesson,
  // §6 — what the results screen needs. Review owns WHEN the sitting is over;
  // QuizResults owns WHAT is shown. Passed straight through rather than
  // recomputed here, so the average on this screen is the same object the
  // Library's dial reads.
  minimums, averageBefore = null, averageAfter = null, moduleName, onRecheck,
}) {
  // LATCHED AT MOUNT, deliberately. Read live, this flips the moment the first
  // attempt records its own score, and the result screen of a first sitting
  // then calls itself a retake. What matters is what it was when it started.
  const [retake] = useState(isRetake);
  // A SITTING IS A FIXED SET OF QUESTIONS, latched at mount. The put-right flow
  // is derived from what is currently in caution, so every question put right
  // leaves that list — and an array that shrinks under an index makes the sitting
  // skip questions and end early. Which questions you were given is decided when
  // you start, not renegotiated after every answer.
  const [set] = useState(questions);
  const [at, setAt] = useState(Math.min(resumeAt, Math.max(0, set.length - 1)));
  const [picked, setPicked] = useState(null);
  const [tally, setTally] = useState({ right: 0, toCaution: 0, toHolding: 0 });
  const [finished, setFinished] = useState(false);

  // Option order is shuffled per SITTING, not per render — seeded once so a
  // re-render cannot reshuffle under the student's fingers mid-question.
  const seed = useRef(Math.floor(Date.now() % 100000));
  const q = set[at];
  const shuffled = useMemo(
    () => (q ? shuffleOptions(q, seed.current + at * 17) : null), [q, at]);

  // Nothing is timed, and leaving keeps your place — but it has to SAY so, or
  // the student assumes it was thrown away and starts again.
  useEffect(() => { onProgress?.(at); }, [at]);


  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    const right = i === shuffled.correct;
    setTally((t) => ({
      right: t.right + (right ? 1 : 0),
      toCaution: t.toCaution + (right ? 0 : 1),
      toHolding: t.toHolding + (right ? 1 : 0),
    }));
    // The lifecycle moves on the answer, not at the end — so leaving halfway
    // still records what was learned.
    onAnswer?.(q, right);
  };

  const advance = () => {
    if (at + 1 >= set.length) { setFinished(true); onDone?.(tally); return; }
    setAt(at + 1);
    setPicked(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (picked === null && /^[123]$/.test(e.key)) { e.preventDefault(); choose(Number(e.key) - 1); }
      else if (picked !== null && (e.key === "Enter" || e.key === "ArrowRight")) { e.preventDefault(); advance(); }
      else if (e.key === "Escape") { e.preventDefault(); onLeave?.(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // After every hook: a conditional return before one changes hook order.
  if (!q) return null;

  if (finished) {
    // §6 — centred, short, and it says what moved. The re-check and put-right
    // flows share this component, and they have no module average to move, so
    // they simply pass none and the line is omitted.
    return (
      <QuizResults
        title={title} right={tally.right} total={set.length}
        minimums={minimums}
        averageBefore={averageBefore} averageAfter={averageAfter}
        retake={retake} moduleName={moduleName}
        // The re-check and put-right flows have no module average to move —
        // what moved for them is which questions changed pile. Same slot on
        // the screen, different sentence, and only ever one of the two.
        movedNote={averageAfter === null ? movedLine(tally) : null}
        onRecheck={onRecheck} onLeave={onLeave} />
    );
  }

  const answered = picked !== null;
  const right = answered && picked === shuffled.correct;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <div>
          <span className="quiz-where">{title}</span>
          <span className="quiz-name">Question {at + 1}</span>
        </div>
        <span className="quiz-count">of {set.length}</span>
        <button type="button" className="quiz-leave" onClick={onLeave}>Leave</button>
      </div>

      {/* A retake has to be visibly labelled, or a student grinds a quiz to full
          marks, watches the needle refuse to move, and concludes it is broken. */}
      {retake && <p className="q-retake">Retake — this does not move the accuracy needle.</p>}

      {/* Nothing is timed, and this is where leaving says it kept your place. */}
      <p className="q-rev-line">Nothing here is timed. Leaving keeps your place.</p>

      {/* Progress as segments, one per question. */}
      <div className="q-seg" role="group" aria-label={`Question ${at + 1} of ${set.length}`}>
        {set.map((_, i) => (
          <i key={i} className="q-seg-i" data-state={i < at ? "done" : i === at ? "now" : "todo"} />
        ))}
      </div>

      <div className="quiz-body">
        <div className="q-card">
          <p className="q-text">{q.question}</p>
          <div className="opts">
            {shuffled.options.map((opt, i) => {
              const mark = !answered ? undefined
                : i === shuffled.correct ? "right"
                  : i === picked ? "wrong" : undefined;
              return (
                <button key={i} type="button" className="opt"
                        aria-pressed={picked === i}
                        data-mark={mark}
                        disabled={answered}
                        onClick={() => choose(i)}>
                  <span className="opt-l">{LABELS[i]}</span>
                  <span className="opt-t">{opt}</span>
                  {/* The word as well as the colour, always. */}
                  {mark && <span className="opt-mark">{mark === "right" ? "Correct" : "Your answer"}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Immediate, with the reason — the teaching moment is here rather than
            at the end. */}
        {answered && (
          <div className="q-rev">
            <p className="q-rev-line">{right ? "Right." : "Not this time."}</p>
            {q.explain && <p className="q-rev-explain">{q.explain}</p>}
            {q.lessonId && onOpenLesson && (
              <button type="button" className="q-rev-lesson" onClick={() => onOpenLesson(q.lessonId)}>
                Watch the lesson this came from
              </button>
            )}
          </div>
        )}
      </div>

      <div className="quiz-foot">
        {answered && (
          <button type="button" className="q-btn" data-primary="" onClick={advance}>
            {at + 1 >= set.length ? "See what moved" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
