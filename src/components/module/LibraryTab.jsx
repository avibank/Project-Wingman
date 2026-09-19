import { useEffect, useRef, useState } from "react";
import LibraryStudyCards from "../../features/bookmarks/LibraryStudyCards.jsx";
import { Check } from "lucide-react";
import { hits, terms } from "../../lib/moduleSearch.js";
import { useSwitchIn } from "../../lib/tabMotion.js";

/* ============================================================================
   §5 — THE LIBRARY.

   Two sections in one scroll, in this order: Quizzes, then Papers.
   The Quizzes header is a heading and a count. It carried a small accuracy
   dial until the bar moved into settings and the Flight Deck's gyro started
   reading it; the dial is on the drill's results screen alone now.

   CALIBRATION IS GONE, row and all. It was the answers you already got right,
   kept in currency out of `holding`, pinned above the chapter quizzes — a
   second exercise with its own vocabulary, its own sticker and its own date,
   for a pile most students never looked at. The quizzes are the Library's
   quizzes now, and nothing sits above them.

   The section headings are NOT buttons. Nothing here collapses, so nothing
   needs to be a button.
   ========================================================================= */

const CHIP_MAX = 12;

const DOC = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.2 1.8h5.2l4.4 4.3v8.1H3.2z" /><path d="M8.4 1.8v4.3h4.4" />
  </svg>
);
const QUIZ = (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor"
       strokeWidth="1.5" aria-hidden="true">
    <rect x="2.6" y="1.8" width="10.8" height="12.4" rx="1.6" />
    <path d="M5.4 5.6H10.6M5.4 8.2H10.6M5.4 10.8H8.6" strokeLinecap="round" />
  </svg>
);

export default function LibraryTab({
  chapters, papers, state, sub, onOpenQuiz, onOpenPaper, onAddPaper,
  query = "",
  moduleCode = null,
  readerPin = null, faults = new Set(),
}) {
  const [chapterFilter, setChapterFilter] = useState(null);

  // §5 turned the Library's segmented control into one scroll, but the URL
  // still distinguishes /library from /library/quizzes. Rather than drop that
  // meaning, the named section is brought into view on arrival — a link to
  // the quizzes still lands on the quizzes.
  const quizRef = useRef(null);
  const papersRef = useRef(null);
  // A chapter chip narrows the papers in place: the list fades in rather than
  // swapping in a single frame.
  const papersListRef = useRef(null);
  useSwitchIn(papersListRef, chapterFilter);
  useEffect(() => {
    const el = sub === "quizzes" ? quizRef.current : papersRef.current;
    if (!el || sub !== "quizzes") return;      // papers are already at the top
    el.scrollIntoView({ block: "start", behavior: "auto" });
  }, [sub]);
  const searching = terms(query).length > 0;

  const shownQuizzes = chapters.filter((c) => hits(`${c.title} quiz ${c.id}`, query));
  const shownPapers = papers.filter(
    (p) => (!chapterFilter || p.chapterId === chapterFilter)
      && hits(`${p.title} ${p.chapterTitle || ""}`, query));


  return (
    <div className="libtab">
      {/* ------------------------------------------------------ QUIZZES --- */}
      <section className="lsec" aria-labelledby="lsec-quizzes" ref={quizRef}>
        <div className="lsec-head">
          <div className="lsec-id">
            <h2 className="lsec-name" id="lsec-quizzes">Quizzes</h2>
            <p className="lsec-sub">
              {chapters.length} quiz{chapters.length === 1 ? "" : "zes"}, one per chapter
            </p>
          </div>
        </div>

        <div className="libwrap">

          {shownQuizzes.map((c) => {
            const s = state?.quiz?.[c.id];
            const lit = faults.has(c.id);
            return (
              <button type="button" key={c.id} className="item" onClick={() => onOpenQuiz(c)}
                      data-state={s && !lit ? "done" : undefined}>
                <span className="lead mark">{s && !lit ? <Check aria-hidden="true" /> : QUIZ}</span>
                <span className="imain">
                  {/* §7 — the chapter name IS the row's own name here; the
                      meta says the shape of the quiz and nothing else. */}
                  <span className="iname">{c.title} quiz</span>
                  <span className="imeta">
                    {s ? `${s.total} question${s.total === 1 ? "" : "s"}`
                      : (c.quizCount ? `${c.quizCount} question${c.quizCount === 1 ? "" : "s"}` : "Not yet taken")}
                  </span>
                </span>
                <span className="istat">

                  {s
                    ? <span className="score">{s.correct} of {s.total}</span>
                    : <span className="go ghost">Take it</span>}
                  {lit && <span className="go ghost">Re-check</span>}
                </span>
              </button>
            );
          })}

          {searching && !shownQuizzes.length && (
            <p className="endnote">Try a chapter name, or the word quiz.</p>
          )}
        </div>
      </section>

      {/* -------------------------------------------------- STUDY CARDS ---
          Between the two, because a card set IS a quiz — the same questions,
          read the other way round — so it belongs beside the quiz it comes
          from rather than beside the papers. It draws nothing when the module
          has no quizzes, so there is never a heading over an empty list.
          Search filters the other two sections; it does not filter this one,
          which is one row per quiz and already the shortest list here. */}
      <LibraryStudyCards moduleId={moduleCode} />

      {/* ------------------------------------------------------- PAPERS --- */}
      <section className="lsec" aria-labelledby="lsec-papers" ref={papersRef}>
        <div className="lsec-head">
          <div className="lsec-id">
            <h2 className="lsec-name" id="lsec-papers">Papers</h2>
            <p className="lsec-sub">
              {papers.length
                ? `${papers.length} document${papers.length === 1 ? "" : "s"} for this module`
                : "Add one and it opens in the reader"}
            </p>
          </div>
          {onAddPaper && papers.length > 0 && (
            <button type="button" className="lsec-act" onClick={onAddPaper}>Add a paper</button>
          )}
        </div>

        {papers.length > 0 && (
          <div className="filt">
            {chapters.length > CHIP_MAX ? (
              <label className="fsel">
                <span className="fsel-l">Chapter</span>
                <select className="fsel-f" value={chapterFilter || ""}
                        onChange={(e) => setChapterFilter(e.target.value || null)}>
                  <option value="">All chapters</option>
                  {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
            ) : (
              <>
                <button type="button" className="fchip" aria-pressed={!chapterFilter}
                        onClick={() => setChapterFilter(null)}>All</button>
                {chapters.map((c) => (
                  <button type="button" key={c.id} className="fchip"
                          aria-pressed={chapterFilter === c.id}
                          onClick={() => setChapterFilter(c.id)}>{c.title}</button>
                ))}
              </>
            )}
          </div>
        )}

        <div className="libwrap" ref={papersListRef}>
          {/* §5's own pattern, reused: the thing you are in the middle of is
              pinned above the list, with a rule beneath it. It is where you
              were, and it should not be somewhere you have to hunt for. The
              pattern came from the Calibration row, which was pinned above the
              chapter quizzes until that whole exercise was removed; the paper
              you have open is what still uses it.

              §10 — with nothing opened yet this names the next action inside
              the sentence rather than reporting an absence. */}
          {/* §17 — ONE ROW PER PAPER. There used to be two: a pinned "Reading"
              row above the list, and the paper's own row below it, for the same
              document. The one you are in the middle of now gets its Resume and
              a progress hairline on its own row, which is the same fact in one
              place instead of two. */}
          {shownPapers.map((p) => {
            const here = readerPin?.paper?.id === p.id;
            const through = here && readerPin?.page && p.pages
              ? Math.min(100, Math.round((readerPin.page / p.pages) * 100)) : 0;
            /* A paper still being ingested is not openable yet, and says so
               rather than opening a viewer with nothing behind it. */
            const preparing = p.status === "pending";
            return (
              <button type="button" key={p.id} className="item" data-here={here ? "" : undefined}
                      disabled={preparing}
                      onClick={() => onOpenPaper(p)}>
                <span className="lead mark">{DOC}</span>
                <span className="imain">
                  <span className="iname">{p.title}</span>
                  <span className="imeta">
                    {preparing
                      ? "Preparing — the text layer and thumbnails are being built"
                      : [p.kind || "PDF",
                         p.pages ? `${p.pages} page${p.pages === 1 ? "" : "s"}` : null,
                         here ? `you are on page ${readerPin.page}` : null]
                        .filter(Boolean).join(" · ")}
                  </span>
                  {/* The hairline, not a second row. */}
                  {through > 0 && (
                    <span className="ihair" aria-hidden="true"><i style={{ width: `${through}%` }} /></span>
                  )}
                </span>
                <span className="istat">
                  <span className={`go ${here ? "" : "ghost"}`}>
                    {preparing ? "Preparing…" : here ? "Resume" : "Open"}
                  </span>
                </span>
              </button>
            );
          })}
          {/* §17b — the empty state names the next action inside the sentence
              and gives it a button. It never states an absence. */}
          {!shownPapers.length && (
            papers.length ? (
              <p className="endnote">Try a paper title, a chapter name, or the All chip.</p>
            ) : (
              <div className="libempty">
                <p>
                  Add the first paper for this module and it opens in the reader —
                  highlight a line, leave a note, ask the module about it.
                </p>
                {onAddPaper && (
                  <button type="button" className="go" onClick={onAddPaper}>Add a paper</button>
                )}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
