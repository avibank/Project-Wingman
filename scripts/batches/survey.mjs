import { linesOf } from "./lines.mjs";
const near = (a, b) => Math.abs(a - b) <= 0.2;
const IN = process.argv[2];
console.log("batch kind  ref      pages        stems  opts  keys  topics  name");
for (let b = 1; b <= 10; b++) {
  for (const k of ["quiz", "set"]) {
    const L = await linesOf(`${IN}/b${String(b).padStart(2,"0")}-${k}.pdf`);
    const body = L.filter((l) => l.x < 200);
    const title = body.find((l) => near(l.h, 20))?.text || "";
    const sub = body.find((l) => near(l.h, 11))?.text || "";
    const m = /^(M13\.[0-9.]+)\s+(.*?)\s+·\s+PDF pages\s+([0-9]+)[–-]([0-9]+)/.exec(sub) || [];
    const stems = body.filter((l) => near(l.h, 10.5) && near(l.x, 60) && /^\d+\.\s/.test(l.text)).length;
    const opts = body.filter((l) => near(l.h, 10.5) && near(l.x, 82) && /^[abc]\.\s/.test(l.text)).length;
    const keys = body.filter((l) => near(l.h, 9) && near(l.x, 60) && /^\d+\.\s+[abc]\s/.test(l.text)).length;
    const tops = body.filter((l) => near(l.h, 15) && !/^Answers$/i.test(l.text)).length;
    console.log(`  ${String(b).padStart(2)}  ${k.padEnd(5)} ${(m[1]||"?").padEnd(8)} ${((m[3]||"?")+"-"+(m[4]||"?")).padEnd(12)} ${String(stems).padStart(4)} ${String(opts).padStart(5)} ${String(keys).padStart(5)} ${String(tops).padStart(6)}   ${(m[2]||title).slice(0,40)}`);
  }
}
