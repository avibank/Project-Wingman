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
  sky: { sub: "a blue night, green ribbons through it", soft: "52px", rays: 16,
    gnd: ".2080 .0850 264", pan: ".2680 .0640 264/.80", rai: ".3220 .0700 262/.88", lin: ".3900 .0820 260/.94",
    h: [[164, 1], [150, 1], [178, .94], [286, .72], [158, 1], [196, .70], [144, 1], [300, .66],
        [170, 1], [210, .62], [154, 1], [188, .78]], c: .215, ct: .170,
    w: [4, 11], ht: [32, 60], x0: 5, dx: 8.2, y: 19, a0: .46,
    fr: [292, 160, 300], frc: .17, frY: 34, fill: { h: 158, c: .205, a: .50 }, stars: 360, grain: .05 },

  beacon: { sub: "crimson leading, green only at the base", soft: "50px", rays: 16,
    gnd: ".1520 .0400 16", pan: ".2060 .0420 14/.86", rai: ".2620 .0520 16/.92", lin: ".3260 .0700 18/.96",
    h: [[18, 1], [8, 1], [28, 1], [350, .92], [14, 1], [38, .86], [24, 1], [340, .80],
        [10, 1], [46, .74], [20, 1], [146, .56]], c: .240, ct: .190,
    w: [4, 11], ht: [32, 60], x0: 5, dx: 8.2, y: 18, a0: .48,
    fr: [148, 138, 158], frc: .15, frY: 50, fill: { h: 26, c: .200, a: .50 }, stars: 320, grain: .06 },

  amber: { sub: "gold and orange, lime and rose in it", soft: "52px", rays: 18,
    gnd: ".1440 .0260 68", pan: ".2020 .0300 66/.82", rai: ".2620 .0420 68/.88", lin: ".3300 .0620 72/.94",
    h: [[104, 1], [62, 1], [116, 1], [48, .92], [94, 1], [128, .76], [70, 1], [36, .84],
        [110, 1], [352, .62], [56, .94], [86, 1]], c: .205, ct: .164,
    w: [4, 11], ht: [32, 60], x0: 5, dx: 8.2, y: 18, a0: .44,
    fr: [42, 352, 30], frc: .17, frY: 30, fill: { h: 88, c: .212, a: .54 }, stars: 520, grain: .05 },

  skydrol: { sub: "violet leading, teal and rose in it", soft: "52px", rays: 16,
    gnd: ".1720 .0520 292", pan: ".2320 .0480 292/.82", rai: ".2900 .0540 290/.88", lin: ".3560 .0680 292/.94",
    h: [[310, 1], [188, .70], [318, 1], [296, 1], [204, .64], [332, .86], [286, .94], [178, .60],
        [324, 1], [346, .72], [302, 1], [264, .74]], c: .208, ct: .170,
    w: [4, 11], ht: [32, 60], x0: 5, dx: 8.2, y: 18, a0: .46,
    fr: [190, 336, 204], frc: .16, frY: 44, fill: { h: 306, c: .180, a: .48 }, stars: 360, grain: .05 },

  runway: { sub: "a green sky, cyan and blue accents", soft: "50px", rays: 17,
    gnd: ".1520 .0480 168", pan: ".2120 .0400 166/.82", rai: ".2680 .0460 168/.88", lin: ".3320 .0600 170/.94",
    h: [[148, 1], [140, 1], [158, 1], [196, .72], [144, 1], [210, .64], [152, 1], [184, .78],
        [136, 1], [224, .58], [162, 1], [330, .54]], c: .230, ct: .182,
    w: [4, 11], ht: [32, 60], x0: 5, dx: 8.2, y: 19, a0: .46,
    fr: [200, 214, 330], frc: .16, frY: 46, fill: { h: 150, c: .220, a: .56 }, stars: 300, grain: .05 },

  tarmac: { sub: "cold grey, a little copper in it", soft: "60px", rays: 12,
    gnd: ".1480 .0120 250", pan: ".2080 .0120 250/.82", rai: ".2640 .0140 250/.88", lin: ".3300 .0180 252/.94",
    h: [[250, 1, .30], [240, 1, .34], [258, 1, .28], [52, .66, 2.5], [246, 1, .32], [226, .92, .40],
        [44, .58, 2.6], [262, 1, .26], [236, .96, .34], [60, .52, 2.4], [214, .88, .42], [254, 1, .30]],
    c: .088, ct: .070,
    w: [4, 11], ht: [32, 58], x0: 5, dx: 8.2, y: 19, a0: .34,
    fr: [248, 258, 50], frc: .05, frY: 46, fill: { h: 238, c: .070, a: .34 },
    cloud: "radial-gradient(44% 17% at 20% 32%, oklch(.28 .012 252/.60) 0%, transparent 76%), radial-gradient(36% 12% at 62% 20%, oklch(.30 .012 250/.52) 0%, transparent 74%), radial-gradient(48% 14% at 80% 44%, oklch(.26 .012 254/.50) 0%, transparent 78%)",
    cloudOp: .40, stars: 300, grain: .14 },
};

// aurora text tiers (ground/panel/raised/line come from each spec above)
export const AURN = { g: ".1900 .0119 258", p: ".2537 .0187 257.06/.78", rz: ".3188 .0302 254.73/.87", l: ".3838 .0441 251.87/.94", t3: ".5725 .0273 247.30", t2: ".7637 .0245 235.24", t1: ".9550 .0040 226" };

/* ---------- manual finish ---------- */
export const MAN = {
  N: { g: ".1600 .0060 85", p: ".2050 .0070 85/.80", rz: ".2450 .0080 85/.88", l: ".3600 .0100 85/.90", t3: ".5600 .0080 85", t2: ".7400 .0070 85", t1: ".9200 .0060 85", grain: .15 },
  D: { g: ".966 .010 85", p: ".992 .005 85/.88", rz: ".950 .011 85/.92", l: ".876 .014 85/.94", t3: ".545 .010 85", t2: ".395 .011 85", t1: ".215 .012 85", grain: .17 },
};

// Curtains hang. The reference draws each band as a radial blob roughly as wide
// as it is tall, which under a heavy blur read as bloom; sharpened, they read
// as spots. Stretching them vertically and drawing them in turns them into
// ribbons, which is the shape the thing is named after — and a taller, narrower
// gradient covers less area, so there is less to rasterise as well.
const AUR_TALL = 1.45;
const AUR_NARROW = 0.82;

// Ethereal, not wallpaper. At full strength the ribbons washed the whole deck
// and the type on the ground had to fight them. Held back, they read as
// something seen through rather than something painted on — which is the point
// of an aurora and the only way the content in front stays legible.
const AUR_VEIL = 0.78;

/* ---------- generators ---------- */
export function curtains(sp) {
  const out = [];
  // [hue, weight, chromaMul]. Weight is prominence — it drives alpha, size and
  // the white-hot core. chromaMul is saturation, so a livery can lead with a
  // near-neutral hue and still carry a vivid accent.
  sp.h.forEach((hw, i) => {
    const h = hw[0], k = hw[1], cm = (hw[2] === undefined ? 1 : hw[2]);
    const sc = .88 + k * .26;
    const w = ((sp.w[0] + rnd(i + 1) * (sp.w[1] - sp.w[0])) * sc * AUR_NARROW).toFixed(1);
    const ht = ((sp.ht[0] + rnd(i + 9) * (sp.ht[1] - sp.ht[0])) * sc * AUR_TALL).toFixed(1);
    const x = (sp.x0 + i * sp.dx + rnd(i + 21) * 5).toFixed(1);
    const y = (sp.y + rnd(i + 33) * 4.6).toFixed(1);
    const a = sp.a0 * k * (.78 + rnd(i + 41) * .44) * AUR_VEIL;
    const C = (sp.c * (.80 + k * .25) * cm).toFixed(3), CT = (sp.ct * (.80 + k * .25) * cm).toFixed(3);
    const hot = k >= .88
      ? `oklch(0.995 ${(C * .26).toFixed(3)} ${h}.0 / ${(a * 1.10).toFixed(3)}) 0%, `
      + `oklch(0.955 ${(C * .62).toFixed(3)} ${h}.0 / ${(a * 1.02).toFixed(3)}) 11%, ` : "";
    out.push(`radial-gradient(${w}% ${ht}% at ${x}% ${y}%, ` + hot
      + `oklch(${(0.88 + k * .05).toFixed(3)} ${CT} ${h}.0 / ${a.toFixed(3)}) ${k >= .88 ? "24%" : "0%"}, `
      + `oklch(0.80 ${C} ${h}.0 / ${(a * .58).toFixed(3)}) 40%, `
      + `oklch(0.76 ${C} ${h}.0 / ${(a * .22).toFixed(3)}) 62%, `
      + `oklch(0.74 ${C} ${h}.0 / 0) 84%)`);
  });
  // fine rays — the detail that keeps it from reading as one soft bloom
  const lead = sp.h.filter((x) => x[1] >= .9);
  for (let j = 0; j < sp.rays; j++) {
    const hw = lead[j % lead.length], h = hw[0], cm = (hw[2] === undefined ? 1 : hw[2]);
    const w = (1.6 + rnd(j + 101) * 2.6).toFixed(2);
    const ht = ((sp.ht[0] * 0.7 + rnd(j + 113) * 26) * AUR_TALL).toFixed(1);
    const x = (2 + rnd(j + 127) * 96).toFixed(1);
    const y = (sp.y - 3 + rnd(j + 139) * 10).toFixed(1);
    const a = (sp.a0 * (.34 + rnd(j + 151) * .40) * AUR_VEIL).toFixed(3);
    const C = (sp.c * 1.05 * cm).toFixed(3);
    out.push(`radial-gradient(${w}% ${ht}% at ${x}% ${y}%, `
      + `oklch(0.97 ${(C * .5).toFixed(3)} ${h}.0 / ${a}) 0%, `
      + `oklch(0.84 ${C} ${h}.0 / ${(a * .5).toFixed(3)}) 34%, `
      + `oklch(0.78 ${C} ${h}.0 / 0) 76%)`);
  }
  (sp.fr || []).forEach((h, i) => {
    const x = (18 + i * 24 + rnd(i + 51) * 10).toFixed(1), fy = ((sp.frY || 45) + rnd(i + 61) * 5).toFixed(1);
    out.push(`radial-gradient(${(18 + i * 5)}% 16% at ${x}% ${fy}%, `
      + `oklch(0.90 ${sp.frc} ${h}.0 / .26) 0%, oklch(0.78 ${sp.frc} ${h}.0 / .12) 42%, oklch(0.76 ${sp.frc} ${h}.0 / 0) 80%)`);
  });
  return out.join(", ");
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

export function starfield(n) {
  // Density preserved: n was spread over roughly seven tiles of viewport.
  const per = Math.max(24, Math.round(n / 7));
  let dots = "";
  for (let i = 0; i < per; i++) {
    const x = (rnd(i * 3 + 1) * 100).toFixed(2), y = (rnd(i * 7 + 2) * 100).toFixed(2);
    const r = (0.7 + rnd(i * 11 + 3) * 1.1).toFixed(2), a = (0.30 + rnd(i * 13 + 4) * 0.65).toFixed(2);
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
// How much of each spec's own blur to keep. The reference blurs at 50-60px,
// which reads as bloom rather than as curtains: the ribbon structure the
// gradient stack draws is thrown away by the blur that follows it. At .65 the
// bands resolve while the layers still blend into each other, which is the
// point of them. Relative softness is preserved — Tarmac stays the softest of
// the six, as its spec intends.
const AUR_SHARPEN = 0.65;


export function finishVars(liveryId, variant, finish, accent) {
  const night = variant !== "day";

  // Aurora is night only. In day it falls back to the plain livery — a
  // daylight aurora is not a thing, and faking one looked wrong.
  if (finish === "aurora" && night) {
    const sp = AUR[liveryId];
    if (!sp) return {};
    const v = {
      "--ground": ok(sp.gnd), "--panel": ok(sp.pan), "--raised": ok(sp.rai), "--line": ok(sp.lin),
      "--t3": ok(AURN.t3), "--t2": ok(AURN.t2), "--t1": ok(AURN.t1),
      "--key-img": curtains(sp),
      "--fill-img": horizon(sp.fill),
      "--star-img": starfield(sp.stars),
      "--key-int": "0.98", "--fill-int": "0.80", "--stars": "1",
      "--soft": `${Math.round(parseFloat(sp.soft) * AUR_SHARPEN)}px`,
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
