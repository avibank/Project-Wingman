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
  return !fail(error, false);
}

export async function insertReply(reply) {
  const { error } = await supabase.from("lesson_replies").insert(fromReply(reply));
  return !fail(error, false);
}

/* Replies cascade in the schema, so this is one statement and not two. */
export async function deleteThread(id) {
  const { error } = await supabase.from("lesson_threads").delete().eq("id", id);
  return !fail(error, false);
}

export async function deleteReply(id) {
  const { error } = await supabase.from("lesson_replies").delete().eq("id", id);
  return !fail(error, false);
}
