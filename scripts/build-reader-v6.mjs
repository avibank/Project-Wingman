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
    why: "a new mark has to reach the database, and it is stored as text offsets — never as the boxes drawn here",
    find: `  WM.add({id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:kind==='ask'?'':undefined,ans:kind==='ask'?[]:undefined});`,
    replace: `  const made={id:gid,g:gid,pg:+pg.dataset.pg,k:kind==='ask'?'p':lastK,kind,
          who:'me',t:'just now',tx:String(savedRange).trim(),
          ask:kind==='ask'?'':undefined,ans:kind==='ask'?[]:undefined};
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
    why: "a finished stroke is a record in paper_ink, in the 0-1000 page fractions it is already drawn in",
    find: `addEventListener('pointerup',()=>{
  pan=null;
  if(ink){if(ink.pts.length<2)ink.path.remove();ink=null}
});`,
    replace: `addEventListener('pointerup',()=>{
  pan=null;
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
return {repaint:paint,page:()=>page};`,
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

let bad = 0;
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
