/* MODULE 13e MOCK EXAMS, from the JSON sidecar + PDF of each (Mock Exam 1-6).
   Mock N is letter A-F at batch 10+N, chapter id M2.M<letter>, mirroring 13d's
   mocks. Quiz only (cards fall back to the quiz's own questions); the PDF is
   the paper. Purely additive. REFUSES on a bad key, a duplicate, or a bad count.
     node scripts/m13e/import-mock.mjs <dir holding M13e-Mock-Exam-N.{json,pdf}> */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const IN = process.argv[2];
if (!IN) { console.error("usage: node scripts/m13e/import-mock.mjs <dir>"); process.exit(2); }
const CONTENT = new URL("../../src/content/test-content.json", import.meta.url);
const PUBLIC = new URL("../../public/downloads/", import.meta.url);
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };
const doc = JSON.parse(readFileSync(CONTENT, "utf8"));
const mod = doc.modules.find((m) => m.id === "M2");
mod.chapters = mod.chapters.filter((c) => !/^M2\.M[A-F]$/.test(c.id));
mod.downloads = (mod.downloads || []).filter((d) => !/^M2\.M[A-F]\./.test(d.id));
for (let n = 1; n <= 6; n++) {
  const L = "ABCDEF"[n - 1], ID = `M2.M${L}`;
  const j = JSON.parse(readFileSync(`${IN}/M13e-Mock-Exam-${n}.json`, "utf8"));
  const seen = new Set();
  const questions = j.questions.map((q, i) => {
    const keys = Object.keys(q.options);
    const correct = keys.indexOf(q.answer);
    if (correct < 0) die(`${ID} Q${i + 1}: answer ${q.answer} indexes nothing`);
    if (keys.length < 2 || !q.question.trim()) die(`${ID} Q${i + 1}: unfinished`);
    const id = `${ID}.Q${i + 1}`; if (seen.has(id)) die(`dup ${id}`); seen.add(id);
    const e = (q.explanation || "").trim();
    return { id, question: q.question.trim(), options: keys.map((k) => q.options[k].trim()), correct, ...(e ? { explain: e } : {}) };
  });
  if (!questions.length) die(`${ID} has no questions`);
  const FILE = `M13e-Mock-Exam-${L}.pdf`;
  copyFileSync(`${IN}/M13e-Mock-Exam-${n}.pdf`, new URL(FILE, PUBLIC));
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(new URL(FILE, PUBLIC))) }).promise;
  mod.chapters.push({ id: ID, name: `Mock Exam ${L}`, lessons: [], batch: 10 + n, quiz: { id: `${ID}.QZ`, name: `M13e — Mock exam ${n}`, questions } });
  mod.downloads.push({ id: `${ID}.DL1`, title: `M13e — Mock exam ${L}`, file: `downloads/${FILE}`, pages: pdf.numPages });
  console.log(ID, questions.length, "q", pdf.numPages, "pp");
}
mod.mocks = 6; mod.batches = 16;
const at = new Map(mod.chapters.map((c) => [c.id, c.batch ?? 0]));
mod.chapters.sort((a, b) => (a.batch ?? 0) - (b.batch ?? 0));
mod.downloads.sort((a, b) => (at.get(a.id.replace(/\.DL\d+$/, "")) ?? 0) - (at.get(b.id.replace(/\.DL\d+$/, "")) ?? 0));
writeFileSync(CONTENT, `${JSON.stringify(doc, null, 1)}\n`);
