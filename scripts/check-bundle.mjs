// A size budget, set at what the build currently achieves rather than at an
// aspiration. A budget you are already failing gets disabled inside a week.
//
// The number that matters is the ENTRY chunk: what someone downloads before
// they can see the Flight Deck. Lazily-loaded routes are counted separately
// and deliberately not budgeted — splitting more of them should not be able
// to fail this check, or the check argues against the thing it is for.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";
const BUDGET = 680 * 1024;      // entry chunk. Measured at 645KB on the day it was set.

let files;
try { files = readdirSync(DIST); }
catch { console.log("bundle: no dist/ — run `npm run build` first"); process.exit(0); }

const js = files.filter((f) => f.endsWith(".js") && !f.endsWith(".map"));
const entryName = js.find((f) => /^index-/.test(f));
if (!entryName) { console.log("bundle: no entry chunk found"); process.exit(1); }

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
