import { chromium } from 'playwright';
const props = (process.env.P || 'font-size,line-height,padding,letter-spacing,border-width,gap').split(',');
const sels = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
const get = async (u) => { await p.setViewportSize({width:1280,height:900});
  await p.goto('http://127.0.0.1:5190'+u,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
  return p.evaluate(({sels,props}) => Object.fromEntries(sels.map(s=>{const e=document.querySelector(s);
    if(!e) return [s,'-']; const c=getComputedStyle(e);
    return [s, props.map(k=>`${k}=${c.getPropertyValue(k)}`).join(' ')];})), {sels,props}); };
const a = await get('/account/licence?fixture=demo'), r = await get('/__ref/licence.html');
for (const s of sels) { console.log(s); console.log('  live', a[s]); console.log('  ref ', r[s]); }
await b.close();
