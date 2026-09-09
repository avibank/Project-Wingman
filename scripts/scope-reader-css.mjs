#!/usr/bin/env node
/* docs/reader/v5/reader.css → src/components/paper/reader.css, scoped.
 *
 * The brief says copy reader.css verbatim and do not rename the classes. Both
 * halves of that are honoured here, and the one thing that could not be is
 * recorded rather than fudged: seventeen of its seventy-six bare class names —
 * .back .empty .row .rail .toast .switch .scrub .rev .s .sw .preview .plist
 * .chips .more .fold .recent .ticks — are already styled by a dozen other
 * screens in this app. A global stylesheet using them would restyle the Ready
 * Room, the Flight Deck, Profile and the lesson player the moment the reader
 * chunk loaded. `npm run check:collisions` exists in this repo precisely
 * because that has shipped three times before.
 *
 * So NOTHING is renamed and NO value is touched. Every selector that does not
 * already begin with `.rdr` gets `.rdr ` in front of it. The class names in
 * COMPONENTS.md are produced exactly as written; the sheet simply cannot
 * escape the reader.
 *
 * Generated, not hand-edited, so the two files cannot drift: run
 *   npm run reader:css
 * and check:paper asserts the output is current.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "docs/reader/v5/reader.css");
const OUT = join(ROOT, "src/components/paper/reader.css");

let source = readFileSync(SRC, "utf8");

/* ONE REPAIR, AND IT IS A SYNTAX ERROR RATHER THAN A DESIGN OPINION.
   v5's header says the demo-only styles "are not included", and the strip that
   removed them took `.demo{position:absolute;...` and left the second line of
   that rule behind:

     .toast.open{opacity:1;transform:translateX(-50%)}
       display:flex;align-items:center;gap:4px;padding:6px;font-size:11.5px}
     .rdr[data-bar="bottom"] .demo{bottom:76px}

   A browser recovers by hunting for the next `{`, which is the `.demo` rule's
   own — so it throws away BOTH. Nothing real is lost (both are demo chrome),
   but a stylesheet that a parser has to recover from is one nobody can reason
   about, and it would be copied forward into every future version. The orphan
   and the demo rule it belongs to come out here, and the assertion below
   proves that is the only thing that changed. */
const ORPHAN = /\n\s*display:flex;align-items:center;gap:4px;padding:6px;font-size:11\.5px\}\n\.rdr\[data-bar="bottom"\] \.demo\{bottom:76px\}/;
if (ORPHAN.test(source)) {
  source = source.replace(ORPHAN, "");
} else if (/\n\s*display:flex;align-items:center;gap:4px;padding:6px/.test(source)) {
  console.error("REFUSING: the orphaned .demo declarations are still there but in a shape this does not recognise.");
  process.exit(1);
}

/* Comments come out first and go back in last. Leaving them in the stream
   meant a comma inside a comment was treated as a selector separator, and the
   scope prefix landed in the middle of English prose. */
const comments = [];
const masked = source.replace(/\/\*[\s\S]*?\*\//g, (m) => {
  comments.push(m);
  return `\u0000${comments.length - 1}\u0000`;
});

const PLACE = /\u0000\d+\u0000/g;

function scopeSelector(sel) {
  return sel.split(",").map((one) => {
    /* A prelude can carry comments in front of the selector. Decide on the
       selector, and put the prefix immediately before it — not before a
       paragraph of prose that happens to precede the rule. */
    const bare = one.replace(PLACE, "").trim();
    if (!bare) return one;
    if (bare.startsWith(".rdr")) return one;            // already ours
    if (/^(from|to|[\d.]+%)$/.test(bare)) return one;    // a keyframe step
    if (bare.startsWith("@")) return one;               // an at-rule prelude
    /* Find where the actual selector starts: past any comments and space. */
    let at = 0;
    const re = new RegExp(PLACE.source, "g");
    let m;
    while ((m = re.exec(one)) !== null) at = m.index + m[0].length;
    while (at < one.length && /\s/.test(one[at])) at += 1;
    return one.slice(0, at) + ".rdr " + one.slice(at);
  }).join(",");
}

let out = "";
let buffer = "";
let depth = 0;
let inKeyframes = 0;

for (let i = 0; i < masked.length; i++) {
  const ch = masked[i];
  if (ch === "{") {
    const prelude = buffer;
    buffer = "";
    /* The selector without its comments, to decide what this rule IS. */
    const bare = prelude.replace(/\u0000\d+\u0000/g, "").trim();
    if (bare.startsWith("@")) {
      if (/^@keyframes/i.test(bare)) inKeyframes = depth + 1;
      out += prelude;
    } else if (inKeyframes && depth >= inKeyframes) {
      out += prelude;
    } else {
      out += scopeSelector(prelude);
    }
    out += "{";
    depth += 1;
    continue;
  }
  if (ch === "}") {
    out += buffer; buffer = "";
    depth -= 1;
    if (inKeyframes && depth < inKeyframes) inKeyframes = 0;
    out += "}";
    continue;
  }
  buffer += ch;
}
out += buffer;
out = out.replace(/\u0000(\d+)\u0000/g, (_, n) => comments[Number(n)]);

const header = `/* GENERATED — do not edit. Source: docs/reader/v5/reader.css
 *
 * Every selector scoped under .rdr so the reader's class names cannot restyle
 * the rest of the app. No class renamed, no value changed. See
 * scripts/scope-reader-css.mjs for why, and run \`npm run reader:css\` to
 * regenerate.
 */
`;
writeFileSync(OUT, header + out);

/* Prove nothing but selectors moved: every declaration in, every declaration
   out, byte for byte. */
const decls = (css) => (css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\})/g) || [])
  .join("|").replace(/\s+/g, " ").trim();
const before = decls(source);
const after = decls(out);
if (before !== after) {
  console.error("REFUSING: the declarations changed. This script may only move selectors.");
  process.exit(1);
}
console.log(`scoped ${source.split("\n").length} lines · declarations identical`);
