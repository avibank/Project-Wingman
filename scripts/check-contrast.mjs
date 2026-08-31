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

// Nothing is carried as a known failure. Night's t3 was the last one and it is
// fixed — lifted .08 in lightness, recorded as an agreed departure from the
// POC in check:livery. Anything under the floor now fails outright, which is
// how it should stay: this list existing at all is an invitation to add to it.
const KNOWN = new Map();

const rows = [];
const fails = [];
const known = [];
const undecided = [];   // measured, real, and DECIDED — see the pin below
let worstRaised = 99;   // the worst t3-on-raised anywhere, for the pin

for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    // MANUAL INCLUDED. This loop ran null and aurora only, so the finish with
    // its own icons and its own layout — the one most likely to diverge — was
    // the one never measured here. check:surfaces found real failures in it.
    for (const finish of [null, "aurora", "manual"]) {
      const base = deckVars(L.id, variant).vars;
      const over1 = finishVars(L.id, variant, finish, base["--active"]);
      const v = { ...base, ...over1 };

      const ground = parse(v["--ground"]);
      const panel = parse(v["--panel"]);
      if (!ground || !panel) { fails.push(`${L.id}/${variant}/${finish || "standard"}: could not read ground or panel`); continue; }

      const Yg = Y(lin(ground.L, ground.C, ground.H));
      const Yp = Y(over(panel, ground));

      // --sunk and --raised carry text too, and neither was measured. The
      // Ready Room's whole sidebar sits on --sunk, and in Day --sunk is
      // DARKER than --panel, so every ratio taken against the panel was the
      // optimistic one. Missing a surface is how a tier passes everywhere the
      // checker looks and fails where it does not.
      const sunk = parse(v["--sunk"]);
      const raised = parse(v["--raised"]);
      const Ys = sunk ? Y(over(sunk, ground)) : null;
      const Yr = raised ? Y(over(raised, ground)) : null;

      for (const tier of ["--t3", "--t2", "--t1"]) {
        const t = parse(v[tier]);
        if (!t) { fails.push(`${L.id}/${variant}/${finish || "standard"}: could not read ${tier}`); continue; }
        const Yt = Y(over(t, panel.a < 1 ? { ...panel, a: 1 } : panel));
        const onGround = ratio(Yt, Yg);
        const onPanel = ratio(Yt, Yp);
        const onSunk = Ys == null ? Infinity : ratio(Yt, Ys);
        const onRaised = Yr == null ? Infinity : ratio(Yt, Yr);
        const where = `${L.id}/${variant}/${finish || "standard"} ${tier}`;
        rows.push({ where, onGround, onPanel, onSunk, onRaised });
        // t3 is the floor tier: it is the smallest text that carries meaning.
        //
        // GROUND, PANEL AND SUNK GATE. --raised does not, yet, and that is a
        // deliberate distinction rather than an oversight. Adding --sunk and
        // --raised to this file surfaced a real failure that had never been
        // measured: t3 on --raised is under the floor in NIGHT in every single
        // livery, 4.21 to 4.48 against 4.5. Day is clear everywhere, and
        // ground, panel and sunk are clear everywhere.
        //
        // It is not silenced into KNOWN, because the note above is right that
        // the list is an invitation. It is not fixed here either, because both
        // fixes are visible palette changes and so are the author's call:
        // lift --t3 in night, which touches every surface, or darken --raised
        // in night, which touches hover states and chips. Until that decision
        // it is reported loudly and does not gate, so the surfaces that DO
        // pass start gating today instead of waiting on it.
        const gated = Math.min(onGround, onPanel, onSunk);
        if (tier === "--t3" && gated < FLOOR) {
          const got = gated.toFixed(2);
          if (KNOWN.has(where)) known.push(`${where}: ${got}:1`);
          else fails.push(`${where}: ${got}:1, under ${FLOOR}`);
        }
        if (tier === "--t3" && onRaised < FLOOR) {
          undecided.push({ r: onRaised, s: `${where} on --raised: ${onRaised.toFixed(2)}:1, under ${FLOOR}` });
          if (onRaised < worstRaised) worstRaised = onRaised;
        }
      }
    }
  }
}

const t3 = rows.filter((r) => r.where.endsWith("--t3"));
// The headline span must describe what actually gates, or the number and the
// verdict disagree — --raised is reported separately below.
const worstOf = (r) => Math.min(r.onGround, r.onPanel, r.onSunk);
const lo = Math.min(...t3.map(worstOf));
const hi = Math.max(...t3.map(worstOf));
console.log(`contrast: ${rows.length} tiers x 4 surfaces across ${LIVERIES.length} liveries x Light/Dark x Standard/Aurora/Manual`);
console.log(`          t3, the floor tier, spans ${lo.toFixed(2)} to ${hi.toFixed(2)} against ${FLOOR} on ground, panel and sunk`);
/* DECIDED, AND PINNED. Asked directly whether to move the palette to lift
   these, the author said keep the liveries as they are (2026-09-01). So this
   stops being an open question and becomes a recorded departure — but a
   pinned one. T3_RAISED_HELD is the worst value measured on the day it was
   agreed; if a livery ever makes t3-on-raised WORSE than what was accepted,
   this fails. Agreeing to a number is not agreeing to whatever it drifts to.

   What keeps it honest in the product: nothing reads t3 on raised. Room
   placeholders are t2, and a row's quiet text lifts a tier on hover. */
const T3_RAISED_HELD = 4.05;
if (undecided.length) {
  console.log(`\n          --raised carries t3 below the floor in ${undecided.length} of the ${rows.filter((r) => r.where.endsWith("--t3")).length} tier/variant combinations.`);
  console.log("          AGREED, not outstanding: lifting these is a palette change, and the");
  console.log("          liveries are deliberately kept as they are. Nothing reads t3 on");
  console.log(`          raised. Pinned at ${T3_RAISED_HELD} (runway/night) so it cannot drift worse.`);
  // SORTED WORST-FIRST, and that is not cosmetic. This list is truncated to
  // four, and in iteration order the true worst (runway/night at 4.05) fell
  // into the "and N more" bucket — so the output advertised 4.21 as the floor
  // while the real one was never printed. A truncated list must be sorted by
  // the thing it is truncating on, or it is a summary that omits its own
  // headline. Found by pinning: the pin disagreed with the visible list.
  const bySeverity = [...undecided].sort((a, b) => a.r - b.r);
  for (const u of bySeverity.slice(0, 4)) console.log("  AGREED  " + u.s);
  if (undecided.length > 4) console.log(`  ... and ${undecided.length - 4} more, all night, all liveries`);
  // Compared at the SAME precision it is printed at. The raw worst is
  // 4.049…, which displays as 4.05; gating on the raw value while showing the
  // rounded one made the check fail against a number equal to itself. The
  // displayed fact and the gated fact have to be one fact.
  if (+worstRaised.toFixed(2) < T3_RAISED_HELD) {
    fails.push(`t3 on --raised fell to ${worstRaised.toFixed(2)}, below the agreed ${T3_RAISED_HELD} — a livery moved`);
  }
}
for (const k of known) console.log("  KNOWN, UNFIXED  " + k);
if (known.length) console.log(`          ${known.length} known failures need a decision — see KNOWN in this file`);
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `CONTRAST: ${fails.length}` : "MATCH");
if (fails.length) process.exitCode = 1;
