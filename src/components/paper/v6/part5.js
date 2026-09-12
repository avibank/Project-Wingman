/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part 5 (the note and the question).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and `npm run check:paper` refuses if this file and the source have drifted.
 *
 * Changed from the handed-over file, and only this:
 *   - the app already has an eraser that persists what it removes, and two erasers on one pointer erase twice
 *   - a note and a question are records, not DOM. The kit places the pin; the store keeps it
 *   - and the composer is where a question gets its wording, so it must not also open on every tool change
 *   - the reader's stylesheet is scoped to .rdr, and the composer was appended to document.body where none of it reaches
 *   - and the pin that rides the pointer is the same story
 */

export function mountNotes(ctx){
const $=s=>document.querySelector(s);
const R=$('#rdr'), STG=$('#stage');
const VIOLET='#B571E0';
const tool=()=>R.dataset.tool, variant=()=>+(R.dataset.var||0);
const pgAt=(x,y)=>document.elementFromPoint(x,y)?.closest('.sheetpg');
const norm=(pg,x,y)=>{const r=pg.getBoundingClientRect();
  return [(x-r.left)/r.width*1000,(y-r.top)/r.height*1000]};

/* THE KIT'S ERASER IS NOT THE ONE THAT RUNS HERE. Part 3 already carries an
   eraser that removes a stroke or a mark AND takes the record with it — it
   writes the deletion to paper_ink and paper_annotations, and it is undoable.
   The kit's erases the DOM and stops, so two of them on one pointer would
   remove a stroke twice and save neither. What the kit had and part 3 did not
   is the rubber you can see; that has been taken into part 3 instead, where
   the erasing lives. */

/* ══ the note and the question: write, then place ═════════════════════ */
let comp=null;      /* the open composer */
let carry=null;     /* the pin riding the pointer, waiting for its spot */

const colourNow=k=>k==='ask'?VIOLET:((R.style.getPropertyValue('--sel')||'').trim()||'#F5C23C');
const keyOf=k=>k==='ask'?'p':
  ({'#f5c23c':'y','#5bb4f0':'b','#43c08a':'g','#b571e0':'p','#ee6f82':'r'}
   [colourNow(k).toLowerCase()]||'y');
const pinSVG=k=>k==='ask'
  ? `<svg viewBox="0 0 24 24" fill="none"><path d="M9.6 9.1a2.5 2.5 0 114.2 2c-.9.8-1.7 1.3-1.7 2.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>`
  : `<svg viewBox="0 0 24 24" fill="none"><path d="M7 8.5h10M7 12.5h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;

function closeComposer(){ if(comp){comp.remove();comp=null} }
function dropCarry(){ if(carry){carry.el.remove();carry=null;R.dataset.carry='0'} }

function openComposer(kind){
  closeComposer(); dropCarry();
  const hex=colourNow(kind);
  const el=document.createElement('div');
  el.className='ncomp'; el.dataset.kind=kind; el.style.setProperty('--k',hex);
  el.innerHTML=`
    <div class="nhd"><span class="nic">${pinSVG(kind)}</span>
      <b>${kind==='ask'?'Ask the class':'Write a note'}</b>
      <span class="nwho">${kind==='ask'?'Posted anonymously':'Only you'}</span>
      <button class="nx" aria-label="Close">&times;</button></div>
    <textarea rows="3" placeholder="${kind==='ask'
      ?'What do you want to ask about this page?':'What do you want to remember?'}"></textarea>
    <div class="nft"><span class="nhint">Save it, then drop it where it belongs</span>
      <button class="nok">Save &amp; place</button></div>`;
  /* INSIDE THE READER, NOT ON THE BODY. Every selector in reader.css is
     prefixed with .rdr when it is scoped for the app, so a composer parented
     to <body> got no width, no background and no z-index — it rendered behind
     the stage, which then swallowed every click aimed at it. The kit can
     append to the body because it owns the whole page; here it does not. */
  R.appendChild(el); comp=el;
  const ta=el.querySelector('textarea'); setTimeout(()=>ta.focus(),30);

  const save=()=>{
    const tx=ta.value.trim(); if(!tx){ta.focus();return}
    closeComposer(); startCarry(kind,tx,hex);
  };
  el.addEventListener('click',ev=>{
    if(ev.target.closest('.nx')){closeComposer();return}
    if(ev.target.closest('.nok'))save();
  });
  ta.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){ev.stopPropagation();closeComposer()}
    if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey))save();
  });
}

function startCarry(kind,tx,hex){
  const el=document.createElement('div');
  el.className='pin carry '+kind;
  el.style.setProperty('--k',hex);
  el.innerHTML=pinSVG(kind)+`<span class="ctip">Click the spot</span>`;
  R.appendChild(el);
  carry={el,kind,tx,hex}; R.dataset.carry='1';
}
addEventListener('pointermove',e=>{
  if(!carry)return;
  carry.el.style.left=e.clientX+'px'; carry.el.style.top=e.clientY+'px';
  const over=!!pgAt(e.clientX,e.clientY);
  carry.el.dataset.ok=over?'1':'0';
});
function commit(x,y){
  const pg=pgAt(x,y); if(!pg)return false;
  const {kind,tx,hex}=carry;
  const [nx,ny]=norm(pg,x,y);
  const gid='n'+Date.now().toString(36);
  const pin=document.createElement('button');
  pin.className='pin '+kind; pin.dataset.kind=kind; pin.dataset.g=gid;
  pin.title=tx;
  pin.style.cssText=`left:${nx/10}%;top:${ny/10}%;--k:${hex}`;
  pin.innerHTML=pinSVG(kind);
  (pg.querySelector('.marks')||pg).appendChild(pin);
  /* THE PIN IS ON THE PAGE BEFORE THE NETWORK HEARS ABOUT IT, which is the
     same bargain every other mark makes here: losing what somebody just wrote
     is the worse failure. The store gives it its real id when the row lands,
     and the pin follows — so a note written, saved and reloaded is one note,
     not two. Nothing about the position is stored: a pin is a fraction of its
     page, like ink, and page and fraction are all the record carries. */
  ctx.onPin({ gid, kind, tx, pg:+pg.dataset.pg, x:nx/10, y:ny/10, k:keyOf(kind), el:pin });
  dropCarry();
  window.islandSay&&window.islandSay(kind==='ask'?'askq':'note',900);
  return true;
}
STG.addEventListener('click',e=>{
  if(carry){e.preventDefault();e.stopPropagation();commit(e.clientX,e.clientY);return}
  const k=tool(); if(k!=='note'&&k!=='ask')return;
  if(e.target.closest('.pin')||e.target.closest('.ncomp'))return;
  openComposer(k);
},true);
addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(carry){dropCarry();return}
  if(comp)closeComposer();
});

/* picking the tool is enough to start writing — you should not have to
   guess that a click somewhere is what opens it */
new MutationObserver(()=>{
  const k=tool();
  if(k==='note'||k==='ask'){ if(!carry&&(!comp||comp.dataset.kind!==k))openComposer(k) }
  else { closeComposer(); dropCarry(); }
}).observe(R,{attributes:true,attributeFilter:['data-tool']});
}
