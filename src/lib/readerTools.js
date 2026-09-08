/* =============================================================================
   The shipped tool table, joined to this codebase's data model.
   -----------------------------------------------------------------------------
   readerIcons.js is the spec, copied byte for byte, and its tool ids are the
   ones the DOM and the stylesheet use: `hl`, `ul`, `st`, `pen`, `mkr`, `era`…

   The DATABASE has its own vocabulary and always did — `paper_annotations.kind`
   is 'highlight' | 'underline' | 'strikethrough' | 'note' | 'question' |
   'correction', with a CHECK constraint and rows already written against it.
   Those two are different things: one is the tool in your hand, the other is
   what got stored. This file is the join, and it is the only place either
   vocabulary is translated — so neither has to bend to the other.
   ========================================================================= */

import { TOOLS, COLOURS, DEFAULT_TRAY, TRAY_CAP, GROUPS } from "./readerIcons.js";

export { TOOLS, COLOURS, DEFAULT_TRAY, TRAY_CAP, GROUPS };

export const tool = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];

/* Tool id → the kind a mark is stored as. Tools with no entry make no
   annotation row (select, eraser, measure, shapes drawn as ink). */
export const KIND_OF = {
  hl: "highlight",
  ul: "underline",
  st: "strikethrough",
  note: "note",
  ask: "question",
  cor: "correction",
};
export const kindOf = (id) => KIND_OF[id] || null;

/* The reverse, for drawing a mark that already exists. */
export const TOOL_OF_KIND = Object.fromEntries(
  Object.entries(KIND_OF).map(([t, k]) => [k, t]),
);

/* Which tools act on the text layer — the spec's own flag, not a second list. */
export const marksText = (id) => !!tool(id).marksText;
/* Which draw freehand. `shp` and `txt` are drawn on the page too, so the text
   layer must stop taking pointer events for them as well. */
export const INK_TOOLS = new Set(["pen", "mkr", "era", "shp", "txt", "msr"]);
export const isInk = (id) => INK_TOOLS.has(id);
/* Which open the composer rather than marking immediately. */
export const WRITTEN = new Set(["note", "ask", "cor"]);
export const isWritten = (id) => WRITTEN.has(id);

/* Which carry one of the five meanings (closed set) versus free ink colour. */
export const takesMeaning = (id) => !!tool(id).colour && !tool(id).freeColour;
export const takesFreeColour = (id) => !!tool(id).freeColour;
export const hasColour = (id) => !!tool(id).colour;

export const colour = (key) => COLOURS.find((c) => c.key === key) || COLOURS[0];
export const COLOUR_KEYS = COLOURS.map((c) => c.key);

/* The Add sheet is tabbed by the spec's own group names. */
export const groupsOf = (ids) => {
  const out = [];
  let last = null;
  for (const id of ids) {
    const g = tool(id).group;
    if (g !== last) out.push([]);
    out[out.length - 1].push(id);
    last = g;
  }
  return out;
};

export const capForWidth = (w) =>
  (w < 768 ? TRAY_CAP.phone : w < 1200 ? TRAY_CAP.tablet : TRAY_CAP.desktop);

/* Shortcuts fire only for tools ON the tray — a key that switches to something
   the student removed is the tray not meaning anything. */
export const shortcutFor = (key, tray) => {
  const hit = TOOLS.find((t) => t.key.toLowerCase() === String(key).toLowerCase());
  return hit && tray.includes(hit.id) ? hit.id : null;
};
