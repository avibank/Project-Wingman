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
