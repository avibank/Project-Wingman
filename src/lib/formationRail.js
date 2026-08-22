// §7.9 — how a participant's position is described, kept pure and free of any
// client import so the wording can be checked directly.
//
// Never a leaderboard, never a timer, never a score. The rail says where
// someone is relative to you and nothing more, and it never says anyone is
// losing — "behind" is stated as your being ahead, not as their falling short.

export const MIN_FORMATION = 2;
export const MAX_FORMATION = 6;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describePosition(theirs, mine) {
  const d = (theirs ?? 0) - (mine ?? 0);
  if (d === 0) return "on the same question";
  if (d > 0) return `${plural(d, "question")} ahead`;
  return `${plural(-d, "question")} back`;
}

// Room for one more, and never room for a seventh.
export function formationCapacity(memberCount) {
  return {
    count: memberCount,
    full: memberCount >= MAX_FORMATION,
    open: Math.max(0, MAX_FORMATION - memberCount),
    // Below two it is not a formation yet; it is one person waiting.
    live: memberCount >= MIN_FORMATION,
  };
}
