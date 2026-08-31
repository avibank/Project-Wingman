/* The row shapes on the boundary between the client and Postgres.

   Pure, and in their own file with no imports, for one reason: this is the
   only place the two vocabularies meet, and it has to be testable without a
   browser, a network or an env. threads.js cannot be imported by a node test —
   it reaches supabaseClient, which reads import.meta.env — so the contract
   would otherwise be the one part of the discussion with no coverage at all.

   The client has spoken camelCase since before there was a server. Postgres
   speaks snake_case. Converting in exactly these four functions is what keeps
   every other file from having to know both. */

export const toThread = (r) => ({
  id: r.id, moduleId: r.module_id, lessonId: r.lesson_id, t: r.t,
  body: r.body, authorId: r.author_id, createdAt: r.created_at,
  // 0010. `title` is NULL for anything mirrored from a lesson comment, and
  // that null is meaningful — see titleOf() in roomModel, which turns the
  // comment's first line into the heading instead.
  title: r.title ?? null,
  bestReplyId: r.best_reply_id ?? null,
});

export const toReply = (r) => ({
  id: r.id, threadId: r.thread_id, body: r.body,
  authorId: r.author_id, createdAt: r.created_at,
});

/* ANCHORED OR NOT, NEVER HALF — 0008's CHECK constraint, mirrored here.

   Sending a moment alongside a null lesson_id is a 400 from Postgres, and
   from the student's side that is a post that simply never appears. Pairing
   them here means the client cannot construct the rejected shape in the first
   place, rather than relying on every caller to remember the rule. */
export const fromThread = (t) => ({
  id: t.id,
  module_id: t.moduleId,
  body: t.body,
  author_id: t.authorId,
  created_at: t.createdAt,
  // Undefined and null both mean "no title", and a lesson-mirrored thread
  // must store NULL rather than an empty string — "" would satisfy a
  // not-null check that null is meant to fail, and would render as a blank
  // heading instead of falling back to the first line.
  // Trim FIRST, then decide. `t.title ? ... : null` treats "   " as present
  // and stores the empty string — the exact failure the comment above warns
  // about, caught by check:threads rather than by reading it back.
  title: (String(t.title ?? "").trim() || null),
  lesson_id: t.lessonId ?? null,
  t: t.lessonId == null ? null : Math.max(0, Math.floor(t.t ?? 0)),
});

export const fromReply = (r) => ({
  id: r.id, thread_id: r.threadId, body: r.body,
  author_id: r.authorId, created_at: r.createdAt,
});
