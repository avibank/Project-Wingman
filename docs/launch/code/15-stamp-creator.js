/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 991-1052).
   The one-time stamp creator: openMaker, paintStudio and the Shape / Rim / Pattern / Ink
   tabs. The code is chosen HERE. There is no separate "YOUR CODE" box.
   Shapes lay out four up, four down (.srow.shp); patterns three up, three down
   (.srow.pat3). The code placeholder is WNG. */

let tab='shape';
function openMaker(){draft={shape:'seal',code:'',sym:null,ring:'',rim:true,pattern:'none',pscope:'both',ink:PALETTE[1],pink:null,cink:null,seed:7,cmode:'code'};confirming=false;tab='shape';paintStudio(true);$('#scrim').classList.add('open')}
const SYMN={plane:'Plane',wrench:'Spanner',prop:'Propeller'};
function paintStudio(anim){
  const d=draft,L=LIVERIES[ME.livery];
  const TABS={shape:'Shape',ring:'Rim',pat:'Pattern',ink:'Ink'};if(tab==='mark')tab='shape';
  let body='';
  if(tab==='shape')body=`<div class="srow shp">${Object.keys(SHAPES).map(k=>`<button class="stile ${d.shape===k?'on':''}" data-shape="${k}" aria-label="${k}">${inspStamp(false,46,0,{shape:k,code:'',sym:null,ring:'',rim:false,band:false,pattern:'none'})}</button>`).join('')}</div>`;
  if(tab==='mark')body=`<div class="seg2"><button class="${d.cmode==='code'?'on':''}" data-cmode="code">Code</button><button class="${d.cmode==='sym'?'on':''}" data-cmode="sym">Symbol</button></div>
     ${d.cmode==='code'?`<input class="sin" id="sCode" maxlength="3" value="${d.code}" placeholder="Up to 3 letters or numbers" autocomplete="off">`
       :`<div class="srow">${SYMS.map(k=>`<button class="stile ${d.sym===k?'on':''}" data-sym="${k}" aria-label="${SYMN[k]}" title="${SYMN[k]}"><svg width="30" height="30" viewBox="9 9 22 22" fill="currentColor" stroke="currentColor">${MARKS[k]}</svg></button>`).join('')}</div>`}`;
  if(tab==='ring')body=`<div class="tgl"><span>Rim text</span><button class="sw2" id="rimT" role="switch" aria-checked="${d.rim!==false}" aria-label="Rim text"></button></div>
     ${d.rim!==false?`<input class="sin" id="sRing" maxlength="10" value="${d.ring}" placeholder="WINGMAN" autocomplete="off"><p class="snote" style="margin:0">Motto runs along the bottom</p>`:`<p class="snote" style="margin:0">Your pattern fills the ring</p>`}`;
  if(tab==='pat')body=`<div class="srow pat3">${Object.entries(PATTERNS).map(([k,n])=>`<button class="stile wide pt ${d.pattern===k?'on':''}" data-pat="${k}"><svg width="40" height="40" viewBox="3 3 34 34" fill="none" stroke="currentColor">${k==='none'?'':ringPattern(k,{type:'circle',ri:8,ro:15.5})}<circle cx="20" cy="20" r="7.6" stroke-width=".7"/><circle cx="20" cy="20" r="16" stroke-width=".9"/></svg><small>${n}</small></button>`).join('')}</div>
     ${d.pattern!=='none'?`<div class="seg2"><button class="${(d.pscope||'both')==='both'?'on':''}" data-scope="both">Both</button><button class="${d.pscope==='centre'?'on':''}" data-scope="centre">Centre</button><button class="${d.pscope==='rim'?'on':''}" data-scope="rim">Rim</button></div>
     <p class="lab" style="margin:14px 0 6px;align-self:stretch">Pattern colour</p>
     <button class="schip ${d.pink?'':'on'}" id="pinkSame" style="${d.pink?'':'box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--t1)'}">Same as the ink</button>
     ${colourGrid(d.pink,'data-pink')}`:''}`;
  if(tab==='ink')body=`<p class="lab" style="margin:0 0 6px;align-self:stretch">Stamp ink</p>${colourGrid(d.ink,'data-ink')}
     <p class="lab" style="margin:16px 0 6px;align-self:stretch">The code</p>
     <button class="schip ${d.cink?'':'on'}" id="cinkSame" style="${d.cink?'':'box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--t1)'}">Same as the ink</button>
     ${colourGrid(d.cink,'data-cink')}`;
  $('#sheet').innerHTML=`<div class="studio" style="--accent:${lc(L,.68,1.1)};--accent-soft:${lc(L,.68,1.1,.14)}">
   <div class="shead"><h3>Your stamp</h3><button class="x2" id="closeS" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div class="spaper"><span class="big ${anim?'go':''}">${inspStamp(true,196,-5,d)}</span><button class="dice" id="shuffle" title="Surprise me" aria-label="Shuffle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg></button></div>
   <div class="crow"><input class="cin ${d.sym?'':'on'}" id="sCode" maxlength="3" value="${d.sym?'':d.code}" placeholder="WNG" autocomplete="off" aria-label="Your 3-character code"></div>
   ${(()=>{const st=codeState(d.code);return `<p class="cstat is-${st.k}" id="cStat">${st.msg}${st.alts&&st.alts.length?` <span class="calts">Free: ${st.alts.map(a=>`<button data-alt="${a}">${a}</button>`).join('')}</span>`:''}</p>`})()}
   <div class="stabs" role="tablist">${Object.entries(TABS).map(([k,n])=>`<button role="tab" aria-selected="${tab===k}" data-tab="${k}">${n}</button>`).join('')}</div>
   <div class="sbody">${body}</div>
   <div class="sfoot">${confirming?`<p>It can't be changed after this.</p><div class="sbtns"><button class="pill" id="back2">Keep editing</button><button class="pill pri" id="doIssue">Issue it</button></div>`
     :`<button class="pill pri issueb" id="issue">Issue my stamp</button>`}</div></div>`;
  const set=(k,v)=>{draft[k]=v;confirming=false;paintStudio(true)};
  $$('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;paintStudio(false)});
  $$('[data-shape]').forEach(b=>b.onclick=()=>set('shape',b.dataset.shape));
  $$('[data-sym]').forEach(b=>b.onclick=()=>{const v=draft.sym===b.dataset.sym?null:b.dataset.sym;draft.cmode=v?'sym':'code';set('sym',v)});
  $$('[data-cmode]').forEach(b=>b.onclick=()=>{draft.cmode=b.dataset.cmode;if(draft.cmode==='code')draft.sym=null;else if(!draft.sym)draft.sym='plane';set('cmode',draft.cmode)});
  $$('[data-pat]').forEach(b=>b.onclick=()=>set('pattern',b.dataset.pat));
  $$('[data-scope]').forEach(b=>b.onclick=()=>set('pscope',b.dataset.scope));
  $$('[data-pink]').forEach(b=>b.onclick=()=>set('pink',PALETTE[+b.dataset.pink]));
  $$('[data-cink]').forEach(b=>b.onclick=()=>set('cink',PALETTE[+b.dataset.cink]));
  if($('#cinkSame'))$('#cinkSame').onclick=()=>set('cink',null);
  if($('#pinkSame'))$('#pinkSame').onclick=()=>set('pink',null);
  $$('[data-band]').forEach(b=>b.onclick=()=>set('band',b.dataset.band));
  if($('#rimT'))$('#rimT').onclick=()=>set('rim',draft.rim===false);
  $$('[data-font]').forEach(b=>b.onclick=()=>set('font',b.dataset.font));
  $$('[data-ink]').forEach(b=>b.onclick=()=>set('ink',PALETTE[+b.dataset.ink]));
  const redraw=()=>{$('.spaper .big').className='big';$('.spaper .big').innerHTML=inspStamp(true,196,-5,draft)};
  if($('#sCode')){$('#sCode').onfocus=()=>{if(draft.sym){draft.sym=null;draft.cmode='code';$$('.csym').forEach(b=>b.classList.remove('on'));$('#sCode').classList.add('on');redraw()}};$('#sCode').oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');draft.code=e.target.value;draft.sym=null;draft.cmode='code';redraw();
    const st=codeState(draft.code),el=$('#cStat');
    if(el){el.className='cstat is-'+st.k;
      el.innerHTML=st.msg+(st.alts&&st.alts.length?` <span class="calts">Free: ${st.alts.map(a=>`<button data-alt="${a}">${a}</button>`).join('')}</span>`:'');
      $$('[data-alt]').forEach(b=>b.onclick=()=>{draft.code=b.dataset.alt;paintStudio(false)})}}}
  $('#shuffle').onclick=()=>{const pick=a=>a[Math.floor(Math.random()*a.length)];draft.shape=pick(Object.keys(SHAPES));draft.pattern=pick(Object.keys(PATTERNS));draft.pscope=pick(['both','centre','rim']);draft.ink=pick(PALETTE);draft.pink=Math.random()>.5?pick(PALETTE):null;draft.cink=Math.random()>.6?pick(PALETTE):null;draft.rim=Math.random()>.35;draft.seed=1+Math.floor(Math.random()*40);confirming=false;paintStudio(true)};
  if($('#sRing')){$('#sRing').oninput=e=>{e.target.value=e.target.value.replace(/[^A-Za-z0-9 ]/g,'');draft.ring=e.target.value;redraw()}}
  $('#closeS').onclick=closeV;
  if(confirming){$('#back2').onclick=()=>{confirming=false;paintStudio(false)};
    $('#doIssue').onclick=()=>{MYSTAMP={...draft,mods:ME.mods};CODES_TAKEN.add((draft.code||'').toUpperCase());ISSUED='20 Sep 2026';closeV();setTimeout(()=>{paintCard(true);toast(`Stamp issued — ${draft.code} is yours`)},250)}}
  else $('#issue').onclick=()=>{const st=codeState(draft.code);
    if(st.k!=='free'){$('#sCode')&&$('#sCode').focus();toast(st.k==='taken'?st.msg:'Pick your three-character code first');return}
    confirming=true;paintStudio(false)};
  $$('[data-alt]').forEach(b=>b.onclick=()=>{draft.code=b.dataset.alt;paintStudio(false)});
}
