// The stamp engine, held to the reference it IS, and to the owner's list.
// Run: npm run check:stamp
//
// The owner (2026-09-21) replaced the engine with the launch pack's own
// (docs/launch/code/05-stamp-engine.js), the creator with 15 and its styles
// with 03, and named eight things that must be true on the live site. The
// ones that are properties of the code are held here, on every build:
//
//   1 · the engine is the reference file byte for byte, and the old port is gone;
//   2 · the engine's eight shapes, SIX offered (no shield, no hex — the owner,
//       later the same day), six patterns, and none of the retired ones;
//   3 · Matcha is #9CC44E;
//   4 · every shape x pattern x scope x rim x code draws, with no NaN;
//   5 · a short rim sits small and centred at the crown — WNG on every shape;
//   6 · rim text never touches either border, on all eight shapes, from two
//       characters to ten, and the motto underneath;
//   7 · the creator carries the reference's own parts (WNG, the grids, the
//       scope, the rows), and 0036 stores what it offers;
//   8 · codes, rims and inks are cleaned before they reach markup.
//
// The engine assumes a page. scripts/stamp-dom.mjs supplies the one <svg>
// and the path measurement it asks for, and nothing else.
import { readFileSync } from "node:fs";
import { svgPathProperties } from "svg-path-properties";
import { installStampDom } from "./stamp-dom.mjs";

installStampDom();
const E = await import("../src/lib/stamp-engine.js");
const S = await import("../src/lib/stamp.js");
const { SHAPES, PATTERNS, PALETTE, layout, inspStamp, colourGrid, MOTTO } = E;
const { SHAPE_IDS, PATTERN_IDS, drawStamp, validStamp, cleanCode, cleanRim, escapeText, inkByName, HOUSE_STAMP, stampOf } = S;

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

/* ------------------------------------------------- 1 · the engine is the file */
{
  const eng = read("../src/lib/stamp-engine.js");
  const ref = read("../docs/launch/code/05-stamp-engine.js");
  const A = "/* ---------------------------------------------- BEGIN docs/launch/code/05-stamp-engine.js */\n";
  const B = "/* ------------------------------------------------ END docs/launch/code/05-stamp-engine.js */";
  const a = eng.indexOf(A), b = eng.indexOf(B);
  ok("engine", "stamp-engine.js carries 05-stamp-engine.js byte for byte",
     a > 0 && b > a && eng.slice(a + A.length, b) === ref, a < 0 || b < 0 ? "markers missing" : `${eng.slice(a + A.length, b).length} vs ${ref.length} bytes`);
  ok("engine", "and nothing but the preamble and the export list around it",
     !/function |=>/.test(eng.slice(b + B.length)) && (eng.slice(0, a).match(/\bfunction\b|=>/g) || []).length === 0);
  const app = read("../src/lib/stamp.js");
  ok("engine", "the old port is gone: stamp.js draws nothing of its own",
     !/const SHAPES\s*=|function layout\(|function inspStamp\(|function ringPattern\(|function rimRun\(|const PALETTE\s*=/.test(app));
  ok("engine", "and every component draws through it",
     !/from ["'][./]*lib\/stamp-engine\.js["']/.test(read("../src/components/Stamp.jsx")));
}

/* -------------------------------------------------- 2 · shapes and patterns */
const EIGHT = ["seal", "roundel", "window", "gauge", "postage", "tag", "shield", "hex"];
/* The engine draws eight; the creator offers six (owner, 2026-09-21: "no hex
   bolt no shield"). */
const OFFERED = EIGHT.filter((s) => s !== "shield" && s !== "hex");
const SIX = [["none", "None"], ["rays", "Rays"], ["checks", "Checks"], ["guilloche", "Guilloche"], ["crochet", "Crochet"], ["knurl", "Knurl"]];
ok("parts", `the engine draws the reference's eight shapes (${Object.keys(SHAPES).join(", ")})`,
   JSON.stringify(Object.keys(SHAPES)) === JSON.stringify(EIGHT) && EIGHT.every((s) => typeof SHAPES[s]?.o === "function"));
ok("parts", `and the creator offers six, no shield and no hex (${SHAPE_IDS.join(", ")})`,
   JSON.stringify(SHAPE_IDS) === JSON.stringify(OFFERED));
ok("parts", `six patterns, exactly (${Object.values(PATTERNS).join(", ")})`,
   JSON.stringify(Object.entries(PATTERNS)) === JSON.stringify(SIX) && JSON.stringify(PATTERN_IDS) === JSON.stringify(SIX.map(([k]) => k)));
ok("parts", "and none of Lace, Polka, Waves, Swirl or Stars",
   !["lace", "polka", "waves", "swirl", "stars"].some((k) => k in PATTERNS)
   && !Object.values(PATTERNS).some((n) => /lace|polka|waves|swirl|stars/i.test(n)));
ok("parts", `thirty-six inks, every one named once (${PALETTE.length})`,
   PALETTE.length === 36 && new Set(PALETTE.map((p) => p.n)).size === 36);

/* ------------------------------------------------------------- 3 · Matcha */
{
  const m = PALETTE.find((p) => p.n === "Matcha");
  /* oklch -> sRGB, the standard matrices (Ottosson). */
  const toHex = ({ l, c, h }) => {
    const a = c * Math.cos(h * Math.PI / 180), b = c * Math.sin(h * Math.PI / 180);
    const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3, M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, S2 = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const lin = [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S2, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S2, -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S2];
    return lin.map((v) => { const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, g)) * 255); });
  };
  const rgb = m ? toHex(m) : [0, 0, 0], want = [0x9c, 0xc4, 0x4e];
  const hex = `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  ok("ink", `Matcha is {l:.765, c:.152, h:126} (${JSON.stringify(m)})`, m && m.l === 0.765 && m.c === 0.152 && m.h === 126);
  ok("ink", `and reads as #9CC44E, a bright yellow-green (${hex})`, rgb.every((v, i) => Math.abs(v - want[i]) <= 3), hex);
  ok("ink", "the colour grid paints Matcha with that colour",
     colourGrid(null, "data-ink").includes("oklch(0.765 0.152 126)") || colourGrid(null, "data-ink").includes("oklch(.765 .152 126)"));
}

/* ------------------------------------------------ 4 · every combination draws */
{
  const bad = []; let drawn = 0;
  for (const shape of SHAPE_IDS) for (const pattern of PATTERN_IDS) for (const pscope of ["both", "centre", "rim"])
    for (const rim of [true, false]) for (const code of ["A", "WNG"]) {
      drawn++;
      const svg = drawStamp({ shape, pattern, pscope, rim, code, sym: null, ring: rim ? "WINGMAN" : "", ink: "Ruby", pink: "Matcha", cink: "Plum", seed: 5 }, { size: 40 });
      if (/NaN|Infinity|undefined|>null</.test(svg)) bad.push(`${shape}/${pattern}/${pscope}/rim=${rim}/${code}`);
      if (rim && !svg.includes("<textPath")) bad.push(`${shape} lost its rim`);
    }
  ok("draw", `every shape x pattern x scope x rim x code renders clean (${drawn})`, !bad.length, bad.slice(0, 4).join("; "));
  ok("draw", "the house seal draws in the livery", drawStamp(HOUSE_STAMP).includes("var(--accent)"));
  const withInks = drawStamp({ shape: "hex", pattern: "rays", pscope: "rim", code: "WNG", ink: "Ruby", pink: "Matcha", cink: "Plum", seed: 2 });
  ok("draw", "a stored stamp's three inks all reach the drawing, by name",
     withInks.includes("oklch(0.765 0.152 126)") && withInks.includes("oklch(0.58 0.12 330)"));
}

/* ------------------------------------------- 5 · a short rim sits at the crown */
const pathOf = (svg, id) => new RegExp(`id="${id}\\d+" d="([^"]+)"`).exec(svg)?.[1];
const textOf = (svg, which) => {
  const m = [...svg.matchAll(/<text font-size="([\d.]+)"[^>]*><textPath href="#(r[tb])\d+" startOffset="([^"]+)" textLength="([\d.]+)"[^>]*>([^<]*)<\/textPath>/g)]
    .find((x) => x[2] === which);
  return m && { fs: +m[1], start: m[3], tl: +m[4], text: m[5] };
};
{
  const bad = [];
  for (const shape of EIGHT) {
    const svg = inspStamp(true, 40, 0, { shape, code: "A", sym: null, ring: "WNG", rim: true, pattern: "none", seed: 1 });
    const d = pathOf(svg, "rt"), t = textOf(svg, "rt");
    if (!d || !t) { bad.push(`${shape}: no rim`); continue; }
    const P = new svgPathProperties(d), L = P.getTotalLength(), mid = P.getPointAtLength(L / 2);
    const centred = Math.abs(mid.x - (layout(shape).cx || 20)) < 0.8 && mid.y < 20 && t.start === "50%" && svg.includes('text-anchor="middle"');
    /* The font size is written to two decimals and the length from the
       unrounded one, so the second comparison allows the rounding. */
    const small = t.tl <= 0.5 * L && t.tl <= t.text.length * (t.fs + 0.005) * 1.06 + 0.01;
    if (!centred || !small) bad.push(`${shape}: ${t.tl.toFixed(1)} of ${L.toFixed(1)}, mid ${mid.x.toFixed(1)},${mid.y.toFixed(1)}`);
  }
  ok("rim", "WNG sits small and centred at the top of every shape the engine draws", !bad.length, bad.join("; "));
}

/* ------------------------------------ 6 · rim text never touches either border
   Measured against what is DRAWN: every stroke of the outline and of the
   code frame, at its own width. A glyph is the stretch of the rim path it
   occupies, from the baseline to the cap height (dominant-baseline middle:
   0.26em below the line to 0.44em above it, Instrument Sans at 800). */
{
  const strokes = (markup) => {
    const out = [];
    for (const m of markup.matchAll(/<(path|circle|rect)([^>]*)\/?>/g)) {
      const a = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
      if (a.stroke === "none" || a["stroke-dasharray"]) continue;
      const w = +(a["stroke-width"] || 1);
      let d = a.d;
      if (m[1] === "circle") { const r = +a.r, cx = +a.cx, cy = +a.cy; d = `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`; }
      if (m[1] === "rect") {
        const x = +a.x, y = +a.y, W = +a.width, H = +a.height, r = Math.min(+(a.rx || 0), W / 2, H / 2);
        d = `M${x + r} ${y}H${x + W - r}A${r} ${r} 0 0 1 ${x + W} ${y + r}V${y + H - r}A${r} ${r} 0 0 1 ${x + W - r} ${y + H}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + H - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
      }
      if (!d || a.transform) { if (a.transform && d) { const k = /scale\(([\d.]+)\)/.exec(a.transform)?.[1]; if (k) out.push({ d, w, k: +k }); } continue; }
      out.push({ d, w, k: 1 });
    }
    return out.map(({ d, w, k }) => {
      const P = new svgPathProperties(d), L = P.getTotalLength(), pts = [];
      for (let i = 0; i <= 400; i++) { const q = P.getPointAtLength(L * i / 400); pts.push([20 + (q.x - 20) * k, 20 + (q.y - 20) * k]); }
      return { pts, half: (w * k) / 2 };
    });
  };
  const clearance = (shape, ring) => {
    const Ly = layout(shape);
    const svg = inspStamp(true, 40, 0, { shape, code: "A", sym: null, ring, rim: true, pattern: "none", seed: 1 });
    const borders = [...strokes(SHAPES[shape].o()), ...strokes(Ly.frame)];
    let worst = Infinity, where = "";
    for (const id of ["rt", "rb"]) {
      const d = pathOf(svg, id), t = textOf(svg, id); if (!d || !t) return { worst: -1, where: `${id} missing` };
      const P = new svgPathProperties(d), L = P.getTotalLength();
      for (let s = (L - t.tl) / 2; s <= (L + t.tl) / 2 + 1e-6; s += 0.2) {
        const p = P.getPointAtLength(s), q = P.getPointAtLength(Math.min(L, s + 0.05)), r = P.getPointAtLength(Math.max(0, s - 0.05));
        let tx = q.x - r.x, ty = q.y - r.y; const n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
        const ux = ty, uy = -tx;                                       // the glyph's "up"
        for (const k of [0.44, -0.26]) {
          const gx = p.x + ux * k * t.fs, gy = p.y + uy * k * t.fs;
          for (const b of borders) for (const [bx, by] of b.pts) {
            const gap = Math.hypot(gx - bx, gy - by) - b.half;
            if (gap < worst) { worst = gap; where = `${id} "${t.text}" at ${gx.toFixed(1)},${gy.toFixed(1)}`; }
          }
        }
      }
    }
    return { worst, where };
  };
  const rims = ["WN", "WNG", "WINGMAN", "ABCDEFGHIJ"];
  const bad = [];
  for (const shape of EIGHT) for (const ring of rims) {
    const { worst, where } = clearance(shape, ring);
    if (!(worst > 0)) bad.push(`${shape}/${ring}: ${worst.toFixed(2)} at ${where}`);
  }
  ok("rim", `rim text and motto clear both borders on all eight shapes, 2 to 10 characters (${EIGHT.length * rims.length} stamps)`,
     !bad.length, bad.slice(0, 5).join("; "));
}

/* ------------------------------------------------ 7 · the creator and 0036 */
{
  const c = read("../src/components/licence/StampCreator.jsx");
  ok("creator", "the code box's placeholder is WNG", /placeholder="WNG"/.test(c));
  ok("creator", "six shapes three across, six patterns three across (.srow.pat3 on both)",
     /className="srow shp pat3"/.test(c) && /className="srow pat3"/.test(c) && /SHAPE_IDS\.map/.test(c) && !/Object\.keys\(SHAPES\)/.test(c) && /Object\.entries\(PATTERNS\)/.test(c));
  ok("creator", "Both / Centre / Rim, once a pattern is picked", /d\.pattern !== "none"/.test(c) && /"both", "Both"\], \["centre", "Centre"\], \["rim", "Rim"\]/.test(c));
  ok("creator", "the Pattern and Ink tabs each have a colour grid and \"Same as the ink\"",
     /colourGrid\(d\.pink, "data-pink"\)/.test(c) && /colourGrid\(d\.ink, "data-ink"\)/.test(c) && /colourGrid\(d\.cink, "data-cink"\)/.test(c)
     && (c.match(/>Same as the ink</g) || []).length === 2);
  const css = read("../src/components/licence/ref-licence.css");
  const ref = read("../docs/launch/code/03-stamp-creator.css");
  ok("creator", "the reference's creator stylesheet is in, scoped (npm run ref:css)",
     css.includes(".ref-lic .srow.shp{grid-template-columns:repeat(4,1fr);gap:8px}") && css.includes(".ref-lic .srow.pat3{grid-template-columns:repeat(3,1fr)}")
     && ref.includes(".srow.shp{grid-template-columns:repeat(4,1fr);gap:8px}"));
  const sql = read("../supabase/migrations/0036_the_stamp_engine_of_20_september.sql");
  const sql37 = read("../supabase/migrations/0037_six_shapes_again.sql");
  const shapes37 = sql37.slice(sql37.indexOf("add constraint stamp_shape_known"));
  ok("store", "0037 holds the server to the six offered shapes, and 0036 to the six patterns",
     OFFERED.every((s) => shapes37.includes(`'${s}'`)) && !/'shield'|'hex'/.test(shapes37)
     && SIX.every(([k]) => new RegExp(`'${k}'`).test(sql.slice(sql.indexOf("add constraint stamp_pattern_known"), sql.indexOf("add column if not exists stamp_pscope")))));
  ok("store", "and where the pattern sits, and its two extra inks, held to the thirty-six",
     /stamp_pscope in \('both','centre','rim'\)/.test(sql) && PALETTE.every((p) => sql.includes(`'${p.n}'`)) && /p_pscope text, p_pink text, p_cink text/.test(sql));
  const row = stampOf({ stamp_issued_at: "x", stamp_shape: "roundel", stamp_code: "WNG", stamp_pattern: "rays", stamp_pscope: "rim", stamp_ink: "Ruby", stamp_pink: "Matcha", stamp_cink: "Plum", stamp_seed: 3 });
  ok("store", "a stored row comes back with all of it", row.pscope === "rim" && row.pink === "Matcha" && row.cink === "Plum" && row.shape === "roundel");
}

/* --------------------------------------------- 8 · nothing typed reaches markup */
ok("safe", "a code is 1-3 characters, A-Z or 0-9", cleanCode("a-r!") === "AR" && cleanCode("abcd") === "ABC" && cleanCode("<b>") === "B");
ok("safe", "rim text is cut to an alphabet and escaped", cleanRim('a"onload=x') === "AONLOADX" && escapeText('<a href="x">') === "&lt;a href=&quot;x&quot;&gt;");
ok("safe", "so a code and a rim of pure markup draw nothing but text",
   (() => { const s = drawStamp({ shape: "seal", pattern: "none", code: "<b>", ring: "<img src=x onerror=y>", rim: true, sym: null, ink: null, seed: 1 });
     return !s.includes("<b>") && !s.includes("<img") && !s.includes("onerror"); })());
ok("safe", "a shape, pattern, scope or ink the engine does not know is refused",
   validStamp({ shape: "roundel", pattern: "knurl", pscope: "rim", code: "WNG", ink: "Ruby", pink: "Matcha", seed: 1 })
   && !validStamp({ shape: "hex", pattern: "none", code: "AR", seed: 1 })
   && !validStamp({ shape: "shield", pattern: "none", code: "AR", seed: 1 })
   && !validStamp({ shape: "seal", pattern: "lace", code: "AR", seed: 1 })
   && !validStamp({ shape: "seal", pattern: "rays", pscope: "edge", code: "AR", seed: 1 })
   && !validStamp({ shape: "seal", pattern: "none", code: "AR", pink: "oklch(.5 .2 20)", seed: 1 })
   && inkByName("Ruby")?.h === 22);
ok("safe", "the motto is the app's", MOTTO === "Never fly alone");

console.log(`\nstamp: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
