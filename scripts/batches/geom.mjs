import { linesOf } from "./lines.mjs";
const f = process.argv[2];
const L = await linesOf(f);
const key = (l) => `x=${Math.round(l.x)} h=${l.h}`;
const tally = new Map();
for (const l of L) tally.set(key(l), (tally.get(key(l)) || 0) + 1);
console.log(`${f.split("/").pop()}: ${L.length} lines`);
console.log("  commonest x/h shapes:");
for (const [k, n] of [...tally.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 12)) {
  const ex = L.find((l) => key(l) === k);
  console.log(`    ${String(n).padStart(5)}  ${k.padEnd(16)} ${ex.text.slice(0, 64)}`);
}
