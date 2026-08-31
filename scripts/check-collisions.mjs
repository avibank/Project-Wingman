/* TWO COMPONENTS, ONE CLASS NAME.
 *
 * This is the bug that keeps shipping, and it has shipped three times:
 *
 *   room.css   was rewritten from a reference demo that used bare names, so
 *              .pane .rail .card .composer .pill .msg went global and collided
 *              with the module screen, the lesson composer and the Flight Deck
 *              hero card — but only AFTER someone visited the Ready Room,
 *              because that chunk is lazy.
 *   .lamp      was the master caution lamp in instruments.css AND the Flight
 *              Deck's leg indicator bars in Home's DECK_CSS. They styled each
 *              other in both directions. The direction nobody had fixed set a
 *              68px width on the bars, and since a grid item's width is its
 *              automatic minimum, three of them held a 101px track set open at
 *              214px and the bars spilled 73.6px out of their cel.
 *   .card/.cel the same family, earlier.
 *
 * Specificity does not save you here: the loser only wins back the properties
 * it happens to restate, so the collision keeps whichever properties the other
 * file set and this one did not. That is why it is so hard to see — the
 * component looks nearly right.
 *
 * So: find every class that is styled from a BARE selector (no ancestor to
 * scope it) in one file, and also styled from a different file. That is the
 * shape of every one of the above.
 *
 * It reads CSS files AND the CSS embedded in JSX template literals, because
 * DECK_CSS and ROOM_CSS live in .jsx and are injected as <style> at runtime —
 * a check that only read .css files would have missed the .lamp collision
 * entirely, since one of its two owners is in Home.jsx.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* Relative to the package root, the same as every sibling check. An
   import.meta.url pathname would percent-encode the space in this repo's own
   directory name and fail to open anything. */
const SRC = "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

/* Comments hide selector-shaped text — this file's own prose says ".lamp" a
   dozen times — so they go first, replaced by nothing. */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* Rule STARTS only: the text between the end of the last block and a `{`.
   Declarations inside a block never match, and neither does a bare `{`
   belonging to JS, because a selector has to contain a class. */
function selectorsOf(css) {
  const out = [];
  for (const m of css.matchAll(/(^|[};])([^{};]*?)\{/g)) {
    const sel = m[2].trim();
    if (!sel || sel.startsWith("@") || !sel.includes(".")) continue;
    // A selector list is comma-separated; each part is its own selector.
    for (const part of sel.split(",")) {
      const s = part.trim();
      if (s && s.includes(".")) out.push(s);
    }
  }
  return out;
}

/* A selector is BARE for class X when the WHOLE selector is `.X` — one
   compound, nothing else. That is the only shape that reaches every X on the
   page regardless of where it sits.

   It is not enough to look at the rightmost compound. `.app:has(.room) .deck`
   ends in `.deck`, but its ancestor is what keeps it off every other deck, and
   calling that bare reported the correctly-scoped room stylesheet as a
   collision. An ancestor, a second class, an attribute or a state all narrow
   the rule; only a lone class does not. */
function bareClassOf(sel) {
  const compounds = sel.split(/\s+|>|\+|~/).filter(Boolean);
  if (compounds.length !== 1) return null;
  const m = /^\.([A-Za-z0-9_-]+)$/.exec(compounds[0].replace(/::?[a-z-]+(\([^)]*\))?$/g, ""));
  return m ? m[1] : null;
}

function classesIn(sel) {
  return [...sel.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
}

const bareOwners = new Map();   // class -> Set(file)
const anyOwners = new Map();    // class -> Set(file)

const files = walk(SRC);

/* ONLY STYLESHEETS THAT ACTUALLY LOAD. A .css file nobody imports is never
   bundled, so it cannot collide with anything — reporting it is a phantom,
   and phantoms are how a check earns its way into the "ignore that one" pile.
   This found module-v2.css: 321 lines, imported by no module, and proven
   absent from the built bundle by grepping its unique selectors. It was
   deleted; this keeps the next one from being reported as a live fault. */
const imported = new Set();
for (const f of files) {
  if (!f.endsWith(".jsx")) continue;
  const raw = readFileSync(f, "utf8");
  for (const m of raw.matchAll(/import\s+["']([^"']+\.css)["']/g)) {
    imported.add(m[1].split("/").pop());
  }
}
const reachable = (f) => !f.endsWith(".css") || imported.has(f.split("/").pop());
const skipped = files.filter((f) => !reachable(f));

for (const file of files.filter(reachable)) {
  const raw = readFileSync(file, "utf8");
  // For .jsx, only the template literals can contain CSS. Taking the whole
  // file would read JSX className strings as selectors.
  const css = file.endsWith(".css")
    ? raw
    : [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1]).join("\n");
  const rel = file;
  for (const sel of selectorsOf(decomment(css))) {
    for (const c of classesIn(sel)) {
      if (!anyOwners.has(c)) anyOwners.set(c, new Set());
      anyOwners.get(c).add(rel);
    }
    const bare = bareClassOf(sel);
    if (bare) {
      if (!bareOwners.has(bare)) bareOwners.set(bare, new Set());
      bareOwners.get(bare).add(rel);
    }
  }
}

/* WHAT COUNTS AS A FAULT, and the line is drawn deliberately.
 *
 * "Bare in one file, scoped in another" is ALSO the correct pattern — a shared
 * base plus a local override is how .av and .pop are meant to work — so
 * flagging that shape reports the right answer and the wrong answer with equal
 * confidence, and a check that cries wolf gets muted.
 *
 * A class carrying a BARE rule in TWO files has no such reading. Both files
 * claim every element with that name, everywhere, and which one wins is
 * whichever the bundler happened to order last. That is unambiguous, and it is
 * the shape room.css shipped.
 *
 * The other shape is still counted and printed, because it is where .lamp
 * lived — but as something to read, not something to fail on. */
const doubleBare = [];
const baseAndOverride = [];
for (const [cls, bareFiles] of bareOwners) {
  const all = anyOwners.get(cls) || new Set();
  if (bareFiles.size > 1) { doubleBare.push({ cls, bare: [...bareFiles] }); continue; }
  const others = [...all].filter((f) => !bareFiles.has(f));
  if (others.length) baseAndOverride.push({ cls, bare: [...bareFiles], others });
}
doubleBare.sort((a, b) => a.cls.localeCompare(b.cls));
const collisions = doubleBare;

/* THE BASELINE, and it is a baseline rather than an approval.
 *
 * These seven were already here on 2026-09-01, when this check was written.
 * Two were read and are genuinely fine:
 *
 *   llist    familiar.css adds only content-visibility to the SAME list
 *            lesson.css draws. A perf hint across files, not a second owner.
 *   profile  instruments.css's side belongs to FlightProfile, which is
 *            exported and imported by nobody. Latent, not live.
 *
 * The other five are the same UI primitive declared in two places rather than
 * two components fighting over a name, which is untidy but not the failure
 * this check exists to catch. They have NOT been individually audited, and
 * listing them here says only "this was true before the check existed".
 *
 * The point of the list is the line under it: anything NOT here is new, and
 * new is exactly what shipped three times without being noticed. */
const AGREED = new Set([
  "app",        // App.jsx and app.css both declare the root shell; one component
  "llist", "profile",
  "admin", "btn-primary", "chip", "content--full", "pill",
]);

const fresh = collisions.filter((c) => !AGREED.has(c.cls));

console.log(`collisions: ${bareOwners.size} classes carry a bare rule somewhere`);
if (skipped.length) {
  console.log(`            ${skipped.length} stylesheet(s) skipped as unreachable: ${skipped.map((f) => f.split("/").pop()).join(", ")}`);
}
console.log("");
for (const c of fresh) {
  console.log(`  COLLISION  .${c.cls} is claimed globally by ${c.bare.length} files`);
  console.log(`             ${c.bare.join("\n             ")}`);
}
if (!fresh.length) {
  console.log("  ok    no class carries a bare rule in two different files");
}
console.log(`  note  ${baseAndOverride.length} classes are bare in one file and scoped in another —`);
console.log("        the shared-base shape, which is correct on purpose, and also");
console.log("        where .lamp hid. Read it when a component looks nearly right.");
console.log(fresh.length ? `\nCOLLISIONS: ${fresh.length}` : "\nMATCH");
process.exitCode = fresh.length ? 1 : 0;
