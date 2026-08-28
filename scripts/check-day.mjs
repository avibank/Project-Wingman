// Day answers to design/wingman-day-source.js — and this check reads that FILE,
// as text, rather than re-deriving the expectation from the same constants it
// is checking.
//
// That distinction is the whole point of this script. check:livery already had
// a Day assertion, and it passed while five alpha values were missing from the
// port: it built `expect` out of DAY and dayGround, the very things that were
// wrong, so both sides agreed and the drift was invisible. A check whose
// expectation comes from the thing under test cannot fail.
//
// The Day panel sits at 78% over each livery's own stock. Dropped to opaque,
// the paper stops showing through and every livery's measured contrast becomes
// the same number instead of a range across the six. That is what was live.
import { readFileSync } from "node:fs";
import { DAY, STOCK, DAY_DROP, DAY_SHEEN, dayGround, dayKey, dayFill } from "../src/lib/liveryEngine.js";

const SRC = readFileSync(new URL("../design/wingman-day-source.js", import.meta.url), "utf8");
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const fails = [];
let checked = 0;

function eq(name, got, want) {
  checked++;
  if (norm(got) !== norm(want)) fails.push(`${name}\n    want ${want}\n    got  ${got}`);
}

// ---- the token block, read out of the source file itself
const block = SRC.match(/const DAY = \{([\s\S]*?)\};/)[1];
for (const key of ["g", "p", "rz", "l", "t3", "t2", "t1"]) {
  const m = block.match(new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`));
  if (!m) { fails.push(`DAY.${key} not found in the source`); continue; }
  eq(`DAY.${key}`, DAY[key], m[1]);
}

// ---- stock, per livery
const stockBlock = SRC.match(/const STOCK = \{([\s\S]*?)\};/)[1];
for (const [, id, chroma, hue] of stockBlock.matchAll(/(\w+)\s*:\s*\['([^']+)',\s*(\d+)\]/g)) {
  eq(`STOCK.${id}`, (STOCK[id] || []).join(" "), `${chroma} ${hue}`);
}

// ---- the deep ground, including the alphas that went missing
const gm = SRC.match(/g\s*:\s*`([^`]*)`,\s*\n\s*rz\s*:\s*`([^`]*)`,\s*\n\s*l\s*:\s*`([^`]*)`/);
for (const id of Object.keys(STOCK)) {
  const [chroma, hue] = STOCK[id];
  const sub = (t) => t.replace("${chroma}", chroma).replace(/\$\{hue\}/g, hue);
  const G = dayGround(id);
  eq(`dayGround(${id}).g`, G.g, sub(gm[1]));
  eq(`dayGround(${id}).rz`, G.rz, sub(gm[2]));
  eq(`dayGround(${id}).l`, G.l, sub(gm[3]));
}

// ---- the long strings, with the source's own line-joining removed
// The source joins its long strings across lines with + , using single quotes
// in some places and backticks in others. Strip the quotes and the joins, then
// collapse whitespace, so what is compared is the value and not the layout.
const lit = (re) => SRC.match(re)[1]
  .replace(/[`']\s*\+\s*[`']/g, "")
  .replace(/[`']/g, "")
  .replace(/\s+/g, " ")
  .trim();
eq("DAY_DROP", DAY_DROP, lit(/const DAY_DROP =\s*([\s\S]*?);\n/));
eq("DAY_SHEEN", DAY_SHEEN, lit(/const DAY_SHEEN =\s*([\s\S]*?);\n/));
eq("dayKey()", dayKey(), lit(/const dayKey = \(\) =>\s*([\s\S]*?);\n/));

// ---- dayFill is a function of the livery's key hue and chroma; check its shape
const fillSrc = SRC.match(/const dayFill = \(h, c\) =>\s*([\s\S]*?);\n/)[1];
for (const mul of ["1.30", "1.05", "0.70", "0.50"]) {
  checked++;
  if (!fillSrc.includes(`c*${mul}`) && !fillSrc.includes(`c * ${mul}`)) fails.push(`dayFill source lost the ${mul} multiplier`);
  else if (!dayFill(200, 0.1).length) fails.push("dayFill produced nothing");
}

console.log(`day:    ${checked} values asserted against design/wingman-day-source.js`);
for (const f of fails) console.log("  " + f);
console.log(fails.length ? `DAY SOURCE DRIFT: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
