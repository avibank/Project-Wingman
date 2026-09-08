/* =============================================================================
   Reading and writing marks on a paper.
   -----------------------------------------------------------------------------
   Every read goes through paper_annotations_for, never a raw select, and that
   is not a style preference:

     R9 — a correction written by one student is ABSENT from another student's
     payload. Not hidden in the client, not filtered after it arrives. If this
     file ever selects from paper_annotations directly, that rule is broken.

     R12 — Fly solo is symmetric and needs no second toggle on the paper. The
     function knows; the paper view does not have to.
   ========================================================================= */

import { supabase } from "./supabaseClient.js";
import { insertThread } from "./threads.js";
import { newId } from "./lessonSurface.js";

const fail = (e, f) => { if (e) console.error(e); return f; };

/* Rows come back snake_case from Postgres and stay that way here on purpose:
   they are passed straight to paperMarks.js, which reads author_id and
   updated_at, and one vocabulary through the whole feature beats two. */
export async function fetchAnnotations(me, paperId, since = null) {
  if (!me || !paperId) return [];
  /* paper_marks_for, not paper_annotations_for. 0017 widened the shape to carry
     the highlighter colour, and a function's return columns cannot be widened
     in place — so the new shape took a new name and the old function was left
     answering rather than dropped in the same breath. See 0017's header. */
  const { data, error } = await supabase.rpc("paper_marks_for", {
    uid: me, p_paper: paperId, p_since: since,
  });
  if (error) return fail(error, []);
  return data || [];
}

/* R5 — the cheapest mark is wordless. body defaults to null and the caller is
   not expected to pass one. */
export async function createAnnotation({
  paperId, moduleCode, me, kind = "highlight", ring = "module",
  body = null, anchor, threadId = null, hint = null, id = null, colour = null,
}) {
  if (!me || !paperId || !anchor) return null;
  const row = {
    paper_id: paperId,
    module_code: moduleCode,
    author_id: me,
    kind,
    ring,
    body: body || null,
    thread_id: threadId,
    /* The NAME of a colour, never a colour. What "blue" looks like stays a CSS
       decision, so the palette can be re-tinted for the night theme without a
       migration and without changing what anybody's existing mark means. */
    colour: colour || null,
    anchor,
    hint,
  };
  if (id) row.id = id;
  const { data, error } = await supabase.from("paper_annotations").insert(row).select().single();
  if (error) return fail(error, null);
  return data;
}

export async function updateAnnotation(id, patch) {
  if (!id) return false;
  const { error } = await supabase
    .from("paper_annotations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !fail(error, false) && !error;
}

/* Only ever called for a mark this account wrote — the caller checks, because
   the server cannot: it has no session to check against. */
export async function deleteAnnotation(id) {
  if (!id) return false;
  const { error } = await supabase.from("paper_annotations").delete().eq("id", id);
  return !error;
}

/* R2 — the one write that says a mark lost its place. A function rather than an
   update, so "mark orphaned" cannot drift into "delete the row". */
export async function markOrphaned(id, orphaned = true) {
  if (!id) return false;
  const { error } = await supabase.rpc("paper_annotation_status", {
    p_id: id, p_status: orphaned ? "orphaned" : "ok",
  });
  return !fail(error, false) && !error;
}

/* -----------------------------------------------------------------------------
   R10 — a question is a Snag, and it mirrors.

   The same object as a question on a lesson: it becomes a thread in the Ready
   Room for that module, opening with the passage that was marked, and the
   paper never grows its own reply UI. Answers happen where answers live.
   -------------------------------------------------------------------------- */
export async function askOnPassage({ moduleCode, me, quote, body, paperTitle }) {
  const threadId = newId("T");
  const opener = [
    `> ${quote}`,
    "",
    body,
  ].join("\n");
  const ok = await insertThread({
    id: threadId,
    moduleId: moduleCode,
    lessonId: null,
    body: opener,
    authorId: me,
    createdAt: new Date().toISOString(),
    // The paper is the subject line, so the room can tell a paper question from
    // a lesson one at a glance without opening it.
    title: paperTitle ? `${paperTitle} — a question` : "A question on a paper",
  });
  if (!ok) return null;
  return threadId;
}

/* The author queue. Returns nothing at all for anyone who is not staff — the
   function decides that, not this file. */
export async function fetchCorrections(me, moduleCode) {
  if (!me || !moduleCode) return [];
  const { data, error } = await supabase.rpc("paper_corrections_for", {
    uid: me, p_module: moduleCode,
  });
  if (error) return fail(error, []);
  return data || [];
}

export async function resolveCorrection(id) {
  return updateAnnotation(id, { resolved_at: new Date().toISOString() });
}

/* §10 — agreeing with somebody else's mark.
   A counter incremented where it lives rather than read-modify-written from the
   browser: two people pressing it in the same second must both count, and a
   client that reads 4 and writes 5 loses one of them. */
export async function agreeWithMark(id) {
  if (!id) return null;
  const { data, error } = await supabase.rpc("agree_with_mark", { p_id: id });
  if (error) return fail(error, null);
  return data;
}
