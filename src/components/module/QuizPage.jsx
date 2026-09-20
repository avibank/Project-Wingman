import { ChevronLeft } from "lucide-react";
import Exam from "./Exam.jsx";
import { useExamLock } from "../../lib/examLock.js";
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
  minimums, module: mod, chapter, chapterNo = null, state, onBack, onScore, onAnswers, onRun, onOpenLesson,
  me = null, onOpenPilot = null,
}) {
  const run = state?.run?.[chapter.id] || null;
  const score = state?.quiz?.[chapter.id];
  const up = upFrom({ kind: "quiz", moduleId: mod?.code || mod?.id, moduleName: mod?.name })?.label;
  /* R4 — NOTHING LEAVES AN OPEN PAPER WITHOUT BEING ASKED. The arrow stays,
     because an attempt survives leaving and the clock stops with it, and
     deleting the arrow would make handing in a blank paper the only way out
     of a quiz opened by mistake. What it does not do any more is go quietly:
     while a paper is open it raises the same end-exam dialog the browser's
     Back raises, which says what is unanswered and what is flagged and offers
     the three honest choices. Once the paper is marked it is an ordinary Up
     again. */
  const lock = useExamLock();

  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the module — not history. */}
        <button type="button" className="up"
                onClick={() => (lock.locked ? lock.askEnd?.() : onBack())}>
          <ChevronLeft aria-hidden="true" /> {up}
        </button>
      </div>

      {/* NOT `.lbody`, WHICH IS THE LESSON PAGE'S PROSE WRAPPER. It carries
          `.mscreen .lbody p { font-size: 17px; color: var(--t2); max-width:
          56ch }`, and that selector outranks the exam's own `.exam-frame
          .question__text` by one element — so every paragraph inside the paper
          took the page's body size: the question at 17px where the design says
          21, and the navigator's QUESTIONS label at 17px where it says 11.
          Found by measuring the live screen against the reference. The exam
          brings its own typography and wants none of this. */}
      <div className="qwrap">
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
            // The lessons, so going through the paper can name where a missed
            // question came from rather than printing its id.
            lessons={chapter.lessons || []}
            onOpenLesson={onOpenLesson}
            // Where you were, so leaving halfway and coming back returns you to
            // the question rather than to the first one.
            resumeAt={run?.at || 0}
            minimums={minimums}
            /* WHERE A BOOKMARK ON THIS PAPER BELONGS. The save points at the
               question by its own id; the module and the chapter number are
               what the folder shows beside it and which module it files under. */
            moduleCode={mod?.code || mod?.id || null}
            chapterNo={chapterNo}
            /* REPORTS THE PLACE ON EVERY QUESTION. Without this nothing writes
               pw-quiz-run and the Flight Deck's Resume cannot point at a quiz.
               The TALLY does not travel with the place: an exam holds the
               answers, the answers are written on every change, and the score
               is computed from them at hand-in, so there is nothing to lose. */
            onProgress={(at) => onRun?.(chapter.id, { at, total: chapter.questions.length })}
            onAnswers={onAnswers}
            /* The dialog's third choice: out, with the attempt kept and
               nothing marked. Same destination as the arrow used to reach
               directly. */
            onLeave={onBack}
            /* R5/R6 — who the sitting belongs to, and which paper it is. The
               board is the only thing here that needs an identity. */
            me={me}
            chapterId={chapter.id}
            onOpenPilot={onOpenPilot}
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
