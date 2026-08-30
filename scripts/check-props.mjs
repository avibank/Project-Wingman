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
  // COMMENTS OUT FIRST. A comment inside the parameter list contains commas of
  // its own — "the count, handed down from…" — and the splitter below cuts on
  // them, gluing prose to the next real prop name. That is the third time a
  // comment has fooled this file: once ending a tag early on an apostrophe,
  // once arriving as bare attributes, and now this.
  const block = src.slice(braceAt + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const names = new Set();
  const required = new Set();
  // Split on top-level commas only. A regex cannot do this: a nested default
  // like `people = { a: 1, b: 2 }` contains commas that belong to the object,
  // and splitting on them invents props called a and b.
  const parts = [];
  let d2 = 0, buf = "";
  for (const ch of block) {
    if (ch === "{" || ch === "[" || ch === "(") d2++;
    else if (ch === "}" || ch === "]" || ch === ")") d2--;
    if (ch === "," && d2 === 0) { parts.push(buf); buf = ""; continue; }
    buf += ch;
  }
  parts.push(buf);
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    // A rest element accepts anything, so the component cannot drop a prop.
    if (part.startsWith("...")) { names.add("*"); continue; }
    const name = part.split(/[=:]/)[0].trim();
    if (!/^\w+$/.test(name)) continue;
    names.add(name);
    // No default means the component expects to be given it.
    if (!/=/.test(part)) required.add(name);
  }
  return { names, required };
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
    const { names, required } = readPattern(src, braceAt);
    comps.set(name, { props: names, required, file: f, ambiguous: false });
  }
}

/* The attribute NAMES in a tag body. A regex is wrong here for the same reason
   it was wrong for finding the tag's end: prose inside a string value —
   label="a question during a quiz" — reads as a run of bare attributes. Walk it
   instead, and only take identifiers sitting at the top level of the tag.
   Bare attributes count: `open` is `open={true}`, and calling it absent reports
   a prop that is very much being passed. */
function attrsOf(seg) {
  const out = new Set();
  let i = 0;
  while (i < seg.length) {
    const c = seg[i];
    if (c === '"' || c === "'" || c === "`") {          // skip a string value
      const q = c; i++;
      while (i < seg.length && !(seg[i] === q && seg[i - 1] !== "\\")) i++;
      i++; continue;
    }
    if (c === "/" && seg[i + 1] === "/") {               // skip a line comment
      while (i < seg.length && seg[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && seg[i + 1] === "*") {               // skip a block comment
      i += 2;
      while (i < seg.length && !(seg[i] === "*" && seg[i + 1] === "/")) i++;
      i += 2; continue;
    }
    if (c === "{") {                                     // skip an expression
      let d = 1; i++;
      while (i < seg.length && d > 0) {
        if (seg[i] === "{") d++;
        else if (seg[i] === "}") d--;
        i++;
      }
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < seg.length && /[\w$-]/.test(seg[j])) j++;
      const word = seg.slice(i, j);
      // An identifier here is an attribute name whether or not it has a value.
      if (!word.includes("-")) out.add(word);
      i = j; continue;
    }
    i++;
  }
  return out;
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
    // COMMENTS BEFORE QUOTES, and this is not a nicety. A JSX comment inside a
    // tag can contain an apostrophe — "the Flight Deck's Resume" — and reading
    // that as a string open means the tag never closes, so the whole call site
    // is skipped in silence. That is how this check quietly stopped watching
    // the one call site it was written to protect.
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(from, i);
  }
  return null;
}

const fails = [];
// Every prop name any call site hands each component, unioned.
const seen = new Map();
// A component with a spread anywhere may be given anything; do not judge it.
const spread = new Set();
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
      if (seg.includes("{...")) { spread.add(name); continue; }
      const m = { index: start };
      sites++;
      if (props.has("*")) continue;             // a rest element takes them all
      // The leading boundary matters: without it data-press="" matched as a
      // prop called "press", because \w does not include a hyphen.
      const passed = attrsOf(seg);
      seen.set(name, new Set([...(seen.get(name) || []), ...passed]));
      for (const p of passed) {
        if (p === "key" || p === "ref") continue;
        if (props.has(p)) continue;
        const line = src.slice(0, m.index).split("\n").length;
        fails.push(`${f}:${line} passes ${p} to <${name}>, which never receives it`);
      }
    }
  }
}

/* THE OTHER DIRECTION, and the one that found a live data bug: a prop the
   component expects and NO call site ever hands it. It is always undefined, so
   whatever depends on it quietly does nothing — ChapterComments took moduleCode
   that way, which meant its query filtered on undefined and anything posted was
   written with a null module and could never be read back.

   Only props with no default are judged: a default is the author saying the
   prop is optional. children is never an attribute. */
let reverse = 0;
for (const [name, { required, file, ambiguous }] of comps) {
  if (ambiguous || spread.has(name)) continue;
  const got = seen.get(name);
  if (!got) continue;                       // never rendered; nothing to check
  for (const p of required) {
    if (p === "children" || p === "key" || p === "ref") continue;
    if (got.has(p)) continue;
    reverse++;
    fails.push(`${file} <${name}> expects ${p}, which no call site passes`);
  }
}

console.log(`props: ${sites} JSX call sites across ${comps.size} components with destructured props`);
console.log(`       both directions — passed-but-not-received, and expected-but-never-passed (${reverse} of the latter)`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `PROPS: ${fails.length} passed but never received` : "MATCH");
if (fails.length) process.exitCode = 1;
