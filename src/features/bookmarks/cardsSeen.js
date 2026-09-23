/* =============================================================================
   HOW MANY OF A SET'S CARDS HAVE BEEN TURNED OVER.
   -----------------------------------------------------------------------------
   The reference's card-set row carries `done/total` beside **Test yourself**,
   and until now this app had nothing to put in front of the total: nothing
   counted a flipped card, so the row showed the count alone. It is counted
   here instead of left out, because "8 cards" and "3/8 cards" are different
   sentences and only one of them tells you where you stopped.

   A CARD IS SEEN WHEN ITS ANSWER HAS BEEN. Not when it scrolls past — turning
   it over is the whole exercise, so that is the event. Stored by the
   QUESTION'S OWN id, never by position, for the same reason a saved question
   is (CLAUDE.md, Bookmarks): a set that gains a card at the front must not
   renumber what you have already done.

   One key, `pw-cards-seen`, written patch-only through the provider like
   every other progress key. It is a map of id -> true and it never shrinks on
   its own; "start again" is a different button and does not exist yet.
   ========================================================================= */
export const CARDS_SEEN = 'pw-cards-seen';

/** The stored map, always an object. */
export const seenMap = (progress) => progress.get(CARDS_SEEN, {}) || {};

/** How many of these question ids have been turned over. */
export const seenCount = (progress, ids = []) => {
  const seen = seenMap(progress);
  return ids.reduce((n, id) => n + (seen[id] ? 1 : 0), 0);
};

/** Mark one card seen. A no-op when it already is, so a re-flip writes nothing. */
export function markSeen(progress, id) {
  if (!id) return;
  const seen = seenMap(progress);
  if (seen[id]) return;
  progress.set(CARDS_SEEN, { ...seen, [id]: true });
}

/* =============================================================================
   AND WHAT YOU GOT, WHICH IS A SECOND THING THE SET HAS TO REMEMBER.
   -----------------------------------------------------------------------------
   The owner (2026-09-23): "study cards should save your progress". Two kinds
   of progress, and they are not the same:

   · WHERE YOU STOPPED. `pw-cards-seen` already knows which cards have been
     turned over, so the pad does not need a second key to open where you left
     off: the first card you have not turned IS where you stopped. A separate
     "last index" would be a second truth to keep in step, and would renumber
     itself the moment a set gained a card.
   · WHAT STUCK. "Test yourself" asked you card by card and then threw the
     answer away at the door. It is kept now, by question id, and it is spent
     on the ORDER OF THE NEXT DEAL rather than on a number: the ones that
     slipped come round first, then the ones you have not met, then the ones
     you had. This app does not score a card set — FinishPanel's header says
     so in as many words — so what you got changes what you are handed, which
     is the same bargain the caution pile makes after a quiz.

   Getting one right takes it off the pile; getting it wrong puts it back on.
   Nothing here ever shows a count of what you missed.
   ========================================================================= */
export const CARDS_GOT = 'pw-cards-got';

/** The stored map of ids you had, always an object. */
export const gotMap = (progress) => progress.get(CARDS_GOT, {}) || {};

/** Record one card's outcome. Right takes it off the pile, wrong puts it back. */
export function markGot(progress, id, yes) {
  if (!id) return;
  const got = gotMap(progress);
  if (yes === !!got[id]) return;                 // nothing to write
  const next = { ...got };
  if (yes) next[id] = true; else delete next[id];
  progress.set(CARDS_GOT, next);
}

/** Where the pad opens: the first card not turned over yet, or the top. */
export function firstUnseen(progress, cards = []) {
  const seen = seenMap(progress);
  const i = cards.findIndex((c) => !seen[c.id]);
  return i < 0 ? 0 : i;
}

/** Has every card in this set been turned over at least once? */
export const allSeen = (progress, cards = []) =>
  cards.length > 0 && seenCount(progress, cards.map((c) => c.id)) === cards.length;

/**
 * The order a test deals in: what slipped, then what you have not met, then
 * what you had. Stable inside each group, so a set is not reshuffled by the
 * act of remembering — Shuffle is still the button for that.
 */
export function dealOrder(progress, cards = []) {
  const got = gotMap(progress);
  const seen = seenMap(progress);
  const missed = [], fresh = [], held = [];
  for (const c of cards) {
    if (got[c.id]) held.push(c);
    else if (seen[c.id]) missed.push(c);
    else fresh.push(c);
  }
  return [...missed, ...fresh, ...held];
}
