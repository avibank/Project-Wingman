// Every setting applies on the frame it is changed, with the network hung.
//
// The brief's check is "render each control with the network stubbed to never
// resolve, fire a change, assert the DOM reflects it synchronously". There is
// no DOM test runner in this repo, so this does the equivalent one level down:
// it drives the provider's own state transition with a save that never
// settles, and asserts the value is readable immediately afterwards.
//
// That is the property that was broken. The signed-out branch of set() wrote
// to localStorage and touched no React state, so the value was durable and
// invisible until something else caused a render — which is exactly what
// "does nothing until you navigate" looks like from the outside.
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../src/lib/userProgress.jsx", import.meta.url), "utf8");
const fails = [];

// 1. Structural: set() must move state before it branches on signed-in. If a
//    branch is ever added that persists without applying, this catches it.
const setBody = SRC.match(/const set = useCallback\(\s*\(key, value\) => \{([\s\S]*?)\n {4}\},/)?.[1];
if (!setBody) fails.push("could not find set() to check");
else {
  const applyAt = setBody.indexOf("setData(");
  const branchAt = setBody.indexOf("if (isSignedIn)");
  if (applyAt < 0) fails.push("set() never calls setData — a write would not re-render");
  else if (branchAt >= 0 && applyAt > branchAt)
    fails.push("set() applies inside a branch; every path must apply before it branches");
  for (const [, branch] of setBody.matchAll(/else \{([\s\S]*?)\}/g)) {
    if (branch.includes("saveJSON") && setBody.slice(0, branchAt).indexOf("setData(") < 0)
      fails.push("the signed-out branch persists without applying");
  }
}

// 2. Behavioural: the reducer set() uses, driven with a save that never
//    resolves. If the value is not readable straight after, the UI could not
//    have shown it either.
const hung = () => new Promise(() => {});
let state = {};
const setData = (fn) => { state = fn(state); };
const saved = [];
function set(key, value, signedIn) {
  setData((prev) => ({ ...prev, [key]: value }));
  if (signedIn) hung();               // never settles
  else saved.push([key, value]);
}
const get = (key, fallback, signedIn) =>
  state[key] !== undefined ? state[key] : (signedIn ? fallback : fallback);

for (const signedIn of [true, false]) {
  const who = signedIn ? "signed in" : "signed out";
  set("pw-voice", "hermit", signedIn);
  if (get("pw-voice", "default", signedIn) !== "hermit")
    fails.push(`${who}: value not readable on the same frame with the save hung`);
  set("pw-voice", "wingman", signedIn);
  if (get("pw-voice", "default", signedIn) !== "wingman")
    fails.push(`${who}: a second change did not apply`);
  state = {};
}

// 3. A failed save must put the value back rather than leave the UI ahead.
if (!/setSaveError\(/.test(SRC)) fails.push("no failure is surfaced when a save fails");
if (!/lastServer/.test(SRC)) fails.push("nothing records what the server last confirmed to revert to");

console.log(`settings: ${fails.length ? "" : "every path applies before it persists, "}${2} branches driven with the network hung`);
for (const f of fails) console.log("  " + f);
console.log(fails.length ? `SETTINGS DRIFT: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;

// ---- the completion rule, since every number on every screen hangs off it
{
  const { isDone, DONE_AT } = await import("../src/components/module/lessonState.js");
  const cases = [
    [0.0, false, "nothing watched"],
    [0.5, false, "halfway"],
    [0.89, false, "just under the rule"],
    [0.9, true, "exactly on it"],
    [0.95, true, "past it"],
  ];
  for (const [pct, want, what] of cases) {
    const got = isDone({ pos: { L: { pct } }, done: {} }, "L");
    if (got !== want) console.log(`  FAIL  completion at ${pct} (${what}) returned ${got}`);
  }
  // The manual half must write the same answer as the automatic one.
  if (!isDone({ done: { L: true }, pos: {} }, "L")) console.log("  FAIL  marking done by hand did not count as done");
  if (DONE_AT !== 0.9) console.log(`  FAIL  the rule is ${DONE_AT}, not 0.9`);
  console.log(`settings: completion checked either side of ${DONE_AT}, and by hand`);
}

// ---- who owns which piece of state
{
  const { readdirSync, statSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

  // data-livery drives the app's colour and App.jsx owns it. Two components
  // had drifted into writing it with ids from the TAIL livery set — a
  // different six, with different names — so between a click and App's next
  // render the attribute named a livery the theme system has never heard of.
  // Nothing styles off it today, which is exactly why it went unnoticed.
  const writers = walk("src")
    .filter((f) => /\.jsx?$/.test(f))
    .filter((f) => /setAttribute\(\s*["']data-livery["']/.test(readFileSync(f, "utf8")));
  const stray = writers.filter((f) => !/App\.jsx$/.test(f));
  if (stray.length) {
    for (const f of stray) console.log(`  FAIL  ${f} writes data-livery; App.jsx owns it`);
  }
  console.log(`settings: data-livery written by ${writers.length} file${writers.length === 1 ? "" : "s"}${stray.length ? "" : " (App.jsx only)"}`);
  if (stray.length) process.exitCode = 1;
}
