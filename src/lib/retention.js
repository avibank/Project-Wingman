// The question lifecycle, and it is the whole system. Keep it exact.
//
//   1 · answered wrong        -> caution, and it stays there until put right.
//                                It is NOT eligible for re-checking while it
//                                sits there.
//   2 · right on first sight  -> holding, behind the calibration tag.
//   3 · put right from caution -> leaves caution, joins holding.
//   4 · missed during a re-check -> leaves holding, back to caution.
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
        // The miss count survives the question moving between piles: it is
        // what recheckSet weights by, so losing it would flatten the ordering.
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

/* The re-check set. Drawn from holding and MIXED ACROSS CHAPTERS, because the
   interleaving is the point — five questions from one chapter is a re-read, five
   from five chapters is a recall test.

   Weighted by how overdue it is and by whether it has been missed before, so
   the ones closest to fading come first. Five to ten; longer sets get skipped,
   and a set that gets skipped teaches nothing. */
export const RECHECK_MIN = 5, RECHECK_MAX = 10;
export function recheckSet(state, questions, { at = nowIso(), size = RECHECK_MAX } = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const scored = Object.entries(state?.holding || {})
    .filter(([id]) => byId.has(id))
    .map(([id, v]) => ({
      id,
      q: byId.get(id),
      overdue: daysBetween(v.lastSeen, at) - boxDays(v.box),
      missed: v.missed || 0,
    }))
    .filter((r) => r.overdue >= 0)
    .sort((a, b) => (b.overdue + b.missed * 2) - (a.overdue + a.missed * 2));

  // Interleave: take round-robin across chapters rather than the top N, which
  // would otherwise come from whichever chapter was studied longest ago.
  const byChapter = new Map();
  for (const r of scored) {
    const k = r.q.chapterId || r.q.lessonId || "—";
    if (!byChapter.has(k)) byChapter.set(k, []);
    byChapter.get(k).push(r);
  }
  const lanes = [...byChapter.values()];
  const out = [];
  for (let i = 0; out.length < Math.min(size, scored.length); i++) {
    let moved = false;
    for (const lane of lanes) {
      if (i < lane.length && out.length < Math.min(size, scored.length)) { out.push(lane[i]); moved = true; }
    }
    if (!moved) break;
  }
  return out.map((r) => r.q);
}

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
