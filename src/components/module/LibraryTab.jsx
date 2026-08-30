import { useState } from "react";
import { Check } from "lucide-react";
import { hits, terms } from "../../lib/moduleSearch.js";

// One tab, two segments. Papers is a folder; Quizzes is a record — how you
// have done, not what is available. The same quiz reached from its chapter and
// from here is one object with one score, which is why both read the same
// state.quiz map rather than keeping their own.
// Where a row of chips stops being a row. Twelve wraps to at most two lines at
// the narrowest card, which still reads as a set of choices.
const CHIP_MAX = 12;

export default function LibraryTab({ chapters, papers, state, sub, onSub, onOpenQuiz, onOpenPaper, query = "" }) {
  const [chapterFilter, setChapterFilter] = useState(null);
  // The search moved out to sit beside the tabs (§2.3). The chapter chips
  // stayed: they are a different question — chips ask "which chapter", the
  // field asks "which words", and the two compose.
  const searching = terms(query).length > 0;

  const shown = papers.filter((p) =>
    (!chapterFilter || p.chapterId === chapterFilter)
    && hits(`${p.title} ${p.chapterTitle || ""}`, query));

  // The placeholder says "Search quizzes", so it has to actually reach them.
  const shownQuizzes = chapters.filter((c) => hits(`${c.title} quiz ${c.id}`, query));
  const taken = chapters.filter((c) => state?.quiz?.[c.id]);
  const avg = taken.length
    ? Math.round(taken.reduce((n, c) => n + state.quiz[c.id].correct, 0) / taken.length)
    : null;
  const nextUntaken = chapters.find((c) => state?.quiz?.[c.id] == null);

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Library">
        {[["papers", "Papers"], ["quizzes", "Quizzes"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" className="fchip"
                  aria-selected={sub === id} aria-pressed={sub === id}
                  onClick={() => onSub(id)}>{label}</button>
        ))}
      </div>

      {sub === "papers" ? (
        <>
          {/* One chip per chapter is right for four and wrong for forty: at 42
              the chips wrapped to 354px and buried the papers under the filter
              for them. Past the cap the same choice becomes one select — the
              function is kept, not dropped, and the height stops growing. */}
          <div className="filt">
            {chapters.length > CHIP_MAX ? (
              <label className="fsel">
                <span className="fsel-l">Chapter</span>
                <select className="fsel-f" value={chapterFilter || ""}
                        onChange={(e) => setChapterFilter(e.target.value || null)}>
                  <option value="">All chapters</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <button type="button" className="fchip" aria-pressed={!chapterFilter}
                        onClick={() => setChapterFilter(null)}>All</button>
                {chapters.map((c) => (
                  <button key={c.id} type="button" className="fchip"
                          aria-pressed={chapterFilter === c.id}
                          onClick={() => setChapterFilter(c.id)}>{c.title}</button>
                ))}
              </>
            )}
          </div>

          <div className="libwrap">
            {shown.map((p) => (
              <button key={p.id} type="button" className="row" onClick={() => onOpenPaper(p)}>
                <span className="mark">
                  {state?.opened?.[p.id] ? <Check aria-hidden="true" /> : null}
                </span>
                <span>
                  <span className="rn">{p.title}</span>
                  <span className="rm">{p.chapterTitle}{p.pages ? ` · ${p.pages} page${p.pages === 1 ? "" : "s"}` : ""}</span>
                </span>
                <span className="rstate">{state?.opened?.[p.id] ? "Opened" : ""}</span>
                <span className="chv" aria-hidden="true">›</span>
              </button>
            ))}
          </div>

          {/* Empty says what will fill it, never a count of nothing. */}
          {!shown.length && (
            <p className="endnote">
              {papers.length
                ? "Try a paper title, a chapter name, or the All chip."
                : "The papers for this module arrive with the content."}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="tally">
            <div>
              <p className="tbig">{taken.length} of {chapters.length} taken</p>
              <p className="tsub">
                {avg != null ? `You average ${avg} of ${taken[0] ? state.quiz[taken[0].id].total : 8}.`
                             : "No average until you have taken one."}
              </p>
            </div>
            {nextUntaken && (
              <button type="button" className="nextgo" onClick={() => onOpenQuiz(nextUntaken)}>
                {nextUntaken.title} quiz
              </button>
            )}
          </div>

          {searching && !shownQuizzes.length && (
            <p className="endnote">Try a chapter name, or the word quiz.</p>
          )}

          <div className="libwrap">
            {shownQuizzes.map((c) => {
              const s = state?.quiz?.[c.id];
              return (
                <button key={c.id} type="button" className="row" onClick={() => onOpenQuiz(c)}>
                  <span className="mark">{s ? <Check aria-hidden="true" /> : null}</span>
                  <span>
                    <span className="rn">{c.title} quiz</span>
                    <span className="rm">{c.quizCount || 8} questions</span>
                  </span>
                  <span className="rstate">{s ? `You got ${s.correct} of ${s.total}` : "Not taken"}</span>
                  <span className="chv" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
