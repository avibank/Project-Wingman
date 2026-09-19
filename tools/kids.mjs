import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5190';
const b = await chromium.launch(); const p = await b.newPage();
for (const [label, url] of [['LIVE', '/account/licence?fixture=demo'], ['REF', '/__ref/licence.html']]) {
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  console.log('==', label);
  console.log(await p.evaluate(() => {
    const out = [];
    const walk = (el, d) => {
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()}.${(c.className||'').toString().replace(/\s+/g,'.')} ${r.width.toFixed(0)}x${r.height.toFixed(0)} @${r.top.toFixed(0)}`);
        if (d < 1) walk(c, d + 1);
      }
    };
    const root = document.querySelector('.lic');
    walk(root, 0);
    return out.join('\n');
  }));
}
await b.close();
