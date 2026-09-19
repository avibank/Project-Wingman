/* =============================================================================
   THE SAME ELEMENT, BOTH SIDES, MEASURED.
   -----------------------------------------------------------------------------
   ref-diff tells you a screen is 3% different. This tells you which box.

     node tools/boxes.mjs licence            # the SCREENS list in ref-diff
     node tools/boxes.mjs licence 768
     W=390 node tools/boxes.mjs preferences

   Prints every child of the marked element on both sides with its size and
   its top relative to that element, so a row that is six pixels taller shows
   up as six pixels rather than as a red smear.

   `--styles a,b` compares computed properties on the marked element and each
   of a few selectors instead:

     node tools/boxes.mjs licence 1280 --sel .cvbtn --styles font-size,padding
   ========================================================================= */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5190';
const SCREENS = {
  licence:     ['/__ref/licence.html',     '/account/licence',     '[data-ref="licence-card"]'],
  preferences: ['/__ref/preferences.html', '/account/preferences', '[data-ref="preferences"]'],
  module:      ['/__ref/module.html',      '/m/m1',                '[data-ref="module-panel"]'],
  library:     ['/__ref/library.html',     '/m/m1/library',        '[data-ref="module-panel"]'],
  crew:        ['/__ref/crew.html',        '/m/m1/crew',           '[data-ref="module-panel"]'],
  lesson:      ['/__ref/lesson.html',      '/m/m1/l1',             '[data-ref="lesson"]'],
};

const name = process.argv[2];
if (!SCREENS[name]) { console.error('Usage: node tools/boxes.mjs <' + Object.keys(SCREENS).join('|') + '> [width]'); process.exit(1); }
const [ref, live, sel] = SCREENS[name];
const width = Number(process.argv[3] || process.env.W || 1280);
const depth = Number(process.env.DEPTH || 1);
const arg = (k) => { const i = process.argv.indexOf(k); return i === -1 ? null : process.argv[i + 1]; };
const only = arg('--sel');
const styles = (arg('--styles') || '').split(',').filter(Boolean);

const browser = await chromium.launch();
const page = await browser.newPage();

async function side(url) {
  await page.setViewportSize({ width, height: 1000 });
  // fixture=demo puts the reference's own sample data on the live screen
  await page.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'fixture=demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return page.evaluate(({ sel, only, styles, depth }) => {
    if (only) {
      const e = document.querySelector(only);
      if (!e) return `${only}: not here`;
      const c = getComputedStyle(e), r = e.getBoundingClientRect();
      return `${only} ${r.width.toFixed(1)}x${r.height.toFixed(1)}  `
        + styles.map((k) => `${k}=${c.getPropertyValue(k)}`).join(' ');
    }
    const root = document.querySelector(sel);
    if (!root) return `${sel}: not here`;
    const top = root.getBoundingClientRect().top;
    const out = [`ROOT ${root.getBoundingClientRect().width.toFixed(1)}x${root.getBoundingClientRect().height.toFixed(2)} @${top}`];
    (function walk(el, d) {
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()}.${String(c.className || '').replace(/\s+/g, '.')} `
          + `${r.width.toFixed(1)}x${r.height.toFixed(1)} @${(r.top - top).toFixed(1)}`);
        if (d < depth) walk(c, d + 1);
      }
    })(root, 0);
    return out.join('\n');
  }, { sel, only, styles, depth });
}

console.log(`== REF  ${ref} @${width}`);
console.log(await side(ref));
console.log(`\n== LIVE ${live} @${width}`);
console.log(await side(live));
await browser.close();
