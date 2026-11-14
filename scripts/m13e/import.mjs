/* =============================================================================
   MODULE 13e, FROM STRUCTURED SIDECARS.
   -----------------------------------------------------------------------------
   The two earlier importers (scripts/batches, scripts/mock) read a PDF BY
   GEOMETRY because a PDF was all there was. These documents arrive as a PDF AND
   a JSON that carries the same content with its structure intact — option
   letters, the key, the level, the page — so nothing here classifies a line by
   its x or its height, and the whole family of bugs that cost the V-batch
   import 92 truncated explanations cannot happen. The PDF is used for what it
   is for: the paper a student downloads, whose page count is read out of it.

   WHAT THE THREE DOCUMENTS ARE, in this app's terms:
     Exam         the chapter's QUIZ — the forty a student sits (multiple choice).
     Study Cards  the chapter's CARDS, OPEN-ENDED: a question and the author's
                  own answer, `{ id, front, back }`, with **key terms** marked.
                  This is what the owner asked for on 2026-11-14 — "moving on
                  its all open ended" — and the app grew the shape for it
                  (src/lib/openCard.js); 13d's multiple-choice cards are kept
                  exactly as they were.
     Full Bank    the 400 multiple-choice questions. They are the PAPER on the
                  Papers shelf (its PDF) and are not loaded as cards: a card set
                  is open-ended from now on, and the bank is what a student
                  downloads and works through on paper.

   IT REFUSES rather than guesses: a declared count that is not the actual one,
   a duplicate id, an answer that indexes nothing, an exam stem that is not in
   the bank, or an exam answer that disagrees with the bank's.

     node scripts/m13e/import.mjs <dir holding the six M13e-01-* files>
   ========================================================================= */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const IN = process.argv[2];
if (!IN) { console.error("usage: node scripts/m13e/import.mjs <dir>"); process.exit(2); }
const CONTENT = new URL("../../src/content/test-content.json", import.meta.url);
const PUBLIC = new URL("../../public/downloads/", import.meta.url);

const J = (n) => JSON.parse(readFileSync(`${IN}/M13e-01-${n}-pages-1-117.json`, "utf8"));
const cards = J("StudyCards"), bank = J("FullBank"), exam = J("Exam");
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };

/* ---- the three must be one batch of one subject ------------------------- */
for (const k of ["module", "title", "batch", "source", "master_pages", "category"]) {
  if (cards[k] !== bank[k] || bank[k] !== exam[k]) die(`the documents disagree about ${k}`);
}
const bankQs = bank.topics.flatMap((t) => t.questions);
if (bankQs.length !== bank.question_count) die(`bank declares ${bank.question_count}, has ${bankQs.length}`);
if (exam.questions.length !== exam.question_count) die("exam count is not its declared count");
if (cards.cards.length !== cards.card_count) die("card count is not its declared count");

/* ---- a question is its own words, an id never reused -------------------- */
const LETTERS = ["A", "B", "C"];
const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();
/* TWO AUTHOR NOTES LEAK INTO A STUDENT'S EXPLANATION: "(See conflict note.)" —
   a pointer to a note this app never shows. Exactly that parenthetical goes and
   nothing else is touched; the count is reported so it is not a silent edit. */
let stripped = 0;
const clean = (s) => String(s).replace(/\s*\(See conflict note\.\)/g, () => { stripped += 1; return ""; }).trim();

const shape = (q, id, where) => {
  const letters = Object.keys(q.options || {});
  if (letters.join("") !== LETTERS.slice(0, letters.length).join("") || letters.length < 2) die(`${where}: options are not A, B, C…`);
  const correct = letters.indexOf(q.answer);
  if (correct < 0) die(`${where}: answer ${JSON.stringify(q.answer)} indexes nothing`);
  if (!String(q.question || "").trim()) die(`${where}: no stem`);
  return { id, question: clean(q.question), options: letters.map((l) => clean(q.options[l])),
           correct, explain: clean(q.explanation || "") };
};

const seen = new Set();
const uniq = (id) => { if (seen.has(id)) die(`id used twice: ${id}`); seen.add(id); return id; };
const ID = "M2.V1";

/* THE CARDS ARE THE STUDY CARDS, AS WRITTEN: front and back, nothing invented.
   The back keeps its **key term** markers — the author's convention, drawn bold
   by Rich — and the only edit is none. */
const cardSet = cards.cards.map((c, i) => {
  const front = String(c.front || "").trim(), back = String(c.back || "").trim();
  if (!front || !back) die(`study card ${c.id}: a blank side`);
  return { id: uniq(`${ID}.C${String(i + 1).padStart(3, "0")}`), front, back };
});
const byStem = new Map(bankQs.map((q) => [norm(q.question), q]));
const quizQs = exam.questions.map((q) => {
  const b = byStem.get(norm(q.question));
  if (!b) die(`exam #${q.number}: its stem is not in the bank`);
  if (norm(b.options[b.answer]) !== norm(q.options[q.answer])) die(`exam #${q.number}: its answer disagrees with the bank`);
  return shape(q, uniq(`${ID}.Q${q.number}`), `exam #${q.number}`);
});

/* ---- the paper, and its page count read out of the file ----------------- */
const pagesOf = async (p) => {
  const d = await getDocument({ data: new Uint8Array(readFileSync(p)), useSystemFonts: false, isEvalSupported: false }).promise;
  const n = d.numPages; await d.destroy(); return n;
};
const RANGE = "1–117";                       // the documents' own, en dash as 13d prints it
const FILE = "M13e-Batch-1-Full-Bank-pages-1-117.pdf";
mkdirSync(PUBLIC, { recursive: true });
copyFileSync(`${IN}/M13e-01-FullBank-pages-1-117.pdf`, new URL(FILE, PUBLIC));
/* a URL object, never `.pathname`: this checkout's path has a space in it and
   `.pathname` hands back `%20`, which is a file that does not exist. */
const pp = await pagesOf(new URL(FILE, PUBLIC));
if (!(pp > 0)) die("the paper has no pages");

/* ---- into the document -------------------------------------------------- */
const doc = JSON.parse(readFileSync(CONTENT, "utf8"));
const mod = doc.modules.find((m) => m.id === "M2");
if (!mod) die("no Module 2 in the content document");
mod.chapters = (mod.chapters || []).filter((c) => c.id !== ID);   // re-runnable
mod.downloads = (mod.downloads || []).filter((d) => d.id !== `${ID}.DL1`);

mod.chapters.push({
  id: ID,
  name: bank.title,                                  // "Communication"
  cardsName: `Batch ${cards.batch} · Study Cards · pages ${RANGE}`,
  lessons: [],
  quiz: { id: `${ID}.QZ`, name: `Batch ${bank.batch} · Mock Exam · pages ${RANGE}`, questions: quizQs },
  cards: cardSet,
  batch: 1,
  ref: bank.module.replace(/^M/, ""),                // "13.4"
  pages: RANGE,
});
mod.downloads.push({ id: `${ID}.DL1`, title: `Batch ${bank.batch} · Full Bank · pages ${RANGE}`, file: `downloads/${FILE}`, pages: pp });

writeFileSync(CONTENT, `${JSON.stringify(doc, null, 1)}\n`);

const spread = (qs) => { const t = [0, 0, 0]; for (const q of qs) t[q.correct] += 1; return t.join("/"); };
const bolded = cardSet.filter((c) => /\*\*.+?\*\*/.test(c.back)).length;
console.log(`M2 ${ID}  "${bank.title}"  ref ${bank.module.replace(/^M/, "")}  pages ${RANGE}`);
console.log(`  quiz   ${quizQs.length} questions   answers a/b/c ${spread(quizQs)}`);
console.log(`  cards  ${cardSet.length} open-ended (${bolded} with a marked key term)`);
console.log(`  paper  ${FILE}  ${pp}pp`);
console.log(`  author notes stripped from explanations: ${stripped}`);
console.log(`  paper only: the ${bankQs.length}-question full bank (not loaded as cards)`);
