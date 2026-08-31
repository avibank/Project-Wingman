// The question lifecycle. A question is never in both places, and the tag's
// count and the lamp's count must always agree with that — so both are derived
// from one record, and this is the check that says so.
//
// Run: npm run check:retention
import * as R from "../src/lib/retention.js";
let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? "ok  " : "FAIL"}  ${n}${x ? "  " + x : ""}`); };

let s = R.emptyRetention();
// 1 · wrong on first sight -> caution
s = R.toCaution(s, "q1");
ok("wrong on first sight goes to caution", R.cautionCount(s) === 1 && R.holdingCount(s) === 0);
// 2 · right on first sight -> holding
s = R.toHolding(s, "q2");
ok("right on first sight goes to holding", R.holdingCount(s) === 1);
ok("never in both", !Object.keys(s.holding).some((k) => k in s.caution));
// caution is not eligible for re-check
ok("a caution question is never due", !R.dueIds(s, new Date(Date.now() + 99 * 86400000).toISOString()).includes("q1"));
// 3 · put right from caution -> leaves caution, joins holding
s = R.toHolding(s, "q1", { fromCaution: true });
ok("put right leaves caution and joins holding",
   R.cautionCount(s) === 0 && R.holdingCount(s) === 2 && s.holding.q1.box === 0);
// 4 · missed during a re-check -> leaves holding, back to caution
s = R.toCaution(s, "q2");
ok("missed on re-check leaves holding for caution",
   R.holdingCount(s) === 1 && R.cautionCount(s) === 1 && !("q2" in s.holding));
ok("counts always agree with the rule",
   R.holdingCount(s) + R.cautionCount(s) === 2 && !Object.keys(s.holding).some((k) => k in s.caution));

// due follows the doubling interval
const long = new Date(Date.now() + 3 * 86400000).toISOString();
ok("box 0 is due after a day", R.dueIds(s, long).includes("q1"), `boxDays(0)=${R.boxDays(0)}`);
ok("boxes double", JSON.stringify(R.BOXES) === JSON.stringify([1, 2, 4, 8, 16]));

// THE LADDER IS CLIMBED, not merely declared. The assertion above passed for a
// long time while nothing in the codebase ever advanced a box: every correct
// answer reset it to 1, so the 4, 8 and 16 day rungs were unreachable and a
// question known cold still came round every second day. Asserting the table
// tests the constant; this tests the mechanism.
{
  let g = R.emptyRetention();
  g = R.toHolding(g, "q");                       // first sight, correct
  const boxes = [g.holding.q.box];
  for (let i = 0; i < 5; i += 1) { g = R.toHolding(g, "q"); boxes.push(g.holding.q.box); }
  ok("a correct re-check advances the box", boxes[1] > boxes[0], `boxes: ${boxes.join(",")}`);
  ok("the top rung is reached", boxes.includes(R.BOXES.length - 1), `boxes: ${boxes.join(",")}`);
  ok("and it stops there", boxes[boxes.length - 1] === R.BOXES.length - 1, `boxes: ${boxes.join(",")}`);
  ok("the interval actually grows", R.boxDays(boxes[3]) > R.boxDays(boxes[0]),
     `${R.boxDays(boxes[0])}d -> ${R.boxDays(boxes[3])}d`);

  // and a miss sends it back to the bottom, whatever it had climbed to
  let m = R.toCaution(g, "q");
  ok("a miss removes it from holding", !("q" in m.holding) && "q" in m.caution);
  m = R.toHolding(m, "q", { fromCaution: true });
  ok("put right after a miss starts at the bottom", m.holding.q.box === 0, `box ${m.holding.q.box}`);
  ok("the miss count survives the round trip", (m.holding.q.missed || 0) > 0);
}

// interleaving: a re-check set mixes chapters rather than draining one
let big = R.emptyRetention();
const qs = [];
for (const ch of ["A", "B", "C"]) for (let i = 0; i < 6; i++) {
  const id = `${ch}${i}`; qs.push({ id, chapterId: ch, options: [1, 2, 3], correct: 0 });
  big = R.toHolding(big, id);
}
const set = R.recheckSet(big, qs, { at: new Date(Date.now() + 40 * 86400000).toISOString(), size: 6 });
const chapters = new Set(set.map((q) => q.chapterId));
ok("a re-check set is mixed across chapters", chapters.size === 3, `${set.length} questions from ${chapters.size} chapters`);
ok("set size is capped", set.length <= R.RECHECK_MAX && set.length >= 1, `${set.length}`);

// shuffling moves the correct index but keeps the right answer
const q = { options: ["a", "b", "c"], correct: 2 };
const orders = new Set();
for (let seed = 1; seed < 12; seed++) {
  const sh = R.shuffleOptions(q, seed);
  orders.add(sh.options.join(""));
  if (sh.options[sh.correct] !== "c") { fails++; console.log("FAIL  shuffle lost the right answer"); }
}
ok("option order varies between sittings", orders.size > 1, `${orders.size} distinct orders`);
ok("the right answer survives every shuffle", true);

ok("the result names what moved, never a bare score",
   R.movedLine({ toCaution: 2, toHolding: 3 }) === "3 joined the tag · 2 went to caution",
   R.movedLine({ toCaution: 2, toHolding: 3 }));

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
