// The four events, and nothing else.
//
// Without a compiler holding the union, this is what stops a fifth event
// appearing by accident or a name being misspelled at a call site — a stray
// string that never throws in testing because the line never ran.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, track, installSink } from "../src/lib/analytics.js";

const NAMES = Object.keys(EVENTS);
const fails = [];

if (NAMES.length !== 4) fails.push(`there are ${NAMES.length} events, not four`);
for (const n of ["lesson_progress", "lesson_replay", "question_unanswered", "session_end"]) {
  if (!NAMES.includes(n)) fails.push(`missing event ${n}`);
}

// It must actually refuse an unknown name and an incomplete payload.
installSink(() => {});
try { track("lesson_watched", { lessonId: "x" }); fails.push("an unknown event name was accepted"); }
catch { /* expected */ }
try { track("lesson_progress", { lessonId: "x" }); fails.push("an event missing a required prop was accepted"); }
catch { /* expected */ }
let got = null;
installSink((e) => { got = e; });
track("lesson_progress", { lessonId: "x", pct: 0.5 });
if (!got || got.name !== "lesson_progress") fails.push("a valid event did not reach the sink");

// Every call site in the app must name one of the four.
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
for (const f of walk("src").filter((f) => /\.(jsx?|mjs)$/.test(f))) {
  if (f.endsWith("analytics.js")) continue;
  for (const [, name] of readFileSync(f, "utf8").matchAll(/\btrack\(\s*["'`]([^"'`]+)/g)) {
    if (!NAMES.includes(name)) fails.push(`${f}: track("${name}") is not one of the four`);
  }
}

console.log(`analytics: ${NAMES.length} events, union enforced at the call and across src/`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `ANALYTICS: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
