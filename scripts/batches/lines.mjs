/* Pull every line out of a PDF with its x and its height, using the repo's
   own PINNED pdf.js — a minor version changes how text runs are split, which
   is why paperText.js pins it exactly. Lines, not runs: a run is a fragment,
   and the geometry this classifies by belongs to the line. */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

export async function linesOf(path) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)),
    useSystemFonts: false, isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map();                       // y -> runs
    for (const it of tc.items) {
      if (!it.str) continue;
      const x = it.transform[4], y = Math.round(it.transform[5] * 2) / 2;
      const h = Math.abs(it.transform[3]) || it.height || 0;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x, h, s: it.str });
    }
    for (const [y, runs] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      runs.sort((a, b) => a.x - b.x);
      const text = runs.map((r) => r.s).join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      out.push({ page: p, y, x: Math.round(runs[0].x * 10) / 10,
                 h: Math.round(Math.max(...runs.map((r) => r.h)) * 10) / 10, text });
    }
  }
  await doc.destroy();
  return out;
}
