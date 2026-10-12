/* =============================================================================
   PUT THE IMPORTED BATCHES INTO THE CONTENT DOCUMENT, AND THE PAPERS ON THE
   SHELF.
   -----------------------------------------------------------------------------
   Only Module 1 is touched. The other three modules, the module NAMES and
   everything else in the document are carried over as they are: the codes
   never change, because progress, scores and saves are keyed to them.

   THE PAGE COUNT IS READ, NOT TYPED. The row prints it to a student, so it
   comes from the file itself. This runs in node and ships nothing, so pdf.js
   is the right tool here - the rule that keeps it out of the BUILD is about
   `check:paused`, which asserts the reader's libraries never reach the bundle.

     node scripts/batches/build.mjs <batches.json> <dir-of-twenty>
   ========================================================================= */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";

const [BATCHES, IN] = process.argv.slice(2);
if (!BATCHES || !IN) { console.error("usage: build.mjs <batches.json> <dir-of-twenty>"); process.exit(2); }

const ROOT = new URL("../../", import.meta.url);
const CONTENT = new URL("src/content/test-content.json", ROOT);
const PUBLIC = new URL("public/downloads/", ROOT);

const { chapters, downloads } = JSON.parse(readFileSync(BATCHES, "utf8"));
const doc = JSON.parse(readFileSync(CONTENT, "utf8"));

const m1 = doc.modules.find((m) => m.id === "M1");
if (!m1) { console.error("no Module 1 in the content document"); process.exit(1); }

mkdirSync(PUBLIC, { recursive: true });

/* The papers: the Full Set of each batch, under the name the row links to. */
const pagesOf = async (path) => {
  const d = await getDocument({ data: new Uint8Array(readFileSync(path)),
    useSystemFonts: false, isEvalSupported: false }).promise;
  const n = d.numPages; await d.destroy(); return n;
};

console.log("papers:");
for (const [i, dl] of downloads.entries()) {
  const src = `${IN}/b${String(i + 1).padStart(2, "0")}-set.pdf`;
  const name = dl.file.replace(/^downloads\//, "");
  copyFileSync(src, new URL(name, PUBLIC));
  dl.pages = await pagesOf(src);
  console.log(`  ${String(i + 1).padStart(2)}  ${name}  ${dl.pages}pp`);
}

const before = { chapters: m1.chapters.length, downloads: (m1.downloads || []).length };
m1.chapters = chapters;
m1.downloads = downloads;
m1.batches = chapters.length;

writeFileSync(CONTENT, `${JSON.stringify(doc, null, 1)}\n`);

const q = chapters.reduce((n, c) => n + c.quiz.questions.length, 0);
const k = chapters.reduce((n, c) => n + c.cards.length, 0);
console.log(`\nModule 1: ${before.chapters} chapters -> ${chapters.length}, ${before.downloads} papers -> ${downloads.length}`);
console.log(`          ${q} quiz questions, ${k} cards`);
console.log(`modules carried over unchanged: ${doc.modules.filter((m) => m.id !== "M1").map((m) => m.id).join(", ")}`);
console.log(`written: ${CONTENT.pathname}`);
