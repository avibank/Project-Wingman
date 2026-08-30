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
  // Added by the 29 August revision: the back arrow, on every screen but
  // the Flight Deck, and the note bar's own field.
  { sel: ".up", token: "--t2", note: "the labelled back arrow" },
  // Part 13's surfaces.
  { sel: ".rtitle", token: "--t1", note: "route row title — never dims" },
  { sel: ".rmeta", token: "--t3", note: "done / time left under the title" },
  { sel: ".cmt-name", token: "--t1", note: "who wrote the comment" },
  { sel: ".cmt-when", token: "--t3", note: "relative time" },
  { sel: ".prow-title", token: "--t1", note: "the question itself" },
  { sel: ".prow-preview", token: "--t3", note: "the last reply" },
  { sel: ".prow-when", token: "--t3", note: "when it last moved" },
  { sel: ".pres", token: "--t3", note: "who else has been here" },
  // Part 14: the module screen and the quiz.
  { sel: ".cname", token: "--t1", note: "chapter title — one brightness" },
  { sel: ".csub", token: "--t3", note: "lessons and a quiz" },
  { sel: ".q-text", token: "--t1", note: "the question" },
  { sel: ".opt-t", token: "--t2", note: "an option" },
  { sel: ".q-rev-explain", token: "--t2", note: "why that was the answer" },
  { sel: ".quiz-count", token: "--t3", note: "of 8" },
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

// §2.3's search field puts text on --raised, which NOTHING ELSE IN THE MATRIX
// measures against: every selector above is judged over --ground and --panel.
// A placeholder is the whole label on an empty field, so it answers to 4.5 like
// any other prose, and --raised is a third surface that has to be checked on its
// own rather than assumed to behave like the two either side of it.
for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    const base = deckVars(L.id, variant).vars;
    const ground = parse(base["--ground"]);
    const raised = parse(base["--raised"]);
    if (!ground || !raised) { fails.push(`${L.id}/${variant}: could not read raised`); continue; }
    const Yr = Y(over(raised, ground));
    for (const [sel, token] of [[".tabsearch-f::placeholder", "--t2"], [".tabsearch-f", "--t1"], [".tabsearch-i", "--t2"]]) {
      const t = parse(base[token]);
      if (!t) { fails.push(`${L.id}/${variant} ${sel}: could not read ${token}`); continue; }
      const r = ratio(Y(over(t, { ...raised, a: 1 })), Yr);
      rows.push({ where: `${L.id}/${variant}`, sel, token, worst: r });
      if (r < FLOOR) fails.push(`${L.id}/${variant} ${sel} (${token}) over --raised: ${r.toFixed(2)}:1, under ${FLOOR}`);
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

// Two pairs that are not livery-driven and have to be measured on their own.
// .rdur is white on a fixed scrim over a thumbnail; .av is initials on a
// generated fill, and the fill's hue comes from the ten-colour palette, so the
// worst case is whichever hue holds the least contrast.
const fixedPair = (fgS, bgS, over) => {
  const fg = parse(fgS), bg = parse(bgS);
  const bgY = over ? Y(over(bg)) : Y(lin(bg.L, bg.C, bg.H));
  return ratio(Y(lin(fg.L, fg.C, fg.H)), bgY);
};
const durRatio = fixedPair("oklch(.98 0 0)", "oklch(0 0 0 / .74)",
  (bg) => over(bg, { L: 0.42, C: 0.07, H: 240, a: 1 }));   // over the darkest tile
rows.push({ where: "any (over a thumbnail)", sel: ".rdur", token: "fixed", worst: durRatio });
if (durRatio < FLOOR) fails.push(`.rdur: ${durRatio.toFixed(2)}:1, under ${FLOOR}`);

const AV_HUES = [252, 22, 145, 300, 62, 196, 338, 108, 268, 38];
for (const h of AV_HUES) {
  for (const [mode, fgL, fgC, bgL, bgC] of [["dark", .95, .03, .38, .09], ["light", .36, .10, .88, .06]]) {
    const r = ratio(Y(lin(fgL, fgC, h)), Y(lin(bgL, bgC, h)));
    rows.push({ where: `avatar hue ${h} / ${mode}`, sel: ".av initials", token: "palette", worst: r });
    if (r < FLOOR) fails.push(`.av initials, hue ${h} ${mode}: ${r.toFixed(2)}:1, under ${FLOOR}`);
  }
}

// Right and wrong are the only two colours in the app that are not the livery,
// so they are measured once rather than per livery.
// Night and Day carry different values for these — the light ground needs a
// darker green and red, which is why the source ships two sets.
for (const [name, night, day] of [
  [".opt[data-mark=right]", "oklch(.66 .155 148)", "oklch(.50 .150 148)"],
  [".opt[data-mark=wrong]", "oklch(.62 .180 25)", "oklch(.50 .190 25)"]]) {
  for (const [mode, groundS, col] of [["night", "oklch(.18 .02 250)", night],
                                      ["day", "oklch(.97 .01 85)", day]]) {
    const fg = parse(col), bg = parse(groundS);
    const r = ratio(Y(lin(fg.L, fg.C, fg.H)), Y(lin(bg.L, bg.C, bg.H)));
    rows.push({ where: `${mode} (fixed)`, sel: name, token: "ok/bad", worst: r });
    if (r < FLOOR) fails.push(`${name} ${mode}: ${r.toFixed(2)}:1, under ${FLOOR}`);
  }
}

// A TRANSLUCENT BORDER CANNOT BE MEASURED AS A PLAIN RATIO — the sampled colour
// is not what gets painted, so the number is meaningless. --edge is composited
// over the panel first, and it is a hairline rather than text, so it answers to
// 3:1 as a non-text boundary and not to 4.5.
for (const L of LIVERIES) {
  for (const variant of ["night", "day"]) {
    const base = deckVars(L.id, variant).vars;
    const edge = parse(base["--edge"]), panel = parse(base["--panel"]), ground = parse(base["--ground"]);
    if (!edge || !panel || !ground) continue;
    const panelOver = over(panel, ground);
    const edgeOver = over(edge, { ...panel, a: 1 });
    const r = ratio(Y(edgeOver), Y(panelOver));
    rows.push({ where: `${L.id}/${variant}`, sel: "--edge over panel", token: "composited", worst: r });
    // Recorded, not failed: a resting hairline is deliberately quiet and the
    // brief says an edge you can barely see is the intent, not a defect.
  }
}

rows.sort((a, b) => a.worst - b.worst);
const textRows = rows.filter((r) => r.token !== "composited");
const worst = textRows[0];
console.log(`lesson contrast: ${rows.length} measurements — ${SELECTORS.length} selectors x ${LIVERIES.length} liveries x Light/Dark x Standard/Aurora/Manual, plus the banner, the duration badge and 20 avatar fills`);
console.log(`          worst  ${worst.worst.toFixed(2)}:1  ${worst.sel} (${worst.token})  in ${worst.where}`);
console.log("          five lowest:");
for (const r of textRows.slice(0, 5)) {
  console.log(`            ${r.worst.toFixed(2)}:1  ${r.sel.padEnd(18)} ${r.token.padEnd(9)} ${r.where}`);
}
for (const f of fails) console.log("  FAIL  " + f);
console.log(fails.length ? `LESSON CONTRAST: ${fails.length} under ${FLOOR}` : "MATCH");
if (fails.length) process.exitCode = 1;
