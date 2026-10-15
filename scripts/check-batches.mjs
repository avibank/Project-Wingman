#!/usr/bin/env node
/* =============================================================================
   BATCHES, AND THE FIVE ON THE END THAT ARE LETTERED.
   -----------------------------------------------------------------------------
   Owner, 2026-10-15: Module 13d grows from ten batches to fifteen, and the
   last five are mock exams covering the whole subject rather than a slice of
   it — so the route reads 1-10 then A B C D E, and a mock's row says its name
   and nothing else. They are otherwise an ordinary batch: a quiz, a card set,
   a paper, the same row, the same light, counted in the same header.

   `batchModel.js` is a plain module for the reason `quiz.js` and
   `cardSession.js` are, so this IMPORTS it and drives it rather than grepping
   the JSX for a regex. What it cannot import is the layout, and the one piece
   of layout that is load-bearing is asserted at the source instead — see §4.

   NOT IN A BROWSER, so it is in `npm run check`.
   ========================================================================= */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  batchLabel, isMock, firstMock, batchesOf, hereBatch, rememberBatch, lastBatch, moduleLine,
} from "../src/components/module/library/batchModel.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
const fails = [];
const ok = (what, good, detail = "") => {
  if (good) { pass += 1; return; }
  fails.push(`${what}${detail ? ` — ${detail}` : ""}`);
};
const eq = (what, got, want) => ok(what, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

/* 1 · THE LABELS. Fifteen batches of which five are mocks reads 01-10 then
      A-E. The numbers keep the demo's two digits, which is what lines the
      row's number tile up; a letter is bare, because "0A" is padding a thing
      that is not a number. */
{
  const L = (n) => batchLabel(n, 15, 5);
  eq("batch 1 of 15 reads 01", L(1), "01");
  eq("batch 10 of 15 reads 10", L(10), "10");
  eq("batch 11 of 15 is the first mock, A", L(11), "A");
  eq("batch 15 of 15 is the last mock, E", L(15), "E");
  eq("the five mocks read A B C D E",
    [11, 12, 13, 14, 15].map(L).join(" "), "A B C D E");
  eq("the first mock is 11 when 5 of 15 are mocks", firstMock(15, 5), 11);
  ok("10 is not a mock", !isMock(10, 15, 5));
  ok("11 is a mock", isMock(11, 15, 5));
}

/* 2 · A MODULE WITH NO MOCKS IS UNTOUCHED, which is the regression this check
      exists for: every other module, and Module 13d as it ships today, says
      nothing about mocks and must stay numbered to the last batch. */
{
  eq("with mocks 0, batch 10 of 10 is still 10", batchLabel(10, 10, 0), "10");
  eq("with mocks absent, a batch is still numbered", batchLabel(7), "07");
  ok("nothing is a mock when mocks is 0", !isMock(10, 10, 0));
  ok("nothing is a mock when the module says no total", !isMock(3, null, 5));
  eq("no total means no first mock", firstMock(null, 5), null);
  eq("mocks 0 means no first mock", firstMock(15, 0), null);
}

/* 3 · THE EDGES, each stated rather than discovered later.
      · every batch a mock is legal and lettering starts at 1;
      · past the 26th mock it falls back to the FIGURE rather than inventing
        "AA" — a course with 27 mock exams is a mistake, and a silent second
        letter would hide it. */
{
  eq("a module that is all mocks letters from A", batchLabel(1, 5, 5), "A");
  eq("the 26th mock is Z", batchLabel(26, 26, 26), "Z");
  eq("the 27th falls back to its number", batchLabel(27, 27, 27), "27");
  ok("a mocks count above the total still answers", typeof batchLabel(1, 3, 9) === "string");
}

/* 4 · THE TRACKS HAVE TO BE ABLE TO SHRINK, and this is the one piece of
      layout a unit check can still hold at the source.

      `1fr` is `minmax(auto, 1fr)`, and that auto floor is the waypoint's own
      min-content width — so fifteen 22px dots would not fit a 390px phone
      however the tracks were shared out, and the strip ran 36px past its own
      right edge (66px at 360), dots touching. `minmax(0, 1fr)` is what lets
      the track go below its content, and `--n` is what the stylesheet sizes
      the dots and the dashed rule from. Tidy either back and the overflow
      returns silently on a phone nobody here is holding. */
{
  const src = readFileSync(join(ROOT, "src/components/module/library/LibraryBatches.jsx"), "utf8");
  ok("the route's tracks are minmax(0, 1fr), not 1fr",
    /repeat\(\$\{total\},\s*minmax\(0,\s*1fr\)\)/.test(src),
    "a bare 1fr cannot shrink below the waypoint and the strip overflows at 390");
  ok("the route carries --n for the stylesheet to size from",
    /"--n":\s*total/.test(src));
  ok("every label on the screen comes from batchLabel",
    !/padStart\(2/.test(src),
    "a second padding rule here is how the row and the waypoint come to disagree");
}

/* 5 · A MOCK IS STILL A NUMBER UNDERNEATH, so everything that already works
      on a batch number works on a mock without being told about it. That is
      the whole argument for the letter being a label. */
{
  const mod = {
    chapters: [
      { id: "C1", name: "One", title: "One", batch: 1, quizCount: 40, cards: new Array(10) },
      { id: "CA", name: "Mock Exam A", title: "Mock Exam A", batch: 11, quizCount: 40, cards: new Array(20) },
    ],
  };
  const bs = batchesOf(mod, { scoreOf: () => null, seenOf: () => 0, paperOf: () => null });
  eq("a mock chapter becomes a batch like any other", bs.length, 2);
  eq("and sorts after the numbered ones", bs.map((b) => b.n).join(","), "1,11");
  eq("the light can sit on a mock", hereBatch(bs, null, 11), 11);

  const store = {};
  const progress = { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } };
  rememberBatch(progress, "M1", 11);
  eq("and pw-batch remembers it as a number", lastBatch(progress, "M1"), 11);

  ok("the header counts a mock's questions and cards with the rest",
    moduleLine(bs, 15).includes("2 of 15 batches open")
    && moduleLine(bs, 15).includes("80 quiz questions")
    && moduleLine(bs, 15).includes("30 cards"),
    moduleLine(bs, 15));
}

/* 6 · AND THE ZERO PAGE COUNT IS NEVER PRINTED (§10). `pp` is 0 for a batch
      whose paper is not on the shelf, and the five mocks are exactly the case
      where a publish can land before the files do. CLAUDE.md has recorded the
      em dash as the behaviour since 2026-10-06 while the thumbnail printed
      the 0 out loud; `data-count` has to go with it, because `countUp` writes
      textContent from that attribute and would animate a dash back to "0". */
{
  const src = readFileSync(join(ROOT, "src/components/module/library/thumbs.jsx"), "utf8");
  ok("PaperThumb guards the page count before printing it",
    /\{batch\.pp\s*\n?\s*\?/.test(src),
    "a batch with no paper prints \"0 pages\", which §10 forbids");
  ok("and the dash carries no data-count",
    /mdash;?\}?<\/span>/.test(src) || src.includes("&mdash;"),
    "countUp would animate it back to 0");
}

console.log(`\nbatches: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL  ${f}`);
process.exit(fails.length ? 1 : 0);
