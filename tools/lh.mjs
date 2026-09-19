import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
for (const [l,u] of [['LIVE','/account/licence?fixture=demo'],['REF','/__ref/licence.html']]) {
  await p.setViewportSize({width:1280,height:900});
  await p.goto('http://127.0.0.1:5190'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
  console.log(l, await p.evaluate(() => {
    const q=s=>{const e=document.querySelector(s); if(!e) return s+': -'; const c=getComputedStyle(e);
      return `${s} fs=${c.fontSize} lh=${c.lineHeight} pad=${c.paddingTop}/${c.paddingBottom}`;};
    return [q('body'),q('.lic'),q('.lbody'),q('input.bio'),q('.tag'),q('.tag span'),q('.sblock')].join('\n     ');
  }));
}
await b.close();
