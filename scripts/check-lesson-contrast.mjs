// Part 12's contrast matrix: the lesson surface's seven text selectors across
// six liveries x Light/Dark x Standard/Aurora/Manual.
//
// This exists alongside check-contrast because it measures two things that one
// does not. First, Manual — the drawn finish was outside the old matrix, and
// it repaints the ground. Second, --active USED AS TEXT: the accent is a fill
// colour almost everywhere in this app, but the lesson surface reads it as
// words in three places (an answered thread, the public compose line, the
// active tab), and an accent that passes as a 44px filled button can still
// fail as 13px prose.
//
// Every real contrast problem in this project was found by measuring and
// missed by looking, so the number is what counts, not the screenshot.
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

function parse(v) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
  if (!m) return null;
  return { L: +m[1], C: +m[2], H: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
const over = (fg, bg) => {
  const f = lin(fg.L, fg.C, fg.H), b = lin(bg.L, bg.C, bg.H);
  return f.map((v, i) => b[i] + (v - b[i]) * fg.a);
};

// Every one of these is body-sized prose, so they all answer to 4.5.
const SELECTORS = [
  { sel: ".lt", token: "--t3", note: "the timestamp on every row" },
  { sel: ".lbody", token: "--t2", note: "the note or comment itself" },
  { sel: ".lwho", token: "--t3", note: "who asked, and whether it is waiting" },
  { sel: ".lwho[answered]", token: "--active-text", note: "answered, in the accent" },
  { sel: ".next-label", token: "--t3", note: "the word Next" },
  { sel: ".ltab", token: "--t3", note: "the unselected tab" },
  { sel: ".compose-who", token: "--active-text", note: "who sees this — public compose" },
];
const FLOOR = 4.5;

const rows = [];
const fails = [];

for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    for (const finish of [null, "aurora", "manual"]) {
      const base = deckVars(L.id, variant).vars;
      const v = { ...base, ...finishVars(L.id, variant, finish, base["--active"]) };
      const ground = parse(v["--ground"]);
      const panel = parse(v["--panel"]);
      const where = `${L.id}/${variant}/${finish || "standard"}`;
      if (!ground || !panel) { fails.push(`${where}: could not read ground or panel`); continue; }
      const Yg = Y(lin(ground.L, ground.C, ground.H));
      const Yp = Y(over(panel, ground));

      for (const s of SELECTORS) {
        const t = parse(v[s.token]);
        if (!t) { fails.push(`${where} ${s.sel}: could not read ${s.token}`); continue; }
        // The lesson surface sits on the page ground, not inside a panel, but
        // both are measured: whichever is worse is the one a reader gets.
        const Yt = Y(over(t, panel.a < 1 ? { ...panel, a: 1 } : panel));
        const worst = Math.min(ratio(Yt, Yg), ratio(Yt, Yp));
        rows.push({ where, sel: s.sel, token: s.token, worst });
        if (worst < FLOOR) fails.push(`${where} ${s.sel} (${s.token}): ${worst.toFixed(2)}:1, under ${FLOOR}`);
      }
    }
  }
}

// The banner is the one pair that is not livery-driven: fixed white on a fixed
// scrim, because it sits over video rather than over the page.
const bannerFg = parse("oklch(.97 0 0)");
const bannerBg = parse("oklch(.16 0 0 / .86)");
const bannerOverBlack = Y(over(bannerBg, { L: 0, C: 0, H: 0, a: 1 }));
const bannerRatio = ratio(Y(lin(bannerFg.L, bannerFg.C, bannerFg.H)), bannerOverBlack);
rows.push({ where: "any (over video)", sel: ".pbanner-body", token: "fixed", worst: bannerRatio });
if (bannerRatio < FLOOR) fails.push(`.pbanner-body: ${bannerRatio.toFixed(2)}:1, under ${FLOOR}`);

rows.sort((a, b) => a.worst - b.worst);
const worst = rows[0];
console.log(`lesson contrast: ${rows.length} measurements — ${SELECTORS.length} selectors x ${LIVERIES.length} liveries x Light/Dark x Standard/Aurora/Manual, plus the banner`);
console.log(`          worst  ${worst.worst.toFixed(2)}:1  ${worst.sel} (${worst.token})  in ${worst.where}`);
console.log("          five lowest:");
for (const r of rows.slice(0, 5)) {
  console.log(`            ${r.worst.toFixed(2)}:1  ${r.sel.padEnd(18)} ${r.token.padEnd(9)} ${r.where}`);
}
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `LESSON CONTRAST: ${fails.length} under ${FLOOR}` : "MATCH");
if (fails.length) process.exitCode = 1;
