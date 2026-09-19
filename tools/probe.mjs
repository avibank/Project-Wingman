/* =============================================================================
   OPEN A PAGE AND SAY WHAT WENT WRONG.
   -----------------------------------------------------------------------------
     node tools/probe.mjs http://127.0.0.1:5190/account/licence

   Page errors, console errors, 4xx/5xx responses, and the first 300
   characters the page actually renders. It exists because a module that
   throws at EVALUATION — a stray backtick closing a CSS template literal —
   shows up in a browser as a lazy route that renders nothing at all, for
   ever, with no error anywhere you would think to look.
   ========================================================================= */
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('Usage: node tools/probe.mjs <url>'); process.exit(1); }

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.split('\n').slice(0, 3).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 400)); });
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 140)); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
console.log('TEXT:', (await page.innerText('body')).slice(0, 300).replace(/\n/g, ' | '));
await browser.close();
