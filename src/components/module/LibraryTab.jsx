import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { hits, terms } from "../../lib/moduleSearch.js";
import { CautionMark } from "./Instruments.jsx";
import Dial from "./Dial.jsx";
import MinimumsPop from "./MinimumsPop.jsx";

/* ============================================================================
   §5 — THE LIBRARY.

   Two sections in one scroll, in this order: Quizzes, then Papers. The
   Quizzes header carries the small accuracy dial (§3 — one of exactly two
   places it appears), and Calibration is pinned above the chapter quizzes
   with a rule beneath it.

   CALIBRATION AND RE-CHECK ARE DIFFERENT THINGS AND NEVER SHARE A WORD.
   Calibration is the answers you already got RIGHT, kept in currency — that
   is `holding` in the retention store. Re-check is the ones you MISSED on a
   specific quiz — that is `caution`. So there is no caution language on the
   Calibration row, ever: no lamp, no "outstanding", no "to put right". It is
   not remediation and it must not look like it, because a student who reads
   it as remediation stops opening it.

   The section headings are NOT buttons. The Quizzes header contains the dial,
   which is itself a control, and a button inside a button is invalid nested
   interactive content — the inner one becomes unreachable while still eating
   the click. Nothing here collapses, so nothing needs to be a button.
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

/* "6 days ago", or nothing at all. Never "never" and never a zero — an empty
   state names its next action instead, which here is the Start button beside
   it. */
function agoWords(iso) {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function LibraryTab({
  chapters, papers, state, sub, onOpenQuiz, onOpenPaper,
  query = "",
  warm = 0, lastRecheck = null,
  average = null, lastQuiz = null, minimums, onMinimums,
  faults = new Set(), onStartCalibration,
}) {
  const [chapterFilter, setChapterFilter] = useState(null);
  const [minOpen, setMinOpen] = useState(null);   // the dial's anchor element

  // §5 turned the Library's segmented control into one scroll, but the URL
  // still distinguishes /library from /library/quizzes. Rather than drop that
  // meaning, the named section is brought into view on arrival — a link to
  // the quizzes still lands on the quizzes.
  const quizRef = useRef(null);
  const papersRef = useRef(null);
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

  const warmWords = warm > 0
    ? `${warm} question${warm === 1 ? "" : "s"} kept warm`
    : "The ones you get right are kept here";

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

          {/* §3 — the dial, at its small size, inside the card so it has a
              housing and renders the same on every finish. The reading beside
              it is the fewest words that work. */}
          <div className="dialwrap">
            <p className="dialread">
              <b>{average === null ? "—" : `${average}%`}</b>
              <span>bar {minimums}%</span>
            </p>
            <button type="button" className="dialbtn is-inline"
                    aria-expanded={minOpen ? "true" : "false"}
                    aria-label={`Your minimums, ${minimums} per cent. Change them.`}
                    onClick={(e) => setMinOpen(minOpen ? null : e.currentTarget)}>
              <Dial size={58} average={average} last={lastQuiz} minimums={minimums} />
            </button>
          </div>
        </div>

        {minOpen && (
          <MinimumsPop anchor={minOpen} value={minimums} onChange={onMinimums}
                       onClose={() => { const el = minOpen; setMinOpen(null); el?.focus(); }} />
        )}

        <div className="libwrap">
          {/* §5 — Calibration, pinned above the chapter quizzes with a rule
              beneath it. Its leading mark is the sticker. */}
          {!searching && (
            <button type="button" className="item calrow" disabled={!warm}
                    onClick={() => warm && onStartCalibration?.()}>
              <span className="calsticker" aria-hidden="true">
                <span className="calband">Calibration</span>
                <span className="calval">{warm || "—"}</span>
              </span>
              <span className="imain">
                <span className="iname">Calibration</span>
                <span className="imeta">{warmWords}</span>
              </span>
              <span className="istat">
                {agoWords(lastRecheck) && <span className="calwhen">{agoWords(lastRecheck)}</span>}
                {/* §5's copy is `Start`, and only that. With nothing warm yet
                    there is nothing to start, so the action stands down and
                    the meta line beside it names what will fill the pile —
                    an empty state that names its next action, not a dead
                    primary button. */}
                {warm > 0 && <span className="go">Start</span>}
              </span>
            </button>
          )}

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
                  {/* §2 — in the Library the QUIZ ROW owns the problem, because
                      there is no chapter grouping here to own it instead. */}
                  {lit && <CautionMark compact />}
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

      {/* ------------------------------------------------------- PAPERS --- */}
      <section className="lsec" aria-labelledby="lsec-papers" ref={papersRef}>
        <div className="lsec-head">
          <div className="lsec-id">
            <h2 className="lsec-name" id="lsec-papers">Papers</h2>
            <p className="lsec-sub">
              {papers.length
                ? `${papers.length} document${papers.length === 1 ? "" : "s"} for this module`
                : "Documents arrive with the content"}
            </p>
          </div>
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

        <div className="libwrap">
          {shownPapers.map((p) => (
            <button type="button" key={p.id} className="item" onClick={() => onOpenPaper(p)}>
              <span className="lead mark">{DOC}</span>
              <span className="imain">
                <span className="iname">{p.title}</span>
                {/* §7 — never state a duration twice in one row, and no
                    progress state on a document. */}
                <span className="imeta">
                  {[p.kind || "PDF", p.pages ? `${p.pages} page${p.pages === 1 ? "" : "s"}` : null]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="istat"><span className="go ghost">Open</span></span>
            </button>
          ))}
          {!shownPapers.length && (
            <p className="endnote">
              {papers.length
                ? "Try a paper title, a chapter name, or the All chip."
                : "The papers for this module arrive with the content."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
