/* =============================================================================
   THE LIBRARY, AS BATCHES — the approved demo, ported.
   -----------------------------------------------------------------------------
   `docs/launch/reference/06-library-lessons-cards.html`. One row per batch;
   opening one plays its quiz, cards and question-bank thumbnails into place.

   THE CLASS NAMES ARE THE DEMO'S OWN, which is a deliberate change from the
   first port (2026-10-06) and what §4 of the second handoff asks for. That
   port renamed all twelve colliding names to `.lb-*` so the sheet could live
   under `.ref-mod`; this one keeps `.row`, `.head`, `.num`, `.title`, `.meta`,
   `.chev`, `.tile`, `.stage`, `.th` and relies on the whole screen being
   wrapped in `.wm-port` instead — `port.css` is generated from the demo with
   every selector prefixed, so the two cannot reach each other and this file
   can be read against the demo line for line.

   §4's nesting is exact and `port.css` depends on it:
     .row > .head(button) + .crew + .drawer > div > .tiles > .tile > .stage > .th
   The crew strip is a SIBLING of the head rather than inside it, which is how
   "clicking the strip never opens/closes the row" is true by construction
   rather than by an event guard — a button cannot contain a button.

   `.title` AND `.meta` ARE DIVS, as they are in the demo. The generated sheet
   gives neither a `display`, so as spans they would run together on one line.

   A BATCH IS NOT A CHAPTER'S POSITION. The module says how many batches it
   will have when finished and each chapter says which one it IS, so batches 1
   and 6 of ten can exist with nothing between them — which is what the route
   strip is for. Everything a batch needs comes off the loaded chapter; nothing
   here parses a title.

   OPENING AND CLOSING DOES NOT RE-RENDER THE LIST, because the animation is
   CSS on `.row.on` and a re-render restarts it. One piece of state says which
   row is open and the class follows, exactly as the demo's `setOpen` does.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuizThumb, CardsThumb, PaperThumb, CHEV } from "./thumbs.jsx";
import CrewStrip from "./CrewStrip.jsx";
/* `port.css` is imported by LibraryTab, not here — see the note there about a
   stylesheet that can fail on its own. */

const pad = (n) => String(n).padStart(2, "0");

/* THE DEMO'S `countUp`, copied rather than rewritten, per §6.3. Each number
   ticks from zero when its row opens: 300ms of delay, then 700ms on a cubic
   ease-out. It writes `textContent` directly, which is the demo's own
   behaviour and is why every number in the thumbnails carries `data-count` —
   React's rendered value is the FINAL number, so a re-render mid-count simply
   lands on the answer rather than breaking. */
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
 * joined to the student's own figures by the caller. `finishers` is the whole
 * tab's one lookup of who has sat each quiz, keyed by quiz id (migration 0038).
 */
export default function LibraryBatches({
  batches, total, here, query = "", moduleName = null, me = null,
  finishers = {}, onQuiz, onCards, onPaper, onProfile, onHere,
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
  const [crewRow, setCrewRow] = useState(null);
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || openRow != null) return;
    const want = here ?? open[0]?.n ?? null;
    if (want != null) setOpenRow(want);
  }, [here, open, openRow]);
  /* Opening a row is what says "this is where I am", so it is also what moves
     the light on the route strip — and it is remembered, so coming back to the
     module opens the same one. Closing a row (n === null) leaves the light
     where it was: you have not moved on, you have just folded it up. */
  const choose = (n) => {
    touched.current = true;
    setOpenRow(n);
    setCrewRow(null);
    if (n != null) onHere?.(n);
  };
  const listRef = useRef(null);
  const reduced = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* THE POP-OUT CLOSES ON A CLICK OUTSIDE IT OR ON ESCAPE (§5). Bound only
     while one is open, so the screen carries no listener the rest of the time. */
  useEffect(() => {
    if (crewRow == null) return undefined;
    const away = (e) => { if (!e.target.closest?.(".crewpop,.crew")) setCrewRow(null); };
    const key = (e) => { if (e.key === "Escape") setCrewRow(null); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", key);
    };
  }, [crewRow]);

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
    /* §5: "Clicking a published one opens that row and scrolls it to centre." */
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  };

  const quizIdOf = (b) => b.chapter?.quizId || b.chapter?.id || null;
  const foundFor = (b) => finishers[quizIdOf(b)] || null;

  return (
    <>
      {/* THE ROUTE STRIP — one waypoint per batch the module will have, so the
          gaps between what has landed are visible. Library only: the Lessons
          tab has no route (§5), and this component is only on the Library.
          The column count is the MODULE's rather than the demo's hard-coded
          ten (§7: "Total batches comes from the module"). */}
      {total > 0 && (
        <div className="route" aria-label="Batches in this module"
             style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const b = open.find((x) => x.n === n);
            return (
              <button key={n} type="button"
                      className={`wp ${b ? "open" : ""} ${here === n ? "here" : ""}`}
                      title={`Batch ${n}${b ? ` · ${b.topic}` : " · on the way"}`}
                      onClick={() => (b ? go(n) : null)}
                      aria-disabled={b ? undefined : "true"}>{n}</button>
            );
          })}
        </div>
      )}

      {query && !shown.length ? (
        /* The demo's line is "Nothing in 13d matches “…”." — §10 of this app
           asks an empty state to name its next action inside the sentence, and
           check:doors fails a build that does not, so the way out is named. */
        <div className="empty">
          Nothing in {moduleName || "this module"} matches &ldquo;{query}&rdquo; — clear the search to see every batch.
        </div>
      ) : (
        <>
          <div className="list" ref={listRef}>
            {shown.map((b) => (
              <div key={b.n} className={`row ${here === b.n ? "here" : ""} ${openRow === b.n ? "on" : ""}`}
                   id={`b${b.n}`} data-row={b.n}>
                <button type="button" className="head" aria-expanded={openRow === b.n}
                        onClick={() => choose(openRow === b.n ? null : b.n)}>
                  <span className="num">{pad(b.n)}</span>
                  <span style={{ minWidth: 0 }}>
                    <div className="title">{b.topic}</div>
                    <div className="meta">Batch {b.n}{b.ref ? ` · ${b.ref}` : ""}{b.pages ? ` · pp ${b.pages}` : ""}</div>
                  </span>
                  <span className="chev" aria-hidden="true">{CHEV}</span>
                </button>
                <CrewStrip found={foundFor(b)} me={me} quizId={quizIdOf(b)}
                           open={crewRow === b.n}
                           onToggle={() => setCrewRow(crewRow === b.n ? null : b.n)}
                           onProfile={(p) => { setCrewRow(null); onProfile?.(p); }} />
                <div className="drawer"><div><div className="tiles">
                  <button type="button" className="tile" onClick={() => onQuiz?.(b)}
                          aria-label={`Quiz, ${b.q} questions, ${b.score == null ? "not sat yet" : `best ${b.score}%`}`}>
                    <span className="stage"><QuizThumb batch={b} /></span>
                    <strong>Quiz</strong>
                  </button>
                  <button type="button" className="tile" onClick={() => onCards?.(b)}
                          aria-label={`Study cards, ${b.seen} of ${b.cards} done`}>
                    <span className="stage"><CardsThumb batch={b} /></span>
                    <strong>Cards</strong>
                  </button>
                  <button type="button" className="tile" onClick={() => onPaper?.(b)}
                          disabled={!b.paper}
                          aria-label={b.paper
                            ? `Question bank, PDF, ${b.pp} pages, download`
                            : "Question bank, not on the shelf yet"}>
                    <span className="stage"><PaperThumb batch={b} /></span>
                    <strong>Question bank</strong>
                  </button>
                </div></div></div>
              </div>
            ))}

            {/* The next one to land, and only when the module says there is
                one. Hidden while searching, as the demo has it. */}
            {!query && next && (
              <div className="row soon">
                <div className="head">
                  <span className="num">{pad(next)}</span>
                  <span className="title">Batch {next}</span>
                  <span className="flag">Next to land</span>
                </div>
              </div>
            )}
          </div>
          {!query && soonCount > 1 && (
            <div className="more">{soonCount - 1} more batches on the way.</div>
          )}
        </>
      )}
    </>
  );
}
