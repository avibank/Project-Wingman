import { ChevronLeft, ArrowRight } from "lucide-react";
import { nextAfterQuiz, nextLabel, nextWhere } from "./nextUp.js";
import "./module.css";

// What a quiz is, and the score if it has been taken. The engine that runs the
// questions is explicitly out of scope, so there is no Start button here: a
// button that goes nowhere is worse than an honest absence, and the handoff
// says exactly that. When the engine lands, the line below becomes the button.
export default function QuizPage({ module: mod, chapters, chapter, state, onBack, onOpenLesson, onOpenQuiz }) {
  const score = state?.quiz?.[chapter.id];
  const count = chapter.quizCount || 8;
  const next = nextAfterQuiz(chapters, chapter.id);

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
            : "Coming with the content."}
        </p>

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
