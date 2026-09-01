/* "No red on wrong quiz answers -- --calm instead. Red is for genuine danger
 * states."  That rule is currently enforced by ONE declaration, and nothing
 * about it looks load-bearing.
 *
 * quiz.css marks a wrong option with var(--bad), and its own comment says --bad
 * is a semantic red held outside the livery. The livery engine agrees: it
 * writes --bad: oklch(.620 .180 25) onto :root, which is a true red at hue 1.
 * What actually keeps a wrong answer calm is App.jsx redeclaring --bad on the
 * .app token block, where it resolves to hue 209 -- the same blue-grey as
 * --calm. Everything a user sees is inside .app, so that override wins.
 *
 * Delete it as redundant and every wrong answer in the app turns red. Nothing
 * else would notice: the build passes, no snapshot covers it, and the two
 * declarations look like duplication rather than a conflict.
 *
 * So this asserts the three links in that chain, and fails if any one of them
 * is removed or turned red.
 */
import { readFileSync } from "node:fs";

const fail = [];
// Comments are stripped first, and that is not fussiness: the comment on the
// declaration itself QUOTES the livery engine's red so a reader knows what is
// being overridden, and matching that quote made this check fail on the very
// thing it was written to protect.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const quiz = strip(readFileSync("src/components/module/quiz.css", "utf8"));
const app = strip(readFileSync("src/App.jsx", "utf8"));

// 1 -- the coupling still exists: wrong is painted with --bad.
const wrongUsesBad = /\.opt\[data-mark="wrong"\][^}]*var\(--bad\)/.test(quiz);
if (!wrongUsesBad) {
  fail.push("quiz.css no longer paints a wrong option with var(--bad) -- if the "
    + "token changed, this check is guarding the wrong thing and must be updated");
}

// 2 -- .app still redeclares --bad.
const decl = app.match(/--bad:\s*([^;]+);/);
if (!decl) {
  fail.push("App.jsx no longer declares --bad. The livery engine's red one on "
    + ":root now reaches every wrong answer in the app");
}

// 3 -- and what it redeclares it to is not itself a red.
if (decl) {
  const value = decl[1].trim();
  const oklch = value.match(/oklch\(\s*[\d.]+\s+([\d.]+)\s+([\d.]+)/);
  if (oklch) {
    const [, chroma, hue] = oklch.map(Number);
    if (chroma > 0.06 && (hue < 35 || hue > 340)) {
      fail.push(`App.jsx sets --bad to a red (hue ${hue}) -- wrong answers will render red`);
    }
  }
  const hex = value.match(/#([0-9a-fA-F]{6})\b/);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map(k => parseInt(hex[1].slice(k, k + 2), 16));
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = mx === mn ? 0 : mx === r ? (((g - b) / (mx - mn)) % 6) * 60
          : mx === g ? ((b - r) / (mx - mn) + 2) * 60 : ((r - g) / (mx - mn) + 4) * 60;
    if (h < 0) h += 360;
    if ((h < 20 || h > 340) && mx - mn > 60) {
      fail.push(`App.jsx sets --bad to a red literal (${hex[0]}) -- wrong answers will render red`);
    }
  }
}

console.log("calm: the wrong-answer colour, across the three declarations that decide it");
if (fail.length) {
  for (const f of fail) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log("  quiz.css paints wrong with --bad; .app redeclares --bad away from the livery's red");
console.log("MATCH");
