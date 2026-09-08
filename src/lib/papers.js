/* =============================================================================
   Papers: rows, files, and who a paper is for.
   -----------------------------------------------------------------------------
   Adding a paper is open to everybody. What differs is who else can see it:

     Just me     your own copy — nobody else, ever
     My formation the people you fly with
     Everyone on the module   STAFF ONLY

   The last is gated in SQL, not here. A check in the browser is a suggestion;
   `add_paper` refuses a module-wide paper from a non-staff caller and returns
   the scope it ACTUALLY used, so a client that asks for more than it may have
   is told rather than silently succeeding. See migration 0019.
   ========================================================================= */

import { supabase } from "./supabaseClient.js";
import { upload, remove, canWrite, publicUrl as pub, isMissingBucket, storageConfigured } from "./storage.remote.js";

export const BUCKET = "papers";
export const SETUP_COMMAND = "npm run reader:setup";
export { storageConfigured };

export const SCOPES = [
  { id: "solo", label: "Just me", note: "Your own copy. Nobody else sees it." },
  { id: "formation", label: "My formation", note: "The people you fly with." },
  { id: "module", label: "Everyone on the module", note: "The whole cohort. Instructors only.", staffOnly: true },
];
export const scopeLabel = (id) => SCOPES.find((s) => s.id === id)?.label || SCOPES[0].label;

/* A missing table or bucket is a SETUP state, not an error state. They read
   differently and they need different words: one says "run this", the other
   says "something went wrong". */
export function needsSetup(error) {
  const m = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return /does not exist|42p01|could not find|bucket not found|schema cache/.test(m)
    || isMissingBucket(m);
}

export const publicUrl = (path) => pub(BUCKET, path);
const at = (id, rest) => `${id}/${rest}`;

export async function listPapers(moduleCode, me) {
  if (!moduleCode || !me) return { papers: [], setup: false, error: null };
  const { data, error } = await supabase.rpc("papers_for", { uid: me, p_module: moduleCode });
  if (error) return { papers: [], setup: needsSetup(error), error: needsSetup(error) ? null : error };
  return {
    papers: (data || []).map((p) => ({
      ...p,
      /* The Library reads one shape whether a paper came from the fixture or
         from an upload, so the file becomes an absolute URL here. */
      file: publicUrl(p.file_path),
      kind: "PDF",
    })),
    setup: false,
    error: null,
  };
}

export async function deletePaper(me, id) {
  const { data, error } = await supabase.rpc("delete_paper", { uid: me, p_id: id });
  if (error || !data) return false;
  await remove(BUCKET, [at(id, "paper.pdf"), at(id, "manifest.json"), at(id, "text.json")]);
  return true;
}

/* -----------------------------------------------------------------------------
   THE UPLOAD, IN THE ORDER THAT MAKES IT FEEL FAST AND FAIL WELL.

   1. Check we can write BEFORE anything is built. A missing bucket costs a
      round trip rather than four minutes of ingest and then a wall.
   2. Write the row as `pending`, so the paper appears in the Library saying
      "Preparing…" almost immediately rather than after the transfer.
   3. Send the file, with real progress. On a 44MB manual over a hotel wifi
      this is the part that takes minutes and it must not look like a hang.
   4. Build and send the sidecars.
   5. Mark it ready.

   A failure at any step leaves the row `failed` with a reason rather than
   vanishing, and every step is safe to retry: the row upserts and the storage
   writes overwrite.
   -------------------------------------------------------------------------- */
export async function uploadPaper({
  id, moduleCode, chapterId, title, file, manifest, visibility, me, onStep, onProgress, signal,
}) {
  if (!storageConfigured) {
    return { ok: false, setup: true, error: { message: "Storage is not configured in this build." } };
  }

  onStep?.("Checking there is somewhere to put it");
  const room = await canWrite(BUCKET);
  if (!room.ok) return { ok: false, setup: room.missing || needsSetup(room), error: { message: room.message } };

  onStep?.("Making a place for it");
  const { data: made, error: rowErr } = await supabase.rpc("add_paper", {
    uid: me, p_id: id, p_module: moduleCode, p_chapter: chapterId || "", p_title: title,
    p_file: at(id, "paper.pdf"), p_pages: manifest.pages, p_bytes: file.size,
    p_visibility: visibility || "solo",
    p_linearized: manifest.linearized, p_has_text: manifest.hasText, p_manifest: manifest,
  });
  if (rowErr) return { ok: false, setup: needsSetup(rowErr), error: rowErr };
  const row = Array.isArray(made) ? made[0] : made;

  onStep?.("Uploading the file");
  const sent = await upload(BUCKET, at(id, "paper.pdf"), file, {
    contentType: "application/pdf", onProgress, signal,
  });
  if (!sent.ok) {
    await supabase.rpc("paper_status", { uid: me, p_id: id, p_status: "failed", p_failure: sent.message });
    return { ok: false, aborted: sent.aborted, error: { message: sent.message } };
  }
  return { ok: true, id, visibility: row?.made_visibility || "solo", downgraded: !!row?.downgraded };
}

/* The sidecars, after the file is safely up. Slow to build on a long manual,
   and worth nothing until the paper itself is there. */
export async function uploadSidecars({ id, me, text, thumbs, onStep, onProgress, signal }) {
  onStep?.("Storing the text layer");
  let res = await upload(BUCKET, at(id, "text.json"),
    new Blob([JSON.stringify(text)], { type: "application/json" }),
    { contentType: "application/json", signal });
  if (!res.ok) return { ok: false, error: { message: res.message } };

  onStep?.("Storing the thumbnails");
  for (let i = 0; i < thumbs.length; i++) {
    res = await upload(BUCKET, at(id, `thumbs/${thumbs[i].page}.jpg`), thumbs[i].blob,
      { contentType: "image/jpeg", signal });
    if (!res.ok) return { ok: false, error: { message: res.message } };
    onProgress?.(i + 1, thumbs.length);
  }

  await supabase.rpc("paper_status", { uid: me, p_id: id, p_status: "ready", p_failure: null });
  return { ok: true };
}

/* A paper id a person can read, derived from the module and the title, so the
   address of a Lufthansa manual is not a uuid. */
export function paperId(moduleCode, title, existing = []) {
  const stem = `${moduleCode}.${title}`.toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!existing.includes(stem)) return stem;
  for (let n = 2; n < 99; n++) if (!existing.includes(`${stem}-${n}`)) return `${stem}-${n}`;
  return `${stem}-${Date.now().toString(36)}`;
}
