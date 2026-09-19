// tools/ref-diff.mjs — screenshot the reference build and the live screen, diff them.
// Setup:  npm i -D playwright pixelmatch pngjs
// Login:  node tools/ref-diff.mjs --login      (sign in once, saves the session)
// Run:    node tools/ref-diff.mjs              (all screens)
//         node tools/ref-diff.mjs licence      (one screen)
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const BASE      = process.env.BASE_URL  ?? 'http://localhost:5173';
const THRESHOLD = Number(process.env.THRESHOLD ?? 1);   // % of pixels allowed to differ
const WIDTHS    = [1280, 768, 390];
const OUT       = 'tools/ref-diff-out';
const STATE     = 'tools/.auth.json';

// Every screen: the reference page, the live page, and the element to compare.
// The same data-ref attribute must exist on both sides.
const SCREENS = [
  { name: 'licence',     ref: '/__ref/licence.html',     live: '/account/licence',     sel: '[data-ref="licence-card"]'  },
  { name: 'preferences', ref: '/__ref/preferences.html', live: '/account/preferences', sel: '[data-ref="preferences"]'   },
  { name: 'module',      ref: '/__ref/module.html',      live: '/m/m1',                sel: '[data-ref="module-panel"]'  },
  { name: 'library',     ref: '/__ref/library.html',     live: '/m/m1/library',        sel: '[data-ref="module-panel"]'  },
  { name: 'crew',        ref: '/__ref/crew.html',        live: '/m/m1/crew',           sel: '[data-ref="module-panel"]'  },
  { name: 'lesson',      ref: '/__ref/lesson.html',      live: '/m/m1/l1',             sel: '[data-ref="lesson"]'        },
];

if (process.argv.includes('--login')) {
  const b = await chromium.launch({ headless: false });
  const c = await b.newContext();
  await (await c.newPage()).goto(BASE);
  console.log('Sign in in the window, then press Enter here.');
  await new Promise(r => process.stdin.once('data', r));
  await c.storageState({ path: STATE });
  await b.close();
  console.log('Saved', STATE);
  process.exit(0);
}

const only = process.argv[2];
const screens = only ? SCREENS.filter(s => s.name === only) : SCREENS;
if (!screens.length) { console.error('No such screen:', only); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, url, sel, width) {
  await page.setViewportSize({ width, height: 1000 });
  // fixture=demo makes the live page render the reference build's sample data
  await page.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'fixture=demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const el = await page.$(sel);
  if (!el) throw new Error(`${url} @${width}px has no ${sel}`);
  return PNG.sync.read(await el.screenshot());
}

function fit(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < out.data.length; i += 4) {        // magenta = size mismatch
    out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 255; out.data[i + 3] = 255;
  }
  PNG.bitblt(img, out, 0, 0, Math.min(img.width, w), Math.min(img.height, h), 0, 0);
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: fs.existsSync(STATE) ? STATE : undefined,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
let failed = 0;

for (const s of screens) {
  for (const width of WIDTHS) {
    const tag = `${s.name}-${width}`;
    try {
      const a = await shot(page, s.ref,  s.sel, width);
      const b = await shot(page, s.live, s.sel, width);
      const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
      const A = fit(a, w, h), B = fit(b, w, h);
      const diff = new PNG({ width: w, height: h });
      const bad = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1 });
      const pct = (bad / (w * h)) * 100;
      const pass = pct <= THRESHOLD && a.width === b.width && a.height === b.height;
      if (!pass) {
        failed++;
        fs.writeFileSync(`${OUT}/${tag}-ref.png`,  PNG.sync.write(A));
        fs.writeFileSync(`${OUT}/${tag}-live.png`, PNG.sync.write(B));
        fs.writeFileSync(`${OUT}/${tag}-diff.png`, PNG.sync.write(diff));
      }
      const size = (a.width === b.width && a.height === b.height)
        ? ''
        : `  SIZE ref ${a.width}x${a.height} vs live ${b.width}x${b.height}`;
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${tag.padEnd(22)} ${pct.toFixed(2)}% different${size}`);
    } catch (e) {
      failed++;
      console.log(`ERROR ${tag.padEnd(22)} ${e.message}`);
    }
  }
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed. Images in ${OUT}/` : '\nAll screens match.');
process.exit(failed ? 1 : 0);
