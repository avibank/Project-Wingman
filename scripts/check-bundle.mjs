// A size budget, set at what the build currently achieves rather than at an
// aspiration. A budget you are already failing gets disabled inside a week.
//
// The number that matters is the ENTRY chunk: what someone downloads before
// they can see the Flight Deck. Lazily-loaded routes are counted separately
// and deliberately not budgeted — splitting more of them should not be able
// to fail this check, or the check argues against the thing it is for.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";
const HTML = "dist/index.html";
const BUDGET = 680 * 1024;      // entry chunk. Measured at 645KB on the day it was set.

let files;
try { files = readdirSync(DIST); }
catch { console.log("bundle: no dist/ — run `npm run build` first"); process.exit(0); }

const js = files.filter((f) => f.endsWith(".js") && !f.endsWith(".map"));

/* THE ENTRY IS WHAT THE PAGE ASKS FOR, not what a filename looks like. This
   used to be `js.find(/^index-/)`, and on 2026-09-23 a second chunk came out
   named `index-*` (a lazily-imported module whose own file is an index.js).
   readdir handed back the 59KB one first, so the check reported a 58KB entry
   against a 680KB budget and passed — while the real entry, the 676KB file
   dist/index.html actually loads, went unmeasured. A gate that can pass by
   accident is worse than no gate, so the name of the entry now comes from
   the HTML that names it. */
const html = (() => { try { return readFileSync(HTML, "utf8"); } catch { return ""; } })();
const named = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
if (!html) { console.log(`bundle: ${HTML} is missing — run \`npm run build\` first`); process.exit(1); }
if (named.length !== 1) {
  console.log(`bundle: ${HTML} names ${named.length} entry scripts (${named.join(", ") || "none"}); expected exactly one`);
  process.exit(1);
}
const entryName = named[0];
if (!js.includes(entryName)) { console.log(`bundle: ${entryName} is named by the HTML but not in ${DIST}`); process.exit(1); }

const size = (f) => statSync(join(DIST, f)).size;
const entry = size(entryName);
const lazy = js.filter((f) => f !== entryName);
const lazyTotal = lazy.reduce((n, f) => n + size(f), 0);

const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(`bundle: entry ${kb(entry)} against a ${kb(BUDGET)} budget`);
console.log(`        ${lazy.length} split chunks, ${kb(lazyTotal)} in total, none of it on first paint`);

// Name the three biggest split chunks — the next thing worth splitting is
// usually already visible here.
const top = lazy.map((f) => [f, size(f)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
for (const [f, n] of top) console.log(`        largest: ${f.replace(/-[A-Za-z0-9_]+\.js$/, "")} ${kb(n)}`);

if (entry > BUDGET) {
  console.log(`OVER BUDGET by ${kb(entry - BUDGET)} — split a route or raise the number deliberately`);
  process.exitCode = 1;
} else {
  console.log("MATCH");
}
