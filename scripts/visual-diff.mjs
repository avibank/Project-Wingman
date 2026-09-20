#!/usr/bin/env node
/* global window */
/* `refPrep` bodies are stringified and run INSIDE the reference demo's page,
   where `go`, `S`, `ITEMS` and `render` are that demo's own globals. They are
   declared here so eslint reads them as the page's rather than this file's. */
/* global go, S, render */
/* =====================================================================
   Wingman · visual diff — makes "it matches" a number instead of an argument.
   Loads the reference demo and the built screen in the SAME browser, at the
   same widths, with the same fixture data, and reports the pixel difference.
   A screen isn't done until every pair is under the threshold.

   Setup once:   npm i -D playwright pixelmatch pngjs && npx playwright install chromium
   Run:          node scripts/visual-diff.mjs
                 BASE=http://localhost:5173 THRESHOLD=0.4 node scripts/visual-diff.mjs
                 node scripts/visual-diff.mjs bookmarks-home          (one pair only)
   Signed-in screens: save a storage state once, then point at it:
                 PW_STORAGE=.auth/state.json node scripts/visual-diff.mjs
   Output:       tools/diff/<pair>-<width>.{ref,live,diff}.png  + a table + exit code
   ===================================================================== */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const THRESHOLD = Number(process.env.THRESHOLD ?? 0.4);        // % of pixels allowed to differ
const WIDTHS = (process.env.WIDTHS ?? '1280,768,390').split(',').map(Number);
const OUT = 'tools/diff';
const only = process.argv[2];

/* The reference is the demo served at /__ref/*, the live is the built screen.
   `prep` runs on the live page before the shot: use it to reach the same state
   (open a folder, flip a card) and to hide anything that can't match by nature. */
/* THE DEMO DOES NOT READ location.hash. As supplied every `ref` here was a
   hash — #home, #questions, #set — and the demo has no hashchange handler and
   never reads location.hash at all, so all nine landed on its home screen and
   eight of the nine pairs were comparing that against a different live screen.
   It reported 8-22% and none of it meant anything.

   `refPrep` drives the demo into the view instead, through its own `go()` and
   its own controls — the same way tools/make-ref-pages.mjs boots the other
   four reference builds. The hashes are kept on the URLs because they cost
   nothing and name the pair in the filenames. */
const PAIRS = [
  { name: 'bookmarks-home',  ref: '/__ref/bookmarks#home',      live: '/bookmarks?m=m1' },
  { name: 'bookmarks-empty', ref: '/__ref/bookmarks#empty',     live: '/bookmarks?m=m3',
    refPrep: () => { window.ITEMS = []; render(); } },
  { name: 'folder-questions',ref: '/__ref/bookmarks#questions', live: '/bookmarks/questions?m=m1',
    refPrep: () => go('folder', () => { S.type = 'question'; }) },
  { name: 'folder-cards',    ref: '/__ref/bookmarks#cards',     live: '/bookmarks/cards?m=m1',
    refPrep: () => go('folder', () => { S.type = 'card'; }) },
  { name: 'folder-videos',   ref: '/__ref/bookmarks#videos',    live: '/bookmarks/videos?m=m1',
    refPrep: () => go('folder', () => { S.type = 'video'; }) },
  { name: 'folder-pages',    ref: '/__ref/bookmarks#pages',     live: '/bookmarks/pages?m=m1',
    refPrep: () => go('folder', () => { S.type = 'page'; }) },
  { name: 'card-set',        ref: '/__ref/bookmarks#set',       live: '/m/m1/library/cards/1',
    /* `S.set` is "module:chapter", which is what the demo's own row writes
       into it (`data-set="${m}:${x.ch}"`). `S.setCh` was a guess and threw. */
    refPrep: () => go('set', () => { S.set = 'm1:1'; S.flowK = 0; }) },
  { name: 'library',         ref: '/__ref/bookmarks#library',   live: '/m/m1/library',
    refPrep: () => go('library') },
  /* The bag's own demo has no `.bm-bagcell` — that is this app's wrapper — so
     each side is clipped to the thing it actually draws. `.case` is the
     briefcase in the reference; `.bm-bagcell` is the instrument cell holding
     the same drawing here. */
  /* NO FLIGHT-BAG PAIR. Its demo draws the briefcase at 149x157 as the
     subject of its own page; this app draws the same SVG at 85x85 inside one
     cell of a four-instrument strip. A pixel diff of two different scales is
     a number with nothing behind it — the bag is judged by
     `npm run check:ground` and by looking. */
];

/* Things that can never match pixel for pixel — real time, real names, moving art.
   Hidden on BOTH sides, so the layout is still compared. Keep this list short. */
const NEUTRALISE = `
  [data-diff-ignore], .bm-bag .bg-sh, .bm-slide:not(.is-on), .bm-bars b { visibility: hidden !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;

const pct = (n) => `${n.toFixed(2)}%`;
const shot = async (page, url, width, clip, prep) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (prep) { await page.evaluate(prep); await page.waitForTimeout(150); }
  await page.addStyleTag({ content: NEUTRALISE });
  await page.waitForTimeout(350);
  const target = clip ? await page.$(clip) : null;
  if (clip && !target) throw new Error(`no ${clip} on ${url}`);
  return PNG.sync.read(await (target ?? page).screenshot({ fullPage: !clip }));
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext(process.env.PW_STORAGE && existsSync(process.env.PW_STORAGE) ? { storageState: process.env.PW_STORAGE } : {});
const page = await ctx.newPage();
const rows = [];
let worst = 0;

for (const pair of PAIRS) {
  if (only && pair.name !== only) continue;
  for (const width of WIDTHS) {
    let a, b;
    try { a = await shot(page, pair.ref, width, pair.refClip ?? pair.clip, pair.refPrep);
          b = await shot(page, pair.live, width, pair.clip, pair.livePrep); }
    catch (e) { rows.push([pair.name, width, 'ERROR', e.message.split('\n')[0]]); worst = 100; continue; }
    const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
    const crop = (src) => { const out = new PNG({ width: w, height: h }); PNG.bitblt(src, out, 0, 0, w, h, 0, 0); return out; };
    const A = crop(a), B = crop(b), diff = new PNG({ width: w, height: h });
    const n = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.12 });
    const p = (n / (w * h)) * 100;
    worst = Math.max(worst, p);
    const tag = join(OUT, `${pair.name}-${width}`);
    writeFileSync(`${tag}.ref.png`, PNG.sync.write(A));
    writeFileSync(`${tag}.live.png`, PNG.sync.write(B));
    writeFileSync(`${tag}.diff.png`, PNG.sync.write(diff));
    const sizeNote = (a.height !== b.height || a.width !== b.width) ? ` (ref ${a.width}×${a.height}, live ${b.width}×${b.height})` : '';
    rows.push([pair.name, width, pct(p) + sizeNote, p <= THRESHOLD ? 'pass' : 'FAIL']);
  }
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  ${pad('screen', 20)}${pad('width', 8)}${pad('difference', 34)}result`);
console.log('  ' + '-'.repeat(70));
for (const [name, width, p, res] of rows) console.log(`  ${pad(name, 20)}${pad(width, 8)}${pad(p, 34)}${res}`);
console.log(`\n  threshold ${THRESHOLD}% · images in ${OUT}/ (open the *.diff.png to see what moved)\n`);
process.exit(worst > THRESHOLD ? 1 : 0);
