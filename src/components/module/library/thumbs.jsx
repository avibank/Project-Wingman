/* =============================================================================
   THE THREE THUMBNAILS — the demo's `T.quiz`, `T.cards` and `T.paper`.
   -----------------------------------------------------------------------------
   The markup is the demo's, element for element and class for class, because
   `batches.css` is the demo's stylesheet and every rule in it depends on this
   exact nesting. Changing a wrapper here is changing the design.

   `data-count` IS READ BY `countUp`, which runs when a row opens and ticks
   each number up from zero. The number is also the element's text, so a row
   that never animates (reduced motion, or a browser that skipped the frame)
   still reads correctly — the animation replaces a value that was already
   right rather than filling in a blank.
   ========================================================================= */
const PENCIL = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinejoin="round">
    <path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" />
  </svg>
);

/* The quiz sheet shows the LAST attempt — nine bubbles, filled to the score —
   and the best score is stamped on it. Never sat is a dashed blank sheet with
   a pencil that scribbles. */
export function QuizThumb({ q, score, got }) {
  const sat = score != null;
  const dots = Array.from({ length: 9 }, (_, i) => (
    <i key={i} className={sat && i < (got || 0) ? "lb-on" : ""} />
  ));
  return (
    <span className={`lb-th lb-quiz-thumb ${sat ? "lb-sat" : "lb-blank"}`} aria-hidden="true">
      <span className="lb-quiz-thumb__sheet">
        {[0, 3, 6].map((k) => <span key={k}>{dots.slice(k, k + 3)}</span>)}
      </span>
      <span className="lb-quiz-thumb__count">
        {!sat && <span className="lb-pencil">{PENCIL}</span>}
        <b data-count={q}>{q}</b>Qs
      </span>
      {sat && <span className="lb-stamp" data-count={score}>{score}</span>}
    </span>
  );
}

/* Always fanned; the top card carries how many are done out of the total. */
export function CardsThumb({ seen, cards }) {
  return (
    <span className="lb-th lb-cards-thumb" aria-hidden="true">
      <i /><i /><i />
      <span className="lb-done"><b data-count={seen}>{seen}</b><small>/{cards}</small></span>
    </span>
  );
}

/* The question bank: a stack of pages with a Q-BANK header and three numbered
   questions, and the page count as a big number. */
export function PaperThumb({ pp }) {
  const q = (n) => (
    <span className="lb-q" key={n}>
      <b>{n}</b><span><i /><em><u /><u /><u /></em></span>
    </span>
  );
  return (
    <span className="lb-th lb-pg" aria-hidden="true">
      <span className="lb-pp lb-b2" /><span className="lb-pp lb-b1" />
      <span className="lb-top"><span className="lb-qb">Q-BANK</span>{q(1)}{q(2)}{q(3)}</span>
      <span className="lb-count"><span data-count={pp}>{pp}</span><small>pages</small></span>
    </span>
  );
}

export const CHEV = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
