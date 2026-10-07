import { useEffect, useRef, useState } from "react";
import LibraryStudyCards from "../../features/bookmarks/LibraryStudyCards.jsx";
import { QuizThumb } from "./RouteTab.jsx";
import "./ref-module.css";
import { hits, terms } from "../../lib/moduleSearch.js";
import { papersOn, flagDefault } from "../../lib/flags.js";

/* THE SHELF IS REAL AGAIN. The section was removed with the reader, came back
   as a slot made of markup while papers were paused, and is a list once more
   now that a paper opens in the viewer. The slot stays in the file: with BOTH
   switches off there is still a Library with two shelves and one of them on
   its way, which is what stops the pause reading as a missing feature. */
const shelfOn = papersOn || flagDefault("paper.viewer", false);
import { useSwitchIn } from "../../lib/tabMotion.js";
import { QuizzesWaiting, PapersSlot } from "./ModuleWaiting.jsx";
import LibraryDownloads from "./LibraryDownloads.jsx";
import Stamp from "../Stamp.jsx";
import { stampOf } from "../../lib/stamp.js";
import { fetchFinishers } from "../../lib/board.js";
import { tilt } from "./Leaderboard.jsx";
import "./quiz-stamps.css";
import "./library/port.css";
/* THE PORTED LIBRARY, behind `library.batches` while the rest of the module
   screen lands (2026-10-06). When it is on it replaces the three shelves
   entirely — it is not an addition to them. */
/* NOT ITS OWN CHUNK ANY MORE, AND THAT IS THE HITCH FIXED (owner, 2026-10-07:
   "the libafy hithes before it loads always").
   ---------------------------------------------------------------------------
   It was lazy for a good reason that has since gone away: its stylesheet is
   the whole ported design and in the ENTRY it put the bundle 6KB over budget.
   But the sheet moved into this file on 2026-10-06 (see `batches.css` above,
   and the PR that stopped it being a file that can fail alone), and this file
   is part of the MODULE chunk — which has been its own 36KB chunk since the
   static-import leak was found. So the 6KB of JS left behind the lazy boundary
   buys nothing in the entry and costs a network round trip on EVERY open of
   the Library, with `fallback={null}` for a blank in the meantime. Blank, then
   pop, every time, which is exactly what a hitch is.

   A static import here folds it into a chunk that is already being downloaded
   when the module screen opens, so the tab paints in the same frame it is
   pressed. `check:bundle` still holds the entry: if this ever reaches it, the
   budget fails and names it. */
import LibraryBatches from "./library/LibraryBatches.jsx";
import { batchesOf, hereBatch } from "./library/batchModel.js";
import { seenCount } from "../../features/bookmarks/cardsSeen.js";

/* ============================================================================
   §5 — THE LIBRARY.

   Three sections in one scroll, in this order: Quizzes, Study cards, then
   Papers — and a module's downloads, when it has any, on the Papers shelf.
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

/* RULE 4 OF THE QUIZ-STAMPS BRIEF (2026-09-23) — WHO HAS FINISHED.
   -----------------------------------------------------------------------------
   A line of finisher stamps under each quiz row: one per person, their most
   recent finish first, at most eleven, then "+n", then the count in words.
   The markup and the class names are `finisherLine` in
   docs/launch/code/18-quiz-stamps.js; the sheet is 19-quiz-stamps.css.

   Three things are this app's:

   · THE ORDER AND THE CAP ARE THE SERVER'S (0038). Yours is pinned first
     (owner, on the brief's open question 2), and pinning in the client would
     come too late — the cap would already have dropped you.
   · THE EMPTY LINE NAMES ITS NEXT ACTION. The brief's words are "Nobody has
     taken this one yet", and this app's §10 forbids naming an absence: "Every
     empty state names its next action inside the sentence." So the row that
     nobody has finished says "Be the first to take it" — the same fact, from
     the other end, and never an empty strip.
   · A PERSON WITH NO STAMP YET draws the un-inked outline, the licence's own
     "not yet" mark (owner, on the brief's open question 1). */
const STAMP_CAP = 11;
const LIB_STAMP_PX = 36;

function FinisherLine({ found }) {
  const people = found?.people || [];
  if (!people.length) {
    return <span className="fin"><span className="fin__n">Be the first to take it</span></span>;
  }
  const over = Math.max(0, (found.total || people.length) - people.length);
  return (
    <span className="fin">
      <span className="fin__set">
        {people.map((p, i) => (
          <span key={p.userId} title={p.isYou ? `${p.callsign} (you)` : p.callsign}>
            <Stamp stamp={stampOf(p.profile)} size={LIB_STAMP_PX}
                   rot={tilt(i) + (i % 2 ? 1 : -1)}
                   on={!!p.profile?.stamp_issued_at} />
          </span>
        ))}
      </span>
      {over > 0 && <span className="fin__more">+{over}</span>}
      <span className="fin__n">{found.total} finished</span>
    </span>
  );
}

export default function LibraryTab({
  chapters, papers, state, sub, onOpenQuiz, onOpenPaper, onAddPaper,
  /* Who is looking, so the line can pin their own stamp and leave out
     anybody flying solo or blocked either way (0038). */
  me = null,
  query = "",
  /* The module's downloads — files handed over whole, never opened in the
     reader (LibraryDownloads.jsx says why). [] for a module with none. */
  downloads = [],
  moduleCode = null,
  readerPin = null, faults = new Set(),
  /* The ported screen, and what it needs that the shelves never did: how many
     batches the module will have, and the progress store the card counts are
     read out of. */
  asBatches = false, totalBatches = null, progress = null, currentChapterId = null,
  onOpenCards = null, onOpenDownload = null,
  /* The module's own name, for the ported search's empty line, and the door to
     a classmate from a row's stamp strip. */
  moduleName = null, onOpenPerson = null,
}) {
  const [chapterFilter, setChapterFilter] = useState(null);

  /* WHO HAS FINISHED EACH QUIZ, in one call for the whole tab rather than one
     per row. Re-asked when the chapters change (another module) and when the
     student's own scores do, which is what changes after they hand a paper
     in and come back here. */
  const [finishers, setFinishers] = useState({});
  const quizIds = chapters.map((c) => c.quizId || c.id).filter(Boolean).join(",");
  useEffect(() => {
    if (!me || !quizIds) { setFinishers({}); return undefined; }
    let live = true;
    fetchFinishers({ me, quizIds: quizIds.split(","), cap: STAMP_CAP })
      .then((found) => { if (live) setFinishers(found); })
      .catch(() => {});
    return () => { live = false; };
  }, [me, quizIds, state?.quiz]);

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

  const shownQuizzes = chapters.filter((c) => hits(`${c.quizName || `${c.title} quiz`} ${c.title} ${c.id}`, query));
  const shownPapers = papers.filter(
    (p) => (!chapterFilter || p.chapterId === chapterFilter)
      && hits(`${p.title} ${p.chapterTitle || ""}`, query));


  /* NOTHING IN THE MODULE YET, which is what the beta opens on. The Quizzes
     header said "0 quizzes, one per chapter" and then drew an empty list —
     a zero count, which the app's own Voice rule forbids, over nothing. The
     waiting state replaces the header and the list together; the Papers slot
     below keeps its section, because a Library that is only quizzes reads as
     a Library with a piece missing. Study cards draws nothing on its own
     when there are no quizzes to make cards from. */
  const bare = !chapters.length && !searching;

  /* THE PORTED SCREEN REPLACES THE SHELVES, it does not sit above them. While
     `library.batches` is off this is dead and the three shelves below are the
     Library, exactly as they were. */
  const batches = asBatches
    ? batchesOf({ chapters }, {
      scoreOf: (c) => state?.quiz?.[c.id]?.pct ?? state?.quiz?.[c.id]?.score ?? null,
      seenOf: (c) => (progress ? seenCount(progress, (c.cards || c.questions || []).map((x) => x.id)) : 0),
      paperOf: (c) => downloads.find((d) => String(d.id).startsWith(`${c.id}.`)) || null,
    })
    : [];

  /* AND ONLY WHEN THERE IS A BATCH TO DRAW. `batchesOf` keeps a chapter only
     if `Number.isFinite(c.batch)`, so a course document written before the
     port — which is what `course_docs` serves until somebody publishes a new
     one — yields an empty list, and this screen drew nothing at all: an
     admin on the live site got the module header, the tab strip and then
     blank deck to the bottom of the window (owner, 2026-10-06).

     The header already handled this and the screen did not, which is the
     whole bug: `batchSubtitle` falls back to `moduleSubtitle` when there is
     nothing to count, which is why that screenshot's subtitle read "2
     quizzes, 2 card sets and 1 paper" — the old sentence over the new
     screen's empty body. The two now fall back together.

     It is a FALLBACK rather than a fix to the content: a flag that turns a
     working Library into an empty one for whoever has it on is worse than
     the flag being off, and publishing is not something this screen can
     wait for. */
  if (asBatches && batches.length) {
    /* NOT `ref-mod`, and that is the whole of the collision fix. Twelve of the
       demo's class names — row, head, stage, list, more, empty, chev, drawer,
       title, meta, route, th — are already painted by this app, several of
       them under `.ref-mod`, and `.ref-mod .row` turned every ported row into
       a four-column grid (measured: the title wrapped one letter per line).
       Scoping the PORTED rules was never going to be enough; what matters is
       that the app's own rules cannot reach in. The exam screen solved the
       same problem the same way. */
    /* NO WRAPPER OF ITS OWN. `wm-port` is on `PortPanel` now — one element
       above the card, so the demo's own `.card` rule can reach it — and that
       wrapper covers the tab strip, the route and both tab bodies, which is
       what §4.1 asks for. A second `wm-port` here would be harmless but would
       also be the only clue left that the scope used to start lower down. */
    return (
      <LibraryBatches
        batches={batches}
        total={totalBatches || null}
        here={hereBatch(batches, currentChapterId)}
        query={query}
        moduleName={moduleName}
        me={me}
        /* Who has sat each quiz, for the row's stamp strip (§5, migration
           0038). The same one lookup the shelves' finisher line uses — one
           call for the whole tab rather than one per row. */
        finishers={finishers}
        onQuiz={(b) => onOpenQuiz?.(b.chapter)}
        onCards={(b) => onOpenCards?.(b.chapter)}
        onPaper={(b) => onOpenDownload?.(b.paper)}
        onProfile={(p) => onOpenPerson?.(p)}
      />
    );
  }

  return (
    <div className="libtab ref-mod">
      {/* ------------------------------------------------------ QUIZZES --- */}
      {bare ? <QuizzesWaiting /> : (
      <section className="libsplit" aria-labelledby="lsec-quizzes" ref={quizRef}>
        <div className="lsec">
          <div>
            <h2 id="lsec-quizzes">Quizzes</h2>
            <p>
              {chapters.length} quiz{chapters.length === 1 ? "" : "zes"}, one per chapter
            </p>
          </div>
        </div>

        <div className="papers qstamps">

          {shownQuizzes.map((c) => {
            const s = state?.quiz?.[c.id];
            const lit = faults.has(c.id);
            const total = s?.total ?? c.quizCount ?? null;
            return (
              <button type="button" key={c.id} className="lrow q" onClick={() => onOpenQuiz(c)}
                      data-state={s && !lit ? "done" : undefined}>
                {/* THE ANSWER SHEET, not a document glyph — the same thumbnail
                    the quiz row inside a chapter carries, in the same slot, so
                    a quiz looks like a quiz wherever this Library draws one. */}
                <QuizThumb count={total} />
                <span>
                  {/* §7 — the chapter name IS the row's own name here; the
                      meta says the shape of the quiz and nothing else. */}
                  <div className="lt">{c.quizName || `${c.title} quiz`}</div>
                  <div className={`ls${lit ? " warn" : ""}`}>
                    {[total ? `${total} question${total === 1 ? "" : "s"}` : "Not yet taken",
                      lit ? "below the pass mark" : null].filter(Boolean).join(" · ")}
                  </div>
                </span>
                <span className="rt">
                  {s
                    ? <span className="sc">{s.correct} of {s.total}</span>
                    : <span className="act-o">Take it</span>}
                  {lit && <span className="act-o">Re-check</span>}
                </span>
                <FinisherLine found={finishers[c.quizId || c.id]} />
              </button>
            );
          })}

          {searching && !shownQuizzes.length && (
            <p className="endnote">Try a chapter name, or the word quiz.</p>
          )}
        </div>
      </section>
      )}

      {/* -------------------------------------------------- STUDY CARDS ---
          Between the two, because a card set belongs beside the quiz it
          comes from rather than beside the papers. It used to BE the quiz —
          the same questions, read the other way round — and still is for a
          chapter without cards of its own; a chapter that carries `cards`
          (2026-09-21) has those as its set instead. It draws nothing when
          there is nothing to flip, so there is never a heading over an
          empty list.
          Search filters the other two sections; it does not filter this one,
          which is one row per quiz and already the shortest list here. */}
      <LibraryStudyCards moduleId={moduleCode} />

      {/* ------------------------------------------------------- PAPERS ---
          THE READER IS PAUSED; THE SHELF IS NOT.

          This used to remove the section outright — no empty state, no
          disabled row, no line saying why — on the reasoning that a section
          which is not there cannot disappoint anybody. The owner's call
          reverses that half of it: the pause is temporary and the Library
          has two shelves, so the second one stays visible and says it is on
          its way. What does NOT come back is anything that opens a file —
          no reader chunk, no route, no uploader, no mark. PapersSlot is
          markup and nothing else, and check:paused is updated to test for
          exactly that rather than for the section's absence. */}
      {!shelfOn && <PapersSlot downloads={downloads} />}
      {shelfOn && (
      <section aria-labelledby="lsec-papers" ref={papersRef}>
        <div className="lsec">
          <div>
            <h2 id="lsec-papers">Papers</h2>
            <p>
              {papers.length
                ? `${papers.length} document${papers.length === 1 ? "" : "s"} for this module`
                : "Add one and it opens in the reader"}
            </p>
          </div>
          {onAddPaper && papers.length > 0 && (
            <button type="button" className="pill" onClick={onAddPaper}>Add a paper</button>
          )}
        </div>

        {papers.length > 0 && (
          <div className="lchips">
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
                <button type="button" className="chip is-inline" aria-pressed={!chapterFilter}
                        onClick={() => setChapterFilter(null)}>All</button>
                {chapters.map((c) => (
                  <button type="button" key={c.id} className="chip is-inline"
                          aria-pressed={chapterFilter === c.id}
                          onClick={() => setChapterFilter(c.id)}>{c.title}</button>
                ))}
              </>
            )}
          </div>
        )}

        {/* The same download rows the paused slot draws, so turning the
            viewer on never takes a module's downloads off its shelf. */}
        <LibraryDownloads downloads={downloads} />

        <ul className="papers" ref={papersListRef}>
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
              <li key={p.id}>
              <button type="button" className="paper" data-here={here ? "" : undefined}
                      disabled={preparing}
                      onClick={() => onOpenPaper(p)}>
                <span className="pg">{DOC}</span>
                <span>
                  <div className="lt">{p.title}</div>
                  <div className="ls">
                    {preparing
                      ? "Preparing — the text layer and thumbnails are being built"
                      : [p.kind || "PDF",
                         p.pages ? `${p.pages} page${p.pages === 1 ? "" : "s"}` : null,
                         here ? `you are on page ${readerPin.page}` : null]
                        .filter(Boolean).join(" · ")}
                  </div>
                  {/* The hairline, not a second row. */}
                  {through > 0 && (
                    <span className="prog" aria-hidden="true"><b style={{ width: `${through}%` }} /></span>
                  )}
                </span>
                <span className={here ? "resume" : "act-o"}>
                  {preparing ? "Preparing…" : here ? "Resume" : "Open"}
                </span>
              </button>
              </li>
            );
          })}
          {/* §17b — the empty state names the next action inside the sentence
              and gives it a button. It never states an absence. */}
          {!shownPapers.length && (
            papers.length ? (
              <li><p className="endnote">Try a paper title, a chapter name, or the All chip.</p></li>
            ) : (
              <li className="libempty">
                <p>
                  Add the first paper for this module and it opens in the reader —
                  highlight a line, leave a note, ask the module about it.
                </p>
                {onAddPaper && (
                  <button type="button" className="pill pri" onClick={onAddPaper}>Add a paper</button>
                )}
              </li>
            )
          )}
        </ul>
      </section>
      )}

      {/* ------------------------------------- SHARED STUDY MATERIAL ---
          The last row of the Library, and the only one that opens nothing.
          The annotation layer is what this names — highlighting a paper and
          leaving notes on it, together — and it is paused behind
          `paper.viewer`. The row says the name and what it will do, with a
          pill saying it is not here yet, because the alternative is a
          student reading nothing at all about it.

          It is a div and not a button: `check:doors` asks that no control be
          bound to nothing, and a row that answers a press with nothing is
          exactly that. The pill is not clickable either. */}
      <div className="papers">
        <div className="lrow" data-soon="1">
          <span className="th" aria-hidden="true" />
          <span>
            <div className="lt">Shared study material</div>
            <div className="ls">Highlight and take notes together</div>
          </span>
          <span className="rt"><span className="wm-pill-soon">IN THE WORKS</span></span>
        </div>
      </div>
    </div>
  );
}
