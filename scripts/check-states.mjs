// Loading, empty, error — the three states every route has to have an answer
// for. The brief calls this "the single test most likely to catch what
// actually turns people off", and it is right: none of the three is the happy
// path, and all three are what a student meets on a bad connection.
//
// There is no browser driver here, so this checks that the answers EXIST and
// are wired, rather than rendering each route three ways. It says so plainly
// rather than implying more coverage than it has.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const src = (f) => readFileSync(f, "utf8");
const all = walk("src").filter((f) => /\.jsx?$/.test(f));
const app = src("src/App.jsx");
const fails = [];

// 1 · Loading — a skeleton in the shape of the page, never a spinner on blank.
if (!/PageSkeleton/.test(app)) fails.push("no loading skeleton");
if (!/<Suspense/.test(app)) fails.push("nothing catches a route chunk still in flight");
if (!/aria-busy/.test(app)) fails.push("the loading state is not announced");

// 2 · Error — one boundary, and it must wrap the routed area rather than sit
//     beside it, or it catches nothing.
const boundary = all.find((f) => /RouteError\.jsx$/.test(f));
if (!boundary) fails.push("no error boundary exists");
else {
  const b = src(boundary);
  if (!/getDerivedStateFromError/.test(b)) fails.push("the boundary does not derive state from an error");
  if (!/componentDidCatch/.test(b)) fails.push("the boundary does not catch");
  if (!/role="alert"/.test(b)) fails.push("the error state is not announced");
  if (!/Try again|Reload/.test(b)) fails.push("the error state offers no way out");
}
if (!/<RouteError>/.test(app)) fails.push("the route boundary is never mounted");
else {
  const sus = app.indexOf("<Suspense"), eb = app.indexOf("<RouteError>");
  if (eb < sus) fails.push("the boundary sits outside Suspense, so a failed chunk escapes it");
}

// 2b · The top-level boundary must survive: it is the last resort, and it is
//      deliberately token-free so it works when the token layer is what broke.
if (!all.some((f) => /^src\/ErrorBoundary\.jsx$/.test(f))) fails.push("the top-level boundary is gone");
else if (!/main\.jsx/.test("main") && !/<ErrorBoundary>/.test(src("src/main.jsx"))) fails.push("the top-level boundary is not mounted in main.jsx");

// 3 · Empty — says what will fill it, never a bare count of nothing. The rule
//     from the voice section: never state absence, name the next action.
/* THESE ONLY EVER LOOKED AT JSX TEXT NODES — `>No items<` — so an empty state
   written as a STRING LITERAL walked straight past. Two had:

     "Nothing saved yet"          the flight bag caption
     "Nobody on your route yet"   the radar caption

   Both are on the Flight Deck, the first screen anyone sees, and both state
   absence and stop — which is the one thing the voice section forbids. They
   now read "A bookmark fills the bag." and "The Ready Room finds you
   company.": same length, and each names the thing that ends the emptiness.

   The literal patterns are deliberately narrow. "Nothing is actually wrong."
   is the amber livery's description, not an empty state, so the rule matches
   `Nothing` only when followed by saved/here/to see/yet. A rule that flags
   good copy gets deleted by whoever is in a hurry. */
const NEVER = [/>\s*No (?:items|results|data)\s*</i, /Nothing here\.?\s*</i, />\s*0 results\s*</i];
for (const f of all) {
  const t = src(f);
  for (const re of NEVER) if (re.test(t)) fails.push(`${f}: an empty state states absence instead of naming what fills it`);
}

/* AND THE SAME RULE FOR STRING LITERALS, which the patterns above never saw.
   A caption assigned to a variable is still an empty state; two were, and both
   sat on the Flight Deck, the first screen anyone opens.

   Three narrowings, each one earned by a false positive this found:

     comments      App.jsx and NotFound.jsx both quote "nothing here" in a
                   comment ABOUT this very rule. Prose is not copy.
     src/lib       voices.js is a bank of greetings — "Nobody's opened the
                   hangar doors yet." is flavour, not an empty state.
     length        Profile's invisible-mode note opens "Nobody sees you and
                   you see nobody" and then explains itself for another sixty
                   characters. An empty-state caption is short and stops.

   A rule that flags good copy is a rule someone deletes in a hurry, so it is
   better to miss a long one than to cry wolf on prose. */
const ABSENCE = [
  /^\s*Nothing (?:saved|here|to see|yet)\b/i,
  /^\s*Nobody\b/i,
  /^\s*No one\b/i,
  /^\s*No [a-z]+ yet\s*$/i,
];
/* THE JSX-TEXT SET IS TIGHTER THAN THE LITERAL ONE, and both false positives
   it produced on the first run are the reason.

   "Nothing here is timed. Leaving keeps your place." is the quiz reassuring
   you, not an empty state — so the phrase now has to BE the message rather
   than start it. "Nobody here has it figured out yet. Ask the dumb question."
   opens on absence but names the action in its second sentence, which is the
   rule being followed rather than broken — so a sentence that continues past
   a full stop is left alone.

   Both refusals cost coverage: a long absence-only sentence slips through. A
   rule that rewrites good copy is worse than one that misses a bad line. */
const ABSENCE_TEXT = [
  /^Nothing (?:saved|here|to see)(?: yet)?[.!]?$/i,
  /^Nobody[^.!?]*$/i,
  /^No one[^.!?]*$/i,
  /^No [a-z]+ yet[.!]?$/i,
];

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const f of all.filter((x) => x.startsWith("src/components/"))) {
  const t = strip(src(f));
  for (const m of t.matchAll(/"([^"\\]{2,120})"|'([^'\\]{2,120})'/g)) {
    const lit = m[1] ?? m[2];
    if (lit.length > 45) continue;               // a caption is short and stops
    if (ABSENCE.some((re) => re.test(lit))) {
      fails.push(`${f}: "${lit}" states absence instead of naming what fills it`);
    }
  }

  /* AND THE SAME COPY WRITTEN AS JSX TEXT, which neither pass above could see.
     The Ready Room said "Nobody has answered this yet" on every unanswered
     question — not a string literal, just words between two tags, so the
     literal scan walked past it. It is the same sentence either way. */
  for (const m of t.matchAll(/>\s*([A-Z][^<>{}\n]{2,80}?)\s*</g)) {
    const text = m[1].trim();
    if (ABSENCE_TEXT.some((re) => re.test(text))) {
      fails.push(`${f}: "${text}" states absence instead of naming what fills it`);
    }
  }

  /* A ZERO COUNT, which the voice section bans in the same breath. This is the
     shape it takes in JSX: a number beside a singular/plural word, where the
     zero case renders "0 answers". Only flagged when nothing guards it — a
     `n > 0 ?` ahead of it means the zero case has its own copy — and so does
     `n > 0 &&`, which skips the whole block. Only accepting the ternary flagged
     a correctly guarded count in ProfileSheet, so both forms count. */
  for (const m of t.matchAll(/\{(\w+)\}\s*\{\1 === 1 \? "([a-z]+)" : "([a-z]+)"\}/g)) {
    const before = t.slice(Math.max(0, m.index - 160), m.index);
    if (!new RegExp(`${m[1]}\\s*>\\s*0\\s*(\\?|&&)`).test(before)) {
      fails.push(`${f}: "{${m[1]}} ${m[3]}" renders a zero count when ${m[1]} is 0`);
    }
  }
}

// 4 · The report control — one tap, carrying the route.
const rpt = all.find((f) => /ReportProblem\.jsx$/.test(f));
if (!rpt) fails.push("no way for someone to say a page is wrong");
else if (!/route/.test(src(rpt))) fails.push("the report does not carry the route, so it says nothing useful");
if (!/<ReportProblem/.test(app)) fails.push("the report control is never mounted");

console.log(`states: loading, error and empty checked across ${all.length} components`);
console.log("        not covered: rendering each route three ways against a stubbed API");
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `STATES: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
