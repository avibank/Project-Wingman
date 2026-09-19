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

/* STYLESHEETS, AND THE <style> BLOCKS INSIDE COMPONENTS — which is where the
   gap was. This walked .css only, and about a third of this app's CSS is
   written inside JSX template literals: App.jsx's global sheet, the profile's,
   the old chapter quiz's. --mono-0, --mono-400, --mono-500, --mono-700 and
   --mono-900 lived in one of those, had never been defined anywhere, and
   carried no fallback — so the correct answer in that quiz had no background,
   no border and no glow, and nothing could see it. A file this check skips is
   a file the rule does not apply to. */
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".css") || p.endsWith(".jsx")) files.push(p);
  }
})("src");
/* A .jsx file's CSS is whatever sits inside a <style> block. Reading the whole
   file would take every var() in the markup as well, which is legitimate —
   an inline style may use any property — but those are already checked by
   being in the same document. This looks only where a stylesheet is. */
const cssOf = (f) => {
  const text = readFileSync(f, "utf8");
  if (!f.endsWith(".jsx")) return text;
  return [...text.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]).join("\n");
};

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
  const css = cssOf(f);
  for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    declared.add(m[1]);
    if (!source.has(m[1])) source.set(m[1], f);
  }
}

// And everything the SCRIPTS set. A custom property is as validly declared
// from `style="--pk:#F5C23C"` or `el.style.setProperty("--lv", ...)` as it is
// from a stylesheet, and the reader's chrome sets several that way — the
// swatch colours, the livery accent, the paper's white point. Left out, this
// check reads every one of them as undeclared and says so five times.
(function walkJs(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkJs(p);
    else if (/\.(jsx?|mjs)$/.test(p)) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/setProperty\(\s*["'`](--[a-zA-Z0-9-]+)/g)) {
        declared.add(m[1]);
        if (!source.has(m[1])) source.set(m[1], p);
      }
      /* Inline styles, in a template literal or a JSX string. */
      for (const m of src.matchAll(/style=["'`][^"'`]*?(--[a-zA-Z0-9-]+)\s*:/g)) {
        declared.add(m[1]);
        if (!source.has(m[1])) source.set(m[1], p);
      }
      /* AND IN A JSX STYLE OBJECT, which is how React takes one: the name has
         to be quoted there, so it reads `style={{ "--i": k }}` rather than the
         attribute string above. This was a blind spot until the exam screen
         set a row's index that way and the check called a property the
         component sets on every row undeclared. */
      for (const m of src.matchAll(/["'`](--[a-zA-Z0-9-]+)["'`]\s*:/g)) {
        declared.add(m[1]);
        if (!source.has(m[1])) source.set(m[1], p);
      }
    }
  }
})("src");

// Everything they USE, minus anything that carries its own fallback — a
// var(--x, something) is a deliberate "if this is missing, use that".
const fails = [];
let uses = 0;
for (const f of files) {
  const css = cssOf(f);
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
