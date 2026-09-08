/* =============================================================================
   Papers as rows, and files in storage.
   -----------------------------------------------------------------------------
   Papers were a JSON fixture, which is why there was no way to add one. A real
   file uploaded by hand needs a row, and the sidecars the reader reads need
   somewhere to live beside it.

   THE BUCKET IS NOT CREATED BY THIS BUILD. The instruction for this run was
   explicit — do not run migrations against production, I will run them myself.
   So `supabase/migrations/0018_reader_rebuild.sql` creates the `papers` table
   and the `papers` bucket, and it is left unrun. Everything here detects that
   and says exactly what to run, once, rather than failing with a stack trace.
   ========================================================================= */

import { supabase } from "./supabaseClient.js";

const BUCKET = "papers";

export const SETUP_COMMAND = "npm run reader:setup";

/* A missing table or bucket is a SETUP state, not an error state. They read
   differently and they need different words: one says "run this", the other
   says "something went wrong". */
export function needsSetup(error) {
  const m = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return /does not exist|relation .* does not exist|42p01|bucket not found|not found/.test(m);
}

export async function listPapers(moduleCode) {
  const { data, error } = await supabase
    .from("papers").select("*").eq("module_code", moduleCode)
    .order("created_at", { ascending: true });
  if (error) return { papers: [], setup: needsSetup(error), error: needsSetup(error) ? null : error };
  return { papers: data || [], setup: false, error: null };
}

const path = (id, rest) => `${id}/${rest}`;

async function put(name, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(name, body, { contentType, upsert: true });
  return error;
}

export const publicUrl = (name) =>
  supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

/* Uploads the file and its sidecars, then marks the row ready. The ROW IS
   WRITTEN FIRST, as `pending`: a paper that is still processing shows
   "Preparing…" in the Library rather than a viewer that cannot open it, and if
   the tab dies halfway the row says so rather than disappearing. */
export async function uploadPaper({ id, moduleCode, chapterId, title, file, ingested, uploadedBy, onStep }) {
  const row = {
    id, module_code: moduleCode, chapter_id: chapterId || null, title,
    file_path: path(id, "paper.pdf"),
    pages: ingested.manifest.pages,
    bytes: file.size,
    status: "pending",
    linearized: ingested.manifest.linearized,
    has_text: ingested.manifest.hasText,
    manifest: ingested.manifest,
    uploaded_by: uploadedBy || null,
  };

  const { error: rowErr } = await supabase.from("papers").upsert(row, { onConflict: "id" });
  if (rowErr) return { ok: false, setup: needsSetup(rowErr), error: rowErr };

  onStep?.("Uploading the file");
  let err = await put(row.file_path, file, "application/pdf");
  if (err) return { ok: false, setup: needsSetup(err), error: err };

  onStep?.("Storing the manifest");
  err = await put(path(id, "manifest.json"),
    new Blob([JSON.stringify(ingested.manifest)], { type: "application/json" }), "application/json");
  if (err) return { ok: false, setup: needsSetup(err), error: err };

  onStep?.("Storing the text layer");
  err = await put(path(id, "text.json"),
    new Blob([JSON.stringify(ingested.text)], { type: "application/json" }), "application/json");
  if (err) return { ok: false, setup: needsSetup(err), error: err };

  onStep?.("Storing the thumbnails");
  for (const t of ingested.thumbs) {
    err = await put(path(id, `thumbs/${t.page}.jpg`), t.blob, "image/jpeg");
    if (err) return { ok: false, setup: needsSetup(err), error: err };
  }

  const { error: doneErr } = await supabase.from("papers")
    .update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", id);
  if (doneErr) return { ok: false, setup: needsSetup(doneErr), error: doneErr };
  return { ok: true, paper: { ...row, status: "ready" } };
}

/* A paper id a person can read, derived from the module and the title, so the
   URL of a Lufthansa manual is not a uuid. */
export function paperId(moduleCode, title, existing = []) {
  const stem = `${moduleCode}.${title}`.toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!existing.includes(stem)) return stem;
  for (let n = 2; n < 99; n++) if (!existing.includes(`${stem}-${n}`)) return `${stem}-${n}`;
  return `${stem}-${Date.now().toString(36)}`;
}
