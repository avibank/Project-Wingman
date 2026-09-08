/* =============================================================================
   The paper, as text — the bridge between a PDF and anchor.js.
   -----------------------------------------------------------------------------
   anchor.js works on one string. A PDF is fourteen pages of text runs at
   arbitrary positions. This file is the only place those two views meet, and it
   holds exactly three facts:

     docText      one string for the whole paper, pages joined by a blank line
     items[]      every text run, with where it starts and ends in docText
     pageStart[]  where each page begins in docText

   Everything else — turning a selection into offsets, turning offsets back into
   rectangles to draw — is a lookup against those.

   THE PDF.JS VERSION IS PINNED, EXACTLY, IN package.json. This is not caution
   about bugs. A minor version changes how text runs are split and spaced, which
   changes docText, which silently orphans every annotation ever made against
   the old extraction. If you upgrade it, expect to re-resolve every mark and
   plan for some of them to be lost.
   ========================================================================= */

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const PDFJS_VERSION = pdfjs.version;
export { pdfjs };

/* One loaded document per url, because the reader, the thumbnail rail and the
   text extraction all want the same one and a PDF is not cheap to parse. */
const docs = new Map();

/* LOADED BY RANGE, NEVER WHOLE-FILE.

   A module manual is 40MB today and may be 200MB later, and the time to the
   first page must not depend on either number. `disableAutoFetch` is the switch
   that makes pdf.js fetch only what is looked at instead of quietly pulling the
   rest of the file in the background once the first page is up — without it,
   range loading looks like it works and still costs the whole download.

   Verified against production rather than assumed: wingman.institute advertises
   `Accept-Ranges: bytes` and answers a ranged GET with `206 Partial Content`
   and a correct `Content-Range`, through Vercel's edge cache, unbuffered. See
   docs/reader/DISCOVERY.md §2.

   The other half of that condition — the file being linearized — is NOT met by
   anything currently in the repo, and cannot be fixed in the browser. An
   unlinearized file still range-loads; it just has to fetch the trailer first
   to find the cross-reference table. `npm run paper:linearize` does it properly
   before upload when qpdf is installed, and the manifest records which state a
   paper is in so the reader can say so rather than guess. */
export const RANGE_CHUNK = 65536;

/* -----------------------------------------------------------------------------
   WHY WE DO THE RANGING OURSELVES ON STORAGE URLS.

   pdf.js decides whether a URL supports ranges by READING the response
   headers — `Accept-Ranges` on the first request, `Content-Range` on the
   probe. Neither of those is a CORS-safelisted response header, so on a
   cross-origin fetch the browser hides them unless the server sends
   `Access-Control-Expose-Headers`.

   Supabase Storage does not send it. Measured, not assumed: a ranged GET to
   the bucket returns `206 Partial Content` with a correct `Content-Range` —
   the server is doing everything right — and from a browser the header is
   simply absent. pdf.js therefore concluded ranges were unsupported and pulled
   the whole file: a real 44MB, 1012-page manual took 27 seconds to show page
   one, having downloaded all of it.

   The transport below sidesteps the detection entirely. We do not need to READ
   `Content-Range` to know ranging works — we already know, and the body of a
   206 is readable cross-origin regardless. So we fetch the ranges ourselves and
   hand pdf.js the bytes. The length comes from a HEAD, because `Content-Length`
   IS safelisted, with the manifest's byte count as a fallback.

   Same-origin files (the repo's own /papers/*.pdf) keep pdf.js's built-in
   path, which works and is better tested than anything here.
   -------------------------------------------------------------------------- */
const sameOrigin = (url) => {
  try { return new URL(url, location.href).origin === location.origin; }
  catch { return true; }
};

async function byteLength(url, hint) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    const n = Number(head.headers.get("content-length"));
    if (Number.isFinite(n) && n > 0) return n;
  } catch { /* fall through to the hint */ }
  return hint || 0;
}

function rangeTransport(url, length) {
  const T = pdfjs.PDFDataRangeTransport;
  const t = new T(length, new Uint8Array(0), false);
  /* One flight of fetches at a time per range, and every one abortable — a
     flung scrollbar must not leave fifty requests in the air. */
  const inflight = new Map();
  t.requestDataRange = (begin, end) => {
    const key = `${begin}-${end}`;
    if (inflight.has(key)) return;
    const ctrl = new AbortController();
    inflight.set(key, ctrl);
    fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal: ctrl.signal })
      .then((r) => r.arrayBuffer())
      .then((buf) => { inflight.delete(key); t.onDataRange(begin, new Uint8Array(buf)); })
      .catch(() => { inflight.delete(key); });
  };
  t.abort = () => {
    for (const c of inflight.values()) c.abort();
    inflight.clear();
  };
  return t;
}

export function loadPaper(url, hintBytes) {
  if (!docs.has(url)) {
    const promise = (async () => {
      const common = { isEvalSupported: false, disableAutoFetch: true, rangeChunkSize: RANGE_CHUNK };
      if (sameOrigin(url)) {
        return pdfjs.getDocument({ url, disableStream: false, ...common }).promise;
      }
      const length = await byteLength(url, hintBytes);
      if (!length) {
        // Nothing to range against; fall back to the ordinary path rather than
        // failing, so a paper always opens even if slowly.
        return pdfjs.getDocument({ url, disableStream: false, ...common }).promise;
      }
      return pdfjs.getDocument({ range: rangeTransport(url, length), ...common }).promise;
    })();
    docs.set(url, promise.catch((e) => { docs.delete(url); throw e; }));
  }
  return docs.get(url);
}

/* -----------------------------------------------------------------------------
   Extraction

   Item strings are joined with nothing between them — pdf.js already puts the
   spaces in — and a newline goes in wherever it says a line ended. That is what
   makes a wrapped line look like a wrapped line to normalise(), which is what
   lets it de-hyphenate across the break.
   -------------------------------------------------------------------------- */
const extracted = new Map();

export async function paperText(url) {
  if (extracted.has(url)) return extracted.get(url);
  const promise = (async () => {
    const doc = await loadPaper(url);
    const items = [];
    const pageStart = [];
    let text = "";

    for (let n = 1; n <= doc.numPages; n++) {
      if (n > 1) text += "\n\n";
      pageStart.push(text.length);
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      content.items.forEach((it, index) => {
        if (typeof it.str !== "string") return;      // a marked-content span
        const start = text.length;
        text += it.str;
        items.push({ page: n, index, start, end: text.length, str: it.str });
        if (it.hasEOL) text += "\n";
      });
    }
    return { text, items, pageStart, pages: doc.numPages };
  })();
  extracted.set(url, promise);
  return promise;
}

/* Let go of a document when its reader closes. Without this every paper opened
   in a session stays parsed in memory for the life of the tab, which on a
   tablet is the difference between a long revision session and a reload. */
export function releasePaper(url) {
  const held = docs.get(url);
  if (!held) return;
  docs.delete(url);
  extracted.delete(url);
  held.then((d) => d.destroy?.()).catch(() => {});
}

/* -----------------------------------------------------------------------------
   Offsets both ways
   -------------------------------------------------------------------------- */

/* Where in docText does this item's character sit? */
export function offsetOf(model, page, itemIndex, charOffset = 0) {
  const it = model.items.find((x) => x.page === page && x.index === itemIndex);
  if (!it) return null;
  return it.start + Math.min(charOffset, it.str.length);
}

/* Every item a docText range touches, with the slice of each one it covers.
   This is what a highlight is drawn from: one rectangle per run, never one
   rectangle per annotation, so a selection crossing four runs draws four
   pieces that line up with the words instead of one box over the paragraph. */
export function itemsInRange(model, start, end) {
  const out = [];
  for (const it of model.items) {
    if (it.end <= start) continue;
    if (it.start >= end) break;
    const from = Math.max(0, start - it.start);
    const to = Math.min(it.str.length, end - it.start);
    if (to > from) out.push({ ...it, from, to });
  }
  return out;
}

/* Which page is this offset on? Used to jump to a mark. */
export function pageOf(model, offset) {
  let page = 1;
  for (let i = 0; i < model.pageStart.length; i++) {
    if (model.pageStart[i] <= offset) page = i + 1; else break;
  }
  return page;
}

/* The words themselves, for a quote in a list or a thread opener. */
export const quoteOf = (model, start, end, max = 220) => {
  const raw = model.text.slice(start, end).replace(/\s+/g, " ").trim();
  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
};
