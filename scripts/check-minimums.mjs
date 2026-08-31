/* §8 — the two numbers, asserted.
 *
 * Every visible signal on the module screen derives from the quiz scores and
 * the user's minimums: the lamp on a chapter, the lamp on the launcher, the
 * needle, the verdict. If this file passes, those four cannot disagree with
 * each other, because there is only one place they are computed.
 *
 * The distinction this exists to protect: MINIMUMS is the user's own bar and
 * PASS_PCT is the syllabus. They are different numbers and the dial has to
 * show both. Collapsing them is the obvious simplification and it destroys
 * the feature — so it is asserted here rather than left to a comment.
 */
import * as M from "../src/lib/minimums.js";
import { PASS_MARK } from "../src/lib/quiz.js";

let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};

console.log("minimums: the two numbers\n");

/* ---------------------------------------------------------------- the pair */
ok("the pass mark has one owner", M.PASS_PCT === Math.round(PASS_MARK * 100), `${M.PASS_PCT}`);
ok("minimums default to the pass mark", M.DEFAULT_MINIMUMS === M.PASS_PCT);
ok("the range is a real range", M.MIN_FLOOR < M.DEFAULT_MINIMUMS && M.DEFAULT_MINIMUMS < M.MIN_CEIL,
   `${M.MIN_FLOOR}–${M.MIN_CEIL}`);
ok("a bar below the floor is refused", M.clampMinimums(0) === M.MIN_FLOOR);
ok("a bar above the ceiling is refused", M.clampMinimums(100) === M.MIN_CEIL);
ok("nonsense falls back to the default", M.clampMinimums("x") === M.DEFAULT_MINIMUMS
   && M.clampMinimums(undefined) === M.DEFAULT_MINIMUMS);

/* -------------------------------------------------------------- not taken */
ok("an untaken quiz is null, never zero", M.pctOf(undefined) === null && M.pctOf({}) === null
   && M.pctOf({ correct: 0, total: 0 }) === null);
ok("a zero score IS zero, not null", M.pctOf({ correct: 0, total: 8 }) === 0);
ok("nothing taken averages to null, not 0", M.averagePct([]) === null);
ok("no reading means no needle", M.deviation(null, 75) === null);
ok("and it says so in words", M.readingWords(null, 75) === "No quizzes taken yet");

/* ------------------------------------------------------- the lamp lights */
{
  const chapters = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  const quiz = {
    c1: { correct: 4, total: 8 },   // 50
    c2: { correct: 7, total: 8 },   // 87.5 -> 88
    // c3 not taken
  };
  const taken = M.takenScores(chapters, quiz);
  ok("only taken quizzes count", taken.length === 2, taken.map((t) => t.pct).join(","));
  ok("scores keep the module's chapter order", taken[0].id === "c1" && taken[1].id === "c2");
  ok("the average is of what was taken", M.averagePct(taken) === 69, `${M.averagePct(taken)}`);
  ok("the last quiz is the last in route order", M.lastPct(taken) === 88);

  const at75 = M.faultChapters(chapters, quiz, 75);
  ok("at a 75 bar only the 50 is lit", at75.size === 1 && at75.has("c1"));
  ok("an untaken chapter is never lit", !at75.has("c3"));

  // THE POINT OF THE FEATURE: the bar moves the lamp, the pass mark does not.
  const at90 = M.faultChapters(chapters, quiz, 90);
  ok("raising the bar to 90 lights the 88 too", at90.size === 2 && at90.has("c2"),
     [...at90].join(","));
  const at45 = M.faultChapters(chapters, quiz, 45);
  ok("lowering it to 45 puts every lamp out", at45.size === 0);

  ok("the launcher lights from the same fact",
     M.moduleNeedsYou(chapters, quiz, 75) === true
     && M.moduleNeedsYou(chapters, quiz, 45) === false);
}

/* ------------------------------------------------------------- the dial */
{
  ok("centre is your bar, not the pass mark", M.deviation(75, 75) === 0 && M.deviation(60, 60) === 0);
  ok("under reads negative", M.deviation(50, 75) === -25);
  ok("over reads positive", M.deviation(88, 75) === 13);

  ok("the scale pegs at the span", M.onScale(-90) === -M.SPAN && M.onScale(90) === M.SPAN);
  ok("and a pegged reading knows it is pegged", M.isPegged(-40) && !M.isPegged(-10));
  ok("a pegged needle still tells the truth in words",
     M.readingWords(20, 75) === "55 under your bar");

  // THE REAL PASS MARK HOLDS ITS TRUE OFFSET. Brief §3, stated as a number.
  ok("at a 60 bar the pass tick sits at +15", M.passOffset(60) === 15);
  ok("at a 75 bar it sits dead centre", M.passOffset(75) === 0);
  ok("at a 90 bar it sits at -15", M.passOffset(90) === -15);
  ok("lowering your bar can never hide the requirement",
     M.passOffset(M.MIN_FLOOR) > 0 && !M.isPegged(M.passOffset(60)),
     `floor offset ${M.passOffset(M.MIN_FLOOR)}`);
}

/* --------------------------------------------------------------- wording */
ok("on the bar is said plainly", M.readingWords(75, 75) === "Exactly on your bar");
ok("the verdict and the needle read the same event",
   M.readingWords(50, 75) === "25 under your bar" && M.deviation(50, 75) === -25);

/* --------------------------------------------------------------------------
   §2 — NO LIVERY MAY IMPERSONATE THE SIGNAL.

   Master Caution is the only status signal on the module screen and it is
   amber. A livery whose accent sits on top of that amber makes the lamp stop
   reading as a lamp — it becomes just another accent-coloured chip. The brief
   calls out the ember/amber case specifically because it is the one that
   fails, and it HAS failed here before: the amber livery once shipped a Day
   accent at hue 79 against a caution at hue 72.6, three degrees apart.

   Hue distance is the test, not chroma. A desaturated accent at the same hue
   still reads as the same colour family; a saturated one 40 degrees away does
   not. Measured across every livery x variant x finish.
*/
{
  const { deckVars, LIVERIES } = await import("../src/lib/liveryEngine.js");
  const { finishVars } = await import("../src/lib/finishEngine.js");

  // oklch(L C H) -> H, tolerating the calc()/from() forms the engines emit.
  const hueOf = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(String(v || ""));
    return m ? { L: +m[1], C: +m[2], H: +m[3] } : null;
  };
  const apart = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  const MIN_HUE_GAP = 25;     // degrees. Below this the two read as one family.
  let worst = { gap: 999, where: "" };

  for (const L of LIVERIES) {
    for (const variant of ["night", "day"]) {
      for (const finish of [null, "aurora", "manual"]) {
        const base = deckVars(L.id, variant).vars;
        const v = { ...base, ...finishVars(L.id, variant, finish, base["--active"]) };
        const acc = hueOf(v["--active"]);
        const cau = hueOf(v["--caution"]);
        if (!acc || !cau) continue;              // a non-oklch form is not comparable
        const gap = apart(acc.H, cau.H);
        const where = `${L.id}/${variant}/${finish || "standard"}`;
        // A very low-chroma accent (a grey) cannot impersonate a colour signal
        // however close its nominal hue sits, so it is exempt by measurement
        // rather than by name.
        if (acc.C < 0.04) continue;
        if (gap < worst.gap) worst = { gap, where };
      }
    }
  }
  // DECIDED, AND PINNED. §2 asks for the amber livery's accent to be pulled
  // off the caution hue; it measures 10.2deg away. Asked directly, the author
  // said keep the liveries as they are (2026-09-01), so this is a recorded
  // departure rather than an open question — the lamp separates by shape, by
  // its legend and by its recessed housing, not by hue alone.
  //
  // It is pinned rather than merely allowed. HELD is today's measured value,
  // so the check still fails if a livery is ever moved CLOSER to the caution
  // hue than the one that was agreed. Accepting a number is not the same as
  // stopping measuring it.
  const HELD = 10.0;
  ok(`no livery comes closer to the caution hue than the agreed ${HELD}deg`,
     worst.gap >= HELD, `closest: ${worst.where} at ${worst.gap.toFixed(1)}deg`);
  if (worst.gap < MIN_HUE_GAP) {
    console.log(`      AGREED DEPARTURE  ${worst.where} sits ${worst.gap.toFixed(1)}deg from the caution`);
    console.log(`      hue, under the ${MIN_HUE_GAP}deg the brief asks for. Liveries kept as they are;`);
    console.log("      the lamp separates by shape and legend. Pinned so it cannot get closer.");
  }
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
