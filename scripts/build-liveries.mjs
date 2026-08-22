// Generates the livery token file from the §2.3 formulas.
//
// The spec forbids pasting the §2.4 hex tables into the codebase: hues are the
// only input, everything else is derived. This script is the one permitted
// place colour is written, and it emits an sRGB fallback alongside each oklch
// value for engines that lack oklch().
//
//   node scripts/build-liveries.mjs   ->   src/styles/liveries.css

import { writeFileSync } from "node:fs";

// §2.4 — warm hue is the single degree of freedom.
const LIVERIES = [
  { id: "aurora",          name: "Aurora",          Hw: 350 },
  { id: "sunset-approach", name: "Sunset Approach", Hw: 20 },
  { id: "carrier-deck",    name: "Carrier Deck",    Hw: 40 },
  { id: "dawn-patrol",     name: "Dawn Patrol",     Hw: 55 },
  { id: "contrail",        name: "Contrail",        Hw: 70 },
  { id: "night-ops",       name: "Night Ops",       Hw: 88 },
];

// §2.3
const coldHue = (Hw) => (Hw + 160) % 360;

// §2.3 channels, §2.5 surfaces and text. L and C are constants; only H moves.
const CHANNEL = {
  night: { warm: [0.80, 0.135], cold: [0.78, 0.125] },
  day:   { warm: [0.55, 0.155], cold: [0.52, 0.145] },
};
const SURFACE = {
  night: {
    "surface-0": [0.15, 0.020], "surface-1": [0.19, 0.018], "surface-2": [0.24, 0.016],
    "text-1": [0.95, 0.010], "text-2": [0.70, 0.012], "text-3": [0.52, 0.012],
  },
  day: {
    "surface-0": [0.980, 0.008], "surface-1": [0.950, 0.008], "surface-2": [0.995, 0.004],
    "text-1": [0.220, 0.014], "text-2": [0.450, 0.014], "text-3": [0.600, 0.012],
  },
};
const HAIRLINE = { night: "rgb(255 255 255 / 0.06)", day: "rgb(0 0 0 / 0.08)" };

// ---- oklch -> sRGB, for the fallback only -------------------------------
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  // Gamut-clamp in linear space, then gamma-encode.
  return lin.map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const enc = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, enc)) * 255);
  });
}
const hex = (L, C, H) => "#" + oklchToRgb(L, C, H).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const ok = (L, C, H) => `oklch(${L} ${C} ${H})`;

// ---- emit ----------------------------------------------------------------
function block(livery, variant) {
  const Hw = livery.Hw;
  const Hc = coldHue(Hw);
  const ch = CHANNEL[variant];
  const sf = SURFACE[variant];
  // Both selectors: the root paints the app, and any element carrying the pair
  // paints itself — the fleet page needs six liveries visible at once (§7.11).
  const out = [
    `:root[data-livery="${livery.id}"][data-variant="${variant}"],`,
    `[data-livery="${livery.id}"][data-variant="${variant}"] {`,
  ];

  const pair = (name, [L, C], H) => {
    out.push(`  --${name}: ${hex(L, C, H)};`);
    out.push(`  --${name}: ${ok(L, C, H)};`);
  };

  out.push(`  --livery-name: "${livery.name}";`);
  out.push(`  --hue-warm: ${Hw};`);
  out.push(`  --hue-cold: ${Hc};`);
  pair("warm", ch.warm, Hw);
  pair("cold", ch.cold, Hc);
  for (const [name, lc] of Object.entries(sf)) pair(name, lc, Hc);
  out.push(`  --hairline: ${HAIRLINE[variant]};`);
  // §2.6 — the cheatline is the warm channel at 5-7% over ~40% of the viewport.
  out.push(`  --cheatline: linear-gradient(to top, ${ok(ch.warm[0], ch.warm[1], Hw)} 0%, transparent 100%);`);
  out.push(`  --cheatline-alpha: 0.06;`);
  out.push("}");
  return out.join("\n");
}

const header = `/* GENERATED — do not edit. Run: node scripts/build-liveries.mjs
 *
 * Derived from docs/SPEC.md §2.3 (channels), §2.5 (surfaces), §2.6 (cheatline).
 * Hue is the only input; every other value is a constant from the spec. Each
 * token is emitted twice: an sRGB hex fallback, then the oklch value that
 * supersedes it on engines that support it.
 */\n`;

const css = [header, ...LIVERIES.flatMap((l) => [block(l, "night"), block(l, "day")])].join("\n\n") + "\n";
writeFileSync(new URL("../src/styles/liveries.css", import.meta.url), css);

// Cross-check the generated fallbacks against the spec's published table.
const REFERENCE = {
  aurora:            { warmN: "#FE98CA", coldN: "#79CE8C", warmD: "#B0437E", coldD: "#007F37" },
  "sunset-approach": { warmN: "#FF9899", coldN: "#41D1BA", warmD: "#BB424A", coldD: "#00826C" },
  "carrier-deck":    { warmN: "#FF9E79", coldN: "#2CCFD7", warmD: "#B9491C", coldD: "#007F8A" },
  "dawn-patrol":     { warmN: "#FFA564", coldN: "#39CBE9", warmD: "#B35200", coldD: "#007B9C" },
  contrail:          { warmN: "#F5AD53", coldN: "#52C6F8", warmD: "#A95C00", coldD: "#0075AB" },
  "night-ops":       { warmN: "#E2B849", coldN: "#73BEFF", warmD: "#976900", coldD: "#006CB7" },
};
const dist = (a, b) => {
  const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
};
let worst = 0;
for (const l of LIVERIES) {
  const Hc = coldHue(l.Hw);
  const got = {
    warmN: hex(...CHANNEL.night.warm, l.Hw), coldN: hex(...CHANNEL.night.cold, Hc),
    warmD: hex(...CHANNEL.day.warm, l.Hw),   coldD: hex(...CHANNEL.day.cold, Hc),
  };
  for (const k of Object.keys(REFERENCE[l.id])) {
    const d = dist(got[k], REFERENCE[l.id][k]);
    worst = Math.max(worst, d);
    if (d > 4) console.log(`  ${l.id} ${k}: generated ${got[k]}, spec says ${REFERENCE[l.id][k]} (Δ${d})`);
  }
}
console.log(`liveries: ${LIVERIES.length} x 2 variants written to src/styles/liveries.css`);
console.log(`max channel deviation from the spec's published table: ${worst}/255`);
