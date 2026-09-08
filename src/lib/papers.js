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

/* WHERE A PAPER'S FILE ACTUALLY IS.

   A fixture paper is a path relative to the site root; an uploaded one is an
   absolute URL into storage. Prefixing a slash to both — which is what the
   reader did — turns `https://…` into `/https://…`, and the request 404s
   against our own origin. One helper, so there is one answer. */
/* Where a stored thumbnail is. Ingest writes the first sixty; beyond that the
   rail renders on demand, which is fine because nobody scrolls to page 400 of
   a thumbnail rail without meaning to. */
export const THUMBS_STORED = 60;
export const thumbUrl = (paper, page) =>
  (paper?.id && page <= THUMBS_STORED ? publicUrl(`${paper.id}/thumbs/${page}.jpg`) : null);

export const fileHref = (file) => {
  const f = String(file || "");
  if (/^(https?:)?\/\//.test(f) || f.startsWith("blob:") || f.startsWith("data:")) return f;
  return `/${f.replace(/^\//, "")}`;
};
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


/* -----------------------------------------------------------------------------
   THE STORED TEXT LAYER, in the shape paperText.js produces.

   Search and every anchor read this, and it is written once at ingest. The
   alternative is extracting it in the browser on every open, which on a
   1012-page manual means parsing the whole document to read one page of it.

   The joining rule has to match paperText.js exactly — the same runs, the same
   newline on hasEOL — or an anchor made against one resolves a few characters
   out against the other. Ingest stores per-page runs; this joins them the same
   way, with a blank line between pages.
   -------------------------------------------------------------------------- */
const textCache = new Map();

export async function storedText(paper) {
  const id = paper?.id;
  if (!id || !paper?.manifest) return null;          // fixture papers have none
  if (textCache.has(id)) return textCache.get(id);

  const promise = (async () => {
    const res = await fetch(publicUrl(`${id}/text.json`));
    if (!res.ok) return null;
    const pages = await res.json();
    if (!Array.isArray(pages) || !pages.length) return null;

    const items = [];
    const pageStart = [];
    let text = "";
    for (const pg of pages) {
      if (pg.page > 1) text += "\n\n";
      pageStart.push(text.length);
      const base = text.length;
      for (const run of pg.runs || []) {
        items.push({
          page: pg.page,
          index: run.index,
          start: base + run.start,
          end: base + run.end,
          str: pg.text.slice(run.start, run.end),
        });
      }
      text += pg.text;
    }
    return { text, items, pageStart, pages: pages.length };
  })().catch(() => null);

  textCache.set(id, promise);
  return promise;
}
