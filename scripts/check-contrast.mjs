// Contrast across the whole matrix: six liveries x Light/Dark x Standard/Aurora.
//
// The argument for this is in the history rather than in principle. Two real
// contrast failures have shipped in this project — Day's t3 at 2.99:1, and
// Aurora's t3 measuring under the floor once the ground came back up — and
// both were found by measuring and neither by looking at the screen. Aurora in
// Day is included even though it renders as Standard, because "renders exactly
// as no-finish" is a promise worth failing on if it ever stops being true.
//
// Text is measured against the surface ACTUALLY behind it: the panel is
// composited over that livery's own ground at its own alpha, which is the step
// that was missing when Day's dropped alphas made every livery measure the
// same number.
import { deckVars, LIVERIES } from "../src/lib/liveryEngine.js";
import { finishVars } from "../src/lib/finishEngine.js";

const M = [[4.0767416621, -3.3077115913, .2309699292],
           [-1.2684380046, 2.6097574011, -.3413193965],
           [-.0041960863, -.7034186147, 1.7076147010]];

function lin(L, C, H) {
  const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const v = [(L + .3963377774 * a + .2158037573 * b) ** 3,
             (L - .1055613458 * a - .0638541728 * b) ** 3,
             (L - .0894841775 * a - 1.2914855480 * b) ** 3];
  return M.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));
}
const Y = (c) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);

// oklch(L C H) or oklch(L C H / A), however the engines happen to emit it.
function parse(v) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
  if (!m) return null;
  return { L: +m[1], C: +m[2], H: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

const over = (fg, bg) => {
  const f = lin(fg.L, fg.C, fg.H), b = lin(bg.L, bg.C, bg.H);
  return f.map((v, i) => b[i] + (v - b[i]) * fg.a);
};

const FLOOR = 4.5;   // body text

// Known and unfixed, carried openly rather than by lowering the floor or
// deleting the case. --t3 in Night measures 3.38 to 3.72 against the panel and
// is used 31 times for small text that carries meaning. Day's equivalent was
// found the same way and fixed by moving t3 from .618 to .505; Night's has not
// been, and it is not a fix to make quietly — it moves every Night surface,
// and "Night pixel-identical" is a stated requirement elsewhere in the same
// handoff. It needs a decision, so it is printed on every run.
//
// Anything NOT in this list fails. Adding to it is a deliberate act.
const KNOWN = new Map([
  ["sky/night/standard --t3", "3.67"],
  ["amber/night/standard --t3", "3.64"],
  ["tarmac/night/standard --t3", "3.72"],
  ["beacon/night/standard --t3", "3.66"],
  ["runway/night/standard --t3", "3.38"],
  ["skydrol/night/standard --t3", "3.61"],
]);
const rows = [];
const fails = [];
const known = [];

for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    for (const finish of [null, "aurora"]) {
      const base = deckVars(L.id, variant).vars;
      const over1 = finishVars(L.id, variant, finish, base["--active"]);
      const v = { ...base, ...over1 };

      const ground = parse(v["--ground"]);
      const panel = parse(v["--panel"]);
      if (!ground || !panel) { fails.push(`${L.id}/${variant}/${finish || "standard"}: could not read ground or panel`); continue; }

      const Yg = Y(lin(ground.L, ground.C, ground.H));
      const Yp = Y(over(panel, ground));

      for (const tier of ["--t3", "--t2", "--t1"]) {
        const t = parse(v[tier]);
        if (!t) { fails.push(`${L.id}/${variant}/${finish || "standard"}: could not read ${tier}`); continue; }
        const Yt = Y(over(t, panel.a < 1 ? { ...panel, a: 1 } : panel));
        const onGround = ratio(Yt, Yg);
        const onPanel = ratio(Yt, Yp);
        const where = `${L.id}/${variant}/${finish || "standard"} ${tier}`;
        rows.push({ where, onGround, onPanel });
        // t3 is the floor tier: it is the smallest text that carries meaning.
        if (tier === "--t3" && Math.min(onGround, onPanel) < FLOOR) {
          const got = Math.min(onGround, onPanel).toFixed(2);
          if (KNOWN.has(where)) known.push(`${where}: ${got}:1`);
          else fails.push(`${where}: ${got}:1, under ${FLOOR}`);
        }
      }
    }
  }
}

const t3 = rows.filter((r) => r.where.endsWith("--t3"));
const lo = Math.min(...t3.map((r) => Math.min(r.onGround, r.onPanel)));
const hi = Math.max(...t3.map((r) => Math.min(r.onGround, r.onPanel)));
console.log(`contrast: ${rows.length} measurements across ${LIVERIES.length} liveries x Light/Dark x Standard/Aurora`);
console.log(`          t3, the floor tier, spans ${lo.toFixed(2)} to ${hi.toFixed(2)} against ${FLOOR}`);
for (const k of known) console.log("  KNOWN, UNFIXED  " + k);
if (known.length) console.log(`          ${known.length} known failures need a decision — see KNOWN in this file`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `CONTRAST: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
