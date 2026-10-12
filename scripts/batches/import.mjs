/* =============================================================================
   THE TWENTY DOCUMENTS, READ BY GEOMETRY.
   -----------------------------------------------------------------------------
   A Quiz is the quiz and nothing else; a Full Set is the study cards AND the
   paper. Ten batches, so twenty files, NAMED EXPLICITLY below rather than
   globbed: the owner's Downloads folder also holds the superseded Batch 1
   (pages 1-68) and Batch 6 (pages 352-491), whose ranges overlap these, and
   "every M13 file in the folder" would build twelve batches out of ten.

   CLASSIFIED BY x AND HEIGHT, NEVER BY PROSE. These documents are exact, and
   guessing at wording is what makes an importer wrong in ways nobody sees:

     h=20  x=60    the document's title
     h=15  x=60    a topic heading (and, in a Quiz, the single word "Answers")
     h=11  x=60    the subtitle: ref, name, and the page range
     h=10.5 x=60   a question stem, "<n>. ..."
     h=10.5 x=78   that stem, wrapped
     h=10.5 x=82   an option, "a. ..." / "b. ..." / "c. ..."
     h=10.5 x>=91  an option, wrapped
     h=10.5 x=60   "Answers - <topic>", a key block's header
     h=10    x=60  a level heading, "LEVEL 1 - RECALL"
     h=9    x=60   a key row, "<n>. <letter> <why> (L<n>, PDF p. <n>)"
     h=9    x>=91  that row, wrapped
     h=9    x=60   ...or the opening blurb, which shares its height
     h=8.5  x=60   a meta line under a heading
     any    x>200  the running header and the page number

   THE HEIGHT TOLERANCE IS 0.2, NOT 0.6. These step in halves - 20, 15, 11,
   10.5, 10, 9, 8.5 - so a window of 0.6 makes every stem (10.5) match the
   subtitle (11) and the level heading (10). That was measured once at 152
   warnings out of a single file with nothing read at all.

   THE BLURB AND THE KEY SHARE A HEIGHT, and only WHERE they are tells them
   apart: the blurb is the prose before the first topic heading. A key row is
   also recognisable by its shape, "<n>. <letter> ", which the blurb never has,
   so both tests are applied.

   THE KEY IS NOT ALWAYS A SECTION AT THE END. A Quiz carries one "Answers"
   heading (h=15) with the per-topic blocks under it; a Full Set has no such
   heading and puts an "Answers - <topic>" block after each topic as it goes.
   What hands over from questions to a key is the "Answers - ..." line itself,
   in both.

   ANYTHING IT CANNOT PLACE IS REPORTED, NEVER ASSUMED. A line that matches no
   rule is a warning with its page, its geometry and its text; a question whose
   key is missing, or whose key names a letter that is not among its options,
   is a hard error. An importer that quietly answered "a" would put a wrong
   answer in front of a student with nothing to show for it.

     node scripts/batches/import.mjs <dir-of-twenty> <out.json>
   ========================================================================= */
import { linesOf } from "./lines.mjs";
import { writeFileSync } from "node:fs";

const RANGES = { 1: "1-63", 2: "64-155", 3: "156-231", 4: "232-321", 5: "322-448",
                 6: "449-562", 7: "563-650", 8: "651-767", 9: "768-917", 10: "918-1008" };

const near = (a, b) => Math.abs(a - b) <= 0.2;
const at = (l, x) => near(l.x, x);
const EN = "–";                                   // the en dash the documents use

const warn = [];
const fail = [];

/* ----------------------------------------------------------------- parsing */
function parse(lines, { batch, kind }) {
  const body = lines.filter((l) => l.x < 200);         // drop header and page number
  const doc = { title: "", ref: "", name: "", pages: "", questions: [], keys: new Map(), blurb: "" };

  let q = null;                 // the question being built
  let inKeys = false;           // past an "Answers - ..." line
  let key = null;               // the key row being built
  let seenTopic = false;

  const pushQ = () => { if (q) { doc.questions.push(q); q = null; } };
  const pushK = () => { if (key) { doc.keys.set(key.n, key); key = null; } };

  for (const l of body) {
    const t = l.text;

    if (near(l.h, 20) && at(l, 60)) { doc.title = t; continue; }
    if (near(l.h, 11) && at(l, 60)) {
      const m = new RegExp(`^(M13\\.[0-9.]+)\\s+(.*?)\\s+·\\s+PDF pages\\s+(\\d+)[${EN}-](\\d+)`).exec(t);
      if (!m) { warn.push(`b${batch} ${kind} p${l.page}: a subtitle that does not parse - ${t}`); continue; }
      doc.ref = m[1].replace(/^M/, ""); doc.name = m[2]; doc.pages = `${m[3]}${EN}${m[4]}`;
      continue;
    }
    /* A topic heading, or the Quiz's single "Answers". Both end whatever was
       being built. */
    if (near(l.h, 15) && at(l, 60)) { pushQ(); pushK(); seenTopic = true; inKeys = /^Answers$/i.test(t); continue; }
    if (near(l.h, 10) && at(l, 60)) { pushQ(); pushK(); continue; }              // LEVEL n - ...

    /* The hand-over from questions to a key, in both kinds of document. */
    if (near(l.h, 10.5) && at(l, 60) && /^Answers\s*[—-]/.test(t)) { pushQ(); pushK(); inKeys = true; continue; }

    if (near(l.h, 10.5) && at(l, 60)) {
      const m = /^(\d+)\.\s+(.*)$/.exec(t);
      if (m) { pushQ(); pushK(); inKeys = false; q = { n: Number(m[1]), stem: m[2], options: [] }; continue; }
      warn.push(`b${batch} ${kind} p${l.page}: x=${l.x} h=${l.h} is not a stem - ${t.slice(0, 60)}`);
      continue;
    }
    if (near(l.h, 10.5) && at(l, 78)) {                                          // stem, wrapped
      if (q && !q.options.length) { q.stem += ` ${t}`; continue; }
      warn.push(`b${batch} ${kind} p${l.page}: a wrap with no stem open - ${t.slice(0, 60)}`); continue;
    }
    if (near(l.h, 10.5) && at(l, 82)) {
      const m = /^([abc])\.\s+(.*)$/.exec(t);
      if (m && q) { q.options.push({ letter: m[1], text: m[2] }); continue; }
      warn.push(`b${batch} ${kind} p${l.page}: an option with no question open - ${t.slice(0, 60)}`); continue;
    }
    if (near(l.h, 10.5) && l.x >= 91) {                                          // option, wrapped
      if (q && q.options.length) { q.options[q.options.length - 1].text += ` ${t}`; continue; }
      warn.push(`b${batch} ${kind} p${l.page}: an option wrap with nothing to join - ${t.slice(0, 60)}`); continue;
    }

    if (near(l.h, 9) && at(l, 60)) {
      const m = /^(\d+)\.\s+([abc])\s+(.*)$/.exec(t);
      if (m && (inKeys || seenTopic)) { pushK(); key = { n: Number(m[1]), letter: m[2], why: m[3] }; continue; }
      /* THE BLURB SHARES THIS HEIGHT. Before the first topic heading it is
         prose about the document, not a key. */
      if (!seenTopic) { doc.blurb = doc.blurb ? `${doc.blurb} ${t}` : t; continue; }
      warn.push(`b${batch} ${kind} p${l.page}: h=9 at x=60 that is neither key nor blurb - ${t.slice(0, 60)}`);
      continue;
    }
    /* A KEY ROW WRAPS AT EITHER HEIGHT. Most continuations are h=9, but the
       tail of one - "(L3, PDF p. 38)" - breaks at h=8.5, and a blanket
       "h=8.5 is a meta line, skip it" rule swallowed 92 of them WITHOUT A
       WARNING, leaving explanations truncated at "(L3, PDF p.". A catch-all
       skip is how "report, never assume" gets quietly defeated: the test is
       the INDENT, which only a continuation has, and the height is allowed to
       be either. */
    if ((near(l.h, 9) || near(l.h, 8.5)) && l.x >= 91) {
      if (key) { key.why += ` ${t}`; continue; }
      if (!seenTopic) { doc.blurb += ` ${t}`; continue; }
      warn.push(`b${batch} ${kind} p${l.page}: a key wrap with nothing to join - ${t.slice(0, 60)}`); continue;
    }
    /* Meta lines sit at the margin, under a heading. Narrowed to x=60 so that
       nothing indented can fall in here again. */
    if (near(l.h, 8.5) && at(l, 60)) continue;
    warn.push(`b${batch} ${kind} p${l.page}: unplaced x=${l.x} h=${l.h} - ${t.slice(0, 60)}`);
  }
  pushQ(); pushK();
  return doc;
}

/* ------------------------------------------------------------- joining them */
function join(doc, { batch, kind, idBase, prefix, pad }) {
  const out = [];
  for (const q of doc.questions) {
    const k = doc.keys.get(q.n);
    if (!k) { fail.push(`b${batch} ${kind}: question ${q.n} has no answer in the key`); continue; }
    if (q.options.length !== 3) {
      fail.push(`b${batch} ${kind}: question ${q.n} has ${q.options.length} options, not 3`); continue;
    }
    const correct = q.options.findIndex((o) => o.letter === k.letter);
    if (correct < 0) {
      fail.push(`b${batch} ${kind}: question ${q.n}'s key says "${k.letter}" and its options are ${q.options.map((o) => o.letter).join("/")}`);
      continue;
    }
    /* THE LEVEL AND THE MANUAL PAGE COME OUT. "(L3, PDF p. 24)" is how the
       author tracked the question; it is not something to show a student
       inside an explanation. */
    const explain = k.why.replace(/\s*\(L\d+,\s*PDF p\.\s*\d+\)\s*$/i, "").trim();
    const n = out.length + 1;
    out.push({
      id: `${idBase}.${prefix}${pad ? String(n).padStart(pad, "0") : n}`,
      question: q.stem.replace(/\s*●\s*$/, "").trim(),
      options: q.options.map((o) => o.text.replace(/\s*●\s*$/, "").trim()),
      correct,
      explain,
    });
  }
  return out;
}

/* -------------------------------------------------------------------- main */
const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT) { console.error("usage: import.mjs <dir-of-twenty> <out.json>"); process.exit(2); }

const chapters = [];
const downloads = [];
let seenTo = 0;

for (let b = 1; b <= 10; b++) {
  const id = `M1.V${b}`;
  const two = String(b).padStart(2, "0");
  const quiz = parse(await linesOf(`${IN}/b${two}-quiz.pdf`), { batch: b, kind: "quiz" });
  const set = parse(await linesOf(`${IN}/b${two}-set.pdf`), { batch: b, kind: "set" });

  /* THE TWO HALVES MUST AGREE. A Quiz and a Full Set that disagree about the
     name or the range are not the same batch, and pairing them would put one
     batch's questions under another's heading. */
  if (quiz.name !== set.name) fail.push(`b${b}: quiz says "${quiz.name}", set says "${set.name}"`);
  if (quiz.pages !== set.pages) fail.push(`b${b}: quiz says pages ${quiz.pages}, set says ${set.pages}`);
  if (quiz.ref !== set.ref) fail.push(`b${b}: quiz says ref ${quiz.ref}, set says ${set.ref}`);

  /* AND THE RANGES MUST TILE THE MANUAL - no gap and no overlap. This is what
     catches a superseded file whose range straddles two of these. */
  const [from, to] = quiz.pages.split(EN).map(Number);
  if (from !== seenTo + 1) fail.push(`b${b}: pages start at ${from}, but the batch before ended at ${seenTo}`);
  seenTo = to;
  if (`${from}-${to}` !== RANGES[b]) fail.push(`b${b}: pages ${from}-${to} are not the expected ${RANGES[b]}`);

  const questions = join(quiz, { batch: b, kind: "quiz", idBase: id, prefix: "Q" });
  const cards = join(set, { batch: b, kind: "set", idBase: id, prefix: "C", pad: 3 });
  if (questions.length !== 40) fail.push(`b${b}: ${questions.length} quiz questions, not 40`);

  chapters.push({
    id, name: quiz.name, cardsName: `${set.title} · pages ${set.pages}`,
    lessons: [],
    quiz: { id: `${id}.QZ`, name: `${quiz.title} · pages ${quiz.pages}`, questions },
    cards, batch: b, ref: quiz.ref, pages: quiz.pages,
  });
  downloads.push({ id: `${id}.DL1`, title: `${set.title} · pages ${set.pages}`,
                   file: `downloads/M13-Batch-${b}-Full-Set-pages-${from}-${to}.pdf`, pages: null });
}

/* ------------------------------------------------------ the spread, checked */
const spread = (qs) => { const c = [0, 0, 0]; for (const q of qs) c[q.correct] += 1; return c; };
console.log("\nbatch  ref     pages        quiz  cards   quiz a/b/c     cards a/b/c");
for (const c of chapters) {
  const q = spread(c.quiz.questions), k = spread(c.cards);
  console.log(`  ${String(c.batch).padStart(2)}   ${c.ref.padEnd(6)} ${c.pages.padEnd(12)} ${String(c.quiz.questions.length).padStart(4)} ${String(c.cards.length).padStart(6)}   ${q.join("/").padEnd(12)}  ${k.join("/")}`);
}
const totalQ = chapters.reduce((n, c) => n + c.quiz.questions.length, 0);
const totalC = chapters.reduce((n, c) => n + c.cards.length, 0);
console.log(`\n  ${chapters.length} chapters, ${totalQ} quiz questions, ${totalC} cards`);

if (warn.length) {
  console.log(`\n  ${warn.length} line(s) the converter could not place:`);
  for (const w of warn.slice(0, 20)) console.log(`    ${w}`);
  if (warn.length > 20) console.log(`    ... and ${warn.length - 20} more`);
}
if (fail.length) {
  console.log(`\n  ${fail.length} REFUSAL(S):`);
  for (const f of fail) console.log(`    ${f}`);
  process.exit(1);
}
writeFileSync(OUT, JSON.stringify({ chapters, downloads }, null, 1));
console.log(`\n  written to ${OUT}${warn.length ? " (with warnings above)" : " with zero warnings"}`);
