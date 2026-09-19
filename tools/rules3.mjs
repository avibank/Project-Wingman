import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('http://127.0.0.1:5190/account/licence?fixture=demo',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
console.log(await p.evaluate(() => {
  let n=0, bad=0, tot=0;
  for (const s of document.styleSheets) { n++; try { tot += s.cssRules.length } catch { bad++ } }
  const el = document.querySelector('.lbody');
  return `sheets=${n} unreadable=${bad} rules=${tot} lbody=${!!el} matchesRefLic=${el && el.matches('.ref-lic .lbody')}`;
}));
await b.close();
