// §6 — the content shapes a module screen has to survive.
//
// Not a contrast check (check:lesson-contrast does colour across every livery)
// and not a screenshot test. This asks the question those cannot: does the
// geometry and the copy still hold when the content is at its extremes?
//
// The extremes are the ones the brief names — a module at three ages, a module
// far bigger than any that exists today, a lesson nobody has written on, and a
// single note long enough to be a page on its own.
import {
  gapFor, showDots, labelX, labelHalf, pointAt, pathFor, PAD, MIN_GAP, DOT_INK,
} from "../src/lib/routeGeometry.js";
import { densityBuckets, densityPath, DENSITY_MIN } from "../src/lib/lessonSurface.js";
import { filterChapters, placeholderFor } from "../src/lib/moduleSearch.js";
import { movedLine, toHolding, toCaution, cautionCount, holdingCount, recheckSet } from "../src/lib/retention.js";

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
let checked = 0;
const check = (cond, msg) => { checked++; ok(cond, msg); };

// The widths the hero's route actually gets: a phone, a tablet, and a desktop
// card. Measured from the live layout rather than guessed.
const WIDTHS = [240, 300, 420, 656, 720, 1040];
const COUNTS = [1, 3, 4, 12, 20, 40, 64];

// ---------------------------------------------------------------- 1 · route
for (const W of WIDTHS) {
  for (const n of COUNTS) {
    // Nothing may be drawn outside the box, at any size or count.
    const first = pointAt(0, n, W), last = pointAt(n - 1, n, W);
    check(first.x >= PAD - 0.01 && last.x <= W - PAD + 0.01,
      `route n=${n} W=${W}: waypoints outside the padded box (${first.x.toFixed(1)}..${last.x.toFixed(1)})`);
    // The label never overflows either edge — measured as the extent of the
    // TEXT, not of its centre point. Asserting the centre was inside the box
    // was the weaker test, and it passed while the label hung 30px off the
    // left of a 42-chapter card and printed over the module title.
    for (const at of [0, Math.floor(n / 2), n - 1]) {
      const text = `CHAPTER ${at + 1} · YOU ARE HERE`;
      const half = labelHalf(text);
      const lx = labelX(pointAt(at, n, W).x, W, text);
      if (W > half * 2) {
        check(lx - half >= -0.01 && lx + half <= W + 0.01,
          `route n=${n} W=${W} at=${at}: label spans ${(lx - half).toFixed(1)}..${(lx + half).toFixed(1)}, outside 0..${W}`);
      } else {
        check(Math.abs(lx - W / 2) < 0.01,
          `route n=${n} W=${W}: label too wide for the box and not centred`);
      }
    }
    // Dots are shown only while they are far enough apart to read as separate.
    const gap = gapFor(n, W);
    check(showDots(n, W) === (gap >= MIN_GAP),
      `route n=${n} W=${W}: dot rule disagrees with the gap (${gap.toFixed(1)})`);
    if (showDots(n, W)) {
      check(gap >= MIN_GAP, `route n=${n} W=${W}: dots drawn ${gap.toFixed(1)}px apart, under ${MIN_GAP}`);
      // The ink, not the radius: a 10px circle with a 2px stroke is 12px wide,
      // and gaps were being judged against the wrong number.
      check(gap - DOT_INK >= 8 - 0.01,
        `route n=${n} W=${W}: only ${(gap - DOT_INK).toFixed(1)}px of air between waypoints`);
    }
    check(!/NaN|Infinity/.test(pathFor(W)), `route W=${W}: path has a non-finite number`);
  }
}
// The 40-chapter module the brief asks for, at the width it would really get.
check(!showDots(40, 420), "a 40-chapter module still draws dots on a 420px card");
// The case that was actually caught by looking: 42 chapters on the real
// desktop card, where the route measures 664px.
check(!showDots(42, 664), "42 chapters still draw dots on the 664px desktop card");
check(showDots(4, 300), "a 4-chapter module drops its dots on a 300px card");

// ------------------------------------------------- 2 · three module states
// Fresh, mid and late. The screen must not depend on progress existing.
const chapterAt = (i) => ({
  id: `M9.${String(i + 1).padStart(2, "0")}`,
  title: `Chapter ${i + 1}`,
  lessons: [{ id: `M9.${i + 1}.1`, title: `Lesson ${i + 1}` }],
});
for (const n of [4, 40]) {
  const chs = Array.from({ length: n }, (_, i) => chapterAt(i));
  for (const [name, at] of [["fresh", 0], ["mid", Math.floor(n / 2)], ["late", n - 1]]) {
    const p = pointAt(at, n, 720);
    check(Number.isFinite(p.x) && Number.isFinite(p.y), `${name} n=${n}: current position is not a number`);
    check(labelX(p.x, 720) >= 96 - 0.01, `${name} n=${n}: label clamped past the left edge`);
  }
  // Search has to survive the big module too.
  const r = filterChapters(chs, "chapter 4");
  check(r.chapters.length >= 1, `search found nothing in a ${n}-chapter module`);
  check(r.chapters.every((c) => c.lessons), `search dropped the lessons array in a ${n}-chapter module`);
}

// ------------------------------------------- 3 · a lesson with no writing
// Zero notes and zero comments is the FIRST state every lesson is in, so it is
// the one most likely to be reached and the one most often built last.
check(densityBuckets([], 600) === null, "an unwritten lesson still draws a density curve");
check(densityBuckets([12], 600) === null, "one comment draws a curve");
check(densityBuckets(Array.from({ length: DENSITY_MIN - 1 }, (_, i) => i * 10), 600) === null,
  `${DENSITY_MIN - 1} comments draw a curve, under the floor of ${DENSITY_MIN}`);
check(densityBuckets(Array.from({ length: DENSITY_MIN }, (_, i) => i * 10), 600) !== null,
  `${DENSITY_MIN} comments draw nothing, at the floor of ${DENSITY_MIN}`);
// A duration of zero is what a lesson has before its metadata loads.
check(densityBuckets(Array.from({ length: 20 }, (_, i) => i), 0) === null,
  "a curve is drawn before the duration is known");
// Every comment at the same instant is the degenerate cluster.
const spike = densityBuckets(Array.from({ length: 30 }, () => 300), 600);
check(spike && !spike.some((v) => Number.isNaN(v)), "a single-instant cluster produces NaN");
check(!/NaN/.test(densityPath(spike, 656, 18) || ""), "a single-instant cluster draws a broken path");

// --------------------------------------------------- 4 · the question cycle
// A question is never in both places, at any point in the cycle.
let ret = { holding: {}, caution: {} };
ret = toCaution(ret, "q1");
check(cautionCount(ret) === 1 && holdingCount(ret) === 0, "wrong answer did not land in caution alone");
ret = toHolding(ret, "q1", { fromCaution: true });
check(cautionCount(ret) === 0 && holdingCount(ret) === 1, "put right did not leave caution");
ret = toCaution(ret, "q1");
check(cautionCount(ret) === 1 && holdingCount(ret) === 0, "missed on re-check did not leave holding");
check(recheckSet(ret, [{ id: "q1", chapterId: "c" }]).length === 0,
  "a question in caution was offered for re-checking");
check(movedLine({ toCaution: 0, toHolding: 0 }) === "Nothing moved.", "the empty result screen reads wrong");

// ----------------------------------------------------------- 5 · the copy
// Voice: no empty state may state absence or a zero count.
const BANNED = [/\bno\s+(results|matches|notes|comments|lessons)\b/i, /\b0\s/, /\bnothing found\b/i, /\bempty\b/i];
const COPY = [
  "Try a chapter name, a lesson title, or a code like M1.03.",
  "Try a paper title, a chapter name, or the All chip.",
  "Try a chapter name, or the word quiz.",
  "Nothing is due yet. Questions come back here once they have had time to fade.",
  "Nothing to put right. Anything you miss lands here until you do.",
];
for (const line of COPY) {
  for (const re of BANNED) {
    check(!re.test(line), `empty-state copy states absence: "${line}" matched ${re}`);
  }
  check(/[a-z]/.test(line) && line.trim().endsWith("."), `empty-state copy is not a sentence: "${line}"`);
}
check(placeholderFor("route") !== placeholderFor("library", "papers"), "the search placeholder does not change per tab");
check(placeholderFor("library", "papers") !== placeholderFor("library", "quizzes"),
  "the Library placeholder does not change per segment");

console.log(`shapes: ${checked} assertions across route geometry (${WIDTHS.length} widths x ${COUNTS.length} counts),`);
console.log(`        fresh/mid/late at 4 and 40 chapters, an unwritten lesson, the question cycle and the copy`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `STATES: ${fails.length} failing` : "MATCH");
if (fails.length) process.exitCode = 1;
