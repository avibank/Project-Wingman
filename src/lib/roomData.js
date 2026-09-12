import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { fetchAllPresence } from "./presence.js";
import { rightSeatCandidates } from "./roomModel.js";

/* ============================================================================
   The Ready Room's shared data — squadrons, their chat, and the right seat.

   WHAT THE CHAT IS. comms_messages with a squadron_id set. The same table
   carries the module-wide channel (squadron_id null), which is why every read
   here is explicit about the column rather than filtering in JavaScript
   afterwards — a missing `.not("squadron_id", "is", null)` would quietly pour
   the whole module channel into one squadron's room.

   A SQUADRON HAS A NAME. It used to be built here as `${module_code}
   squadron`, which meant two rooms for one module were indistinguishable in
   the rail and the `name`, `blurb`, `join_policy` and `invite_token` columns
   0011 added went unread. 0022 backfills the name for every existing row, so
   the fallback below is for a row written between the two migrations rather
   than a normal path.

   READ STATE IS THE SERVER'S. It was a localStorage map called pw-room-seen,
   so every badge lit again on a second device and clearing site data marked
   three months of chat unread. squadron_members.last_read_at is the one place
   it lives now.

   A DELETED MESSAGE IS A TOMBSTONE. deleted_at is set and the body is nulled;
   the row stays so the transcript does not develop holes and so a reply that
   quotes it still has something to point at.

   FLY SOLO IS SYMMETRIC, and it is enforced in this file rather than at the
   call sites, so no future caller can forget it and leak.
   ========================================================================= */

const fail = (e, f) => { if (e) console.error(e); return f; };

const toMessage = (r) => ({
  id: r.id,
  squadronId: r.squadron_id,
  body: r.deleted_at ? null : r.body,
  authorId: r.user_id,
  createdAt: r.created_at,
  editedAt: r.edited_at || null,
  deletedAt: r.deleted_at || null,
  replyTo: r.reply_to || null,
  pinnedAt: r.pinned_at || null,
  pinnedBy: r.pinned_by || null,
  isSystem: Boolean(r.is_system),
  reactions: {},
});

const MSG_COLS =
  "id, squadron_id, user_id, body, created_at, edited_at, deleted_at, reply_to, pinned_at, pinned_by, is_system";

/* Who this account cannot see, in one round trip, so each read below does not
   make the same two queries over again. */
async function hiddenFor(me) {
  if (!me) return new Set();
  const [blocked, muted] = await Promise.all([fetchBlocks(me), fetchMutes(me)]);
  return new Set([...blocked, ...muted]);
}

/* Every squadron this account is in, across every module, each with its roster
   and the last thing said in it.

   Across every module deliberately: the room is global — that is the whole
   point of it being the Ready Room and not a per-module tab — so a squadron
   does not disappear from the sidebar because you happen to be looking at a
   different module today. */
export async function fetchMySquadrons(me) {
  if (isFlySolo() || !me) return [];

  const { data: mine, error: e1 } = await supabase
    .from("squadron_members")
    .select("squadron_id, muted, last_read_at, role, squadrons!inner(id, module_code, name, blurb, status, study_time, owner_id, join_policy, invite_token, member_cap)")
    .eq("user_id", me);
  if (e1) return fail(e1, []);

  const ids = [...new Set((mine || []).map((r) => r.squadron_id))];
  if (!ids.length) return [];

  const [{ data: members, error: e2 }, hidden] = await Promise.all([
    supabase.from("squadron_members").select("squadron_id, user_id, marking, role, joined_at").in("squadron_id", ids),
    hiddenFor(me),
  ]);
  if (e2) return fail(e2, []);

  // The last message per squadron for the rail's preview line, and the pin,
  // in one query for all of them rather than one per squadron.
  const [{ data: recent }, { data: pins }] = await Promise.all([
    supabase.from("comms_messages")
      .select("squadron_id, user_id, body, created_at, deleted_at")
      .in("squadron_id", ids).order("created_at", { ascending: false }).limit(200),
    supabase.from("comms_messages")
      .select("id, squadron_id, user_id, body, pinned_at, pinned_by")
      .in("squadron_id", ids).not("pinned_at", "is", null),
  ]);
  const preview = new Map();
  for (const m of recent || []) {
    if (!preview.has(m.squadron_id)) {
      preview.set(m.squadron_id, {
        body: m.deleted_at ? "Message removed" : m.body,
        authorId: m.user_id, createdAt: m.created_at,
      });
    }
  }
  const pinned = new Map();
  for (const p of pins || []) pinned.set(p.squadron_id, { id: p.id, body: p.body, by: p.pinned_by || p.user_id });

  return (mine || []).map((r) => {
    const sq = r.squadrons;
    const roster = (members || [])
      .filter((m) => m.squadron_id === sq.id && !hidden.has(m.user_id))
      .map((m) => ({ user_id: m.user_id, marking: m.marking, role: m.role, joined_at: m.joined_at }));
    return {
      id: sq.id,
      name: sq.name || `${sq.module_code} squadron`,
      blurb: sq.blurb || null,
      code: sq.module_code,
      moduleCode: sq.module_code,
      status: sq.status,
      ownerId: sq.owner_id,
      joinPolicy: sq.join_policy,
      inviteToken: sq.invite_token,
      memberCap: sq.member_cap,
      muted: Boolean(r.muted),
      lastReadAt: r.last_read_at,
      myRole: r.role,
      last: preview.get(sq.id) || null,
      pinned: pinned.get(sq.id) || null,
      // Ids, not row objects. The old shape was `{user_id, ...}` while every
      // caller tested `members.includes(someId)` — a string against an object,
      // always false, which is why the profile sheet told squadronmates they
      // did not share a squadron.
      members: roster.map((m) => m.user_id),
      roster,
    };
  });
}

/* The chat in every squadron this account is in. Ordered oldest-first, because
   it is read as a transcript and not as a feed. */
export async function fetchSquadronMessages(me, squadronIds = [], limit = 300) {
  if (isFlySolo() || !me || !squadronIds.length) return [];
  const { data, error } = await supabase
    .from("comms_messages")
    .select(MSG_COLS)
    .in("squadron_id", squadronIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error, []);
  const hidden = await hiddenFor(me);
  const rows = (data || [])
    .filter((r) => r.squadron_id && (r.body || r.deleted_at) && !hidden.has(r.user_id))
    .map(toMessage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const reactions = await fetchReactions(rows.map((r) => r.id));
  for (const r of rows) r.reactions = reactions[r.id] || {};
  return rows;
}

/* Reactions for a set of messages, shaped the way the bubble reads them:
   { messageId: { "👍": ["u_a", "u_b"] } }. One query, never one per message. */
export async function fetchReactions(messageIds = []) {
  const ids = messageIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("comms_reactions").select("message_id, user_id, emoji").in("message_id", ids);
  if (error) return fail(error, {});
  const out = {};
  for (const r of data || []) {
    const m = out[r.message_id] || (out[r.message_id] = {});
    (m[r.emoji] || (m[r.emoji] = [])).push(r.user_id);
  }
  return out;
}

export async function postSquadronMessage({ me, squadronId, moduleCode, body, replyTo }) {
  const text = (body || "").trim();
  if (!text || !me || !squadronId) return null;
  // No client-side id here, unlike a thread: comms_messages.id is a uuid with
  // a default, so the row takes the one Postgres makes and the insert returns
  // it. The room still shows the message immediately — the optimistic row it
  // draws carries a temporary id and is replaced by this one, so a slow
  // connection costs a grey tick rather than an empty transcript.
  const { data, error } = await supabase
    .from("comms_messages")
    .insert({
      squadron_id: squadronId, module_code: moduleCode || "", user_id: me,
      body: text, reply_to: replyTo || null,
    })
    .select(MSG_COLS).single();
  if (error) return fail(error, null);
  return toMessage(data);
}

export async function editMessage(me, messageId, body) {
  const { data, error } = await supabase.rpc("edit_message", { p_me: me, p_message: messageId, p_body: body });
  if (error) return fail(error, false);
  return Boolean(data);
}

export async function deleteMessage(me, messageId) {
  const { data, error } = await supabase.rpc("delete_message", { p_me: me, p_message: messageId });
  if (error) return fail(error, false);
  return Boolean(data);
}

export async function toggleReaction(me, messageId, emoji) {
  const { data, error } = await supabase.rpc("toggle_message_reaction", {
    p_me: me, p_message: messageId, p_emoji: emoji,
  });
  if (error) return fail(error, false);
  return Boolean(data);
}

/* ONE PIN PER SQUADRON. A list of pinned messages is a second inbox; one pin
   is a notice board, which is what a study group uses it for. The function
   clears the previous pin in the same statement, so two people pinning at once
   cannot leave two. */
export async function pinMessage(me, messageId, on = true) {
  const { data, error } = await supabase.rpc("pin_message", { p_me: me, p_message: messageId, p_on: on });
  if (error) return fail(error, false);
  return Boolean(data);
}

export async function markSquadronRead(me, squadronId) {
  if (!me || !squadronId) return null;
  const { data, error } = await supabase.rpc("mark_squadron_read", { p_me: me, p_squadron: squadronId });
  if (error) return fail(error, null);
  return data || null;
}

export async function setSquadronMuted(me, squadronId, muted) {
  const { data, error } = await supabase.rpc("set_squadron_muted", {
    p_me: me, p_squadron: squadronId, p_muted: muted,
  });
  if (error) return fail(error, null);
  return data;
}

export async function leaveSquadron(me, squadronId) {
  const { data, error } = await supabase.rpc("leave_squadron", { p_me: me, p_squadron: squadronId });
  if (error) return fail(error, "missing");
  return data || "missing";
}

/* §7 — who is in the room right now that you actually share a squadron with.

   This calls right_seat() rather than reading presence and filtering here.
   The rule now exists in exactly one place, in SQL (0009), and a caller that
   forgets to filter cannot get a stranger back because there is no unfiltered
   version to call.

   The client-side rightSeatCandidates stays as the fallback below, for a
   database that has not had 0009 run against it yet — same rule, same
   sentence, and the migration is what makes it authoritative. */
export async function fetchRightSeat(me, squadrons = []) {
  if (isFlySolo() || !me) return [];

  const { data, error } = await supabase.rpc("right_seat", { p_me: me });
  if (!error) {
    return (data || []).map((r) => ({
      user_id: r.user_id, squadronId: r.squadron_id,
      module_code: r.module_code, chapter_id: r.chapter_id, last_seen: r.last_seen,
    }));
  }

  // 0009 not run here. Fall back to the same boundary in JavaScript rather
  // than to no boundary — an empty right seat is a worse lie than a slower
  // one, and an unfiltered one is not an option.
  console.error(error);
  const [presence, blocked] = await Promise.all([fetchAllPresence(me), fetchBlocks(me)]);
  const members = [];
  for (const sq of squadrons) {
    members.push({ squadron_id: sq.id, user_id: me });
    for (const id of sq.members || []) members.push({ squadron_id: sq.id, user_id: id });
  }
  return rightSeatCandidates({ me, members, presence: presence || [], blocked });
}

/* §4b — the score on a question, and which way you voted. Answers already have
   this through lesson_reply_votes; the question did not, so a feed could not
   surface the one everybody is stuck on. */
export async function fetchThreadVotes(threadIds = [], me) {
  const ids = threadIds.filter(Boolean);
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc("thread_vote_counts", { p_threads: ids, p_me: me });
  if (error) return fail(error, {});
  return Object.fromEntries((data || []).map((r) => [r.thread_id, { score: Number(r.score) || 0, mine: Number(r.mine) || 0 }]));
}

export async function voteThread(me, threadId, dir) {
  const { data, error } = await supabase.rpc("toggle_thread_vote", {
    p_me: me, p_thread: threadId, p_dir: dir,
  });
  if (error) return fail(error, 0);
  return Number(data) || 0;
}
