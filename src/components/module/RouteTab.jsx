import { Check } from "lucide-react";
import { isDone, chapterState, timeLeft, durationWords } from "./lessonState.js";
import { thumbTile, clock } from "../../lib/familiar.js";
import "./familiar.css";

// Netflix's episode list, and the reason it is worth more than the picture.
//
// Measured on the live module screen: chapter titles were all 27px weight 700
// at three different lightnesses — contrast 5.0, 15.4 and 8.0 — because the
// lightness encoded state. But every reader alive reads dimmer as LESS
// IMPORTANT, so the screen told a first-year that Chapter 2 mattered and the
// others did not.
//
// One brightness for every title, and a bar under the picture for how far you
// got. One channel, one job. THE TITLE NEVER DIMS.
function RouteRow({ lesson, chapter, done, here, pct, onOpen }) {
  const secs = lesson.duration || 0;
  return (
    <button type="button" className="rrow" aria-current={here ? "true" : undefined}
            onClick={() => onOpen(chapter, lesson)}>
      <span className="rthumb" data-tile="" data-code={lesson.code || lesson.id}
            data-done={done ? "1" : "0"} style={thumbTile(lesson.id)}>
        {secs > 0 && <span className="rdur">{clock(secs)}</span>}
        {/* The ONLY place watched state appears. */}
        {(pct > 0 || done) && (
          <span className="rprog"><i className="rprog-fill" style={{ width: `${Math.min(100, pct * 100)}%` }} /></span>
        )}
      </span>
      <span className="rbody">
        <span className="rtitle">{lesson.title}</span>
        <span className="rmeta">
          {done && <span className="rcheck"><Check aria-hidden="true" /></span>}
          {done ? "Done" : here ? timeLeft(lesson.duration, pct) : durationWords(lesson.duration) || ""}
        </span>
      </span>
    </button>
  );
}

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

// Sized to the row it replaces, so nothing moves when the real one arrives.
// A list that reflows when it loads reads as slow even when it is fast — the
// shift IS the slowness.
function RouteSkeleton({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-rrow">
          <div className="sk sk-thumb" />
          <div>
            <div className="sk sk-line" />
            <div className="sk sk-line" data-w="short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RouteTab({ module: mod, chapters, state, here, open, onToggle, onOpenLesson, onOpenQuiz }) {
  if (!chapters?.length) return <RouteSkeleton />;
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
                  {st === "done" ? "Done"
                    : st === "here" ? "You are here"
                    : st === "started" ? "Part way"
                    : "Not started"}
                </span>
                <span className="chv" aria-hidden="true">›</span>
              </button>

              {/* Rendered whether open or not, so the fold has something to
                  animate between. */}
              <div className="kidswrap" id={`kids-${ch.id}`}>
                <div className="kids">
                  {ch.lessons.map((l) => (
                    <RouteRow key={l.id} lesson={l} chapter={ch}
                              done={isDone(state, l.id)}
                              here={l.id === here?.lesson?.id}
                              pct={state?.pos?.[l.id]?.pct || 0}
                              onOpen={onOpenLesson} />
                  ))}

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
