import { chromium } from 'playwright';
const b = await chromium.launch({}); const ctx = await b.newContext({deviceScaleFactor:2}); const p = await ctx.newPage();
for (const w of [390, 768, 1280]) for (const [l,u] of [['LIVE','/account/licence?fixture=demo'],['REF','/__ref/licence.html?fixture=demo']]) {
  await p.setViewportSize({width:w,height:1000});
  await p.goto('http://127.0.0.1:5190'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
  console.log(w, l, await p.evaluate(() => { const e=document.querySelector('[data-ref="licence-card"]'); if(!e) return 'none';
    const r=e.getBoundingClientRect(); return `top=${r.top} h=${r.height} mt=${e.style.marginTop||'-'}`; }));
}
await b.close();
