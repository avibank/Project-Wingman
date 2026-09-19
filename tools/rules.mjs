import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({width:Number(process.env.W||1280),height:900});
await p.goto('http://127.0.0.1:5190' + (process.env.U || '/account/licence?fixture=demo'),{waitUntil:'networkidle'});
await p.waitForTimeout(400);
const sel = process.argv[2], prop = process.argv[3];
console.log(await p.evaluate(({sel,prop}) => {
  const el = document.querySelector(sel); if(!el) return 'no ' + sel;
  const hits=[];
  const walk = (rs, at) => { for (const r of rs) {
    if (r.selectorText && r.style) {
      const v = r.style.getPropertyValue(prop) || (r.style.font ? `font: ${r.style.font}` : '');
      if (v) { try { if (el.matches(r.selectorText)) hits.push(`${at?'@'+at+' ':''}${r.selectorText} -> ${v}`); } catch {} }
    }
    if (r.cssRules && r.cssRules.length) walk(r.cssRules, r.conditionText || at);
  }};
  for (const s of document.styleSheets) { try { walk(s.cssRules, '') } catch {} }
  return hits.join('\n') || '(none)';
}, {sel,prop}));
await b.close();
