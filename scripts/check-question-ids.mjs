// A saved bookmark points at a QUESTION, so a question needs an id that is its
// own — not its place in a list. Run: npm run check:question-ids
//
// This is in `prebuild`, so it fails the build rather than a review. Three ways
// to fail, all of them silent otherwise:
//
//   * a question with no id. src/lib/contentLoader.js falls back to
//     `${chapter}.Q${index + 1}`, which is POSITIONAL — reorder the quiz and
//     every save made before the edit now shows a different question, with
//     nothing broken enough to notice. The fallback stays, because a runtime
//     without an id should still render; this check is what stops anybody
//     relying on it.
//   * two questions sharing an id. One save, two questions, and which one a
//     student sees depends on which the loader reached first.
//   * a question whose `correct` indexes nothing. The card set draws its answer
//     from that index, so the back of the card would be blank or wrong.
//
// It reads the content document itself, not the loader's output, because the
// loader is the thing that papers over a missing id.
import { readFileSync } from "node:fs";

const DOCS = [
  ["src/content/test-content.json", JSON.parse(readFileSync(new URL("../src/content/test-content.json", import.meta.url), "utf8"))],
];

/* data.js carries the same shape under different names and currently has no
   questions at all (CLAUDE.md, "Content"). Checked anyway, so that the day it
   does the ids are held to the same rule. */
const dataSrc = readFileSync(new URL("../src/data.js", import.meta.url), "utf8");
const at = dataSrc.indexOf("const CHAPTERS = [");
const CHAPTERS = at < 0 ? [] : eval(dataSrc.slice(at + "const CHAPTERS = ".length, dataSrc.indexOf("\n];", at) + 2));

/** Every question in every document, with where it came from. */
function allQuestions() {
  const out = [];
  for (const [file, doc] of DOCS) {
    for (const m of doc.modules || []) {
      for (const c of m.chapters || []) {
        const qs = c.quiz?.questions || [];
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          out.push({ file, where: `${m.id} ${c.id} #${i + 1}`, id: q.id, stem: q.question, options: q.options, answer: q.correct });
        }
      }
    }
  }
  for (const ch of CHAPTERS) {
    const qs = ch.questions || [];
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      out.push({ file: "src/data.js", where: `${ch.code} #${i + 1}`, id: q.id, stem: q.text || q.question, options: q.options, answer: q.answer });
    }
  }
  return out;
}

const seen = new Map();
const problems = [];
let n = 0;
for (const q of allQuestions()) {
  n++;
  const said = `${q.file} ${q.where}: "${String(q.stem ?? "").slice(0, 52)}"`;
  if (!q.id || typeof q.id !== "string") problems.push(`no stable id — ${said}`);
  else if (seen.has(q.id)) problems.push(`id "${q.id}" is used twice — ${said}, and ${seen.get(q.id)}`);
  else seen.set(q.id, said);
  if (!Array.isArray(q.options) || !(q.answer >= 0 && q.answer < q.options.length)) {
    problems.push(`no valid answer — ${said}`);
  }
}

if (!n) { console.error("check:question-ids found no questions at all, which means it is looking in the wrong place."); process.exit(1); }
if (problems.length) {
  console.error(`check:question-ids failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check:question-ids: ${n} questions, ${seen.size} ids, all stable and unique.`);
