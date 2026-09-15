/* =============================================================================
   THE READY ROOM'S RULES, AS THE REBUILD DRAWS THEM.
   -----------------------------------------------------------------------------
   Pure — no React, no DOM, no network — so `npm run check:rr` holds every rule
   in this file without a browser. roomModel.js keeps what was already true and
   is still read by App (the badge, presence, titles, time); this file is what
   the rebuilt screen adds on top of it, and it imports rather than repeats.
   ========================================================================= */
import { isMine, answerCount, titleOf, matches, dayLabel } from "./roomModel.js";

/* ------------------------------------------------------------ the feed ---- */

/* THE THREE FILTERS ARE LOCKED. Yours, Answered, All, and nothing else. */
export const RR_FILTERS = [
  { k: "yours", label: "Yours" },
  { k: "answered", label: "Answered" },
  { k: "all", label: "All" },
];

/* YOURS keeps the room's existing meaning: you asked it or you answered it,
   the same test the badge uses, so a thread cannot be yours in one place and
   not in another. ANSWERED is any answer at all. The asker's mark has its own
   word now, Signed off, so Answered no longer has to carry it. */
export function filterPass(k, t, { replies = [], me } = {}) {
  if (k === "yours") return isMine(t, replies, me);
  if (k === "answered") return answerCount(t, replies) > 0;
  return true;
}

/* Exactly three states, and a row you asked says Yours instead. A best answer
   that has since been deleted signs nothing off. */
export const STATUS_WORD = { open: "Waiting", ans: "Answered", signed: "Signed off", you: "Yours" };
export function statusOf(t, { replies = [], me, row = false } = {}) {
  if (row && t.authorId === me) return "you";
  if (t.bestReplyId && replies.some((r) => r.id === t.bestReplyId)) return "signed";
  return answerCount(t, replies) > 0 ? "ans" : "open";
}

/* Newest first, always. Ties go by id, so two questions asked in the same
   second cannot swap places between renders. */
export const newestFirst = (a, b) =>
  (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  || String(a.id).localeCompare(String(b.id));

/* Each chip counts what it would show BEFORE the search box is applied. */
export function chipCounts(threads = [], ctx = {}) {
  return Object.fromEntries(RR_FILTERS.map((f) => [f.k, threads.filter((t) => filterPass(f.k, t, ctx)).length]));
}

export function visibleThreads(threads = [], { filter = "all", q = "", replies = [], me, who = () => "" } = {}) {
  return threads
    .filter((t) => filterPass(filter, t, { replies, me }))
    .filter((t) => matches(q, titleOf(t), t.body, who(t.authorId)))
    .sort(newestFirst);
}

/* The selection survives a filter or a search when it can, and falls to the
   top of the list when it cannot. */
export function keepSelection(list = [], threadId = null) {
  if (threadId && list.some((t) => t.id === threadId)) return threadId;
  return list[0]?.id ?? null;
}

/* Up and down through the list, stopping at either end rather than wrapping. */
export function moveSelection(list = [], threadId = null, dir = 1) {
  if (!list.length) return null;
  const at = list.findIndex((t) => t.id === threadId);
  const next = at < 0 ? 0 : Math.max(0, Math.min(list.length - 1, at + dir));
  return list[next].id;
}

export const waitingOnAnswer = (threads = [], replies = []) =>
  threads.filter((t) => answerCount(t, replies) === 0).length;

/* The pane header's second line. A module nobody has asked in says what to do
   rather than printing a zero. */
export function moduleLine(total, waiting) {
  if (!total) return "Ask the first one";
  const q = `${total} question${total === 1 ? "" : "s"}`;
  return waiting ? `${q} · ${waiting} waiting on an answer` : `${q} · all answered`;
}

/* ------------------------------------------------------ the splitter ---- */
export const FW_MIN = 280;       // the feed is never narrower than this
export const DETAIL_MIN = 420;   // and the thread never narrower than this
export const SNAP_WIDE = 190;    // drag the feed under this and the thread takes the pane

/* Where a drag lands. Under the snap point it asks for the wide thread and
   leaves the remembered width alone, so letting go of wide restores it. */
export function dragTo(x, total) {
  if (x < SNAP_WIDE) return { wide: true };
  const w = Math.max(FW_MIN, Math.min(total - DETAIL_MIN, x));
  return { wide: false, fw: `${Math.round(w)}px` };
}

/* Per person, in this browser. Anything that does not read back as a width is
   treated as never set, so a hand-edited value cannot break the layout. */
export const layoutKey = (me) => `pw-rr-layout:${me || "anon"}`;
export function readLayout(raw) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    const fw = typeof v?.fw === "string" && /^\d{2,4}px$/.test(v.fw) ? v.fw : null;
    return { fw, wide: v?.wide === true };
  } catch {
    return { fw: null, wide: false };
  }
}

/* --------------------------------------------------------- the ticks ---- */

/* One row per person a message went to (message_receipts, 0027), with the
   moment it reached them and the moment they opened it, either of which may be
   empty. Split into who has read it and who has it but has not. */
export function receiptsFor(rows = []) {
  const seen = [];
  const deliv = [];
  for (const r of rows) {
    if (r.read_at) seen.push([r.user_id, r.read_at]);
    else if (r.delivered_at) deliv.push([r.user_id, r.delivered_at]);
  }
  const byTime = (a, b) => String(a[1]).localeCompare(String(b[1]));
  return { others: rows.length, seen: seen.sort(byTime), deliv: deliv.sort(byTime) };
}

/* TICKS TELL THE TRUTH. Blue means EVERYONE it went to has opened it — the
   WhatsApp rule — so one person opening it does not turn it blue. A message
   still on its way up has one grey tick whatever anybody has done. */
export function tickFor({ others = 0, seen = [], deliv = [] } = {}, { pending = false } = {}) {
  if (pending) return "sent";
  if (others > 0 && seen.length >= others) return "read";
  if (others > 0 && seen.length + deliv.length >= others) return "deliv";
  return "sent";
}

/* ------------------------------------------------------ the transcript -- */

/* Rows as the transcript draws them: a sticky day pill when the day changes,
   the unread line before the first message you have not read, and messages
   grouped by author. A day break or the unread line starts a new group, and so
   does a deleted message, so a tombstone never reads as its neighbour's. */
export function chatRows(messages = [], { lastReadAt = null, me } = {}) {
  const since = Date.parse(lastReadAt) || 0;
  const isUnread = (m) => m.authorId !== me && !m.deletedAt && (Date.parse(m.createdAt) || 0) > since;
  const unread = messages.filter(isUnread).length;
  const rows = [];
  let prev = null;
  let lastDay = null;
  let marked = false;
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) {
      rows.push({ type: "day", key: `d-${day}`, label: dayLabel(m.createdAt) });
      lastDay = day;
      prev = null;
    }
    if (!marked && unread && isUnread(m)) {
      rows.push({ type: "new", key: "new", count: unread });
      marked = true;
      prev = null;
    }
    const first = !prev || prev.authorId !== m.authorId || Boolean(prev.deletedAt) || Boolean(m.deletedAt);
    rows.push({ type: "msg", key: m.id, m, first });
    prev = m;
  }
  return rows;
}

/* ---------------------------------------------------------- the rail ---- */

/* THREE FACES, most recently flown with first. The person in the right seat
   now is the most recent of all; then the flight log, newest shared session
   first; then squadron mates, the ones in the room first. Only squadron mates
   ever appear, because only a squadron mate can take the seat. */
export function seatFaces({ seatPartner = null, flightLog = [], mates = [], online = new Set(), limit = 3 } = {}) {
  const ok = new Set(mates);
  const out = [];
  const push = (id) => { if (id && ok.has(id) && !out.includes(id)) out.push(id); };
  if (seatPartner) { ok.add(seatPartner); push(seatPartner); }
  [...flightLog]
    .sort((a, b) => String(b.lastAt || "").localeCompare(String(a.lastAt || "")))
    .forEach((f) => push(f.userId));
  [...mates]
    .sort((a, b) => (online.has(b) ? 1 : 0) - (online.has(a) ? 1 : 0))
    .forEach(push);
  return out.slice(0, limit).map((id) => ({ id, on: id === seatPartner ? "seat" : online.has(id) ? "1" : "0" }));
}

/* A day in words for a line under a name: today, yesterday, the weekday inside
   the week, then the date. */
export function dayName(iso, now = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(new Date(t))) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return new Date(t).toLocaleDateString("en-GB", { weekday: "long" });
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
