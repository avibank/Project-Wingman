#!/usr/bin/env node
/* =============================================================================
   THE FIVE MOCK EXAMS, READ BY GEOMETRY.
   -----------------------------------------------------------------------------
   Owner, 2026-10-15: five mock exams go on the end of Module 13d, lettered A
   to E, "spanning 1 to 5" — so `M13D Mock Exam 1.pdf` is Mock Exam A and
   `… 5.pdf` is Mock Exam E. Each one covers the whole subject rather than a
   slice of it, which is why they are lettered and not numbered.

   ONE DOCUMENT CARRIES ALL THREE THINGS. The ten numbered batches came as a
   Quiz and a Full Set; a mock is a single file holding the paper, its forty
   questions and the answer key. So the quiz comes out of it, the card set is
   left to fall back to those same questions (`content.cardSet` does that when
   a chapter has no `cards`), and the file itself goes on the Papers shelf.

   READ BY GEOMETRY, NEVER BY PROSE. The census across all five files, taken
   before a line of this was written:

     x=78  h=10.5   600  an option            (5 files x 40 x 3, exactly)
     x=55  h=10.5   225  a stem, or a topic heading
     x=55  h= 9.5   225  a key row, or the opening blurb
     x=75  h=10.5    88  a stem's wrap
     x=258 h= 8.0    35  the running footer
     x=88  h= 9/9.5  59  a key row's wrap
     x=93  h=10.5     4  AN OPTION'S WRAP — four in five files, and the band
                         that would have been silently lost had this been
                         generalised from one document instead of counted
     x=55  h=20/15/8.5  the title, "Answer key", and its subheading

   THE TOLERANCE IS 0.2, because these step in halves at the bottom — 9.5, 9.0,
   8.5, 8.0 — and a window of 0.6 reaches the next meaning along. CLAUDE.md
   records 152 warnings out of one file and nothing read at all, from exactly
   that.

   WHAT HANDS OVER TO THE KEY is the "Answer key" line itself (h=15), not a
   position in the file: these are the Quiz shape, with one key at the end.
   It matters because the opening blurb and a key row are BOTH x=55 h=9.5 and
   only where they sit tells them apart.

   ANYTHING IT CANNOT PLACE IS REPORTED AND THE RUN FAILS. Nothing is guessed:
   an importer that quietly answered "A" would put a wrong answer in front of
   a student with nothing to show for it.
   ========================================================================= */
import { readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const HOME = process.env.HOME;
/* NAMED EXPLICITLY, never "every PDF in the folder". That rule is what caught
   the superseded Batch 1 and Batch 6 still sitting in Downloads on 2026-10-08
   and stopped ten batches being built as twelve. */
const FILES = [
  { n: 1, letter: "A", batch: 11, file: `${HOME}/Downloads/M13D Mock Exam 1.pdf` },
  { n: 2, letter: "B", batch: 12, file: `${HOME}/Downloads/M13D Mock Exam 2.pdf` },
  { n: 3, letter: "C", batch: 13, file: `${HOME}/Downloads/M13D Mock Exam 3.pdf` },
  { n: 4, letter: "D", batch: 14, file: `${HOME}/Downloads/M13D Mock Exam 4.pdf` },
  { n: 5, letter: "E", batch: 15, file: `${HOME}/Downloads/M13D Mock Exam 5.pdf` },
];

const near = (a, b) => Math.abs(a - b) < 0.2;
const at = (x, want) => Math.abs(x - want) < 3;

const warnings = [];
const warn = (where, why, line) => warnings.push(`${where}: ${why} — ${JSON.stringify(line).slice(0, 120)}`);

/** Every line of a page, joined by baseline, with its x and its height. */
async function linesOf(doc, p) {
  const tc = await (await doc.getPage(p)).getTextContent();
  const by = new Map();
  for (const it of tc.items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    if (!by.has(y)) by.set(y, { y, x: it.transform[4], h: Math.abs(it.transform[0]) || it.height, s: "" });
    by.get(y).s += it.str;
  }
  return [...by.values()].filter((l) => l.s.trim()).sort((a, b) => b.y - a.y);
}

/* THE LEVEL AND THE MANUAL PAGE COME OUT OF THE EXPLANATION, never shown to a
   student inside it: "(L3, PDF p. 365)" is the author's own marking-up. */
const TAIL = /\s*\((L[123])(?:,\s*PDF\s*p\.?\s*(\d+))?\)\s*$/i;

async function readMock(spec) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(spec.file)), useSystemFonts: true }).promise;
  const where = `Mock ${spec.n}`;
  const qs = [];
  const key = new Map();
  let phase = "front";        // front -> questions -> key
  let cur = null;             // the question being built
  let krow = null;            // the key row being built

  for (let p = 1; p <= doc.numPages; p++) {
    for (const l of await linesOf(doc, p)) {
      const s = l.s.replace(/\s+/g, " ").trim();
      const { x, h } = l;

      if (near(h, 8.0) && x > 200) continue;                     // running footer
      if (near(h, 20.0)) { continue; }                            // the title
      if (near(h, 8.5)) { continue; }                             // the key's subheading
      if (near(h, 15.0)) { phase = "key"; krow = null; continue; } // "Answer key" hands over

      if (phase === "key") {
        if (at(x, 55) && (near(h, 9.5) || near(h, 9.0))) {
          const m = s.match(/^(\d+)\.\s+([ABC])\s+(.*)$/);
          if (!m) { warn(where, "a key row that does not read '<n>. <A|B|C> …'", s); continue; }
          krow = { n: Number(m[1]), letter: m[2], text: m[3] };
          key.set(krow.n, krow);
          continue;
        }
        if (at(x, 88) && (near(h, 9.5) || near(h, 9.0))) {
          if (!krow) { warn(where, "a key continuation before any key row", s); continue; }
          krow.text += ` ${s}`;
          continue;
        }
        warn(where, `unplaceable in the key (x=${Math.round(x)} h=${h.toFixed(1)})`, s);
        continue;
      }

      if (near(h, 9.5) && at(x, 55)) {
        if (phase === "front") continue;                          // the opening blurb
        warn(where, "9.5pt prose among the questions", s);
        continue;
      }

      if (near(h, 10.5)) {
        if (at(x, 55)) {
          const m = s.match(/^(\d+)\.\s+(.*)$/);
          if (m) {
            phase = "questions";
            cur = { n: Number(m[1]), stem: m[2], options: [] };
            qs.push(cur);
            continue;
          }
          if (phase === "front") continue;                        // the subtitle
          if (/^[A-Z0-9 ·&(),'\-]+$/.test(s)) continue;           // a TOPIC HEADING, all caps
          warn(where, "a 10.5pt line at the stem column that is neither numbered nor a heading", s);
          continue;
        }
        if (at(x, 75)) {
          if (!cur) { warn(where, "a stem wrap before any stem", s); continue; }
          if (cur.options.length) { warn(where, "a stem wrap after the options had started", s); continue; }
          cur.stem += ` ${s}`;
          continue;
        }
        if (at(x, 78)) {
          const m = s.match(/^([ABC])\.\s+(.*)$/);
          if (!m) { warn(where, "an option that does not read 'A|B|C. …'", s); continue; }
          if (!cur) { warn(where, "an option before any stem", s); continue; }
          cur.options.push({ letter: m[1], text: m[2] });
          continue;
        }
        if (at(x, 93)) {
          if (!cur || !cur.options.length) { warn(where, "an option wrap before any option", s); continue; }
          cur.options[cur.options.length - 1].text += ` ${s}`;
          continue;
        }
      }

      warn(where, `unplaceable (x=${Math.round(x)} h=${h.toFixed(1)})`, s);
    }
  }
  return { qs, key, pages: doc.numPages };
}

const chapters = [];
const downloads = [];
const report = [];

for (const spec of FILES) {
  const { qs, key, pages } = await readMock(spec);
  const where = `Mock ${spec.n} (${spec.letter})`;
  const id = `M1.M${spec.letter}`;

  if (qs.length !== 40) warn(where, `read ${qs.length} questions, expected 40`, "");
  const seen = new Set();
  for (const q of qs) {
    if (seen.has(q.n)) warn(where, `question ${q.n} appears twice`, q.stem);
    seen.add(q.n);
    if (q.options.length !== 3) warn(where, `question ${q.n} has ${q.options.length} options, expected 3`, q.stem);
    if (q.options.map((o) => o.letter).join("") !== "ABC")
      warn(where, `question ${q.n}'s options are not A, B, C in order`, q.options.map((o) => o.letter).join(""));
    if (!key.has(q.n)) warn(where, `question ${q.n} is not answered by the key`, q.stem);
  }
  for (const n of key.keys()) if (!seen.has(n)) warn(where, `the key answers ${n}, which is not a question here`, "");

  const questions = qs.map((q) => {
    const k = key.get(q.n);
    const idx = k ? "ABC".indexOf(k.letter) : -1;
    if (idx < 0) warn(where, `question ${q.n} has no usable answer`, q.stem);
    const raw = (k?.text || "").trim();
    /* The level and the manual page are LIFTED OUT and then dropped. Lifting
       them out is the point — they are the author's marking-up and §10 keeps
       them off a student's screen — but storing them would give these five
       chapters a shape no other chapter has and no screen reads, inside a
       document that is already 1.86MB. `TAIL` is still what does the lifting,
       so a mis-shaped marking-up still fails to match and stays visible,
       which is the loud failure rather than the quiet one. */
    if (raw && !TAIL.test(raw)) warn(where, `question ${q.n}'s answer carries no "(L#, PDF p. #)"`, raw.slice(-60));
    return {
      id: `${id}.Q${q.n}`,
      question: q.stem.trim(),
      options: q.options.map((o) => o.text.trim()),
      correct: idx,
      explain: raw.replace(TAIL, "").trim(),
    };
  });

  const spread = ["A", "B", "C"].map((L, i) => questions.filter((q) => q.correct === i).length);
  report.push(`  Mock ${spec.n} -> ${spec.letter}  ${questions.length} questions  ${pages}pp  spread a/b/c ${spread.join("/")}`);

  chapters.push({
    id,
    name: `Mock Exam ${spec.letter}`,
    lessons: [],
    quiz: { id: `${id}.QZ`, name: `M13D — Mock exam ${spec.n}`, questions },
    batch: spec.batch,
  });
  downloads.push({
    id: `${id}.DL1`,
    title: `M13D — Mock exam ${spec.letter}`,
    file: `downloads/M13D-Mock-Exam-${spec.letter}.pdf`,
    pages,
  });
}

console.log("\n" + report.join("\n"));
if (warnings.length) {
  console.error(`\nREFUSING — ${warnings.length} line(s) could not be placed:`);
  for (const w of warnings.slice(0, 40)) console.error(`  ${w}`);
  process.exit(1);
}
writeFileSync(new URL("./mocks.json", import.meta.url), JSON.stringify({ chapters, downloads }, null, 2));
console.log(`\nzero warnings. wrote scripts/mock/mocks.json`);
