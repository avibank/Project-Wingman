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

export function loadPaper(url) {
  if (!docs.has(url)) {
    const task = pdfjs.getDocument({ url, isEvalSupported: false });
    docs.set(url, task.promise.catch((e) => { docs.delete(url); throw e; }));
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
