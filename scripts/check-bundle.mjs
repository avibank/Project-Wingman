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
/* 680 on the day it was set, when the entry measured 645.

   IT HAS MOVED TWICE AND THE TWO ARE NOT THE SAME MOVE. On 2026-10-04 it went
   to 684 for two pattern finishes and came back to 680 the next day when they
   were killed — a budget left raised for something that no longer exists is a
   gate quietly loosened, which is how the note above says budgets die. On
   2026-10-06 it went to 684 again for the Reports screen and the composer
   behind the "Something's wrong here" pill, and that one STAYS: an admin
   surface that reads what students send is not going away, and the budget's
   own rule is that it sits at what the build achieves rather than at an
   aspiration. The composer itself is NOT in here — it is lazy, because it is
   only ever needed after a press (src/components/ReportAsk.jsx).

   THE 4KB TO TAKE BEFORE RAISING THIS AGAIN, still unclaimed: the `AUR` spec
   table in finishEngine.js — six liveries of curtain specs with their prose —
   is in the entry on every first paint for a finish that is NOT OFFERED.
   Nothing calls `auroraLayers`, `starfield`, `horizon` or `STAR_TILE` any
   more (grepped); only `finishVars`'s aurora branch holds the table in.
   Moving both to a lazily imported module is worth about 4KB — but it is not
   free, and that is why it has not been done in passing: CLAUDE.md states
   that aurora still resolves while unoffered, which is what keeps `?finish=`
   and the harness honest, and what check:contrast, check:surfaces and test:bm
   measure. Doing it means giving those a path to the moved table, and that
   deserves its own change rather than a line in somebody else's. */
const BUDGET = 684 * 1024;      // entry chunk

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
