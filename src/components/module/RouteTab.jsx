import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { isDone, chapterState, timeLeft, durationWords } from "./lessonState.js";
import { thumbTile } from "../../lib/familiar.js";
import { passAt } from "../../lib/quiz.js";
import { CautionMark } from "./Instruments.jsx";
import { posterFor } from "../../lib/shell.js";
import { filterChapters, terms, countLessons } from "../../lib/moduleSearch.js";
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
// §2.7 — the document mark a quiz carries in the same slot a lesson's
// thumbnail occupies, at the same size, so the text column never shifts.
const QuizMark = () => (
  <span className="lead mark">
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none"
         stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.6" y="1.8" width="10.8" height="12.4" rx="1.6" />
      <path d="M5.4 5.6 H10.6 M5.4 8.2 H10.6 M5.4 10.8 H8.6" strokeLinecap="round" />
    </svg>
  </span>
);

function RouteRow({ lesson, chapter, done, here, pct, onOpen }) {

  // A real frame from the lesson's own video, when one can be had. The row
  // paints with the generated tile immediately and the frame replaces it when
  // it arrives — both are exactly 128x72, so nothing shifts. Capture returns
  // null on CORS, a tainted canvas or a dead source, and the tile simply stays.
  const [poster, setPoster] = useState(lesson.thumb || null);
  useEffect(() => {
    if (poster) return undefined;
    let live = true;
    posterFor({ id: lesson.id, thumb: lesson.thumb, video: { src: lesson.video } })
      .then((p) => { if (live && p) setPoster(p); });
    return () => { live = false; };
  }, [lesson.id]);
  const state = done ? "done" : here ? "current" : "todo";
  // §2.7 — the meta line carries the time, so the rail never repeats it. A row
  // that says "11 minutes left" and then "11 min" again on the right is one
  // fact taking two slots.
  const meta = done ? "Watched in full"
    : here ? timeLeft(lesson.duration, pct)
      : durationWords(lesson.duration) || "";

  return (
    <button type="button" className="item" data-state={state}
            aria-current={here ? "true" : undefined}
            onClick={() => onOpen(chapter, lesson)}>
      <span className="lead" style={thumbTile(lesson.id)}>
        {poster && <img src={poster} alt="" width={58} height={34} loading="lazy" />}
      </span>
      <span className="imain">
        <span className="iname">{lesson.title}</span>
        <span className="imeta">{meta}</span>
      </span>
      {/* The current row is the only lesson row with a button. */}
      <span className="istat">
        {done ? <span className="tick"><Check aria-hidden="true" /> Done</span>
          : here ? <span className="go">Resume</span>
            : null}
      </span>
    </button>
  );
}

// The route through a module: chapters as headings, not cards. Nothing here
// has a panel fill, a radius or a shadow — space and one hairline do all the
// separating, which is why the markup is this plain.
//
// §2.7/§6 — NO PROGRESS METERS on a chapter. The flight profile owns module
// progress and the status word owns chapter state; a pair of dashes beside the
// word was a third opinion on the same question, and the brief forbids putting
// it back.

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

export default function RouteTab({
  module: mod, chapters, state, here, open, onToggle, onOpenLesson, onOpenQuiz,
  query = "",
  // §2/§8 — which chapters are below the user's bar, computed once upstream.
  // A Set rather than a list: this is asked per row inside a render loop.
  faults = new Set(),
}) {
  if (!chapters?.length) return <RouteSkeleton />;
  const lessonCount = countLessons(chapters);
  const searching = terms(query).length > 0;
  // Searching overrides the fold. A result you cannot see is not a result, and
  // "one chapter open at a time" is a rule about browsing, not about finding.
  const { chapters: shown } = filterChapters(chapters, query);

  return (
    <>
      <div className="chaps">
        {shown.map((ch) => {
          const st = chapterState(ch, state, here?.chapter?.id);
          const isOpen = searching || open.has(ch.id);
          const score = state?.quiz?.[ch.id];
          return (
            <section key={ch.id} className={`chap${isOpen ? " open" : ""} ${st === "done" ? "done" : st === "here" ? "here" : ""}`}>
              <button type="button" className="chead" aria-expanded={isOpen}
                      aria-controls={`kids-${ch.id}`} onClick={() => onToggle(ch.id)}>
                <span>
                  <span className="cname">{ch.title}</span>
                  {/* §7 — the subline states the shape of the chapter and
                      nothing the rows below already say. */}
                  <span className="csub">
                    {ch.lessons.length} lesson{ch.lessons.length === 1 ? "" : "s"} · 1 quiz
                  </span>
                </span>
                {/* §2 — THE ONLY STATUS SIGNAL ON THIS SCREEN, and it sits on
                    the smallest thing that owns the problem. The chapter owns
                    it because the chapter's quiz is what fell below the bar.
                    It shows whether the chapter is open or collapsed — a lamp
                    you have to expand a fold to find is not a signal — and the
                    quiz row inside carries its score and a Re-check instead,
                    never a second lamp for the same fact. */}
                {/* ONE SLOT for the lamp and the status word. .chead is a
                    THREE-COLUMN grid — minmax(0,1fr) auto 12px — so a fourth
                    child does not get a column of its own: it takes the auto
                    one, the status is crushed into the 12px chevron track, and
                    the chevron wraps onto a second row on top of the title.
                    Measured before this wrapper existed: "Done" rendered 12px
                    wide. The phone breakpoint also places .cstate and .chv by
                    grid-column, which only holds while the child count does. */}
                <span className="cend">
                  {faults.has(ch.id) && <CautionMark compact />}
                  {/* State in words, never a badge. */}
                  <span className={`cstate${st === "here" ? " here" : ""}`}>
                    {st === "done" ? "Done"
                      : st === "here" ? "You are here"
                      : st === "started" ? "Part way"
                      : "Not started"}
                  </span>
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
                      its own — it belongs to the chapter that earned it. It is
                      hidden only when a search matched the chapter's lessons
                      but not the quiz itself. */}
                  {(!searching || ch.quizHit) && (() => {
                    // §2.7 — the same row skeleton, and a FAILED quiz has to
                    // offer the way back in. It was the highest-value action on
                    // the page and a dead end: the row said "you got 4 of 8"
                    // and gave you nowhere to go with that.
                    // No invented count. This fell back to 8, which is right
                    // for the fixture by coincidence and wrong everywhere else:
                    // with the content flag off, data.js chapters carry no quiz
                    // at all and every row would still have advertised "8
                    // questions" — and passAt(8) would have set a pass mark for
                    // a quiz that does not exist. A number shown to a student
                    // has to come from somewhere.
                    const total = score?.total ?? ch.quizCount ?? null;
                    const need = total ? passAt(total) : null;
                    const failed = score != null && need != null && score.correct < need;
                    const state = score != null && !failed ? "done" : "todo";
                    return (
                      <button type="button" className="item" data-state={state}
                              onClick={() => onOpenQuiz(ch)}>
                        <QuizMark />
                        <span className="imain">
                          <span className="iname">{ch.title} quiz</span>
                          <span className="imeta">
                            {[
                              total ? `${total} question${total === 1 ? "" : "s"}` : null,
                              failed ? "below the pass mark" : null,
                            ].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="istat">
                          {score == null ? <span>Not taken</span> : (
                            <>
                              <span className="score">
                                {!failed && <Check aria-hidden="true" />} {score.correct} of {total}
                              </span>
                              {failed && <span className="go ghost">Re-check</span>}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Searching replaces the closing line with what the search reached.
          Never a count of nothing: the sentence names the way out. */}
      {searching ? (
        <p className="endnote">
          {shown.length
            ? `Showing ${countLessons(shown)} lesson${countLessons(shown) === 1 ? "" : "s"} across ${shown.length} chapter${shown.length === 1 ? "" : "s"}. Clear the search for the whole route.`
            : "Try a chapter name, a lesson title, or a code like M1.03."}
        </p>
      ) : (
        <p className="endnote">
          That is all of {mod.name} — {lessonCount} lesson{lessonCount === 1 ? "" : "s"} and{" "}
          {chapters.length} quiz{chapters.length === 1 ? "" : "zes"}.
        </p>
      )}
    </>
  );
}
