// The logbook is append-only, and this is what keeps it that way.
//
// Nothing reads it yet, which is exactly when a guarantee like this rots: a
// future edit that "just fixes up" an entry would go unnoticed for months and
// quietly turn a record into a mutable list. The value of a logbook is that
// what it says happened, happened.
import { readFileSync } from "node:fs";
import { append, appendOnce, entry, lessonDone, quizTaken, ENTRY_KINDS, MAX_ENTRIES }
  from "../src/lib/logbookRecord.js";

const fails = [];
const SRC = readFileSync(new URL("../src/lib/logbookRecord.js", import.meta.url), "utf8");

// 1 · Never mutates what it is given.
const before = [entry("lesson_done", { id: "a" })];
const snapshot = JSON.stringify(before);
const after = append(before, entry("lesson_done", { id: "b" }));
if (JSON.stringify(before) !== snapshot) fails.push("append mutated the array it was given");
if (after === before) fails.push("append returned the same array rather than a new one");
if (after.length !== 2) fails.push("append did not add the entry");

// 2 · Nothing removes or rewrites. slice() to enforce the cap is the only
//     shortening allowed, and it must be the only one.
for (const banned of ["\\.splice\\(", "\\.pop\\(", "\\.shift\\(", "\\.sort\\(", "\\.reverse\\("]) {
  if (new RegExp(banned).test(SRC)) fails.push(`logbookRecord.js uses ${banned.replace(/\\\\/g, "")} — entries must not be removed or reordered`);
}
if (/log\[\s*\w+\s*\]\s*=/.test(SRC)) fails.push("an entry is assigned to by index — entries must not be rewritten");

// 3 · A closed set of kinds, like the analytics events, so the record can be
//     queried later without guessing what is in it.
try { entry("something_else", {}); fails.push("an unknown entry kind was accepted"); }
catch { /* expected */ }
if (ENTRY_KINDS.length !== 2) fails.push(`there are ${ENTRY_KINDS.length} entry kinds, expected 2`);

// 4 · The two writers produce entries that carry when, what and where.
const l = lessonDone([], "L1", "C1", "M1")[0];
for (const k of ["kind", "at", "id", "chapterId", "moduleCode"]) {
  if (l[k] === undefined) fails.push(`a lesson entry is missing ${k}`);
}
const q = quizTaken([], "C1", "M1", 7, 8)[0];
for (const k of ["kind", "at", "id", "moduleCode", "correct", "total"]) {
  if (q[k] === undefined) fails.push(`a quiz entry is missing ${k}`);
}
if (!/^\d{4}-\d{2}-\d{2}T/.test(l.at)) fails.push("entries are not timestamped in ISO");

// 5 · The automatic and manual halves of the completion rule firing together
//     must not write the same moment twice.
const once = appendOnce(lessonDone([], "L1", "C1", "M1"), { ...l });
if (once.length !== 1) fails.push("the same completion was recorded twice in one minute");

// 6 · The cap drops from the old end only, and is high enough not to bite.
if (MAX_ENTRIES < 1000) fails.push(`the cap is ${MAX_ENTRIES}, low enough to lose a real student's history`);
let big = [];
for (let i = 0; i < MAX_ENTRIES + 10; i++) big = append(big, entry("lesson_done", { id: `L${i}` }));
if (big.length !== MAX_ENTRIES) fails.push("the cap is not enforced");
if (big[big.length - 1].id !== `L${MAX_ENTRIES + 9}`) fails.push("the cap dropped the newest entries rather than the oldest");

console.log(`logbook: append-only across ${6} properties, ${ENTRY_KINDS.length} entry kinds, cap ${MAX_ENTRIES}`);
console.log("         nothing reads it yet — that is why it is checked now");
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `LOGBOOK: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
