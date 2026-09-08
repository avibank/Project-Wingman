/* =============================================================================
   INGEST — done in the browser, at upload, because there is no server.
   -----------------------------------------------------------------------------
   §4.7 describes a server-side pipeline: linearize, manifest, text layer,
   thumbnails. This app has no application server — no /api, no edge functions,
   nothing but a static bundle and Postgres over PostgREST (see
   docs/reader/DISCOVERY.md §7). So the pipeline is split by where each step can
   actually run.

     manifest      here, at upload   pdf.js already knows all of it
     text layer    here, at upload   getTextContent already produces it
     thumbnails    here, at upload   render to canvas, encode as JPEG
     linearize     NOT HERE          needs qpdf; `npm run paper:linearize`

   The valuable half is fully deliverable and does not need a server: with the
   manifest and the text stored beside the file, THE READER NEVER OPENS THE PDF
   TO LAY OUT, SEARCH, OR ANCHOR A MARK. It opens it only to paint pixels. That
   is what makes a thousand placeholder pages appear at the right height before
   a single PDF byte arrives.

   The half that cannot be done here is not faked. Ingest records whether the
   file is linearized, and the reader says so in Document details rather than
   guessing. An unlinearized paper still range-loads — it just has to fetch the
   trailer first to find the cross-reference table.
   ========================================================================= */

import { pdfjs } from "./paperText.js";

export const THUMB_WIDTH = 180;
export const TEXT_CHUNK = 40;          // pages per stored text file

/* A linearized PDF declares /Linearized in its first object, inside the first
   kilobyte or so. Checked against the definition rather than against a tool's
   opinion, because the tool is not installed. */
export function isLinearized(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  return /\/Linearized/.test(head);
}

/* Everything the reader needs before it has any of the file. */
export async function buildManifest(doc) {
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const v = page.getViewport({ scale: 1 });
    pages.push({ w: Math.round(v.width), h: Math.round(v.height), rotation: v.rotation || 0 });
    page.cleanup();
  }
  let outline = null;
  try { outline = await doc.getOutline(); } catch { /* many papers have none */ }
  const meta = await doc.getMetadata().catch(() => null);
  return {
    version: 1,
    pages: doc.numPages,
    boxes: pages,
    outline: outline || null,
    title: meta?.info?.Title || null,
    producer: meta?.info?.Producer || null,
  };
}

/* The text layer, per page, exactly as paperText.js joins it — so an anchor
   made against the live extraction resolves against the stored one. Sharing
   the joining rule is the whole point; two different joins would mean every
   mark landing a few characters out. */
export async function extractText(doc, onProgress) {
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    const runs = [];
    content.items.forEach((it, index) => {
      if (typeof it.str !== "string") return;
      const start = text.length;
      text += it.str;
      runs.push({ index, start, end: text.length });
      if (it.hasEOL) text += "\n";
    });
    pages.push({ page: n, text, runs });
    page.cleanup();
    onProgress?.(n, doc.numPages, "text");
  }
  return pages;
}

/* Small JPEGs for the Pages panel. Rendered at a fixed width so a 1000-page
   manual's rail costs the same as a 14-page one. */
export async function makeThumbs(doc, onProgress, limit = 60) {
  const out = [];
  const count = Math.min(doc.numPages, limit);
  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / base.width;
    const v = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(v.width);
    canvas.height = Math.floor(v.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: v }).promise;
    page.cleanup();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.7));
    canvas.width = canvas.height = 0;
    out.push({ page: n, blob });
    onProgress?.(n, count, "thumbnails");
  }
  return out;
}

/* Does this paper have text at all? A scan has none, and text tools cannot
   work on it — §5.2 says say so honestly rather than offering them. */
export const hasTextLayer = (textPages) =>
  textPages.some((p) => p.text.replace(/\s/g, "").length > 40);

/* OPENED ONCE, IN TWO HALVES.

   The manifest is needed before anything can be stored — it is what the row
   records and what lets the reader lay the paper out. The text layer and the
   thumbnails are not: they take minutes on a long manual and are worth nothing
   until the file itself is safely up.

   So the document is opened, the manifest taken, and the handle kept. The
   caller uploads, then comes back for the rest. `close()` must be called
   either way or a 44MB parse stays in memory for the life of the tab.

   The bytes are handed to pdf.js as a COPY, because it transfers the buffer to
   its worker and a transferred ArrayBuffer is detached — reading it afterwards
   to check linearization would find a zero-length array. */
export async function open(file, onProgress) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const linear = isLinearized(bytes);
  onProgress?.(0, 1, "reading");

  const doc = await pdfjs.getDocument({
    data: bytes.slice(0), isEvalSupported: false,
  }).promise;

  const manifest = await buildManifest(doc);
  onProgress?.(1, 1, "manifest");

  return {
    doc,
    manifest: { ...manifest, linearized: linear, hasText: null },
    /* The slow half, on demand. */
    rest: async (progress) => {
      const text = await extractText(doc, progress);
      const thumbs = await makeThumbs(doc, progress);
      return { text, thumbs, hasText: hasTextLayer(text) };
    },
    close: () => { try { doc.destroy?.(); } catch { /* already gone */ } },
  };
}
