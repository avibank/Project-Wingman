/* THE ISLAND — the top bar: the page counter, the trays, and the one line the reader is allowed to say.
 *
 * HAND-OWNED. This file used to be generated: scripts/build-reader-v6.mjs cut
 * it out of docs/reader/v6/reader.js and applied a table of byte-exact
 * find/replace edits, and check:paper refused the build if a byte differed.
 * That made the chrome uneditable — a one-character copy fix cost a six-line
 * diff in a build script, a regenerated file and a permanent changelog entry —
 * and it is why two cascade bugs lived here for as long as they did: the
 * generated code could only set attributes and additions.css could only add
 * rules, so neither could win an argument with reader.css.
 *
 * The generator is gone. docs/reader/v6/ stays as the original hand-over, for
 * reference. THE LAYOUT DOES NOT CHANGE: check:paper still asserts that every
 * class the shipped stylesheet declares is rendered by something here, that
 * every rule is scoped to .rdr, and that the demo strip stays deleted.
 *
 * What had already been changed from the handed-over file, kept as history:
 *   P0-2 — the banner said work was saved when nothing had been queued. It now says what is true: how much is waiting, and on which device
 *   the paper's name, length and first page come from the manifest, not from a constant
 *   where the student left off, and what they had set — read once at mount, written back through ctx
 *   HANDOVER section 1 — the stand-in paper. React renders the stage from PDF.js in the same element shape
 *   the last five places are the student's own most recent marks
 *   who the student is, and what they have actually done on this paper
 *   the tallies are counted, not written down
 *   the livery list is the app's five, and the app owns which one is current
 *   the root carries data-look, so the Appearance branch swallowed every other press in the tray
 *   zoom, fit and rotation move every mark on the page — HANDOVER section 3 asks for exactly this call
 *   warmth is a setting, and settings save locally first
 *   pressing the dot is what pulls the waiting marks in — the poll may only light it
 *   the way-back banner sat there until you dismissed it by hand, or forever
 *   and it says so for a while rather than for ever
 *   the closed tray kept six buttons in the tab order behind a 36px island
 *   and hands them back when it opens
 *   the fanned deck read the student's last five places once, at mount, when there were none
 *   and the deck draws from the call
 *   a tally of nothing is a zero count, and this app never states one
 *   a student could put marks into a paper and had no way to get them out
 *   the Redo button in the undo message is a button, and in the demo it only dismissed the message
 *   HANDOVER, Making it feel smooth: do no work in a scroll handler. Read, store, act on the next frame
 *   HANDOVER section 5 — the demo strip and the states it fires
 *   HANDOVER section 5 — the demo strip's own controls
 *   the island has to be told things from outside: a new page, a pull waiting, a message
 *   P0-2 — the island can say the outbox drained, which is the other half of telling the truth about it
 *   the waiting message counts what is waiting, instead of always seven
 *   the undo message says what was undone, and says Redid when it is one
 *   the quiet poll lights the dot and stops there, which is the whole of the rule
 *   marks pulled in from the class are reported as marks from the class
 *   Fit fits the page in the room, instead of meaning "100 %"
 *   the reader opens in the livery the rest of the app is wearing
 *   one page-number format, shared with the sheet's own corner
 *   a passage is escaped before it is written into the caption
 *   and "hold a card" is a hold on an iPad, not only a hover on a mouse
 */

export function mountIsland(ctx){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),ISL=$('#isl'),CNT=$('#cnt'),DOT=$('#dot'),MSG=$('#msg'),
      TRAY=$('#tray'),SIZER=$('#sizer'),STAGE=$('#stage'),BACKP=$('#backp'),BACKL=$('#backl');

const DOC=ctx.doc, TOTAL=ctx.total, FIRST=ctx.first;
const K={y:'#F5C23C',b:'#5BB4F0',g:'#43C08A',p:'#B571E0',r:'#EE6F82'};
let page=ctx.page||FIRST, zoom=ctx.zoom||100, fit=ctx.fit!==false, rot=ctx.rot||0,
    warm=ctx.warm||0, livery=ctx.livery||'#4C8DF6',
    cur=null, holdT=null, pending=false, open=null, jumpFrom=null, heldCard=false,
    bookmarks=new Set(ctx.bookmarks||[]);
/* ONE PAGE-NUMBER FORMAT, NOT TWO. This padded to the width of the total
   while the shell padded the sheet's own corner to at least four, so page
   three of a twelve-page paper read "03" here and "0003" on the sheet a few
   inches below it: the same number, twice, in two formats. Both sides use the
   wider rule now, and this is the only formatter in this file. */
const pad=(n,t)=>String(n).padStart(Math.max(4,String(t===undefined?TOTAL:t).length),'0');
/* ANYTHING THE PAPER SAYS IS ESCAPED BEFORE IT BECOMES HTML. The fan card's
   caption is a passage lifted out of the PDF, and it was going into an
   attribute with only the quotes escaped and then into innerHTML with nothing
   escaped — so a line reading "bolts & nuts < 8 mm" came out mangled, and a
   line that happened to contain a tag came out as one. */
const esc=t=>String(t==null?'':t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const escA=t=>esc(t).replace(/"/g,'&quot;');

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
                  `<span class="sl">/</span><span class="tot">${pad(TOTAL,TOTAL)}</span>`;
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
 /* IT SAID "Undid a highlight" WHATEVER YOU UNDID. undone() has always been
    handed the word for the thing — a question, a colour change, a pen stroke —
    and used it only to pick how long the message stayed up, so taking back a
    question told the student they had taken back a highlight. It also never
    said Redid, so the two halves of the same key were indistinguishable. */
 undo   :()=>`<span class="mini" style="color:var(--txt-2)">${ico.undo}</span><b>${UNDO.redo?'Redid':'Undid'} ${UNDID[UNDO.what]||'a mark'}</b><button class="act" aria-label="Redo">${ico.redo}</button>`,
 /* THE COUNT WAS THE LITERAL 7. waiting(n) is given the real number and threw
    it away, so a paper with one new mark on it announced seven. */
 fresh  :()=>`<span class="led" style="--k:var(--lv)"></span><b>${NEWN} new mark${NEWN===1?'':'s'}</b><button class="act" aria-label="Pull them in">${ico.dl}</button>`,
 /* ARRIVING MARKS HAD NO MESSAGE OF THEIR OWN and borrowed `mark`, which is
    the message for a mark the student has just made this second: it reads
    MEAN[MARKK], the meaning of whichever colour they last used. Pulling in
    eleven marks from the class therefore said "Definition · added to the
    module glossary". This says what came in and who it came from, and when
    nothing was waiting it names the thing to do rather than counting nothing. */
 arrived:()=>NEWN>0
   ? `<span class="led" style="--k:var(--lv)"></span><b>${NEWN} mark${NEWN===1?'':'s'} from the class</b><span class="mut">on the page now</span>`
   : `<span class="led" style="--k:var(--lv)"></span><b>Up to date</b><span class="mut">carry on reading — the dot lights when the class marks something</span>`,
 offline:()=>{const n=ctx.unsent?.()||0;return `<span class="led w"></span><b>${n?'Not saved yet':'Offline'}</b><span class="mut">${n?`${n} waiting on this device`:'your work is kept until you reconnect'}</span>`},
 saved  :()=>`<span class="led" style="--k:var(--lv)"></span><b>Back online</b><span class="mut">${ctx.justSent?.()||0} saved</span>`
};
const TONE={offline:'warn'};
/* what each colour means when a mark lands */
const MEAN={y:['Exam likely','saved to revision'],
            b:['Definition','added to the module glossary'],
            g:['Testable fact','added to the question bank'],
            p:['Question posted','anonymously'],
            r:['Marked to revise','only you']};
let MARKK='y';
/* what the last undo took back, and whether it was the redo half of the pair */
const UNDO={what:'',redo:false};
const UNDID={highlight:'a highlight',question:'a question',change:'a change',
             colour:'a colour change',note:'a note',stroke:'a pen stroke'};
/* how many marks the poll found, or the pull brought in */
let NEWN=0;

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
/* THE READER OPENED IN DEFAULT BLUE WHATEVER LIVERY THE APP WAS WEARING.
   `--lv` was set in exactly one place, the swatch handler, so it only ever
   became true once the student opened the You tray and pressed a colour they
   had already chosen. reader.css declares `--lv` on `.rdr` itself, so nothing
   could inherit past it either — and the picker meanwhile drew the right
   swatch as selected, which made the reader look like the one screen in the
   app that had ignored the setting. It is applied at mount now. */
function applyLivery(){R.style.setProperty('--lv',livery)}
/* FIT MEANT "100 %", WHICH IS NOT A FIT. The branch set zoom=100 and stopped,
   and applyPage turns that into a fixed 720px-wide page — so on a 13" iPad
   held upright, Fit cut the bottom off every page, and the flag was written
   to storage and read back at mount and never used for anything.

   The page is laid out from its width: `--pw` is the width and the sheet is
   `pageAspect` times as tall. A quarter turn swaps the two. So the zoom that
   puts the whole page in the room is the smaller of the two that put its
   height and its width there, clamped to the range the +/- buttons use. */
function fitZoom(){
  const r=(ctx.room&&ctx.room())||{w:STAGE.clientWidth-24,h:STAGE.clientHeight-74};
  /* A VALUE OR A GETTER. The shell hands this over as a function, because the
     aspect belongs to the page you are on and that changes; reading it as a
     plain number made `aspect` a function, every arithmetic below NaN, and
     the fit zoom NaN — which is a page with no width at all. */
  const a=typeof ctx.pageAspect==='function'?ctx.pageAspect():ctx.pageAspect;
  const aspect=Number.isFinite(a)&&a>0?a:1010/720;
  const q=((rot%360)+360)%360, turned=q===90||q===270;
  const tall=turned?1:aspect, wide=turned?aspect:1;
  const byH=r.h>0?r.h/(720*tall)*100:100;
  const byW=r.w>0?r.w/(720*wide)*100:100;
  const z=Math.round(Math.min(220,Math.max(60,Math.min(byH,byW))));
  /* Never NaN out of here. A zoom that is not a number is a page that is not
     a size, and every mark on it loses its place. */
  return Number.isFinite(z)?z:100;
}
function paintBookmarks(){
  $$('.sheetpg').forEach(el=>el.dataset.bm=bookmarks.has(+el.dataset.pg)?'1':'0');
}

/* ── the two trays ─────────────────────────────────────────────────── */
const LIV=ctx.liveries;
function fanCards(){
  return RECENT().map(([n,k,q],i)=>{
    const lines=[0,1,2,3,4,5,6].map(r=>`<i${r===2?` class="m" style="--k:${K[k]}"`:''}></i>`).join('');
    return `<button class="card" data-i="${i}" data-pg="${n}" data-q="${escA(q)}">
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
function trayMe(){
  /* COUNTED ONCE. The tray asked ctx.tally() three times while drawing
     itself, and the three answers come from a live store: a mark landing
     between two of them drew a tray whose tiles and whose Take-your-marks row
     disagreed about what the student had done. */
  const T=ctx.tally();
  return `
  <div class="me">
    <span class="av">${esc(ctx.me.i)}</span>
    <span class="who"><b>${esc(ctx.me.n)}</b><span>${esc(ctx.me.sub)}</span></span>
  </div>
  ${(()=>{const t=T;
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
  ${T.hl+T.rv?`<button class="rr" data-go="out"><span class="ic">${ico.dl}</span><b>Take your marks with you</b><span class="ch">${ico.ch}</span></button>`:''}
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
    const rest=()=>{cap.textContent='Hold a card to see the line you marked.'};
    /* ESCAPED, not interpolated raw. This was innerHTML over a passage taken
       straight out of the PDF — see esc() above for what that rendered. */
    const show=c=>{cap.innerHTML=`<b>${pad(+c.dataset.pg,TOTAL)}</b> &nbsp;${esc(c.dataset.q)}`};
    fan.addEventListener('pointerenter',()=>layoutFan(true));
    fan.addEventListener('pointerleave',()=>{layoutFan(false);rest()});
    /* "HOLD A CARD" WAS A HOVER, ON A FILE WRITTEN FOR AN IPAD. The copy asks
       the student to hold a card and the only listener was `pointerenter`, so
       on touch and on pen the caption never appeared at all — the card was
       simply tapped, the tray closed and the page moved. The hover stays for a
       mouse, and a real hold is added for everything else: hold for 400ms and
       the line appears, and the press that revealed it does not then also
       count as the tap that jumps the page. */
    $$('#fan .card').forEach(c=>c.addEventListener('pointerenter',e=>{
      if(e.pointerType==='mouse'||e.pointerType===undefined)show(c)}));
    let lpT=null,lpOn=false;
    const drop=()=>{clearTimeout(lpT);lpT=null;lpOn=false};
    fan.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse')return;
      const c=e.target.closest('.card');if(!c)return;
      lpOn=false;heldCard=false;layoutFan(true);
      lpT=setTimeout(()=>{lpT=null;lpOn=true;heldCard=true;show(c)},400);
    });
    /* the mouse is on the hover path and nowhere near this one: letting a
       mouse-up through here wipes the caption the hover had just written. */
    fan.addEventListener('pointerup',e=>{
      if(e.pointerType==='mouse')return;
      if(!lpOn)rest();drop()});
    fan.addEventListener('pointercancel',()=>{drop();rest()});
    /* a long press on a touch screen otherwise raises the system menu over
       the caption the long press was for */
    fan.addEventListener('contextmenu',e=>{if(lpT||lpOn)e.preventDefault()});
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
  open=null;heldCard=false;ISL.removeAttribute('data-open');
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
    /* a hold that revealed the caption is not also a tap that jumps the page */
    const c=e.target.closest('.card');if(c){if(heldCard){heldCard=false;return}
      goTo(+c.dataset.pg);closeTray();return}
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
    /* was `zoom=100`, which is not a fit — see fitZoom() */
    if(f){zoom=fitZoom();fit=true;applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    /* a quarter turn swaps which side of the page has to fit, so a fit that
       does not follow the rotation stops being one the moment you rotate. The
       tray is redrawn with it because the readout above these buttons is the
       zoom it just changed. */
    if(r){rot=(rot+(+r.dataset.r)*90)%360;if(fit)zoom=fitZoom();
          applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    if(bm){bookmarks.has(page)?bookmarks.delete(page):bookmarks.add(page);
           paintBookmarks();fillTray('page');ctx.onBookmark(page,bookmarks.has(page));return}
    if(k){R.dataset.look=k.dataset.look;fillTray('me');ctx.onLook(k.dataset.look);return}
    if(v){livery=v.dataset.lv;applyLivery();fillTray('me');ctx.onLivery(livery);return}
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
/* THE VIEW THE STUDENT LEFT, ACTUALLY RESTORED. `fit` was persisted and read
   back into a variable that nothing read, so a reader that was fitted when it
   closed opened at whatever zoom happened to be stored beside it. */
if(fit){
  zoom=fitZoom();
  /* AND THE SHELL IS TOLD. React sizes the spacers that stand in for pages it
     has not rendered yet from its own copy of the zoom, so a fit applied here
     and not reported left the spacers taller than the pages that replaced
     them — the document got shorter as you scrolled and the scrollbar
     jumped. Two owners of one number, told once. */
  ctx.onView(zoom,fit,rot);
}
/* applyLivery is new here: see the note on it above for what its absence did. */
applyPage();applyWarm();applyLivery();paintBookmarks();paintCounter(true);toRest();
/* a fit is a relationship to the room, so it has to be redone when the room
   changes — an iPad turned on its side, or the app's own chrome opening. */
addEventListener('resize',()=>{
  if(!fit)return;
  const z=fitZoom();if(z===zoom)return;
  zoom=z;applyPage();if(open==='page')fillTray('page');ctx.onView(zoom,fit,rot);
});
/* what the rest of the reader can ask the island to do */
return {
  goTo,
  page:()=>page,
  view:()=>({zoom,fit,rot}),
  bookmarks:()=>bookmarks,
  /* a page arriving from anywhere but the scroller — the panel, a deep link */
  setPage(n){if(n===page)return;page=n;paintCounter()},
  /* THE QUIET POLL WAS NOT QUIET. This lit the dot and then flashed `fresh`,
     which widens the island to 560px and takes the whole pill over for 3.6
     seconds — on a sixty-second timer, unasked, while the student is reading.
     marks.js:250 states the rule: the only thing the poll may do is light the
     dot. The dot IS the notification; pressing it pulls the marks in and
     arrived() below reports that, which is a confirmation the student caused.
     The count is kept so the message says the right number if the dot is
     pressed, or if the tool bar asks for it. */
  waiting(n){NEWN=n;pending=n>0;DOT.dataset.live=n>0?'1':'0'},
  /* they arrived. Say what came in, and from whom — this used to flash
     `mark`, the message for a mark the student had just made themselves. */
  arrived(n){NEWN=n;pending=false;DOT.dataset.live='0';flash('arrived',n>0?2600:1800)},
  /* something was taken back, or put back. The message is the whole of the
     acknowledgement: an undo on a page you are not looking at is otherwise
     silent, and the student is left unsure whether the key did anything. */
  undone(what,isRedo){UNDO.what=what;UNDO.redo=!!isRedo;flash('undo',isRedo?1400:2600)},
  say(name,ms,k){if(k&&MEAN[k])MARKK=k;flash(name,ms)},
  offline(v){v?flash('offline'):toRest()},
  /* the outbox emptied. Said once, and only when something actually went up */
  saved(n){if(n>0)flash('saved',2600)},
  repaint(){paintBookmarks();if(open)fillTray(open)},
};
}
