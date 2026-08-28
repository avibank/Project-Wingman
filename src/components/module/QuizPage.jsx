import { useState } from "react";
import { ChevronLeft, ArrowRight } from "lucide-react";
import QuizRunner from "./QuizRunner.jsx";
import { nextAfterQuiz, nextLabel, nextWhere } from "./nextUp.js";
import "./module.css";

// What a quiz is, the score if it has been taken, and now the thing that runs
// it. A retake replaces the score rather than adding a second record — the
// Library and the chapter row read one object, and a quiz you have sat twice
// is still one quiz.
export default function QuizPage({ module: mod, chapters, chapter, state, onBack, onOpenLesson, onOpenQuiz, onScore, onRun, autoStart }) {
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
        <QuizRunner
          chapter={chapter}
          questions={chapter.questions}
          run={run}
          onRun={(r) => onRun?.(chapter.id, r)}
          onQuit={() => setRunning(false)}
          onFinish={(got, total) => { setRunning(false); onScore?.(chapter.id, got, total); }}
        />
      </div>
    );
  }

  return (
    <div className="mscreen">
      <div className="hdr">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {mod.name}
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
