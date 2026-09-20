/* Open a URL, optionally click a few things, and save a screenshot.
     node tools/shot.mjs <url> <out.png> [selector-to-click ...] */
import { chromium } from 'playwright';
const [url, out, ...clicks] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: Number(process.env.W || 1280), height: Number(process.env.H || 900) });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
for (const c of clicks) { await p.click(c); await p.waitForTimeout(700); }
await p.screenshot({ path: out });
console.log('saved', out);
await b.close();
