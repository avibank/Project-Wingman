import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const [l,u] of [['LIVE','/account/licence?fixture=demo'],['REF','/__ref/licence.html']]) {
  await p.setViewportSize({width:1280,height:900});
  await p.goto('http://127.0.0.1:5190'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
  console.log(l, await p.evaluate(() => { const e=document.querySelector('input.hn');
    return `size=${e.getAttribute('size')} value="${e.value}" ph="${e.placeholder}" w=${e.getBoundingClientRect().width.toFixed(1)} bs=${getComputedStyle(e).boxSizing} pad=${getComputedStyle(e).padding} minw=${getComputedStyle(e).minWidth}`; }));
}
await b.close();
