#!/usr/bin/env node
/* docs/reader/<v>/reader.css → src/components/paper/<...>/reader.css, scoped.
 *
 * The brief says copy reader.css verbatim and do not rename the classes. Both
 * halves of that are honoured here, and the one thing that could not be is
 * recorded rather than fudged: the shipped sheets style bare class names —
 * v6 has 187 of them, and seven (.av .chip .mt .pop .pres .scrub .sw) are
 * already styled by other screens in this app. A global stylesheet using them
 * would restyle the Ready Room, the Flight Deck, Profile and the lesson player
 * the moment the reader chunk loaded. `npm run check:collisions` exists in
 * this repo precisely because that has shipped three times before.
 *
 * v6 raises the stakes: its reset is `*{margin:0;padding:0;box-sizing:...}`
 * and `button{background:none;border:0;...}`. Unscoped, that is not a
 * collision, it is the whole app.
 *
 * So NOTHING is renamed and NO value is touched. Every selector that does not
 * already begin with `.rdr` gets `.rdr ` in front of it. The class names in
 * the reference are produced exactly as written; the sheet simply cannot
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

/* Each build's source, its destination, and the cuts made on the way — every
   cut named, with the reason, so "verbatim" means something checkable. */
const BUILDS = [
  {
    v: "v5",
    src: "docs/reader/v5/reader.css",
    out: "src/components/paper/reader.css",
    cuts: [{
      /* A SYNTAX ERROR RATHER THAN A DESIGN OPINION. v5's header says the
         demo-only styles "are not included", and the strip that removed them
         took `.demo{position:absolute;...` and left the second line behind:

           .toast.open{opacity:1;transform:translateX(-50%)}
             display:flex;align-items:center;gap:4px;padding:6px;font-size:11.5px}
           .rdr[data-bar="bottom"] .demo{bottom:76px}

         A browser recovers by hunting for the next `{`, which is the `.demo`
         rule's own — so it throws away BOTH. Nothing real is lost (both are
         demo chrome), but a stylesheet a parser has to recover from is one
         nobody can reason about, and it would be copied forward into every
         future version. */
      why: "the orphaned .demo declarations, which are a parse error",
      find: /\n\s*display:flex;align-items:center;gap:4px;padding:6px;font-size:11\.5px\}\n\.rdr\[data-bar="bottom"\] \.demo\{bottom:76px\}/,
      guard: /\n\s*display:flex;align-items:center;gap:4px;padding:6px/,
    }],
  },
  {
    v: "v6",
    src: "docs/reader/v6/reader.css",
    out: "src/components/paper/v6/reader.css",
    cuts: [{
      /* v6's own header, line 9: "The block marked DEMO ONLY at the very
         bottom is deleted on the live site." HANDOVER section 5 says the same.
         This is that deletion, done here rather than by hand so the source
         stays the file that was handed over. The block runs from `.demoBtn`
         to the 900px media query that hides `.demo`; nothing else is between
         them. */
      why: "the demo strip, which HANDOVER section 5 says to delete before shipping",
      find: /\n\.demoBtn\{[\s\S]*?@media \(max-width:900px\)\{\.demo\{display:none\}\}\n/,
      guard: /\.demoBtn\{/,
    }],
  },
];

/* A placeholder that cannot occur in CSS. The first version of this used NUL,
   which is invisible in every diff and every terminal; private-use U+E000 is
   just as impossible in a stylesheet and can be seen when it goes wrong. */
const MARK = "";
const PLACE = new RegExp(`${MARK}\\d+${MARK}`, "g");

function scopeOne(build) {
  const SRC = join(ROOT, build.src);
  const OUT = join(ROOT, build.out);
  let source = readFileSync(SRC, "utf8");
  const cut = [];

  for (const c of build.cuts) {
    if (c.find.test(source)) {
      source = source.replace(c.find, "\n");
      cut.push(c.why);
    } else if (c.guard.test(source)) {
      console.error(`REFUSING (${build.v}): ${c.why} — still there, but in a shape this does not recognise.`);
      process.exit(1);
    }
  }

  /* Comments come out first and go back in last. Leaving them in the stream
     meant a comma inside a comment was treated as a selector separator, and
     the scope prefix landed in the middle of English prose. */
  const comments = [];
  const masked = source.replace(/\/\*[\s\S]*?\*\//g, (m) => {
    comments.push(m);
    return `${MARK}${comments.length - 1}${MARK}`;
  });

  function scopeSelector(sel) {
    return sel.split(",").map((one) => {
      /* A prelude can carry comments in front of the selector. Decide on the
         selector, and put the prefix immediately before it — not before a
         paragraph of prose that happens to precede the rule. */
      const bare = one.replace(PLACE, "").trim();
      if (!bare) return one;
      if (bare.startsWith(".rdr")) return one;             // already ours
      if (/^(from|to|[\d.]+%)$/.test(bare)) return one;     // a keyframe step
      if (bare.startsWith("@")) return one;                // an at-rule prelude
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
      const bare = prelude.replace(PLACE, "").trim();
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
  out = out.replace(PLACE, (m) => comments[Number(m.slice(1, -1))]);

  const header = `/* GENERATED — do not edit. Source: ${build.src}
 *
 * Every selector scoped under .rdr so the reader's class names cannot restyle
 * the rest of the app. No class renamed, no value changed.${cut.length ? `
 * Cut on the way through, and only this:
 *   - ${cut.join("\n *   - ")}` : ""}
 * See scripts/scope-reader-css.mjs for why, and run \`npm run reader:css\` to
 * regenerate.
 */
`;
  writeFileSync(OUT, header + out);

  /* Prove nothing but selectors moved: every declaration in, every declaration
     out, byte for byte. */
  const decls = (css) => (css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\})/g) || [])
    .join("|").replace(/\s+/g, " ").trim();
  if (decls(source) !== decls(out)) {
    console.error(`REFUSING (${build.v}): the declarations changed. This script may only move selectors.`);
    process.exit(1);
  }
  console.log(`${build.v}: scoped ${source.split("\n").length} lines -> ${build.out} · declarations identical`);
}

BUILDS.forEach(scopeOne);
