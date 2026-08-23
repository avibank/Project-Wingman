// Content integrity check for src/data.js. Run: npm run check:content
//
// §9.3.2 requires an explanation on every option, and a mismatched array length
// would silently attach the wrong reasoning to the wrong answer — which §11
// makes a safety problem, not a formatting one.
import { readFileSync } from "node:fs";
// data.js imports lucide icons; parse the CHAPTERS array out of the source
// instead of importing, so this runs in plain node.
const src = readFileSync(new URL("../src/data.js", import.meta.url), "utf8");
const start = src.indexOf("const CHAPTERS = [");
const end = src.indexOf("\n];", start) + 2;
const CHAPTERS = eval(src.slice(start + "const CHAPTERS = ".length, end));

let q = 0, bad = 0;
const seenIds = new Set();
for (const ch of CHAPTERS) {
  for (const question of ch.questions || []) {
    q++;
    const where = `${ch.code} ${question.id}`;
    if (seenIds.has(question.id)) { console.error(`DUPLICATE id ${where}`); bad++; }
    seenIds.add(question.id);
    if (!Array.isArray(question.explain)) { console.error(`NO EXPLAIN ${where}`); bad++; continue; }
    if (question.explain.length !== question.options.length) {
      console.error(`LENGTH MISMATCH ${where}: ${question.explain.length} explain vs ${question.options.length} options`); bad++;
    }
    if (question.answer < 0 || question.answer >= question.options.length) {
      console.error(`ANSWER OUT OF RANGE ${where}: ${question.answer}`); bad++;
    }
    question.explain.forEach((e, i) => {
      if (typeof e !== "string" || e.trim().length < 40) { console.error(`THIN ${where}[${i}]`); bad++; }
      if (!/[.?!]$/.test(e.trim())) { console.error(`UNPUNCTUATED ${where}[${i}]`); bad++; }
    });
    if (new Set(question.explain).size !== question.explain.length) {
      console.error(`DUPLICATE EXPLANATIONS ${where}`); bad++;
    }
  }
}
// takeaways / terms shape where present
let briefs = 0;
for (const ch of CHAPTERS) {
  if (ch.takeaways) {
    briefs++;
    if (ch.takeaways.length < 4 || ch.takeaways.length > 6) { console.error(`§9.3.1 wants 4-6 takeaways, ${ch.code} has ${ch.takeaways.length}`); bad++; }
    for (const t of ch.takeaways) if (!/[.?!]$/.test(t.trim())) { console.error(`UNPUNCTUATED takeaway ${ch.code}`); bad++; }
  }
  for (const t of ch.terms || []) {
    if (!t.term || !t.def) { console.error(`MALFORMED term in ${ch.code}`); bad++; }
  }
}
console.log(`chapters ${CHAPTERS.length} | questions ${q} | briefs ${briefs} | problems ${bad}`);
if (bad) process.exit(1);
console.log("PASS");
