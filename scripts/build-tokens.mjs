// Generates src/styles/tokens.css from docs/SPEC-V2.md §3.
//
// Three layers, in this order, and components may only ever touch the third:
//
//   PRIMITIVES  the mono ramp + beacon, 13 steps each, per livery
//   SEMANTICS   bg-ground, text-primary, hairline, danger ... per variant
//   COMPONENTS  (in the app, not here)
//
// The v1 bug this structure exists to prevent: --surface-0 switched correctly
// to a light value while body stayed painted rgb(11,21,38), because a component
// had reached past the token layer to a raw value. With a semantic layer there
// is nothing to reach past to.
//
// Run: node scripts/build-tokens.mjs

import { writeFileSync } from "node:fs";

// §3.2 — every family uses identical lightness. Only hue and chroma vary.
const STEPS = [
  ["0", 0.99], ["50", 0.97], ["100", 0.94], ["200", 0.89], ["300", 0.82],
  ["400", 0.74], ["500", 0.66], ["600", 0.57], ["700", 0.48], ["800", 0.38],
  ["900", 0.28], ["950", 0.20], ["1000", 0.15],
];

// §3.3 — chroma peaks mid-ramp; pure hue is impossible at .99 or .15.
const CHROMA_MULT = {
  "0": 0.15, "50": 0.15, "100": 0.4, "200": 0.4, "300": 0.7,
  "400": 1.0, "500": 1.0, "600": 1.0, "700": 0.8, "800": 0.6,
  "900": 0.4, "950": 0.25, "1000": 0.25,
};

// §3.3 — deliberately tiny. This must read as tinted grey, never as a colour.
const MONO_PEAK_CHROMA = 0.014;
// §3.5 — the one reserved colour, and the only saturated family in the product.
const BEACON = { hue: 27, peak: 0.16 };

// §3.4
const LIVERIES = [
  { id: "contrail",     name: "Contrail",     hue: 240, chromaMult: 0.15, presence: 70 },
  { id: "night-ops",    name: "Night Ops",    hue: 225, chromaMult: 1.0,  presence: 60 },
  { id: "carrier-deck", name: "Carrier Deck", hue: 255, chromaMult: 0.9,  presence: 40 },
  { id: "altimeter",    name: "Altimeter",    hue: 260, chromaMult: 0.4,  presence: 65 },
  { id: "aurora",       name: "Aurora",       hue: 300, chromaMult: 0.9,  presence: 20 },
  { id: "dawn-patrol",  name: "Dawn Patrol",  hue: 60,  chromaMult: 0.9,  presence: 45 },
];

// §3.6 — the only mapping in the system. Everything visible resolves through here.
const SEMANTICS = {
  night: {
    "bg-ground": "mono-1000",
    "bg-panel": "mono-900",
    "bg-raised": "mono-800",
    "text-primary": "mono-50",
    "text-secondary": "mono-300",
    "text-tertiary": "mono-500",
    "accent-interactive": "mono-100",
    danger: "beacon-500",
  },
  day: {
    "bg-ground": "mono-50",
    "bg-panel": "mono-0",
    "bg-raised": "mono-0",
    "text-primary": "mono-900",
    // §3.6 maps this to mono-600, which measures 4.08:1 on bg-ground for Night
    // Ops -- under the AA floor §12 requires for exactly this token. mono-700
    // clears at 5.97 across all six liveries. The check below is what caught it.
    "text-secondary": "mono-700",
    "text-tertiary": "mono-500",
    "accent-interactive": "mono-800",
    danger: "beacon-600",
  },
};
const HAIRLINE = {
  night: { hairline: "rgb(255 255 255 / 0.07)", "hairline-bevel": "rgb(255 255 255 / 0.10)" },
  day:   { hairline: "var(--mono-200)",         "hairline-bevel": "var(--mono-100)" },
};

// ---- oklch -> sRGB, for the fallback only --------------------------------
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => {
    const c = Math.min(1, Math.max(0, v));
    const enc = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, enc)) * 255);
  });
}
const hex = (L, C, H) => "#" + oklchToRgb(L, C, H).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const ok = (L, C, H) => `oklch(${+L.toFixed(4)} ${+C.toFixed(4)} ${H})`;
const stepLightness = Object.fromEntries(STEPS);

// Each token is emitted twice: an sRGB hex fallback, then the oklch value that
// supersedes it wherever oklch() is supported.
const pair = (out, name, L, C, H) => {
  if (L < 0 || L > 1) throw new Error(`${name}: lightness ${L} is outside 0..1`);
  out.push(`  --${name}: ${hex(L, C, H)};`);
  out.push(`  --${name}: ${ok(L, C, H)};`);
};

function primitives(livery) {
  const out = [`:root[data-livery="${livery.id}"], [data-livery="${livery.id}"] {`];
  out.push(`  --livery-name: "${livery.name}";`);
  out.push(`  --presence-hue: ${livery.presence};`);
  for (const [step, L] of STEPS) {
    pair(out, `mono-${step}`, L, MONO_PEAK_CHROMA * CHROMA_MULT[step] * livery.chromaMult, livery.hue);
  }
  out.push("}");
  return out.join("\n");
}

function beaconRamp() {
  const out = [":root {"];
  for (const [step, L] of STEPS) {
    pair(out, `beacon-${step}`, L, BEACON.peak * CHROMA_MULT[step], BEACON.hue);
  }
  out.push("}");
  return out.join("\n");
}

// §3.4 — a livery colours your tail ring, and under monochrome that ring is
// the only hue a person carries. Emitted at root scope for every livery, per
// variant, so one roster can show six people in six liveries at once.
function tailPalette(variant) {
  const dark = variant === "night";
  const out = [`:root[data-variant="${variant}"], [data-variant="${variant}"] {`];
  for (const l of LIVERIES) {
    pair(out, `tail-${l.id}`, dark ? 0.78 : 0.52, 0.11, l.presence);
    pair(out, `tail-${l.id}-bg`, dark ? 0.26 : 0.93, 0.03, l.presence);
  }
  out.push("}");
  return out.join("\n");
}

function semantics(variant) {
  const map = SEMANTICS[variant];
  const out = [
    `:root[data-variant="${variant}"], [data-variant="${variant}"] {`,
  ];
  for (const [name, ref] of Object.entries(map)) out.push(`  --${name}: var(--${ref});`);
  for (const [name, value] of Object.entries(HAIRLINE[variant])) out.push(`  --${name}: ${value};`);
  out.push("}");
  return out.join("\n");
}

// §4.1 — a presence warm shift is hue → the livery presence hue, chroma .03,
// lightness +0.03. Technically colour, perceptually light. Emitted per livery
// and variant because it is relative to the surface it warms.
//
// The sign inverts in day. §4.1's +0.03 assumes a dark ground: on a light one
// it walks toward white, which reads as *less* present, and bg-ground at L .97
// plus the lit step lands at 1.06 — outside the range entirely. Warming a light
// surface means going slightly deeper, so day subtracts.
function presence(livery, variant) {
  const map = SEMANTICS[variant];
  const out = [
    `:root[data-livery="${livery.id}"][data-variant="${variant}"],`,
    `[data-livery="${livery.id}"][data-variant="${variant}"] {`,
  ];
  const dir = variant === "day" ? -1 : 1;
  for (const surface of ["bg-ground", "bg-panel"]) {
    const step = map[surface].replace("mono-", "");
    pair(out, `presence-${surface.replace("bg-", "")}`, stepLightness[step] + dir * 0.03, 0.03, livery.presence);
  }
  // The lit state a door or a glow reaches at full warmth.
  const groundStep = map["bg-ground"].replace("mono-", "");
  pair(out, "presence-lit", stepLightness[groundStep] + dir * 0.09, 0.04, livery.presence);
  out.push("}");
  return out.join("\n");
}

const header = `/* GENERATED — do not edit. Run: node scripts/build-tokens.mjs
 *
 * docs/SPEC-V2.md §3. Three layers: primitives, semantics, components.
 * Components must reference semantics only — never a --mono-* step directly.
 */\n`;

const css = [
  header,
  beaconRamp(),
  ...LIVERIES.map(primitives),
  semantics("night"),
  semantics("day"),
  tailPalette("night"),
  tailPalette("day"),
  ...LIVERIES.flatMap((l) => [presence(l, "night"), presence(l, "day")]),
].join("\n\n") + "\n";

writeFileSync(new URL("../src/styles/tokens.css", import.meta.url), css);

// ---- self-check: §12 requires AA on the text tokens ----------------------
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const stepL = Object.fromEntries(STEPS);
const rgbOf = (livery, ref) => {
  const [, step] = ref.split(/mono-|beacon-/);
  const isBeacon = ref.startsWith("beacon");
  const L = stepL[step];
  const C = isBeacon ? BEACON.peak * CHROMA_MULT[step] : MONO_PEAK_CHROMA * CHROMA_MULT[step] * livery.chromaMult;
  return oklchToRgb(L, C, isBeacon ? BEACON.hue : livery.hue);
};

let worst = { r: Infinity };
for (const livery of LIVERIES) {
  for (const variant of ["night", "day"]) {
    const m = SEMANTICS[variant];
    for (const text of ["text-primary", "text-secondary"]) {
      for (const bg of ["bg-ground", "bg-panel"]) {
        const r = ratio(rgbOf(livery, m[text]), rgbOf(livery, m[bg]));
        if (r < worst.r) worst = { r, at: `${livery.id}/${variant}/${text} on ${bg}` };
      }
    }
  }
}
console.log(`tokens: ${LIVERIES.length} liveries x 13 steps + beacon + 2 variants -> src/styles/tokens.css`);
console.log(`§12 AA check — worst text-primary/secondary contrast: ${worst.r.toFixed(2)} (${worst.at})`);
if (worst.r < 4.5) { console.error("FAIL: below AA 4.5:1"); process.exit(1); }

// text-tertiary is exempt by §12 ("non-essential metadata only"). Reported
// rather than asserted, because the number is the reason the rule exists: at
// this contrast it is genuinely unreadable for essential text, and v1 shipped
// seat names and chapter positions in the equivalent token.
let t = { r: Infinity };
for (const livery of LIVERIES) {
  for (const variant of ["night", "day"]) {
    const m = SEMANTICS[variant];
    for (const bg of ["bg-ground", "bg-panel"]) {
      const r = ratio(rgbOf(livery, m["text-tertiary"]), rgbOf(livery, m[bg]));
      if (r < t.r) t = { r, at: `${livery.id}/${variant} on ${bg}` };
    }
  }
}
console.log(`   text-tertiary worst: ${t.r.toFixed(2)} (${t.at}) — metadata only, never essential text`);
