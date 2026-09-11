/* ===========================================================================
   WINGMAN — PAPERS READER
   reader.js · four parts, in this order. Copy verbatim.

     1  WM        the one list of marks every zone reads and writes
     2  island    the top bar: counter, messages, page tray, you
     3  toolbar   the left bar: tools, popouts, drawing, the selection pill
     4  panel     the side panel: search, marks browser, page selector

   Each part is its own closure and they speak only through:
     WM.add / WM.drop / WM.on      the shared mark list
     window.islandSay(name,ms,k)   the toolbar telling the island something landed
     window.readerGoTo(page,gid)   the panel asking the paper to scroll and flash
     window.setBarAutoHide(bool)   demo only

   WHAT YOU REPLACE — and nothing else:
     · STAGE.innerHTML = PAGES.map(...)   the fake paper. This becomes the
       PDF.js page container. Every page element must keep:
          class="sheetpg"  data-pg="<absolute page number>"
          <span class="bmk"></span>          the bookmark ribbon
          <svg class="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>
          <span class="marks"></span>        the mark quads
       and the PDF.js text layer must sit above .marks (z-index 2) so the words
       stay crisp and selectable.
     · SEED[]  the class's marks. This becomes the fetch of the module's marks.
     · The demo strip listener at the bottom of part 2.

   WHAT YOU MUST NOT CHANGE:
     · the icon() function — those are the drawn icons, there are no image files
     · the easing curves, the timings, the sizes
     · the quad-box marking. A mark is one absolutely-placed box per line of the
       selection. It is never a wrapping <span> around the text.
   =========================================================================== */


/* ─── 1 · WM — the shared list ─────────────────────────────────────── */

/* the one list every zone reads and writes */
window.WM={marks:[],subs:[],seq:0,
  add(m){m.id=m.id||('m'+(++this.seq));this.marks.push(m);this.emit();return m.id},
  drop(id){this.marks=this.marks.filter(x=>x.g!==id&&x.id!==id);this.emit()},
  on(f){this.subs.push(f)},emit(){this.subs.forEach(f=>{try{f()}catch(e){}})}};

/* ─── 2 · the island ──────────────────────────────────────────────── */

(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),ISL=$('#isl'),CNT=$('#cnt'),DOT=$('#dot'),MSG=$('#msg'),
      TRAY=$('#tray'),SIZER=$('#sizer'),STAGE=$('#stage'),BACKP=$('#backp'),BACKL=$('#backl');

const DOC='LTT B1-11', TOTAL=1012, FIRST=126;
const K={y:'#F5C23C',b:'#5BB4F0',g:'#43C08A',p:'#B571E0',r:'#EE6F82'};
let page=FIRST, zoom=100, fit=true, rot=0, warm=0, livery='#4C8DF6',
    cur=null, holdT=null, pending=false, open=null, jumpFrom=null,
    bookmarks=new Set([129]);
const pad=(n,t)=>String(n).padStart(String(t).length,'0');

/* ── the paper ─────────────────────────────────────────────────────── */
const PAGES=[
 ['Autorotation',[
   `In powered flight the engine supplies the torque that overcomes rotor drag and holds the rotor at its governed speed.`,
   `If the engine fails, or a drive shaft shears, another force has to keep the rotor turning if the aircraft is to reach the ground under control.`,
   `During descent, air flows upward through the main rotor disc instead of downward. That airflow drives the blades and replaces the lost engine torque.`]],
 ['Rotor RPM and the flare',[
   `Rotor RPM is the single most important parameter in an autorotation. It must stay inside limits throughout.`,
   `Too low and the blades stall, too high and they are overspeeded beyond structural limits.`,
   `Close to the ground the pilot spends the stored energy to cushion the touchdown.`]],
 ['Height–velocity limits',[
   `The avoid areas are published in the flight manual and are specific to weight and density altitude.`,
   `Low height with low airspeed leaves neither the time to establish autorotative flight nor the energy to flare.`,
   `Between those regions lies the corridor in which an engine failure can be flown to a survivable landing.`]],
 ['Entry and rotor inertia',[
   `Delay in lowering the collective is the most common cause of an unrecoverable rotor decay.`,
   `Rotor inertia is the rotor's stored rotational energy for a given RPM. A heavy, high-inertia rotor is forgiving.`,
   `Entry technique is drilled until it is reflex: lower the collective without delay, set the attitude, and centre the aircraft.`]],
 ['The flare and touchdown',[
   `The flare reduces both rate of descent and forward speed before the collective is raised.`,
   `Raising the collective too early spends the rotor energy above the ground and leaves nothing for the landing.`,
   `Touchdown attitude is level or very slightly nose-up, with the aircraft in balance.`]],
 ['Practice autorotations',[
   `A power recovery is flown to a hover rather than to the ground.`,
   `The instructor sets the entry point so that the corridor is reached before the avoid area is entered.`,
   `Rotor RPM is monitored throughout and corrected with collective, not with cyclic.`]],
 ['Engine-off landings',[
   `Engine-off landings are flown only on suitable surfaces and only when the type permits.`,
   `A run-on landing carries forward speed through the touchdown.`,
   `Ground resonance is a risk on a run-on landing with a badly rigged undercarriage.`]],
 ['Tail rotor drive failures',[
   `A tail rotor drive failure removes yaw control and the aircraft will yaw with torque.`,
   `Entering autorotation removes the torque, and with it most of the yaw.`,
   `The recovery is an autorotation to a run-on landing wherever the surface allows.`]],
 ['Loss of tail rotor effectiveness',[
   `Loss of tail rotor effectiveness is an aerodynamic condition, not a mechanical failure.`,
   `It is most likely at low speed, high power and with wind from the left on a counter-clockwise rotor.`,
   `Recovery is forward cyclic to gain airspeed and reduced power if height allows.`]],
 ['Rotor brake and shutdown',[
   `The rotor brake is applied only below the RPM given in the flight manual.`,
   `Applying it above that figure overheats the disc and can distort it.`,
   `The blades are tied down when the wind exceeds the limit for an unattended rotor.`]]];
STAGE.innerHTML=PAGES.map(([h,ps],i)=>`<article class="sheetpg" data-pg="${FIRST+i}">
  <span class="bmk"></span><svg class="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg><span class="marks"></span><h3>${h.toUpperCase()}</h3>
  ${ps.map(p=>`<p>${p}</p>`).join('')}
  <span class="pgno">${pad(FIRST+i,TOTAL)}</span></article>`).join('');

/* your last five places — page, its mark colour, and the line you marked */
const RECENT=[
 [131,'g','The avoid areas are published in the flight manual.'],
 [129,'y','Delay in lowering the collective is the most common cause of decay.'],
 [134,'p','Does the drive shaft shear before or after the freewheel unit?'],
 [128,'b','Rotor RPM is the single most important parameter.'],
 [132,'r','Come back to this — the flare timing still is not sticking.']];

function paintCounter(first){
  const now=pad(page,TOTAL);
  const box=CNT.querySelector('.now');
  if(!box||first){
    CNT.innerHTML=`<span class="now">${[...now].map(d=>`<span class="d"><i>${d}</i></span>`).join('')}</span>`+
                  `<span class="sl">/</span><span class="tot">${TOTAL}</span>`;
    return;
  }
  [...box.children].forEach((cell,i)=>{
    const want=now[i],have=cell.querySelector('i').textContent;
    if(want===have)return;
    cell.querySelector('i').textContent=want;
    cell.classList.remove('roll');void cell.offsetWidth;cell.classList.add('roll');
  });
}

const ico={
 undo:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 17a7.4 7.4 0 00-7.4-7.4H4.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 4.6L4 9.6l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 redo:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 17a7.4 7.4 0 017.4-7.4h7.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 4.6l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 dl:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 4v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 10.4l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.6 19.6h14.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
 rl:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4.6 9.2A8.2 8.2 0 1112 20.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.8 4.4L4.4 9.4l5 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 rr:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M19.4 9.2A8.2 8.2 0 1012 20.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.2 4.4l4.4 5-5 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 bm:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6.6 3.8h10.8v16.4L12 16.4l-5.4 3.8z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
 eye:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M2.4 12S6.2 5.6 12 5.6 21.6 12 21.6 12 17.8 18.4 12 18.4 2.4 12 2.4 12z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.7" stroke="currentColor" stroke-width="1.7"/></svg>`,
 rrm:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4.4 5.6h15.2v10.2H12l-4.6 3.4v-3.4H4.4z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9" cy="10.6" r="1.15" fill="currentColor"/><circle cx="12.6" cy="10.6" r="1.15" fill="currentColor"/><circle cx="16.2" cy="10.6" r="1.15" fill="currentColor"/></svg>`,
 ch:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9.4 5.4L16 12l-6.6 6.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`};

/* ── the messages ──────────────────────────────────────────────────── */
const S={
 mark   :()=>`<span class="led" style="--k:${K[MARKK]||K.y}"></span><b>${MEAN[MARKK][0]}</b><span class="mut">${MEAN[MARKK][1]}</span>`,
 note   :()=>`<span class="led" style="--k:${K.g}"></span><b>Note saved</b><span class="mut">on page ${pad(page,TOTAL)}</span>`,
 ask    :()=>`<span class="led" style="--k:${K.p}"></span><b>Question posted</b><span class="mut">anonymously</span>`,
 revise :()=>`<span class="led" style="--k:${K.r}"></span><b>Marked to revise</b><span class="eye">${ico.eye}only you</span>`,
 askq   :()=>`<span class="led" style="--k:${K.p}"></span><b>Question posted</b><span class="mut">anonymously</span>`,
 undo   :()=>`<span class="mini" style="color:var(--txt-2)">${ico.undo}</span><b>Undid a highlight</b><button class="act" aria-label="Redo">${ico.redo}</button>`,
 fresh  :()=>`<span class="led" style="--k:var(--lv)"></span><b>7 new marks</b><button class="act" aria-label="Pull them in">${ico.dl}</button>`,
 offline:()=>`<span class="led w"></span><b>Offline</b><span class="mut">marks are saved here</span>`
};
const TONE={offline:'warn'};
/* what each colour means when a mark lands */
const MEAN={y:['Exam likely','saved to revision'],
            b:['Definition','added to the module glossary'],
            g:['Testable fact','added to the question bank'],
            p:['Question posted','anonymously'],
            r:['Marked to revise','only you']};
let MARKK='y';

const restWidth=()=>12+22+14+CNT.offsetWidth+14+22+12;
function toRest(){
  clearTimeout(holdT);cur=null;
  ISL.dataset.msg='0';ISL.dataset.tone='';MSG.innerHTML='';
  if(open===null)ISL.style.width=restWidth()+'px';
}
function flash(name,ms){
  clearTimeout(holdT);
  SIZER.innerHTML=S[name]();
  const w=Math.min(Math.ceil(SIZER.scrollWidth)+30,560);
  MSG.innerHTML=S[name]();
  ISL.dataset.msg='1';ISL.dataset.tone=TONE[name]||'';
  cur=name;
  if(open===null)ISL.style.width=w+'px';
  if(name==='offline')return;
  holdT=setTimeout(toRest,ms||1800);
}

/* ── warmth: shifts the paper's white point, never a film over it ──── */
const mix=(a,b,t)=>'#'+[0,1,2].map(i=>{
  const A=parseInt(a.slice(1+i*2,3+i*2),16),B=parseInt(b.slice(1+i*2,3+i*2),16);
  return Math.round(A+(B-A)*t).toString(16).padStart(2,'0')}).join('');
function applyWarm(){
  const t=warm/100;
  R.style.setProperty('--paper',mix('#FFFFFF','#F3DCAE',t));
  R.style.setProperty('--pink', mix('#262B32','#3A2E1C',t));
}
function applyPage(){
  R.style.setProperty('--pw',Math.round(720*zoom/100)+'px');
  R.style.setProperty('--rot',rot+'deg');
}
function paintBookmarks(){
  $$('.sheetpg').forEach(el=>el.dataset.bm=bookmarks.has(+el.dataset.pg)?'1':'0');
}

/* ── the two trays ─────────────────────────────────────────────────── */
const LIV=['#4C8DF6','#E0654A','#43C08A','#C9922E','#8C86EE','#4FB8C4'];
function fanCards(){
  return RECENT.map(([n,k,q],i)=>{
    const lines=[0,1,2,3,4,5,6].map(r=>`<i${r===2?` class="m" style="--k:${K[k]}"`:''}></i>`).join('');
    return `<button class="card" data-i="${i}" data-pg="${n}" data-q="${q.replace(/"/g,'&quot;')}">
      ${lines}<span class="cn">${pad(n,TOTAL)}</span></button>`}).join('');
}
function trayPage(){return `
  <div class="ctrl">
    <button data-z="-1" aria-label="Zoom out">&minus;</button>
    <span class="rd">${zoom}%</span>
    <button data-z="1" aria-label="Zoom in">+</button>
    <button class="wide ${fit?'on':''}" data-f="1">Fit</button>
    <span class="gap"></span>
    <button data-r="-1" aria-label="Rotate left">${ico.rl}</button>
    <button data-r="1" aria-label="Rotate right">${ico.rr}</button>
    <span class="gap"></span>
    <button class="${bookmarks.has(page)?'on':''}" data-bmk="1" aria-label="Bookmark this page">${ico.bm}</button>
  </div>
  <div class="lab">Where you have been<span class="v">last five</span></div>
  <div class="fan" id="fan">${fanCards()}</div>
  <div class="cap" id="cap">Hold a card to see the line you marked.</div>`;
}
function trayMe(){return `
  <div class="me">
    <span class="av">CA</span>
    <span class="who"><b>Claire</b><span>AU University · Module 11 · B2</span></span>
  </div>
  <div class="tally">
    <button class="tal" data-go="hl" style="--k:${K.y}"><b>284</b><span>Highlights</span></button>
    <button class="tal" data-go="bm" style="--k:var(--lv)"><b>12</b><span>Bookmarks</span></button>
    <button class="tal" data-go="rv" style="--k:${K.r}"><b>31</b><span>To revise</span><em>only you</em></button>
  </div>
  <button class="rr" data-go="rr"><span class="ic">${ico.rrm}</span><b>Ready Room</b><span class="ch">${ico.ch}</span></button>
  <div class="lab">Appearance</div>
  <div class="segs">
    <button class="${R.dataset.look==='dark'?'on':''}" data-look="dark">Dark</button>
    <button class="${R.dataset.look==='light'?'on':''}" data-look="light">Light</button>
  </div>
  <div class="lab">Warmth<span class="v">${warm?warm+'%':'off'}</span></div>
  <div class="warm">
    <div class="sw"><div class="tr"></div>
      <input type="range" min="0" max="100" value="${warm}" id="wr" aria-label="Warmth">
      <span class="kn" id="kn"></span></div>
  </div>
  <div class="lab">Livery</div>
  <div class="liv">${LIV.map(c=>`<button class="lvs ${c===livery?'on':''}" data-lv="${c}" style="--pk:${c}"></button>`).join('')}</div>`;
}
function layoutFan(spread){
  const cards=$$('#fan .card');const n=cards.length;
  cards.forEach((c,i)=>{
    const mid=(n-1)/2, off=(i-mid);
    const step=spread?58:40, rotc=spread?2.2:4.6;
    c.style.transform=`translateX(${off*step}px) translateY(${Math.abs(off)*(spread?2:5)}px) rotate(${off*rotc}deg)`;
    c.style.zIndex=10+ (n-Math.abs(off));
  });
}
function fillTray(kind){
  TRAY.innerHTML = kind==='page'?trayPage():trayMe();
  if(kind==='page'){layoutFan(false);
    const fan=$('#fan'),cap=$('#cap');
    fan.addEventListener('pointerenter',()=>layoutFan(true));
    fan.addEventListener('pointerleave',()=>{layoutFan(false);
      cap.textContent='Hold a card to see the line you marked.'});
    $$('#fan .card').forEach(c=>c.addEventListener('pointerenter',()=>{
      cap.innerHTML=`<b>${pad(+c.dataset.pg,TOTAL)}</b> &nbsp;${c.dataset.q}`}));
  }else{
    const wr=$('#wr'),kn=$('#kn');
    const place=()=>{kn.style.left=(wr.value/100*100)+'%'};place();
    wr.addEventListener('input',()=>{warm=+wr.value;applyWarm();place();
      TRAY.querySelector('.lab .v').textContent=warm?warm+'%':'off';
      $$('.lab').forEach(l=>{if(l.textContent.startsWith('Warmth'))
        l.querySelector('.v').textContent=warm?warm+'%':'off'})});
  }
  ISL.style.height=(36+TRAY.scrollHeight+12)+'px';
}
function openTray(kind){
  toRest();
  open=kind;ISL.dataset.open=kind;
  ISL.style.width=(kind==='page'?332:320)+'px';ISL.style.borderRadius='22px';
  fillTray(kind);requestAnimationFrame(()=>fillTray(kind));
}
function closeTray(){
  open=null;ISL.removeAttribute('data-open');
  ISL.style.height='36px';ISL.style.borderRadius='18px';
  ISL.style.width=restWidth()+'px';
}
function goTo(n){
  const el=STAGE.querySelector(`.sheetpg[data-pg="${n}"]`);if(!el)return;
  const from=page;
  STAGE.scrollTo({top:el.offsetTop-74,behavior:'smooth'});
  if(Math.abs(n-from)>1)raiseBack(from);
}
function raiseBack(from){jumpFrom=from;BACKL.textContent='Back to '+pad(from,TOTAL);BACKP.classList.add('on')}

/* ── input ─────────────────────────────────────────────────────────── */
ISL.addEventListener('click',e=>{
  if(open){
    if(e.target.closest('#bk')){ open==='me' ? openTray('page') : closeTray(); return }
    const c=e.target.closest('.card');if(c){goTo(+c.dataset.pg);closeTray();return}
    const z=e.target.closest('[data-z]'),f=e.target.closest('[data-f]'),
          r=e.target.closest('[data-r]'),bm=e.target.closest('[data-bmk]'),
          k=e.target.closest('[data-look]'),v=e.target.closest('[data-lv]'),
          go=e.target.closest('[data-go]');
    if(z){zoom=Math.min(220,Math.max(60,zoom+(+z.dataset.z)*10));fit=false;applyPage();fillTray('page');return}
    if(f){zoom=100;fit=true;applyPage();fillTray('page');return}
    if(r){rot=(rot+(+r.dataset.r)*90)%360;applyPage();return}
    if(bm){bookmarks.has(page)?bookmarks.delete(page):bookmarks.add(page);
           paintBookmarks();fillTray('page');return}
    if(k){R.dataset.look=k.dataset.look;fillTray('me');return}
    if(v){livery=v.dataset.lv;R.style.setProperty('--lv',livery);fillTray('me');return}
    if(go){closeTray();flash(go.dataset.go==='rr'?'note':'mark',900);return}
    return;
  }
  if(e.target.closest('#you')){openTray('me');return}
  if(e.target.closest('#dot')){
    if(pending){pending=false;DOT.dataset.live='0';flash('mark',1400)}
    return;
  }
  if(cur==='fresh'){pending=false;DOT.dataset.live='0';flash('mark',1400);return}
  if(cur){toRest();return}
  openTray('page');
});
addEventListener('pointerdown',e=>{if(open&&!e.target.closest('.isl'))closeTray()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&open)closeTray()});

BACKP.addEventListener('click',e=>{
  if(e.target.closest('#backx')){BACKP.classList.remove('on');return}
  const el=STAGE.querySelector(`.sheetpg[data-pg="${jumpFrom}"]`);
  if(el)STAGE.scrollTo({top:el.offsetTop-74,behavior:'smooth'});
  BACKP.classList.remove('on');
});
STAGE.addEventListener('scroll',()=>{
  let best=FIRST,bd=1e9;
  $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
    if(d<bd){bd=d;best=+el.dataset.pg}});
  if(best!==page){page=best;paintCounter()}
},{passive:true});

$('#fire').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(open)closeTray();
  const s=b.dataset.s;
  if(s==='rest'){pending=false;DOT.dataset.live='0';BACKP.classList.remove('on');toRest();return}
  if(s==='fresh'){pending=true;DOT.dataset.live='1';flash('fresh',3600);return}
  flash(s);
});

/* the tool bar speaks to the island through this */
window.islandSay=(name,ms,k)=>{if(k&&MEAN[k])MARKK=k;flash(name,ms)};

$('#demoBtn').addEventListener('click',()=>R.dataset.demo='1');
document.querySelector('.demo').addEventListener('click',e=>{
  if(e.target.closest('[data-democlose]')){R.dataset.demo='0';return}
  /* scope to buttons — the root itself carries data-bar */
  const bar=e.target.closest('.demo button[data-bar]'),
        hide=e.target.closest('.demo button[data-hide]'),
        lk=e.target.closest('.demo button[data-look]');
  if(bar){R.dataset.bar=bar.dataset.bar;window.dispatchEvent(new Event('resize'));return}
  if(hide){window.setBarAutoHide&&window.setBarAutoHide(hide.dataset.hide==='1');
    $$('.demo [data-hide]').forEach(x=>x.classList.toggle('on',x===hide));return}
  if(lk){R.dataset.look=lk.dataset.look;
    $$('.demo [data-look]').forEach(x=>x.classList.toggle('on',x===lk));
    if(open==='me')fillTray('me');return}
});
applyPage();applyWarm();paintBookmarks();paintCounter(true);toRest();
})();

/* ─── 3 · the tool bar ────────────────────────────────────────────── */


(function(){
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

let S={tool:'hl',tray:[...DEF],bar:'left',
  variant:{},colour:{pen:'b',hl:'y',mkr:'y',shp:'b',txt:'b',msr:'g',note:'y',ul:'y',st:'r',flag:'r'},
  size:{pen:3,hl:12,mkr:14,shp:2,txt:14,msr:2,era:10,ul:2,st:2,note:12,flag:2},
  op:{pen:100,hl:38,mkr:55,shp:100,txt:100,msr:100,era:100,ul:100,st:100,note:100,flag:100},
  recent:[], presets:{}, open:null, gtab:'Draw', straight:{}};
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
const SEED=[
 [126,'y','hl','ah','2 days ago','If the engine fails, or a drive shaft shears, another force has to keep the rotor turning'],
 [127,'b','hl','no','yesterday','Rotor RPM is the single most important parameter in an autorotation'],
 [127,'p','ask','anon','4 hours ago','Too low and the blades stall, too high and they are overspeeded beyond structural limits',
  'Is the low-RPM limit the same at every weight, or does it move with all-up mass?',
  [['tut','Instructor','It moves. The published minimum is for maximum all-up mass; lighter, the stall margin is larger but the flight manual figure is still the one you fly to.'],
   ['no','Noor','We were given the graph for this in the Module 11 handout, page 4.']]],
 [128,'g','hl','me','2 days ago','The avoid areas are published in the flight manual and are specific to weight and density altitude'],
 [128,'y','ul','no','3 days ago','Between those regions lies the corridor in which an engine failure can be flown'],
 [129,'r','hl','me','today','Delay in lowering the collective is the most common cause of an unrecoverable rotor decay'],
 [129,'b','hl','yo','yesterday',"Rotor inertia is the rotor's stored rotational energy for a given RPM"],
 [130,'g','hl','ah','5 days ago','The flare reduces both rate of descent and forward speed'],
 [130,'p','ask','anon','2 days ago','Touchdown attitude is level or very slightly nose-up, with the aircraft in balance',
  'Does "in balance" mean the ball centred, or aligned with the ground track?',
  [['ah','Ahmad','Aligned with the ground track. On a run-on you want the skids pointing where you are actually going.']]],
 [131,'r','hl','me','today','A power recovery is flown to a hover rather than to the ground'],
 [131,'y','hl','me','today','Rotor RPM is monitored throughout and corrected with collective, not with cyclic'],
 [132,'b','ul','no','a week ago','A run-on landing carries forward speed through the touchdown'],
 [133,'y','hl','yo','yesterday','A tail rotor drive failure removes yaw control'],
 [133,'g','hl','me','yesterday','The recovery is an autorotation to a run-on landing wherever the surface allows'],
 [134,'p','ask','anon','1 hour ago','It is most likely at low speed, high power and with wind from the left',
  'Is this reversed on a clockwise rotor, or is the wind direction the same either way?',[]],
 [135,'r','hl','me','3 days ago','Applying it above that figure overheats the disc and can distort it']];

function findRange(pg,quote){
  const walk=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT);
  let n;while((n=walk.nextNode())){
    const i=n.nodeValue.indexOf(quote);
    if(i>=0){const r=document.createRange();
      r.setStart(n,i);r.setEnd(n,i+quote.length);return r}
  }
  return null;
}
function seed(){
  SEED.forEach(([pgn,k,kind,who,t,quote,ask,ans])=>{
    const pg=document.querySelector(`.sheetpg[data-pg="${pgn}"]`); if(!pg)return;
    const r=findRange(pg,quote); if(!r)return;
    const layer=pg.querySelector('.marks'), pr=pg.getBoundingClientRect();
    const hex = kind==='ask' ? col('p').hex : col(k).hex;
    const gid='s'+(++markSeq);
    [...r.getClientRects()].forEach(q=>{
      if(q.width<1.5)return;
      const d=document.createElement('span');
      d.className='mkq '+kind;
      d.dataset.g=gid;d.dataset.kind=kind;d.dataset.k=k;
      d.style.cssText=`left:${q.left-pr.left}px;top:${q.top-pr.top}px;`+
                      `width:${q.width}px;height:${q.height}px;--k:${hex}`;
      layer.appendChild(d);
    });
    WM.add({id:gid,g:gid,pg:pgn,k,kind,who,t,tx:quote,ask,
            ans:(ans||[]).map(a=>({who:a[0],n:a[1],tx:a[2]})),
            fresh:['4 hours ago','1 hour ago','today'].includes(t)});
  });
}
addEventListener('load',()=>setTimeout(seed,120));
if(document.readyState==='complete')setTimeout(seed,120);

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
  WM.add({id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:kind==='ask'?'':undefined,ans:kind==='ask'?[]:undefined});
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
    if(t&&!t.fixed&&!t.grey){S.colour[t.id]=lastK;paintRail();mode()}
    recolour();paintSel();return}
  if(e.target.closest('[data-rmv]')){
    if(picked){WM.drop(picked[0].dataset.g);picked.forEach(q=>q.remove());picked=null}
    hideSel();return}
  const a=e.target.closest('[data-act]'); if(!a)return;
  const k=a.dataset.act;
  if(picked){convert(k);window.islandSay&&window.islandSay(k==='ask'?'askq':'mark',900,k==='ask'?'p':lastK);
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
  if(ink){if(ink.pts.length<2)ink.path.remove();ink=null}
});
/* a light smoothing so a mouse-drawn line does not look like a saw */
function smooth(p){
  if(p.length<3)return `M${p[0][0]} ${p[0][1]}L${p[p.length-1][0]} ${p[p.length-1][1]}`;
  let d=`M${p[0][0]} ${p[0][1]}`;
  for(let i=1;i<p.length-1;i++){
    const mx=(p[i][0]+p[i+1][0])/2, my=(p[i][1]+p[i+1][1])/2;
    d+=`Q${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }
  return d+`L${p[p.length-1][0]} ${p[p.length-1][1]}`;
}
})();


/* ─── 4 · the panel ───────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   The panel — search, the marks browser, the page selector.
   It reads the same list the tool bar writes to.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),BODY=$('#body'),FILT=$('#filters'),PF=$('#pf'),Q=$('#q'),STAGE=$('#stage');
const FIRST=126, pad=n=>String(n).padStart(4,'0');
const K={y:'#F5C23C',b:'#5BB4F0',g:'#43C08A',p:'#B571E0',r:'#EE6F82'};
const MEAN={y:'Exam likely',b:'Definition',g:'Testable fact',p:'Question',r:'To revise'};
const PEOPLE={me:{n:'You',i:'CA'},ah:{n:'Ahmad',i:'AH'},no:{n:'Noor',i:'NO'},
              yo:{n:'Yousef',i:'YO'},tut:{n:'Instructor',i:'IN'},anon:{n:'Anonymous',i:'?'}};
const HEADS=[...document.querySelectorAll('.sheetpg h3')].map(h=>h.textContent);
const NPAGES=HEADS.length;

let view='marks', scope='all', kinds=new Set(), open=null, page=FIRST, term='';
const SCOPES=[['all','Everything'],['mine','Mine'],['class','Class'],['q','Questions'],['rev','To revise']];

const who=m=>PEOPLE[m.who]||{n:'Someone',i:'??'};
function isVisible(m){
  if(scope==='mine'&&m.who!=='me')return false;
  if(scope==='class'&&(m.who==='me'||m.k==='r'))return false;
  if(scope==='q'&&m.kind!=='ask')return false;
  if(scope==='rev'&&m.k!=='r')return false;
  if(m.k==='r'&&m.who!=='me')return false;            /* red is private, always */
  if(kinds.size&&!kinds.has(m.k))return false;
  if(term){
    const hay=(m.tx+' '+(m.ask||'')+' '+who(m).n+' '+MEAN[m.k]).toLowerCase();
    if(!hay.includes(term))return false;
  }
  return true;
}
const shown=()=>WM.marks.filter(isVisible);
const esc=t=>t.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const hi=t=>{t=esc(t||'');return term
  ? t.replace(new RegExp('('+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>')
  : t};

function paintFilters(){
  const n=k=>WM.marks.filter(m=>m.k===k&&(m.k!=='r'||m.who==='me')).length;
  FILT.innerHTML=`
   <div class="chips">${SCOPES.map(([k,l])=>
     `<button class="chip ${scope===k?'on':''}" data-scope="${k}"
        ${k==='q'?`style="--k:${K.p}"`:k==='rev'?`style="--k:${K.r}"`:''}>${l}</button>`).join('')}
   </div>
   <div class="chips" style="margin-top:6px">${Object.keys(K).map(k=>
     `<button class="chip ${kinds.has(k)?'on':''}" data-kind="${k}" style="--k:${K[k]}">
        <i></i>${MEAN[k]}<em>${n(k)}</em></button>`).join('')}
   </div>`;
}
function card(m){
  const p=who(m), anon=m.who==='anon', isOpen=open===m.id;
  return `<div class="mcard ${isOpen?'open':''}" role="button" tabindex="0" data-m="${m.id}" style="--k:${K[m.k]}">
    ${m.k==='r'?`<span class="own">Only you</span>`:''}
    <div class="qt">${m.kind==='ask'&&m.ask?`<b style="color:${K.p}">${hi(m.ask)}</b><br>`:''}${hi(m.tx)}</div>
    <div class="mt">
      <span class="a ${anon?'anon':''}">${p.i}</span>
      <b>${p.n}</b><span class="dot">·</span><span>${m.t}</span>
      <span class="rt">
        ${m.fresh?`<span style="color:var(--lv);font-weight:600">new</span>`:''}
        ${m.kind==='ask'?`<span class="n">${(m.ans||[]).length} ${((m.ans||[]).length===1?'answer':'answers')}</span>`:''}
        ${m.kind==='ul'?`<span style="opacity:.7">underline</span>`:''}
      </span>
    </div>
    ${m.kind==='ask'?`<div class="thr">
      ${(m.ans||[]).map(a=>`<div class="ans">
        <span class="a ${a.who==='tut'?'tut':''}">${PEOPLE[a.who]?PEOPLE[a.who].i:'??'}</span>
        <span class="tx"><b>${a.n}${a.who==='tut'?'<em>answered</em>':''}</b>${esc(a.tx)}</span></div>`).join('')
      || `<div class="ans"><span class="tx" style="color:var(--txt-3)">No answers yet. Yours would be the first.</span></div>`}
      <div class="reply"><input placeholder="Answer this" data-stop><button data-stop>Send</button></div>
    </div>`:''}
  </div>`;
}
function paintList(){
  const ms=shown().sort((a,b)=>a.pg-b.pg);
  $('#cm').textContent=ms.length;$('#cp').textContent=NPAGES;
  if(!ms.length){
    BODY.innerHTML=`<div class="none"><b>Nothing matches</b>
      <p>${term?`Nothing on this paper says &ldquo;${esc(term)}&rdquo;.`:'Try a wider filter.'}</p>
      <button data-clear>Clear the filters</button></div>`;
    return;
  }
  const by={};ms.forEach(m=>{(by[m.pg]=by[m.pg]||[]).push(m)});
  BODY.innerHTML=Object.keys(by).map(pg=>
    `<div class="pgh"><b>${pad(pg)}</b><span>${HEADS[pg-FIRST]||''}</span><em>${by[pg].length}</em></div>`
    + by[pg].map(card).join('')).join('');
}
function paintPages(){
  $('#cm').textContent=shown().length;$('#cp').textContent=NPAGES;
  BODY.innerHTML=`<div class="pgrid">${HEADS.map((h,i)=>{
    const pg=FIRST+i;
    const ks=WM.marks.filter(m=>m.pg===pg&&isVisible(m)).map(m=>m.k);
    const lines=[0,1,2,3,4,5].map(r=>`<i${ks[r]?` class="m" style="--k:${K[ks[r]]}"`:''}></i>`).join('');
    return `<button class="pcell ${pg===page?'on':''}" data-pg="${pg}" title="${h}">
      ${lines}<span class="n">${pad(pg)}</span></button>`}).join('')}</div>`;
}
function paintFoot(){
  const ms=shown(), nw=ms.filter(m=>m.fresh).length;
  PF.innerHTML=`${nw?`<span class="nw"><i></i>${nw} new since you looked</span>`
                   :`<span>${ms.length} of ${WM.marks.length} marks</span>`}
    <button class="x" data-close aria-label="Hide the panel">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9.4 5.4L16 12l-6.6 6.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  const t=$('#tabn');t.textContent=nw||'';t.style.display=nw?'grid':'none';
}
function paint(){paintFilters();view==='marks'?paintList():paintPages();paintFoot()}
WM.on(paint);

/* ── input ─────────────────────────────────────────────────────────── */
Q.addEventListener('input',()=>{
  term=Q.value.trim().toLowerCase();
  $('#srchw').classList.toggle('has',!!Q.value);paint();
});
$('#clr').addEventListener('click',()=>{Q.value='';term='';$('#srchw').classList.remove('has');paint();Q.focus()});
$('#view').addEventListener('click',e=>{
  const b=e.target.closest('[data-v]');if(!b)return;
  view=b.dataset.v;$$('#view button').forEach(x=>x.classList.toggle('on',x===b));paint();
});
FILT.addEventListener('click',e=>{
  const sc=e.target.closest('[data-scope]'), kd=e.target.closest('[data-kind]');
  if(sc){scope=sc.dataset.scope;open=null;paint();return}
  if(kd){const k=kd.dataset.kind;kinds.has(k)?kinds.delete(k):kinds.add(k);paint();return}
});
BODY.addEventListener('click',e=>{
  if(e.target.closest('[data-stop]')){e.stopPropagation();return}
  if(e.target.closest('[data-clear]')){scope='all';kinds.clear();Q.value='';term='';
    $('#srchw').classList.remove('has');paint();return}
  const pc=e.target.closest('[data-pg]');
  if(pc){page=+pc.dataset.pg;window.readerGoTo&&window.readerGoTo(page);paintPages();return}
  const c=e.target.closest('[data-m]');if(!c)return;
  const m=WM.marks.find(x=>x.id===c.dataset.m);if(!m)return;
  page=m.pg;
  window.readerGoTo&&window.readerGoTo(m.pg,m.g);
  if(m.kind==='ask'){open = open===m.id?null:m.id;paintList()}
  m.fresh=false;paintFoot();
});
PF.addEventListener('click',e=>{if(e.target.closest('[data-close]'))R.dataset.pan='0'});
$('#tab').addEventListener('click',()=>R.dataset.pan='1');
STAGE.addEventListener('scroll',()=>{
  let best=FIRST,bd=1e9;
  $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
    if(d<bd){bd=d;best=+el.dataset.pg}});
  if(best!==page){page=best;if(view==='pages')paintPages()}
},{passive:true});

/* the panel always takes the edge the bar is not on */
function side(){R.dataset.side = R.dataset.bar==='right' ? 'left' : 'right'}
new MutationObserver(side).observe(R,{attributes:true,attributeFilter:['data-bar']});
side();

paint();
})();
