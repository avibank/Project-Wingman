// §7.7 — a Call must never go dark.
//
// The scheduler that fires these stages does not exist yet, but who gets
// nudged at each stage is a rule, not a schedule, and it is the part that can
// be wrong quietly. Kept pure and free of any client import so it can be
// checked directly.
//
//   stage 1  @  2h — up to 3 squadron members who completed this chapter
//   stage 2  @ 12h — widen to any user who completed the chapter
//   stage 3  @ 24h — stop nudging; tell the caller and offer Comms
//
// Ordering is most-recently-active first at every stage.

export const STAGE_AT_MS = [2 * 3600e3, 12 * 3600e3, 24 * 3600e3];
export const MAX_PER_CALL = 3;
export const MAX_NUDGES_PER_DAY = 2;

export function stageFor(call, now = Date.now()) {
  const age = now - new Date(call.created_at).getTime();
  if (age < STAGE_AT_MS[0]) return 0;
  if (age < STAGE_AT_MS[1]) return 1;
  if (age < STAGE_AT_MS[2]) return 2;
  return 3;
}

// `candidates` are users who have completed this chapter, each with
// { user_id, last_active, in_squadron }. The exclusion sets are ids.
export function selectNudgeTargets({
  call,
  candidates = [],
  alreadyNudged = [],          // ids nudged for THIS call
  nudgesToday = {},            // id -> count across all calls today
  mutedByCaller = [],          // caller muted them
  mutedCaller = [],            // they muted the caller
  now = Date.now(),
}) {
  const stage = stageFor(call, now);
  if (stage === 0 || stage === 3) return { stage, targets: [] };

  const nudged = new Set(alreadyNudged);
  const blocked = new Set([...mutedByCaller, ...mutedCaller, call.user_id]);

  const eligible = candidates.filter((c) => {
    if (blocked.has(c.user_id)) return false;
    // At most once per call, and at most twice a day across all calls.
    if (nudged.has(c.user_id)) return false;
    if ((nudgesToday[c.user_id] || 0) >= MAX_NUDGES_PER_DAY) return false;
    // Stage 1 is squadron-only; stage 2 widens to everyone who finished it.
    if (stage === 1 && !c.in_squadron) return false;
    return true;
  });

  eligible.sort((a, b) => new Date(b.last_active || 0) - new Date(a.last_active || 0));
  return { stage, targets: eligible.slice(0, MAX_PER_CALL) };
}
