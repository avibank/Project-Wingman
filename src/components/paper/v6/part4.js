/* THE PANEL — search, the marks browser, the question threads and the page selector.
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
 *   the first page and the paper's length come from the manifest
 *   who wrote a mark is looked up, and a name that is not in the class is still a name
 *   a page's heading comes from the paper's outline, and there are 1012 of them, not ten
 *   the same lookup, for the heading over each page's group of marks
 *   a note is a mark with something written on it, and there was nowhere to write it
 *   and the card is where it is written, in the thread markup the card already has
 *   a paper nobody has marked is not the same empty as a filter that matches nothing
 *   the footer read "0 of 0 marks" on a paper nobody has marked, and this app never states a zero
 *   a mark that lost its place is listed, which is the second half of a rule the first half already keeps
 *   and they are listed even when nothing else matches, or they would hide behind an empty state
 *   an instructor is a person with a staff badge, not an author id spelled 'tut'
 *   an answer typed into a card is posted to the module thread the Ready Room shows
 *   a filter chip reading 0 is a zero count, and this app never states one
 *   a note's card has to open, or the box you write it in is display:none
 *   a text box is written on its card too, and a fresh one should already be open
 *   and Save writes it, where Send answers a question
 *   the panel's scroll handler does its work on the next frame too
 *   the panel repaints when marks arrive, and the rest of the reader needs to be able to ask
 *   the search box searches the paper as well as the marks on it, which is what its placeholder promises
 *   and the two empties it can now reach are told apart
 *   the tab badge is the number of new marks, never a number written into the shell
 *   your own mark can be edited and deleted, and somebody else's can be agreed with
 *   ownership is m.who and anonymity is m.anon, so your own question is yours and still shows as Anonymous
 */

export function mountPanel(ctx){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const R=$('#rdr'),BODY=$('#body'),FILT=$('#filters'),PF=$('#pf'),Q=$('#q'),STAGE=$('#stage');
/* THE SAME PAGE-NUMBER FORMAT AS EVERYWHERE ELSE. This padded to the width of
   the last page while the sheet's own corner padded to at least four, so page
   three of a twelve-page paper was "03" in the panel and "0003" on the page it
   points at. The island's pad now uses the wider rule and so does this. */
/* the same rule as the island's, so the two never disagree about a page */
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

/* OWNERSHIP AND ANONYMITY ARE TWO DIFFERENT FACTS, AND ONE FIELD WAS CARRYING
   BOTH. A question's `who` was set to 'anon' whatever its author, so your own
   question was not yours: Mine excluded it and Class included it, and the
   student who asked it could not find it in the one scope that is theirs.
   marks.js now says who wrote a mark in `who` and whether it must be shown
   without a name in `anon`, so the filters below read `who` and only the
   drawing reads `anon`. A red mark stays private on `who` as it always did —
   see isVisible — and nothing here shows one to anybody else. */
const anonOf=m=>m.anon===true||m.who==='anon';
/* who it is FOR THE PURPOSE OF DRAWING IT. Yours is still yours to you, which
   is how you can tell which of the anonymous questions you asked. */
const who=m=>anonOf(m)&&m.who!=='me'
  ? {n:'Anonymous',i:'??'}
  : (PEOPLE[m.who]||{n:'Someone',i:'??'});
const isMine=m=>m.who==='me'||(ctx.mine?ctx.mine(m.id):false);
function isVisible(m){
  if(scope==='mine'&&m.who!=='me')return false;
  if(scope==='class'&&(m.who==='me'||m.k==='r'))return false;
  if(scope==='q'&&m.kind!=='ask')return false;
  if(scope==='rev'&&m.k!=='r')return false;
  if(m.k==='r'&&m.who!=='me')return false;            /* red is private, always */
  if(kinds.size&&!kinds.has(m.k))return false;
  if(term){
    /* the name that is searched is the name that is SHOWN. Searching the real
       author of an anonymous question would answer a question the card
       deliberately does not — type a classmate's name and watch which
       anonymous questions appear. */
    const hay=(m.tx+' '+(m.ask||'')+' '+who(m).n+' '+MEAN[m.k]).toLowerCase();
    if(!hay.includes(term))return false;
  }
  return true;
}
const shown=()=>WM.marks.filter(isVisible);
const esc=t=>String(t==null?'':t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
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
/* AGREEING EXISTED EVERYWHERE EXCEPT ON THE CARD. `agree_with_mark` has been
   in migration 0018 since the rebuild, `agreeWithMark()` has been in
   src/lib/annotations.js beside it, and `agree_count` has been a column
   nothing read — because the one control that would have called any of it was
   never drawn. The locked design asks for reply/agree on other people's marks
   and edit/delete on your own, so both go in the meta row using `.rt .n`, the
   class the answer count beside them already uses.

   Never a zero: with no agreements yet the control is the invitation to be
   the first, not a count of nothing. */
const agreeLabel=m=>{
  const n=m.agree||0;
  if(m.iAgree)return n>1?`You and ${n-1} other${n-1===1?'':'s'} agree`:'You agree';
  return n?(n===1?'1 agrees':`${n} agree`):'Agree';
};
/* A DELETE THAT HAPPENS ON ONE TAP IS A TRAP in a list you scroll with your
   thumb, and the design has no room for a dialogue. The button asks once, in
   place, and forgets after a few seconds. */
let armed=null, armT=null;
function card(m){
  const p=who(m), anon=anonOf(m), isOpen=open===m.id, mine=isMine(m);
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
        ${(m.kind==='note'||m.kind==='txt')&&!m.ask?`<span style="opacity:.7">no words yet</span>`:''}
        ${m.kind==='txt'?`<span style="opacity:.7">on the page</span>`:''}
        ${mine
          ? `<button class="n" data-del="${m.id}" style="${armed===m.id?'color:var(--warn,#EE6F82)':''}">${armed===m.id?'Delete it?':'Delete'}</button>`
          : `<button class="n" data-agree="${m.id}" style="${m.iAgree?'color:var(--lv)':''}">${agreeLabel(m)}</button>`}
      </span>
    </div>
    ${(m.kind==='note'||m.kind==='txt')?`<div class="thr">
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
/* THE BOX SAYS "Search the paper, a mark, or a name" AND IT SEARCHED THE
   MARKS. The haystack in isVisible is a mark's text, its question, its
   author's name and its meaning — so on a paper nobody had marked yet,
   searching a word printed on page three answered "Nothing on this paper says
   'bolt'", about a paper that says it on page three. ctx.findInPaper() returns
   the shell's extracted text, already attributed to a page, so the hits are
   drawn above the marks under their own heading and tapping one goes there. */
function paperHits(){
  if(!term||!ctx.findInPaper)return [];
  try{return ctx.findInPaper(term)||[]}catch{return []}
}
function hitCard(h){
  return `<div class="mcard" role="button" tabindex="0" data-ppg="${h.page}" style="--k:var(--lv)">
    <div class="qt">${esc(h.before||'')}<span class="mk">${esc(h.hit||'')}</span>${esc(h.after||'')}</div>
    <div class="mt"><b>Page ${pad(h.page)}</b><span class="dot">&middot;</span>
      <span>in the paper itself</span></div>
  </div>`;
}
function paintList(){
  const ms=shown().sort((a,b)=>a.pg-b.pg);
  const hits=paperHits();
  /* A ZERO ON THE TAB IS STILL A ZERO (CLAUDE.md, Voice). The Marks tab wrote
     whatever shown() counted straight into its badge, so a filter that matched
     nothing — or a paper nobody had marked — put a literal 0 beside the word
     Marks, under a body already saying so in a sentence. */
  $('#cm').textContent=ms.length||'';$('#cp').textContent=NPAGES||'';
  const found = hits.length
    ? `<div class="pgh"><b>&mdash;</b><span>printed on the paper &mdash; tap to go there</span><em>${hits.length}</em></div>`
      + hits.map(hitCard).join('')
    : '';
  if(!ms.length&&!ctx.orphans().length&&!hits.length){
    /* TWO EMPTIES, AND TELLING A STUDENT THE WRONG ONE IS WORSE THAN
       SAYING NOTHING. "Try a wider filter" is advice you cannot take on a
       paper that has no marks on it at all, and every empty state has to name
       an action that exists (CLAUDE.md, Voice). So the fresh paper gets the
       action it actually has, and no count is stated either way. */
    const virgin = !WM.marks.length && !term && scope==='all' && !kinds.size;
    BODY.innerHTML = virgin
      ? `<div class="none"><b>Yours would be the first</b>
          <p>Select a line and mark it, and it will be here.</p></div>`
      /* THE SENTENCE IS TRUE NOW, WHICH IT WAS NOT BEFORE. "Nothing on this
         paper says 'bolt'" was said about a paper that said it on page
         three — the search had only ever looked at the marks. Reaching here
         with a term means the paper's own text was searched too and neither
         it nor any visible mark carries the word, so the copy stands; it is
         only claimed when there was actually a paper to search. */
      : `<div class="none"><b>Nothing matches</b>
      <p>${term&&ctx.findInPaper?`Nothing on this paper says &ldquo;${esc(term)}&rdquo;.`
          :term?`Try another word, or clear this and browse the marks.`
          :'Try a wider filter.'}</p>
      <button data-clear>Clear the filters</button></div>`;
    return;
  }
  /* THREE EMPTIES NOW, NOT TWO, and the new one is the one worth telling
     apart: the paper says the word and nobody has marked it. That is an
     invitation, not a dead end, so it names the thing to do with the hits
     sitting right above it. */
  const nothingMarked = !ms.length && !ctx.orphans().length && hits.length
    ? `<div class="none"><b>Yours would be the first</b>
        <p>The paper says it on ${hits.length===1?'the page above':'the pages above'} &mdash;
           go there, select the line and mark it.</p></div>`
    : '';
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
  BODY.innerHTML=found+nothingMarked+orphaned+Object.keys(by).map(pg=>
    `<div class="pgh"><b>${pad(pg)}</b><span>${ctx.head(+pg)||''}</span><em>${by[pg].length}</em></div>`
    + by[pg].map(card).join('')).join('');
}
function paintPages(){
  $('#cm').textContent=shown().length||'';$('#cp').textContent=NPAGES||'';
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
  /* THE BADGE IS COUNTED, NEVER WRITTEN DOWN. ReaderV6.jsx shipped a literal
     <b id="tabn">3</b> and this line only overwrites it once mountPanel has
     run, which the shell gates on the text layer being ready — so a paper
     with nothing new on it wore a badge reading 3 until the PDF finished
     loading. It is also counted OUTSIDE the current filter: the badge belongs
     to the closed tab and has to mean "new marks on this paper", not "new
     marks that survive the filter you left set". Red stays private in the
     count as it is everywhere else, and a zero is drawn as nothing at all. */
  const news=WM.marks.filter(m=>m.fresh&&(m.k!=='r'||m.who==='me')).length;
  const t=$('#tabn');
  if(t){t.textContent=news||'';t.style.display=news?'grid':'none'}
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
  /* a paper hit has no mark behind it — there is only a page to go to */
  const ph=e.target.closest('[data-ppg]');
  if(ph){page=+ph.dataset.ppg;window.readerGoTo&&window.readerGoTo(page);return}
  /* AGREE AND DELETE, the two controls the card never had. Both stop here:
     they sit inside the card, and the card's own handler jumps the page. */
  const ag=e.target.closest('[data-agree]');
  if(ag){e.stopPropagation();
    const m=WM.marks.find(x=>x.id===ag.dataset.agree);if(!m)return;
    m.iAgree=!m.iAgree;m.agree=Math.max(0,(m.agree||0)+(m.iAgree?1:-1));
    ctx.onAgree&&ctx.onAgree(m.id,m.iAgree);
    paintList();return}
  const del=e.target.closest('[data-del]');
  if(del){e.stopPropagation();
    const id=del.dataset.del;
    clearTimeout(armT);
    if(armed!==id){armed=id;armT=setTimeout(()=>{armed=null;paintList()},4000);paintList();return}
    armed=null;ctx.onDeleteMark&&ctx.onDeleteMark(id);paintList();return}
  const send=e.target.closest('.reply button');
  if(send){e.stopPropagation();
    const box=send.previousElementSibling, tx=box.value.trim();
    const id=send.closest('[data-m]').dataset.m;
    /* SAVE HAD TO ACTUALLY SAVE. The note goes through ctx.onNote, which
       writes it and repaints — the box keeps what was typed because it is the
       mark's words now, not a draft. */
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
  if(m.kind==='ask'||m.kind==='note'||m.kind==='txt'){open = open===m.id?null:m.id;paintList()}
  m.fresh=false;paintFoot();
});
/* A BOX YOU TYPE IN AND PRESS RETURN ON. The only way to save a note or post
   an answer was to reach for the small word beside the box, which on a
   keyboard is the one thing nobody does — so a typed note was lost to the
   next repaint and looked like a save that had failed. */
BODY.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const box=e.target.closest('.reply input');if(!box)return;
  e.preventDefault();e.stopPropagation();
  const holder=box.closest('[data-m]');if(!holder)return;
  const tx=box.value.trim();
  if(box.hasAttribute('data-note')){ctx.onNote(holder.dataset.m,tx);return}
  if(tx){ctx.onAnswer(holder.dataset.m,tx);box.value=''}
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
return {repaint:paint,page:()=>page,
  /* THE THREE YOU TILES LAND HERE. They used to call ctx.onGo, which fell
     through to "remember my place in this paper" and wrote the filter's name
     in as a page number. Each one opens the panel on the filter it names. */
  show(what){
    R.dataset.pan='1';
    if(what==='bm'){view='pages';paint();return}
    scope = what==='rv' ? 'rev' : 'mine';
    if(view!=='marks'){view='marks'}
    R.dataset.pan='1';
    paint();
  },
  /* A mark that has just been placed and wants typing into: open its card and
     put the cursor in it, so the student is writing rather than hunting. */
  openNewest(){const m=WM.marks[WM.marks.length-1];if(!m)return;
    open=m.id;paintList();
    const box=BODY.querySelector('[data-m="'+m.id+'"] .reply input');
    if(box){box.focus();box.scrollIntoView({block:'nearest'})}}};
}
