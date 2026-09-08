/* ============================================================================
   Wingman Papers Reader — icon set and tool definitions
   ----------------------------------------------------------------------------
   COPY VERBATIM. These paths are drawn on one 20px grid at 1.5px stroke, and
   the marking tools are drawn as tilted physical objects (a nib, a chisel, a
   marker barrel) rather than flat symbols — that is what makes the rail read
   as a pen tray instead of a settings menu. Do not substitute an icon library.

   Render every one of these as:

     <svg width="19" height="19" viewBox="0 0 20 20" fill="none"
          stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"> {svg} </svg>

   ROT is the trick: the tool is drawn upright, then rotated -45° about the
   icon centre, which is why the nib and chisel look like held objects.
   ========================================================================= */

const ROT = 'transform="rotate(-45 10 10)"';

/* ── the five mark colours ───────────────────────────────────────────────
   Fixed across every livery. They carry meaning, so they must not shift
   with the accent colour.                                                  */

export const COLOURS = [
  { key:'critical',   hex:'#F2B33D', name:'Exam likely',
    dest:'Revision deck',
    does:'Goes into your revision deck, and adds to the class heat on this passage.' },
  { key:'definition', hex:'#5BA4F0', name:'Definition',
    dest:'Module glossary',
    does:'The term and this passage are pulled into the module glossary.' },
  { key:'limit',      hex:'#4FBE92', name:'Testable fact',
    dest:'Question bank',
    does:'Offers to turn this into a question in your bank — figures, limits, procedures.' },
  { key:'unsure',     hex:'#C77CD0', name:'Ask',
    dest:'Opens a thread',
    does:'Opens a thread on this passage in the Ready Room. Turns solid once someone answers.' },
  { key:'wrong',      hex:'#EC7059', name:'Weak spot',
    dest:'Master Caution',
    does:'Counts toward Master Caution until you answer it right twice.' },
];

/* ── tools ───────────────────────────────────────────────────────────────
   group      — how the Add-tool sheet is tabbed
   presets    — shows as a superscript count on the icon
   colour     — carries one of the five mark colours; shows a swatch bar
   marksText  — operates on the text layer (tap a sentence)
   locked     — cannot be removed from the tray                            */

export const TOOLS = [
  { id:'sel',   name:'Select',      hint:'Pick a mark back up',            key:'V', group:'Select',   locked:true,
    svg:'<path d="M5 3.2l9.6 6-4.2 1.1 2.4 4.2-1.9 1.1-2.4-4.2-3.5 2.6z"/>' },

  { id:'hl',    name:'Highlighter', hint:'Tap a sentence',                 key:'H', group:'Mark up', presets:3, colour:true, marksText:true,
    svg:`<g ${ROT}><path d="M7.4 3.2h5.2v6.6H7.4z"/><path d="M7.4 9.8h5.2l-.7 4.4H8.1z"/><path d="M8.1 14.2h3.8"/></g>` },

  { id:'ul',    name:'Underline',   hint:'Rule under a sentence',          key:'U', group:'Mark up', colour:true, marksText:true,
    svg:'<path d="M6.2 3.8v5.4a3.8 3.8 0 007.6 0V3.8"/><path d="M4.8 16.2h10.4"/>' },

  { id:'st',    name:'Strike',      hint:'Line through',                   key:'S', group:'Mark up', colour:true, marksText:true,
    svg:'<path d="M4 10h12"/><path d="M13.4 6.4C12.7 5.2 11.5 4.5 10 4.5 8 4.5 6.6 5.6 6.6 7c0 1 .6 1.8 1.8 2.3"/><path d="M6.7 13.4c.7 1.3 2 2 3.5 2 2 0 3.5-1 3.5-2.5"/>' },

  { id:'pen',   name:'Pen',         hint:'Pressure ink',                   key:'P', group:'Ink',     presets:3, colour:true, freeColour:true,
    svg:`<g ${ROT}><path d="M8 3.4h4v7.2H8z"/><path d="M8 10.6h4l-2 4.6z"/></g>` },

  { id:'mkr',   name:'Marker',      hint:'Broad translucent ink',          key:'M', group:'Ink',     presets:3, colour:true, freeColour:true,
    svg:`<g ${ROT}><rect x="6.6" y="2.8" width="6.8" height="6.6" rx="1.4"/><path d="M7.6 9.4h4.8l.9 5.2H6.7z"/></g>` },

  { id:'era',   name:'Eraser',      hint:'Whole stroke · ink only',        key:'E', group:'Ink',     mode:true,
    svg:`<g ${ROT}><rect x="6.4" y="3.6" width="7.2" height="6" rx="1.3"/><path d="M6.4 9.6h7.2v4.2a1 1 0 01-1 1h-5.2a1 1 0 01-1-1z"/></g>` },

  { id:'shp',   name:'Shape',       hint:'Line · arrow · box · circle',    key:'R', group:'Draw',    presets:3, colour:true, freeColour:true,
    svg:'<rect x="3.4" y="6.6" width="8" height="8" rx="1.2"/><circle cx="13.2" cy="7.4" r="3.8"/>' },

  { id:'txt',   name:'Text box',    hint:'Type or write on the page',      key:'T', group:'Draw',    colour:true, freeColour:true,
    svg:'<path d="M4.4 6V4.2h11.2V6"/><path d="M10 4.2v11.6"/><path d="M7.6 15.8h4.8"/>' },

  { id:'msr',   name:'Measure',     hint:'Calibrate, then measure',        key:'K', group:'Draw',
    svg:`<g ${ROT}><rect x="6.6" y="2.4" width="6.8" height="15.2" rx="1.2"/><path d="M6.6 6h2.6M6.6 9h3.4M6.6 12h2.6M6.6 15h3.4"/></g>` },

  /* Wingman-specific glyphs — a serrated inspection seal, a placard, a snag
     tag. These are the ones that stop the set looking bought.              */
  { id:'stamp', name:'Sign off',    hint:'Serrated inspection seal',       key:'G', group:'Sign off',
    svg:'<circle cx="10" cy="9.4" r="5.4" stroke-dasharray="1.9 1.5"/><circle cx="10" cy="9.4" r="2.9"/><path d="M6.6 16.4h6.8"/>' },

  { id:'note',  name:'Note',        hint:'Opens inline under the passage', key:'N', group:'Talk',
    svg:'<path d="M4 4.6h12v8.2H9.4L6 16.2v-3.4H4z"/>' },

  { id:'ask',   name:'Question',    hint:'Placard — goes to the module',   key:'Q', group:'Talk',
    svg:'<rect x="3.4" y="3.4" width="13.2" height="8.4" rx="1.4"/><path d="M10 11.8v4.8"/><path d="M7.4 16.6h5.2"/><path d="M8.4 6.6a1.7 1.7 0 013.3.5c0 1.1-1.6 1.3-1.6 2.3"/>' },

  { id:'cor',   name:'Correction',  hint:'Snag tag — routes to the author',key:'C', group:'Talk',
    svg:'<path d="M8.2 3.4h5.4a2.4 2.4 0 012.4 2.4v5.2l-5.4 5.4a1.6 1.6 0 01-2.3 0l-5-5a1.6 1.6 0 010-2.3z"/><circle cx="12.6" cy="7.2" r="1.15"/>' },
];

/* Six by default. Not thirteen. The rail is short on day one and the student
   adds what they use. Cap the tray at 10 (8 tablet, 5 phone).              */
export const DEFAULT_TRAY = ['sel','hl','pen','era','note','ask'];

export const TRAY_CAP = { desktop:10, tablet:8, phone:5 };

export const GROUPS = ['Select','Mark up','Ink','Draw','Sign off','Talk'];

/* ── chrome icons ───────────────────────────────────────────────────────── */

export const ICONS = {
  back:    '<path d="M12 4L6.5 10 12 16"/>',
  pages:   '<rect x="3" y="3.5" width="14" height="13" rx="2.2"/><path d="M8 3.5v13"/>',
  find:    '<circle cx="9" cy="9" r="5.2"/><path d="M13 13l4 4"/>',
  refresh: '<path d="M16.2 8.4A6.4 6.4 0 004.4 6.6"/><path d="M3.8 11.6a6.4 6.4 0 0011.8 1.8"/><path d="M4.2 3v3.6h3.6"/><path d="M15.8 17v-3.6h-3.6"/>',
  marks:   '<path d="M4 5.5h12M4 10h12M4 14.5h7"/>',
  revision:'<path d="M4 5h9M4 9.5h12M4 14h6"/><rect x="14.4" y="3.4" width="3" height="3.2" rx="1" fill="currentColor" stroke="none"/>',
  light:   '<circle cx="10" cy="10" r="4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6L6 6M14 14l1.4 1.4M15.4 4.6L14 6M6 14l-1.4 1.4"/>',
  more:    '<circle cx="5" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.4" fill="currentColor" stroke="none"/>',
  undo:    '<path d="M6 7H12.5a4 4 0 010 8H8"/><path d="M8.5 4L5.5 7l3 3"/>',
  redo:    '<path d="M14 7H7.5a4 4 0 000 8H12"/><path d="M11.5 4l3 3-3 3"/>',
  prev:    '<path d="M12 4l-5 6 5 6"/>',
  next:    '<path d="M8 4l5 6-5 6"/>',
  zoomOut: '<path d="M5 10h10"/>',
  zoomIn:  '<path d="M5 10h10M10 5v10"/>',
  density: '<circle cx="7" cy="7" r="2.6"/><circle cx="13.2" cy="12" r="2.6"/><path d="M3 16c.7-2 2.2-3 4-3"/>',
  add:     '<path d="M10 5v10M5 10h10"/>',
  close:   '<path d="M5 5l10 10M15 5L5 15"/>',
  chevron: '<path d="M5 8l5 5 5-5"/>',
  reset:   '<path d="M15.5 8A6 6 0 104 8"/><path d="M4 4v4h4"/>',
  trash:   '<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6"/>',
  agree:   '<path d="M6 9.5l3.2-5a1.6 1.6 0 013 .8V9h3.3a1.6 1.6 0 011.5 2l-1.2 4.4a1.6 1.6 0 01-1.5 1.1H6z"/><rect x="2.5" y="9.5" width="3.5" height="7" rx="1"/>',
  backTo:  '<path d="M8 4L3.5 10 8 16"/><path d="M3.5 10H16"/>',
};

/* ── keyboard map ────────────────────────────────────────────────────────
   Tool letters fire only for tools on the tray.                            */
export const KEYS = {
  tools: Object.fromEntries(TOOLS.map(t => [t.key, t.id])),
  '1':'critical', '2':'definition', '3':'limit', '4':'unsure', '5':'wrong',
  // 1–5 recolour the selected mark, or set the active tool's colour
  'Escape':'dismiss',
  'mod+z':'undo', 'mod+shift+z':'redo',
  'mod+f':'find', 'mod+0':'fitWidth',
};
