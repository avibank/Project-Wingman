import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const tally = new Map();
const odd = [];
for (let k = 1; k <= 5; k++) {
  const f = `${process.env.HOME}/Downloads/M13D Mock Exam ${k}.pdf`;
  const doc = await getDocument({ data: new Uint8Array(readFileSync(f)), useSystemFonts: true }).promise;
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const lines = new Map();
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] * 2) / 2;
      if (!lines.has(y)) lines.set(y, { x: it.transform[4], h: Math.abs(it.transform[0]) || it.height, s: "" });
      lines.get(y).s += it.str;
    }
    for (const l of lines.values()) {
      if (!l.s.trim()) continue;
      const key = `x=${Math.round(l.x)} h=${l.h.toFixed(1)}`;
      if (!tally.has(key)) tally.set(key, { n: 0, eg: l.s.trim().slice(0, 60) });
      tally.get(key).n++;
    }
  }
}
console.log("x / height census across all five files:");
for (const [k, v] of [...tally.entries()].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(5)}   ${v.eg}`);
