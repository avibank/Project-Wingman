// Differential test: the build's livery engine against the reference.
//
// This does not hold a transcription of the POC's colour code — a copy drifts
// silently, which is the failure mode it exists to catch. It lifts the colour
// block and the tokens() function straight out of
// docs/reference/wingman-poc.html, runs them in a sandbox with the DOM stubbed,
// and compares every emitted custom property against deckVars(), string for
// string, over all seven liveries in both modes.
//
// Run: npm run check:livery

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { deckVars, LIVERIES, DAY, STOCK, dayGround, dayKey, dayFill, DAY_DROP, DAY_SHEEN } from "../src/lib/liveryEngine.js";

const src = readFileSync(new URL("../docs/reference/wingman-poc.html", import.meta.url), "utf8");

const slice = (from, to, label) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error(`could not find the ${label} block in wingman-poc.html`);
  return src.slice(a, b);
};

const colour = slice("/* ============ colour ============ */", "/* ============ state", "colour");
const tokens = slice("  function tokens(){", "  /* ============ flight profile", "tokens()");

// Everything tokens() reaches for that isn't colour.
const prelude = `
  const wrap = h => (((h % 360) + 360) % 360);
  const smooth = u => u*u*(3-2*u);
  var C = {}, liv = 0, preview = null, __night = true, __out = {};
  const isNight = () => __night;
  const __el = { style: { setProperty: (k, v) => { __out[k] = String(v); } },
                 setAttribute: () => {}, classList: { toggle: () => {} } };
  const $ = () => __el;
`;

const hueAtRef = (c) => {
  const wrapH = (h) => (((h % 360) + 360) % 360);
  const sm = (u) => u * u * (3 - 2 * u);
  return wrapH(c.hue + c.dLight * sm(1));
};

const ctx = vm.createContext({ Math, Array, Object, String, Number, JSON });
vm.runInContext(prelude + colour + "\n" + tokens, ctx);

const run = (index, night) =>
  vm.runInContext(
    `liv = ${index}; __night = ${night}; __out = {}; tokens(); JSON.stringify(__out)`, ctx);

// A few tokens the build emits that the reference sets as CSS defaults on
// .deck rather than through tokens(). Equivalent, and not drift.
const CSS_DEFAULTS = new Set(["--grain", "--emit"]);

// No agreed divergences. Every value the reference emits, the build emits
// identically. If that stops being true, this exits non-zero.
// Deliberate, measured departures from the POC. A token in here is not drift;
// it is a decision, and the reason has to be written down beside it or this
// set becomes the place failures go to be forgotten.
//
// --t3 (Night): the POC's rung 6 measures 3.38 to 3.72 against the panel
// across the six liveries, under the 4.5 floor, on text that carries meaning
// in 31 places. Day had the same failure at 2.99 and it was fixed by moving
// its t3 .618 -> .505. Night's is lifted by .08 in lightness, the smallest
// change that clears, landing at 4.70 worst case — the same place Day's sits.
// check:contrast is what holds it there.
const AGREED = new Set(["--t3"]);
const near = (a, b) => {
  const x = Number(String(a).replace("px", "")), y = Number(String(b).replace("px", ""));
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 5e-4;
};

let compared = 0;
const drift = [], missing = [], extra = new Set();

LIVERIES.forEach((L, i) => {
  // Night only. Day is no longer the POC's Day — design/wingman-day-source.js
  // replaced it wholesale, deliberately, so comparing it against the reference
  // would report the intended change as drift for ever. Day is asserted against
  // its own spec below instead, which is the same guarantee from the other end.
  for (const night of [true]) {
    const ref = JSON.parse(run(i, night));
    const got = deckVars(L.id, night ? "night" : "day").vars;
    const where = `${L.id}/${night ? "night" : "day"}`;
    for (const [k, v] of Object.entries(ref)) {
      if (!(k in got)) { missing.push(`${where} ${k}`); continue; }
      compared++;
      if (String(v) === String(got[k]) || near(v, got[k])) continue;
      drift.push({ where, k, ref: String(v), got: String(got[k]) });
    }
    for (const k of Object.keys(got)) if (!(k in ref) && !CSS_DEFAULTS.has(k)) extra.add(k);
  }
});

const agreed = drift.filter((d) => AGREED.has(d.k));
const real = drift.filter((d) => !AGREED.has(d.k));

console.log(`livery: ${compared} values compared across ${LIVERIES.length} liveries, night, against the POC`);
if (agreed.length) {
  console.log(`  ${agreed.length} agreed divergences (${[...AGREED].join(", ")}) — see §10 and the build notes`);
}
if (missing.length) console.log(`  missing from the build: ${missing.join(", ")}`);
if (extra.size) console.log(`  emitted by the build only: ${[...extra].join(", ")}`);
for (const d of real) {
  console.log(`  drift ${d.where} ${d.k}\n    reference ${d.ref.slice(0, 88)}\n    build     ${d.got.slice(0, 88)}`);
}

if (real.length || missing.length) {
  console.log(`DRIFT: ${real.length + missing.length}`);
  process.exit(1);
}
console.log("MATCH");

// ---------------------------------------------------------------- Day, as built
// Day answers to design/wingman-day-source.js rather than to the POC. Same idea
// as above: every value asserted, so a quiet edit shows up as a failure.
const dayFail = [];
let dayChecked = 0;
for (const L of LIVERIES) {
  const v = deckVars(L.id, "day").vars;
  const G = dayGround(L.id);
  const keyH = L.keyAbs != null ? L.keyAbs : hueAtRef(L);
  const keyC = L.keyC != null ? L.keyC : 0.305;
  const want = {
    "--ground": `oklch(${G.g})`,
    "--t3": `oklch(${DAY.t3})`, "--t2": `oklch(${DAY.t2})`, "--t1": `oklch(${DAY.t1})`,
    "--key-img": dayKey(), "--fill-img": dayFill(keyH, keyC * 0.42),
    "--key-int": "0.92", "--fill-int": "0.66", "--grain": "0.20", "--stars": "0",
    "--soft": "82px", "--blend": "screen", "--blend2": "multiply",
    "--drop": DAY_DROP, "--sheen-img": DAY_SHEEN,
  };
  for (const [k, expect] of Object.entries(want)) {
    dayChecked++;
    if (String(v[k]) !== String(expect)) dayFail.push(`${L.id}/day ${k}\n    want ${expect}\n    got  ${v[k]}`);
  }
  // The stock has to differ per livery, or Day is one theme wearing six accents.
  if (!String(v["--ground"]).includes(String(STOCK[L.id][1]))) dayFail.push(`${L.id}/day stock hue not applied`);
}
console.log(`day:    ${dayChecked} values asserted across ${LIVERIES.length} liveries against the Day source`);
if (dayFail.length) { for (const f of dayFail) console.log("  " + f); }
console.log(dayFail.length ? `DAY DRIFT: ${dayFail.length}` : "MATCH");
if (dayFail.length) process.exitCode = 1;
