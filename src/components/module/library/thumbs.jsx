/* =============================================================================
   THE THREE THUMBNAILS, FROM THE DEMO'S `T` OBJECT.
   -----------------------------------------------------------------------------
   `docs/launch/reference/06-library-lessons-cards.html`, the handoff's "source
   of truth — copy this". The markup below is its `T.quiz`, `T.cards` and
   `T.paper` element for element and class for class, including the names that
   look like typos (`.pp.b1`, `.q > b + span > i + em > u`): the stylesheet is
   generated from the same file and keys off exactly these.

   THE CLASS NAMES ARE THE DEMO'S, NOT RENAMED. The first port renamed every
   one of them to `.lb-*` so the sheet could live under `.ref-mod`; §4 of the
   second handoff asks for the opposite — the demo's own names, with the whole
   screen wrapped in `.wm-port` so neither sheet can reach the other. That is
   what lets this file be checked against the demo by eye.

   `data-count` IS NOT DECORATION. The demo counts every number up from zero
   when a row opens (`countUp`), reading the target off this attribute, so a
   number that is printed without one simply appears — which is most of what
   the row's opening animation is. `useCountUp` in LibraryBatches.jsx is the
   other half.
   ========================================================================= */

const PENCIL = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinejoin="round">
    <path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" />
  </svg>
);

export const CHEV = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const PLAY = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
);

/* THE QUIZ: the answer sheet shows the LAST attempt, the best score is stamped
   on it, and a batch nobody has sat draws a blank sheet and a pencil instead.
   Nine bubbles in three rows of three; `got` of them filled. */
export function QuizThumb({ batch }) {
  const sat = batch.score != null;
  const dots = Array.from({ length: 9 }, (_, i) => (sat && i < batch.got));
  return (
    <span className={`th quiz-thumb ${sat ? "sat" : "blank"}`} aria-hidden="true">
      <span className="quiz-thumb__sheet">
        {[0, 3, 6].map((k) => (
          <span key={k}>
            {dots.slice(k, k + 3).map((on, i) => <i key={i} className={on ? "on" : ""} />)}
          </span>
        ))}
      </span>
      <span className="quiz-thumb__count">
        {!sat && <span className="pencil">{PENCIL}</span>}
        <b data-count={batch.q}>{batch.q}</b>Qs
      </span>
      {sat && <span className="stamp" data-count={batch.score}>{batch.score}</span>}
    </span>
  );
}

/* THE CARDS: always fanned, and the top card carries how many of the set are
   done over the total. No progress bar — the demo took it out and the
   handoff's checklist says so twice ("no progress bar"). */
export function CardsThumb({ batch }) {
  return (
    <span className="th cards-thumb" aria-hidden="true">
      <i /><i /><i />
      <span className="done">
        <b data-count={batch.seen}>{batch.seen}</b>
        <small>/{batch.cards}</small>
      </span>
    </span>
  );
}

/* THE QUESTION BANK: a stack of pages whose top sheet has the Q-BANK header
   and three numbered questions, their answer lines drawing in as the row
   opens, with the page count beside it.

   `pp` IS COUNTED OUT OF THE PDF, never guessed — the row prints it to a
   student (CLAUDE.md). A batch whose paper is not on the shelf has `pp` 0, and
   that 0 is never printed: the tile is disabled and says so in words, because
   §10 forbids naming an absence. */
export function PaperThumb({ batch }) {
  const q = (n) => (
    <span className="q" key={n}>
      <b>{n}</b>
      <span><i /><em><u /><u /><u /></em></span>
    </span>
  );
  return (
    <span className="th pg" aria-hidden="true">
      <span className="pp b2" /><span className="pp b1" />
      <span className="top">
        <span className="qb">Q-BANK</span>
        {q(1)}{q(2)}{q(3)}
      </span>
      <span className="count">
        <span data-count={batch.pp}>{batch.pp}</span><small>pages</small>
      </span>
    </span>
  );
}
