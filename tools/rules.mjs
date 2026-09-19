/* =============================================================================
   WHICH RULE IS SETTING THIS.
   -----------------------------------------------------------------------------
     node tools/rules.mjs /account/licence .lbody font-size

   Every rule in every reachable stylesheet that matches the element and
   declares the property, in source order. `.lbody` was two components and
   this is what found it.

   NOTE, because it cost half an hour: a CSSStyleRule has an EMPTY `cssRules`
   in modern Chromium (nested CSS), so `if (r.cssRules) recurse` skips every
   style rule and the scan silently finds nothing.
   ========================================================================= */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5190';
const [path, sel, prop] = process.argv.slice(2);
if (!path || !sel || !prop) { console.error('Usage: node tools/rules.mjs <path> <selector> <property>'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: Number(process.env.W || 1280), height: 900 });
await page.goto(BASE + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
console.log(await page.evaluate(({ sel, prop }) => {
  const el = document.querySelector(sel);
  if (!el) return 'no ' + sel;
  const hits = [`computed: ${getComputedStyle(el).getPropertyValue(prop)}`];
  const walk = (rules, at) => {
    for (const r of rules) {
      if (r.selectorText && r.style) {
        const v = r.style.getPropertyValue(prop) || (r.style.font ? `font: ${r.style.font}` : '');
        if (v) { try { if (el.matches(r.selectorText)) hits.push(`${at ? '@' + at + ' ' : ''}${r.selectorText} -> ${v}`); } catch { /* :has() etc */ } }
      }
      if (r.cssRules && r.cssRules.length) walk(r.cssRules, r.conditionText || at);
    }
  };
  for (const s of document.styleSheets) { try { walk(s.cssRules, ''); } catch { /* cross-origin */ } }
  return hits.join('\n');
}, { sel, prop }));
await browser.close();
