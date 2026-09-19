import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('http://127.0.0.1:5190/account/licence?fixture=demo',{waitUntil:'networkidle'}); await p.waitForTimeout(300);
console.log(await p.evaluate(() => {
  const out=[]; let e=document.querySelector('.lbody');
  while(e && e!==document.documentElement){ const c=getComputedStyle(e);
    out.push(`${e.tagName.toLowerCase()}.${(e.className||'').toString().split(/\s+/).slice(0,3).join('.')} fs=${c.fontSize} lh=${c.lineHeight}`); e=e.parentElement; }
  return out.join('\n');
}));
await b.close();
