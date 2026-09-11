/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part 2 (the island).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and `npm run check:paper` refuses if this file and the source have drifted.
 *
 * Changed from the handed-over file, and only this:
 *   - the paper's name, length and first page come from the manifest, not from a constant
 *   - where the student left off, and what they had set — read once at mount, written back through ctx
 *   - HANDOVER section 1 — the stand-in paper. React renders the stage from PDF.js in the same element shape
 *   - the last five places are the student's own most recent marks
 *   - who the student is, and what they have actually done on this paper
 *   - the tallies are counted, not written down
 *   - the livery list is the app's five, and the app owns which one is current
 *   - the root carries data-look, so the Appearance branch swallowed every other press in the tray
 *   - zoom, fit and rotation move every mark on the page — HANDOVER section 3 asks for exactly this call
 *   - warmth is a setting, and settings save locally first
 *   - pressing the dot is what pulls the waiting marks in — the poll may only light it
 *   - the way-back banner sat there until you dismissed it by hand, or forever
 *   - and it says so for a while rather than for ever
 *   - the closed tray kept six buttons in the tab order behind a 36px island
 *   - and hands them back when it opens
 *   - the fanned deck read the student's last five places once, at mount, when there were none
 *   - and the deck draws from the call
 *   - a tally of nothing is a zero count, and this app never states one
 *   - a student could put marks into a paper and had no way to get them out
 *   - the Redo button in the undo message is a button, and in the demo it only dismissed the message
 *   - HANDOVER, Making it feel smooth: do no work in a scroll handler. Read, store, act on the next frame
 *   - HANDOVER section 5 — the demo strip and the states it fires
 *   - HANDOVER section 5 — the demo strip's own controls
 *   - the island has to be told things from outside: a new page, a pull waiting, a message
 */

export function mountIsland(ctx){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),ISL=$('#isl'),CNT=$('#cnt'),DOT=$('#dot'),MSG=$('#msg'),
      TRAY=$('#tray'),SIZER=$('#sizer'),STAGE=$('#stage'),BACKP=$('#backp'),BACKL=$('#backl');

const DOC=ctx.doc, TOTAL=ctx.total, FIRST=ctx.first;
const K={y:'#F5C23C',b:'#5BB4F0',g:'#43C08A',p:'#B571E0',r:'#EE6F82'};
let page=ctx.page||FIRST, zoom=ctx.zoom||100, fit=ctx.fit!==false, rot=ctx.rot||0,
    warm=ctx.warm||0, livery=ctx.livery||'#4C8DF6',
    cur=null, holdT=null, pending=false, open=null, jumpFrom=null,
    bookmarks=new Set(ctx.bookmarks||[]);
const pad=(n,t)=>String(n).padStart(String(t).length,'0');

/* ── the paper ─────────────────────────────────────────────────────── */
/* HANDOVER section 1: the stand-in paper was here. The stage is rendered
   by ReaderV6.jsx from PDF.js, in the element shape the handover fixes —
   article.sheetpg[data-pg] · .bmk · svg.ink · .marks · canvas · .textLayer
   · .pgno — so every query below still finds what it is looking for. */

/* your last five places — page, its mark colour, and the line you marked */
/* ASKED EACH TIME IT IS DRAWN. Read once into a constant, this was whatever
   the reader knew at mount — which is nothing, because the marks arrive after
   it — so "Where you have been" was permanently empty however much you
   marked. Same for the tallies below. */
const RECENT=()=>ctx.recent();

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
const LIV=ctx.liveries;
function fanCards(){
  return RECENT().map(([n,k,q],i)=>{
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
    <span class="av">${ctx.me.i}</span>
    <span class="who"><b>${ctx.me.n}</b><span>${ctx.me.sub}</span></span>
  </div>
  ${(()=>{const t=ctx.tally();
    const tiles=[
      t.hl&&`<button class="tal" data-go="hl" style="--k:${K.y}"><b>${t.hl}</b><span>Highlight${t.hl===1?'':'s'}</span></button>`,
      t.bm&&`<button class="tal" data-go="bm" style="--k:var(--lv)"><b>${t.bm}</b><span>Bookmark${t.bm===1?'':'s'}</span></button>`,
      t.rv&&`<button class="tal" data-go="rv" style="--k:${K.r}"><b>${t.rv}</b><span>To revise</span><em>only you</em></button>`,
    ].filter(Boolean);
    /* NEVER STATE ABSENCE OR A ZERO COUNT. Three tiles reading 0, 0, 0 is the
       reader telling a student they have done nothing, three times. A tile
       appears when it has something in it, and when none of them does the
       space says what to do instead. */
    return tiles.length
      ? `<div class="tally">${tiles.join('')}</div>`
      : `<div class="lab" style="margin-top:12px">Mark a line and it lands here</div>`;
  })()}
  <button class="rr" data-go="rr"><span class="ic">${ico.rrm}</span><b>Ready Room</b><span class="ch">${ico.ch}</span></button>
  ${ctx.tally().hl+ctx.tally().rv?`<button class="rr" data-go="out"><span class="ic">${ico.dl}</span><b>Take your marks with you</b><span class="ch">${ico.ch}</span></button>`:''}
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
    wr.addEventListener('input',()=>{warm=+wr.value;applyWarm();place();ctx.onWarm(warm);
      TRAY.querySelector('.lab .v').textContent=warm?warm+'%':'off';
      $$('.lab').forEach(l=>{if(l.textContent.startsWith('Warmth'))
        l.querySelector('.v').textContent=warm?warm+'%':'off'})});
  }
  ISL.style.height=(36+TRAY.scrollHeight+12)+'px';
}
function openTray(kind){
  toRest();
  open=kind;ISL.dataset.open=kind;TRAY.inert=false;
  ISL.style.width=(kind==='page'?332:320)+'px';ISL.style.borderRadius='22px';
  fillTray(kind);requestAnimationFrame(()=>fillTray(kind));
}
function closeTray(){
  open=null;ISL.removeAttribute('data-open');
  /* Clipped is not gone. With the island back to 36px the tray's controls are
     invisible and still focusable, so tabbing through the reader walks into
     six buttons nobody can see. */
  TRAY.inert=true;
  ISL.style.height='36px';ISL.style.borderRadius='18px';
  ISL.style.width=restWidth()+'px';
}
function goTo(n){
  const el=STAGE.querySelector(`.sheetpg[data-pg="${n}"]`);if(!el)return;
  const from=page;
  STAGE.scrollTo({top:el.offsetTop-74,behavior:'smooth'});
  if(Math.abs(n-from)>1)raiseBack(from);
}
function raiseBack(from){jumpFrom=from;BACKL.textContent='Back to '+pad(from,TOTAL);BACKP.classList.add('on');
  clearTimeout(backT);backT=setTimeout(()=>BACKP.classList.remove('on'),12000)}

/* ── input ─────────────────────────────────────────────────────────── */
ISL.addEventListener('click',e=>{
  if(open){
    if(e.target.closest('#bk')){ open==='me' ? openTray('page') : closeTray(); return }
    const c=e.target.closest('.card');if(c){goTo(+c.dataset.pg);closeTray();return}
    /* SCOPED TO THE TRAY, and the reason is a bug that was live.

       `.rdr` itself carries `data-look`, because that is how the stylesheet
       knows whether it is dark or light — so `e.target.closest('[data-look]')`
       walks up past the button, past the tray, past the island, and finds the
       ROOT. It matched for every press anywhere in an open tray.

       The branch it guards then ran on all of them: `R.dataset.look =
       R.dataset.look`, a no-op, followed by a repaint and a return. Every
       press listed after it was unreachable — the livery picker, the Ready
       Room row and all three tallies had never done anything, and neither had
       anything added below them. Zoom, fit, rotate and bookmark only worked
       because they are checked first.

       Scoping each lookup inside `#tray` is what the demo strip did for the
       same reason, in the file's own words: "scope to buttons — the root
       itself carries data-bar". */
    const inTray=s=>e.target.closest('#tray '+s);
    const z=inTray('[data-z]'),f=inTray('[data-f]'),
          r=inTray('[data-r]'),bm=inTray('[data-bmk]'),
          k=inTray('[data-look]'),v=inTray('[data-lv]'),
          go=inTray('[data-go]');
    if(z){zoom=Math.min(220,Math.max(60,zoom+(+z.dataset.z)*10));fit=false;applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    if(f){zoom=100;fit=true;applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    if(r){rot=(rot+(+r.dataset.r)*90)%360;applyPage();ctx.onView(zoom,fit,rot);return}
    if(bm){bookmarks.has(page)?bookmarks.delete(page):bookmarks.add(page);
           paintBookmarks();fillTray('page');ctx.onBookmark(page,bookmarks.has(page));return}
    if(k){R.dataset.look=k.dataset.look;fillTray('me');ctx.onLook(k.dataset.look);return}
    if(v){livery=v.dataset.lv;R.style.setProperty('--lv',livery);fillTray('me');ctx.onLivery(livery);return}
    if(go){closeTray();ctx.onGo(go.dataset.go);return}
    return;
  }
  if(e.target.closest('#you')){openTray('me');return}
  if(e.target.closest('#dot')){
    if(pending){pending=false;DOT.dataset.live='0';ctx.onPull()}
    return;
  }
  if(cur==='fresh'){pending=false;DOT.dataset.live='0';ctx.onPull();return}
  if(cur==='undo'&&e.target.closest('.act')){ctx.onRedo();return}
  if(cur){toRest();return}
  openTray('page');
});
addEventListener('pointerdown',e=>{if(open&&!e.target.closest('.isl'))closeTray()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&open)closeTray()});

/* IT GOES WHEN YOU CARRY ON READING. "Back to 0126" is an offer, and an
   offer that will not leave is a demand. Pressing anywhere else on the paper
   is the student saying they did not want it — so it goes then, and it goes
   on its own after long enough that nobody is watching it any more. */
let backT=null;
const dropBack=()=>{clearTimeout(backT);BACKP.classList.remove('on')};
addEventListener('pointerdown',e=>{
  if(!BACKP.classList.contains('on'))return;
  if(e.target.closest('.backp')||e.target.closest('.isl'))return;
  dropBack();
},true);
addEventListener('keydown',e=>{if(e.key==='Escape')dropBack()});
BACKP.addEventListener('click',e=>{
  if(e.target.closest('#backx')){BACKP.classList.remove('on');return}
  const el=STAGE.querySelector(`.sheetpg[data-pg="${jumpFrom}"]`);
  if(el)STAGE.scrollTo({top:el.offsetTop-74,behavior:'smooth'});
  BACKP.classList.remove('on');
});
let scrollF=0;
STAGE.addEventListener('scroll',()=>{
  if(scrollF)return;
  scrollF=requestAnimationFrame(()=>{
    scrollF=0;
    let best=FIRST,bd=1e9;
    $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
      if(d<bd){bd=d;best=+el.dataset.pg}});
    if(best!==page){page=best;paintCounter();ctx.onPage(page)}
  });
},{passive:true});

/* HANDOVER section 5: the demo's "fire a state" panel was here. */

/* the tool bar speaks to the island through this */
window.islandSay=(name,ms,k)=>{if(k&&MEAN[k])MARKK=k;flash(name,ms)};

/* HANDOVER section 5: the demo controls were here. Where the bar sits and
   which look is on are the student's settings now, not demo switches. */
applyPage();applyWarm();paintBookmarks();paintCounter(true);toRest();
/* what the rest of the reader can ask the island to do */
return {
  goTo,
  page:()=>page,
  view:()=>({zoom,fit,rot}),
  bookmarks:()=>bookmarks,
  /* a page arriving from anywhere but the scroller — the panel, a deep link */
  setPage(n){if(n===page)return;page=n;paintCounter()},
  /* the quiet poll found some. Light the dot and say so, and touch nothing else */
  waiting(n){pending=n>0;DOT.dataset.live=n>0?'1':'0';if(n>0)flash('fresh',3600)},
  /* they arrived. Say what came in */
  arrived(n){pending=false;DOT.dataset.live='0';flash('mark',1400)},
  /* something was taken back, or put back. The message is the whole of the
     acknowledgement: an undo on a page you are not looking at is otherwise
     silent, and the student is left unsure whether the key did anything. */
  undone(what,isRedo){MARKK='y';flash('undo',isRedo?1400:2600)},
  say(name,ms,k){if(k&&MEAN[k])MARKK=k;flash(name,ms)},
  offline(v){v?flash('offline'):toRest()},
  repaint(){paintBookmarks();if(open)fillTray(open)},
};
}
