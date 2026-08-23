// §9.4.3 — Formation is ephemeral and scheduled, not a permanent room
// advertising emptiness.
//
//   2–4 pilots · one chapter · one session
//   either "now" or scheduled ("tonight 20:00")
//   the room dies when the formation ends
//   never render a formation nobody is in
//
// The pure rules live here so "never render an empty one" is a property of the
// data rather than a `.filter()` somebody remembers to write at each call site.

export const FORMATION_MIN = 2;
export const FORMATION_MAX = 4;
export const STALE_AFTER_HOURS = 4;

export function formationState(f, now = Date.now()) {
  const members = (f.members || []).filter((m) => !m.left_at);
  const startsAt = f.starts_at ? new Date(f.starts_at).getTime() : null;
  const scheduled = Number.isFinite(startsAt) && startsAt > now;
  const started = Number.isFinite(startsAt) ? startsAt <= now : true;
  const age = Number.isFinite(startsAt) ? (now - startsAt) / 3600e3 : 0;

  return {
    ...f,
    members,
    count: members.length,
    full: members.length >= FORMATION_MAX,
    scheduled,
    started,
    // A formation nobody is in is over, whether or not anything closed it — and
    // one that started hours ago and was never joined is over too.
    dead: members.length === 0 || (started && age > STALE_AFTER_HOURS && members.length < FORMATION_MIN),
    // Below two it is one person waiting, which §8.4 forbids reporting as a zero.
    live: members.length >= FORMATION_MIN,
  };
}

// The only list a surface should ever render.
export function visibleFormations(list = [], now = Date.now()) {
  return list.map((f) => formationState(f, now)).filter((f) => !f.dead && !f.ended_at);
}

export function formationLabel(f) {
  if (f.scheduled) {
    const t = new Date(f.starts_at);
    return `${t.toLocaleDateString(undefined, { weekday: "long" })} ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return f.live ? `${f.count} flying` : "Waiting for one more";
}
