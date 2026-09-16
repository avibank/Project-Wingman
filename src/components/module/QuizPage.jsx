import { ChevronLeft } from "lucide-react";
import Exam from "./Exam.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
import "./module.css";
import "./lesson.css";

/* THE QUIZ OPENS ON THE PAPER, and that is the whole of this file now.

   There used to be a cover here: the question count, the pass mark, the
   estimate, "You got 4 of 8", a sentence about the Library sharing one score,
   a Start button, and a Next / Lesson 1 / Continue block underneath it. The
   approved exam screen takes all of it — a student who pressed Quiz meant
   Quiz, and every fact on that cover is either on the paper itself or on the
   screen they came from.

   What is left is the way out. The back link is the module's, in the corner it
   sits in on every other screen, and while a paper is open it is the only way
   off it: leaving keeps the answers, the flags, the question you were on and
   the time you had left, because all four live in the attempt. There is no
   Leave button on the paper for the same reason there is no Are you sure —
   one way out, and it is where the way out always is.

   The scoring and saving below are untouched: one score per quiz wherever it
   is reached from, a retake that does not move the needle, and the place
   written on every question so the Flight Deck can offer to put you back. */
export default function QuizPage({
  minimums, module: mod, chapter, state, onBack, onScore, onAnswers, onRun,
}) {
  const run = state?.run?.[chapter.id] || null;
  const score = state?.quiz?.[chapter.id];
  const up = upFrom({ kind: "quiz", moduleId: mod?.code || mod?.id, moduleName: mod?.name })?.label;

  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the module — not history. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {up}
        </button>
      </div>

      <div className="lbody" style={{ padding: "6px var(--pad) 0" }}>
        {chapter.questions?.length ? (
          <Exam
            key={chapter.id}
            quizId={chapter.quizId || chapter.id}
            title={`${chapter.title} quiz`}
            /* The module and what this paper is on, in the bar's small line.
               Both are the app's own names for them, so when real content
               arrives carrying subjects this reads as the subject. */
            eyebrow={[mod?.name, chapter.title].filter(Boolean).join(" · ")}
            questions={chapter.questions}
            // Where you were, so leaving halfway and coming back returns you to
            // the question rather than to the first one.
            resumeAt={run?.at || 0}
            minimums={minimums}
            /* REPORTS THE PLACE ON EVERY QUESTION. Without this nothing writes
               pw-quiz-run and the Flight Deck's Resume cannot point at a quiz.
               The TALLY does not travel with the place: an exam holds the
               answers, the answers are written on every change, and the score
               is computed from them at hand-in, so there is nothing to lose. */
            onProgress={(at) => onRun?.(chapter.id, { at, total: chapter.questions.length })}
            onAnswers={onAnswers}
            onDone={(t) => {
              // FIRST ATTEMPT ONLY counts. A retake is a fresh sitting and must
              // not move the needle, so it is not recorded as a score.
              if (!score) onScore?.(chapter.id, t.right, chapter.questions.length);
              // A finished quiz is a score, not a place to go back to. onScore
              // clears the run, but only on a first attempt — a retake has to
              // clear it too or it leaves a stale place behind.
              else onRun?.(chapter.id, null);
            }}
          />
        ) : (
          <p>The questions arrive with the content.</p>
        )}
      </div>
    </div>
  );
}
