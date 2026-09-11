/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part 4 (the panel).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and `npm run check:paper` refuses if this file and the source have drifted.
 *
 * Changed from the handed-over file, and only this:
 *   - the first page and the paper's length come from the manifest
 *   - who wrote a mark is looked up, and a name that is not in the class is still a name
 *   - a page's heading comes from the paper's outline, and there are 1012 of them, not ten
 *   - the same lookup, for the heading over each page's group of marks
 *   - a note is a mark with something written on it, and there was nowhere to write it
 *   - and the card is where it is written, in the thread markup the card already has
 *   - a paper nobody has marked is not the same empty as a filter that matches nothing
 *   - the footer read "0 of 0 marks" on a paper nobody has marked, and this app never states a zero
 *   - a mark that lost its place is listed, which is the second half of a rule the first half already keeps
 *   - and they are listed even when nothing else matches, or they would hide behind an empty state
 *   - an instructor is a person with a staff badge, not an author id spelled 'tut'
 *   - an answer typed into a card is posted to the module thread the Ready Room shows
 *   - a filter chip reading 0 is a zero count, and this app never states one
 *   - a note's card has to open, or the box you write it in is display:none
 *   - and Save writes it, where Send answers a question
 *   - the panel's scroll handler does its work on the next frame too
 *   - the panel repaints when marks arrive, and the rest of the reader needs to be able to ask
 */

export function mountPanel(ctx){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),BODY=$('#body'),FILT=$('#filters'),PF=$('#pf'),Q=$('#q'),STAGE=$('#stage');
const FIRST=ctx.first, pad=n=>String(n).padStart(String(ctx.first+ctx.total-1).length,'0');
const K={y:'#F5C23C',b:'#5BB4F0',g:'#43C08A',p:'#B571E0',r:'#EE6F82'};
const MEAN={y:'Exam likely',b:'Definition',g:'Testable fact',p:'Question',r:'To revise'};
const PEOPLE=ctx.people;
/* The page grid is a window, not a document. HANDOVER, Making it feel
   smooth: never lay out the whole thing — on a 1012-page manual that is 1012
   cells, each one counting its own marks. ctx.gridPages() is the run of pages
   around where the student is, and paintPages() below still walks it with the
   map it was written against. */
const HEADS={map:f=>ctx.gridPages().map(pg=>f(ctx.head(pg),pg-ctx.first))};
const NPAGES=ctx.total;

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
        <i></i>${MEAN[k]}${n(k)?`<em>${n(k)}</em>`:''}</button>`).join('')}
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
        ${m.kind==='st'?`<span style="opacity:.7">struck out</span>`:''}
        ${m.kind==='note'&&!m.ask?`<span style="opacity:.7">no words yet</span>`:''}
      </span>
    </div>
    ${m.kind==='note'?`<div class="thr">
      ${m.ask?`<div class="ans"><span class="tx">${hi(m.ask)}</span></div>`:''}
      <div class="reply"><input placeholder="${m.ask?'Change what it says':'Write the note'}"
        value="${esc(m.ask||'')}" data-stop data-note><button data-stop>Save</button></div>
    </div>`:''}
    ${m.kind==='ask'?`<div class="thr">
      ${(m.ans||[]).map(a=>`<div class="ans">
        <span class="a ${PEOPLE[a.who]?.tut?'tut':''}">${PEOPLE[a.who]?PEOPLE[a.who].i:'??'}</span>
        <span class="tx"><b>${(PEOPLE[a.who]||{}).n||a.n||'Someone'}${PEOPLE[a.who]?.tut?'<em>answered</em>':''}</b>${esc(a.tx)}</span></div>`).join('')
      || `<div class="ans"><span class="tx" style="color:var(--txt-3)">No answers yet. Yours would be the first.</span></div>`}
      <div class="reply"><input placeholder="Answer this" data-stop><button data-stop>Send</button></div>
    </div>`:''}
  </div>`;
}
function paintList(){
  const ms=shown().sort((a,b)=>a.pg-b.pg);
  $('#cm').textContent=ms.length;$('#cp').textContent=NPAGES;
  if(!ms.length&&!ctx.orphans().length){
    /* TWO EMPTIES, AND TELLING A STUDENT THE WRONG ONE IS WORSE THAN
       SAYING NOTHING. "Try a wider filter" is advice you cannot take on a
       paper that has no marks on it at all, and every empty state has to name
       an action that exists (CLAUDE.md, Voice). So the fresh paper gets the
       action it actually has, and no count is stated either way. */
    const virgin = !WM.marks.length && !term && scope==='all' && !kinds.size;
    BODY.innerHTML = virgin
      ? `<div class="none"><b>Yours would be the first</b>
          <p>Select a line and mark it, and it will be here.</p></div>`
      : `<div class="none"><b>Nothing matches</b>
      <p>${term?`Nothing on this paper says &ldquo;${esc(term)}&rdquo;.`:'Try a wider filter.'}</p>
      <button data-clear>Clear the filters</button></div>`;
    return;
  }
  /* A LOST MARK IS ORPHANED, NEVER RELOCATED. resolveAnchor returns null
     rather than guessing, and the brief's other half is that the reader lists
     what lost its place — otherwise a mark simply vanishes and the student
     who wrote it never learns the passage was edited.

     They are drawn with the panel's own heading and card, above the pages,
     because an orphan has no page to sit under. Tapping one goes nowhere,
     which is correct: there is nowhere left to go. */
  const lost=ctx.orphans();
  const orphaned = lost.length
    ? `<div class="pgh"><b>&mdash;</b><span>these passages changed &mdash; mark them again</span><em>${lost.length}</em></div>`
      + lost.map(o=>`<div class="mcard" role="button" tabindex="0" style="--k:${K[o.k]||K.y}">
          <div class="qt">${hi(o.tx)}</div>
          <div class="mt"><span class="a">${(PEOPLE[o.who]||{}).i||'??'}</span>
            <b>${(PEOPLE[o.who]||{}).n||'Someone'}</b><span class="dot">&middot;</span>
            <span>${o.t}</span></div></div>`).join('')
    : '';
  const by={};ms.forEach(m=>{(by[m.pg]=by[m.pg]||[]).push(m)});
  BODY.innerHTML=orphaned+Object.keys(by).map(pg=>
    `<div class="pgh"><b>${pad(pg)}</b><span>${ctx.head(+pg)||''}</span><em>${by[pg].length}</em></div>`
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
  /* NEVER STATE ABSENCE OR A ZERO COUNT (CLAUDE.md, Voice). A fresh paper
     showed "0 of 0 marks" under a body already saying "Yours would be the
     first", and a filter matching nothing showed "0 of 12" under a body
     already saying "Nothing matches" — a zero twice over, and redundant both
     times. The count earns its place only when there is something to count. */
  PF.innerHTML=`${nw?`<span class="nw"><i></i>${nw} new since you looked</span>`
                   :ms.length?`<span>${ms.length===WM.marks.length
                       ?`${ms.length} mark${ms.length===1?'':'s'}`
                       :`${ms.length} of ${WM.marks.length} marks`}</span>`:''}
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
  const send=e.target.closest('.reply button');
  if(send){e.stopPropagation();
    const box=send.previousElementSibling, tx=box.value.trim();
    const id=send.closest('[data-m]').dataset.m;
    if(box.hasAttribute('data-note')){ctx.onNote(id,tx);return}
    if(tx){ctx.onAnswer(id,tx);box.value=''}
    return}
  if(e.target.closest('[data-stop]')){e.stopPropagation();return}
  if(e.target.closest('[data-clear]')){scope='all';kinds.clear();Q.value='';term='';
    $('#srchw').classList.remove('has');paint();return}
  const pc=e.target.closest('[data-pg]');
  if(pc){page=+pc.dataset.pg;window.readerGoTo&&window.readerGoTo(page);paintPages();return}
  const c=e.target.closest('[data-m]');if(!c)return;
  const m=WM.marks.find(x=>x.id===c.dataset.m);if(!m)return;
  page=m.pg;
  window.readerGoTo&&window.readerGoTo(m.pg,m.g);
  if(m.kind==='ask'||m.kind==='note'){open = open===m.id?null:m.id;paintList()}
  m.fresh=false;paintFoot();
});
PF.addEventListener('click',e=>{if(e.target.closest('[data-close]'))R.dataset.pan='0'});
$('#tab').addEventListener('click',()=>R.dataset.pan='1');
let scrollF=0;
STAGE.addEventListener('scroll',()=>{
  if(scrollF)return;
  scrollF=requestAnimationFrame(()=>{
    scrollF=0;
    let best=FIRST,bd=1e9;
    $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
      if(d<bd){bd=d;best=+el.dataset.pg}});
    if(best!==page){page=best;if(view==='pages')paintPages()}
  });
},{passive:true});

/* the panel always takes the edge the bar is not on */
function side(){R.dataset.side = R.dataset.bar==='right' ? 'left' : 'right'}
new MutationObserver(side).observe(R,{attributes:true,attributeFilter:['data-bar']});
side();

paint();
/* what the rest of the reader can ask the panel to do */
return {repaint:paint,page:()=>page};
}
