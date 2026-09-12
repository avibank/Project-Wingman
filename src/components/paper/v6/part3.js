/* THE TOOL BAR — the rail, the inspector, the chest, the selection pill, and every stroke the student draws.
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
 *   HANDOVER section 5 — SEED and seed(). findRange() stays: the anchoring fallback needs it
 *   HANDOVER section 5 — seed() goes, and with it the load hook that ran it
 *   a three-character floor is right for a stray drag and wrong for a deliberate tap
 *   the cursor is the most versatile tool and only did one of the three things a reader expects of it
 *   a tap on the words did nothing at all, which is the first thing anyone tries
 *   the pill and the back banner floated until something else happened to them
 *   a new mark has to reach the database, and it is stored as text offsets — never as the boxes drawn here
 *   removing a mark has to reach the database too
 *   recolouring and converting a mark are edits to a stored record
 *   the same, for a colour change
 *   the text-mark tools could not take a selection, so none of them could mark anything
 *   and the root has to say so, because the stylesheet and showSel both read it
 *   an armed text tool marks the selection in its own kind, rather than opening the pill for it
 *   and a tab with nothing behind it is the same lie one level up
 *   the chest offers six tools that have no behaviour, and offering them is the same lie as a dead button
 *   Shape draws nothing, and a figure you drag out is the one thing a diagram needs
 *   and the root has to call them drawing tools, or the page takes no pointer for them
 *   a figure is a different gesture from a scribble and starts its own way
 *   the Eraser is on the default bar, has an icon, a size and two variants, and erases nothing
 *   and the rubber keeps rubbing while the pointer is down
 *   and follows the pointer, holding Shift for a true square, circle or right angle
 *   section 8.9 of the brief — a finger scrolls and never draws, and a resting palm produces nothing
 *   a 120Hz Pencil reports several positions per frame, and the handed-over loop keeps one
 *   Measure had no readout, and Snapshot no region — both are a drag and then an answer
 *   a finished stroke is a record in paper_ink, in the 0-1000 page fractions it is already drawn in
 *   the tray, its order, and every tool's colour, size and opacity persist per student
 *   closing the same call
 *   the tool bar has to hand the rest of the reader the pieces the demo kept to itself
 *
 * And what this round changed, in the same form — each one is commented where
 * it lands:
 *   the bar wrote one of its twenty settings back, and the header above says it writes them all
 *   the root never learned which edge the bar is on, so nothing else could either
 *   a stroke's width, its opacity and its end have to travel to the store with it
 *   a shortcut that fires while you are typing is not a shortcut
 *   the reader opened with a tool that cannot select, and reset put you back there
 *   "tap to load" loaded once and never again
 *   recolouring a question wrote a colour onto a mark that has none, and lost it
 *   a note and a question arrive empty and have to open the box you write them in
 *   four dead controls: the demo's theme, the auto-hide nothing turns on, two tooltips, two unread stores
 *   the chest's rows were listed, styled to be dragged, and not draggable
 *   Select showed an I-beam, and the eraser showed the same pointer at every size
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

/* THE READER OPENED WITH A TOOL THAT CANNOT SELECT. The default was 'hl',
   which carries ink:1 — so mode() set data-sel='0', the text layer took no
   pointer, and the first thing anyone tries on a paper did nothing: no word
   could be selected, the pill never appeared, and on a touch device every
   finger was routed to pan, so nothing drew either. Select is the tool a
   reader is holding when it opens. [data-reset] below says the same. */
let S=ctx.settings({tool:'hand',tray:[...DEF],bar:'left',
  variant:{},colour:{pen:'b',hl:'y',mkr:'y',shp:'b',txt:'b',msr:'g',note:'y',ul:'y',st:'r',flag:'r'},
  size:{pen:3,hl:12,mkr:14,shp:2,txt:14,msr:2,era:10,ul:2,st:2,note:12,flag:2},
  op:{pen:100,hl:38,mkr:55,shp:100,txt:100,msr:100,era:100,ul:100,st:100,note:100,flag:100},
  recent:[], presets:{}, open:null, gtab:'Draw', straight:{}});
/* ── THE BAR SAVED ALMOST NOTHING ───────────────────────────────────────
   ctx.onSettings(S) was called from one place in the whole file — the
   selection pill's colour swatch. Everything else mutated S and walked away:
   the bar's order and its edge, adding and removing a tool, the armed tool,
   variants, both colour pickers, size, opacity, straight lines, presets and
   reset. A student set the pen to 5pt at 60%, moved the bar to the right
   edge, added Underline and saved a preset — and reopened the paper to find
   every one of them gone, while this file's own header promised that "the
   tray, its order, and every tool's colour, size and opacity persist per
   student". One helper, called from every site that touches S. */
const save=()=>ctx.onSettings(S);
/* A slider fires on every frame of a drag, and a write per frame is a write
   per pixel. The value is live on the page immediately either way; only the
   record waits for the student to stop moving. */
let saveT=null;
const saveSoon=()=>{clearTimeout(saveT);saveT=setTimeout(save,300)};
/* ── AND THE ROOT NEVER LEARNED WHICH EDGE THE BAR IS ON ─────────────────
   R.dataset.bar was written in exactly two places — a drop on a zone and the
   chest's position buttons — and never at mount, while the shell renders
   data-bar="left" statically. Harmless only for as long as S.bar never came
   back as anything else; now that it persists, a student who moved the bar to
   the right would have had CSS paint the rail on the left while anchorTo(),
   the tooltips and the drag axis all computed for the right, popovers flying
   off the far side of the screen — and part4's side() reads this attribute,
   so the panel would have opened on the same edge as the bar. */
R.dataset.bar=S.bar;
/* S.open is which popover is showing, and it persists with the rest of S. A
   paper closed with the inspector open would reopen with S.open==='props' and
   nothing on screen, and the next press on the armed tool would close what was
   already closed rather than open it. Nothing is open at mount. */
S.open=null;
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
let geom=null;
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
function clearMeasure(){tape.remove()}
/* THE OTHER HALF OF THAT LIST, AND WITHOUT IT FIVE TOOLS DO NOTHING.

   "Only the Select tool selects text" is about the DRAWING tools — a pen must
   not grab words when you meant to draw over them. It was implemented as
   "only hand sets data-sel", which also locked out every tool whose whole job
   is a passage: Underline, Strikethrough, Note, Ask and Flag are all marked
   `mean:1` or carry a fixed meaning, none of them is ink, and every one of
   them needs a selection to exist at all.

   Highlight is deliberately not here: it carries `ink:1` as well, so armed it
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
const BUILT=['hand','pen','mkr','hl','era','ul','st','note','ask','flag','shp','msr','snap','txt'];
/* the pointer becomes the nib: a ring the size of the stroke, in its colour */
/* AND THE TOOLS THAT ARE NOT A NIB HAD THE WRONG POINTER OR NONE. Select
   showed an I-beam — the tool a reader holds most of the time looked like it
   was there to copy text rather than to point at things, and the locked design
   says an arrow for Cursor and a hand for Grab. The eraser showed the same
   `cell` cursor at 1pt as at 32, so its rub size was a number in a popover and
   nothing you could see until you had already taken something off. Snapshot
   had no cursor at all. All of it is set from here, the way the nib already
   was, because the stylesheet does not change. Grab is left to the sheet's own
   grab/grabbing pair, which an inline cursor would freeze. */
function paintCursor(){
  const stg=document.getElementById('stage');
  if(S.tool==='hand'){stg.style.cursor=(S.variant.hand||0)===1?'':'default';return}
  if(S.tool==='era'){
    const w=Math.max(8,Math.min(64,(S.size.era||10)*2)),s=Math.ceil(w)+4,h=s/2;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">`+
      `<circle cx="${h}" cy="${h}" r="${w/2}" fill="none" stroke="${GREY()}" stroke-width="1.5" opacity=".92"/>`+
      `<circle cx="${h}" cy="${h}" r="${Math.max(1,w/2-1.4)}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>`;
    stg.style.cursor=`url("data:image/svg+xml;base64,${btoa(svg)}") ${h} ${h}, cell`;return}
  if(S.tool==='snap'){stg.style.cursor='crosshair';return}
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
  R.dataset.sel =((S.tool==='hand'&&(S.variant.hand||0)===0)||TEXT.includes(S.tool))?'1':'0';
  R.dataset.draw= (DRAWS.includes(S.tool)||GEOM.includes(S.tool)||S.tool==='snap')?'1':'0';
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
     return `<div class="li ${t.lock?'lock':''}" data-id="${id}" draggable="true">
       <span class="gp" aria-hidden="true"><svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2.6" cy="3" r="1.1"/><circle cx="7.4" cy="3" r="1.1"/><circle cx="2.6" cy="7" r="1.1"/><circle cx="7.4" cy="7" r="1.1"/><circle cx="2.6" cy="11" r="1.1"/><circle cx="7.4" cy="11" r="1.1"/></svg></span>
       ${icon(id==='hand'?((S.variant.hand||0)===1?'hand':'cur'):id,colOf(t),19)}<b>${t.n}</b>
       <button class="rm" data-rm="${id}" aria-label="Remove"><svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button></div>`}).join('')}</div>
   <div class="addwrap">
     <div class="lab2">Add a tool<span>${S.tray.length} of ${CAP}</span></div>
     <div class="tabs">${['Basics','Draw','Capture','Notes']
       .filter(g=>TOOLS.some(t=>t.g===g&&BUILT.includes(t.id))).map(g=>
       `<button class="${g===S.gtab?'on':''}" data-g="${g}">${g}</button>`).join('')}</div>
     <div class="grid2">${TOOLS.filter(t=>t.g===S.gtab&&BUILT.includes(t.id)).map(t=>
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
  S.tool=id;closeAll();paintRail();save();   /* the tool in your hand is a setting */
  const nb=document.querySelector(`.t[data-t="${id}"]`);play(nb.querySelector('svg'));
});
/* ── the rail is shown, and there is no mode in which it is not ─────
   AUTO-HIDE WAS A DEMO SWITCH THAT CAME ACROSS WITH THE CHROME. railOut()
   returned unless `autoHide` was set, and the only thing that ever set it was
   window.setBarAutoHide, which nothing in this repo calls — so the reader
   could not leave the state railIn() puts it in, and a pointermove listener on
   window was doing nearEdge() arithmetic on every mouse move to keep putting
   it back. #handle's only handler was that same railIn.

   The shell renders data-rail="on" and the sheet hides #handle under it, so
   the element stays (the class check needs it) and nothing it did is missed.
   The dead listeners, the dead global and nearEdge() are gone. */
const touchOnly = matchMedia('(pointer:coarse)').matches || !matchMedia('(hover:hover)').matches;
R.dataset.plat = touchOnly ? 'touch' : 'desktop';


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
    if(z){S.bar=z.dataset.z;R.dataset.bar=S.bar;paintRail();mode();reanchor();save()}
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
    paintRail();if(S.open==='chest')paintChest();save();
    DR=null;return;
  }
  DR.ghost.remove();
  /* The order is written once, at the end of the drag, rather than in the
     reorder above — that runs on every pointermove, and a write per frame is a
     write per pixel of the drag. */
  if(S.tray.indexOf(DR.id)!==DR.from)save();
  const b=document.querySelector(`.t[data-t="${DR.id}"]`);
  if(b){b.classList.remove('lift');b.animate(
    [{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.32,.72,0,1)'})}
  DR=null;
}));


/* ── pick a tool up in the chest and drop it on the bar ────────────── */
/* THE ROW OF A TOOL YOU ALREADY HAVE CANNOT BE ADDED AGAIN. This picked up
   `.li` rows too, and a `.li` is a tool that is on the bar — so CD.had was
   always true for one and the drop below, guarded on !CD.had, could never do
   anything with it. A row's drag is a REORDER and belongs to the native drag
   handlers further down, which now have the draggable rows they always
   assumed; leaving both on the same element also strands the ghost, because a
   native drag suppresses the pointermove and pointerup that clean it up. */
let CD=null, cTimer=null;
document.getElementById('chest').addEventListener('pointerdown',e=>{
  const src=e.target.closest('[data-add]');
  if(!src)return;
  const id=src.dataset.add;
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
    S.tray.push(CD.id);S.tool=CD.id;paintRail();paintChest();save();
    const nb=document.querySelector(`.t[data-t="${CD.id}"]`);nb&&play(nb.querySelector('svg'));
  }
  CD=null;
}));

/* long-press a preset to save */
/* "TAP TO LOAD" LOADED ONCE AND THEN NEVER AGAIN. The press cleared the
   long-press TIMER on pointerup and never the element it had been armed on, so
   lpEl stayed truthy for the rest of the session — and the load branch below
   reads `if(pr&&!lpEl)`, so after the very first tap on a preset every later
   tap fell straight through and the hint under them, "Tap to load. Hold to
   save what you're using now", was half a lie.

   What that guard was for is real, though: the hold has already saved by the
   time the finger lifts, and the click that follows must not turn round and
   load what was just saved over what you are using. So the flag says whether
   the HOLD FIRED, not whether a press happened, and it is cleared by the next
   press rather than never. */
let lp,lpDone=false;
document.addEventListener('pointerdown',e=>{
  const pr=e.target.closest('.pr');if(!pr)return;
  lpDone=false;lp=setTimeout(()=>{
    const t=T(S.tool),i=+pr.dataset.pr;
    S.presets[t.id]=S.presets[t.id]||[null,null,null];
    S.presets[t.id][i]={k:S.colour[t.id]||'y',size:S.size[t.id],op:S.op[t.id]};
    paintProps();paintRail();save();
    const el=document.querySelector(`.pr[data-pr="${i}"]`);
    if(el){el.classList.add('saving');setTimeout(()=>el.classList.remove('saving'),520)}
    lpDone=true;
  },520);
});
['pointerup','pointercancel','pointerleave'].forEach(v=>
  document.addEventListener(v,()=>{clearTimeout(lp)}));

document.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){closeAll();return}

  /* THE DEMO STRIP'S THEME SWITCH WAS STILL HERE. check:paper asserts the
     strip is deleted and the shell does not render it, so this closest() ran
     on every click anywhere in the document and could never match. There is
     one livery system and it is the app's. */

  /* variant */
  const sg=e.target.closest('[data-straight]');
  if(sg){const id=sg.dataset.straight;S.straight[id]=!S.straight[id];paintProps();save();return}
  const v=e.target.closest('[data-v]');
  if(v){S.variant[S.tool]=+v.dataset.v;paintProps();reanchor();paintRail();mode();save();return}

  /* colour from the five */
  const c=e.target.closest('.c[data-k]');
  if(c){S.colour[S.tool]=c.dataset.k;paintProps();paintRail();save();return}

  /* colour from recents or the grid */
  const ch=e.target.closest('[data-hex]');
  if(ch){const hex=ch.dataset.hex;
    if(!COL.find(x=>x.hex===hex)){S.recent=[hex,...S.recent.filter(x=>x!==hex)].slice(0,6)}
    /* THE RAW HEX GOES IN S.colour AND NOWHERE ELSE. `COL.custom=hex` hung a
       property off the palette array that no reader anywhere ever looked at,
       and S.colourHex was a second copy of the same value with no reader
       either — resolve() takes a hex straight out of S.colour and always
       has. Two dead stores on the path a student uses to pick a colour. */
    S.colour[S.tool]=hex;
    paintProps();paintRail();save();
    if(S.open==='cgrid'){const el=document.querySelector('.t.on');openPo('props',el)}
    return}

  /* open the colour grid */
  if(e.target.closest('[data-grid]')){const el=document.querySelector('.t.on');openPo('cgrid',el);return}

  /* load a preset */
  const pr=e.target.closest('.pr');
  if(pr&&!lpDone){const t=T(S.tool),p=(S.presets[t.id]||[])[+pr.dataset.pr];
    if(p){S.colour[t.id]=p.k;S.size[t.id]=p.size;S.op[t.id]=p.op;paintProps();paintRail();paintCursor();save()}
    return}

  /* chest */
  const rm=e.target.closest('[data-rm]');
  if(rm){S.tray=S.tray.filter(x=>x!==rm.dataset.rm);
    if(S.tool===rm.dataset.rm)S.tool=S.tray[1]||S.tray[0];
    paintRail();paintChest();reanchor();save();return}
  const pos=e.target.closest('[data-pos]');
  if(pos){S.bar=pos.dataset.pos;R.dataset.bar=S.bar;paintChest();save();
    requestAnimationFrame(()=>reanchor());return}
  /* Reset put the student back in the state the reader used to open in — a
     highlighter armed and no way to select a word. The default six, and the
     tool that selects. */
  if(e.target.closest('[data-reset]')){S.tray=[...DEF];S.tool='hand';paintRail();paintChest();save();return}

  /* add */
  const g=e.target.closest('[data-g]');
  if(g){S.gtab=g.dataset.g;paintChest();reanchor();save();return}
  const ad=e.target.closest('[data-add]');
  if(ad){const id=ad.dataset.add;
    if(S.tray.includes(id)||S.tray.length>=CAP)return;
    S.tray.push(id);S.tray.sort((a,b)=>TOOLS.findIndex(t=>t.id===a)-TOOLS.findIndex(t=>t.id===b));
    S.tool=id;paintRail();paintChest();save();
    const nb=document.querySelector(`.t[data-t="${id}"]`);nb&&play(nb.querySelector('svg'));
    return}

  /* outside click closes */
  if(!e.target.closest('.po')&&!e.target.closest('.rail'))closeAll();
});

/* sliders */
/* Size and opacity are the two settings a student changes most and the two
   that were kept the shortest: until the next reload. They save like the rest
   now, debounced, because a range input fires on every frame of the drag —
   and the size slider repaints the pointer, so the nib ring and the rubber
   circle are the size they are about to draw at. */
document.addEventListener('input',e=>{
  if(e.target.id==='szr'){S.size[S.tool]=+e.target.value;
    const l=$('#propsIn').querySelectorAll('.lab .v');if(l[0])l[0].textContent=e.target.value+' pt';
    drawPrev();paintCursor();saveSoon()}
  if(e.target.id==='opr'){S.op[S.tool]=+e.target.value;
    const l=$('#propsIn').querySelectorAll('.lab .v');if(l[1])l[1].textContent=e.target.value+'%';
    drawPrev();saveSoon()}
});

/* drag to reorder in the chest */
/* THESE FIRED ON NOTHING. paintChest() rendered the rows without a draggable
   attribute, so dragstart never happened and the locked design's "tools drag
   from the chest onto the bar and back" was half built: the rows were listed
   and could not be moved. The rows carry draggable and the grab handle the
   sheet has always styled (.li .gp) now, and the order they end in is kept. */
let dg=null;
document.addEventListener('dragstart',e=>{const li=e.target.closest('.li');if(!li)return;
  dg=li.dataset.id;li.classList.add('drag');
  /* A drag with nothing on the clipboard is cancelled before it starts in
     Firefox, which is a drag that works on one browser and not the next. */
  try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dg)}catch(err){}});
document.addEventListener('dragover',e=>{if(dg)e.preventDefault()});
document.addEventListener('drop',e=>{const li=e.target.closest('.li');if(!li||!dg)return;
  e.preventDefault();
  const from=S.tray.indexOf(dg),to=S.tray.indexOf(li.dataset.id);
  if(from<0||to<0||from===to){dg=null;return}
  S.tray.splice(to,0,S.tray.splice(from,1)[0]);dg=null;paintRail();paintChest();save()});
document.addEventListener('dragend',()=>{dg=null;$$('.li').forEach(l=>l.classList.remove('drag'))});

/* tooltips on the rail */
const tip=$('#tip');let th;
$('#rail').addEventListener('mouseover',e=>{
  const b=e.target.closest('.t,.util');if(!b)return;
  clearTimeout(th);th=setTimeout(()=>{
    const t=T(b.dataset.t);
    tip.innerHTML=t?`${t.n}<kbd>${t.k}</kbd>`
      /* paintRail renders exactly one .util, the chest. `add` and `hide` were
         rows for two buttons the bar has not had since it was handed over. */
      :({chest:'Your bar'})[b.dataset.u]||'';
    tip.classList.add('on');
    const r=b.getBoundingClientRect(),w=tip.offsetWidth;
    if(S.bar==='left'){tip.style.left=(r.right+12)+'px';tip.style.right=''}
    else if(S.bar==='right'){tip.style.right=(innerWidth-r.left+12)+'px';tip.style.left=''}
    else{tip.style.left=Math.max(10,r.left+r.width/2-w/2)+'px';tip.style.right=''}
    tip.style.top=(S.bar==='top'?r.bottom+10:S.bar==='bottom'?r.top-34:r.top+r.height/2-14)+'px';
  },380)});
$('#rail').addEventListener('mouseout',()=>{clearTimeout(th);tip.classList.remove('on')});

/* A SHORTCUT THAT FIRES WHILE YOU ARE TYPING IS NOT A SHORTCUT. The panel's
   search box, every note box and every answer box are inside the reader, and
   this matched a single letter against the tool table with no guard at all —
   so typing "pen" into the search field armed Pen, then Eraser, then Note, and
   left the rubber live over the page. The shell's undo handler has had the
   same guard since it was written. Escape still works from inside a field, and
   lets go of the field first, so a second Escape reaches the popovers. */
addEventListener('keydown',e=>{
  const el=e.target, typing=/^(INPUT|TEXTAREA|SELECT)$/.test((el&&el.tagName)||'')||!!(el&&el.isContentEditable);
  if(e.key==='Escape'){if(typing&&el.blur)el.blur();closeAll();return}
  if(typing)return;
  /* And Cmd+S is Save, not Strikethrough. */
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const t=TOOLS.find(x=>x.k.toLowerCase()===e.key.toLowerCase());
  if(t&&S.tray.includes(t.id)){S.tool=t.id;closeAll();paintRail();save();
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
/* ── what a cursor is for ──────────────────────────────────────────────
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
const WORDCH=/[\p{L}\p{N}'\u2019-]/u;
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
  while(a<b&&/\s/.test(t[a]))a++;
  if(b<=a)return null;
  const r=document.createRange();r.setStart(node,a);r.setEnd(node,b);return r;
}
/* Grow a dragged selection out to whole words — but only once it has already
   crossed one. Inside a single word the student is being precise on purpose
   and snapping would take that away. */
function snapToWords(r){
  if(!/\s/.test(String(r)))return r;
  const s=r.startContainer,e=r.endContainer;
  if(s.nodeType===3){const [a]=growWord(s,r.startOffset,r.startOffset);r.setStart(s,a)}
  if(e.nodeType===3){const [,b]=growWord(e,r.endOffset,r.endOffset);r.setEnd(e,b)}
  return r;
}
function showSel(tapped){
  if(picked)return;                                  /* a mark is in hand */
  if(R.dataset.sel!=='1')return hideSel();           /* only the cursor selects */
  const sel=getSelection();
  if(!sel||sel.isCollapsed||!sel.rangeCount)return hideSel();
  const r=sel.getRangeAt(0);
  if(!tapped&&String(r).trim().length<3)return hideSel();
  const host=(r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer
             :r.commonAncestorContainer.parentElement);
  if(!host||!host.closest('.sheetpg'))return hideSel();
  if(picked){picked.forEach(q=>q.classList.remove('sel'));picked=null}
  /* A DRAG ENDS ON A WORD, not wherever the pointer stopped. */
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
    window.islandSay&&window.islandSay(
      k==='ask'?'askq':k==='note'?'note':(lastK==='r'?'revise':'mark'),null,lastK);
    return;
  }
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
          ask:(kind==='ask'||kind==='note'||kind==='txt')?'':undefined,ans:kind==='ask'?[]:undefined};
  WM.add(made);
  ctx.onMade(made,savedRange,pg);
  /* A MARK THAT IS A BOX FOR WORDS HAS TO OPEN THE BOX. Only a text box did.
     stamp('ask') builds `ask:''`, so Ask posted a thread to the Ready Room
     carrying the quoted passage and a blank line, while the island said
     "Question posted · anonymously" — the student was never asked what the
     question was. A Note was the same: "Note saved", and the only place to
     write it was a card on the panel they had to go and find, which listed it
     as "no words yet". All three open their card with the cursor in it now,
     from here rather than from one of the two callers, so the pill's Ask and
     an armed tool behave the same way. */
  if((kind==='txt'||kind==='note'||kind==='ask')&&ctx.onPlaced)ctx.onPlaced();
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
  }
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
/* NOTHING FLOATS FOREVER. The pill stayed up through clicks anywhere on the
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
    if(t&&!t.fixed&&!t.grey){S.colour[t.id]=lastK;paintRail();mode();save()}
    /* A QUESTION IS ALWAYS VIOLET AND ALWAYS ANONYMOUS, and recolour() below
       has always known it — it skips the repaint for an `ask` quad. This line
       did not, so the store wrote colour and ring from the pressed swatch
       anyway: the row became colour='wrong', ring='solo', the panel hides red
       marks that are not yours, an anonymous question has no author to match
       — and the student's own question disappeared from the panel with no way
       to get it back, while the quad on the page stayed violet and told them
       nothing had happened. The swatch is not offered a question. */
    if(picked&&picked[0].dataset.kind!=='ask')ctx.onRecoloured(picked[0].dataset.g,lastK);
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
/* THE FOURTH TOOL ON THE BAR DID NOTHING. The eraser is in DEF, it draws an
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
    document.querySelectorAll(`.mkq[data-g="${g}"]`).forEach(x=>x.remove());
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
  if(R.dataset.grab==='1'){
    pan={y:e.clientY,top:STG.scrollTop};STG.setPointerCapture(e.pointerId);return}
  if(R.dataset.draw!=='1')return;
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
  const pg=pgAt(e); if(!pg)return;
  e.preventDefault();
  if(GEOM.includes(S.tool)||S.tool==='snap'){
    const t2=T(S.tool), p2=document.createElementNS('http://www.w3.org/2000/svg','path');
    const r2=pg.getBoundingClientRect();
    /* The figure's width in the page's own units, computed once and kept, so
       the same number is drawn with and handed over. See the pen below. */
    const w2=(S.size[t2.id]||2)/r2.width*1000, o2=(S.op[t2.id]||100)/100;
    p2.setAttribute('fill','none');
    /* The marquee names its own stroke, which is what makes it visible: the
       stylesheet's ink colour is a fallback now (`:not([stroke])`) rather than
       a rule that beat every attribute this file set. */
    p2.setAttribute('stroke',S.tool==='snap'?'var(--lv)':colOf(t2));
    p2.setAttribute('stroke-width',w2);
    p2.setAttribute('stroke-linejoin','round');
    p2.setAttribute('stroke-linecap','round');
    if(S.tool!=='snap')p2.setAttribute('stroke-opacity',o2);
    else p2.setAttribute('stroke-dasharray','12 8');
    pg.querySelector('.ink').appendChild(p2);
    geom={path:p2,pg,a:pt(e,pg),b:pt(e,pg),tool:S.tool,w:w2,op:o2,cap:'round'};
    STG.setPointerCapture(e.pointerId);
    return;
  }
  const t=T(S.tool), c=colOf(t), r=pg.getBoundingClientRect();
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  const wide=t.id==='hl'?S.size[t.id]*1.9:S.size[t.id];
  /* THE INK IS THE TOOL'S COLOUR AGAIN. This line always set it; `.rdr .ink
     path{stroke:…}` in the sheet overrode it, so every live stroke came out
     graphite whatever the swatch said. The sheet's rule is a fallback now —
     additions.css declares it as `:not([stroke])` — and this attribute wins.
     THE WIDTH IS KEPT RATHER THAN RECOMPUTED, because it is the one number
     that cannot be rebuilt later: `wide` is a real nib in screen pixels, and
     dividing by the width the page is currently drawn at turns it into the
     page's own 0-1000 units. */
  const wvb=wide/r.width*1000, ovb=(S.op[t.id]||100)/100;
  path.setAttribute('stroke',c);
  path.setAttribute('stroke-width',wvb);
  path.setAttribute('stroke-opacity',ovb);
  /* AND CHISEL IS A DIFFERENT STROKE FROM FREE-FORM AGAIN. The cap was set
     here and `.rdr .ink path{stroke-linecap:round}` took it straight back off,
     so the two variants drew the same line and the copy in the inspector —
     "Chisel lays a straight line. Free-form follows your hand." — described a
     difference the student could not see. reader.css carries the default on
     `:not([stroke-linecap])` now, so a named cap stands. */
  const chisel = t.id==='hl' && (S.variant.hl||0)===0;
  const cap = chisel?'butt':'round';
  if(t.id==='hl')path.setAttribute('stroke-linecap',cap);
  pg.querySelector('.ink').appendChild(path);
  ink={path,pg,pts:[pt(e,pg)],straight: chisel || (t.id!=='hl' && !!S.straight[t.id]),
       w:wvb,op:ovb,cap};
  STG.setPointerCapture(e.pointerId);
});
STG.addEventListener('pointermove',e=>{
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
  if(rubbing){rub(e,rubbing);return}
  if(pan){STG.scrollTop=pan.top-(e.clientY-pan.y);return}
  if(!ink)return;
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
});
addEventListener('pointerup',()=>{
  pan=null;rubbing=null;
  /* A figure, a measurement and a snapshot each end their own way: the figure
     is kept, the measurement is read and let go, the snapshot becomes a file. */
  if(geom){
    const g=geom;geom=null;
    const far=Math.hypot(g.b[0]-g.a[0],g.b[1]-g.a[1])>6;
    if(g.tool==='snap'){g.path.remove();if(far)ctx.onSnapshot(g.pg,g.a,g.b)}
    else if(g.tool==='msr'){g.path.remove();clearMeasure()}
    else if(far&&g.pts&&g.pts.length>1)
      ctx.onStroke(g.pg,g.path,g.pts,T(g.tool),S,
        {width:g.w,opacity:g.op,cap:g.cap,variant:S.variant[g.tool]||0});
    else g.path.remove();
  }
  if(ink){
    if(ink.pts.length<2)ink.path.remove();
    /* WHAT IT WAS DRAWN WITH TRAVELS WITH IT. The store was given the tool and
       S and worked the rest out again, and got it wrong twice: it took the raw
       slider number, which is neither the highlighter's 1.9x nib nor a page
       unit, and it had nowhere to learn the opacity or the cap from. A 12pt
       highlighter stroke drawn at 100% is about 32 units on the page and came
       back as 12, solid, with round ends. These four are the numbers this
       stroke is on the screen with right now:
         width    the page's own 0-1000 units, nib and page width already in it
         opacity  0-1, as stroke-opacity takes it
         cap      'butt' for a chisel highlighter, 'round' for everything else
         variant  which version of the tool drew it */
    else ctx.onStroke(ink.pg,ink.path,ink.pts,T(S.tool),S,
      {width:ink.w,opacity:ink.op,cap:ink.cap,variant:S.variant[S.tool]||0});
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
  /* findRange has no caller today: SEED and seed() were the two, and both are
     gone. It stays because the anchoring fallback is the thing that needs it
     the day a stored anchor cannot be resolved any other way, and finding a
     quote in a page by hand is not a function worth writing twice. */
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
