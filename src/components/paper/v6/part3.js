/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part 3 (the tool bar).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and `npm run check:paper` refuses if this file and the source have drifted.
 *
 * Changed from the handed-over file, and only this:
 *   - HANDOVER section 5 — SEED and seed(). findRange() stays: the anchoring fallback needs it
 *   - HANDOVER section 5 — seed() goes, and with it the load hook that ran it
 *   - a new mark has to reach the database, and it is stored as text offsets — never as the boxes drawn here
 *   - removing a mark has to reach the database too
 *   - recolouring and converting a mark are edits to a stored record
 *   - the same, for a colour change
 *   - a finished stroke is a record in paper_ink, in the 0-1000 page fractions it is already drawn in
 *   - the tray, its order, and every tool's colour, size and opacity persist per student
 *   - closing the same call
 *   - the tool bar has to hand the rest of the reader the pieces the demo kept to itself
 */

export function mountToolbar(ctx){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr');
const COL=[{k:'y',hex:'#F5C23C',n:'Exam likely'},{k:'b',hex:'#5BB4F0',n:'Definition'},
           {k:'g',hex:'#43C08A',n:'Testable fact'},{k:'p',hex:'#B571E0',n:'Ask'},
           {k:'r',hex:'#EE6F82',n:'Weak spot'}];
const col=k=>COL.find(c=>c.k===k)||COL[0];
const tint=(h,a)=>{const n=parseInt(h.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const GREY=()=>getComputedStyle(R).getPropertyValue('--grey').trim();

/* ── icons ─────────────────────────────────────────────────────────── */
function icon(id,c,S){
  S=S||22; c=c||GREY(); const F=tint(c,.16);
  const st=`stroke="${c}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"`;
  const o=`<svg class="ic" width="${S}" height="${S}" viewBox="0 0 24 24" fill="none">`;
  switch(id){
  case 'cur':return o+`<g class="g-hand" style="transform-origin:7px 4px"><path d="M6.8 3.2a.9.9 0 011.4-.8l10 6.9a.9.9 0 01-.4 1.6l-4.2.6a.9.9 0 00-.66.46l-2 3.8a.9.9 0 01-1.68-.3z" fill="${F}" ${st}/><path d="M13.1 14.4l3.1 5.3a1.3 1.3 0 002.25-1.3l-3.05-5.25" fill="${F}" ${st}/></g></svg>`;
  case 'hand':return o+`<g class="g-hand" style="transform-origin:12px 21px"><path d="M8.4 12.6V6.6a1.55 1.55 0 013.1 0v4.3V4.5a1.55 1.55 0 013.1 0v6.4V6a1.55 1.55 0 013.1 0v5.9V9.1a1.55 1.55 0 013.1 0v6.2a6.4 6.4 0 01-6.4 6.4h-1.5a5.1 5.1 0 01-3.6-1.5l-4-4a1.6 1.6 0 012.3-2.3z" fill="${F}" ${st}/></g></svg>`;
  case 'pen':return o+`<path class="trail" d="M2.6 21.4c3.4-2.2 6.6 1.4 9.6-.6 2.6-1.7 5.4-.2 7.6-1.2" stroke="${c}" stroke-width="1.9"/><g class="g-pen" style="transform-origin:12px 12px"><g transform="rotate(-40 12 12)"><path d="M9.4 3.4h5.2a1.7 1.7 0 011.7 1.7v6.6H7.7V5.1a1.7 1.7 0 011.7-1.7z" fill="${F}" ${st}/><path d="M7.7 11.7h8.6L12 20.4z" fill="${F}" ${st}/><path d="M10.3 16.6h3.4L12 20.4z" fill="${c}"/><path d="M7.9 8.6h8.2" ${st}/></g></g></svg>`;
  case 'hl':return o+`<rect class="hswipe" x="1.8" y="18.8" width="18" height="3.4" rx="1.7" fill="${c}"/><g class="g-hl" style="transform-origin:12px 12px"><g transform="rotate(-40 12 12)"><rect x="7.9" y="2.7" width="8.2" height="8.3" rx="1.9" fill="${F}" ${st}/><rect x="7.4" y="11.1" width="9.2" height="1.9" rx=".9" fill="${c}"/><path d="M8.6 13.4h6.8l-.9 4.5H9.5z" fill="${F}" ${st}/><rect x="9.5" y="17.4" width="5" height="2.1" rx=".9" fill="${c}"/></g></g></svg>`;
  case 'era':return o+`<path class="scrub" d="M3.4 20.6c2.6-2.4 4.2 1.2 6.6-.8 2.2-1.8 4.6.4 6.8-1.4" stroke="${c}" stroke-width="1.9"/><g class="g-era" style="transform-origin:12px 13px"><g transform="rotate(-34 12 12)"><rect x="5.4" y="4.6" width="13.2" height="9.4" rx="2.3" fill="${tint(c,.18)}" ${st}/><path d="M5.4 10.2h13.2v1.5a2.3 2.3 0 01-2.3 2.3H7.7a2.3 2.3 0 01-2.3-2.3z" fill="${c}"/></g></g><circle class="crumb" cx="18.4" cy="15.8" r="1.15" fill="${c}" opacity="0"/><circle class="crumb" cx="15.6" cy="19" r=".85" fill="${c}" opacity="0" style="animation-delay:.42s"/></svg>`;
  case 'note':return o+`<g class="g-note" style="transform-origin:12px 14px"><rect x="4.4" y="5.4" width="15.2" height="14.8" rx="2.4" fill="${F}" ${st}/><rect class="nl nl1" x="7.4" y="10.4" width="9.2" height="1.8" rx=".9" fill="${c}"/><rect class="nl nl2" x="7.4" y="14.2" width="6" height="1.8" rx=".9" fill="${c}" opacity=".62"/></g><g class="pin-h" style="transform-origin:12px 4.4px"><circle cx="12" cy="4.4" r="2.7" fill="${c}"/><path d="M12 7.1v2.2" ${st}/></g></svg>`;
  case 'ask':return o+`<g class="g-ask" style="transform-origin:12px 12px"><path d="M7 3.9h10.2a2.5 2.5 0 012.5 2.5v7.4a2.5 2.5 0 01-2.5 2.5h-5.6l-4.5 3.5v-3.5H7a2.5 2.5 0 01-2.5-2.5V6.4A2.5 2.5 0 017 3.9z" fill="${F}" ${st}/><g class="qm" style="transform-origin:12px 11.5px"><path d="M10.1 8.4a2.05 2.05 0 014 .6c0 1.45-1.95 1.7-1.95 3" stroke="${c}" stroke-width="1.95" fill="none" stroke-linecap="round"/><circle cx="12.1" cy="14.5" r="1.15" fill="${c}"/></g></g></svg>`;
  case 'ul':return o+`<path d="M7 4v5.6a4 4 0 008 0V4" ${st} stroke-width="2.2"/><rect x="5.6" y="17.4" width="12.8" height="2.4" rx="1.2" fill="${c}"/></svg>`;
  case 'st':return o+`<path d="M16 6.8C15.2 5.4 13.8 4.7 12 4.7c-2.4 0-4 1.3-4 2.9 0 1.1.7 2 2.1 2.5" ${st} stroke-width="2.1"/><path d="M8.2 15.4c.9 1.4 2.3 2.1 4 2.1 2.3 0 3.9-1.1 3.9-2.8" ${st} stroke-width="2.1"/><rect x="4.6" y="10.7" width="14.8" height="2.4" rx="1.2" fill="${c}"/></svg>`;
  case 'mkr':return o+`<g transform="rotate(-40 12 12)"><rect x="7.2" y="2.6" width="9.6" height="8.6" rx="2.6" fill="${F}" ${st}/><path d="M8.2 11.4h7.6l1.2 5.6H7z" fill="${F}" ${st}/><rect x="7.6" y="17.2" width="8.8" height="2.3" rx="1.1" fill="${c}"/></g></svg>`;
  case 'shp':return o+`<rect x="3.4" y="8.2" width="10.4" height="10.4" rx="2.2" fill="${F}" ${st}/><circle cx="16.4" cy="8" r="4.8" fill="${tint(c,.3)}" ${st}/></svg>`;
  case 'txt':return o+`<path d="M4.6 6.4V4.4h14.8v2" ${st}/><path d="M12 4.4v15.2" ${st}/><rect x="8.2" y="18" width="7.6" height="2.2" rx="1.1" fill="${c}"/></svg>`;
  case 'msr':return o+`<g transform="rotate(-40 12 12)"><rect x="7.4" y="2.6" width="9.2" height="18.8" rx="2.2" fill="${F}" ${st}/><path d="M7.4 6.8h3.4M7.4 11.2h4.6M7.4 15.6h3.4" ${st}/></g></svg>`;
  case 'snap':return o+`<path d="M4.4 8.6V6a1.6 1.6 0 011.6-1.6h2.6M15.4 4.4H18A1.6 1.6 0 0119.6 6v2.6M19.6 15.4V18a1.6 1.6 0 01-1.6 1.6h-2.6M8.6 19.6H6A1.6 1.6 0 014.4 18v-2.6" ${st}/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1.4" fill="${c}"/></svg>`;
  case 'flag':return o+`<rect x="4.6" y="3.2" width="2.4" height="17.6" rx="1.2" fill="${c}"/><path d="M7 4.8c3.5-1.7 7 1.7 10.5 0v7.3c-3.5 1.7-7-1.7-10.5 0z" fill="${F}" ${st}/></svg>`;
  case 'link':return o+`<path d="M10.2 13.8a3.6 3.6 0 010-5.1l3-3a3.6 3.6 0 015.1 5.1l-1.4 1.4" ${st}/><path d="M13.8 10.2a3.6 3.6 0 010 5.1l-3 3a3.6 3.6 0 01-5.1-5.1l1.4-1.4" ${st}/></svg>`;
  case 'chest':return o+`<rect x="3" y="8.4" width="18" height="11.6" rx="2.6" fill="${tint(GREY(),.14)}" stroke="currentColor" stroke-width="1.7"/><path d="M8.6 8.4V6.6A1.8 1.8 0 0110.4 4.8h3.2a1.8 1.8 0 011.8 1.8v1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="10.2" y="12.2" width="3.6" height="2.8" rx="1" fill="currentColor"/></svg>`;
  }
  return '';
}

const TOOLS=[
 {id:'hand',n:'Select',k:'V',g:'Basics',lock:1,grey:1,v:['Cursor','Grab']},
 {id:'pen',n:'Pen',k:'P',g:'Draw',ink:1,v:['Pen','Pencil'],p:1},
 {id:'hl',n:'Highlight',k:'H',g:'Basics',mean:1,ink:1,v:['Chisel','Free-form'],p:1},
 {id:'era',n:'Eraser',k:'E',g:'Draw',grey:1,v:['Whole mark','Just where you rub']},
 {id:'note',n:'Note',k:'N',g:'Notes',mean:1,v:['Anywhere','On a passage']},
 {id:'ask',n:'Ask',k:'Q',g:'Notes',fixed:'p',v:['Anywhere','On a passage']},
 {id:'ul',n:'Underline',k:'U',g:'Basics',mean:1},
 {id:'st',n:'Strikethrough',k:'S',g:'Basics',mean:1},
 {id:'mkr',n:'Marker',k:'M',g:'Draw',ink:1,p:1},
 {id:'shp',n:'Shape',k:'R',g:'Draw',ink:1,v:['Line','Arrow','Box','Ellipse']},
 {id:'txt',n:'Text',k:'T',g:'Draw',ink:1,v:['Text box','Callout']},
 {id:'snap',n:'Snapshot',k:'C',g:'Capture',grey:1},
 {id:'msr',n:'Measure',k:'K',g:'Capture',ink:1,v:['Distance','Area']},
 {id:'flag',n:'Flag',k:'F',g:'Notes',mean:1},
 {id:'link',n:'Link',k:'L',g:'Notes',grey:1}];
const T=id=>TOOLS.find(t=>t.id===id);
const DEF=['hand','pen','hl','era','note','ask'];
const CAP=10;
const GRID=['#EE6F82','#F0865E','#F5A93C','#F5C23C','#D6C93E','#8FC24A','#43C08A','#3FC2AE',
            '#4FB8E0','#5BB4F0','#6E9BF2','#8C86EE','#B571E0','#D06BC8','#E86BA6','#EE6F82',
            '#C7CDD4','#9AA5B1','#71808E','#4C5A67','#2E3A45','#1B242D','#FFFFFF','#000000'];

let S=ctx.settings({tool:'hl',tray:[...DEF],bar:'left',
  variant:{},colour:{pen:'b',hl:'y',mkr:'y',shp:'b',txt:'b',msr:'g',note:'y',ul:'y',st:'r',flag:'r'},
  size:{pen:3,hl:12,mkr:14,shp:2,txt:14,msr:2,era:10,ul:2,st:2,note:12,flag:2},
  op:{pen:100,hl:38,mkr:55,shp:100,txt:100,msr:100,era:100,ul:100,st:100,note:100,flag:100},
  recent:[], presets:{}, open:null, gtab:'Draw', straight:{}});
const resolve=v=>(typeof v==='string'&&v[0]==='#')?v:col(v).hex;
const colOf=t=>t.fixed?col(t.fixed).hex:(t.grey?GREY():resolve(S.colour[t.id]||'y'));
const canCol=t=>!t.grey&&!t.fixed;

/* ── rail ──────────────────────────────────────────────────────────── */
function paintRail(){
  let out=`<span class="grip" aria-hidden="true"></span>
    <button class="util chest" data-u="chest" aria-label="Your bar">${icon('chest',null,17)}</button>
    <div class="sep"></div>`;
  S.tray.forEach(id=>{const t=T(id);if(!t)return;
    const gid = id==='hand' ? ((S.variant.hand||0)===1?'hand':'cur') : id;
    out+=`<button class="t ${id===S.tool?'on':''}" data-t="${id}" aria-label="${t.n}">
      ${icon(gid,colOf(t),22)}${t.p?`<span class="pcnt">${nPresets(id)}</span>`:''}</button>`});
  out+=`<div class="sep"></div><span class="grip" aria-hidden="true"></span>`;
  $('#rail').innerHTML=out;
  mode();
}
const DRAWS=['pen','mkr','hl'];
/* the pointer becomes the nib: a ring the size of the stroke, in its colour */
function paintCursor(){
  const stg=document.getElementById('stage');
  if(!DRAWS.includes(S.tool)){stg.style.cursor='';return}
  const t=T(S.tool), c=colOf(t), w=Math.max(6,Math.min(30,S.size[t.id]*(t.id==='hl'?1.6:2.2)));
  const s=Math.ceil(w)+6, h=s/2;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">`+
    `<circle cx="${h}" cy="${h}" r="${w/2}" fill="none" stroke="${c}" stroke-width="1.6" opacity=".95"/>`+
    `<circle cx="${h}" cy="${h}" r="1.2" fill="${c}"/></svg>`;
  stg.style.cursor=`url("data:image/svg+xml;base64,${btoa(svg)}") ${h} ${h}, crosshair`;
}
/* what the pointer means right now */
function mode(){
  R.dataset.tool=S.tool;
  R.dataset.grab=(S.tool==='hand'&&(S.variant.hand||0)===1)?'1':'0';
  R.dataset.sel =(S.tool==='hand'&&(S.variant.hand||0)===0)?'1':'0';
  R.dataset.draw= DRAWS.includes(S.tool)?'1':'0';
  paintCursor();
  R.style.setProperty('--sel',colOf(T(S.tool)));
}
const nPresets=id=>(S.presets[id]||[]).filter(Boolean).length||'';

/* ── properties ────────────────────────────────────────────────────── */
function paintProps(){
  const t=T(S.tool);if(!t)return;
  const c=colOf(t),sz=S.size[t.id],op=S.op[t.id],vi=S.variant[t.id]||0;
  const ink=t.ink,sizeless=(t.id==='hand'||(t.id==='era'&&vi===0)||t.id==='snap'||t.id==='link');
  const pr=S.presets[t.id]||[null,null,null];
  $('#propsIn').innerHTML=`
   <div class="hd">${icon(t.id,c,20)}<b>${t.n}</b>
     <button class="x" data-close aria-label="Close"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>
   <div class="bd">
    ${t.v?`<div class="segs">${t.v.map((v,i)=>`<button class="${i===vi?'on':''}" data-v="${i}">${v}</button>`).join('')}</div>`:''}
    ${sizeless?'':`<div class="prev" id="prev"></div>`}
    ${canCol(t)?`
      ${(ink&&S.recent.length)?`<div class="crow rec">${S.recent.slice(0,6).map(h=>
        `<button class="c ${h===c?'on':''}" data-hex="${h}" style="--k:${h}"><i></i></button>`).join('')}</div>`:''}
      <div class="crow">${COL.map(cc=>
        `<button class="c ${cc.hex===c?'on':''}" data-k="${cc.k}" style="--k:${cc.hex}" aria-label="${cc.n}"><i></i></button>`).join('')}
        ${ink?`<button class="c grid" data-grid aria-label="More colours"><i></i></button>`:''}</div>`:''}
    ${t.fixed?`<div class="hint" style="margin-top:2px">Always purple, always anonymous.</div>`:''}
    ${sizeless?'':`<div class="lab" style="margin-top:13px">${t.id==='era'?'Rub size':'Size'}<span class="v">${sz} pt</span></div>
      <input type="range" id="szr" min="1" max="${ink?16:32}" value="${sz}"
        style="--trk:linear-gradient(90deg,${c},${tint(c,.2)});--tc:${c}">`}
    ${(sizeless||t.grey)?'':`<div class="lab">Opacity<span class="v">${op}%</span></div>
      <input type="range" id="opr" min="10" max="100" value="${op}"
        style="--trk:linear-gradient(90deg,${tint(c,.12)},${c});--tc:${c}">`}
    ${(t.id==='pen'||t.id==='mkr'||t.id==='hl')?`
      ${t.id==='hl'?`<div class="hint" style="margin-top:11px">Chisel lays a straight line.
        Free-form follows your hand.</div>`:`
      <button class="tgl ${S.straight[t.id]?'on':''}" data-straight="${t.id}">
        <span class="bx"></span><span>Straight lines</span>
        <em>Every stroke snaps to a line</em></button>`}`:''}
    ${t.p?`<div class="lab" style="margin-top:12px">Presets</div>
      <div class="pres">${[0,1,2].map(i=>{const p=pr[i];
        return `<button class="pr ${p?'':'empty'}" data-pr="${i}"
          style="--pk:${p?resolve(p.k):'var(--hair)'};--pf:${p?tint(resolve(p.k),.14):'transparent'}">
          ${p?`<span class="pdot"></span><svg width="34" height="12" viewBox="0 0 34 12"><path d="M2 8c6-6 12 4 18-1 4-3 8 1 12-1" fill="none" stroke="${resolve(p.k)}" stroke-width="${Math.max(1.2,p.size/2)}" stroke-linecap="round" opacity="${p.op/100}"/></svg>`:''}
        </button>`}).join('')}</div>
      <div class="hint">Tap to load. Hold to save what you're using now.</div>`:''}
   </div>`;
  drawPrev();
}
function drawPrev(){
  const t=T(S.tool),p=$('#prev');if(!p)return;
  const c=colOf(t),sz=S.size[t.id],op=S.op[t.id];
  if(t.ink||t.id==='era')
    p.innerHTML=`<svg width="180" height="30" viewBox="0 0 180 30"><path d="M6 21C28 4 42 25 62 15s34-13 54-2 36 11 56 2" fill="none" stroke="${c}" stroke-opacity="${op/100}" stroke-width="${Math.max(1,sz)}" stroke-linecap="round"/></svg>`;
  else if(t.id==='ul'||t.id==='st')
    p.innerHTML=`<span class="smp" style="text-decoration:${t.id==='ul'?'underline':'line-through'};text-decoration-color:${tint(c,op/100)};text-decoration-thickness:${sz}px;text-underline-offset:3px">Sample text</span>`;
  else
    p.innerHTML=`<span class="smp" style="background:${tint(c,op/100)};padding:${Math.round(sz/5)}px 8px">Sample text</span>`;
}

/* ── chest & add ───────────────────────────────────────────────────── */
function paintChest(){
  $('#chestIn').innerHTML=`
   <div class="hd">${icon('chest',null,20)}<b>Your bar</b>
     <button class="x" data-close><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>
   <div class="hint" style="padding:11px 14px 2px;margin:0">Hold a tool on the bar and drag it to move it.</div>
   <div class="list" id="clist">${S.tray.map(id=>{const t=T(id);
     return `<div class="li ${t.lock?'lock':''}" data-id="${id}">
       ${icon(id==='hand'?((S.variant.hand||0)===1?'hand':'cur'):id,colOf(t),19)}<b>${t.n}</b>
       <button class="rm" data-rm="${id}" aria-label="Remove"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>`}).join('')}</div>
   <div class="addwrap">
     <div class="lab2">Add a tool<span>${S.tray.length} of ${CAP}</span></div>
     <div class="tabs">${['Basics','Draw','Capture','Notes'].map(g=>
       `<button class="${g===S.gtab?'on':''}" data-g="${g}">${g}</button>`).join('')}</div>
     <div class="grid2">${TOOLS.filter(t=>t.g===S.gtab).map(t=>
       `<button class="cell ${S.tray.includes(t.id)?'have':''}" data-add="${t.id}">
         <span class="b">${icon(t.id==='hand'?'cur':t.id,colOf(t),19)}</span><span>${t.n}</span></button>`).join('')}</div>
   </div>
   <div class="foot"><div class="lab" style="margin-bottom:0">Bar position</div>
     <div class="pos">${['left','right','bottom','top'].map(p=>
       `<button class="${p===S.bar?'on':''}" data-pos="${p}">${p[0].toUpperCase()+p.slice(1)}</button>`).join('')}</div>
     <button class="reset" data-reset>Reset to the default six</button></div>`;
}
function paintGrid(){
  $('#cgridIn').innerHTML=`<div class="hd"><b>Colour</b>
     <button class="x" data-close><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>
    <div class="cgrid">${GRID.map(h=>`<button class="cg" data-hex="${h}" style="--k:${h}"></button>`).join('')}</div>`;
}

/* ── popout placement ──────────────────────────────────────────────── */
function anchorTo(poId,notchId,el){
  const po=document.getElementById(poId),nt=document.getElementById(notchId);
  const r=el.getBoundingClientRect(),w=po.offsetWidth||272,h=po.offsetHeight||300;
  const b=S.bar;
  if(b==='left'||b==='right'){
    let top=r.top+r.height/2-h/2;
    top=Math.max(16,Math.min(innerHeight-h-16,top));
    po.style.top=top+'px';po.style.bottom='';
    if(b==='left'){po.style.left=(r.right+14)+'px';po.style.right=''}
    else{po.style.right=(innerWidth-r.left+14)+'px';po.style.left=''}
    nt.style.top=(r.top+r.height/2-top-6)+'px';nt.style.left='';
    if(b==='left')nt.style.left='-6.5px';else nt.style.right='-6.5px';
  }else{
    let left=r.left+r.width/2-w/2;
    left=Math.max(16,Math.min(innerWidth-w-16,left));
    po.style.left=left+'px';po.style.right='';
    if(b==='bottom'){po.style.bottom=(innerHeight-r.top+14)+'px';po.style.top=''}
    else{po.style.top=(r.bottom+14)+'px';po.style.bottom=''}
    nt.style.left=(r.left+r.width/2-left-6)+'px';nt.style.top='';
  }
}
function openPo(which,el){
  closeAll(which);
  if(which==='props')paintProps();
  if(which==='chest')paintChest();

  if(which==='cgrid')paintGrid();
  const po=document.getElementById(which);
  po.classList.add('open');S.open=which;R.dataset.po='1';
  requestAnimationFrame(()=>anchorTo(which,{props:'notch1',chest:'notch2',cgrid:'notch4'}[which],el));
}
function closeAll(except){
  ['props','chest','cgrid'].forEach(k=>{if(k!==except)document.getElementById(k).classList.remove('open')});
  if(!except){S.open=null;R.dataset.po='0'}
  $$('.util').forEach(u=>u.classList.toggle('on',
    (u.dataset.u==='chest'&&except==='chest')));
}
function reanchor(){
  if(!S.open)return;
  const el=S.open==='props'?document.querySelector('.t.on')
        :S.open==='cgrid'?document.querySelector('.t.on')
        :document.querySelector('.util[data-u="chest"]');
  if(el)anchorTo(S.open,{props:'notch1',chest:'notch2',cgrid:'notch4'}[S.open],el);
}

/* ── play the icon animation ───────────────────────────────────────── */
function play(el){if(!el||el.dataset.busy)return;
  el.dataset.busy='1';el.classList.add('play');
  setTimeout(()=>{el.classList.remove('play');delete el.dataset.busy},920)}

/* ── events ────────────────────────────────────────────────────────── */
$('#rail').addEventListener('click',e=>{
  const u=e.target.closest('.util');
  if(u){const k=u.dataset.u;
    if(S.open===k){closeAll();return}
    openPo(k,u);u.classList.add('on');return}
  const b=e.target.closest('.t');if(!b||DR)return;
  const id=b.dataset.t;
  if(id===S.tool){ S.open==='props'?closeAll():openPo('props',b); return }
  S.tool=id;closeAll();paintRail();
  const nb=document.querySelector(`.t[data-t="${id}"]`);play(nb.querySelector('svg'));
});
/* ── the rail: shown by default; auto-hide is a mode you turn on ───── */
const touchOnly = matchMedia('(pointer:coarse)').matches || !matchMedia('(hover:hover)').matches;
R.dataset.plat = touchOnly ? 'touch' : 'desktop';
let outT=null, autoHide=false;
window.setBarAutoHide=v=>{autoHide=v;railIn()};

function railIn(){clearTimeout(outT);R.dataset.rail='on'}
function railOut(){
  if(touchOnly||!autoHide)return;
  clearTimeout(outT);
  outT=setTimeout(()=>{
    if(S.open||DR)return;                       /* a popout or a drag holds it open */
    R.dataset.rail='off';
  },520);
}

/* distance from the bar's own edge — the only test that survives a fast mouse */
function nearEdge(e){
  const p=R.dataset.bar, w=innerWidth, h=innerHeight, Z=112;
  return p==='left'   ? e.clientX < Z
       : p==='right'  ? e.clientX > w-Z
       : p==='bottom' ? e.clientY > h-Z
       :                e.clientY < Z;
}

if(!touchOnly){
  addEventListener('pointermove',e=>{ nearEdge(e) ? railIn() : railOut() },{passive:true});
  $('#handle').addEventListener('click',railIn);
  ['props','chest','cgrid'].forEach(id=>
    document.getElementById(id).addEventListener('pointerenter',railIn));
}


/* ── long-press a tool, then drag it up or down to move it ─────────── */
let DR=null, dTimer=null;
let MV=null, mTimer=null;
$('#rail').addEventListener('pointerdown',e=>{
  if(!e.target.closest('.t')&&!e.target.closest('.util')){
    const quick=!!e.target.closest('.grip');      /* the grip is meant for this */
    mTimer=setTimeout(()=>{MV=true;R.dataset.move='1';closeAll();
      if(navigator.vibrate)navigator.vibrate(10)}, quick?140:480);
    return;
  }
  const b=e.target.closest('.t'); if(!b) return;
  const id=b.dataset.t;
  dTimer=setTimeout(()=>{
    const r=b.getBoundingClientRect();
    const g=document.createElement('div');
    g.className='ghost-t';g.innerHTML=b.querySelector('svg').outerHTML;
    g.style.left=(r.left+r.width/2)+'px';g.style.top=(r.top+r.height/2)+'px';
    document.body.appendChild(g);
    b.classList.add('lift');
    DR={id,ghost:g,from:S.tray.indexOf(id)};
    closeAll();
    if(navigator.vibrate)navigator.vibrate(8);
  },420);
});
function nearestZone(e){
  let best=null,bd=1e9;
  $$('.zone').forEach(z=>{const r=z.getBoundingClientRect();
    const d=Math.hypot(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2));
    if(d<bd){bd=d;best=z}});
  $$('.zone').forEach(z=>z.classList.toggle('hot',z===best));
  return best;
}
addEventListener('pointermove',e=>{
  if(mTimer&&!MV){clearTimeout(mTimer);mTimer=null}
  if(MV){nearestZone(e);return}
  if(dTimer&&!DR){clearTimeout(dTimer);dTimer=null}
  if(!DR)return;
  e.preventDefault();
  DR.ghost.style.left=e.clientX+'px';DR.ghost.style.top=e.clientY+'px';
  const ch=document.querySelector('.util.chest');
  const cr=ch.getBoundingClientRect();
  const overChest = e.clientX>cr.left-14&&e.clientX<cr.right+14&&
                    e.clientY>cr.top-14&&e.clientY<cr.bottom+14;
  DR.off = overChest && !T(DR.id).lock && S.tray.length>2;
  DR.ghost.classList.toggle('drop',!!DR.off);
  ch.classList.toggle('binning',!!DR.off);
  if(DR.off)return;
  const slots=$$('.t');
  const horiz=(S.bar==='bottom'||S.bar==='top');
  let target=null;
  slots.forEach(el=>{
    if(el.dataset.t===DR.id)return;
    const r=el.getBoundingClientRect();
    const mid=horiz?r.left+r.width/2:r.top+r.height/2;
    const p=horiz?e.clientX:e.clientY;
    if(horiz? (p>r.left&&p<r.right) : (p>r.top&&p<r.bottom)){
      target={id:el.dataset.t,after:p>mid};
    }
  });
  if(target){
    const from=S.tray.indexOf(DR.id);
    let to=S.tray.indexOf(target.id);
    if(target.after&&to<from)to++;
    if(!target.after&&to>from)to--;
    if(to!==from&&to>=0){
      S.tray.splice(to,0,S.tray.splice(from,1)[0]);
      paintRail();
      const nb=document.querySelector(`.t[data-t="${DR.id}"]`);
      nb&&nb.classList.add('lift');
    }
  }
});
['pointerup','pointercancel'].forEach(v=>addEventListener(v,e=>{
  clearTimeout(mTimer);mTimer=null;
  if(MV){
    const z=document.querySelector('.zone.hot');
    if(z){S.bar=z.dataset.z;R.dataset.bar=S.bar;paintRail();mode();reanchor()}
    $$('.zone').forEach(x=>x.classList.remove('hot'));
    R.dataset.move='0';MV=null;return;
  }
  clearTimeout(dTimer);dTimer=null;
  if(!DR)return;
  document.querySelector('.util.chest')?.classList.remove('binning');
  if(DR.off){
    DR.ghost.remove();
    S.tray=S.tray.filter(x=>x!==DR.id);
    if(S.tool===DR.id)S.tool=S.tray[1]||S.tray[0];
    paintRail();if(S.open==='chest')paintChest();
    DR=null;return;
  }
  DR.ghost.remove();
  const b=document.querySelector(`.t[data-t="${DR.id}"]`);
  if(b){b.classList.remove('lift');b.animate(
    [{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.32,.72,0,1)'})}
  DR=null;
}));


/* ── pick a tool up in the chest and drop it on the bar ────────────── */
let CD=null, cTimer=null;
document.getElementById('chest').addEventListener('pointerdown',e=>{
  const src=e.target.closest('[data-add]')||e.target.closest('.li[data-id]');
  if(!src)return;
  const id=src.dataset.add||src.dataset.id;
  cTimer=setTimeout(()=>{
    const g=document.createElement('div');
    g.className='ghost-t';
    g.innerHTML=icon(id==='hand'?'cur':id,colOf(T(id)),22);
    g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';
    document.body.appendChild(g);
    CD={id,ghost:g,had:S.tray.includes(id)};
    if(navigator.vibrate)navigator.vibrate(8);
  },380);
});
addEventListener('pointermove',e=>{
  if(cTimer&&!CD){clearTimeout(cTimer);cTimer=null}
  if(!CD)return;
  e.preventDefault();
  CD.ghost.style.left=e.clientX+'px';CD.ghost.style.top=e.clientY+'px';
  const rr=$('#rail').getBoundingClientRect();
  CD.over = e.clientX>rr.left-26&&e.clientX<rr.right+26&&
            e.clientY>rr.top-26&&e.clientY<rr.bottom+26;
  $('#rail').style.boxShadow = CD.over
    ? '0 0 0 2px var(--lv), 0 20px 48px rgba(0,0,0,.5)' : '';
});
['pointerup','pointercancel'].forEach(v=>addEventListener(v,()=>{
  clearTimeout(cTimer);cTimer=null;
  if(!CD)return;
  CD.ghost.remove(); $('#rail').style.boxShadow='';
  if(CD.over&&!CD.had&&S.tray.length<CAP){
    S.tray.push(CD.id);S.tool=CD.id;paintRail();paintChest();
    const nb=document.querySelector(`.t[data-t="${CD.id}"]`);nb&&play(nb.querySelector('svg'));
  }
  CD=null;
}));

/* long-press a preset to save */
let lp,lpEl;
document.addEventListener('pointerdown',e=>{
  const pr=e.target.closest('.pr');if(!pr)return;
  lpEl=pr;lp=setTimeout(()=>{
    const t=T(S.tool),i=+pr.dataset.pr;
    S.presets[t.id]=S.presets[t.id]||[null,null,null];
    S.presets[t.id][i]={k:S.colour[t.id]||'y',size:S.size[t.id],op:S.op[t.id]};
    paintProps();paintRail();
    const el=document.querySelector(`.pr[data-pr="${i}"]`);
    if(el){el.classList.add('saving');setTimeout(()=>el.classList.remove('saving'),520)}
    lpEl=null;
  },520);
});
['pointerup','pointercancel','pointerleave'].forEach(v=>
  document.addEventListener(v,()=>{clearTimeout(lp)}));

document.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){closeAll();return}

  /* demo theme */
  const d=e.target.closest('#demo button');
  if(d){R.dataset.look=d.dataset.look;$$('#demo button[data-look]').forEach(b=>b.classList.toggle('on',b===d));
    paintRail();if(S.open)({props:paintProps,chest:paintChest,cgrid:paintGrid})[S.open]();return}

  /* variant */
  const sg=e.target.closest('[data-straight]');
  if(sg){const id=sg.dataset.straight;S.straight[id]=!S.straight[id];paintProps();return}
  const v=e.target.closest('[data-v]');
  if(v){S.variant[S.tool]=+v.dataset.v;paintProps();reanchor();paintRail();mode();return}

  /* colour from the five */
  const c=e.target.closest('.c[data-k]');
  if(c){S.colour[S.tool]=c.dataset.k;paintProps();paintRail();return}

  /* colour from recents or the grid */
  const ch=e.target.closest('[data-hex]');
  if(ch){const hex=ch.dataset.hex;
    if(!COL.find(x=>x.hex===hex)){S.recent=[hex,...S.recent.filter(x=>x!==hex)].slice(0,6)}
    S.colour[S.tool]=hex;
    /* store raw hex by faking a colour entry */
    COL.custom=hex;
    S.colourHex=S.colourHex||{};S.colourHex[S.tool]=hex;
    paintProps();paintRail();
    if(S.open==='cgrid'){const el=document.querySelector('.t.on');openPo('props',el)}
    return}

  /* open the colour grid */
  if(e.target.closest('[data-grid]')){const el=document.querySelector('.t.on');openPo('cgrid',el);return}

  /* load a preset */
  const pr=e.target.closest('.pr');
  if(pr&&!lpEl){const t=T(S.tool),p=(S.presets[t.id]||[])[+pr.dataset.pr];
    if(p){S.colour[t.id]=p.k;S.size[t.id]=p.size;S.op[t.id]=p.op;paintProps();paintRail()}
    return}

  /* chest */
  const rm=e.target.closest('[data-rm]');
  if(rm){S.tray=S.tray.filter(x=>x!==rm.dataset.rm);
    if(S.tool===rm.dataset.rm)S.tool=S.tray[1]||S.tray[0];
    paintRail();paintChest();reanchor();return}
  const pos=e.target.closest('[data-pos]');
  if(pos){S.bar=pos.dataset.pos;R.dataset.bar=S.bar;paintChest();
    requestAnimationFrame(()=>reanchor());return}
  if(e.target.closest('[data-reset]')){S.tray=[...DEF];S.tool='hl';paintRail();paintChest();return}

  /* add */
  const g=e.target.closest('[data-g]');
  if(g){S.gtab=g.dataset.g;paintChest();reanchor();return}
  const ad=e.target.closest('[data-add]');
  if(ad){const id=ad.dataset.add;
    if(S.tray.includes(id)||S.tray.length>=CAP)return;
    S.tray.push(id);S.tray.sort((a,b)=>TOOLS.findIndex(t=>t.id===a)-TOOLS.findIndex(t=>t.id===b));
    S.tool=id;paintRail();paintChest();
    const nb=document.querySelector(`.t[data-t="${id}"]`);nb&&play(nb.querySelector('svg'));
    return}

  /* outside click closes */
  if(!e.target.closest('.po')&&!e.target.closest('.rail'))closeAll();
});

/* sliders */
document.addEventListener('input',e=>{
  if(e.target.id==='szr'){S.size[S.tool]=+e.target.value;
    const l=$('#propsIn').querySelectorAll('.lab .v');if(l[0])l[0].textContent=e.target.value+' pt';drawPrev()}
  if(e.target.id==='opr'){S.op[S.tool]=+e.target.value;
    const l=$('#propsIn').querySelectorAll('.lab .v');if(l[1])l[1].textContent=e.target.value+'%';drawPrev()}
});

/* drag to reorder in the chest */
let dg=null;
document.addEventListener('dragstart',e=>{const li=e.target.closest('.li');if(!li)return;
  dg=li.dataset.id;li.classList.add('drag')});
document.addEventListener('dragover',e=>{if(dg)e.preventDefault()});
document.addEventListener('drop',e=>{const li=e.target.closest('.li');if(!li||!dg)return;
  e.preventDefault();
  const from=S.tray.indexOf(dg),to=S.tray.indexOf(li.dataset.id);
  if(from<0||to<0||from===to){dg=null;return}
  S.tray.splice(to,0,S.tray.splice(from,1)[0]);dg=null;paintRail();paintChest()});
document.addEventListener('dragend',()=>{dg=null;$$('.li').forEach(l=>l.classList.remove('drag'))});

/* tooltips on the rail */
const tip=$('#tip');let th;
$('#rail').addEventListener('mouseover',e=>{
  const b=e.target.closest('.t,.util');if(!b)return;
  clearTimeout(th);th=setTimeout(()=>{
    const t=T(b.dataset.t);
    tip.innerHTML=t?`${t.n}<kbd>${t.k}</kbd>`
      :({chest:'Your bar',add:'Add a tool',hide:'Hide the tools'})[b.dataset.u];
    tip.classList.add('on');
    const r=b.getBoundingClientRect(),w=tip.offsetWidth;
    if(S.bar==='left'){tip.style.left=(r.right+12)+'px';tip.style.right=''}
    else if(S.bar==='right'){tip.style.right=(innerWidth-r.left+12)+'px';tip.style.left=''}
    else{tip.style.left=Math.max(10,r.left+r.width/2-w/2)+'px';tip.style.right=''}
    tip.style.top=(S.bar==='top'?r.bottom+10:S.bar==='bottom'?r.top-34:r.top+r.height/2-14)+'px';
  },380)});
$('#rail').addEventListener('mouseout',()=>{clearTimeout(th);tip.classList.remove('on')});

addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeAll();return}
  const t=TOOLS.find(x=>x.k.toLowerCase()===e.key.toLowerCase());
  if(t&&S.tray.includes(t.id)){S.tool=t.id;closeAll();paintRail();
    const nb=document.querySelector(`.t[data-t="${t.id}"]`);nb&&play(nb.querySelector('svg'))}
});
addEventListener('resize',reanchor);

paintRail();
setTimeout(()=>{const b=document.querySelector('.t.on');b&&play(b.querySelector('svg'))},500);

/* ══ what the class has already marked on this paper ═════════════════ */
/* HANDOVER section 5: SEED was here. The class's marks are fetched by
   marks.js and pushed through WM.add, and laid out by relayout(). */

function findRange(pg,quote){
  const walk=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT);
  let n;while((n=walk.nextNode())){
    const i=n.nodeValue.indexOf(quote);
    if(i>=0){const r=document.createRange();
      r.setStart(n,i);r.setEnd(n,i+quote.length);return r}
  }
  return null;
}
/* seed() was here. What it did — find the quote, lay one box per line of the
   resulting Range — is what relayout() in marks.js does for every mark, from
   a stored text anchor rather than a hard-coded string, on every layout
   change rather than once at load. */

/* ══ the pill: what you can do with a selection, or with a mark ══════ */
const SELP=$('#selp'), SELSW=$('#selsw'), SELCOLS=$('#selcols'), STG=$('#stage');
let lastK='y', savedRange=null, picked=null;   /* picked = an existing mark */

function paintSel(){
  SELP.style.setProperty('--k',resolve(lastK));
  SELP.dataset.del = picked ? '1' : '0';
  SELCOLS.innerHTML=COL.map(c=>
    `<button class="${c.k===lastK?'on':''}" data-sk="${c.k}" style="--pk:${c.hex}" title="${c.n}"></button>`).join('');
}
function hideSel(){
  SELP.classList.remove('on');SELP.dataset.cols='0';SELP.dataset.del='0';
  savedRange=null;
  if(picked){picked.forEach(q=>q.classList.remove('sel'));picked=null}
}
function place(box){
  const w=SELP.offsetWidth,h=SELP.offsetHeight;
  SELP.style.left=Math.min(innerWidth-w/2-12,Math.max(w/2+12,box.left+box.width/2))+'px';
  SELP.style.top =Math.max(58,box.top-h-12)+'px';
}
function showSel(){
  if(picked)return;                                  /* a mark is in hand */
  if(R.dataset.sel!=='1')return hideSel();           /* only the cursor selects */
  const sel=getSelection();
  if(!sel||sel.isCollapsed||!sel.rangeCount)return hideSel();
  const r=sel.getRangeAt(0);
  if(String(r).trim().length<3)return hideSel();
  const host=(r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer
             :r.commonAncestorContainer.parentElement);
  if(!host||!host.closest('.sheetpg'))return hideSel();
  if(picked){picked.forEach(q=>q.classList.remove('sel'));picked=null}
  savedRange=r.cloneRange();
  paintSel();SELP.classList.add('on');place(r.getBoundingClientRect());
}
STG.addEventListener('mouseup',()=>setTimeout(showSel,0));
STG.addEventListener('touchend',()=>setTimeout(showSel,0));
document.addEventListener('selectionchange',()=>{
  const sel=getSelection();
  if((!sel||sel.isCollapsed)&&!picked)hideSel();
});

/* one box per line of the selection — this is what keeps marks on the words */
let markSeq=0;
function stamp(kind){
  if(!savedRange)return;
  const host=(savedRange.commonAncestorContainer.nodeType===1?savedRange.commonAncestorContainer
             :savedRange.commonAncestorContainer.parentElement);
  const pg=host.closest('.sheetpg'); if(!pg)return;
  const layer=pg.querySelector('.marks'), pr=pg.getBoundingClientRect();
  const hex = kind==='ask' ? col('p').hex : resolve(lastK);
  const gid='m'+(++markSeq);
  [...savedRange.getClientRects()].forEach(q=>{
    if(q.width<1.5||q.height<1)return;
    const d=document.createElement('span');
    d.className='mkq '+kind;
    d.dataset.g=gid; d.dataset.kind=kind; d.dataset.k=kind==='ask'?'p':lastK;
    d.style.cssText=`left:${q.left-pr.left}px;top:${q.top-pr.top}px;`+
                    `width:${q.width}px;height:${q.height}px;--k:${hex}`;
    layer.appendChild(d);
  });
  const made={id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:kind==='ask'?'':undefined,ans:kind==='ask'?[]:undefined};
  WM.add(made);
  ctx.onMade(made,savedRange,pg);
  getSelection().removeAllRanges();
  hideSel();
}
/* the panel asks for this when you tap one of its cards */
window.readerGoTo=(pgn,gid)=>{
  const el=STG.querySelector(`.sheetpg[data-pg="${pgn}"]`); if(!el)return;
  STG.scrollTo({top:el.offsetTop-74,behavior:'smooth'});
  if(!gid)return;
  setTimeout(()=>{
    document.querySelectorAll(`.mkq[data-g="${gid}"]`).forEach(q=>{
      q.classList.remove('ping');void q.offsetWidth;q.classList.add('ping');
      setTimeout(()=>q.classList.remove('ping'),1500)});
  },420);
};
/* tapping a mark gives you the same choices, plus a way to remove it */
/* the text sits above the marks so it stays crisp, so find the mark by hand */
function markAt(x,y){
  const pg=document.elementFromPoint(x,y)?.closest('.sheetpg'); if(!pg)return null;
  const qs=[...pg.querySelectorAll('.mkq')];
  for(let i=qs.length-1;i>=0;i--){const r=qs[i].getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return qs[i]}
  return null;
}
STG.addEventListener('click',e=>{
  if(R.dataset.sel!=='1')return;
  const q=markAt(e.clientX,e.clientY); if(!q)return;
  const group=[...document.querySelectorAll(`.mkq[data-g="${q.dataset.g}"]`)];
  if(picked)picked.forEach(x=>x.classList.remove('sel'));
  picked=group; group.forEach(x=>x.classList.add('sel'));
  savedRange=null;
  if(q.dataset.k&&q.dataset.k!=='p')lastK=q.dataset.k;
  paintSel();SELP.classList.add('on');
  const r=group[0].getBoundingClientRect();
  const last=group[group.length-1].getBoundingClientRect();
  place({left:Math.min(r.left,last.left),width:Math.max(r.right,last.right)-Math.min(r.left,last.left),top:r.top});
});
function recolour(){
  if(!picked)return;
  const hex=resolve(lastK);
  picked.forEach(q=>{if(q.dataset.kind!=='ask'){q.dataset.k=lastK;q.style.setProperty('--k',hex)}});
}
function convert(kind){
  if(!picked)return;
  picked.forEach(q=>{q.className='mkq '+kind+' sel';q.dataset.kind=kind;
    if(kind==='ask'){q.dataset.k='p';q.style.setProperty('--k',col('p').hex)}});
}
/* pressing the pill must not collapse the selection under it */
SELP.addEventListener('pointerdown',e=>e.preventDefault());
SELP.addEventListener('mousedown',e=>e.preventDefault());
SELP.addEventListener('click',e=>{
  if(e.target.closest('#selsw')){
    SELP.dataset.cols = SELP.dataset.cols==='1'?'0':'1';
    const b=picked?picked[0].getBoundingClientRect():savedRange&&savedRange.getBoundingClientRect();
    if(b)requestAnimationFrame(()=>place(b));
    return}
  const sk=e.target.closest('[data-sk]');
  if(sk){lastK=sk.dataset.sk;
    const t=T(S.tool);
    if(t&&!t.fixed&&!t.grey){S.colour[t.id]=lastK;paintRail();mode();ctx.onSettings(S)}
    if(picked)ctx.onRecoloured(picked[0].dataset.g,lastK);
    recolour();paintSel();return}
  if(e.target.closest('[data-rmv]')){
    if(picked){const g=picked[0].dataset.g;WM.drop(g);ctx.onDropped(g);
               picked.forEach(q=>q.remove());picked=null}
    hideSel();return}
  const a=e.target.closest('[data-act]'); if(!a)return;
  const k=a.dataset.act;
  if(picked){const g=picked[0].dataset.g;convert(k);ctx.onConverted(g,k,k==='ask'?'p':lastK);
             window.islandSay&&window.islandSay(k==='ask'?'askq':'mark',900,k==='ask'?'p':lastK);
             hideSel();return}
  stamp(k);
  if(k==='ask')window.islandSay&&window.islandSay('askq',1400);
  else window.islandSay&&window.islandSay(lastK==='r'?'revise':'mark',null,lastK);
});
/* the tool's colour and the pill's colour are the same last-used colour */
function syncK(){const t=T(S.tool);
  if(t&&!t.fixed&&!t.grey&&typeof S.colour[t.id]==='string'&&S.colour[t.id].length<=2)
    lastK=S.colour[t.id];}
$('#rail').addEventListener('click',()=>setTimeout(syncK,0));
document.getElementById('props').addEventListener('click',()=>setTimeout(()=>{syncK();paintCursor()},0));

/* ══ pen, marker and highlighter draw. They never touch the text. ════ */
let pan=null, ink=null;
function pgAt(e){return document.elementFromPoint(e.clientX,e.clientY)?.closest('.sheetpg')}
function pt(e,pg){const r=pg.getBoundingClientRect();
  return [(e.clientX-r.left)/r.width*1000,(e.clientY-r.top)/r.height*1000]}
STG.addEventListener('pointerdown',e=>{
  if(R.dataset.grab==='1'){
    pan={y:e.clientY,top:STG.scrollTop};STG.setPointerCapture(e.pointerId);return}
  if(R.dataset.draw!=='1')return;
  const pg=pgAt(e); if(!pg)return;
  e.preventDefault();
  const t=T(S.tool), c=colOf(t), r=pg.getBoundingClientRect();
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  const wide=t.id==='hl'?S.size[t.id]*1.9:S.size[t.id];
  path.setAttribute('stroke',c);
  path.setAttribute('stroke-width',wide/r.width*1000);
  path.setAttribute('stroke-opacity',(S.op[t.id]||100)/100);
  const chisel = t.id==='hl' && (S.variant.hl||0)===0;
  if(t.id==='hl')path.setAttribute('stroke-linecap',chisel?'butt':'round');
  pg.querySelector('.ink').appendChild(path);
  ink={path,pg,pts:[pt(e,pg)],straight: chisel || (t.id!=='hl' && !!S.straight[t.id])};
  STG.setPointerCapture(e.pointerId);
});
STG.addEventListener('pointermove',e=>{
  if(pan){STG.scrollTop=pan.top-(e.clientY-pan.y);return}
  if(!ink)return;
  const p=pt(e,ink.pg);
  if(ink.straight){ink.pts=[ink.pts[0],p]}
  else{const l=ink.pts[ink.pts.length-1];
       if(Math.hypot(p[0]-l[0],p[1]-l[1])<2)return; ink.pts.push(p)}
  ink.path.setAttribute('d',smooth(ink.pts));
});
addEventListener('pointerup',()=>{
  pan=null;
  if(ink){
    if(ink.pts.length<2)ink.path.remove();
    else ctx.onStroke(ink.pg,ink.path,ink.pts,T(S.tool),S);
    ink=null;
  }
});
/* a light smoothing so a mouse-drawn line does not look like a saw */
/* What the rest of the reader needs from the tool bar. relayout() in
   marks.js rebuilds the quads on a page from stored anchors, so it needs the
   colours, and it needs to know when a mark is in hand: rebuilding the quads
   under an open pill would leave the picked group holding elements that are no
   longer on the page. */
ctx.expose({
  findRange,                       /* HANDOVER section 5: keep this */
  col, resolve, COL,
  settings:()=>S,
  markAt,
  busy:()=>!!picked,
});
function smooth(p){
  if(p.length<3)return `M${p[0][0]} ${p[0][1]}L${p[p.length-1][0]} ${p[p.length-1][1]}`;
  let d=`M${p[0][0]} ${p[0][1]}`;
  for(let i=1;i<p.length-1;i++){
    const mx=(p[i][0]+p[i+1][0])/2, my=(p[i][1]+p[i+1][1])/2;
    d+=`Q${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }
  return d+`L${p[p.length-1][0]} ${p[p.length-1][1]}`;
}
}
