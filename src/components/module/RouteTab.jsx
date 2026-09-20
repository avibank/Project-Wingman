import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Stamp from "../Stamp.jsx";
import { stampTilt } from "../../lib/stamp.js";
import { isDone, chapterState, timeLeft, durationWords } from "./lessonState.js";
import { thumbTile } from "../../lib/familiar.js";
import { passAt } from "../../lib/quiz.js";
import { posterFor } from "../../lib/shell.js";
import { filterChapters, terms, countLessons } from "../../lib/moduleSearch.js";
import { LessonsWaiting } from "./ModuleWaiting.jsx";
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
// §2.7 — what a quiz carries in the same slot a lesson's thumbnail occupies,
// at the same size, so the text column never shifts. It was a document glyph;
// the approved design makes it an answer sheet with the paper's length on it,
// which says two things in the space the glyph said none.
export const QuizThumb = ({ count }) => (
  <span className="th quiz-thumb" aria-hidden="true">
    <span className="quiz-thumb__sheet">
      <span><i className="on" /><i /><i /></span>
      <span><i /><i /><i className="on" /></span>
      <span><i /><i className="on" /><i /></span>
    </span>
    {/* No invented number: a chapter with no questions yet shows the sheet
        and nothing beside it, rather than a count of a paper that is not
        written. */}
    {count ? <span className="quiz-thumb__count"><b>{count}</b>Qs</span> : null}
  </span>
);

function RouteRow({ lesson, chapter, done, here, pct, onOpen, stamp, tilts }) {

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
    /* data-lesson identifies the row and is read elsewhere. It used to also be
       how the return trip found this row to name it, so the player could shrink
       back into its thumbnail; that mechanism is gone with the rest of the
       shared elements. */
    <button type="button" className={`lrow${here ? " cur" : ""}`} data-state={state} data-lesson={lesson.id}
            aria-current={here ? "true" : undefined}
            onClick={() => onOpen(chapter, lesson)}>
      {/* THE THUMBNAIL IS NEVER AN EMPTY GREY BOX (bug 15). The reference
          draws `.th` as a lit panel — a radial gradient from a lifted corner,
          hairlined, 16/9 — and a thin accent bar along the bottom for how far
          in you are. Where a real frame can be pulled out of the lesson's own
          video it goes on top; where it cannot, the drawn panel IS the
          picture rather than a placeholder waiting for one. `thumbTile` gives
          each lesson its own angle so a chapter of six is six panels rather
          than six copies.

          Capture returns null on CORS, a tainted canvas or a dead source, and
          both are exactly 16/9, so nothing shifts either way. */}
      <span className="th" style={thumbTile(lesson.id)}>
        {poster && <img src={poster} alt="" loading="lazy" />}
        {!done && pct > 0 && <b style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} />}
      </span>
      <span>
        <div className="lt">{lesson.title}</div>
        <div className="ls">{meta}</div>
      </span>
      {/* The current row is the only lesson row with a button. */}
      <span className="rt">
        {/* THE STAMP, AND IT IS DRAWN NOW RATHER THAN SPELLED.
            This was the pilot's three-character code in a bordered box — the
            same three letters on every row
            on the live site — which is the same fact, said in the plainest
            possible way. §4 makes inspStamp THE renderer for every place a
            sign-off appears, and a lesson row is the first of them; the
            reference draws it at 46px, tilted by that sign-off's own angle.
            Until a student issues one of their own the house seal stands in,
            which is §4's rule and means a row is never blank. */}
        {done ? (
          <span className="imp" title={stamp ? "Your stamp" : "Finished"}>
            <Stamp stamp={stamp} size={46} rot={tilts?.[lesson.id] ?? stampTilt(stamp?.seed || 1, lesson.id)}
                   label={stamp ? `Signed off with your stamp` : "Finished"} />
          </span>
        ) : here ? <span className="resume">Resume</span>
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
  stamp, tilts,
  chapters, state, here, open, onToggle, onOpenLesson, onOpenQuiz,
  query = "",
  /* WAITING AND EMPTY ARE NOT THE SAME STATE, and this line is why the tab
     was blank. It read `if (!chapters.length) return <RouteSkeleton />` —
     which is right for the second before a content document arrives, and
     wrong for a module that has nothing in it yet: the skeleton never
     resolved, so the first thing anybody saw on opening a module was four
     grey bars, forever. A loading picture that never loads is the clearest
     possible way to look broken.

     `pending` is true only while a content document is actually in flight.
     With no document to wait for, the module says what it is waiting for
     instead. */
  pending = false,
  moduleName = "This module",
}) {
  if (!chapters?.length) {
    return pending ? <RouteSkeleton /> : <LessonsWaiting moduleName={moduleName} />;
  }
  const searching = terms(query).length > 0;
  // Searching overrides the fold. A result you cannot see is not a result, and
  // "one chapter open at a time" is a rule about browsing, not about finding.
  const { chapters: shown } = filterChapters(chapters, query);

  return (
    <>
      <div>
        {shown.map((ch) => {
          const st = chapterState(ch, state, here?.chapter?.id);
          const isOpen = searching || open.has(ch.id);
          const score = state?.quiz?.[ch.id];
          return (
            <section key={ch.id} className={`chap${isOpen ? " open" : ""} ${st === "done" ? "done" : st === "here" ? "here" : ""}`}>
              <button type="button" className="ch-h" aria-expanded={isOpen}
                      aria-controls={`kids-${ch.id}`} onClick={() => onToggle(ch.id)}>
                <span>
                  <h2>{ch.title}</h2>
                  {/* §7 — the subline states the shape of the chapter and
                      nothing the rows below already say. */}
                  <div className="cm">
                    {ch.lessons.length} lesson{ch.lessons.length === 1 ? "" : "s"} · 1 quiz
                  </div>
                </span>
                {/* Master Caution used to share this slot with the status
                    word, and it is gone from here: the lamp lights on one
                    surface now, the module card in the launcher, and only when
                    the module's average is under the bar. A chapter row says
                    where you are, and the quiz row inside carries its own
                    score.

                    THE WRAPPER STAYS whatever it holds. .chead is a
                    THREE-COLUMN grid — minmax(0,1fr) auto 12px — so a third
                    child of its own would take the auto column, crush the
                    status into the 12px chevron track, and wrap the chevron
                    onto a second row on top of the title. Measured before this
                    wrapper existed: "Done" rendered 12px wide. The phone
                    breakpoint also places .cstate and .chv by grid-column,
                    which only holds while the child count does. */}
                {/* The state and the chevron are ONE cell in the reference —
                    `.cs2` — which is what lets the chevron sit hard against
                    the words and rotate in place when the chapter opens. */}
                <span className={`cs2${st === "here" ? " here" : ""}`}>
                  {/* State in words, never a badge. */}
                  {st === "done" ? "Done"
                    : st === "here" ? "You are here"
                      : st === "started" ? "Part way"
                        : "Not started"}
                  <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </span>
              </button>

              {/* Rendered whether open or not, so the fold has something to
                  animate between. */}
              <div className="ch-body" id={`kids-${ch.id}`}>
                  {ch.lessons.map((l) => (
                    <RouteRow stamp={stamp} tilts={tilts} key={l.id} lesson={l} chapter={ch}
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
                      <button type="button" className="lrow" data-state={state}
                              onClick={() => onOpenQuiz(ch)}>
                        <QuizThumb count={total} />
                        <span>
                          <div className="lt">{ch.title} quiz</div>
                          <div className={`ls${failed ? " warn" : ""}`}>
                            {[
                              total ? `${total} question${total === 1 ? "" : "s"}` : null,
                              failed ? "below the pass mark" : null,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </span>
                        <span className="rt">
                          {score == null ? <span>Not taken</span> : (
                            <>
                              <span className="sc">
                                {!failed && <Check aria-hidden="true" />} {score.correct} of {total}
                              </span>
                              {failed && <span className="act-o">Re-check</span>}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })()}
              </div>
            </section>
          );
        })}
      </div>

      {/* ONLY WHEN SEARCHING. The closing line used to read "That is all of
          Module 1 — 6 lessons and 3 quizzes" on every visit, which is word
          for word the subtitle now sitting under the module's name at the top
          of the same screen (bug 14 put it there). One screen, one sentence,
          and the reference has no closing line at all.

          The search result keeps its line: it says what the filter reached
          and names the way out, which nothing else on the screen does. */}
      {searching && (
        <p className="endnote">
          {shown.length
            ? `Showing ${countLessons(shown)} lesson${countLessons(shown) === 1 ? "" : "s"} across ${shown.length} chapter${shown.length === 1 ? "" : "s"}. Clear the search for the whole route.`
            : "Try a chapter name, a lesson title, or a code like M1.03."}
        </p>
      )}
    </>
  );
}
