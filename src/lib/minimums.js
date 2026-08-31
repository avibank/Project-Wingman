import { PASS_MARK } from "./quiz.js";

/* ============================================================================
   §8 — EVERYTHING DERIVES FROM TWO NUMBERS.

   The quiz scores and the user's minimums. From those: the lamp on the
   chapter, the lamp on the launcher, the needle position, the band, the row
   actions. No separate flags, no duplicated state. This file is where they
   are wired, once, so no screen can hold a second opinion about whether a
   chapter is in trouble.

   THE TWO NUMBERS ARE NOT THE SAME NUMBER.

     PASS_PCT   the real pass mark. 75%. Fixed, external, not the user's to
                move. It is what the syllabus requires.
     minimums   the bar the user holds themselves to. Theirs to set, 40–95.

   Master Caution lights below MINIMUMS, not below the pass mark. Someone
   holding themselves to 85 wants to be told at 84 even though 84 passes.
   Someone who has set 60 is told at 59 — and the dial still draws the real
   pass mark at its true offset, so lowering your own bar moves the
   requirement visibly off-centre and can never hide it.

   PASS_PCT is derived from quiz.js rather than written again: the pass mark
   already had exactly one owner and it stays that way.
   ========================================================================= */

export const MINIMUMS_KEY = "pw-minimums";
export const PASS_PCT = Math.round(PASS_MARK * 100);

/* The range the slider offers. The floor is not 0: a bar you cannot fall
   below is not a bar, and a lamp that can never light is a dead instrument.
   The ceiling is not 100 for the same reason from the other end. */
export const MIN_FLOOR = 40;
export const MIN_CEIL = 95;
export const DEFAULT_MINIMUMS = PASS_PCT;

export const clampMinimums = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_MINIMUMS;
  return Math.max(MIN_FLOOR, Math.min(MIN_CEIL, n));
};

/* Read it the same way everywhere. A screen that reads the raw key and
   forgets the default gets 0, and 0 means every lamp lights at once. */
export const readMinimums = (progress) =>
  clampMinimums(progress?.get?.(MINIMUMS_KEY, DEFAULT_MINIMUMS) ?? DEFAULT_MINIMUMS);

/* ------------------------------------------------------------------ scores */

/* A stored score is { correct, total }. Percent, or null when nothing is
   stored — null is "not taken", which is a different thing from zero and must
   never be flattened into it. */
export const pctOf = (s) =>
  (s && Number.isFinite(s.correct) && s.total > 0
    ? Math.round((s.correct / s.total) * 100)
    : null);

/* Every quiz actually taken, in the module's own chapter order, so "the last
   quiz" means the last one in the route rather than whichever key the object
   happened to enumerate first. */
export function takenScores(chapters = [], quiz = {}) {
  const out = [];
  for (const c of chapters) {
    const pct = pctOf(quiz[c.id]);
    if (pct !== null) out.push({ id: c.id, pct, raw: quiz[c.id] });
  }
  return out;
}

export function averagePct(taken = []) {
  if (!taken.length) return null;
  return Math.round(taken.reduce((a, t) => a + t.pct, 0) / taken.length);
}

export const lastPct = (taken = []) => (taken.length ? taken[taken.length - 1].pct : null);

/* ------------------------------------------------------------- the signal */

export const isBelow = (pct, mins) => pct !== null && pct !== undefined && pct < mins;

/* Which chapters own a problem. A Set, because the caller asks "is this one
   lit" per row and a list would make that O(n) inside a render loop.

   §2 — the lamp appears on the SMALLEST THING THAT OWNS THE PROBLEM, once. A
   chapter is lit by its own quiz and by nothing else; a module is lit because
   one of its chapters is. Nothing sums, nothing propagates upward twice. */
export function faultChapters(chapters = [], quiz = {}, mins = DEFAULT_MINIMUMS) {
  const out = new Set();
  for (const c of chapters) {
    const pct = pctOf(quiz[c.id]);
    if (isBelow(pct, mins)) out.add(c.id);
  }
  return out;
}

/* §2 — the Flight Deck launcher. True when any chapter in the module is
   below the bar, so the deck answers "which module needs you" from the same
   fact the chapter header uses. */
export const moduleNeedsYou = (chapters, quiz, mins) =>
  faultChapters(chapters, quiz, mins).size > 0;

/* ------------------------------------------------------------- the dial */

/* §3 — the dial reads DEVIATION FROM THE USER'S MINIMUMS, pegging at ±25.
   Centre is their bar. Left is under, right is over. */
export const SPAN = 25;

export const deviation = (pct, mins) =>
  (pct === null || pct === undefined ? null : pct - mins);

/* Clamped to the scale, for placing a needle. Kept apart from `deviation` so
   a caller can still say the true figure in words while the needle pegs. */
export const onScale = (dev) => Math.max(-SPAN, Math.min(SPAN, dev));
export const isPegged = (dev) => Math.abs(dev) > SPAN;

/* The real pass mark's offset from the user's bar — what keeps the syllabus
   visible when the user lowers their own. Set minimums to 60 and this is
   +15, so the pass tick sits a quarter of the way right of centre. */
export const passOffset = (mins) => PASS_PCT - mins;

/* One sentence for the reading, used by the dial's accessible name and by the
   results verdict, so the two can never describe the same needle differently. */
export function readingWords(pct, mins) {
  if (pct === null || pct === undefined) return "No quizzes taken yet";
  const d = pct - mins;
  if (d === 0) return "Exactly on your bar";
  return `${Math.abs(d)} ${d < 0 ? "under" : "over"} your bar`;
}
