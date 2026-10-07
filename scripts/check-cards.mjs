#!/usr/bin/env node
/* =============================================================================
   THE STUDY-CARD SESSION'S RULES, DRIVEN.
   -----------------------------------------------------------------------------
   `cardSession.js` is a plain module so this can IMPORT it and run the sets,
   the queue, the two piles and the fan for real, rather than grepping the JSX
   for them — the same bargain `check:studio` makes with `studioModel.js`.
   No browser, so it rides in `npm run check`.
   ========================================================================= */
import {
  setsOf, missedIds, startMode, answer, currentId, isDone, place,
  fanOf, miniFan, pickOrder, slideOf, FAN_SHOWN, FLICK_PX,
} from "../src/components/module/library/cardSession.js";

let pass = 0; const fails = [];
const ok = (what, good, detail = "") => {
  if (good) { pass += 1; console.log(`  ok   ${what}${detail ? ` (${detail})` : ""}`); return; }
  fails.push(what); console.log(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
};

const cards = Array.from({ length: 6 }, (_, i) => ({ id: `C${i + 1}`, q: `Q${i + 1}`, a: `A${i + 1}` }));

console.log("\nthe three sets");
{
  const seen = { C1: true, C2: true, C3: true };
  const got = { C2: true };
  const saved = new Set(["C5"]);
  const sets = setsOf(cards, { seen, got, saved });
  ok("All is the whole set, in order", sets.all.join() === "C1,C2,C3,C4,C5,C6", sets.all.join());
  ok("Missed is turned over and not yet had right", sets.missed.join() === "C1,C3", sets.missed.join());
  ok("one you had right is not missed", !sets.missed.includes("C2"));
  ok("one you have never met is not missed either", !sets.missed.includes("C4"));
  ok("Saved is what is bookmarked", sets.saved.join() === "C5", sets.saved.join());
  ok("and missedIds agrees with it", missedIds(cards, seen, got).join() === sets.missed.join());
  ok("nothing seen means nothing missed", setsOf(cards, {}).missed.length === 0);
}

console.log("\nthe queue");
{
  const sets = setsOf(cards, {});
  let s = startMode(null, "all", sets);
  ok("it starts at the first card", currentId(s) === "C1" && s.pos === 0);
  ok("and says where it is", place(s).at === 1 && place(s).of === 6, `${place(s).at}/${place(s).of}`);
  ok("a fresh session has empty piles", s.got === 0 && s.again === 0 && !s.yesDeck.length && !s.noDeck.length);
  s = answer(s, true).next;
  ok("Got it moves on and fills one pile", currentId(s) === "C2" && s.got === 1 && s.yesDeck.join() === "C1");
  s = answer(s, false).next;
  ok("Not yet moves on and fills the other", currentId(s) === "C3" && s.again === 1 && s.noDeck.join() === "C2");
  ok("the two piles stay apart", s.yesDeck.join() === "C1" && s.noDeck.join() === "C2");

  /* The rule with a sentence of its own in the brief. */
  const rest = [];
  let t = startMode(null, "all", sets);
  while (!isDone(t)) { rest.push(currentId(t)); t = answer(t, false).next; }
  ok("NOT YET DOES NOT LOOP BACK: every card is handed over exactly once",
     rest.length === 6 && new Set(rest).size === 6, rest.join());
  ok("and the deck is then cleared", isDone(t) && currentId(t) === null && place(t) === null);
  ok("with the tally on it", t.again === 6 && t.got === 0);
  ok("answering a cleared deck changes nothing", answer(t, true).next === t && answer(t, true).id === null);
}

console.log("\nswitching set");
{
  const sets = setsOf(cards, { seen: { C1: true, C4: true }, got: {}, saved: new Set(["C6"]) });
  let s = startMode(null, "all", sets);
  s = answer(s, true).next;
  s = answer(s, false).next;
  const kept = startMode(s, "missed", sets);
  ok("it deals the set that was picked", kept.queue.join() === "C1,C4", kept.queue.join());
  ok("and starts at the top of it", kept.pos === 0 && currentId(kept) === "C1");
  ok("but keeps the Got it pile", kept.yesDeck.join() === "C1" && kept.got === 1);
  ok("and the Not yet pile", kept.noDeck.join() === "C2" && kept.again === 1);
  const empty = startMode(s, "saved", { ...sets, saved: [] });
  ok("an empty set deals nothing and is done at once", isDone(empty) && empty.queue.length === 0);
}

console.log("\nthe fans");
{
  ok("an empty deck fans nothing", fanOf([]).length === 0);
  ok("one card sits straight", fanOf(["a"])[0].rot === 0 && fanOf(["a"])[0].newest);
  const five = fanOf(["a", "b", "c", "d", "e"]);
  ok("five spread evenly either side of straight",
     Math.abs(five[0].rot + five[4].rot) < 0.01, five.map((x) => x.rot).join(" "));
  ok("and the newest is last, which is the one that drops",
     five[4].newest && !five[0].newest);
  const many = fanOf(Array.from({ length: 20 }, (_, i) => `x${i}`));
  ok(`never more than ${FAN_SHOWN} leaves`, many.length === FAN_SHOWN, `${many.length}`);
  ok("and the spread is capped", Math.abs(many[0].rot) <= 40, `${many[0].rot}`);
  ok("the newest of twenty is the twentieth", many[many.length - 1].id === "x19");
}

console.log("\nthe set picker");
{
  ok("one leaf for an empty set", miniFan(0).length === 1);
  ok("never more than four", miniFan(99).length === 4);
  ok("and they spread", miniFan(4)[0] < 0 && miniFan(4)[3] > 0, miniFan(4).join(" "));
  const order = pickOrder("missed", { all: 6, missed: 2, saved: 1 });
  ok("the set being studied comes first", order[0].id === "missed", order.map((x) => x.id).join(","));
  ok("and the other two follow", order.length === 3 && order[1].id === "all" && order[2].id === "saved");
  ok("each carries its count", order[0].n === 2 && order[1].n === 6 && order[2].n === 1);
  ok("the current one slides nowhere and the others part", slideOf(0) === 1 && slideOf(1) === 0 && slideOf(2) === 2);
}

console.log("\nthe numbers the brief states out loud");
{
  ok("a flick is 110px", FLICK_PX === 110);
  ok("a fan shows seven", FAN_SHOWN === 7);
}

console.log(`\ncards model: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
