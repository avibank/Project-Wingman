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

   IT IS PER BATCH, AND EVERY NAME COMES OUT OF THE DOCUMENTS. Batch 1 was
   hard-coded — the filenames, `M2.V1`, the page range and the paper's name all
   written out — and batch 2 would have been a second copy of this file to
   drift against the first. The batch number is an argument now and the rest is
   derived: the six files are FOUND by pattern, the page range is read off
   their names and CHECKED against the `master_pages` each document declares,
   and the chapter id is `M2.V<batch>`. Re-running it for batch 1 reproduces
   the document byte for byte, which is how the generalisation was checked.

     node scripts/m13e/import.mjs <dir holding that batch's six files> <batch>
   ========================================================================= */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const IN = process.argv[2];
const WANT = process.argv[3];
if (!IN || !WANT) { console.error("usage: node scripts/m13e/import.mjs <dir> <batch>"); process.exit(2); }
const CONTENT = new URL("../../src/content/test-content.json", import.meta.url);
const PUBLIC = new URL("../../public/downloads/", import.meta.url);
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };

/* THE SIX FILES ARE FOUND, NEVER COMPOSED, and the page range comes off their
   names rather than being typed here. A composed name that does not exist is
   an ENOENT with no explanation; a pattern that matches nothing can say which
   of the six is missing and from where. */
const BB = String(Number(WANT)).padStart(2, "0");
const DIR = readdirSync(IN);
const find = (kind, ext) => {
  const re = new RegExp(`^M13e-${BB}-${kind}-pages-(\\d+)-(\\d+)\\.${ext}$`);
  const hit = DIR.map((f) => [f, re.exec(f)]).find(([, m]) => m);
  if (!hit) die(`no M13e-${BB}-${kind}-pages-<from>-<to>.${ext} in ${IN}`);
  return { path: `${IN}/${hit[0]}`, from: hit[1][1], to: hit[1][2] };
};
const AT = { cards: find("StudyCards", "json"), bank: find("FullBank", "json"), exam: find("Exam", "json") };
const PAPER = find("FullBank", "pdf");

const J = (w) => JSON.parse(readFileSync(w.path, "utf8"));
const cards = J(AT.cards), bank = J(AT.bank), exam = J(AT.exam);

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

/* THE NAME THE FILE CLAIMS AND THE RANGE THE DOCUMENT DECLARES HAVE TO AGREE.
   Either alone is a single point of failure: a file renamed by hand would be
   imported under the wrong range, and a document whose `master_pages` is stale
   would print a range a student could not find in the manual. */
const N = Number(bank.batch);
if (!Number.isInteger(N) || N < 1) die(`the documents declare batch ${JSON.stringify(bank.batch)}`);
if (N !== Number(WANT)) die(`asked for batch ${WANT}, the documents are batch ${bank.batch}`);
for (const [k, doc] of [["cards", cards], ["bank", bank], ["exam", exam]]) {
  const w = AT[k];
  const declared = String(doc.master_pages || "").replace(/[–—]/g, "-");
  if (declared !== `${w.from}-${w.to}`) die(`${k}: the file says pages ${w.from}-${w.to}, the document says ${declared}`);
}
if (PAPER.from !== AT.bank.from || PAPER.to !== AT.bank.to) die("the Full Bank PDF and its JSON cover different pages");
const ID = `M2.V${N}`;

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
const RANGE = `${AT.bank.from}\u2013${AT.bank.to}`;   // en dash, as 13d prints it
const FILE = `M13e-Batch-${N}-Full-Bank-pages-${AT.bank.from}-${AT.bank.to}.pdf`;
mkdirSync(PUBLIC, { recursive: true });
copyFileSync(PAPER.path, new URL(FILE, PUBLIC));
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
  batch: N,
  ref: bank.module.replace(/^M/, ""),                // "13.4"
  pages: RANGE,
});
mod.downloads.push({ id: `${ID}.DL1`, title: `Batch ${bank.batch} · Full Bank · pages ${RANGE}`, file: `downloads/${FILE}`, pages: pp });

/* THE CHAPTERS STAY IN BATCH ORDER, WHICHEVER BATCH WAS IMPORTED LAST, and
   that is not tidiness. A re-run FILTERS its own chapter out and PUSHES the
   new one, so importing batch 1 after batch 2 left the module as [2, 1] —
   caught by re-running batch 1 and finding it had moved batch 2.

   A chapter's POSITION is an address here: the card set is
   `/m/<mod>/library/cards/<n>` where n is its 1-based index (App's
   `onOpenCards`, `content.cardSet`, `cardChapters`), so a swap silently points
   every bookmarked or shared card-set link at the wrong batch. Ids are safe —
   cards and questions carry their own, so `pw-cards-seen`, `pw-cards-got` and
   every `saves` row are keyed to the content and not to the order — but the
   URL is not, and nothing else would have said so.

   Sorted rather than spliced into place, so the order is a property of the
   document and not of the sequence of runs that built it. */
mod.chapters.sort((a, b) => (a.batch ?? 0) - (b.batch ?? 0));
const at = new Map(mod.chapters.map((c, i) => [c.id, i]));
mod.downloads.sort((a, b) => (at.get(a.id.replace(/\.DL\d+$/, "")) ?? 0) - (at.get(b.id.replace(/\.DL\d+$/, "")) ?? 0));

writeFileSync(CONTENT, `${JSON.stringify(doc, null, 1)}\n`);

const spread = (qs) => { const t = [0, 0, 0]; for (const q of qs) t[q.correct] += 1; return t.join("/"); };
const bolded = cardSet.filter((c) => /\*\*.+?\*\*/.test(c.back)).length;
console.log(`M2 ${ID}  "${bank.title}"  ref ${bank.module.replace(/^M/, "")}  pages ${RANGE}`);
console.log(`  quiz   ${quizQs.length} questions   answers a/b/c ${spread(quizQs)}`);
console.log(`  cards  ${cardSet.length} open-ended (${bolded} with a marked key term)`);
console.log(`  paper  ${FILE}  ${pp}pp`);
console.log(`  author notes stripped from explanations: ${stripped}`);
console.log(`  paper only: the ${bankQs.length}-question full bank (not loaded as cards)`);
