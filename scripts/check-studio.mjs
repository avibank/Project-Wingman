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
  const model = readFileSync("src/components/admin/studioModel.js", "utf8");
  ok("gate", "the page count is read from the PDF rather than typed",
     /export function countPdfPages/.test(model) && /countPdfPages\(new Uint8Array/.test(studio));
  /* AND WITHOUT pdf.js: papers are paused, and check:paused asserts none of
     the reader's libraries reach the build. One import of the app's own
     pdf.js put a 357KB chunk back into it. */
  ok("gate", "and without reaching for the reader's pdf.js",
     !/paperText|pdfjs-dist/.test(studio) && !/paperText|pdfjs-dist/.test(model));
  ok("gate", "and a question with no answer cannot be exported",
     /no right answer chosen/.test(model) && /disabled=\{faults\.length > 0\}/.test(studio));
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
  /* AND IT CHECKS THE BYTES, not the status: this app answers every unknown
     path with index.html and a 200, so `r.ok` called every missing paper
     present (measured on the way in). */
  ok("course", "a publish checks every paper is actually on the server",
     /const missingPapers = async/.test(studio) && /is not on the server yet/.test(studio)
     && /head !== "%PDF-"/.test(studio) && !/method: "HEAD"/.test(studio));
  ok("course", "and the key is never written into the repo",
     !/[A-Za-z0-9_-]{22,}/.test((studio.match(/PUBKEY[\s\S]{0,200}/) || [""])[0].replace("wingman.studio.key", "")));
}

console.log("\nwriting three hundred questions");
{
  /* THE MODEL IS DRIVEN, not read. These are the parts a tidy-up can break
     silently — an id re-issued into the wrong space, a filtered list that
     renumbered — so `studioModel.js` is a plain module precisely so this
     block can call it. */
  const M = await import("../src/components/admin/studioModel.js");

  const q = (id, text, opts = ["a", "b", "c"], correct = 0, explain = "") =>
    ({ id, question: text, options: opts, correct, explain });
  const chapter = () => ({
    id: "M1.09", name: "Pitot-Static",
    quiz: { id: "M1.09.QZ", questions: [q("M1.09.Q1", "What feeds the ASI"), q("M1.09.Q2", "Static port blocked")] },
    cards: [q("M1.09.C001", "Pitot heat"), q("M1.09.C002", "Altimeter setting")],
  });

  /* --- ids ---------------------------------------------------------------- */
  ok("ids", "a new question takes the first free id in its own space",
     M.nextId(chapter(), "quiz") === "M1.09.Q3" && M.nextId(chapter(), "cards") === "M1.09.C003");
  {
    /* A BATCH HAS TO AVOID ITSELF. Eight copies issued from a set rebuilt
       between them would all be the ninth. */
    const c = chapter();
    const taken = M.idsIn(c);
    const made = [1, 2, 3].map(() => { const id = M.nextId(c, "cards", taken); taken.add(id); return id; });
    ok("ids", "and a batch of them avoids each other, not just the document",
       new Set(made).size === 3 && made.join() === "M1.09.C003,M1.09.C004,M1.09.C005", made.join());
  }
  {
    const c = chapter();
    const picked = c.quiz.questions;
    const made = M.copiedInto(c, "cards", picked);
    ok("copy", "copying into the other exercise re-issues every id in its space",
       made.length === 2 && made.every((x) => /^M1\.09\.C\d{3}$/.test(x.id))
       && new Set(made.map((x) => x.id)).size === 2
       && !made.some((x) => M.idsIn(c).has(x.id)), made.map((x) => x.id).join());
    ok("copy", "and brings the question, the answers and the right one with it",
       made[0].question === picked[0].question && made[0].correct === picked[0].correct
       && made[0].options.join() === picked[0].options.join());
    ok("copy", "and does not touch what it copied",
       picked[0].id === "M1.09.Q1" && c.cards.length === 2);
  }

  /* --- finding ------------------------------------------------------------ */
  ok("find", "a word is a word", M.askedFor("static port").kind === "text");
  ok("find", "a bare number is a PLACE, and so is #212",
     M.askedFor("212").at === 212 && M.askedFor("#212").at === 212 && M.askedFor("0").kind === "text");
  {
    const list = chapter().quiz.questions;
    ok("find", "it reads the stem", M.shownList(list, "asi").length === 1);
    ok("find", "and the id, which is what a bookmark names",
       M.shownList(list, "M1.09.Q2").length === 1);
    ok("find", "and every word has to be in it",
       M.shownList(list, "static blocked").length === 1 && M.shownList(list, "static feeds").length === 0);
    ok("find", "and the answers and the reason",
       M.shownList([q("X.Q1", "stem", ["bellows", "b", "c"], 0, "because the capsule")], "bellows").length === 1
       && M.shownList([q("X.Q1", "stem", ["a", "b", "c"], 0, "because the capsule")], "capsule").length === 1);
    /* THE LOAD-BEARING HALF. Every edit addresses the document's list, so a
       filtered view that renumbered would delete the wrong question. */
    const long = Array.from({ length: 50 }, (_, i) => q(`X.Q${i + 1}`, i === 41 ? "static port" : `stem ${i}`));
    ok("find", "and what it hands back is each question's REAL index",
       M.shownList(long, "static port")[0][1] === 41 && M.shownList(long, "#42")[0][1] === 41
       && M.shownList(long, "#51").length === 0);
  }

  /* --- faults ------------------------------------------------------------- */
  {
    const doc = { modules: [{ id: "M1", name: "Module 13d", chapters: [chapter()] }] };
    ok("faults", "a clean chapter has none", M.faultList(doc).length === 0);
    const bad = JSON.parse(JSON.stringify(doc));
    bad.modules[0].chapters[0].quiz.questions[1] = { id: "M1.09.Q2", question: "  ", options: ["a"], correct: 7 };
    const f = M.faultList(bad);
    ok("faults", "and a broken one names the question, the exercise and the place",
       f.length === 3 && f.every((x) => x.id === "M1.09.Q2" && x.kind === "quiz" && x.i === 1 && x.ci === 0),
       f.map((x) => x.why).join(" · "));
    const dup = JSON.parse(JSON.stringify(doc));
    dup.modules[0].chapters[0].cards[1].id = "M1.09.C001";
    ok("faults", "and one id used twice is a fault, across quiz and cards both",
       M.faultList(dup).some((x) => /used twice/.test(x.why)));
    ok("faults", "and the footer's sentences are those same faults",
       M.faultsOf(bad).length === 3 && /no question/.test(M.faultsOf(bad).join(" ")));
  }
}

const css = readFileSync("src/components/admin/studio.css", "utf8");
ok("caution", "a broken question says so in a measured colour, and only its edge is caution",
   /\.st-warn \{[^}]*color: var\(--t2\)/.test(css) && /\.st-q\.is-broken \{[^}]*var\(--caution\)/.test(css),
   "the word 'needs a look' must not be --caution: 2.24:1 on Beacon in Day");

console.log("\nand it is legible on every skin");
{
  /* THE OWNER PHOTOGRAPHED IT UNREADABLE under Aurora (2026-09-30): the
     screen was laid on the deck, so its words were on a moving sky. It sits
     on `--panel` now, which is a colour the palette knows — and a colour the
     palette knows can be MEASURED, which is this block.

     The method is check:rr's, which is check:contrast's: linear light, each
     surface composited over its own ground, every livery, both lightings and
     all three finishes. Small mono labels count as body text, so the floor is
     4.5 for all of it. */
  const { LIVERIES, deckVars } = await import("../src/lib/liveryEngine.js");
  const { finishVars } = await import("../src/lib/finishEngine.js");
  const toLin = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s2 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2].map((x) => Math.min(1, Math.max(0, x)));
  };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
    if (!m) return null;
    const h = (+m[3] * Math.PI) / 180;
    return { lab: [+m[1], +m[2] * Math.cos(h), +m[2] * Math.sin(h)], a: m[4] === undefined ? 1 : +m[4] };
  };
  const over = (fg, bg) => toLin(fg.lab).map((v, i) => bg[i] + (v - bg[i]) * fg.a);

  const FLOOR = 4.5;
  const worst = { r: 99, where: "" };
  const under = [];
  let measured = 0;
  for (const L of LIVERIES) {
    for (const variant of ["night", "day"]) {
      for (const finish of [null, "aurora", "manual"]) {
        /* Aurora has no day: App.jsx forces the night variant on it, so the
           pair does not exist and measuring it would be measuring nothing. */
        if (finish === "aurora" && variant === "day") continue;
        const base = deckVars(L.id, variant).vars;
        const v = { ...base, ...finishVars(L.id, variant, finish, base["--active"]) };
        const t = (k) => parse(v[k]);
        const ground = toLin(t("--ground").lab);
        const panel = over(t("--panel"), ground);
        const raised = over(t("--raised"), panel);
        /* studio.css's own last rule, which is Bookmarks' rule: Manual in Day
           leaves `--active-fill` at the accent's lightness, so a filled
           control takes `--active-text`, the ink the finish darkened. */
        const fillTok = finish === "manual" && variant === "day" ? "--active-text" : "--active-fill";
        const fill = over(t(fillTok) || t("--active"), panel);
        const pairs = [
          ["the heading and the buttons", t("--t1"), panel],
          ["the prose and the version line", t("--t2"), panel],
          ["a chapter's counts, a question's id, an answer's letter", t("--t2"), raised],
          ["the text being typed, in its field", t("--t1"), ground],
          ["a broken question's \u201cneeds a look\u201d", t("--t2"), raised],
          ["and Publish's own word", t("--ground"), fill],
        ];
        /* THE CAUTION EDGE IS NOT MEASURED, and that is the finding rather
           than an exemption. Asked for 3:1 as a graphic it came in at 2.24:1
           on Beacon in Day and under 2.4 on five other liveries — because
           Day's caution is an annunciator amber lit to be read as a LAMP on
           a dark face, which is the only place this app draws it (the module
           card, the gyro needle). On a light `--raised` there is no step
           available that is still amber. So the edge stays redundant: the
           meaning is in the word beside it, in `--t2`, which IS measured
           above — and the assertion that holds that is the source one below,
           which refuses caution as the colour of a word on this screen. */
        for (const [what, fg, bg] of pairs) {
          if (!fg) { under.push(`${L.id}/${variant}/${finish || "standard"}: ${what} has no colour`); continue; }
          const r = ratio(over(fg, bg), bg);
          measured += 1;
          const where = `${L.id}/${variant}/${finish || "standard"} — ${what}`;
          if (r < worst.r) { worst.r = r; worst.where = where; }
          if (r < FLOOR) under.push(`${where}: ${r.toFixed(2)}:1`);
        }
      }
    }
  }
  ok("legible", `every word on the Studio clears ${FLOOR}:1 on the surface behind it (${measured} pairs)`,
     under.length === 0, under.slice(0, 4).join(" · "));
  console.log(`       the closest is ${worst.where} at ${worst.r.toFixed(2)}:1`);
}

console.log(`\nstudio: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
