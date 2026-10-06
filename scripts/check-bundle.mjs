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

   IT HAS MOVED THREE TIMES AND IS BACK WHERE IT STARTED. 684 on 2026-10-04
   for two pattern finishes; 680 the next day when they were killed, because a
   budget left raised for something that is gone is a gate quietly loosened;
   684 again on 2026-10-06 for the Reports screen. And 680 again the same day,
   because the 4KB this comment had been naming for two days was finally
   taken: `AUR`'s spec table and every aurora renderer moved to
   `src/lib/auroraFinish.js` and are passed INTO `finishVars`, so a finish
   that is not offered no longer rides every first paint. The module-screen
   port went in under the old number as a result.

   AND THEN 41KB CAME BACK AT ONCE (2026-10-06). App.jsx carried
   `import { MODULE_TABS } from "./components/module/ModuleScreen.jsx"` beside
   its own `chunk(() => import(...))` of the same file, and never used the
   import — the only other mention of MODULE_TABS in App.jsx is a comment. A
   static import wins: Rollup put ModuleScreen and everything it reaches
   (LibraryTab, CrewTab, LogTab, Instruments) in the ENTRY and left the lazy
   chunk as a re-export, so a screen nobody has opened was on every first
   paint. Removing one line moved 41KB out and gave the module screen the
   36KB chunk it was always supposed to have. The entry went 680 -> 639KB.

   The budget stays at 680 rather than dropping to what the build now
   achieves, and that is a judgement rather than laziness: this find is the
   headroom the next two screens will be ported into, and a budget re-cut to
   the day's number every time something is saved never buys anything. It is
   a ceiling, and 41KB under it is where this should sit.

   WHAT TO SPEND BEFORE RAISING THIS AGAIN: 41KB of headroom, measured. The
   next candidate after that is the same shape as the last one — find
   something in the entry that only one screen needs, and lazily import it
   there. The pattern finishes, the report composer and the ported Library
   all went that way. */
const BUDGET = 680 * 1024;      // entry chunk

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

/* A LAZY ROUTE THAT IS ALSO IMPORTED STATICALLY IS NOT LAZY, and nothing said
   so. App.jsx declares every screen as `chunk(() => import(path))`; a plain
   `import ... from path` for the same file anywhere in App.jsx puts the whole
   module back in the entry and leaves the dynamic chunk as a re-export. The
   build does not warn, the chunk still appears in the listing at a plausible
   size, and the only symptom is the entry being tens of kilobytes bigger than
   anybody expected — which is exactly how ModuleScreen rode first paint for
   as long as it did. The size budget alone could not catch it: it was inside
   the number all along.

   This reads App.jsx rather than the build, because the pairing is the thing
   that is wrong and the source is where it is legible. A screen that really
   does need to export a constant can: move the constant to a module of its
   own (`lib/routes.js` already holds CHAPTER_TABS and PROFILE_TABS). */
const APP = "src/App.jsx";
const app = (() => { try { return readFileSync(APP, "utf8"); } catch { return ""; } })();
const dyn = new Set([...app.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
const stat = new Set([...app.matchAll(/^\s*import\s[^;]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]));
const both = [...dyn].filter((p) => stat.has(p));
if (both.length) {
  console.log(`BOTH LAZY AND EAGER in ${APP} — these ride first paint anyway:`);
  for (const p of both) console.log(`        ${p}`);
  process.exitCode = 1;
} else {
  console.log(`        ${dyn.size} route chunks, none of them also imported statically`);
}

if (entry > BUDGET) {
  console.log(`OVER BUDGET by ${kb(entry - BUDGET)} — split a route or raise the number deliberately`);
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log("MATCH");
}
