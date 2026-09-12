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

/* ===================== §5 · WHAT A THREAD IS CALLED =======================
   Two kinds of thread, one feed.

   Created IN the Ready Room: it is a question and it has a title, because a
   feed of untitled paragraphs cannot be scanned.

   Mirrored FROM a lesson comment: it has no title and must not be made to
   have one. Putting a title field on the lesson comment box would put a form
   in front of a casual remark, and casual commenting has to stay
   frictionless. So the comment's first line becomes the heading, and the
   FROM LESSON tag both explains why the heading is short and links back.
   ========================================================================= */

const firstLine = (body) => String(body || "").split(/\r?\n/).find((l) => l.trim()) || "";

/* The heading. Never empty: a thread with neither a title nor a body cannot
   be inserted (0008 CHECKs a non-blank body), so the fallback is a guard
   against corrupt data rather than a normal path. */
export function titleOf(thread) {
  const t = (thread?.title || "").trim();
  if (t) return t;
  const line = firstLine(thread?.body).trim();
  // A whole paragraph is not a heading. Cut on a sentence end if there is one
  // reasonably early, otherwise let the row's line clamp do the work.
  if (line.length <= 96) return line;
  const stop = line.slice(0, 96).lastIndexOf(". ");
  return stop > 24 ? line.slice(0, stop + 1) : `${line.slice(0, 93).trimEnd()}…`;
}

/* The two lines of excerpt under the heading. When the heading WAS the first
   line, the excerpt starts after it — otherwise the card says the same words
   twice. */
export function excerptOf(thread) {
  const body = String(thread?.body || "");
  if ((thread?.title || "").trim()) return body.trim();
  const line = firstLine(body);
  const rest = body.slice(body.indexOf(line) + line.length).trim();
  // EMPTY, not the title again. A one-line comment mirrored from a lesson has
  // nothing after its first line, and returning that line meant the card
  // printed the same sentence twice — heading and excerpt, identical. The
  // caller omits the excerpt when there is none.
  return rest;
}

/* §4b — ANSWERED is the asker's mark, not a reply count. A question with six
   answers and none of them right is not answered, and saying it is would be
   the feed lying about the one thing it exists to track. */
export const isAnswered = (thread) => Boolean(thread?.bestReplyId);

/* ANSWERS, not replies. A reply hanging off an answer is part of that answer's
   conversation and counting it inflates the number the feed is judged on —
   "3 answers" over two answers and one aside is the same small lie as calling
   a question answered because somebody replied to it. */
export const answerCount = (thread, replies = []) =>
  replies.filter((r) => r.threadId === thread?.id && !r.parentId).length;

/* §4b — the sticky chip row. Per module, and the filter lives only there. */
export const FEED_FILTERS = [
  { id: "yours", label: "Yours" },
  { id: "answered", label: "Answered" },
  { id: "all", label: "All" },
];

export function applyFeedFilter(threads = [], filter = "all", { me, replies = [] } = {}) {
  if (filter === "yours") {
    // Yours means you are IN it — you asked, or you answered. The same
    // definition the badge uses, so a thread cannot be "yours" in one place
    // and not in another.
    return threads.filter((t) => isMine(t, replies, me));
  }
  if (filter === "answered") return threads.filter(isAnswered);
  return threads;
}

/* §4b's header count, and the badge on a module row: how many questions in
   this module are still waiting for an answer somebody has accepted. */
export const waitingCount = (threads = []) => threads.filter((t) => !isAnswered(t)).length;

/* §4c — answers nest ONE level only. A reply can hang off an answer, but a
   reply to a reply goes flat under the same parent, because deep nesting
   breaks on a phone.

   0022 adds lesson_replies.parent_id, so this is now derived from the column
   rather than from guesswork. It used to return every reply as a top-level
   answer with `children: []` and say so honestly, because there was nothing to
   nest by; the view's nesting code was decoration on flat data.

   The one-level rule is enforced HERE as well as in the writer: a row whose
   parent is itself a reply is re-pointed at that reply's parent, so a bad
   insert cannot grow a third level on screen. */
export function nestAnswers(replies = [], threadId) {
  const mine = replies.filter((r) => r.threadId === threadId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const byId = new Map(mine.map((r) => [r.id, r]));
  const top = [];
  const kids = new Map();
  for (const r of mine) {
    let parent = r.parentId ? byId.get(r.parentId) : null;
    // A reply to a reply belongs to the answer both of them hang off.
    while (parent && parent.parentId && byId.get(parent.parentId)) parent = byId.get(parent.parentId);
    if (!parent || parent.id === r.id) { top.push(r); continue; }
    if (!kids.has(parent.id)) kids.set(parent.id, []);
    kids.get(parent.id).push(r);
  }
  return top.map((r) => ({ ...r, children: kids.get(r.id) || [] }));
}

/* ===================== §4b · HOW THE FEED IS ORDERED =====================
   Four orders, and only four, because a sort menu with nine entries is a
   preference nobody sets twice.

   Hot is the one that needs explaining. It is score over age, with answers
   counting several times a vote — a question with three answers is doing its
   job better than one with three upvotes and none. The 0.55 exponent is what
   keeps a good question from falling off the first screen in a day, which
   matters in a study app where the same chapter comes round every term.
   ========================================================================= */
export const FEED_SORTS = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "unanswered", label: "Unanswered" },
  { id: "yours", label: "Yours" },
];

export function hotScore(thread, { answers = 0, votes = 0, at = Date.now() } = {}) {
  const ageHours = Math.max(0, (at - (Date.parse(thread.createdAt) || at)) / 3600000);
  return (votes + answers * 3) / Math.pow(ageHours + 2, 0.55);
}

export function sortFeed(threads = [], mode = "hot", { me, replies = [], votes = {} } = {}) {
  const answersOf = (t) => replies.filter((r) => r.threadId === t.id).length;
  const scoreOf = (t) => (votes[t.id]?.score || 0) + (votes[t.id]?.mine || 0);
  if (mode === "new") {
    return [...threads].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  if (mode === "unanswered") {
    return threads.filter((t) => !isAnswered(t))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  if (mode === "yours") return threads.filter((t) => isMine(t, replies, me));
  const now = Date.now();
  return [...threads].sort((a, b) =>
    hotScore(b, { answers: answersOf(b), votes: scoreOf(b), at: now })
    - hotScore(a, { answers: answersOf(a), votes: scoreOf(a), at: now }));
}

/* ========================= §4a · TIME, IN A COLUMN =======================
   A short, absolute time for a list row: the clock today, the weekday this
   week, then the date. Relative time ("2 days ago") is right for a single item
   and wrong for a column of them, where the eye wants to compare.

   These lived inside the component. They are here because the rail, the
   transcript, the feed and the right seat all print times and all have to
   print them the same way.
   ========================================================================= */
export function when(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const days = Math.round((now - d) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/* §4a — consecutive messages from one sender collapse: the avatar and the name
   appear only on the first of a run, a run breaks on a new day, and a day
   break carries its own divider row. A deleted message breaks a run too — a
   tombstone inside somebody's run reads as though they said it. */
export function runs(messages = []) {
  const out = [];
  let lastBy = null, lastDay = null;
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      out.push({ divider: dayLabel(m.createdAt), id: `d-${day}` });
      lastBy = null; lastDay = day;
    }
    out.push({ ...m, first: m.authorId !== lastBy || Boolean(m.deletedAt) });
    lastBy = m.deletedAt ? null : m.authorId;
  }
  return out;
}

/* §8 — unread, from the server's last_read_at rather than a localStorage map.
   Your own message is never unread to you, and a muted squadron still counts
   its unread — muting silences the notification, not the number. */
export function chatUnread(messages = [], squadronId, lastReadAt, me) {
  const since = Date.parse(lastReadAt) || 0;
  return messages.filter((m) => m.squadronId === squadronId && m.authorId !== me
    && !m.deletedAt && (Date.parse(m.createdAt) || 0) > since).length;
}

/* The first message the reader has not seen, so the transcript can mark it.
   Returns null when everything has been read, which is the ordinary state. */
export function firstUnread(messages = [], lastReadAt, me) {
  const since = Date.parse(lastReadAt) || 0;
  return messages.find((m) => m.authorId !== me && (Date.parse(m.createdAt) || 0) > since) || null;
}
