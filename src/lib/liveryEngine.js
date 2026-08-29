// The colour and lighting rig, ported from the reference files that ship with
// the Step 1 brief (docs/reference/social-dial.html, and the livery-engine
// bench it was tuned on). Every number below was set by eye against the
// rendered result: do not round, retune or "improve" any of them.
//
// Kept pure — no React, no DOM, no client import — so a ramp can be checked
// without mounting anything.

export const wrap = (h) => (((h % 360) + 360) % 360);
export const smooth = (u) => u * u * (3 - 2 * u);

// One lighting rig, shared by all seven. Only the colour of the world changes.
export const LIGHT = {
  ambC: 0.305, soft: 82, ambInt: 0.76, ambSize: 96, ambX: 76, ambY: -18,
  fillInt: 0.34, fillSize: 74, fillX: 16, fillY: 112, glass: 0.78, spill: 0.22,
};

// Anchors are the settings copy for each livery: shadow → core → highlight.
export const LIVERIES = [
  { id: "sky", name: "Sky blue", anchors: "navy → lapiz → sky blue",
    description: "The forty minutes between the climb and the descent.",
    hue: 266, dDark: -11, dLight: -31, midAt: 0.42, midC: 1.35,
    chroma: 0.100, ground: 0.140, light: 0.950, fillAbs: 84, fillC: 0.22 },
  { id: "amber", name: "Caution amber", anchors: "bronze → amber → caution yellow",
    description: "Nothing is actually wrong. The lamp just likes your attention.",
    hue: 78, dDark: -14, dLight: 14, midAt: 0.45, midC: 1.18,
    chroma: 0.126, ground: 0.158, light: 0.944, fillAbs: 70, fillC: 0.15 },
  { id: "tarmac", name: "Tarmac grey", anchors: "gunmetal → graphite → grey",
    description: "Cold concrete, borrowed light, working hours.",
    hue: 255, dDark: 6, dLight: -12, midAt: 0.50, midC: 1.00,
    chroma: 0.022, ground: 0.145, light: 0.955, keyAbs: 58, keyC: 0.105, fillAbs: 256, fillC: 0.30 },
  { id: "beacon", name: "Beacon red", anchors: "maroon → university red → signal red",
    description: "Red, rotating, and not asking twice.",
    hue: 22, dDark: -14, dLight: 6, midAt: 0.44, midC: 1.14,
    chroma: 0.128, ground: 0.148, light: 0.936, fillAbs: 16, fillC: 0.14,
    panelT: 0.048, glass: 0.93 },
  { id: "runway", name: "Runway green", anchors: "olive → grass → spring green",
    description: "Follow the green. It hasn't been wrong yet.",
    hue: 142, dDark: -14, dLight: 9, midAt: 0.46, midC: 1.16,
    chroma: 0.095, ground: 0.120, light: 0.905, fillAbs: 118, fillC: 0.16 },
  { id: "skydrol", name: "Skydrol violet", anchors: "indigo → violet → lavender",
    description: "Hydraulic fluid. If you've had it on your hands, you know.",
    hue: 300, dDark: -18, dLight: 10, midAt: 0.45, midC: 1.18,
    chroma: 0.105, ground: 0.152, light: 0.945, fillAbs: 252, fillC: 0.16 },
];

export const DEFAULT_LIVERY = "sky";
const BY_ID = Object.fromEntries(LIVERIES.map((l) => [l.id, l]));
export const liveryById = (id) => BY_ID[id] || BY_ID[DEFAULT_LIVERY];

// TODO(step-4): the livery picker still writes the v2 ids. Until it is rebuilt
// this maps each stored id onto its nearest engine livery, so a user's existing
// choice survives. `runway` is unreachable until the picker lands.
const FROM_STORED = {
  "dawn-patrol": "amber",      // already warm, first light
  "night-ops": "sky",          // cool steel
  contrail: "tarmac",          // near-colourless
  "carrier-deck": "beacon",    // a night deck is red-lit
  altimeter: "skydrol",        // graphite and lamp-glow
  // Aurora stopped being a livery and became a finish. Anyone stored as aurora
  // lands on sky, whose aurora spec is "a blue night, green ribbons through
  // it" — near enough to what they had that it reads as the same choice. App
  // turns the finish on for them so nothing is lost, only moved.
  aurora: "sky",
};
export const RETIRED_TO_FINISH = { aurora: "aurora" };
export function engineLivery(storedId) {
  if (BY_ID[storedId]) return storedId;
  return FROM_STORED[storedId] || DEFAULT_LIVERY;
}

// ---------------------------------------------------------------- three anchors
// The hue bends through a core somewhere in the middle of the ramp rather than
// running straight from shadow to highlight. This is what stops a ramp looking
// painted.
export function hueAt(c, t) {
  const m = c.midAt;
  return t <= m
    ? wrap(c.hue + c.dDark * (1 - smooth(t / m)))
    : wrap(c.hue + c.dLight * smooth((t - m) / (1 - m)));
}

// Chroma peaks twice over: the global curve keeps both ends off the mud, and a
// gaussian around the core lets the middle read as its own colour.
export function chromaAt(c, t, scale) {
  const curve = 0.15 + 0.85 * Math.sin(Math.PI * Math.pow(t, 1.4));
  const bump = Math.exp(-Math.pow((t - c.midAt) / 0.34, 2));
  return Math.max(0, c.chroma * scale * curve * (1 + (c.midC - 1) * bump));
}

export const at = (c, t, scale) =>
  `oklch(${(c.ground + (c.light - c.ground) * t).toFixed(4)} ` +
  `${chromaAt(c, t, scale).toFixed(4)} ${hueAt(c, t).toFixed(2)})`;

export const ramp = (c, scale) => Array.from({ length: 13 }, (_, i) => at(c, i / 12, scale));

// Never fade to `transparent` — that interpolates through transparent BLACK and
// leaves a dirty grey collar around every light. Fade to the same hue at alpha 0.
export const col = (l, c, h, a) => `oklch(${l} ${c.toFixed(3)} ${h.toFixed(1)} / ${a})`;
export const withA = (c, a) => c.replace(/\)\s*$/, " / " + a + ")");

// Layer coordinates are not deck coordinates. The light layers sit at
// inset:-55%, so they are 210% of the deck; a gradient positioned at "16%"
// would land outside the frame unless it is mapped first.
const K = 100 / 210, O = 55 * K;
export const LX = (v) => (O + K * v).toFixed(1);
export const LS = (v) => (K * v).toFixed(1);

// Bright in HUE, not in brightness: the core sits at .84, not .90. A core near
// white holds no hue at all and reads flat. The alpha lives in the body stops.
export const keyImg = (h, c, x, y, s) => {
  const A = (a) => col(0.84, c * 1.12, h, a);
  const B = (a) => col(0.74, c * 1.10, h, a);
  return `radial-gradient(${s}% ${(s * 0.86).toFixed(0)}% at ${x}% ${y}%, ${A(0.9)} 0%, ${B(0.6)} 26%,` +
    ` ${B(0.3)} 48%, ${B(0.1)} 66%, ${col(0.74, c * 1.1, h, 0)} 84%)`;
};

// The fill is an accent, not a second key. It lifts one corner and gives the
// room a second temperature. Key to fill runs about 3:1. Do not enlarge it.
export const fillImg = (h, c, x, y, s) => {
  const B = (a) => col(0.72, c * 1.08, h, a);
  return `radial-gradient(${s}% ${(s * 0.86).toFixed(0)}% at ${x}% ${y}%, ${B(0.92)} 0%, ${B(0.5)} 26%,` +
    ` ${col(0.7, c * 0.96, h, 0.2)} 50%, ${col(0.7, c * 0.96, h, 0)} 76%)`;
};

// ---------------------------------------------------------------------- aurora
// Seven tall narrow ellipses hung off the top edge over one continuous band,
// plus three violet fringe ellipses beneath.
export const CURTAINS = [
  [16, -5, 10, 62, 156, 0.58], [27, -4, 7, 48, 174, 0.44], [38, -6, 13, 74, 150, 0.64],
  [50, -4, 8, 54, 188, 0.40], [62, -5, 11, 66, 158, 0.56], [74, -4, 7, 46, 198, 0.38],
  [86, -5, 9, 58, 166, 0.46],
  [30, 22, 34, 26, 318, 0.34], [63, 19, 30, 23, 332, 0.30], [84, 24, 24, 18, 300, 0.22],
];
export const auroraImg = () =>
  CURTAINS.map(([x, y, w, h, hu, a]) =>
    `radial-gradient(${LS(w * 1.7)}% ${LS(h)}% at ${LX(x)}% ${LX(y)}%,` +
    ` ${col(0.88, 0.145, hu, a * 0.62)} 0%, ${col(0.76, 0.195, hu, a * 0.34)} 30%,` +
    ` ${col(0.76, 0.195, hu, a * 0.13)} 56%, ${col(0.76, 0.195, hu, 0)} 80%)`).join(", ")
  + `, radial-gradient(${LS(86)}% ${LS(34)}% at ${LX(50)}% ${LX(-6)}%,` +
    ` ${col(0.84, 0.170, 158, 0.40)} 0%, ${col(0.74, 0.195, 172, 0.26)} 34%,` +
    ` ${col(0.70, 0.190, 192, 0.13)} 60%, ${col(0.70, 0.190, 192, 0)} 84%)`;

// Stars come off a seeded LCG so they never redraw differently.
export const rng = (seed) => { let z = seed; return () => (z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };

export function dotTile(n, seed, maxR, alpha) {
  const R = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = (R() * 100).toFixed(2), y = (R() * 100).toFixed(2);
    const r = (0.5 + R() * maxR).toFixed(2), a = (alpha * (0.3 + R() * 0.7)).toFixed(3);
    out.push(`radial-gradient(${r}px ${r}px at ${x}% ${y}%, rgba(255,255,255,${a}) 0%, rgba(255,255,255,0) 100%)`);
  }
  return out.join(", ");
}


// ------------------------------------------------------------------- day mode
// Day is always cream, whatever the livery. Only the light and the accents
// carry it: a fully red or violet light mode is unreadable, a cream page lit by
// one is not.
export const CREAM = {
  ground: "oklch(.966 .010 85)", panel: "oklch(.992 .005 85)", raised: "oklch(.936 .013 85)",
  line: "oklch(.876 .014 85)", t1: "oklch(.250 .012 85)", t2: "oklch(.462 .010 85)",
  t3: "oklch(.618 .009 85)",
};


/**
 * Every custom property the deck needs, for one livery in one variant.
 * Returns { vars, C, surf } — `C` is the solid (un-glassed) semantic map, which
 * is what the SVG instruments and the flight profiles paint with.
 */

// --------------------------------------------------------------- Day, as built
// Ported verbatim from design/wingman-day-source.js. Day is no longer the Night
// ramp lightened: it has its own text tokens, its own stock per livery, and a
// rig that subtracts as well as adds.
//
// t3 was .618 .009 85, which measured 2.99:1 against the deep ground and failed
// on 9.5px uppercase mono. .505 clears 4.5:1 everywhere it lands; t2 moves down
// with it so the three levels keep their step.
export const DAY = {
  g: ".966 .010 85",            // overridden by the stock below
  p: ".992 .005 85", rz: ".936 .013 85", l: ".876 .014 85",
  t3: ".505 .009 85", t2: ".430 .010 85", t1: ".250 .012 85",
};

// [chroma, hue]. Each livery sits on its own paper. This reverses the earlier
// rule that the Day ground be constant across liveries — it was constant, and
// that is exactly why Day read as one theme wearing six accents. Beacon's is
// the loud one on purpose: a blush pink under deep signal-red ink.
export const STOCK = {
  sky: [".014", 240], amber: [".024", 80], tarmac: [".008", 250],
  beacon: [".038", 16], runway: [".015", 122], skydrol: [".015", 296],
};

// The ground drops from L .966 to L .930 and raised/line follow it down.
// Night's ground-to-panel step is a 48% relative lightness jump; at .966 Day's
// was 2.7%, which is the whole reason it looked flat.
export function dayGround(id) {
  const [chroma, hue] = STOCK[id] || STOCK.sky;
  return { g: `.930 ${chroma} ${hue}`, rz: `.944 .013 ${hue}`, l: `.842 .016 ${hue}` };
}

export const dayKey = () =>
  "radial-gradient(84% 72% at 78% -14%, oklch(0.995 0.055 82 / 0.95) 0%, "
  + "oklch(0.985 0.048 78 / 0.62) 26%, "
  + "oklch(0.975 0.040 76 / 0.28) 50%, "
  + "oklch(0.970 0.035 76 / 0) 76%)";

// Screen is additive: on a near-white ground it does nothing, which is why
// lightening the Night gradients never worked. The fill has to subtract.
export const dayFill = (h, c) =>
  `radial-gradient(104% 84% at 14% 114%, oklch(0.610 ${(c * 1.30).toFixed(3)} ${h}.0 / 0.70) 0%, `
  + `oklch(0.720 ${(c * 1.05).toFixed(3)} ${h}.0 / 0.40) 28%, `
  + `oklch(0.860 ${(c * 0.70).toFixed(3)} ${h}.0 / 0.14) 56%, `
  + `oklch(0.940 ${(c * 0.50).toFixed(3)} ${h}.0 / 0) 82%)`;

// Five stops, not three. Tight and genuinely dark where the surface meets the
// ground, then progressively wider and softer.
export const DAY_DROP =
  "0 .5px .5px oklch(.44 .050 66/.30), "
  + "0 1.5px 2px oklch(.47 .050 66/.20), "
  + "0 4px 5px oklch(.50 .045 66/.15), "
  + "0 11px 17px oklch(.52 .040 66/.13), "
  + "0 28px 56px oklch(.55 .045 66/.17)";

export const DAY_SHEEN =
  "linear-gradient(174deg, oklch(1 0 0/.66) 0%, oklch(1 0 0/.24) 13%, "
  + "oklch(1 0 0/.05) 29%, transparent 50%), "
  + "linear-gradient(116deg, transparent 30%, oklch(1 0 0/.26) 45%, transparent 60%)";

export function deckVars(liveryId, variant = "night") {
  const L = liveryById(liveryId);
  const night = variant !== "day";
  const surf = ramp(L, 1);
  const ink = ramp(L, 0.34);

  const pT = L.panelT != null ? L.panelT : 1 / 12;
  const gl = L.glass != null ? L.glass : LIGHT.glass;

  // Brightness is state. There is no second colour anywhere — something is on
  // when it rises up the ramp and off when it sinks toward the ground. Larger
  // areas take a lower rung than small marks, or a lit lamp burns a hole in
  // the panel.
  const H = hueAt(L, 0.55), Cm = L.chroma * L.midC;
  // Day's stock, text tiers and deep ground, per livery.
  const dayC = (id) => {
    const G = dayGround(id);
    return { ground: `oklch(${G.g})`, panel: `oklch(${DAY.p})`,
             raised: `oklch(${G.rz})`, line: `oklch(${G.l})`,
             t3: `oklch(${DAY.t3})`, t2: `oklch(${DAY.t2})`, t1: `oklch(${DAY.t1})` };
  };
  // Night's t3 sat on rung 6 of the ink ramp and measured 3.38 to 3.72 against
  // the panel across the six liveries — under the 4.5 floor, on text that
  // carries meaning in 31 places. It is the same failure Day had at 2.99,
  // which was fixed by moving its t3 from .618 to .505.
  //
  // Lifted by lightness rather than by moving a rung: rung 7 only reaches 4.35
  // and rung 8 overshoots to 5.7, crowding t2. +0.08 is the smallest lift that
  // clears, and it lands at 4.72 worst case — which is where Day's sits.
  const T3_LIFT = 0.08;
  const liftL = (c, by) =>
    c.replace(/oklch\(\s*([\d.]+)/, (_, L) => `oklch(${Math.min(1, Number(L) + by).toFixed(4)}`);

  const C = night
    ? { ground: surf[0], panel: at(L, pT, 1), raised: at(L, pT + 0.085, 1), line: at(L, pT + 0.17, 1),
        t3: liftL(ink[6], T3_LIFT), t2: ink[9], t1: ink[12], active: surf[8], on: surf[9], lit: surf[11] }
    : { ...CREAM, ...dayC(L.id),
        active: `oklch(.560 ${(Cm * 1.55).toFixed(3)} ${H.toFixed(1)})`,
        on: `oklch(.630 ${(Cm * 1.45).toFixed(3)} ${H.toFixed(1)})`,
        lit: `oklch(.470 ${(Cm * 1.70).toFixed(3)} ${H.toFixed(1)})` };

  const vars = {};
  Object.entries(C).forEach(([k, v]) => { vars["--" + k] = v; });

  // Filled controls carry --ground text. §3.4's day accent sits at .560, which
  // fails AA on the higher-chroma liveries, so fills take a darker step.
  vars["--active-fill"] = night
    ? surf[8]
    : `oklch(.455 ${(Cm * 1.62).toFixed(3)} ${H.toFixed(1)})`;

  // The accent READ AS WORDS, which is a different job from the accent as a
  // fill. Part 12's lesson surface says "answered" and "everyone sees this" in
  // the accent at 13px, and measured across the matrix the day accent came in
  // at 3.55:1 — it is tuned to sit under --ground text on a filled control,
  // not to be read on the page itself. Night's already clears 5.7, so only
  // Day takes a step down.
  vars["--active-text"] = night
    ? C.active
    : `oklch(.430 ${(Cm * 1.40).toFixed(3)} ${H.toFixed(1)})`;

  // Panels are glass, so light passes through them. The ground stays solid
  // because it is the room, not a surface in it.
  vars["--panel"] = withA(C.panel, gl.toFixed(2));
  vars["--raised"] = withA(C.raised, Math.min(1, gl + 0.09).toFixed(2));
  vars["--line"] = withA(C.line, Math.min(1, gl + 0.16).toFixed(2));

  // Lamps on anchors: key takes the highlight hue, fill a hand-picked
  // completing colour in the same family.
  const keyH = L.keyAbs != null ? L.keyAbs : hueAt(L, 1);
  const keyC = L.keyC != null ? L.keyC : LIGHT.ambC;
  const fillC = LIGHT.ambC * 0.85 * (L.fillC != null ? L.fillC : 1);

  vars["--key-img"] = L.aurora ? auroraImg() : keyImg(keyH, keyC, LIGHT.ambX, LIGHT.ambY, LIGHT.ambSize);
  vars["--fill-img"] = fillImg(wrap(L.fillAbs), fillC, LX(LIGHT.fillX), LX(LIGHT.fillY), LS(LIGHT.fillSize));

  const keyInt = L.aurora ? 0.94 : LIGHT.ambInt;
  vars["--key-int"] = (night ? keyInt : keyInt * 0.34).toFixed(3);
  vars["--fill-int"] = (night ? LIGHT.fillInt : LIGHT.fillInt * 0.30).toFixed(3);
  vars["--spill"] = (night ? LIGHT.spill : LIGHT.spill * 0.35).toFixed(3);
  vars["--soft"] = LIGHT.soft + "px";
  vars["--grain"] = "0.05";
  vars["--emit"] = "10px";
  // Aurora is the only livery that shows the starfield, and only at night.
  vars["--stars"] = night && L.aurora ? "0.95" : "0";

  // Day is not the Night rig lightened. The key still SCREENS a warm bloom into
  // the sun corner; the fill MULTIPLIES livery-tinted shade into the opposite
  // one. Same angles, same blur, same 26s/41s drift with the fill reversed —
  // opposite direction. Night keeps both layers additive and is untouched.
  vars["--blend"] = "screen";
  vars["--blend2"] = night ? "screen" : "multiply";
  if (night) {
    vars["--drop"] = "none";
    vars["--sheen-img"] = "none";
  } else {
    vars["--key-img"] = dayKey();
    vars["--fill-img"] = dayFill(keyH, keyC * 0.42);
    vars["--key-int"] = "0.92";
    vars["--fill-int"] = "0.66";
    vars["--soft"] = LIGHT.soft + "px";
    vars["--stars"] = "0";
    vars["--grain"] = "0.20";
    vars["--drop"] = DAY_DROP;
    vars["--sheen-img"] = DAY_SHEEN;
  }

  // Chromatic edges: a lit edge on top and an unlit edge underneath, instead of
  // one flat border. Hued shadows: black on a coloured ground reads as a hole
  // punched through the room.
  const Lat = (t) => L.ground + (L.light - L.ground) * t;
  const eLo = hueAt(L, 0.05), eHi = hueAt(L, 0.95);
  // §4.5's formula has no day variant, and the POC applies it unchanged in both
  // modes — a deep hued shadow under a card on cream, which is what a shadow on
  // a light page looks like anyway.
  vars["--shadow-c"] = `oklch(${(L.ground * 0.42).toFixed(3)} ${(Cm * 0.6).toFixed(3)} ${eLo.toFixed(1)} / .58)`;
  // §10: card borders warmer on top than underneath. Highlight hue above,
  // shadow hue below, per livery — chromatic in both modes, which is the part
  // the build used to get wrong: it went neutral cream in day, one pair for all
  // seven liveries, and the cards read flat.
  vars["--edge-hi"] =
    `oklch(${night ? ".72" : ".86"} ${(Cm * 0.50).toFixed(3)} ${eHi.toFixed(1)} / ${night ? ".34" : ".50"})`;
  vars["--edge-lo"] =
    `oklch(${night ? ".22" : ".62"} ${(Cm * 0.45).toFixed(3)} ${eLo.toFixed(1)} / ${night ? ".50" : ".34"})`;

  return { vars, C, surf, ink, livery: L, night };
}
