import { takenScores, averagePct } from "../../lib/minimums.js";
import { useState } from "react";
import { ChevronLeft, ArrowRight } from "lucide-react";
import Review from "./Review.jsx";
import { nextAfterQuiz, nextLabel, nextWhere } from "./nextUp.js";
import { upFrom } from "../../lib/lessonSurface.js";
import "./module.css";

// What a quiz is, the score if it has been taken, and now the thing that runs
// it. A retake replaces the score rather than adding a second record — the
// Library and the chapter row read one object, and a quiz you have sat twice
// is still one quiz.
export default function QuizPage({
  minimums, onRecheck, module: mod, chapters, chapter, state, onBack, onOpenLesson, onOpenQuiz, onScore, autoStart, onOpenLessonById, onAnswer, onRun }) {
  // Every score in this module, in chapter order — the same helper the module
  // screen and the Library use, so the average on the results screen and the
  // average on the dial behind it cannot differ.
  const takenAll = takenScores(chapters, state?.quiz || {});
  const run = state?.run?.[chapter.id] || null;
  // Arriving here from the deck's Resume means "put me back in the quiz", not
  // "show me the cover of the quiz I was already sitting".
  const [running, setRunning] = useState(Boolean(autoStart && run && chapter.questions?.length));
  const score = state?.quiz?.[chapter.id];
  const count = chapter.quizCount || 8;
  const next = nextAfterQuiz(chapters, chapter.id);

  if (running && chapter.questions?.length) {
    return (
      <div className="mscreen">
        {/* The same component the re-check and put-right flows use. One
            interaction, learned once. */}
        <Review
          key={chapter.id}
          title={`${chapter.title} quiz`}
          questions={chapter.questions}
          isRetake={Boolean(score)}
          // Where you were, so leaving halfway and coming back returns you to
          // the question rather than to the cover.
          resumeAt={run?.at || 0}
          // REPORTS THE PLACE ON EVERY QUESTION. Without this nothing writes
          // pw-quiz-run, so "Back to question N" never appears and the Flight
          // Deck's Resume cannot point at a quiz — it is what tells the rest of
          // the app where you got to.
          onProgress={(at) => onRun?.(chapter.id, { at, total: chapter.questions.length })}
          onLeave={() => setRunning(false)}
          onOpenLesson={onOpenLessonById}
          // §6 — the two averages the needle sweeps between. `after` is the
          // module average as it now stands (the score is already recorded by
          // the time this renders); `before` is the same average with THIS
          // chapter left out, which is exactly where the needle was standing a
          // moment ago. Computing it by subtraction rather than by
          // remembering avoids a stale snapshot surviving a remount.
          minimums={minimums}
          averageAfter={averagePct(takenAll)}
          averageBefore={averagePct(takenAll.filter((t) => t.id !== chapter.id))}
          moduleName={mod?.name}
          onRecheck={onRecheck}
          onAnswer={onAnswer}
          onDone={(t) => {
            // FIRST ATTEMPT ONLY counts. A retake is labelled on screen and
            // must not move the needle, so it is not recorded as a score.
            if (!score) onScore?.(chapter.id, t.right, chapter.questions.length);
            // A finished quiz is a score, not a place to go back to. onScore
            // clears the run, but only on a first attempt — a retake has to
            // clear it too or it leaves a stale place behind.
            else onRun?.(chapter.id, null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the module — not history. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {upFrom({ kind: "quiz", moduleId: mod.code || mod.id, moduleName: mod.name })?.label}
        </button>
        <div className="titlerow">
          <h1 className="title">{chapter.title} quiz</h1>
          {score && <p className="avg">You got<b>{score.correct} of {score.total}</b></p>}
        </div>
      </div>

      <div className="lbody" style={{ padding: "6px var(--pad) 0" }}>
        <p className="cap">{count} questions</p>
        <p>
          {score
            ? "One score, wherever you reach it from — this quiz and the one in the Library are the same record."
            : chapter.questions?.length
              ? "Answer, see why, move on. Nothing is timed and you can leave at any point."
              : "The questions arrive with the content."}
        </p>

        {chapter.questions?.length > 0 && (
          <button type="button" className="nextgo" onClick={() => setRunning(true)}>
            {run ? `Back to question ${run.at + 1}` : score ? "Take it again" : "Start"}
          </button>
        )}

        {next && (
          <button type="button" className="nextup"
                  onClick={() => next.kind === "quiz" ? onOpenQuiz(next.chapter) : onOpenLesson(next.chapter, next.lesson)}>
            <span>
              <span className="cap">Next</span>
              <span className="nextn">{nextLabel(next)}</span>
              <span className="nextm">{nextWhere(next)}</span>
            </span>
            <span className="nextgo">Continue <ArrowRight aria-hidden="true" /></span>
          </button>
        )}
      </div>
    </div>
  );
}
