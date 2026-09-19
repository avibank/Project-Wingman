import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5190';
const url = process.argv[2], sels = process.argv.slice(3);
const b = await chromium.launch(); const p = await b.newPage();
for (const w of [1280, 768, 390]) {
  await p.setViewportSize({ width: w, height: 1000 });
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const out = await p.evaluate((sels) => sels.map(s => {
    const e = document.querySelector(s); if (!e) return `${s}: -`;
    const r = e.getBoundingClientRect();
    return `${s}: ${r.width.toFixed(0)}x${r.height.toFixed(0)} @${r.left.toFixed(0)}`;
  }), sels);
  console.log(String(w).padEnd(5), out.join('  '));
}
await b.close();
