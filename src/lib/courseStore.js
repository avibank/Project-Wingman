/* =============================================================================
   THE COURSE, FROM THE TABLE — reading it, and publishing it.
   -----------------------------------------------------------------------------
   Migration 0040 gives the course document a home the app can read at runtime
   and an admin can write without a commit. This file is the two ends of that:
   `fetchLiveCourse()` for every visitor, `publishCourse()` for the Studio.

   THE READ IS ALLOWED TO FAIL, AND FAILS TO THE SHIPPED DOCUMENT. A table
   that is empty, a night when the database is paused, a request that takes
   too long on a phone: each of those must end with the course the app was
   built with rather than an empty Library. So there is a timeout, every error
   is swallowed into `null`, and moduleContent decides what to do with it.
   The one thing this file will not do is hand back a document it has not
   checked — `validateContent` runs on whatever comes back, and a document
   that fails it is treated as no document at all, because a bad publish
   should cost a version rather than a class's evening.

   THE WRITE CARRIES A KEY the server compares as a digest (0040's header has
   the argument for why a key rather than an identity). It is never stored in
   this file and never logged; the Studio keeps it in the admin's own browser.
   ========================================================================= */
import { supabase, configured } from "./supabaseClient.js";
import { validateContent } from "./contentSchema.js";

/* Long enough for a slow phone on college wifi, short enough that nobody
   waits for a database that is not answering. The shipped document is the
   fallback, and it is already in the bundle. */
const READ_TIMEOUT = 4000;

const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((resolve) => { setTimeout(() => resolve({ timedOut: true }), ms); }),
]);

/**
 * The published course, or null — null meaning "use what shipped".
 * Never throws.
 */
export async function fetchLiveCourse() {
  if (!configured) return null;
  try {
    const res = await withTimeout(supabase.rpc("current_course"), READ_TIMEOUT);
    if (!res || res.timedOut || res.error) return null;
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    const doc = row?.doc;
    if (!doc || !Array.isArray(doc.modules) || !doc.modules.length) return null;
    const problems = validateContent(doc);
    if (problems.length) {
      console.error(`[course] the published document was refused: ${problems.slice(0, 3).join(" · ")}`);
      return null;
    }
    return { doc, id: row.id, note: row.note || null, at: row.published_at || null };
  } catch (e) {
    console.error("[course] live read failed", e);
    return null;
  }
}

/** Every published version, newest first — the Studio's history list. */
export async function fetchCourseVersions(limit = 12) {
  if (!configured) return [];
  const { data, error } = await supabase
    .from("course_docs").select("id,note,published_by,published_at")
    .order("published_at", { ascending: false }).limit(limit);
  if (error) { console.error("[course] versions", error); return []; }
  return data || [];
}

/**
 * Publish a document. Returns { ok, id, at } or { ok: false, error } with the
 * server's own sentence — "that publishing key is not right" is the one a
 * person can act on, so it is passed through rather than replaced.
 */
export async function publishCourse(doc, key, { note = null, by = null } = {}) {
  if (!configured) return { ok: false, error: "This build has no database." };
  const problems = validateContent(doc);
  if (problems.length) return { ok: false, error: problems[0] };
  const { data, error } = await supabase.rpc("publish_course", {
    p_doc: doc, p_key: key, p_note: note, p_by: by,
  });
  if (error) return { ok: false, error: error.message || "That did not publish." };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, id: row?.id, at: row?.published_at };
}
