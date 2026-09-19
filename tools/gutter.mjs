import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5190';
const b = await chromium.launch(); const p = await b.newPage();
for (const w of [1280, 1024, 900, 768, 700, 641, 640, 560, 430, 390, 360]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto(BASE + '/account/licence?fixture=demo', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(250);
  console.log(w, await p.evaluate(() => {
    const d = document.querySelector('.deck'), c = document.querySelector('.content'), pr = document.querySelector('.profile');
    const g = e => e ? getComputedStyle(e).paddingLeft : '-';
    return `deck=${g(d)} content=${g(c)} profile=${g(pr)} card=${(document.querySelector('.lic')?.getBoundingClientRect().width||0).toFixed(0)}`;
  }));
}
await b.close();
