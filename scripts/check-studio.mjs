/* THE STUDIO — the reader that turns a .docx into questions, and the gate
 * that keeps the screen away from students. Run: npm run check:studio
 *
 * The reader is driven against a .docx this file BUILDS, rather than against
 * one of the owner's: a check that needs a file in somebody's Downloads is a
 * check that fails on every other machine. The fixture is a real zip with a
 * real deflate-raw entry, so the same path runs as in a browser — the entry
 * table, the inflate and the XML scan.
 */
import { readFileSync } from "node:fs";
import { readQuestionsXml, readQuestionsDocx } from "../src/lib/docxQuestions.js";

let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* ------------------------------------------------ a .docx, built from scratch */
const para = (t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
const cell = (t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
const row = (...c) => `<w:tr>${c.map(cell).join("")}</w:tr>`;
const DOC = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
${para("A Practice Set")}
${para("2 questions &amp; a key")}
${para("1. What colour is the sky")}
${para("a.  Green")}
${para("b.  Blue")}
${para("c.  Orange")}
${para("2. Which one has no key row")}
${para("a.  This one")}
${para("b.  That one")}
${para("c.  The other")}
${para("Answer key")}
<w:tbl>${row("No.", "Ans", "Level", "LTT page", "Why")}${row("1", "b", "L1", "12", "Rayleigh scattering.")}</w:tbl>
</w:body></w:document>`;

/* A minimal ZIP holding that one entry, deflate-raw, exactly as Word writes
   the container (local header, data, central directory, EOCD). */
async function makeDocx(xml) {
  const enc = new TextEncoder();
  const name = enc.encode("word/document.xml");
  const raw = enc.encode(xml);
  const cs = new CompressionStream("deflate-raw");
  const deflated = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer());
  /* CRC32, because the reader does not check it but a real zip carries one. */
  const table = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let crc = 0xffffffff;
  for (const b of raw) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;

  const put = (arr, n, v, bytes) => { for (let i = 0; i < bytes; i++) arr[n + i] = (v >>> (i * 8)) & 0xff; };
  const local = new Uint8Array(30 + name.length);
  put(local, 0, 0x04034b50, 4); put(local, 4, 20, 2); put(local, 8, 8, 2);
  put(local, 14, crc, 4); put(local, 18, deflated.length, 4); put(local, 22, raw.length, 4);
  put(local, 26, name.length, 2);
  local.set(name, 30);
  const central = new Uint8Array(46 + name.length);
  put(central, 0, 0x02014b50, 4); put(central, 10, 8, 2);
  put(central, 16, crc, 4); put(central, 20, deflated.length, 4); put(central, 24, raw.length, 4);
  put(central, 28, name.length, 2); put(central, 42, 0, 4);
  central.set(name, 46);
  const eocd = new Uint8Array(22);
  put(eocd, 0, 0x06054b50, 4); put(eocd, 8, 1, 2); put(eocd, 10, 1, 2);
  put(eocd, 12, central.length, 4); put(eocd, 16, local.length + deflated.length, 4);
  const out = new Uint8Array(local.length + deflated.length + central.length + eocd.length);
  out.set(local, 0); out.set(deflated, local.length);
  out.set(central, local.length + deflated.length);
  out.set(eocd, local.length + deflated.length + central.length);
  return out.buffer;
}

console.log("reading a document");
{
  const r = readQuestionsXml(DOC);
  ok("read", "every numbered paragraph is a question", r.questions.length === 2, String(r.questions.length));
  ok("read", "its a/b/c paragraphs are its options", r.questions[0].options.join("|") === "Green|Blue|Orange");
  ok("read", "the key's letter becomes the index of the right answer", r.questions[0].correct === 1);
  ok("read", "and its reason becomes the explanation", r.questions[0].explain === "Rayleigh scattering.");
  ok("read", "the title is the first line that is not a question or an option", r.title === "A Practice Set");
  ok("read", "an entity in the text is unescaped once", r.subtitle === "2 questions & a key", r.subtitle);
  /* THE ONE THAT MATTERS: a question the key does not answer is REPORTED,
     never guessed. An importer that quietly answered "a" would put a wrong
     answer in front of a student with nothing to show it had. */
  ok("read", "a question with no key row is refused rather than guessed",
     r.questions[1].correct === null && r.warnings.some((w) => w.n === 2 && /key/.test(w.why)), JSON.stringify(r.warnings));
}

console.log("\nand out of a real .docx container");
{
  const buf = await makeDocx(DOC);
  const r = await readQuestionsDocx(buf);
  ok("zip", "the entry is found in the central directory and inflated", r.questions.length === 2);
  ok("zip", "with the same answers as the XML on its own", r.questions[0].correct === 1);
  let refused = "";
  try { await readQuestionsDocx(new TextEncoder().encode("not a zip at all").buffer); } catch (e) { refused = e.message; }
  ok("zip", "and anything that is not a Word document is refused by name", /Word document/.test(refused), refused);
}

console.log("\nwho can reach it");
{
  const app = readFileSync("src/App.jsx", "utf8");
  const flags = readFileSync("src/lib/flags.js", "utf8");
  const routes = readFileSync("src/lib/routes.js", "utf8");
  const studio = readFileSync("src/components/admin/Studio.jsx", "utf8");
  ok("gate", "the flag is admin-only", /id: "admin\.studio"[^}]*everyone: false/.test(flags));
  ok("gate", "the route exists and is named", /name: "studio"/.test(routes) && /studio: \(\) => "\/studio"/.test(routes));
  ok("gate", "the screen is behind the flag AND the admin check",
     /isAdmin && flags\["admin\.studio"\] \? <Studio \/>/.test(app));
  ok("gate", "and anybody else gets a sentence and a way back, not a 404",
     /The Studio is for admins/.test(app) && /Back to the Flight Deck/.test(app));
  ok("gate", "it is its own chunk", /studio: chunk\(\(\) => import\("\.\/components\/admin\/Studio\.jsx"\)\)/.test(app));
  /* The storage epoch sweeps every `pw-` key when content is replaced, which
     is exactly when somebody is most likely to be part-way through writing
     the replacement. */
  ok("gate", "the draft is NOT under a key the storage epoch sweeps",
     /DRAFT_KEY = "wingman\.studio\.draft"/.test(studio) && !/"pw-studio/.test(studio));
  ok("gate", "the page count is read from the PDF rather than typed",
     /export function countPdfPages/.test(studio) && /countPdfPages\(new Uint8Array/.test(studio));
  /* AND WITHOUT pdf.js: papers are paused, and check:paused asserts none of
     the reader's libraries reach the build. One import of the app's own
     pdf.js put a 357KB chunk back into it. */
  ok("gate", "and without reaching for the reader's pdf.js",
     !/paperText|pdfjs-dist/.test(studio));
  ok("gate", "and a question with no answer cannot be exported",
     /no right answer chosen/.test(studio) && /disabled=\{faults\.length > 0\}/.test(studio));
}

console.log("\nand where the course comes from");
{
  const loader = readFileSync("src/components/module/moduleContent.js", "utf8");
  const store = readFileSync("src/lib/courseStore.js", "utf8");
  const studio = readFileSync("src/components/admin/Studio.jsx", "utf8");
  const flags = readFileSync("src/lib/flags.js", "utf8");
  ok("course", "the published document wins, and the shipped one is the floor",
     /const live = await fetchLiveCourse\(\)/.test(loader) && /return live\.doc/.test(loader)
     && /const m = await fetchCourse\(\)/.test(loader));
  ok("course", "the demo never reads it", /if \(!demoMode && liveContentOn\)/.test(loader));
  ok("course", "a read that is slow or broken falls back rather than throwing",
     /READ_TIMEOUT/.test(store) && /catch \(e\)[\s\S]{0,120}return null/.test(store));
  ok("course", "and a published document is validated before it is used",
     /validateContent\(doc\)/.test(store) && /the published document was refused/.test(store));
  ok("course", "there is one switch that puts everybody back on the bundle",
     /id: "content\.live"/.test(flags) && /liveContentOn/.test(loader));
  ok("course", "the Studio publishes through the RPC, with a key it keeps in the browser",
     /publishCourse\(doc, pubKey\.trim\(\)/.test(studio) && /PUBKEY_KEY = "wingman\.studio\.key"/.test(studio));
  ok("course", "and the key is never written into the repo",
     !/[A-Za-z0-9_-]{22,}/.test((studio.match(/PUBKEY[\s\S]{0,200}/) || [""])[0].replace("wingman.studio.key", "")));
}

console.log(`\nstudio: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
