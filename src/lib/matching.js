// §8.2 — suggested wingmen are ranked by position in the material, never by
// profile similarity, demographics, or a follow graph. The whole ordering is
// this list, in this order:
//
//   1. Same chapter, active now
//   2. Same chapter, active in the last 24h
//   3. One chapter ahead (they can help)
//   4. Same study-time answer from onboarding
//   5. Same module
//
// Pure on purpose: everything it needs is an argument, so the ranking can be
// checked without a database.

export const ACTIVE_NOW_MS = 5 * 60 * 1000;
export const RECENT_MS = 24 * 60 * 60 * 1000;

const REASON = {
  1: "on the same chapter, right now",
  2: "on the same chapter today",
  3: "one chapter ahead",
  4: "studies at the same time you do",
  5: "flying the same module",
};

export function rankWingmen(candidates, me, chapterOrder, now = Date.now()) {
  const index = new Map(chapterOrder.map((id, i) => [id, i]));
  const mine = index.has(me.chapterId) ? index.get(me.chapterId) : null;

  const scored = [];
  for (const c of candidates) {
    if (!c.user_id || c.user_id === me.userId) continue;
    const seen = c.last_seen ? now - new Date(c.last_seen).getTime() : Infinity;
    const theirs = index.has(c.chapter_id) ? index.get(c.chapter_id) : null;

    let rung = null;
    if (mine !== null && theirs === mine && seen <= ACTIVE_NOW_MS) rung = 1;
    else if (mine !== null && theirs === mine && seen <= RECENT_MS) rung = 2;
    else if (mine !== null && theirs === mine + 1) rung = 3;
    else if (me.studyTime && c.study_time === me.studyTime) rung = 4;
    else if (theirs !== null) rung = 5;

    if (rung) scored.push({ ...c, rung, reason: REASON[rung], seen });
  }

  // Within a rung, the more recently seen pilot comes first — closer in time
  // is closer in practice.
  return scored.sort((a, b) => a.rung - b.rung || a.seen - b.seen);
}
