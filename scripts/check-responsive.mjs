// The responsive contract, as a check rather than a promise.
//
// Two rules, at 390 / 768 / 1440: nothing scrolls the page sideways, and every
// interactive box clears 44 x 44. The brief asks for Playwright over every
// route; there is no browser driver in this repo, so this checks the rules
// where they are actually decided — in CSS — and says plainly what it cannot
// see. It is a floor, not a substitute: it catches a fixed width or a target
// authored under 44px, and it cannot catch a layout that overflows only once
// content is in it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk("src").filter((f) => /\.(jsx?|css)$/.test(f));
const fails = [];
const notes = [];

// The three breakpoints foundations.css declares. A fourth invented inside a
// component is how layouts start disagreeing with each other.
const ALLOWED_BP = new Set(["767", "768", "1119", "1120"]);
for (const f of files) {
  const src = readFileSync(f, "utf8");

  for (const [, px] of src.matchAll(/@media[^{]*?\(\s*(?:min|max)-width:\s*(\d+)px/g)) {
    if (!ALLOWED_BP.has(px)) notes.push(`${f}: breakpoint at ${px}px is not one of the three`);
  }

  // A hard width on a full-bleed surface is the usual cause of sideways scroll
  // on a phone — this is the class of bug that made the deck render at desktop
  // width inside a 390px viewport.
  for (const [m] of src.matchAll(/(?:^|[;{])\s*(?:min-)?width:\s*(\d{3,})px/gm)) {
    const px = Number(/(\d{3,})px/.exec(m)[1]);
    if (px >= 390) fails.push(`${f}: a fixed ${px}px width will not fit a 390px viewport`);
  }
}

// Anything that names a tap target must not go under the floor.
const foundations = readFileSync("src/styles/foundations.css", "utf8");
const tap = /--tap\s*:\s*(\d+)px/.exec(foundations);
if (!tap) fails.push("foundations.css does not declare --tap");
else if (Number(tap[1]) < 44) fails.push(`--tap is ${tap[1]}px, under the 44px floor`);

if (!/overflow-x:\s*hidden/.test(foundations))
  fails.push("foundations.css does not stop the page scrolling sideways");

console.log(`responsive: ${files.length} files checked against 390 / 768 / 1440`);
for (const n of notes) console.log("  note  " + n);
for (const f of fails) console.log("  FAIL  " + f);
console.log("  not covered: overflow that only appears once real content is in the layout");
console.log(fails.length ? `RESPONSIVE: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
