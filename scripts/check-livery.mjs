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
import { deckVars, LIVERIES } from "../src/lib/liveryEngine.js";

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
const AGREED = new Set();
const near = (a, b) => {
  const x = Number(String(a).replace("px", "")), y = Number(String(b).replace("px", ""));
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 5e-4;
};

let compared = 0;
const drift = [], missing = [], extra = new Set();

LIVERIES.forEach((L, i) => {
  for (const night of [true, false]) {
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

console.log(`livery: ${compared} values compared across ${LIVERIES.length} liveries x 2 modes`);
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
