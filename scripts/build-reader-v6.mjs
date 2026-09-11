#!/usr/bin/env node
/* docs/reader/v6/reader.js → src/components/paper/v6/part{1,2,3,4}.js
 *
 * HANDOVER.md, "The one rule": the chrome is finished, copy it. So it is
 * copied, by a script, and every departure from the handed-over file is a row
 * in the table below with the reason written next to it. Nothing is edited by
 * hand, so nothing can drift quietly, and a v7 drop is one path change away.
 *
 * The four parts become four ES modules exporting a mount function. Their
 * bodies are byte-identical to the source except for the EDITS below, and
 * `--verify` proves it: it re-derives each module from the source and refuses
 * if the file on disk differs.
 *
 * WHAT IS NOT EDITED HERE, AND WHY IT DOES NOT NEED TO BE
 *
 * The parts bind listeners to `window` and `document`, and never take them
 * off. In the demo that is correct — the page is the reader. Here the reader
 * is a route, and a listener that outlives it fires against elements that are
 * gone. The obvious fix is to edit every registration to carry an
 * AbortSignal; that is ~25 edits across three parts, each one a place the
 * chrome could drift from the file it was copied from.
 *
 * Instead the SHELL records them. Every one of these registrations happens
 * synchronously while the closure runs, so mounting inside `capture()` (see
 * mount.js) catches all of them and none of anybody else's. The parts stay
 * verbatim and the teardown is complete. Same trick for MutationObserver and
 * for the timers.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "docs/reader/v6/reader.js");
const OUT = join(ROOT, "src/components/paper/v6");
const VERIFY = process.argv.includes("--verify");

const source = readFileSync(SRC, "utf8");
const lines = source.split("\n");

/* ── slicing ───────────────────────────────────────────────────────────
   By the markers the file itself writes, not by line number, so a comment
   added above a part cannot silently shift the cut. */
function sliceAt(startNeedle, endNeedle, from) {
  const s = lines.findIndex((l, i) => i >= from && l === startNeedle);
  if (s < 0) throw new Error(`REFUSING: cannot find the start of a part: ${startNeedle}`);
  const e = lines.findIndex((l, i) => i > s && l === endNeedle);
  if (e < 0) throw new Error(`REFUSING: cannot find the end of a part after line ${s}`);
  return { body: lines.slice(s + 1, e).join("\n"), end: e };
}

const one = lines.findIndex((l) => l.startsWith("window.WM="));
const oneEnd = lines.findIndex((l, i) => i >= one && l.trim().endsWith("emit(){this.subs.forEach(f=>{try{f()}catch(e){}})}};"));
if (one < 0 || oneEnd < 0) throw new Error("REFUSING: cannot find part 1");
const PART1 = lines.slice(one, oneEnd + 1).join("\n");

const p2 = sliceAt("(function(){", "})();", lines.findIndex((l) => l.includes("2 · the island")));
const p3 = sliceAt("(function(){", "})();", lines.findIndex((l) => l.includes("3 · the tool bar")));
const p4 = sliceAt("(function(){", "})();", lines.findIndex((l) => l.includes("4 · the panel")));

/* ── the edits ─────────────────────────────────────────────────────────
   Every one is asserted to match exactly once. An edit that stops matching
   because the source moved is a hard failure, not a silent skip. */
const EDITS = [
  /* ══ part 2 · the island ══════════════════════════════════════════ */
  {
    part: 2,
    why: "the paper's name, length and first page come from the manifest, not from a constant",
    find: `const DOC='LTT B1-11', TOTAL=1012, FIRST=126;`,
    replace: `const DOC=ctx.doc, TOTAL=ctx.total, FIRST=ctx.first;`,
  },
  {
    part: 2,
    why: "where the student left off, and what they had set — read once at mount, written back through ctx",
    find: `let page=FIRST, zoom=100, fit=true, rot=0, warm=0, livery='#4C8DF6',
    cur=null, holdT=null, pending=false, open=null, jumpFrom=null,
    bookmarks=new Set([129]);`,
    replace: `let page=ctx.page||FIRST, zoom=ctx.zoom||100, fit=ctx.fit!==false, rot=ctx.rot||0,
    warm=ctx.warm||0, livery=ctx.livery||'#4C8DF6',
    cur=null, holdT=null, pending=false, open=null, jumpFrom=null,
    bookmarks=new Set(ctx.bookmarks||[]);`,
  },
  {
    part: 2,
    why: "HANDOVER section 1 — the stand-in paper. React renders the stage from PDF.js in the same element shape",
    findLines: ["const PAGES=[", "  <span class=\"pgno\">${pad(FIRST+i,TOTAL)}</span></article>`).join('');"],
    replace: `/* HANDOVER section 1: the stand-in paper was here. The stage is rendered
   by ReaderV6.jsx from PDF.js, in the element shape the handover fixes —
   article.sheetpg[data-pg] · .bmk · svg.ink · .marks · canvas · .textLayer
   · .pgno — so every query below still finds what it is looking for. */`,
  },
  {
    part: 2,
    why: "the last five places are the student's own most recent marks",
    findLines: ["const RECENT=[", " [132,'r','Come back to this — the flare timing still is not sticking.']];"],
    replace: `const RECENT=ctx.recent||[];`,
  },
  {
    part: 2,
    why: "who the student is, and what they have actually done on this paper",
    find: `    <span class="av">CA</span>
    <span class="who"><b>Claire</b><span>AU University · Module 11 · B2</span></span>`,
    replace: `    <span class="av">\${ctx.me.i}</span>
    <span class="who"><b>\${ctx.me.n}</b><span>\${ctx.me.sub}</span></span>`,
  },
  {
    part: 2,
    why: "the tallies are counted, not written down",
    find: `    <button class="tal" data-go="hl" style="--k:\${K.y}"><b>284</b><span>Highlights</span></button>
    <button class="tal" data-go="bm" style="--k:var(--lv)"><b>12</b><span>Bookmarks</span></button>
    <button class="tal" data-go="rv" style="--k:\${K.r}"><b>31</b><span>To revise</span><em>only you</em></button>`,
    replace: `    <button class="tal" data-go="hl" style="--k:\${K.y}"><b>\${ctx.tally().hl}</b><span>Highlights</span></button>
    <button class="tal" data-go="bm" style="--k:var(--lv)"><b>\${ctx.tally().bm}</b><span>Bookmarks</span></button>
    <button class="tal" data-go="rv" style="--k:\${K.r}"><b>\${ctx.tally().rv}</b><span>To revise</span><em>only you</em></button>`,
  },
  {
    part: 2,
    why: "the livery list is the app's five, and the app owns which one is current",
    find: `const LIV=['#4C8DF6','#E0654A','#43C08A','#C9922E','#8C86EE','#4FB8C4'];`,
    replace: `const LIV=ctx.liveries;`,
  },
  {
    part: 2,
    why: "zoom, fit and rotation move every mark on the page — HANDOVER section 3 asks for exactly this call",
    find: `    if(z){zoom=Math.min(220,Math.max(60,zoom+(+z.dataset.z)*10));fit=false;applyPage();fillTray('page');return}
    if(f){zoom=100;fit=true;applyPage();fillTray('page');return}
    if(r){rot=(rot+(+r.dataset.r)*90)%360;applyPage();return}
    if(bm){bookmarks.has(page)?bookmarks.delete(page):bookmarks.add(page);
           paintBookmarks();fillTray('page');return}
    if(k){R.dataset.look=k.dataset.look;fillTray('me');return}
    if(v){livery=v.dataset.lv;R.style.setProperty('--lv',livery);fillTray('me');return}
    if(go){closeTray();flash(go.dataset.go==='rr'?'note':'mark',900);return}`,
    replace: `    if(z){zoom=Math.min(220,Math.max(60,zoom+(+z.dataset.z)*10));fit=false;applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    if(f){zoom=100;fit=true;applyPage();fillTray('page');ctx.onView(zoom,fit,rot);return}
    if(r){rot=(rot+(+r.dataset.r)*90)%360;applyPage();ctx.onView(zoom,fit,rot);return}
    if(bm){bookmarks.has(page)?bookmarks.delete(page):bookmarks.add(page);
           paintBookmarks();fillTray('page');ctx.onBookmark(page,bookmarks.has(page));return}
    if(k){R.dataset.look=k.dataset.look;fillTray('me');ctx.onLook(k.dataset.look);return}
    if(v){livery=v.dataset.lv;R.style.setProperty('--lv',livery);fillTray('me');ctx.onLivery(livery);return}
    if(go){closeTray();ctx.onGo(go.dataset.go);return}`,
  },
  {
    part: 2,
    why: "warmth is a setting, and settings save locally first",
    find: `    wr.addEventListener('input',()=>{warm=+wr.value;applyWarm();place();`,
    replace: `    wr.addEventListener('input',()=>{warm=+wr.value;applyWarm();place();ctx.onWarm(warm);`,
  },
  {
    part: 2,
    why: "pressing the dot is what pulls the waiting marks in — the poll may only light it",
    find: `  if(e.target.closest('#dot')){
    if(pending){pending=false;DOT.dataset.live='0';flash('mark',1400)}
    return;
  }
  if(cur==='fresh'){pending=false;DOT.dataset.live='0';flash('mark',1400);return}`,
    replace: `  if(e.target.closest('#dot')){
    if(pending){pending=false;DOT.dataset.live='0';ctx.onPull()}
    return;
  }
  if(cur==='fresh'){pending=false;DOT.dataset.live='0';ctx.onPull();return}`,
  },
  {
    part: 2,
    why: "the way-back banner sat there until you dismissed it by hand, or forever",
    find: `BACKP.addEventListener('click',e=>{`,
    replace: `/* IT GOES WHEN YOU CARRY ON READING. "Back to 0126" is an offer, and an
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
BACKP.addEventListener('click',e=>{`,
  },
  {
    part: 2,
    why: "and it says so for a while rather than for ever",
    find: `function raiseBack(from){jumpFrom=from;BACKL.textContent='Back to '+pad(from,TOTAL);BACKP.classList.add('on')}`,
    replace: `function raiseBack(from){jumpFrom=from;BACKL.textContent='Back to '+pad(from,TOTAL);BACKP.classList.add('on');
  clearTimeout(backT);backT=setTimeout(()=>BACKP.classList.remove('on'),12000)}`,
  },
  {
    part: 2,
    why: "the closed tray kept six buttons in the tab order behind a 36px island",
    find: `function closeTray(){
  open=null;ISL.removeAttribute('data-open');`,
    replace: `function closeTray(){
  open=null;ISL.removeAttribute('data-open');
  /* Clipped is not gone. With the island back to 36px the tray's controls are
     invisible and still focusable, so tabbing through the reader walks into
     six buttons nobody can see. */
  TRAY.inert=true;`,
  },
  {
    part: 2,
    why: "and hands them back when it opens",
    find: `  open=kind;ISL.dataset.open=kind;`,
    replace: `  open=kind;ISL.dataset.open=kind;TRAY.inert=false;`,
  },
  {
    part: 2,
    why: "the fanned deck read the student's last five places once, at mount, when there were none",
    find: `const RECENT=ctx.recent||[];`,
    replace: `/* ASKED EACH TIME IT IS DRAWN. Read once into a constant, this was whatever
   the reader knew at mount — which is nothing, because the marks arrive after
   it — so "Where you have been" was permanently empty however much you
   marked. Same for the tallies below. */
const RECENT=()=>ctx.recent();`,
  },
  {
    part: 2,
    why: "and the deck draws from the call",
    find: `  return RECENT.map(([n,k,q],i)=>{`,
    replace: `  return RECENT().map(([n,k,q],i)=>{`,
  },
  {
    part: 2,
    why: "a tally of nothing is a zero count, and this app never states one",
    find: `  <div class="tally">
    <button class="tal" data-go="hl" style="--k:\${K.y}"><b>\${ctx.tally().hl}</b><span>Highlights</span></button>
    <button class="tal" data-go="bm" style="--k:var(--lv)"><b>\${ctx.tally().bm}</b><span>Bookmarks</span></button>
    <button class="tal" data-go="rv" style="--k:\${K.r}"><b>\${ctx.tally().rv}</b><span>To revise</span><em>only you</em></button>
  </div>`,
    replace: `  \${(()=>{const t=ctx.tally();
    const tiles=[
      t.hl&&\`<button class="tal" data-go="hl" style="--k:\${K.y}"><b>\${t.hl}</b><span>Highlight\${t.hl===1?'':'s'}</span></button>\`,
      t.bm&&\`<button class="tal" data-go="bm" style="--k:var(--lv)"><b>\${t.bm}</b><span>Bookmark\${t.bm===1?'':'s'}</span></button>\`,
      t.rv&&\`<button class="tal" data-go="rv" style="--k:\${K.r}"><b>\${t.rv}</b><span>To revise</span><em>only you</em></button>\`,
    ].filter(Boolean);
    /* NEVER STATE ABSENCE OR A ZERO COUNT. Three tiles reading 0, 0, 0 is the
       reader telling a student they have done nothing, three times. A tile
       appears when it has something in it, and when none of them does the
       space says what to do instead. */
    return tiles.length
      ? \`<div class="tally">\${tiles.join('')}</div>\`
      : \`<div class="lab" style="margin-top:12px">Mark a line and it lands here</div>\`;
  })()}`,
  },
  {
    part: 2,
    why: "the Redo button in the undo message is a button, and in the demo it only dismissed the message",
    find: `  if(cur==='fresh'){pending=false;DOT.dataset.live='0';ctx.onPull();return}`,
    replace: `  if(cur==='fresh'){pending=false;DOT.dataset.live='0';ctx.onPull();return}
  if(cur==='undo'&&e.target.closest('.act')){ctx.onRedo();return}`,
  },
  {
    part: 2,
    why: "HANDOVER, Making it feel smooth: do no work in a scroll handler. Read, store, act on the next frame",
    find: `STAGE.addEventListener('scroll',()=>{
  let best=FIRST,bd=1e9;
  $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
    if(d<bd){bd=d;best=+el.dataset.pg}});
  if(best!==page){page=best;paintCounter()}
},{passive:true});`,
    replace: `let scrollF=0;
STAGE.addEventListener('scroll',()=>{
  if(scrollF)return;
  scrollF=requestAnimationFrame(()=>{
    scrollF=0;
    let best=FIRST,bd=1e9;
    $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
      if(d<bd){bd=d;best=+el.dataset.pg}});
    if(best!==page){page=best;paintCounter();ctx.onPage(page)}
  });
},{passive:true});`,
  },
  {
    part: 2,
    why: "HANDOVER section 5 — the demo strip and the states it fires",
    findLines: ["$('#fire').addEventListener('click',e=>{", "});"],
    replace: `/* HANDOVER section 5: the demo's "fire a state" panel was here. */`,
  },
  {
    part: 2,
    why: "HANDOVER section 5 — the demo strip's own controls",
    findLines: ["$('#demoBtn').addEventListener('click',()=>R.dataset.demo='1');", "});"],
    replace: `/* HANDOVER section 5: the demo controls were here. Where the bar sits and
   which look is on are the student's settings now, not demo switches. */`,
  },
  {
    part: 2,
    why: "the island has to be told things from outside: a new page, a pull waiting, a message",
    find: `applyPage();applyWarm();paintBookmarks();paintCounter(true);toRest();`,
    replace: `applyPage();applyWarm();paintBookmarks();paintCounter(true);toRest();
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
};`,
  },

  /* ══ part 3 · the tool bar ════════════════════════════════════════ */
  {
    part: 3,
    why: "HANDOVER section 5 — SEED and seed(). findRange() stays: the anchoring fallback needs it",
    findLines: ["const SEED=[", " [135,'r','hl','me','3 days ago','Applying it above that figure overheats the disc and can distort it']];"],
    replace: `/* HANDOVER section 5: SEED was here. The class's marks are fetched by
   marks.js and pushed through WM.add, and laid out by relayout(). */`,
  },
  {
    part: 3,
    why: "HANDOVER section 5 — seed() goes, and with it the load hook that ran it",
    findLines: ["function seed(){", "if(document.readyState==='complete')setTimeout(seed,120);"],
    replace: `/* seed() was here. What it did — find the quote, lay one box per line of the
   resulting Range — is what relayout() in marks.js does for every mark, from
   a stored text anchor rather than a hard-coded string, on every layout
   change rather than once at load. */`,
  },
  {
    part: 3,
    why: "a three-character floor is right for a stray drag and wrong for a deliberate tap",
    find: `  if(String(r).trim().length<3)return hideSel();`,
    replace: `  if(!tapped&&String(r).trim().length<3)return hideSel();`,
  },
  {
    part: 3,
    why: "the cursor is the most versatile tool and only did one of the three things a reader expects of it",
    find: `function showSel(){`,
    replace: `/* ── what a cursor is for ──────────────────────────────────────────────
   A real reader gives you three gestures on the same tool and the handed-over
   file has one. Drag selects, and that is all it does: a tap does nothing at
   all, and a drag ends wherever the pointer happened to stop, mid-word.

   So: TAP takes the word under you. TAP AGAIN takes the sentence. DRAG stays
   exact inside a single word and snaps to whole words the moment it crosses
   one — which is what Preview, Acrobat and Drawboard all do, and what makes a
   drag feel accurate even though a finger is not.

   The word test is deliberately generous: letters, digits, apostrophes and
   hyphens, so "trace-based" and "rotor's" are each one word rather than two
   and a half. */
const WORDCH=/[\\p{L}\\p{N}'\\u2019-]/u;
/* Where the press started, and whether it travelled far enough to be a drag.
   Four pixels is about the wobble a finger leaves on a tap. */
let tapAt=null, tapMoved=false;
addEventListener('pointerdown',e=>{tapAt=[e.clientX,e.clientY];tapMoved=false},true);
addEventListener('pointermove',e=>{
  if(!tapAt)return;
  if(Math.hypot(e.clientX-tapAt[0],e.clientY-tapAt[1])>4)tapMoved=true;
},true);
function caretAt(x,y){
  if(document.caretRangeFromPoint)return document.caretRangeFromPoint(x,y);
  if(document.caretPositionFromPoint){
    const p=document.caretPositionFromPoint(x,y); if(!p)return null;
    const r=document.createRange();r.setStart(p.offsetNode,p.offset);r.collapse(true);return r;
  }
  return null;
}
function growWord(node,from,to){
  const t=node.nodeValue; let a=from,b=to;
  while(a>0&&WORDCH.test(t[a-1]))a--;
  while(b<t.length&&WORDCH.test(t[b]))b++;
  return [a,b];
}
function wordAt(x,y){
  const c=caretAt(x,y); if(!c)return null;
  const node=c.startContainer; if(!node||node.nodeType!==3)return null;
  if(!node.parentElement||!node.parentElement.closest('.textLayer'))return null;
  const t=node.nodeValue,i=c.startOffset;
  /* A tap in the gap between two words belongs to neither. */
  if(!WORDCH.test(t[i]||'')&&!WORDCH.test(t[i-1]||''))return null;
  const [a,b]=growWord(node,i,i);
  if(b<=a)return null;
  const r=document.createRange();r.setStart(node,a);r.setEnd(node,b);return r;
}
function sentenceAt(x,y){
  const c=caretAt(x,y); if(!c)return null;
  const node=c.startContainer; if(!node||node.nodeType!==3)return null;
  if(!node.parentElement||!node.parentElement.closest('.textLayer'))return null;
  const t=node.nodeValue; let a=c.startOffset,b=c.startOffset;
  while(a>0&&!'.!?'.includes(t[a-1]))a--;
  while(b<t.length&&!'.!?'.includes(t[b]))b++;
  if(b<t.length)b++;
  while(a<b&&/\\s/.test(t[a]))a++;
  if(b<=a)return null;
  const r=document.createRange();r.setStart(node,a);r.setEnd(node,b);return r;
}
/* Grow a dragged selection out to whole words — but only once it has already
   crossed one. Inside a single word the student is being precise on purpose
   and snapping would take that away. */
function snapToWords(r){
  if(!/\\s/.test(String(r)))return r;
  const s=r.startContainer,e=r.endContainer;
  if(s.nodeType===3){const [a]=growWord(s,r.startOffset,r.startOffset);r.setStart(s,a)}
  if(e.nodeType===3){const [,b]=growWord(e,r.endOffset,r.endOffset);r.setEnd(e,b)}
  return r;
}
function showSel(tapped){`,
  },
  {
    part: 3,
    why: "a tap on the words did nothing at all, which is the first thing anyone tries",
    find: `STG.addEventListener('click',e=>{
  if(R.dataset.sel!=='1')return;
  const q=markAt(e.clientX,e.clientY); if(!q)return;`,
    replace: `STG.addEventListener('click',e=>{
  if(R.dataset.sel!=='1')return;
  const q=markAt(e.clientX,e.clientY);
  if(!q){
    /* TAP TAKES THE WORD, TAP AGAIN TAKES THE SENTENCE. Nothing at all
       happened here before, on the tool a reader spends most of its time
       holding. A tap that lands on neither a word nor a mark clears what is
       in hand, which is the other half of the same gesture. */
    /* A DRAG IS TOLD FROM A TAP BY THE POINTER, not by what is selected.
       Asking the selection was wrong twice over: the browser collapses it
       somewhere between mousedown and click, and it still holds the PREVIOUS
       selection when a fresh press lands — so a tap after any earlier
       selection was read as the end of a drag and did nothing. */
    if(tapMoved)return;
    /* "Anywhere" means you do not have to select first: one tap takes the
       sentence you tapped and the tool attaches to that. "On a passage" is
       the other variant and is the drag you already have. */
    const anywhere=TEXT.includes(S.tool)&&(S.variant[S.tool]||0)===0;
    const r=(anywhere||e.detail>=2)
      ?sentenceAt(e.clientX,e.clientY):wordAt(e.clientX,e.clientY);
    if(!r){hideSel();return}
    const g=getSelection();g.removeAllRanges();g.addRange(r);
    /* Told that this came from a tap, so the three-character floor below does
       not throw away a deliberate press on a short word — "if", "on", "no" are
       exactly the words a student underlines in a regulation. */
    setTimeout(()=>showSel(true),0);
    return;
  }`,
  },
  {
    part: 3,
    why: "the pill and the back banner floated until something else happened to them",
    find: `/* pressing the pill must not collapse the selection under it */`,
    replace: `/* NOTHING FLOATS FOREVER. The pill stayed up through clicks anywhere on the
   page, through scrolling, and through pressing Escape — the only things that
   put it away were making a mark or starting another selection. A banner that
   outlives what it is about is the reader talking over the paper.

   Pointerdown rather than click, so it goes the instant you press somewhere
   else rather than on the way back up; and the pill's own presses are
   excluded, as are marks, which have their own handler. */
addEventListener('pointerdown',e=>{
  if(e.target.closest('#selp'))return;
  if(!SELP.classList.contains('on'))return;
  if(markAt(e.clientX,e.clientY))return;
  hideSel();
},true);
addEventListener('keydown',e=>{if(e.key==='Escape'&&SELP.classList.contains('on')){
  hideSel();try{getSelection().removeAllRanges()}catch(err){}}});
/* pressing the pill must not collapse the selection under it */`,
  },
  {
    part: 3,
    why: "a new mark has to reach the database, and it is stored as text offsets — never as the boxes drawn here",
    find: `  WM.add({id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:kind==='ask'?'':undefined,ans:kind==='ask'?[]:undefined});`,
    replace: `  const made={id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:(kind==='ask'||kind==='note'||kind==='txt')?'':undefined,ans:kind==='ask'?[]:undefined};
  WM.add(made);
  ctx.onMade(made,savedRange,pg);`,
  },
  {
    part: 3,
    why: "removing a mark has to reach the database too",
    find: `    if(picked){WM.drop(picked[0].dataset.g);picked.forEach(q=>q.remove());picked=null}`,
    replace: `    if(picked){const g=picked[0].dataset.g;WM.drop(g);ctx.onDropped(g);
               picked.forEach(q=>q.remove());picked=null}`,
  },
  {
    part: 3,
    why: "recolouring and converting a mark are edits to a stored record",
    find: `  if(picked){convert(k);window.islandSay&&window.islandSay(k==='ask'?'askq':'mark',900,k==='ask'?'p':lastK);
             hideSel();return}`,
    replace: `  if(picked){const g=picked[0].dataset.g;convert(k);ctx.onConverted(g,k,k==='ask'?'p':lastK);
             window.islandSay&&window.islandSay(k==='ask'?'askq':'mark',900,k==='ask'?'p':lastK);
             hideSel();return}`,
  },
  {
    part: 3,
    why: "the same, for a colour change",
    find: `  if(sk){lastK=sk.dataset.sk;
    const t=T(S.tool);
    if(t&&!t.fixed&&!t.grey){S.colour[t.id]=lastK;paintRail();mode()}
    recolour();paintSel();return}`,
    replace: `  if(sk){lastK=sk.dataset.sk;
    const t=T(S.tool);
    if(t&&!t.fixed&&!t.grey){S.colour[t.id]=lastK;paintRail();mode();ctx.onSettings(S)}
    if(picked)ctx.onRecoloured(picked[0].dataset.g,lastK);
    recolour();paintSel();return}`,
  },
  {
    part: 3,
    why: "the text-mark tools could not take a selection, so none of them could mark anything",
    find: `const DRAWS=['pen','mkr','hl'];`,
    replace: `const DRAWS=['pen','mkr','hl'];
/* THE OTHER HALF OF THAT LIST, AND WITHOUT IT FIVE TOOLS DO NOTHING.

   "Only the Select tool selects text" is about the DRAWING tools — a pen must
   not grab words when you meant to draw over them. It was implemented as
   "only hand sets data-sel", which also locked out every tool whose whole job
   is a passage: Underline, Strikethrough, Note, Ask and Flag are all marked
   \`mean:1\` or carry a fixed meaning, none of them is ink, and every one of
   them needs a selection to exist at all.

   Highlight is deliberately not here: it carries \`ink:1\` as well, so armed it
   is a highlighter pen. Highlighting WORDS is the selection pill's action of
   the same name. Two jobs, one id, and the tool table is what separates
   them. */
const TEXT=TOOLS.filter(t=>(t.mean||t.fixed)&&!t.ink&&!t.grey).map(t=>t.id).concat('txt');
/* What each one writes. The pill's three actions are the same three verbs.

   TEXT IS FILED UNDER DRAW IN THE TOOL TABLE AND IS STORED AS A MARK, and
   that is a deviation with a reason. A text box is words, and ink is the
   table for coordinates — it has no column to put words in, on purpose, so
   that a stroke cannot pretend to survive a reflow. An anchored annotation
   can hold words and does survive one, so the label travels with the passage
   it was written about instead of sitting where the paper used to be. */
const KIND={ul:'ul',st:'st',note:'note',ask:'ask',flag:'hl',txt:'txt'};
/* AND THE ONES THAT DO SOMETHING WHEN YOU PRESS THEM. Shape, Text, Measure,
   Snapshot and Link are in the table, draw their icons and open their
   properties, and have no behaviour behind any of it. A control that does
   nothing is the same lie as an empty state that names no action, so they are
   not offered until they work. Delete an id from here the day it does. */
const BUILT=['hand','pen','mkr','hl','era','ul','st','note','ask','flag','shp','msr','snap','txt'];`,
  },
  {
    part: 3,
    why: "and the root has to say so, because the stylesheet and showSel both read it",
    find: `  R.dataset.sel =(S.tool==='hand'&&(S.variant.hand||0)===0)?'1':'0';`,
    replace: `  R.dataset.sel =((S.tool==='hand'&&(S.variant.hand||0)===0)||TEXT.includes(S.tool))?'1':'0';`,
  },
  {
    part: 3,
    why: "an armed text tool marks the selection in its own kind, rather than opening the pill for it",
    find: `  savedRange=r.cloneRange();
  paintSel();SELP.classList.add('on');place(r.getBoundingClientRect());`,
    replace: `  /* A DRAG ENDS ON A WORD, not wherever the pointer stopped. */
  savedRange=snapToWords(r.cloneRange());
  try{const g=getSelection();g.removeAllRanges();g.addRange(savedRange.cloneRange())}catch(err){}
  /* THE CHEAPEST MARK IS WORDLESS. With a text tool in your hand you have
     already said what you want; the pill would be a second press asking the
     same question. Select with the CURSOR and the pill appears, because there
     the question is still open. */
  if(TEXT.includes(S.tool)){
    const t=T(S.tool);
    if(t.fixed)lastK=t.fixed; else if(S.colour[t.id])lastK=S.colour[t.id];
    const k=KIND[t.id]||'hl';
    stamp(k);
    /* A text box arrives empty and wants typing into, so its card opens. */
    if(k==='txt'&&ctx.onPlaced)ctx.onPlaced();
    window.islandSay&&window.islandSay(
      k==='ask'?'askq':k==='note'?'note':(lastK==='r'?'revise':'mark'),null,lastK);
    return;
  }
  paintSel();SELP.classList.add('on');place(r.getBoundingClientRect());`,
  },
  {
    part: 3,
    why: "and a tab with nothing behind it is the same lie one level up",
    find: `     <div class="tabs">\${['Basics','Draw','Capture','Notes'].map(g=>`,
    replace: `     <div class="tabs">\${['Basics','Draw','Capture','Notes']
       .filter(g=>TOOLS.some(t=>t.g===g&&BUILT.includes(t.id))).map(g=>`,
  },
  {
    part: 3,
    why: "the chest offers six tools that have no behaviour, and offering them is the same lie as a dead button",
    find: `     <div class="grid2">\${TOOLS.filter(t=>t.g===S.gtab).map(t=>`,
    replace: `     <div class="grid2">\${TOOLS.filter(t=>t.g===S.gtab&&BUILT.includes(t.id)).map(t=>`,
  },
  {
    part: 3,
    why: "Shape draws nothing, and a figure you drag out is the one thing a diagram needs",
    find: `const DRAWS=['pen','mkr','hl'];`,
    replace: `const DRAWS=['pen','mkr','hl'];
/* ── figures you drag out ──────────────────────────────────────────────
   Line, Arrow, Box and Ellipse are one gesture: press, drag, release, and the
   figure is rebuilt from the two corners on every move so what you watch is
   exactly what lands.

   THEY ARE STORED AS INK, because that is what they are: coordinates and
   nothing else, with no sentence you could keep instead. And they are stored
   as the POINTS OF THE FIGURE rather than as a name plus two corners — a box
   is its four corners, an ellipse is forty-eight points around it — so a
   figure comes back from the database without any field having to say what it
   was. The same polyline draws it live and draws it on reload, which is why
   the two cannot disagree. */
const GEOM=['shp','msr'];
const SHAPES=['line','arrow','box','ellipse'];
const polyline=p=>p.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join('');
function figurePoints(kind,a,b){
  const [x0,y0]=a,[x1,y1]=b;
  if(kind==='box')return [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
  if(kind==='ellipse'){
    const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2,out=[];
    for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;
      out.push([cx+Math.cos(t)*rx,cy+Math.sin(t)*ry])}
    return out;
  }
  if(kind==='arrow'){
    /* One continuous polyline — shaft, barb, back to the tip, other barb — so
       the head survives being stored as points like everything else. */
    const ang=Math.atan2(y1-y0,x1-x0);
    const len=Math.max(8,Math.min(40,Math.hypot(x1-x0,y1-y0)*0.28)), w=0.42;
    const b1=[x1-len*Math.cos(ang-w),y1-len*Math.sin(ang-w)];
    const b2=[x1-len*Math.cos(ang+w),y1-len*Math.sin(ang+w)];
    return [[x0,y0],[x1,y1],b1,[x1,y1],b2];
  }
  return [[x0,y0],[x1,y1]];
}
let geom=null;`,
  },
  {
    part: 3,
    why: "and the root has to call them drawing tools, or the page takes no pointer for them",
    find: `  R.dataset.draw= DRAWS.includes(S.tool)?'1':'0';`,
    replace: `  R.dataset.draw= (DRAWS.includes(S.tool)||GEOM.includes(S.tool)||S.tool==='snap')?'1':'0';`,
  },
  {
    part: 3,
    why: "a figure is a different gesture from a scribble and starts its own way",
    find: `  const pg=pgAt(e); if(!pg)return;
  e.preventDefault();
  const t=T(S.tool), c=colOf(t), r=pg.getBoundingClientRect();
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');`,
    replace: `  const pg=pgAt(e); if(!pg)return;
  e.preventDefault();
  if(GEOM.includes(S.tool)||S.tool==='snap'){
    const t2=T(S.tool), p2=document.createElementNS('http://www.w3.org/2000/svg','path');
    const r2=pg.getBoundingClientRect();
    p2.setAttribute('fill','none');
    p2.setAttribute('stroke',S.tool==='snap'?'var(--lv)':colOf(t2));
    p2.setAttribute('stroke-width',(S.size[t2.id]||2)/r2.width*1000);
    p2.setAttribute('stroke-linejoin','round');
    p2.setAttribute('stroke-linecap','round');
    if(S.tool!=='snap')p2.setAttribute('stroke-opacity',(S.op[t2.id]||100)/100);
    else p2.setAttribute('stroke-dasharray','12 8');
    pg.querySelector('.ink').appendChild(p2);
    geom={path:p2,pg,a:pt(e,pg),b:pt(e,pg),tool:S.tool};
    STG.setPointerCapture(e.pointerId);
    return;
  }
  const t=T(S.tool), c=colOf(t), r=pg.getBoundingClientRect();
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');`,
  },
  {
    part: 3,
    why: "the Eraser is on the default bar, has an icon, a size and two variants, and erases nothing",
    find: `STG.addEventListener('pointerdown',e=>{
  if(R.dataset.grab==='1'){`,
    replace: `/* THE FOURTH TOOL ON THE BAR DID NOTHING. The eraser is in DEF, it draws an
   icon, it opens properties with a rub size and two variants — and nothing in
   the handed-over file ever removes a stroke or a mark. DRAWS is pen, marker
   and highlighter, so with the eraser armed the page takes no pointer at all.

   Two variants, and they differ on INK only. "Whole mark" takes the stroke
   you touch. "Just where you rub" takes the points the rubber passed over and
   leaves the rest — so a stroke can become two strokes, or lose a tail, the
   way a real rubber works.

   MARKS ARE WHOLE-ONLY UNDER BOTH, and that is a rule rather than a gap:
   shortening a highlight is not a drawing problem, it is an anchor problem. A
   mark over half a passage is a different passage and has to be stored as
   one, and a rubber is not a precise enough instrument to decide where a
   quotation now ends. */
let rubbing=null;
function rub(e,pg){
  const box=pg.getBoundingClientRect();
  const [px,py]=pt(e,pg);
  const r=Math.max(6,(S.size.era||10)/box.width*1000);
  const svg=pg.querySelector('.ink');
  /* AN SVGPoint, NOT A DOMPoint. Chromium's isPointInStroke still refuses
     anything else — "parameter 1 is not of type 'SVGPoint'" — and a DOMPoint
     inside a try/catch fails silently, which is an eraser that rubs and
     rubs and takes nothing off. Found by asking the browser what the call
     returned rather than whether a stroke had gone. */
  const P=svg.createSVGPoint?svg.createSVGPoint():new DOMPoint();
  const at=(x,y)=>{P.x=x;P.y=y;return P};
  const gone=[];
  const whole=(S.variant.era||0)===0;
  const split=[];
  for(const path of [...svg.querySelectorAll('path')]){
    let hit=path.isPointInStroke(at(px,py));
    for(let a=0;a<8&&!hit;a++){
      hit=path.isPointInStroke(at(px+Math.cos(a/8*6.283)*r,py+Math.sin(a/8*6.283)*r));
    }
    /* ONLY WHAT THIS ACCOUNT DREW. The server has no session to check
       against, so the caller checks — and the page only ever carries this
       student's own strokes today, which makes this cheap insurance rather
       than a guess about the future. */
    if(!hit||!ctx.mine(path.dataset.id))continue;
    if(whole){gone.push(path.dataset.id);path.remove();continue}
    /* Just where you rub: keep the parts of the stroke the rubber missed.

       IT CUTS THE LINE, IT DOES NOT SIEVE THE POINTS. A stroke is stored as
       the positions the pointer was sampled at, and a quick straight line can
       be two of them thirty units apart. Asking "which stored points are
       inside the rubber" then has two failure modes and both were seen: rub
       between two points and nothing happens, and rub across a two-point line
       and the whole line goes, because there was no third point left to keep.

       So each segment is intersected with the rubber's circle, and the parts
       outside it are kept — which is what a rubber does, at any sampling
       rate. */
    const pts=ctx.pointsOf(path.dataset.id);
    if(!pts||pts.length<2){gone.push(path.dataset.id);path.remove();continue}
    const cut=(a,b)=>{
      const ax=a[0]*1000,ay=a[1]*1000,dx=b[0]*1000-ax,dy=b[1]*1000-ay;
      const fx=ax-px,fy=ay-py;
      const A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r;
      if(!A)return C<=0?[0,1]:null;
      const disc=B*B-4*A*C; if(disc<0)return null;
      const sq=Math.sqrt(disc),t0=(-B-sq)/(2*A),t1=(-B+sq)/(2*A);
      if(t1<0||t0>1)return null;
      return [Math.max(0,t0),Math.min(1,t1)];
    };
    const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    const runs=[];let run=[];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],c=cut(a,b);
      if(!c){if(!run.length)run.push(a);run.push(b);continue}
      const [t0,t1]=c;
      if(t0>0){if(!run.length)run.push(a);run.push(lerp(a,b,t0))}
      if(run.length>1)runs.push(run);
      run=[];
      /* The far side of the cut starts where the rubber let go AND CARRIES THE
         SEGMENT'S END. Without that end point a two-point line rubbed in the
         middle leaves a run of one point, which is not a stroke, and the far
         half is thrown away — the whole line vanishes when half of it should
         have stayed. */
      if(t1<1){run.push(lerp(a,b,t1));run.push(b)}
    }
    if(run.length>1)runs.push(run);
    gone.push(path.dataset.id);path.remove();
    if(runs.length)split.push({id:path.dataset.id,runs});
  }
  if(gone.length)ctx.onErasedInk(gone.filter(Boolean),split);
  /* And marks, hit-tested by hand for the same reason markAt exists: the text
     sits above them so they cannot be found with elementFromPoint. */
  const q=markAt(e.clientX,e.clientY);
  if(q){const g=q.dataset.g;
    document.querySelectorAll(\`.mkq[data-g="\${g}"]\`).forEach(x=>x.remove());
    WM.drop(g);ctx.onDropped(g);}
}
STG.addEventListener('pointerdown',e=>{
  if(S.tool==='era'){
    if(e.isPrimary===false)return;
    const pg=pgAt(e); if(!pg)return;
    e.preventDefault();
    rubbing=pg;rub(e,pg);STG.setPointerCapture(e.pointerId);
    return;
  }
  if(R.dataset.grab==='1'){`,
  },
  {
    part: 3,
    why: "and the rubber keeps rubbing while the pointer is down",
    find: `STG.addEventListener('pointermove',e=>{
  if(pan){STG.scrollTop=pan.top-(e.clientY-pan.y);return}`,
    replace: `STG.addEventListener('pointermove',e=>{
  if(rubbing){rub(e,rubbing);return}
  if(pan){STG.scrollTop=pan.top-(e.clientY-pan.y);return}`,
  },
  {
    part: 3,
    why: "and follows the pointer, holding Shift for a true square, circle or right angle",
    find: `STG.addEventListener('pointermove',e=>{
  if(rubbing){rub(e,rubbing);return}`,
    replace: `STG.addEventListener('pointermove',e=>{
  if(geom){
    let b=pt(e,geom.pg);
    /* Shift is the constraint every drawing tool has: a square rather than a
       rectangle, a circle rather than an ellipse, a line that stays level. */
    if(e.shiftKey){
      const dx=b[0]-geom.a[0],dy=b[1]-geom.a[1];
      if(geom.tool==='shp'&&(S.variant.shp||0)<2){
        Math.abs(dx)>Math.abs(dy)?b=[b[0],geom.a[1]]:b=[geom.a[0],b[1]];
      }else{
        const m=Math.max(Math.abs(dx),Math.abs(dy));
        b=[geom.a[0]+Math.sign(dx)*m,geom.a[1]+Math.sign(dy)*m];
      }
    }
    geom.b=b;
    const kind=geom.tool==='snap'?'box'
      :geom.tool==='msr'?((S.variant.msr||0)===1?'box':'line')
      :SHAPES[S.variant.shp||0];
    geom.pts=figurePoints(kind,geom.a,geom.b);
    geom.path.setAttribute('d',polyline(geom.pts));
    if(geom.tool==='msr')sayMeasure(geom);
    return;
  }
  if(rubbing){rub(e,rubbing);return}`,
  },
  {
    part: 3,
    why: "section 8.9 of the brief — a finger scrolls and never draws, and a resting palm produces nothing",
    find: `  if(R.dataset.draw!=='1')return;
  const pg=pgAt(e); if(!pg)return;`,
    replace: `  if(R.dataset.draw!=='1')return;
  /* THE HAND THAT HOLDS THE IPAD IS NOT A PEN. The handed-over file draws from
     any pointer at all, which on the device this reader is actually used on
     means a resting palm leaves a stroke across the page and a finger draws
     where it meant to scroll. Section 8.9 of the original brief is explicit,
     and it is not a question of style: a finger SCROLLS while a drawing tool
     is armed, and a second contact arriving beside a pen is ignored.

     The cost is stated rather than hidden: on a touch device with no stylus
     nobody can draw. That is the brief's own trade and it was already shipped
     once — the alternative is a reader that scribbles on itself every time
     somebody rests their hand. */
  if(e.isPrimary===false)return;
  if(e.pointerType==='touch'){
    pan={y:e.clientY,top:STG.scrollTop};STG.setPointerCapture(e.pointerId);return}
  const pg=pgAt(e); if(!pg)return;`,
  },
  {
    part: 3,
    why: "a 120Hz Pencil reports several positions per frame, and the handed-over loop keeps one",
    find: `  if(!ink)return;
  const p=pt(e,ink.pg);
  if(ink.straight){ink.pts=[ink.pts[0],p]}
  else{const l=ink.pts[ink.pts.length-1];
       if(Math.hypot(p[0]-l[0],p[1]-l[1])<2)return; ink.pts.push(p)}
  ink.path.setAttribute('d',smooth(ink.pts));
});`,
    replace: `  if(!ink)return;
  /* EVERY POSITION THE PENCIL RECORDED, NOT JUST THE LAST ONE. An Apple
     Pencil samples faster than the display refreshes, and the browser hands
     the extra samples over in getCoalescedEvents rather than firing a move
     for each. Reading only the event itself throws them away, and a quick
     stroke comes out as a polygon with visible corners — on the one device
     this reader is for, drawn with the one instrument it is for. */
  const moves = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for(const m of (moves.length?moves:[e])){
    const p=pt(m,ink.pg);
    if(ink.straight){ink.pts=[ink.pts[0],p];continue}
    const l=ink.pts[ink.pts.length-1];
    if(Math.hypot(p[0]-l[0],p[1]-l[1])<2)continue;
    ink.pts.push(p);
  }
  ink.path.setAttribute('d',smooth(ink.pts));
});`,
  },
  {
    part: 3,
    why: "Measure had no readout, and Snapshot no region — both are a drag and then an answer",
    find: `let geom=null;`,
    replace: `let geom=null;
/* ── the tape measure ──────────────────────────────────────────────────
   A DISTANCE IN THE PAGE'S OWN UNITS, which is the only honest one. A PDF
   page is measured in points, 72 to the inch, and the reader knows the page's
   size — so a drag across it is a real length on the printed sheet. What it
   is NOT is a length on the aircraft: a drawing's scale is written on the
   drawing and nothing in the file states it.

   It leaves nothing behind, and that is deliberate rather than unfinished.
   paper_ink stores a stroke's coordinates and has nowhere to put "this one is
   a measurement" — so a kept measurement would come back as a plain line with
   its number gone, which is worse than a tape measure that lets go. */
const tape=document.createElement('div');
tape.className='tape';tape.setAttribute('aria-live','polite');
function sayMeasure(g){
  const box=g.pg.getBoundingClientRect();
  const w=+(g.pg.dataset.ptw||612), h=+(g.pg.dataset.pth||792);
  const dx=(g.b[0]-g.a[0])/1000*w, dy=(g.b[1]-g.a[1])/1000*h;
  const area=(S.variant.msr||0)===1;
  const inches=area?Math.abs(dx*dy)/5184:Math.hypot(dx,dy)/72;
  const mm=area?Math.abs(dx*dy)*0.1244:Math.hypot(dx,dy)*0.3528;
  tape.textContent=area
    ? mm.toFixed(0)+' mm² · '+inches.toFixed(2)+' in²'
    : mm.toFixed(1)+' mm · '+inches.toFixed(2)+' in';
  if(!tape.isConnected)R.appendChild(tape);
  tape.style.left=(box.left+(g.b[0]/1000)*box.width)+'px';
  tape.style.top =(box.top +(g.b[1]/1000)*box.height)+'px';
}
function clearMeasure(){tape.remove()}`,
  },
  {
    part: 3,
    why: "a finished stroke is a record in paper_ink, in the 0-1000 page fractions it is already drawn in",
    find: `addEventListener('pointerup',()=>{
  pan=null;
  if(ink){if(ink.pts.length<2)ink.path.remove();ink=null}
});`,
    replace: `addEventListener('pointerup',()=>{
  pan=null;rubbing=null;
  /* A figure, a measurement and a snapshot each end their own way: the figure
     is kept, the measurement is read and let go, the snapshot becomes a file. */
  if(geom){
    const g=geom;geom=null;
    const far=Math.hypot(g.b[0]-g.a[0],g.b[1]-g.a[1])>6;
    if(g.tool==='snap'){g.path.remove();if(far)ctx.onSnapshot(g.pg,g.a,g.b)}
    else if(g.tool==='msr'){g.path.remove();clearMeasure()}
    else if(far&&g.pts&&g.pts.length>1)ctx.onStroke(g.pg,g.path,g.pts,T(g.tool),S);
    else g.path.remove();
  }
  if(ink){
    if(ink.pts.length<2)ink.path.remove();
    else ctx.onStroke(ink.pg,ink.path,ink.pts,T(S.tool),S);
    ink=null;
  }
});`,
  },
  {
    part: 3,
    why: "the tray, its order, and every tool's colour, size and opacity persist per student",
    find: `let S={tool:'hl',tray:[...DEF],bar:'left',`,
    replace: `let S=ctx.settings({tool:'hl',tray:[...DEF],bar:'left',`,
  },
  {
    part: 3,
    why: "closing the same call",
    find: `  recent:[], presets:{}, open:null, gtab:'Draw', straight:{}};`,
    replace: `  recent:[], presets:{}, open:null, gtab:'Draw', straight:{}});`,
  },
  {
    part: 3,
    why: "the tool bar has to hand the rest of the reader the pieces the demo kept to itself",
    find: `function smooth(p){`,
    replace: `/* What the rest of the reader needs from the tool bar. relayout() in
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
function smooth(p){`,
  },

  /* ══ part 4 · the panel ═══════════════════════════════════════════ */
  {
    part: 4,
    why: "the first page and the paper's length come from the manifest",
    find: `const FIRST=126, pad=n=>String(n).padStart(4,'0');`,
    replace: `const FIRST=ctx.first, pad=n=>String(n).padStart(String(ctx.first+ctx.total-1).length,'0');`,
  },
  {
    part: 4,
    why: "who wrote a mark is looked up, and a name that is not in the class is still a name",
    find: `const PEOPLE={me:{n:'You',i:'CA'},ah:{n:'Ahmad',i:'AH'},no:{n:'Noor',i:'NO'},
              yo:{n:'Yousef',i:'YO'},tut:{n:'Instructor',i:'IN'},anon:{n:'Anonymous',i:'?'}};`,
    replace: `const PEOPLE=ctx.people;`,
  },
  {
    part: 4,
    why: "a page's heading comes from the paper's outline, and there are 1012 of them, not ten",
    find: `const HEADS=[...document.querySelectorAll('.sheetpg h3')].map(h=>h.textContent);
const NPAGES=HEADS.length;`,
    replace: `/* The page grid is a window, not a document. HANDOVER, Making it feel
   smooth: never lay out the whole thing — on a 1012-page manual that is 1012
   cells, each one counting its own marks. ctx.gridPages() is the run of pages
   around where the student is, and paintPages() below still walks it with the
   map it was written against. */
const HEADS={map:f=>ctx.gridPages().map(pg=>f(ctx.head(pg),pg-ctx.first))};
const NPAGES=ctx.total;`,
  },
  {
    part: 4,
    why: "the same lookup, for the heading over each page's group of marks",
    find: `    \`<div class="pgh"><b>\${pad(pg)}</b><span>\${HEADS[pg-FIRST]||''}</span><em>\${by[pg].length}</em></div>\``,
    replace: `    \`<div class="pgh"><b>\${pad(pg)}</b><span>\${ctx.head(+pg)||''}</span><em>\${by[pg].length}</em></div>\``,
  },
  {
    part: 4,
    why: "a note is a mark with something written on it, and there was nowhere to write it",
    find: `        \${m.kind==='ul'?\`<span style="opacity:.7">underline</span>\`:''}`,
    replace: `        \${m.kind==='ul'?\`<span style="opacity:.7">underline</span>\`:''}
        \${m.kind==='st'?\`<span style="opacity:.7">struck out</span>\`:''}
        \${(m.kind==='note'||m.kind==='txt')&&!m.ask?\`<span style="opacity:.7">no words yet</span>\`:''}
        \${m.kind==='txt'?\`<span style="opacity:.7">on the page</span>\`:''}`,
  },
  {
    part: 4,
    why: "and the card is where it is written, in the thread markup the card already has",
    find: `    \${m.kind==='ask'?\`<div class="thr">`,
    replace: `    \${(m.kind==='note'||m.kind==='txt')?\`<div class="thr">
      \${m.ask?\`<div class="ans"><span class="tx">\${hi(m.ask)}</span></div>\`:''}
      <div class="reply"><input placeholder="\${m.ask?'Change what it says':'Write the note'}"
        value="\${esc(m.ask||'')}" data-stop data-note><button data-stop>Save</button></div>
    </div>\`:''}
    \${m.kind==='ask'?\`<div class="thr">`,
  },
  {
    part: 4,
    why: "a paper nobody has marked is not the same empty as a filter that matches nothing",
    find: `    BODY.innerHTML=\`<div class="none"><b>Nothing matches</b>
      <p>\${term?\`Nothing on this paper says &ldquo;\${esc(term)}&rdquo;.\`:'Try a wider filter.'}</p>
      <button data-clear>Clear the filters</button></div>\`;`,
    replace: `    /* TWO EMPTIES, AND TELLING A STUDENT THE WRONG ONE IS WORSE THAN
       SAYING NOTHING. "Try a wider filter" is advice you cannot take on a
       paper that has no marks on it at all, and every empty state has to name
       an action that exists (CLAUDE.md, Voice). So the fresh paper gets the
       action it actually has, and no count is stated either way. */
    const virgin = !WM.marks.length && !term && scope==='all' && !kinds.size;
    BODY.innerHTML = virgin
      ? \`<div class="none"><b>Yours would be the first</b>
          <p>Select a line and mark it, and it will be here.</p></div>\`
      : \`<div class="none"><b>Nothing matches</b>
      <p>\${term?\`Nothing on this paper says &ldquo;\${esc(term)}&rdquo;.\`:'Try a wider filter.'}</p>
      <button data-clear>Clear the filters</button></div>\`;`,
  },
  {
    part: 4,
    why: "the footer read \"0 of 0 marks\" on a paper nobody has marked, and this app never states a zero",
    find: `  PF.innerHTML=\`\${nw?\`<span class="nw"><i></i>\${nw} new since you looked</span>\`
                   :\`<span>\${ms.length} of \${WM.marks.length} marks</span>\`}`,
    replace: `  /* NEVER STATE ABSENCE OR A ZERO COUNT (CLAUDE.md, Voice). A fresh paper
     showed "0 of 0 marks" under a body already saying "Yours would be the
     first", and a filter matching nothing showed "0 of 12" under a body
     already saying "Nothing matches" — a zero twice over, and redundant both
     times. The count earns its place only when there is something to count. */
  PF.innerHTML=\`\${nw?\`<span class="nw"><i></i>\${nw} new since you looked</span>\`
                   :ms.length?\`<span>\${ms.length===WM.marks.length
                       ?\`\${ms.length} mark\${ms.length===1?'':'s'}\`
                       :\`\${ms.length} of \${WM.marks.length} marks\`}</span>\`:''}`,
  },
  {
    part: 4,
    why: "a mark that lost its place is listed, which is the second half of a rule the first half already keeps",
    find: `  const by={};ms.forEach(m=>{(by[m.pg]=by[m.pg]||[]).push(m)});
  BODY.innerHTML=Object.keys(by).map(pg=>`,
    replace: `  /* A LOST MARK IS ORPHANED, NEVER RELOCATED. resolveAnchor returns null
     rather than guessing, and the brief's other half is that the reader lists
     what lost its place — otherwise a mark simply vanishes and the student
     who wrote it never learns the passage was edited.

     They are drawn with the panel's own heading and card, above the pages,
     because an orphan has no page to sit under. Tapping one goes nowhere,
     which is correct: there is nowhere left to go. */
  const lost=ctx.orphans();
  const orphaned = lost.length
    ? \`<div class="pgh"><b>&mdash;</b><span>these passages changed &mdash; mark them again</span><em>\${lost.length}</em></div>\`
      + lost.map(o=>\`<div class="mcard" role="button" tabindex="0" style="--k:\${K[o.k]||K.y}">
          <div class="qt">\${hi(o.tx)}</div>
          <div class="mt"><span class="a">\${(PEOPLE[o.who]||{}).i||'??'}</span>
            <b>\${(PEOPLE[o.who]||{}).n||'Someone'}</b><span class="dot">&middot;</span>
            <span>\${o.t}</span></div></div>\`).join('')
    : '';
  const by={};ms.forEach(m=>{(by[m.pg]=by[m.pg]||[]).push(m)});
  BODY.innerHTML=orphaned+Object.keys(by).map(pg=>`,
  },
  {
    part: 4,
    why: "and they are listed even when nothing else matches, or they would hide behind an empty state",
    find: `  if(!ms.length){`,
    replace: `  if(!ms.length&&!ctx.orphans().length){`,
  },
  {
    part: 4,
    why: "an instructor is a person with a staff badge, not an author id spelled 'tut'",
    find: `        <span class="a \${a.who==='tut'?'tut':''}">\${PEOPLE[a.who]?PEOPLE[a.who].i:'??'}</span>
        <span class="tx"><b>\${a.n}\${a.who==='tut'?'<em>answered</em>':''}</b>\${esc(a.tx)}</span></div>\`).join('')`,
    replace: `        <span class="a \${PEOPLE[a.who]?.tut?'tut':''}">\${PEOPLE[a.who]?PEOPLE[a.who].i:'??'}</span>
        <span class="tx"><b>\${(PEOPLE[a.who]||{}).n||a.n||'Someone'}\${PEOPLE[a.who]?.tut?'<em>answered</em>':''}</b>\${esc(a.tx)}</span></div>\`).join('')`,
  },
  {
    part: 4,
    why: "an answer typed into a card is posted to the module thread the Ready Room shows",
    find: `BODY.addEventListener('click',e=>{
  if(e.target.closest('[data-stop]')){e.stopPropagation();return}`,
    replace: `BODY.addEventListener('click',e=>{
  const send=e.target.closest('.reply button');
  if(send){e.stopPropagation();
    const box=send.previousElementSibling, tx=box.value.trim();
    if(tx){ctx.onAnswer(send.closest('[data-m]').dataset.m,tx);box.value=''}
    return}
  if(e.target.closest('[data-stop]')){e.stopPropagation();return}`,
  },
  {
    part: 4,
    why: "a filter chip reading 0 is a zero count, and this app never states one",
    find: `        <i></i>\${MEAN[k]}<em>\${n(k)}</em></button>\`).join('')}`,
    replace: `        <i></i>\${MEAN[k]}\${n(k)?\`<em>\${n(k)}</em>\`:''}</button>\`).join('')}`,
  },
  {
    part: 4,
    why: "a note's card has to open, or the box you write it in is display:none",
    find: `  if(m.kind==='ask'){open = open===m.id?null:m.id;paintList()}`,
    replace: `  if(m.kind==='ask'||m.kind==='note'){open = open===m.id?null:m.id;paintList()}`,
  },
  {
    part: 4,
    why: "a text box is written on its card too, and a fresh one should already be open",
    find: `  if(m.kind==='ask'||m.kind==='note'){open = open===m.id?null:m.id;paintList()}`,
    replace: `  if(m.kind==='ask'||m.kind==='note'||m.kind==='txt'){open = open===m.id?null:m.id;paintList()}`,
  },
  {
    part: 4,
    why: "and Save writes it, where Send answers a question",
    find: `  const send=e.target.closest('.reply button');
  if(send){e.stopPropagation();
    const box=send.previousElementSibling, tx=box.value.trim();
    if(tx){ctx.onAnswer(send.closest('[data-m]').dataset.m,tx);box.value=''}
    return}`,
    replace: `  const send=e.target.closest('.reply button');
  if(send){e.stopPropagation();
    const box=send.previousElementSibling, tx=box.value.trim();
    const id=send.closest('[data-m]').dataset.m;
    if(box.hasAttribute('data-note')){ctx.onNote(id,tx);return}
    if(tx){ctx.onAnswer(id,tx);box.value=''}
    return}`,
  },
  {
    part: 4,
    why: "the panel's scroll handler does its work on the next frame too",
    find: `STAGE.addEventListener('scroll',()=>{
  let best=FIRST,bd=1e9;
  $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
    if(d<bd){bd=d;best=+el.dataset.pg}});
  if(best!==page){page=best;if(view==='pages')paintPages()}
},{passive:true});`,
    replace: `let scrollF=0;
STAGE.addEventListener('scroll',()=>{
  if(scrollF)return;
  scrollF=requestAnimationFrame(()=>{
    scrollF=0;
    let best=FIRST,bd=1e9;
    $$('.sheetpg').forEach(el=>{const d=Math.abs(el.offsetTop-74-STAGE.scrollTop);
      if(d<bd){bd=d;best=+el.dataset.pg}});
    if(best!==page){page=best;if(view==='pages')paintPages()}
  });
},{passive:true});`,
  },
  {
    part: 4,
    why: "the panel repaints when marks arrive, and the rest of the reader needs to be able to ask",
    find: `side();

paint();`,
    replace: `side();

paint();
/* what the rest of the reader can ask the panel to do */
return {repaint:paint,page:()=>page,
  /* A mark that has just been placed and wants typing into: open its card and
     put the cursor in it, so the student is writing rather than hunting. */
  openNewest(){const m=WM.marks[WM.marks.length-1];if(!m)return;
    open=m.id;paintList();
    const box=BODY.querySelector('[data-m="'+m.id+'"] .reply input');
    if(box){box.focus();box.scrollIntoView({block:'nearest'})}}};`,
  },
];

/* ── applying them ─────────────────────────────────────────────────── */
function applyEdits(body, part) {
  const mine = EDITS.filter((e) => e.part === part);
  const applied = [];
  for (const e of mine) {
    let find = e.find;
    if (e.findLines) {
      /* A block, named by its first and last line, so the table stays
         readable and the cut still cannot drift. */
      const rows = body.split("\n");
      const s = rows.findIndex((l) => l === e.findLines[0]);
      if (s < 0) throw new Error(`REFUSING: edit "${e.why}" — first line not found`);
      const rel = rows.slice(s + 1).findIndex((l) => l === e.findLines[1]);
      if (rel < 0) throw new Error(`REFUSING: edit "${e.why}" — last line not found after the first`);
      find = rows.slice(s, s + 1 + rel + 1).join("\n");
    }
    const at = body.indexOf(find);
    if (at < 0) throw new Error(`REFUSING: edit "${e.why}" — no match in part ${part}`);
    if (body.indexOf(find, at + 1) >= 0 && !e.findLines) {
      throw new Error(`REFUSING: edit "${e.why}" — matches more than once in part ${part}`);
    }
    body = body.slice(0, at) + e.replace + body.slice(at + find.length);
    applied.push(e.why);
  }
  return { body, applied };
}

const HEAD = (n, title) => `/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part ${n} (${title}).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and \`npm run check:paper\` refuses if this file and the source have drifted.
 */
`;

function moduleFor(n, title, signature, body, applied) {
  const notes = applied.length
    ? ` *\n * Changed from the handed-over file, and only this:\n *   - ${applied.join("\n *   - ")}\n`
    : "";
  return HEAD(n, title).replace(" */\n", `${notes} */\n`) +
    `\nexport function ${signature}{\n${body}\n}\n`;
}

const built = [];
{
  built.push({
    file: "part1.js",
    text: HEAD(1, "WM, the shared list") +
      `\nexport function mountWM(){\n${PART1}\nreturn window.WM;\n}\n`,
  });

  const a = applyEdits(p2.body, 2);
  built.push({ file: "part2.js", text: moduleFor(2, "the island", "mountIsland(ctx)", a.body, a.applied) });

  const b = applyEdits(p3.body, 3);
  built.push({ file: "part3.js", text: moduleFor(3, "the tool bar", "mountToolbar(ctx)", b.body, b.applied) });

  const c = applyEdits(p4.body, 4);
  built.push({ file: "part4.js", text: moduleFor(4, "the panel", "mountPanel(ctx)", c.body, c.applied) });
}

/* A BACKSLASH THAT DID NOT SURVIVE IS SILENT, AND COST AN AFTERNOON.
 * Every replacement below is a JS template literal, so `\s` in the source of THIS
 * file emits `s` and the regex `/\s/` is generated as `/s/` — which matches the
 * letter s and nothing else, and `/[\p{L}]/u` becomes `/[p{L}]/u`, a character
 * class of the letters p, L and two braces. Both parse, both run, and both
 * quietly do the wrong thing: tap-to-select found no word anywhere on the
 * page and reported nothing at all.
 *
 * So the regexes the chrome depends on are named here and checked for. A
 * fourth one added without a line in this list is the next afternoon. */
const MUST_SURVIVE = [
  ["part3.js", "/[" + "\\" + "p{L}" + "\\" + "p{N}'" + "\\" + "u2019-]/u"],
  ["part3.js", "if(!/" + "\\" + "s/.test(String(r)))return r;"],
  ["part3.js", "while(a<b&&/" + "\\" + "s/.test(t[a]))a++;"],
];

let bad = 0;
for (const [file, needle] of MUST_SURVIVE) {
  const made = built.find((b) => b.file === file);
  if (!made || !made.text.includes(needle)) {
    console.error(`REFUSING: ${file} lost an escape — expected to find ${JSON.stringify(needle)}`);
    bad += 1;
  }
}
if (bad) process.exit(1);

for (const { file, text } of built) {
  const path = join(OUT, file);
  if (VERIFY) {
    const have = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (have !== text) { console.error(`DRIFTED: ${file} is not what the source produces.`); bad += 1; }
  } else {
    writeFileSync(path, text);
    console.log(`${file}  ${text.split("\n").length} lines`);
  }
}
if (VERIFY) {
  if (bad) { console.error("Run `node scripts/build-reader-v6.mjs` to regenerate."); process.exit(1); }
  console.log(`reader v6: ${built.length} parts, all current with docs/reader/v6/reader.js`);
}
