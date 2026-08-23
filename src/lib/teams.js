// §9.4.3 — teams are self-formed, 3–6, persistent, with their own chat.
// §9.4 — study partners are matched on complementary strengths, not similar
// ones: two people stuck on the same thing have no reason to talk.

export const TEAM_MIN = 3;
export const TEAM_MAX = 6;

export function teamCapacity(memberCount) {
  return {
    count: memberCount,
    full: memberCount >= TEAM_MAX,
    open: Math.max(0, TEAM_MAX - memberCount),
    // Below three it is not a team yet, and §8.4 forbids saying so as a zero.
    forming: memberCount < TEAM_MIN,
  };
}

// `mine` and `theirs` are { moduleCode: percent }. A pair is worth suggesting
// when each is meaningfully ahead of the other somewhere — that is a reason to
// talk in both directions.
export const AHEAD_BY = 15;

export function complementarity(mine = {}, theirs = {}) {
  const modules = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  let theyHelpMe = null, iHelpThem = null;
  for (const code of modules) {
    const a = mine[code] ?? 0, b = theirs[code] ?? 0;
    const gap = b - a;
    if (gap >= AHEAD_BY && (!theyHelpMe || gap > theyHelpMe.gap)) theyHelpMe = { code, gap };
    if (-gap >= AHEAD_BY && (!iHelpThem || -gap > iHelpThem.gap)) iHelpThem = { code, gap: -gap };
  }
  return { theyHelpMe, iHelpThem, mutual: Boolean(theyHelpMe && iHelpThem) };
}

export function rankPartners(candidates = [], mine = {}) {
  return candidates
    .map((c) => ({ ...c, ...complementarity(mine, c.progress || {}) }))
    // Only suggest someone there is a reason to talk to.
    .filter((c) => c.theyHelpMe || c.iHelpThem)
    .sort((a, b) => {
      // Mutual first: a trade beats a favour in either direction.
      if (a.mutual !== b.mutual) return b.mutual - a.mutual;
      const av = (a.theyHelpMe?.gap || 0) + (a.iHelpThem?.gap || 0);
      const bv = (b.theyHelpMe?.gap || 0) + (b.iHelpThem?.gap || 0);
      return bv - av;
    });
}

// The sentence shown under a suggestion. Never a score, never a ranking of
// people — just the reason the pair makes sense (§9.4.4).
export function partnerReason(match) {
  if (match.mutual) return `You're ahead on ${match.iHelpThem.code}, they're ahead on ${match.theyHelpMe.code}`;
  if (match.theyHelpMe) return `They're ahead of you on ${match.theyHelpMe.code}`;
  if (match.iHelpThem) return `You're ahead of them on ${match.iHelpThem.code}`;
  return null;
}
