// The question lifecycle, and it is the whole system. Keep it exact.
//
//   1 · answered wrong        -> caution, and it stays there until put right.
//   2 · right on first sight  -> holding.
//   3 · put right from caution -> leaves caution, joins holding.
//   4 · missed again          -> leaves holding, back to caution.
//
// Holding had a second job: it was the pile Calibration drew its re-check set
// from. That exercise is gone and holding is now only the other side of the
// ledger — a question is in exactly one pile, and caution is the one with a
// screen.
//
// A question is never in both. The tag's count and the lamp's count must always
// agree with that, so both are derived from one record rather than tracked
// separately — two counters that are supposed to match are two counters that
// will eventually disagree.

export const RETENTION_KEY = "pw-retention";

// A five-box, doubling-interval scheme. Purely random selection wastes most of
// the benefit of re-checking at all: what earns its keep is asking again just
// as it is about to fade, and asking the ones already missed sooner.
export const BOXES = [1, 2, 4, 8, 16];          // days
export const boxDays = (box) => BOXES[Math.min(BOXES.length - 1, Math.max(0, box))];

export const emptyRetention = () => ({ holding: {}, caution: {} });

const nowIso = () => new Date().toISOString();
const daysBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;

/* Rule 2 and rule 3 — a question enters holding, either from first sight or
   from being put right. A question put right after being missed starts at box 0
   rather than where it left off: it has already proved it can fade. */
export function toHolding(state, questionId, { fromCaution = false } = {}) {
  const caution = { ...state.caution };
  const prior = caution[questionId];
  const held = state.holding?.[questionId];
  delete caution[questionId];

  // THE BOX HAS TO CLIMB, and for a long time it did not. This assigned 0 or 1
  // and nothing else in the codebase ever wrote `box`, so BOXES = [1,2,4,8,16]
  // described a ladder whose top three rungs could not be reached: every
  // correct answer put the question back at box 1 and it came round again in
  // two days, for ever. A question you have known cold for a month was still
  // being asked every second day, and the re-check pile never shrank by
  // knowing anything — which is the entire purpose of the mechanism.
  //
  // Proven before fixing: six consecutive correct re-checks, interval 2 days
  // every time. check:retention asserted BOXES was [1,2,4,8,16] — the table,
  // not the behaviour — so it passed throughout.
  const box = fromCaution || prior
    ? 0                                             // put right after a miss:
                                                    // it has proved it can fade
    : held
      ? Math.min(BOXES.length - 1, (held.box ?? 0) + 1)   // recalled: space it out
      : 1;                                          // first sight, correct

  return {
    caution,
    holding: {
      ...state.holding,
      [questionId]: {
        box,
        lastSeen: nowIso(),
        // The miss count survives the question moving between piles. Nothing
        // reads it now that the re-check set is gone; it is kept because it is
        // a fact about the question, and throwing it away is not reversible.
        missed: (prior?.missed ?? held?.missed ?? 0) + (fromCaution ? 1 : 0),
      },
    },
  };
}

/* Rules 1 and 4 — wrong on first sight, or missed during a re-check. Either way
   it leaves holding and sits in caution until it is put right. */
export function toCaution(state, questionId) {
  const holding = { ...state.holding };
  const prior = holding[questionId];
  delete holding[questionId];
  return {
    holding,
    caution: {
      ...state.caution,
      [questionId]: { since: nowIso(), missed: (prior?.missed ?? 0) + 1 },
    },
  };
}

export const cautionCount = (state) => Object.keys(state?.caution || {}).length;
export const holdingCount = (state) => Object.keys(state?.holding || {}).length;

/* Due means the box interval has elapsed. Nothing in caution is ever due — a
   question you have not put right yet is not a question to re-check. */
export function dueIds(state, at = nowIso()) {
  return Object.entries(state?.holding || {})
    .filter(([, v]) => daysBetween(v.lastSeen, at) >= boxDays(v.box))
    .map(([id]) => id);
}
export const dueCount = (state, at) => dueIds(state, at).length;

/* THE RE-CHECK SET IS GONE, with Calibration. It drew from `holding` and
   interleaved across chapters — five questions from one chapter is a re-read,
   five from five is a recall test — and the only door to it was the Library's
   Calibration row, which the approved module screen removed. The piles
   themselves stay: `caution` is what Put right works from, and `holding` is
   still where a right answer goes, so nothing about how an answer is recorded
   changed. What went is the set builder and its two size constants. */

/* Option order is shuffled on every sitting so position cannot be memorised —
   seeded per sitting so a re-render does not reshuffle under the student's
   fingers mid-question. */
export function shuffleOptions(question, seed) {
  const idx = question.options.map((_, i) => i);
  let s = seed;
  for (let i = idx.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    options: idx.map((i) => question.options[i]),
    correct: idx.indexOf(question.correct),
  };
}

/* What the result screen says. Never a bare score: the system explains itself
   by naming what moved. */
export function movedLine({ toCaution: c = 0, toHolding: h = 0 }) {
  const parts = [];
  if (h) parts.push(`${h} joined the tag`);
  if (c) parts.push(`${c} went to caution`);
  return parts.length ? parts.join(" · ") : "Nothing moved.";
}
