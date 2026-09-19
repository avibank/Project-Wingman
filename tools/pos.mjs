import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const w of [1280, 390]) for (const [l,u] of [['LIVE','/account/licence?fixture=demo'],['REF','/__ref/licence.html']]) {
  await p.setViewportSize({width:w,height:1000});
  await p.goto('http://127.0.0.1:5190'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
  console.log(w, l, await p.evaluate(() => { const r=document.querySelector('.lic').getBoundingClientRect();
    return `top=${r.top} left=${r.left} w=${r.width} h=${r.height}`; }));
}
await b.close();
