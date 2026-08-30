// Props that are passed and never received.
//
// This is the failure nothing else here catches. A prop handed to a component
// that does not destructure it is not an error, not a type mismatch, and not a
// lint warning — it is silence. The component renders, the page looks right,
// and one feature is simply gone.
//
// It cost the quiz's place-keeping: App passed onRun to QuizPage on every
// question, QuizPage stopped destructuring it when Review replaced QuizRunner,
// and so "Back to question N" and the Flight Deck's Resume-into-a-quiz both
// went quiet. Every check in this repo passed the whole time.
//
// Deliberately conservative: it only reads components declared as
// `export default function Name({ ... })`, and only flags a literal prop on a
// literal JSX tag. A spread stops the analysis for that call site, because the
// prop may well be inside it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".jsx")) files.push(p);
  }
})("src");

// Every component that destructures its props, however it is declared — a
// default export, a named one, a bare function, or an arrow. Restricting this
// to `export default function` covered eleven components out of a hundred-odd
// and would have missed most of the codebase.
const DECL = /(?:export\s+default\s+function|export\s+function|function)\s+([A-Z]\w*)\s*\(\s*\{|const\s+([A-Z]\w*)\s*=\s*\(\s*\{/g;

function readPattern(src, braceAt) {
  let depth = 0, end = braceAt;
  for (let j = braceAt; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  const block = src.slice(braceAt + 1, end);
  const names = new Set();
  // Split on commas that are not inside a nested pattern.
  for (const raw of block.split(/,(?![^{[]*[}\]])/)) {
    const part = raw.trim().split(/[=:]/)[0].trim();
    // A rest element accepts anything, so the component cannot drop a prop.
    if (part.startsWith("...")) { names.add("*"); continue; }
    if (/^\w+$/.test(part)) names.add(part);
  }
  return names;
}

const comps = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(DECL)) {
    const name = m[1] || m[2];
    const braceAt = src.indexOf("{", m.index + m[0].length - 1);
    if (braceAt < 0) continue;
    // A component declared twice would make this ambiguous; skip rather than
    // guess which one a call site meant.
    if (comps.has(name)) { comps.get(name).ambiguous = true; continue; }
    comps.set(name, { props: readPattern(src, braceAt), file: f, ambiguous: false });
  }
}

/* Every index where `<Name` begins as a real tag. */
function tagStarts(src, name) {
  const out = [];
  const re = new RegExp(`<${name}(?=[\\s/>])`, "g");
  for (const m of src.matchAll(re)) out.push(m.index);
  return out;
}

/* The attribute text of the tag beginning at `start`, or null if it does not
   close. Tracks {} depth and skips over strings, so a ">" inside an arrow
   function body or a string cannot end the tag early. */
function tagBody(src, start) {
  let i = start + 1;
  while (i < src.length && !/[\s/>]/.test(src[i])) i++;   // past the name
  const from = i;
  let depth = 0, quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(from, i);
  }
  return null;
}

const fails = [];
let sites = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const [name, { props, ambiguous }] of comps) {
    if (ambiguous) continue;
    // A REGEX CANNOT FIND THE END OF A JSX TAG. `<Name ... />` matched
    // non-greedily to the first ">" stops inside the first arrow function,
    // because "=>" contains one — so every call site with an inline handler was
    // silently truncated before its later props. That is not a small gap: it is
    // most of the call sites in this codebase, and it made the first version of
    // this check pass while the exact bug it was written for was reintroduced.
    // Scan instead, tracking brace depth and strings.
    for (const start of tagStarts(src, name)) {
      const seg = tagBody(src, start);
      if (seg === null) continue;
      if (seg.includes("{...")) continue;       // a spread may carry anything
      const m = { index: start };
      sites++;
      if (props.has("*")) continue;             // a rest element takes them all
      // The leading boundary matters: without it data-press="" matched as a
      // prop called "press", because \w does not include a hyphen.
      const passed = new Set(
        [...seg.matchAll(/(?:^|[\s{])([A-Za-z_$][\w$]*)=[{"]/g)].map((x) => x[1]));
      for (const p of passed) {
        if (p === "key" || p === "ref") continue;
        if (props.has(p)) continue;
        const line = src.slice(0, m.index).split("\n").length;
        fails.push(`${f}:${line} passes ${p} to <${name}>, which never receives it`);
      }
    }
  }
}

console.log(`props: ${sites} JSX call sites across ${comps.size} components with destructured props`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `PROPS: ${fails.length} passed but never received` : "MATCH");
if (fails.length) process.exitCode = 1;
