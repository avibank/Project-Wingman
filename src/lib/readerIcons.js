/* =============================================================================
   Wingman Reader v5 — the shipped icon set, colour table and tool table.
   -----------------------------------------------------------------------------
   COPIED VERBATIM out of docs/reader/v5/reference.html. COMPONENTS.md v5 says
   "copy the icon() function from the reference build verbatim", and it means
   the whole table with it: the five colours, the thirteen tools, the default
   tray and the cap. `check:paper` diffs this against the reference and fails
   if a byte moves.

   The icons are FILLED and COLOURED — the icon IS the swatch. That is the
   whole reason the bar reads as a pen tray rather than a settings menu, and it
   is why `icon()` takes a colour: there is no separate swatch element to
   colour instead.

   Two vocabularies meet here and neither bends. The reference calls the five
   colours y · b · g · p · r; `paper_annotations.colour` has held
   critical · definition · limit · unsure · wrong since migration 0017, with a
   CHECK constraint and rows already written against it. MEANING_OF is the
   join, and it is the only place either name is translated.
   ========================================================================= */

const COL=[
 {k:'y',hex:'#F5C23C',name:'Yellow',course:'Exam likely',   does:'Goes into your revision deck and adds to the class heat here.'},
 {k:'b',hex:'#5BB4F0',name:'Blue',  course:'Definition',    does:'The term and this passage go into the module glossary.'},
 {k:'g',hex:'#43C08A',name:'Green', course:'Testable fact', does:'Offers to become a question in your bank.'},
 {k:'p',hex:'#B571E0',name:'Purple',course:'Ask',           does:'Opens a thread in the Ready Room. Your name is never shown.'},
 {k:'r',hex:'#EE6F82',name:'Pink',  course:'Weak spot',     does:'Counts toward Master Caution until you get it right twice.'}];
/* ── FILLED, COLOURED TOOL ICONS ──────────────────────────────────────
   the icon IS the swatch: body in the tool's colour, a dark inset for the tip */
const D='rgba(0,0,0,.34)';
export function icon(id,c,s){
  c=c||'currentColor';const S=s||21;
  const g=b=>`<svg width="${S}" height="${S}" viewBox="0 0 22 22">${b}</svg>`;
  const rot='transform="rotate(-42 11 11)"';
  switch(id){
   case 'hl': return g(`<g ${rot}><rect x="7.4" y="2.6" width="7.2" height="8.2" rx="1.3" fill="${c}"/>
     <path d="M7.4 10.8h7.2l-1 4.6H8.4z" fill="${c}"/><rect x="8.2" y="15" width="5.6" height="1.9" rx=".8" fill="${D}"/></g>`);
   case 'pen': return g(`<g ${rot}><path d="M8.2 3.2h5.6v7.9H8.2z" fill="${c}"/>
     <path d="M8.2 11.1h5.6L11 17z" fill="${c}"/><path d="M10 14.6h2L11 17z" fill="${D}"/></g>`);
   case 'mkr': return g(`<g ${rot}><rect x="6.8" y="2.6" width="8.4" height="7.6" rx="2" fill="${c}"/>
     <path d="M8 10.2h6l1.1 5.8H6.9z" fill="${c}"/><rect x="7.6" y="15.4" width="6.8" height="2" rx=".9" fill="${D}"/></g>`);
   case 'era': return g(`<g ${rot}><rect x="6.6" y="3.4" width="8.8" height="7" rx="1.6" fill="#9AA6B2"/>
     <path d="M6.6 10.4h8.8v4.4a1.4 1.4 0 01-1.4 1.4H8a1.4 1.4 0 01-1.4-1.4z" fill="#6B7885"/></g>`);
   case 'sel': return g(`<path d="M6 3.2l10.6 6.6-4.7 1.2 2.7 4.7-2.1 1.2-2.7-4.7-3.8 2.9z" fill="#A8B4C0"/>`);
   case 'ul':  return g(`<path d="M7 4v5.6a4 4 0 008 0V4" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
     <rect x="5.4" y="16.4" width="11.2" height="2.1" rx="1" fill="${c}"/>`);
   case 'st':  return g(`<path d="M14.8 6.6C14 5.2 12.7 4.5 11 4.5 8.7 4.5 7.2 5.7 7.2 7.2c0 1.1.7 2 2 2.5" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>
     <path d="M7.4 14.6c.8 1.4 2.2 2.1 3.9 2.1 2.2 0 3.8-1.1 3.8-2.7" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>
     <rect x="4.4" y="10" width="13.2" height="2.1" rx="1" fill="${D}"/>`);
   case 'shp': return g(`<rect x="3.4" y="7" width="9" height="9" rx="1.6" fill="${c}"/>
     <circle cx="14.6" cy="8" r="4.2" fill="${c}" opacity=".62"/>`);
   case 'txt': return g(`<rect x="4" y="4" width="14" height="2.4" rx="1" fill="${c}"/>
     <rect x="9.8" y="4" width="2.4" height="13.6" rx="1" fill="${c}"/>
     <rect x="7.4" y="15.4" width="7.2" height="2.2" rx="1" fill="${D}"/>`);
   case 'msr': return g(`<g ${rot}><rect x="7" y="2.4" width="8" height="17.2" rx="1.6" fill="${c}"/>
     <rect x="7" y="6" width="3.4" height="1.5" rx=".7" fill="${D}"/><rect x="7" y="9.6" width="4.6" height="1.5" rx=".7" fill="${D}"/>
     <rect x="7" y="13.2" width="3.4" height="1.5" rx=".7" fill="${D}"/></g>`);
   case 'note':return g(`<path d="M3.6 5.4a1.8 1.8 0 011.8-1.8h11.2a1.8 1.8 0 011.8 1.8v7a1.8 1.8 0 01-1.8 1.8h-6.3L6.4 18v-3.8H5.4a1.8 1.8 0 01-1.8-1.8z" fill="${c}"/>
     <rect x="6.4" y="7" width="9.2" height="1.5" rx=".7" fill="${D}"/><rect x="6.4" y="10" width="6" height="1.5" rx=".7" fill="${D}"/>`);
   case 'ask': return g(`<circle cx="11" cy="11" r="7.8" fill="${c}"/>
     <path d="M8.9 8.9a2.1 2.1 0 014.1.6c0 1.4-2 1.8-2 3.2" stroke="rgba(255,255,255,.92)" stroke-width="1.9" fill="none" stroke-linecap="round"/>
     <circle cx="11" cy="15.4" r="1.1" fill="rgba(255,255,255,.92)"/>`);
   case 'flag':return g(`<rect x="4.4" y="3" width="2" height="16" rx="1" fill="${D}"/>
     <path d="M6.4 4.4c3.2-1.5 6.4 1.5 9.6 0v6.6c-3.2 1.5-6.4-1.5-9.6 0z" fill="${c}"/>`);
   case 'chest':return g(`<rect x="3" y="7.6" width="16" height="10.4" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <path d="M8 7.6V6a1.6 1.6 0 011.6-1.6h2.8A1.6 1.6 0 0114 6v1.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
     <rect x="9.4" y="11" width="3.2" height="2.4" rx=".8" fill="currentColor"/>`);
  }
  return '';
}
/* every tool carries its basic versions — one bar entry, all the variants */
const TOOLS=[
 {id:'sel',n:'Select',k:'V',g:'Basics',lock:1,v:['Pointer','Lasso']},
 {id:'hl',n:'Highlight',k:'H',g:'Basics',c:1,text:1,p:3,v:['Text','Free-form']},
 {id:'ul',n:'Underline',k:'U',g:'Basics',c:1,text:1,v:['Straight','Squiggly']},
 {id:'st',n:'Strikethrough',k:'S',g:'Basics',c:1,text:1},
 {id:'pen',n:'Pen',k:'P',g:'Draw',c:1,p:3,v:['Pen','Pencil','Fountain']},
 {id:'mkr',n:'Marker',k:'M',g:'Draw',c:1,p:3,v:['Round','Chisel']},
 {id:'era',n:'Eraser',k:'E',g:'Draw',v:['Whole stroke','Area']},
 {id:'shp',n:'Shape',k:'R',g:'Draw',c:1,v:['Line','Arrow','Box','Ellipse']},
 {id:'txt',n:'Text',k:'T',g:'Insert',c:1,v:['Text box','Callout']},
 {id:'msr',n:'Measure',k:'K',g:'Insert',c:1,v:['Distance','Area']},
 {id:'note',n:'Note',k:'N',g:'Notes',c:1,taker:1,v:['Anywhere','On a passage']},
 {id:'ask',n:'Question',k:'Q',g:'Notes',taker:1,fixed:'p',course:1,v:['Anywhere','On a passage']},
 {id:'flag',n:'Flag',k:'F',g:'Notes',c:1}];
const T=id=>TOOLS.find(t=>t.id===id);
const DEF=['sel','hl','pen','era','note','ask'];
const CAP=10;


/* ── the join to this codebase's data model ───────────────────────────────
   Left of the arrow is what the reference calls it; right is what is stored.
   Neither list moves to suit the other. */
export const MEANING_OF = { y: "critical", b: "definition", g: "limit", p: "unsure", r: "wrong" };
export const KEY_OF = Object.fromEntries(Object.entries(MEANING_OF).map(([k, m]) => [m, k]));
export const colourKey = (meaning) => KEY_OF[meaning] || "y";

/* Tool id → the kind a mark is stored as. A tool with no entry writes no
   annotation row: select, eraser, measure, and the drawn tools, which are ink. */
export const KIND_OF = {
  hl: "highlight", ul: "underline", st: "strikethrough",
  note: "note", ask: "question", flag: "correction",
};
export const kindOf = (id) => KIND_OF[id] || null;
export const TOOL_OF_KIND = Object.fromEntries(Object.entries(KIND_OF).map(([t, k]) => [k, t]));

export const tool = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];
export const col = (k) => COL.find((c) => c.k === k) || COL[0];
export const GROUPS = [...new Set(TOOLS.map((t) => t.g))];

/* Which tools act on the text layer, which draw ink, which open a widget. */
export const marksText = (id) => !!tool(id).text;
export const INK = new Set(["pen", "mkr", "era", "shp", "txt", "msr"]);
export const isInk = (id) => INK.has(id);
export const isTaker = (id) => !!tool(id).taker;
export const hasColour = (id) => !!tool(id).c;
/* `ask` is fixed to purple — a question is a question, whatever colour is in
   your hand — and `fixed` in the table is how the reference says so. */
export const fixedColour = (id) => tool(id).fixed || null;
export const courseOnly = (id) => !!tool(id).course;
export const variants = (id) => tool(id).v || null;

/* The reference build's own starting values for every tool, lifted out of its
   D0 state object. A tool's colour, nib and opacity are ITS OWN — a highlighter
   at 38% and a marker at 55% are different instruments, and one shared opacity
   slider made every tool wrong except the last one touched. */
export const TOOL_COLOUR = { hl:'y', ul:'y', st:'r', pen:'b', mkr:'y', shp:'b', txt:'b', msr:'g', note:'y', flag:'r' };
export const TOOL_SIZE   = { hl:12, ul:2, st:2, pen:3, mkr:14, shp:2, txt:14, msr:2, note:12, flag:2 };
export const TOOL_ALPHA  = { hl:38, ul:100, st:100, pen:100, mkr:55, shp:100, txt:100, msr:100, note:100, flag:100 };

/* paper_ink.colour holds eight names and has since 0017. v5 offers five
   colours, full stop — there is no separate ink palette any more — so a stroke
   drawn now stores one of these five. The other three names are not removed:
   strokes already drawn in orange, graphite or the eighth still render, because
   the stylesheet still knows them. Offering a colour and storing a colour are
   different questions and only the first one changed. */
export const INK_OF = { y: "yellow", b: "blue", g: "green", p: "purple", r: "red" };
export const INK_KEY = Object.fromEntries(Object.entries(INK_OF).map(([k, n]) => [n, k]));

export { COL, TOOLS, DEF, CAP };
