/* =============================================================================
   READING A .docx OF QUESTIONS, IN THE BROWSER.
   -----------------------------------------------------------------------------
   The owner writes question sets in Word and has been handing them over for
   somebody else to convert. This is that conversion, moved into the app so an
   admin can do it themselves: drop the file, see what came out, use it.

   WHAT IT UNDERSTANDS is the shape every one of those documents has had:

       1. A question, numbered, on its own line
       a.  an option
       b.  another
       c.  a third
       ...
       Answer key            <- a table
       No. | Ans | Level | LTT page | Why

   so a question is a paragraph starting `<n>.`, an option is one starting
   `a.`, `b.` or `c.`, and the key is the one table whose first cell is a
   number. Nothing else in the document matters: headings, subtitles and notes
   are read for the title and otherwise ignored.

   NO LIBRARY. A .docx is a ZIP of XML, and both halves are in the platform:
   `DecompressionStream("deflate-raw")` inflates an entry, and the XML is
   simple enough — machine-written, no CDATA, no entities beyond the five —
   that a scan beats pulling in a parser for it. The same file runs in Node,
   which is how check:studio drives it against a fixture it builds itself.

   WHAT IT REFUSES TO GUESS. A question with no key row, a key letter with no
   matching option, fewer than two options: each is reported as a warning
   against that question's number rather than silently dropped or answered
   with a guess. The screen shows them and will not import until they are
   dealt with, because a quiz with a wrong answer in it is worse than no quiz.
   ========================================================================= */

const dec = new TextDecoder();
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Raw bytes of one file inside a ZIP, by name. Null when it is not there. */
export async function unzipEntry(buf, want) {
  const b = new Uint8Array(buf);
  /* The central directory is at the end, behind a comment of unknown length,
     so the End Of Central Directory record is found by scanning back for its
     signature. */
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i -= 1) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  let p = u32(b, eocd + 16);                       // where the directory starts
  const count = u16(b, eocd + 10);
  for (let n = 0; n < count; n += 1) {
    if (u32(b, p) !== 0x02014b50) return null;
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    if (name === want) {
      /* The local header repeats the name and extra field, and its lengths
         are the ones that count — a writer may pad them differently. */
      const lnLen = u16(b, local + 26);
      const leLen = u16(b, local + 28);
      const start = local + 30 + lnLen + leLen;
      const raw = b.subarray(start, start + size);
      if (method === 0) return raw;                // stored
      const ds = new DecompressionStream("deflate-raw");
      const out = new Response(new Blob([raw]).stream().pipeThrough(ds));
      return new Uint8Array(await out.arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const unescape = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&");
const tidy = (s) => unescape(s).replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** Every paragraph of a document.xml, in order, as plain text. */
export function paragraphsOf(xml) {
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map((m) => tidy([...m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join("")));
}

/** Every table, as rows of plain-text cells. */
export function tablesOf(xml) {
  return [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((t) =>
    [...t[0].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) =>
      [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) =>
        tidy([...c[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join(" ")))));
}

const QRE = /^(\d+)\.\s+(.*\S)\s*$/;
const ORE = /^([a-z])\.\s+(.*\S)\s*$/i;

/**
 * Questions, their options and the answer key, out of a document.xml string.
 * Returns { title, subtitle, questions, warnings } where a question is
 * { n, question, options, correct, explain } and `correct` is null when the
 * key could not decide it.
 */
export function readQuestionsXml(xml) {
  const paras = paragraphsOf(xml);
  const questions = [];
  let cur = null;
  for (const line of paras) {
    const q = QRE.exec(line);
    if (q) { if (cur) questions.push(cur); cur = { n: Number(q[1]), question: q[2], options: [], letters: [] }; continue; }
    const o = ORE.exec(line);
    if (o && cur) { cur.letters.push(o[1].toLowerCase()); cur.options.push(o[2]); }
  }
  if (cur) questions.push(cur);

  /* The key is the table whose rows start with a number. A document with no
     such table is not refused: every question simply carries a warning. */
  const key = new Map();
  for (const rows of tablesOf(xml)) {
    for (const r of rows) {
      if (r.length < 2 || !/^\d+$/.test(r[0])) continue;
      key.set(Number(r[0]), { ans: (r[1] || "").trim().toLowerCase(), why: (r[4] || "").trim() });
    }
  }

  const warnings = [];
  const out = questions.map((q) => {
    const k = key.get(q.n);
    let correct = null;
    if (!k) warnings.push({ n: q.n, why: "no row in the answer key" });
    else if (!q.letters.includes(k.ans)) warnings.push({ n: q.n, why: `the key says "${k.ans}", which is not one of its options` });
    else correct = q.letters.indexOf(k.ans);
    if (q.options.length < 2) warnings.push({ n: q.n, why: `only ${q.options.length} option${q.options.length === 1 ? "" : "s"}` });
    return { n: q.n, question: q.question, options: q.options, correct, explain: k?.why || "" };
  });

  const title = paras.find((p) => p && !QRE.test(p) && !ORE.test(p)) || "";
  const subtitle = paras.filter((p) => p && !QRE.test(p) && !ORE.test(p))[1] || "";
  return { title, subtitle, questions: out, warnings };
}

/** The whole job: a File or ArrayBuffer in, questions out. */
export async function readQuestionsDocx(fileOrBuffer) {
  const buf = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const entry = await unzipEntry(buf, "word/document.xml");
  if (!entry) throw new Error("That does not look like a Word document — no word/document.xml inside it.");
  return readQuestionsXml(dec.decode(entry));
}
