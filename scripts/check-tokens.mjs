// Every var(--token) the stylesheets reach for must actually exist.
//
// This is the failure the contrast matrix cannot see. That matrix measures
// tokens it is GIVEN; it never learns that a stylesheet asked for one nobody
// emits. An undefined custom property does not error — it falls back to the
// initial value, so text goes black, a fill goes transparent, and a border
// disappears. In Night, black text on a dark panel is invisible, and the page
// looks like it simply has no border there rather than like a bug.
//
// It cost a real diagnosis once: --ok and --bad were defined in quiz.css, which
// only loads with the quiz, so on the module screen the ammeter's good arc fell
// back to the accent and read as correct.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { deckVars, LIVERIES } from "../src/lib/liveryEngine.js";
import { finishVars } from "../src/lib/finishEngine.js";

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".css")) files.push(p);
  }
})("src");

// Everything the engines emit, in every livery x variant x finish.
const emitted = new Set();
for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    const base = deckVars(L.id, variant).vars;
    for (const k of Object.keys(base)) emitted.add(k);
    for (const finish of [null, "aurora", "manual"]) {
      for (const k of Object.keys(finishVars(L.id, variant, finish, base["--active"]))) emitted.add(k);
    }
  }
}

// Everything the stylesheets declare themselves, anywhere. A property declared
// in one file and used in another is fine at runtime as long as both load, and
// the cascade does not care which file it came from.
const declared = new Set();
const source = new Map();
for (const f of files) {
  const css = readFileSync(f, "utf8");
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    declared.add(m[1]);
    if (!source.has(m[1])) source.set(m[1], f);
  }
}

// Everything they USE, minus anything that carries its own fallback — a
// var(--x, something) is a deliberate "if this is missing, use that".
const fails = [];
let uses = 0;
for (const f of files) {
  const css = readFileSync(f, "utf8");
  for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*([,)])/g)) {
    const [, token, close] = m;
    if (close === ",") continue;                    // has a fallback
    uses++;
    if (emitted.has(token) || declared.has(token)) continue;
    const line = css.slice(0, m.index).split("\n").length;
    fails.push(`${f}:${line} uses ${token}, which nothing declares or emits`);
  }
}

console.log(`tokens: ${uses} unconditional var() uses across ${files.length} stylesheets`);
console.log(`        checked against ${emitted.size} emitted by the livery and finish engines`);
console.log(`        plus ${declared.size} declared in CSS`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `TOKENS: ${fails.length} undefined` : "MATCH");
if (fails.length) process.exitCode = 1;
