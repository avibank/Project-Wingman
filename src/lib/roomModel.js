// The Ready Room's data layer. Pure — no React, no DOM, no network.
//
// Named roomModel, not readyRoom: lib/readyRoom.js already exists and holds
// the question/squawk helpers ChapterComments uses. This is the room's thread,
// badge and right-seat logic, which is a different thing.
//
// §2 — THE TWO DOORS, AND THE DIRECTION THEY SWING.
//
// There is one thread entity with an OPTIONAL lesson anchor. A thread with an
// anchor (lessonId + t) is a lesson comment AND a room thread: one record
// surfaced twice, so replying in either place appears in both because there is
// only ever one place it lives. A thread without an anchor was started in the
// room and stays there — it has no lesson and no timestamp, so it has nowhere
// to appear.
//
// lesson -> room is automatic. room -> lesson NEVER HAPPENS. Nothing in this
// file may ever give a thread an anchor it was not created with.

export const isAnchored = (t) => t.lessonId != null && t.t != null;

/* §4 — the origin line every row carries. Three threads about the same lesson
   are indistinguishable without it. */
export function originOf(thread, { chapterOf, lessonName, mmss } = {}) {
  if (!isAnchored(thread)) return "Ready Room only";
  const ch = chapterOf?.(thread.lessonId);
  const ls = lessonName?.(thread.lessonId);
  return ["From", ch, ls, mmss?.(thread.t)].filter(Boolean).join(" · ")
    .replace("From · ", "From ");
}

/* §9 — order within a module: unread first, then most recent. */
export function orderThreads(threads, { unread = () => false, lastAt = () => 0 } = {}) {
  return [...threads].sort((a, b) => {
    const ua = unread(a) ? 1 : 0, ub = unread(b) ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return (lastAt(b) || Date.parse(b.createdAt) || 0)
         - (lastAt(a) || Date.parse(a.createdAt) || 0);
  });
}

/* §9 — the filter row. Unanswered questions are the highest-value thing in a
   study app and the hardest to find once volume arrives, which is why this is
   built in from the start rather than added when the list gets long. */
export const FILTERS = [
  { id: "all", label: "All" },
  { id: "unanswered", label: "Unanswered" },
  { id: "mine", label: "Mine" },
];

export function applyFilter(threads, filter, { replyCount = () => 0, me = "u_you" } = {}) {
  if (filter === "unanswered") return threads.filter((t) => replyCount(t.id) === 0);
  if (filter === "mine") return threads.filter((t) => t.authorId === me);
  return threads;
}

/* Grouped by module, which is how the sidebar is organised. Modules are
   HEADINGS, not destinations (§4) — this returns the rows, never a page. */
export function byModule(threads) {
  const out = new Map();
  for (const t of threads) {
    if (!out.has(t.moduleId)) out.set(t.moduleId, []);
    out.get(t.moduleId).push(t);
  }
  return out;
}

/* §9 — modules you are not currently studying start collapsed. */
export const openByDefault = (moduleId, activeModuleCode) => moduleId === activeModuleCode;

/* §8 — THE BADGE, and the rule it must not break.
   Things addressed to you: unread squadron messages, and replies in threads you
   are part of. You are "part of" a thread if you started it or answered it.
   A new thread by someone else in a module you are enrolled in is NOT this. */
export function isMine(thread, replies, me = "u_you") {
  if (thread.authorId === me) return true;
  return replies.some((r) => r.threadId === thread.id && r.authorId === me);
}

export function badgeCount({ threads = [], replies = [], seen = {}, chatUnread = {}, me = "u_you" } = {}) {
  let n = 0;
  for (const t of threads) {
    if (!isMine(t, replies, me)) continue;
    const mine = replies.filter((r) => r.threadId === t.id);
    const newest = mine.reduce((x, r) => Math.max(x, Date.parse(r.createdAt) || 0), 0);
    // Your own answer is not news to you.
    const newestNotMine = mine.filter((r) => r.authorId !== me)
      .reduce((x, r) => Math.max(x, Date.parse(r.createdAt) || 0), 0);
    if (newestNotMine > (seen[t.id] || 0)) n += 1;
    void newest;
  }
  for (const k of Object.keys(chatUnread)) n += chatUnread[k] || 0;
  return n;
}

/* The second, quieter level (§8): a row you are not part of that has moved
   since you last looked. Shown as a dot in the sidebar, never in the badge. */
export function rowUnread(thread, replies, seen = {}, me = "u_you") {
  const last = replies
    .filter((r) => r.threadId === thread.id && r.authorId !== me)
    .reduce((x, r) => Math.max(x, Date.parse(r.createdAt) || 0), 0);
  const created = Date.parse(thread.createdAt) || 0;
  return Math.max(last, created) > (seen[thread.id] || 0);
}

/* §4 — search covers threads and squadrons, and nothing else: the field sits
   above both lists and must not silently miss one of them. */
export const matches = (q, ...fields) => {
  const terms = String(q || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
};

/* §7 — the right seat's safety boundary, stated once so the UI and any future
   server rule read the same sentence: only people you share a squadron with
   may ever appear. The UI enforcing it is not enough; this is the shape the
   server rule has to take too. */
export function rightSeatCandidates({ me, members = [], presence = [], blocked = [] } = {}) {
  const mySquadrons = new Set(members.filter((m) => m.user_id === me).map((m) => m.squadron_id));
  const share = new Set(
    members.filter((m) => mySquadrons.has(m.squadron_id) && m.user_id !== me).map((m) => m.user_id));
  const block = new Set(blocked);
  return presence
    .filter((p) => share.has(p.user_id) && !block.has(p.user_id))
    .map((p) => ({ ...p, squadronId: members.find((m) => m.user_id === p.user_id
      && mySquadrons.has(m.squadron_id))?.squadron_id }));
}

/* §4 — the presence strip shows THREE, and they are the three most recently
   seen. Not the first three the server happened to return, which is what a
   bare slice gives you: an arbitrary set that also happens to look stable, so
   nobody notices it is arbitrary.

   Three because the strip is a glance, not a directory. Past three it stops
   answering "is anyone about" and starts being a list you have to read, and a
   list you have to read belongs behind the overflow control rather than in
   front of it — which is what `rest` is for. Everyone stays reachable; only
   the first three are spent on being seen without asking.

   Ties are broken by user_id so the order cannot flicker between renders when
   two people share a timestamp. */
export const PRESENCE_SHOWN = 3;

/* Presence arrives in TWO shapes and the room only ever understood one.

   The `presence` table gives user_id / last_seen. The content fixture gives
   userId / at. The room read user_id throughout, so on the fixture path every
   row resolved to undefined: `who(undefined)` fell through to the raw value
   and `initials()` produced "?" — the strip has been a row of question marks
   the whole time, which reads as a rendering quirk rather than as data the
   component cannot see.

   Normalised here, once, so there is a single shape past this point rather
   than every consumer remembering both. */
export function normalisePresence(rows = []) {
  return (rows || [])
    .map((p) => ({
      ...p,
      user_id: p.user_id ?? p.userId ?? null,
      last_seen: p.last_seen ?? p.lastSeen ?? p.at ?? null,
    }))
    .filter((p) => p.user_id);
}

export function presenceRail(presence = [], limit = PRESENCE_SHOWN) {
  const when = (p) => Date.parse(p.last_seen || 0) || 0;
  // ONE ROW PER PERSON. Presence is per person PER LESSON, so somebody who has
  // opened three lessons is three rows — they appeared in the roster three
  // times and could take all three face slots on their own, which turns "who
  // is about" into "who has the most tabs open". Their most recent row wins,
  // since that is where they actually are.
  const newest = new Map();
  for (const p of normalisePresence(presence)) {
    const held = newest.get(p.user_id);
    if (!held || when(p) > when(held)) newest.set(p.user_id, p);
  }
  const ordered = [...newest.values()].sort((a, b) => {
    const d = when(b) - when(a);
    return d !== 0 ? d : String(a.user_id).localeCompare(String(b.user_id));
  });
  return { shown: ordered.slice(0, limit), rest: ordered.slice(limit), all: ordered };
}
