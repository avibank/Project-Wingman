import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5190';
const b = await chromium.launch(); const p = await b.newPage();
for (const w of [1280, 768, 390]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto(BASE + '/account/licence?fixture=demo', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  console.log(w, await p.evaluate(() => {
    let e = document.querySelector('.profile'), out = [];
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      out.push(`${e.tagName.toLowerCase()}.${(e.className||'').toString().split(/\s+/).slice(0,2).join('.')} w=${r.width.toFixed(0)} pad=${cs.paddingLeft}/${cs.paddingRight} mw=${cs.maxWidth}`);
      e = e.parentElement;
    }
    return out.join('\n     ');
  }));
}
await b.close();
