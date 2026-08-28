import { Check } from "lucide-react";
import { isDone, chapterState, timeLeft, durationWords } from "./lessonState.js";

// The route through a module: chapters as headings, not cards. Nothing here
// has a panel fill, a radius or a shadow — space and one hairline do all the
// separating, which is why the markup is this plain.
function Lights({ lessons, state, hereLessonId }) {
  return (
    <span className="lights" aria-hidden="true">
      {lessons.map((l) => (
        <i key={l.id}
           className={`lg${isDone(state, l.id) ? " lit" : l.id === hereLessonId ? " now" : ""}`} />
      ))}
    </span>
  );
}

// A tick when it is done, a dot for where you are, and nothing at all
// otherwise. Deliberately not a bordered box: an earlier version used those
// and people tried to tick them.
function Mark({ done, here }) {
  return (
    <span className="mark">
      {done ? <Check aria-hidden="true" /> : here ? <i className="dot" aria-hidden="true" /> : null}
    </span>
  );
}

export default function RouteTab({ module: mod, chapters, state, here, open, onToggle, onOpenLesson, onOpenQuiz }) {
  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0);

  return (
    <>
      <div className="chaps">
        {chapters.map((ch) => {
          const st = chapterState(ch, state, here?.chapter?.id);
          const isOpen = open.has(ch.id);
          const score = state?.quiz?.[ch.id];
          return (
            <section key={ch.id} className={`chap${isOpen ? " open" : ""} ${st === "done" ? "done" : st === "here" ? "here" : ""}`}>
              <button type="button" className="chead" aria-expanded={isOpen}
                      aria-controls={`kids-${ch.id}`} onClick={() => onToggle(ch.id)}>
                <span>
                  <span className="cname">{ch.title}</span>
                  <span className="csub">
                    {ch.lessons.length} lesson{ch.lessons.length === 1 ? "" : "s"} and a quiz
                  </span>
                </span>
                <Lights lessons={ch.lessons} state={state} hereLessonId={here?.lesson?.id} />
                {/* State in words, never a badge. */}
                <span className={`cstate${st === "here" ? " here" : ""}`}>
                  {st === "done" ? "Done" : st === "here" ? "You are here" : "Not started"}
                </span>
                <span className="chv" aria-hidden="true">›</span>
              </button>

              {/* Rendered whether open or not, so the fold has something to
                  animate between. */}
              <div className="kidswrap" id={`kids-${ch.id}`}>
                <div className="kids">
                  {ch.lessons.map((l) => {
                    const d = isDone(state, l.id);
                    const isHere = l.id === here?.lesson?.id;
                    const pct = state?.pos?.[l.id]?.pct || 0;
                    return (
                      <button key={l.id} type="button" className={`row${d ? " done" : ""}`}
                              onClick={() => onOpenLesson(ch, l)}>
                        <Mark done={d} here={isHere} />
                        <span>
                          <span className="rn">{l.title}</span>
                          {durationWords(l.duration) && <span className="rm">{durationWords(l.duration)}</span>}
                        </span>
                        <span className={`rstate${isHere ? " on" : ""}`}>
                          {d ? "Done" : isHere ? timeLeft(l.duration, pct) : durationWords(l.duration) || ""}
                        </span>
                        <span className="chv" aria-hidden="true">›</span>
                      </button>
                    );
                  })}

                  {/* The quiz is the last row of its chapter, not a section of
                      its own — it belongs to the chapter that earned it. */}
                  <button type="button" className="row" onClick={() => onOpenQuiz(ch)}>
                    <Mark done={score != null} here={false} />
                    <span>
                      <span className="rn">{ch.title} quiz</span>
                      <span className="rm">{ch.quizCount || 8} questions</span>
                    </span>
                    <span className="rstate">
                      {score != null ? `You got ${score.correct} of ${score.total}` : "Not taken"}
                    </span>
                    <span className="chv" aria-hidden="true">›</span>
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* One quiet line so a short tab stops rather than trailing off. */}
      <p className="endnote">
        That is all of {mod.name} — {lessonCount} lesson{lessonCount === 1 ? "" : "s"} and{" "}
        {chapters.length} quiz{chapters.length === 1 ? "" : "zes"}.
      </p>
    </>
  );
}
