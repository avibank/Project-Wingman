/* =============================================================================
   THE LIBRARY, AS BATCHES — ported from the approved demo, 2026-10-06.
   -----------------------------------------------------------------------------
   One row per batch; opening one plays its quiz, cards and question-bank
   thumbnails into place. The markup is the demo's 1:1 — `batches.css` is the
   demo's stylesheet and depends on the exact nesting
   (`.row > .head + .drawer > div > .tiles > .tile > .stage > .th`).

   A BATCH IS NOT A CHAPTER'S POSITION. The module says how many batches it
   will have when it is finished and each chapter says which one it IS, so
   batches 1 and 6 of ten can exist with nothing between them — which is what
   the route strip is for. Everything a batch needs comes off the loaded
   chapter; nothing here parses a title.

   OPENING AND CLOSING DOES NOT RE-RENDER THE LIST, because the animation is
   CSS on `.row.on` and a re-render restarts it. One piece of state says which
   row is open and the class follows, exactly as the demo's `setOpen` does.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuizThumb, CardsThumb, PaperThumb, CHEV } from "./thumbs.jsx";
/* `batches.css` is imported by LibraryTab, not here. This component is a lazy
   chunk and Vite gives a lazy chunk its own stylesheet — one more file that
   can fail on its own, and when it does the Library renders unstyled. Imported
   from the tab it rides the module screen's own CSS, which is already loaded
   by the time anything can ask for this screen. */

const pad = (n) => String(n).padStart(2, "0");

/* The demo's `countUp`: each number ticks from zero when its row opens. It is
   copied rather than rewritten, per the handoff. */
function countUp(root, reduced) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    if (!Number.isFinite(end)) return;
    if (reduced) { el.textContent = String(end); return; }
    const t0 = performance.now() + 300;
    const d = 700;
    const step = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / d));
      el.textContent = String(Math.round(end * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  });
}

/**
 * `batches` are the module's chapters that carry a batch number, already
 * joined to the student's own figures by the caller.
 */
export default function LibraryBatches({
  batches, total, here, query = "", onQuiz, onCards, onPaper,
}) {
  const open = useMemo(() => batches.filter((b) => b.n != null), [batches]);
  /* THE CURRENT BATCH IS OPEN ON ARRIVAL, and it has to be set once the
     content has actually arrived rather than at mount: the course document is
     fetched, so the first render of this screen has no batches at all and an
     initial state computed from it is null for good. `touched` is what keeps
     that from fighting the student — once they have opened or closed anything
     themselves, the content settling again must not reopen the row they
     just shut. */
  const [openRow, setOpenRow] = useState(null);
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || openRow != null) return;
    const want = here ?? open[0]?.n ?? null;
    if (want != null) setOpenRow(want);
  }, [here, open, openRow]);
  const choose = (n) => { touched.current = true; setOpenRow(n); };
  const listRef = useRef(null);
  const reduced = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const match = useCallback((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [b.topic, b.ref, b.pages, `batch ${b.n}`].join(" ").toLowerCase().includes(q);
  }, [query]);

  const shown = useMemo(() => open.filter(match), [open, match]);

  /* The numbers tick when a row opens, and only then. */
  useEffect(() => {
    if (openRow == null || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-row="${openRow}"]`);
    if (el) countUp(el, reduced);
  }, [openRow, reduced]);

  /* How many batches the module will have, and which is next to land. */
  const last = open.length ? Math.max(...open.map((b) => b.n)) : 0;
  const soonCount = Math.max(0, (total || open.length) - open.length);
  const next = total && last < total ? last + 1 : null;

  const go = (n) => {
    choose(n);
    const el = listRef.current?.querySelector(`[data-row="${n}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="lib2">
      {/* THE ROUTE STRIP — one waypoint per batch the module will have, so the
          gaps between what has landed are visible. Library only; the demo
          hides it on Lessons and Crew. */}
      {total > 0 && (
        <div className="lb-route" aria-label="Batches in this module"
             style={{ "--lb-batches": total }}>
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const b = open.find((x) => x.n === n);
            return (
              <button key={n} type="button"
                      className={`lb-wp ${b ? "lb-open" : ""} ${here === n ? "lb-here" : ""}`}
                      title={`Batch ${n}${b ? ` · ${b.topic}` : " · on the way"}`}
                      onClick={() => (b ? go(n) : null)}
                      aria-disabled={b ? undefined : "true"}>{n}</button>
            );
          })}
        </div>
      )}

      {query && !shown.length ? (
        /* §10: it names the way out rather than the absence. */
        <div className="lb-empty">Nothing here matches &ldquo;{query}&rdquo; — clear the search to see every batch.</div>
      ) : (
        <>
          <div className="lb-list" ref={listRef}>
            {shown.map((b) => (
              <div key={b.n} className={`lb-row ${here === b.n ? "lb-here" : ""} ${openRow === b.n ? "lb-on" : ""}`}
                   id={`b${b.n}`} data-row={b.n}>
                <button type="button" className="lb-head" aria-expanded={openRow === b.n}
                        onClick={() => choose(openRow === b.n ? null : b.n)}>
                  <span className="lb-num">{pad(b.n)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="lb-title">{b.topic}</span>
                    <span className="lb-meta">Batch {b.n}{b.ref ? ` · ${b.ref}` : ""}{b.pages ? ` · pp ${b.pages}` : ""}</span>
                  </span>
                  <span className="lb-chev" aria-hidden="true">{CHEV}</span>
                </button>
                <div className="lb-drawer"><div><div className="lb-tiles">
                  <button type="button" className="lb-tile" onClick={() => onQuiz?.(b)}
                          aria-label={`Quiz, ${b.q} questions, ${b.score == null ? "not sat yet" : `best ${b.score}%`}`}>
                    <span className="lb-stage"><QuizThumb q={b.q} score={b.score} got={b.got} /></span>
                    <strong>Quiz</strong>
                  </button>
                  <button type="button" className="lb-tile" onClick={() => onCards?.(b)}
                          aria-label={`Study cards, ${b.seen} of ${b.cards} done`}>
                    <span className="lb-stage"><CardsThumb seen={b.seen} cards={b.cards} /></span>
                    <strong>Cards</strong>
                  </button>
                  <button type="button" className="lb-tile" onClick={() => onPaper?.(b)}
                          disabled={!b.paper}
                          aria-label={b.paper
                            ? `Question bank, PDF, ${b.pp} pages, download`
                            : "Question bank, not on the shelf yet"}>
                    <span className="lb-stage"><PaperThumb pp={b.pp} /></span>
                    <strong>Question bank</strong>
                  </button>
                </div></div></div>
              </div>
            ))}

            {/* The next one to land, and only when the module says there is
                one. Hidden while searching, as the demo has it. */}
            {!query && next && (
              <div className="lb-row lb-soon">
                <div className="lb-head">
                  <span className="lb-num">{pad(next)}</span>
                  <span className="lb-title">Batch {next}</span>
                  <span className="lb-flag">Next to land</span>
                </div>
              </div>
            )}
          </div>
          {!query && soonCount > 1 && (
            <div className="lb-more">{soonCount - 1} more batches on the way.</div>
          )}
        </>
      )}
    </div>
  );
}
