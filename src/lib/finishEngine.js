// The Finish system. A livery is a colour; a finish is a material.
//
// Ported verbatim from the Livery Engine II reference (design/wingman-finish-
// source.js). Every number here was arrived at against reference photography:
// do not re-derive, round, tidy or substitute. If a value looks odd it is
// deliberate.
//
// Kept out of liveryEngine.js on purpose. That file is the stock, checked
// token for token against the POC by scripts/check-livery.mjs, and a finish
// must never be able to move it: finishVars() returns overrides that are
// layered on top, and returns nothing at all for the None finish.

// Deterministic jitter. No Math.random anywhere in here — a random field
// re-rolls on every render and the sky crawls.
const rnd = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };

const ok = (s) => `oklch(${s})`;

/* ---------- aurora specs, one per livery ---------- */
// [hue, weight, chromaMul]. Narrower bands, lower blur and a pass of fine
// rays, so each display reads as structure rather than bloom.
export const AUR = {
  // cH is the curtain wall — the livery's own colour, walked across a few near
  // neighbours so the wall has variation without ever leaving its hue. fr is the
  // fringe underneath: [x, y, w, h, hue, alpha], the second colour the
  // phenomenon makes, low and wide and never competing with the wall.
  sky: { sub: "blue and cyan, a light purple beside it, green low", soft: "30px",
    gnd: ".0880 .0260 258", pan: ".1620 .0220 256/.82", rai: ".2180 .0270 254/.88", lin: ".2900 .0360 252/.94",
    bl: .74, c: .215, gain: 1.55, bandA: .26,
    cH: [246, 238, 252, 190, 262, 292, 162],
    fr: [[30, 22, 34, 26, 158, .34], [63, 19, 30, 23, 196, .30], [84, 24, 24, 18, 296, .26]],
    fC: 1.0, stars: 360, grain: .05 },

  // The colours kept from the accent rendition: crimson wall, ember through it,
  // the green oxygen line fringing at the base.
  beacon: { sub: "crimson and magenta, a little orange, green at the base", soft: "28px",
    gnd: ".0800 .0230 18", pan: ".1540 .0220 16/.86", rai: ".2100 .0290 18/.92", lin: ".2820 .0390 20/.96",
    bl: .70, c: .240, gain: 1.58, bandA: .26,
    cH: [14, 8, 20, 330, 2, 38, 350],
    fr: [[30, 22, 34, 26, 150, .30], [63, 19, 30, 23, 336, .30], [84, 24, 24, 18, 44, .24]],
    fC: 1.0, stars: 320, grain: .06 },

  amber: { sub: "amber and orange, reds worked through it", soft: "30px",
    gnd: ".0790 .0130 46", pan: ".1530 .0140 48/.82", rai: ".2090 .0180 50/.88", lin: ".2810 .0240 54/.94",
    bl: .80, c: .215, gain: 1.22, bandA: .26,
    cH: [56, 46, 62, 14, 50, 2, 38],
    fr: [[30, 22, 34, 26, 22, .32], [63, 19, 30, 23, 96, .24], [84, 24, 24, 18, 6, .26]],
    fC: 1.0, stars: 520, grain: .05 },

  skydrol: { sub: "a violet wall, blue and teal through it, rose at its foot", soft: "31px",
    gnd: ".0860 .0280 296", pan: ".1600 .0240 294/.82", rai: ".2160 .0290 292/.88", lin: ".2880 .0390 294/.94",
    bl: .72, c: .210, gain: 1.45, bandA: .26,
    cH: [308, 316, 300, 262, 312, 186, 324],
    fr: [[30, 22, 34, 26, 176, .32], [63, 19, 30, 23, 200, .28], [84, 24, 24, 18, 348, .24]],
    fC: 1.0, stars: 360, grain: .05 },

  // Closest to the first rendition of all six: a green wall with a violet
  // fringe under it, which is the shape that started this.
  runway: { sub: "a green wall, blue through it, violet beside it", soft: "28px",
    gnd: ".0820 .0230 190", pan: ".1560 .0200 186/.82", rai: ".2120 .0250 180/.88", lin: ".2840 .0340 176/.94",
    bl: .78, gC: 2.5, c: .225, gain: 0.70, bandA: .26,
    cH: [152, 146, 158, 210, 166, 288, 176],
    fr: [[30, 22, 34, 26, 318, .44], [63, 19, 30, 23, 262, .40], [84, 24, 24, 18, 300, .32]],
    fC: 1.0, stars: 300, grain: .05 },

  // The other set kept from the accent rendition: silver wall, copper fringe.
  // Held near-neutral by its own low chroma, with the fringe given more.
  tarmac: { sub: "cold grey, a little copper in it", soft: "32px",
    gnd: ".0630 .0080 250", pan: ".1380 .0080 250/.82", rai: ".1940 .0100 250/.88", lin: ".2660 .0130 252/.94",
    bl: .78,
    cH: [[250, .30], [240, .34], [258, .28], [52, 2.5], [246, .32], [44, 2.6], [226, .40]], c: .088, gain: 1.60, bandA: .26,
    fr: [[30, 22, 34, 26, 50, .30], [63, 19, 30, 23, 248, .24], [84, 24, 24, 18, 258, .22]],
    fC: 1.9, cloud: "radial-gradient(44% 17% at 20% 32%, oklch(.28 .012 252/.60) 0%, transparent 76%), radial-gradient(36% 12% at 62% 20%, oklch(.30 .012 250/.52) 0%, transparent 74%), radial-gradient(48% 14% at 80% 44%, oklch(.26 .012 254/.50) 0%, transparent 78%)",
    cloudOp: .40, stars: 300, grain: .14 },
};

// aurora text tiers (ground/panel/raised/line come from each spec above)
export const AURN = { g: ".1900 .0119 258", p: ".2537 .0187 257.06/.78", rz: ".3188 .0302 254.73/.87", l: ".3838 .0441 251.87/.94", t3: ".5870 .0273 247.30", t2: ".7637 .0245 235.24", t1: ".9550 .0040 226" };

/* ---------- manual finish ---------- */
export const MAN = {
  N: { g: ".1600 .0060 85", p: ".2050 .0070 85/.80", rz: ".2450 .0080 85/.88", l: ".3600 .0100 85/.90", t3: ".5600 .0080 85", t2: ".7400 .0070 85", t1: ".9200 .0060 85", grain: .15 },
  D: { g: ".966 .010 85", p: ".992 .005 85/.88", rz: ".950 .011 85/.92", l: ".876 .014 85/.94", t3: ".545 .010 85", t2: ".395 .011 85", t1: ".215 .012 85", grain: .17 },
};





/* ---------- generators ---------- */

// Layer coordinates are not screen coordinates: the rig sits at inset -55%, so
// each layer is 210% of the deck and a curtain authored at "16%" would land off
// frame. Everything below is authored in screen space and mapped through these.
const K = 100 / 210, O = 55 * K;
const LX = (v) => (O + K * v).toFixed(1);
const LS = (v) => (K * v).toFixed(1);

// Depth. The rig already owns two light layers that drift at different rates in
// opposite directions, and the second is blurred 1.15x more than the first —
// which is parallax and depth of field already built, just never used as such.
// Near curtains go on the key layer, far ones on the fill layer, and the two
// slide past each other exactly the way a real curtain wall does when you move
// under it. Nothing is added per frame to get this.
//
// Within a layer, distance is drawn rather than composited: far curtains are
// narrower and shorter, they sit closer to the vanishing centre, they carry
// less alpha, and their stops are spread wider so they read softer.
const VANISH = 50;

// Ported back from the live build, where it is what keeps the display ethereal
// rather than painted on. At full strength the curtains wash the whole deck and
// the type in front has to fight them.
const VEIL = 0.78;

// Also from the live build: narrower curtains than the first rendition drew.
// The first hung wide soft shapes; the live one hangs ribbons. Between the two.
const NARROW = 0.62;

function curtain(sp, x, w, h, hu, a, d, cm = 1) {
  const conv = VANISH + (x - VANISH) * (1 - d * .42);
  const ww = w * (1 - d * .38) * NARROW, hh = h * (1 - d * .30) * 1.02;
  const y = -5 + d * 5, al = Math.min(.95, a * (1 - d * .34) * (sp.gain || 1) * VEIL);
  const soften = 1 + d * .5;                       // far edges bleed further
  const bl = sp.bl, c = sp.c * cm;
  return `radial-gradient(${LS(ww * 1.7)}% ${LS(hh)}% at ${LX(conv)}% ${LX(y)}%,`
    + ` oklch(${(bl + .10).toFixed(3)} ${(c * .68).toFixed(3)} ${hu}.0 / ${(al * .62).toFixed(3)}) 0%,`
    + ` oklch(${bl.toFixed(3)} ${c.toFixed(3)} ${hu}.0 / ${(al * .34).toFixed(3)}) ${(30 * soften).toFixed(0)}%,`
    + ` oklch(${bl.toFixed(3)} ${c.toFixed(3)} ${hu}.0 / ${(al * .13).toFixed(3)}) ${(56 * soften).toFixed(0)}%,`
    + ` oklch(${bl.toFixed(3)} ${c.toFixed(3)} ${hu}.0 / 0) ${(80 * soften).toFixed(0)}%)`;
}

// The one continuous band the curtains hang in front of. Without it they read
// as separate objects; with it they read as structure inside one light.
function band(sp) {
  const bl = sp.bl, c = sp.c, hu = sp.cH[0];
  const bA = Math.min(.95, sp.bandA * (sp.gain || 1) * VEIL);
  return `radial-gradient(${LS(86)}% ${LS(34)}% at ${LX(50)}% ${LX(-6)}%,`
    + ` oklch(${(bl + .06).toFixed(3)} ${(c * .80).toFixed(3)} ${hu}.0 / ${bA.toFixed(3)}) 0%,`
    + ` oklch(${(bl - .04).toFixed(3)} ${c.toFixed(3)} ${(Array.isArray(sp.cH[1]) ? sp.cH[1][0] : sp.cH[1] || hu)}.0 / ${(bA * .64).toFixed(3)}) 34%,`
    + ` oklch(${(bl - .08).toFixed(3)} ${(c * .92).toFixed(3)} ${(Array.isArray(sp.cH[2]) ? sp.cH[2][0] : sp.cH[2] || hu)}.0 / ${(bA * .32).toFixed(3)}) 60%,`
    + ` oklch(${(bl - .10).toFixed(3)} ${(c * .92).toFixed(3)} ${(Array.isArray(sp.cH[2]) ? sp.cH[2][0] : sp.cH[2] || hu)}.0 / 0) 84%)`;
}

// The fringe below — the second colour the phenomenon makes, wide and low and
// well under the curtains, never competing with them.
function fringe(sp, x, y, w, h, hu, a0) {
  const bl = sp.bl, c = sp.c * (sp.fC || 1);
  const a = Math.min(.95, a0 * (sp.gain || 1) * VEIL);
  return `radial-gradient(${LS(w)}% ${LS(h)}% at ${LX(x)}% ${LX(y)}%,`
    + ` oklch(${(bl + .04).toFixed(3)} ${(c * .72).toFixed(3)} ${hu}.0 / ${a}) 0%,`
    + ` oklch(${(bl - .06).toFixed(3)} ${c.toFixed(3)} ${hu}.0 / ${(a * .46).toFixed(3)}) 36%,`
    + ` oklch(${(bl - .10).toFixed(3)} ${c.toFixed(3)} ${hu}.0 / ${(a * .16).toFixed(3)}) 64%,`
    + ` oklch(${(bl - .12).toFixed(3)} ${c.toFixed(3)} ${hu}.0 / 0) 88%)`;
}

// Nine curtains, not sixteen blobs. The count is the difference between a wall
// of light you can read and a smear you cannot — the first rendition used seven
// and was the calmest this has ever looked.
const CUR = [
  //  x    w    h   alpha  depth
  [16,  10,  62,  .58,  .00],
  [27,   7,  48,  .44,  .62],
  [38,  13,  74,  .64,  .12],
  [50,   8,  54,  .40,  .78],
  [62,  11,  66,  .56,  .06],
  [74,   7,  46,  .38,  .70],
  [86,   9,  58,  .46,  .22],
  [21,   6,  40,  .34,  .90],
  [69,   6,  44,  .36,  .84],
];

// Returns the two halves of the display: what hangs near you, and what hangs
// behind it. They are drawn into different layers so they move independently.
export function auroraLayers(sp) {
  const near = [band(sp)], far = [];
  CUR.forEach((cu, i) => {
    const [x, w, h, a, d] = cu;
    // Hue walks along the accent family rather than repeating one value, so the
    // wall has variation in it without ever leaving the livery's own colour.
    const slot = i % sp.cH.length;
    const ent = sp.cH[slot];
    const hu = Array.isArray(ent) ? ent[0] : ent;
    const own = Array.isArray(ent) ? ent[1] : 1;
    // Slots 3 and 5 are the guests — the two faintest curtains of the nine.
    // Dim is what keeps them from claiming the wall, but dim also made them
    // invisible, so they get their presence as chroma rather than as light:
    // more colour, no more brightness, no more attention.
    const guest = own * ((slot === 3 || slot === 5) ? (sp.gC || 1.7) : 1);
    const jx = x + (rnd(i + 11) - .5) * 7;
    const g = curtain(sp, jx, w * (.85 + rnd(i + 3) * .4), h * (.88 + rnd(i + 7) * .3), hu, a, d, guest);
    (d < .5 ? near : far).push(g);
  });
  sp.fr.forEach((f) => far.push(fringe(sp, f[0], f[1], f[2], f[3], f[4], f[5])));
  return { near: near.join(", "), far: far.join(", ") };
}

export const horizon = (g) => `radial-gradient(142% 36% at 50% 103%, `
  + `oklch(0.94 ${g.c} ${g.h}.0 / ${g.a}) 0%, `
  + `oklch(0.86 ${g.c} ${g.h}.0 / ${(g.a * .58).toFixed(3)}) 28%, `
  + `oklch(0.78 ${g.c} ${g.h}.0 / ${(g.a * .22).toFixed(3)}) 54%, `
  + `oklch(0.76 ${g.c} ${g.h}.0 / 0) 82%)`;

// The starfield, as one tiled image rather than n separate gradients.
//
// The reference emits one radial-gradient per star — 360 of them for sky, 520
// for amber — in a single background-image across the whole layer. Generating
// and parsing that is cheap (measured under 3ms), but PAINTING it is not: it is
// hundreds of separate gradient rasterisations over a full-viewport, screen-
// blended surface, and that one-off paint is the hitch you get on selecting
// Aurora.
//
// Same stars, same seeded positions, same sizes and alphas — emitted as a
// single SVG tile the browser decodes once and repeats. n is now a density
// rather than a literal count, which is the one place this file departs from
// the reference, and it is why.
const TILE = 420;

export function starfield(n, seed = 0) {
  // Density preserved: n was spread over roughly seven tiles of viewport. Half
  // to each of the two layers, which fade out of step with each other — a
  // single field can only pulse as one, and stars twinkle individually.
  const per = Math.max(12, Math.round(n / 14));
  let dots = "";
  for (let i = 0; i < per; i++) {
    const j = i + seed;
    const x = (rnd(j * 3 + 1) * 100).toFixed(2), y = (rnd(j * 7 + 2) * 100).toFixed(2);
    const r = (0.7 + rnd(j * 11 + 3) * 1.1).toFixed(2), a = (0.30 + rnd(j * 13 + 4) * 0.65).toFixed(2);
    dots += `<circle cx='${x}%' cy='${y}%' r='${r}' fill='%23fff' opacity='${a}'/>`;
  }
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'%3E${dots}%3C/svg%3E")`;
}

export const STAR_TILE = TILE;

// Why the light choice is being overridden, or null when it is not. A nullable
// string rather than a flag: the card renders whatever it is given and knows
// nothing about which finish produced it. Aurora is the only source today.
export function lightOverride(finish) {
  return finish === "aurora" ? "Aurora is a night sky." : null;
}

export const FINISHES = [
  { id: null, name: "Standard", line: "The livery, as it is." },
  { id: "aurora", name: "Aurora", line: "Polar route, no traffic, nothing to do but look up." },
  { id: "manual", name: "Manual", line: "Everything you need is in here somewhere." },
];

/**
 * Token overrides for a finish, layered over deckVars().
 * Returns an empty object for None, which is what keeps None byte-identical.
 */


export function finishVars(liveryId, variant, finish, accent) {
  const night = variant !== "day";

  // Aurora is night only. In day it falls back to the plain livery — a
  // daylight aurora is not a thing, and faking one looked wrong.
  if (finish === "aurora" && night) {
    const sp = AUR[liveryId];
    if (!sp) return {};
    const layers = auroraLayers(sp);
    const v = {
      "--ground": ok(sp.gnd), "--panel": ok(sp.pan), "--raised": ok(sp.rai), "--line": ok(sp.lin),
      "--t3": ok(AURN.t3), "--t2": ok(AURN.t2), "--t1": ok(AURN.t1),
      "--key-img": layers.near,
      "--fill-img": layers.far,
      "--star-img": starfield(sp.stars, 0),
      "--star-img-b": starfield(sp.stars, 977),
      "--key-int": "0.86", "--fill-int": "0.62", "--stars": "1",
      "--soft": sp.soft,
      "--grain": String(sp.grain),
    };
    if (sp.cloud) { v["--cloud-img"] = sp.cloud; v["--cloud-op"] = String(sp.cloudOp); }
    return v;
  }

  if (finish === "manual") {
    const m = night ? MAN.N : MAN.D;
    return {
      "--ground": ok(m.g), "--panel": ok(m.p), "--raised": ok(m.rz), "--line": ok(m.l),
      "--t3": ok(m.t3), "--t2": ok(m.t2), "--t1": ok(m.t1),
      // The light rig is off entirely. A printed page has no atmosphere, and
      // faking one is what made Day look wrong.
      "--key-int": "0", "--fill-int": "0", "--stars": "0",
      // The ported value, in both modes. What changes is the material, not the
      // amount: in Day the deck carries Tooth, so this same .17 is multiplied
      // through a directional desaturated turbulence and reads as paper fibre.
      // As overlay-blended isotropic noise it read as digital speckle on a
      // light ground, which is what made the page look grey rather than cream.
      // Night keeps overlay: the microfiche ground is dark, where it is right.
      "--grain": String(m.grain),
      // Manual replaces the stock entirely: no gloss, no cast shadow, no tooth.
      // It has its own --paper-drop in the finish CSS.
      "--sheen-img": "none", "--drop": "none",
      "--active": accent, "--active-fill": accent,
    };
  }

  return {};
}

// The ruled pad, in the livery's ink. Only meaningful under Manual.
export function ruledLayer(accent, day) {
  const a27 = accent.replace(/\)$/, " / .30)");
  const a45 = accent.replace(/\)$/, " / .45)");
  return {
    opacity: day ? .55 : .34,
    backgroundImage:
      `repeating-linear-gradient(180deg, transparent 0 27px, ${a27} 27px 28px),`
      + ` linear-gradient(90deg, transparent 0 76px, ${a45} 76px 77px, transparent 77px)`,
  };
}
