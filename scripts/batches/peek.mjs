import { linesOf } from "./lines.mjs";
const [f, pat, n] = [process.argv[2], process.argv[3], Number(process.argv[4] || 14)];
const L = await linesOf(f);
const i = L.findIndex((l) => new RegExp(pat, "i").test(l.text));
if (i < 0) { console.log(`no line matching /${pat}/`); process.exit(0); }
for (const l of L.slice(Math.max(0, i - 2), i + n)) {
  console.log(`  p${String(l.page).padStart(2)} x=${String(l.x).padStart(5)} h=${String(l.h).padStart(4)}  ${l.text.slice(0, 86)}`);
}
