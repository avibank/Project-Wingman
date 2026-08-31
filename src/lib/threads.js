import { supabase } from "./supabaseClient.js";
import { isFlySolo } from "./flySolo.js";
import { fetchBlocks, fetchMutes } from "./squadron.js";
import { toThread, toReply, fromThread, fromReply } from "./threadRows.js";

/* ============================================================================
   The shared discussion — lesson_threads and lesson_replies (migration 0008).

   THE ONE THING THIS FILE CHANGES: threads used to live in `user_progress`,
   which is per account. A question asked there was visible only to the person
   who asked it, so the module could not actually answer anyone. These are the
   same rows, in the two shared tables, read by everybody.

   ONE TABLE, TWO QUERIES — 0008's rule, kept here. A comment under a video and
   a thread in the Ready Room are the SAME ROW: lesson_id set means it is
   anchored and appears in both places, lesson_id null means it is a module
   post and appears only in the room. Nothing copies and nothing syncs, so the
   reply counts in the two places cannot drift.

   WHY THE RAW ROWS AND NOT THE RPCs. 0008 ships `lesson_comments` and
   `module_threads`, and this file deliberately does not call them for the
   normal read. The client already needs the raw replies for four other things
   — rendering a thread, the marks on the scrub bar, the density silhouette,
   and the badge rule — and `orderThreads` in lessonSurface.js is already the
   single owner of the ordering. Calling the RPC as well would put the same
   ordering in two places, in two languages, and that is precisely the split
   that has bitten this codebase before. The RPCs stay in the schema for a
   server-side paginated read when a module's discussion outgrows one fetch;
   when that day comes, the ordering moves there WHOLE rather than being
   duplicated.
   ========================================================================= */

const fail = (e, f) => { if (e) console.error(e); return f; };

/* A WRITE REPORTS WHETHER IT WORKED. `return !fail(error, false)` reads as
   "false when there was an error", but fail returns its fallback on BOTH
   branches — so it was `!false`, unconditionally true, and every failed
   insert, delete and update reported success to its caller. */
const ok = (e) => { if (e) console.error(e); return !e; };

/* Everything one module's discussion needs, in two queries.

   Fly solo is symmetric: you see nobody, so nobody's threads load. Gated here
   rather than at each call site, so no caller can forget and leak. Your own
   threads still come back — flying solo means not being in the room, not
   losing what you wrote. */
export async function fetchDiscussion(moduleId, me) {
  if (!moduleId) return { threads: [], replies: [] };

  const { data: tRows, error: tErr } = await supabase
    .from("lesson_threads").select("*").eq("module_id", moduleId);
  if (tErr) return fail(tErr, { threads: [], replies: [], failed: true });

  // Who this account cannot see, fetched ONCE and applied to both collections.
  // Doing it per collection made the same two round trips twice, and a reply
  // filtered by a different snapshot than its thread is how a blocked person's
  // answer ends up hanging under a thread that is no longer there.
  const solo = isFlySolo();
  let hidden = new Set();
  if (!solo && me) {
    const [blocked, muted] = await Promise.all([fetchBlocks(me), fetchMutes(me)]);
    hidden = new Set([...blocked, ...muted]);
  }
  const visible = (row) => (solo ? row.authorId === me : !hidden.has(row.authorId));

  const threads = (tRows || []).map(toThread).filter(visible);

  const ids = threads.map((t) => t.id);
  if (!ids.length) return { threads, replies: [] };

  const { data: rRows, error: rErr } = await supabase
    .from("lesson_replies").select("*").in("thread_id", ids);
  if (rErr) return fail(rErr, { threads, replies: [] });

  return { threads, replies: (rRows || []).map(toReply).filter(visible) };
}

/* Writes. Each returns ok/failed rather than throwing, because the caller has
   already put the row on screen optimistically and needs to mark it, not
   unwind. Never delete something a person typed. */
export async function insertThread(thread) {
  const { error } = await supabase.from("lesson_threads").insert(fromThread(thread));
  return ok(error);
}

export async function insertReply(reply) {
  const { error } = await supabase.from("lesson_replies").insert(fromReply(reply));
  return ok(error);
}

/* Replies cascade in the schema, so this is one statement and not two. */
export async function deleteThread(id) {
  const { error } = await supabase.from("lesson_threads").delete().eq("id", id);
  return ok(error);
}

export async function deleteReply(id) {
  const { error } = await supabase.from("lesson_replies").delete().eq("id", id);
  return ok(error);
}

/* ------------------------------------------------------- 0010 · the feed --
   What turns a list of comments into a question feed: a title, one answer the
   asker marked as the one that worked, and endorsements on the rest. */

/* Votes for a set of replies, as { replyId: { count, mine } }.
   One query for the whole feed rather than one per answer — a per-row fetch
   inside a render loop is how a thread with forty answers makes forty
   requests. */
export async function fetchReplyVotes(replyIds = [], me) {
  const ids = [...new Set(replyIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from("lesson_reply_votes").select("reply_id, user_id").in("reply_id", ids);
  if (error) return fail(error, {});
  const out = {};
  for (const r of data || []) {
    const v = (out[r.reply_id] = out[r.reply_id] || { count: 0, mine: false });
    v.count += 1;
    if (r.user_id === me) v.mine = true;
  }
  return out;
}

/* One vote each, enforced by the primary key rather than by checking first —
   a check-then-insert races with itself on a double tap. */
export async function toggleReplyVote(replyId, me, on) {
  if (!replyId || !me) return false;
  if (on) {
    const { error } = await supabase
      .from("lesson_reply_votes").insert({ reply_id: replyId, user_id: me });
    // A duplicate is the vote already being there, which is the state the
    // caller asked for. Not an error worth surfacing.
    return !error || error.code === "23505";
  }
  const { error } = await supabase
    .from("lesson_reply_votes").delete().match({ reply_id: replyId, user_id: me });
  return ok(error);
}

/* §4c — the asker's mark. Only the person who asked may set it, which is
   enforced here in the app because auth.uid() is NULL in this architecture
   (see 0009's header) — the eq("author_id", me) is what makes the write a
   no-op for anybody else rather than a silent success. */
export async function setBestReply(threadId, replyId, me) {
  if (!threadId || !me) return false;
  const { error } = await supabase
    .from("lesson_threads")
    .update({ best_reply_id: replyId })
    .eq("id", threadId)
    .eq("author_id", me);
  return ok(error);
}
