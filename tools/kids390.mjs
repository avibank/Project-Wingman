import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const [label, url] of [['LIVE', '/account/licence?fixture=demo'], ['REF', '/__ref/licence.html']]) {
  await p.setViewportSize({ width: 390, height: 900 });
  await p.goto('http://127.0.0.1:5190' + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  console.log('==', label);
  console.log(await p.evaluate(() => {
    const out = []; const root = document.querySelector('.lic');
    const rt = root.getBoundingClientRect().top;
    const walk = (el, d) => { for (const c of el.children) { const r = c.getBoundingClientRect();
      out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()}.${(c.className||'').toString().replace(/\s+/g,'.')} ${r.width.toFixed(1)}x${r.height.toFixed(1)} @${(r.top-rt).toFixed(1)}`);
      if (d < 1) walk(c, d + 1); } };
    walk(root, 0); return out.join('\n');
  }));
}
await b.close();
