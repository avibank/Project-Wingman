import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({width:1280,height:900});
await p.goto('http://127.0.0.1:5190/account/licence?fixture=demo',{waitUntil:'networkidle'}); await p.waitForTimeout(300);
console.log(await p.evaluate(() => {
  const el = document.querySelector('.lbody'); const hits=[];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    const walk = (rs, at) => { for (const r of rs) {
      if (r.cssRules) { walk(r.cssRules, r.conditionText || at); continue }
      if (!r.selectorText) continue;
      try { if (el.matches(r.selectorText)) hits.push(`${at?'@'+at+' ':''}${r.selectorText} {${r.style.cssText.slice(0,140)}}`); } catch {}
    }};
    walk(rules, '');
  }
  return hits.join('\n') + '\n--- inline: ' + el.getAttribute('style');
}));
await b.close();
