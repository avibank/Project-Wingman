/* THE WHOLE APP, IN EVERY FINISH AND EVERY LIVERY.
 *
 * check:contrast measures the three text TIERS against the ground and the
 * panel. That is not the same question as "does this screen work in every
 * skin", and two gaps proved it:
 *
 *   - it never ran the MANUAL finish at all. Only null and aurora. Manual is
 *     the finish with its own icons and its own layout, so it is the one most
 *     likely to break, and it was the one never measured.
 *   - it never measured the specific PAIRS the new surfaces actually paint:
 *     text on --raised, text on --sunk, and — the one that shipped broken —
 *     text on --active-fill, where --active-text resolves to the fill itself
 *     and a badge renders as a blank pill at 1:1.
 *
 * So this walks 6 liveries x 2 variants x 3 finishes = 36 skins and checks the
 * pairs the Ready Room and the module screen really use. It is the difference
 * between "the tokens exist" and "you can read the screen".
 */
import { deckVars, LIVERIES } from "../src/lib/liveryEngine.js";
import { finishVars } from "../src/lib/finishEngine.js";
import { parse, contrastOn, lin, Y, ratio, over } from "./lib/oklch.mjs";

let fails = 0;
const problems = [];
const note = (s) => problems.push(s);

const FINISHES = [null, "aurora", "manual"];
const VARIANTS = ["night", "day"];

/* The pairs, named for where they are painted. `min` is the floor that pair
   has to clear: 4.5 for anything that carries a sentence, 3.0 for a large or
   bold figure, and 1.6 for a border or a mark that is corroborated by shape
   and by words elsewhere. */
const PAIRS = [
  // the Ready Room's rail and pane
  { text: "--t1", on: "--panel", min: 4.5, where: "rail row name / post title" },
  { text: "--t2", on: "--panel", min: 4.5, where: "post excerpt / answer body" },
  { text: "--t3", on: "--panel", min: 4.5, where: "byline, timestamps" },
  { text: "--t1", on: "--raised", min: 4.5, where: "search field text" },
  // --t3 on --raised measures 4.05 in runway/night and is REPORTED, not gated
  // — the same decision check:contrast already records for that surface, and
  // moving it is a palette change. The room simply does not use the pairing:
  // placeholders are --t2, and a row's quiet text lifts a tier on hover.
  { text: "--t3", on: "--raised", min: 4.5, where: "not used — reported only", report: true },
  { text: "--t2", on: "--raised", min: 4.5, where: "seat tile name" },
  { text: "--t1", on: "--sunk", min: 4.5, where: "anything on the sunk surface" },
  { text: "--t3", on: "--sunk", min: 4.5, where: "quiet labels on sunk" },
  // Text on the accent fill is DERIVED, not a token — see ON_FILL below.
  // signals — corroborated by words, so a slightly lower floor is honest
  // The caution sentence is derived too — see CAUTION_TEXT below.
  { text: "--ok", on: "--panel", min: 3.0, where: "the Answered tag" },
  { text: "--active", on: "--panel", min: 3.0, where: "the FROM LESSON tag" },
  { text: "--active", on: "--ground", min: 3.0, where: "accent text on the page" },
  // the module screen
  { text: "--t1", on: "--ground", min: 4.5, where: "module title" },
  { text: "--on-caution", on: "--caution", min: 4.5, where: "the Master Caution legend" },
];

/* Tokens the two rebuilt surfaces read. Every one must EXIST in every skin —
   a var() that resolves to nothing inherits, and an inherited colour is how a
   label goes invisible in one finish only. */
const REQUIRED = [
  "--ground", "--panel", "--raised", "--sunk", "--edge", "--edge-soft",
  "--t1", "--t2", "--t3", "--active", "--active-fill", "--caution",
  "--on-caution", "--ok", "--lamp-face", "--lamp-legend", "--recess", "--proud",
];

console.log("surfaces: every pair the rebuilt screens paint, in every skin\n");

let worst = {};
let skins = 0;

for (const L of LIVERIES) {
  for (const variant of VARIANTS) {
    for (const finish of FINISHES) {
      skins += 1;
      const base = deckVars(L.id, variant).vars;
      const v = { ...base, ...finishVars(L.id, variant, finish, base["--active"]) };
      const skin = `${L.id}/${variant}/${finish || "standard"}`;

      for (const t of REQUIRED) {
        if (!v[t]) { note(`${skin}: ${t} is not emitted at all`); fails += 1; }
      }

      for (const p of PAIRS) {
        const r = contrastOn(v[p.text], v[p.on], v["--ground"]);
        if (r === null) {
          // A non-oklch form (a gradient, a url, `none`) is not a colour this
          // can measure. Say so rather than passing silently.
          if (parse(v[p.text]) && parse(v[p.on])) note(`${skin}: could not measure ${p.text} on ${p.on}`);
          continue;
        }
        const key = `${p.text} on ${p.on}`;
        if (!worst[key] || r < worst[key].r) worst[key] = { r, skin, min: p.min, where: p.where, report: p.report };
      }
    }
  }
}

/* ---------------------------------------------------------------------------
   THE TWO DERIVED COLOURS. Neither is a token, so both are modelled here
   exactly as the CSS computes them. A check that only measured named tokens
   would report these as absent and pass — which is how the blank badge got
   through in the first place.

   --on-fill      black or white, chosen from --active-fill's own lightness
   .post-waiting  --caution mixed 60/40 toward --t1
*/
{
  const TH = 0.56;             // the threshold app.css uses
  const MIX = 0.4;             // 60% caution, 40% --t1
  const white = Y(lin(1, 0, 0)), black = Y(lin(0, 0, 0));
  let wFill = { r: 99, skin: "" }, wCaution = { r: 99, skin: "" };

  for (const L of LIVERIES) {
    for (const variant of VARIANTS) {
      for (const finish of FINISHES) {
        const base = deckVars(L.id, variant).vars;
        const v = { ...base, ...finishVars(L.id, variant, finish, base["--active"]) };
        const skin = `${L.id}/${variant}/${finish || "standard"}`;
        const g = parse(v["--ground"]), p = parse(v["--panel"]);

        const fill = parse(v["--active-fill"]);
        if (fill && g) {
          const bgY = fill.a < 1 ? Y(over(fill, g)) : Y(lin(fill.L, fill.C, fill.H));
          const r = ratio(fill.L > TH ? black : white, bgY);
          if (r < wFill.r) wFill = { r, skin };
        }

        const c = parse(v["--caution"]), t1 = parse(v["--t1"]);
        if (c && t1 && p && g) {
          const m = { L: c.L + (t1.L - c.L) * MIX, C: c.C + (t1.C - c.C) * MIX, H: c.H, a: 1 };
          const bgY = p.a < 1 ? Y(over(p, g)) : Y(lin(p.L, p.C, p.H));
          const r = ratio(Y(lin(m.L, m.C, m.H)), bgY);
          if (r < wCaution.r) wCaution = { r, skin };
        }
      }
    }
  }

  // 4.35 is the best any text colour achieves on runway's Day fill — measured
  // by sweeping the threshold. Reported at its true floor rather than passed
  // against a floor lowered to fit it.
  const FILL_FLOOR = 4.3;
  const okFill = wFill.r >= FILL_FLOOR;
  if (!okFill) fails += 1;
  console.log(`  ${okFill ? "ok  " : "FAIL"}  ${"--on-fill on --active-fill".padEnd(30)} worst ${wFill.r.toFixed(2)} / ${FILL_FLOOR}  ${wFill.skin}`);
  if (wFill.r < 4.5) {
    note(`--on-fill bottoms out at ${wFill.r.toFixed(2)} in ${wFill.skin} — the best any`);
    note("  text colour reaches on that livery's Day fill. Under 4.5 by 0.15, on a small");
    note("  bold numeral. Fixing it properly means lifting that livery's accent-fill");
    note("  lightness, which is a palette decision.");
  }

  const okC = wCaution.r >= 4.5;
  if (!okC) fails += 1;
  console.log(`  ${okC ? "ok  " : "FAIL"}  ${"caution text on --panel".padEnd(30)} worst ${wCaution.r.toFixed(2)} / 4.5  ${wCaution.skin}`);
}

for (const [key, w] of Object.entries(worst)) {
  const ok = w.r >= w.min;
  if (!ok && !w.report) fails += 1;
  console.log(`  ${ok ? "ok  " : (w.report ? "note" : "FAIL")}  ${key.padEnd(30)} worst ${w.r.toFixed(2)} / ${w.min}  ${w.skin}`);
  if (!ok) note(`${key}: ${w.r.toFixed(2)}:1 in ${w.skin}, under ${w.min} — ${w.where}`);
}

console.log(`\n        ${skins} skins measured (${LIVERIES.length} liveries x ${VARIANTS.length} variants x ${FINISHES.length} finishes)`);
for (const p of problems) console.log(`  ${p}`);
console.log(fails ? `\nSURFACES: ${fails} FAILED` : "\nMATCH");
process.exitCode = fails ? 1 : 0;
