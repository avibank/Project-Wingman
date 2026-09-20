/* =============================================================================
   IS THIS SCREEN'S STYLESHEET ACTUALLY ON THE PAGE?
   -----------------------------------------------------------------------------
   Walks every rule in every readable stylesheet and counts how many mention
   each class. A screen rebuilt on a design's markup with none of the design's
   CSS loaded looks like a screen that was never ported, and nothing else you
   measure about it means anything.

     node tools/sheets.mjs https://www.wingman.institute/account/licence lic cover stats
   ========================================================================= */
import { chromium } from 'playwright';

const url = process.argv[2];
const names = process.argv.slice(3);
if (!url || !names.length) { console.error('Usage: node tools/sheets.mjs <url> <class> [class...]'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const out = await page.evaluate((names) => {
  const counts = Object.fromEntries(names.map((n) => [n, 0]));
  let sheets = 0, unreadable = 0, rules = 0;
  const walk = (list) => { for (const r of list) {
    if (r.selectorText) { rules += 1; for (const n of names) if (new RegExp(`\\.${n}(?![\\w-])`).test(r.selectorText)) counts[n] += 1; }
    if (r.cssRules && r.cssRules.length) walk(r.cssRules);
  }};
  for (const s of document.styleSheets) { sheets += 1; try { walk(s.cssRules); } catch { unreadable += 1; } }
  const present = names.filter((n) => document.querySelector(`.${n}`));
  return { sheets, unreadable, rules, counts, present };
}, names);
await browser.close();
console.log(`${url}\n  ${out.sheets} sheets (${out.unreadable} unreadable), ${out.rules} selector rules`);
for (const [n, c] of Object.entries(out.counts)) {
  console.log(`  .${n.padEnd(14)} ${String(c).padStart(4)} rules   ${out.present.includes(n) ? 'and it is in the markup' : '— not in the markup here'}`);
}
