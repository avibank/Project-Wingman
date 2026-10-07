/* =============================================================================
   THE STUDY-CARD SESSION'S RULES — everything about it that is not a screen.
   -----------------------------------------------------------------------------
   A plain module for the reason `quiz.js` and `studioModel.js` are: these are
   the rules a session runs on, and a rule that lives in a component is a rule
   somebody tidying the markup can change. It is importable, so `check:cards`
   drives the sets, the queue, the two piles and the fan for real rather than
   grepping the JSX for them.

   THE DEMO KEEPS INDEXES; THIS KEEPS IDS. `docs/launch/reference/06-…html`
   holds its decks as arrays and its piles as Sets of array positions, which is
   fine for four example cards and wrong here: a card id is this app's identity
   for a question everywhere else (CLAUDE.md, Bookmarks — "a saved question
   points at the question, never at question 4 of quiz 1"), and a set that
   gains a card at the front must not renumber what somebody has already done.
   Every queue, pile and deck below is a list of ids.

   AND THE THREE SETS COME FROM STORES THAT ALREADY EXIST, so §7's write-backs
   needed no new key and no migration:
     · `all`    — the chapter's card set, in order.
     · `missed` — turned over and not yet had right. That is exactly
                  `pw-cards-seen` minus `pw-cards-got`, which is the `missed`
                  group `dealOrder` in cardsSeen.js has always built.
     · `saved`  — the `saves` table, kind "card" (migration 0028).
   ========================================================================= */

export const SET_IDS = ["all", "missed", "saved"];
export const SET_LABEL = { all: "All", missed: "Missed", saved: "Saved" };

/** The flick that counts as a sort, and the travel a verdict fades in over. */
export const FLICK_PX = 110;
export const VERDICT_PX = 120;
/** The seven most recent cards a deck fans, and how far they spread. */
export const FAN_SHOWN = 7;

/** Turned over, and not yet had right. */
export const missedIds = (cards, seen = {}, got = {}) =>
  cards.filter((c) => seen[c.id] && !got[c.id]).map((c) => c.id);

/** The ids in each of the three sets. */
export function setsOf(cards = [], { seen = {}, got = {}, saved = new Set() } = {}) {
  return {
    all: cards.map((c) => c.id),
    missed: missedIds(cards, seen, got),
    saved: cards.filter((c) => saved.has(c.id)).map((c) => c.id),
  };
}

/**
 * Begin a session, or switch set inside one.
 *
 * SWITCHING KEEPS WHAT HAS ALREADY BEEN SORTED (§5: "Switching keeps the Got
 * it / Not yet decks"). Only the cards left to study change, so a student who
 * drops into Missed half way through does not lose the pile they have built —
 * which is also what makes the two fans worth watching.
 */
export function startMode(prev, mode, sets) {
  const queue = sets[mode] || [];
  const fresh = !prev || !prev.yesDeck;
  return {
    mode,
    queue,
    pos: 0,
    ...(fresh
      ? { got: 0, again: 0, yesDeck: [], noDeck: [] }
      : { got: prev.got, again: prev.again, yesDeck: prev.yesDeck, noDeck: prev.noDeck }),
  };
}

export const isDone = (s) => !s || s.pos >= s.queue.length;
export const currentId = (s) => (isDone(s) ? null : s.queue[s.pos]);
/** "3 / 12", the line under the question. */
export const place = (s) => (isDone(s) ? null : { at: s.pos + 1, of: s.queue.length });

/**
 * Sort the current card.
 *
 * **NOT YET DOES NOT LOOP BACK INTO THE SESSION** (§5), and that is true by
 * construction rather than by a guard: a card is pushed onto a pile and `pos`
 * moves on, so nothing can put it in front of the queue again. It goes back on
 * the `missed` pile instead, which is what the NEXT session's Missed set is
 * built from — the same bargain the caution pile makes after a quiz.
 */
export function answer(s, yes) {
  const id = currentId(s);
  if (id == null) return { id: null, next: s };
  return {
    id,
    next: {
      ...s,
      pos: s.pos + 1,
      got: s.got + (yes ? 1 : 0),
      again: s.again + (yes ? 0 : 1),
      yesDeck: yes ? [...s.yesDeck, id] : s.yesDeck,
      noDeck: yes ? s.noDeck : [...s.noDeck, id],
    },
  };
}

/**
 * A deck's fan: the seven most recent, widening as it grows, the newest last
 * so it is the one that drops in. The arithmetic is the demo's `fan()`.
 */
export function fanOf(list = []) {
  const shown = list.slice(-FAN_SHOWN);
  const m = shown.length;
  const spread = Math.min(14 * (m - 1), 80);
  const step = m > 1 ? spread / (m - 1) : 0;
  return shown.map((id, k) => ({
    id,
    rot: Number((-spread / 2 + k * step).toFixed(1)),
    newest: k === m - 1,
  }));
}

/** The little fan drawn on a set button — at most four leaves, from the demo. */
export function miniFan(n) {
  const m = Math.max(1, Math.min(n, 4));
  return Array.from({ length: m }, (_, k) => Number((m > 1 ? -12 + (k * 24) / (m - 1) : 0).toFixed(1)));
}

/**
 * The three set buttons, the one being studied FIRST. The picker is a stack
 * until it is opened, so the current set is what shows on top of it; the other
 * two slide out to either side (`--o` in the sheet decides which way).
 */
export function pickOrder(mode, counts = {}) {
  const all = SET_IDS.map((id) => ({ id, label: SET_LABEL[id], n: counts[id] || 0 }));
  const cur = all.find((x) => x.id === mode) || all[0];
  return [cur, ...all.filter((x) => x !== cur)];
}

/** Which way a non-current set slides: left for the first, right for the second. */
export const slideOf = (k) => (k === 0 ? 1 : k === 1 ? 0 : 2);
