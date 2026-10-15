/* Read a laid-out PDF by GEOMETRY, never by prose (CLAUDE.md). Each line with
   its x and the height of its first run — that is what classifies it. */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const file = process.argv[2];
const doc = await getDocument({ data: new Uint8Array((await import("node:fs")).readFileSync(file)), useSystemFonts: true }).promise;
console.log(`${file.split("/").pop()}  —  ${doc.numPages} pages`);
const want = (process.argv[3] || "1-3").split("-").map(Number);
for (let p = want[0]; p <= (want[1] || want[0]); p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const lines = new Map();
  for (const it of tc.items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    if (!lines.has(y)) lines.set(y, { x: it.transform[4], h: Math.abs(it.transform[0]) || it.height, s: "" });
    lines.get(y).s += it.str;
  }
  console.log(`\n---------- page ${p} ----------`);
  for (const [y, l] of [...lines.entries()].sort((a, b) => b[0] - a[0])) {
    if (!l.s.trim()) continue;
    console.log(`x=${l.x.toFixed(0).padStart(3)} h=${l.h.toFixed(1).padStart(5)}  ${l.s.slice(0, 110)}`);
  }
}
