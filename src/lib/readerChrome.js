/* =============================================================================
   Wingman Reader v5 — the chrome glyphs.
   -----------------------------------------------------------------------------
   `icon()` in readerIcons.js draws the TOOLS, and it is the reference build's
   own function copied verbatim. The chrome glyphs are not in it — in the
   reference they are written inline in the markup — so they are lifted here,
   path for path, from docs/reader/v5/reference.html.

   They are strokes on a 20px grid, where the tool icons are fills on a 22px
   one. That is not an inconsistency to tidy up: the tools are objects you pick
   up and the chrome is a set of controls, and drawing them the same way is
   what made the v4 rail read as a settings menu.
   ========================================================================= */

/* Stroked, 20px grid, 1.6 unless the glyph says otherwise. */
export const CHROME = {
  sync:  '<path d="M16.2 8.4A6.4 6.4 0 004.4 6.6"/><path d="M3.8 11.6a6.4 6.4 0 0011.8 1.8"/><path d="M4.2 3v3.6h3.6"/><path d="M15.8 17v-3.6h-3.6"/>',
  rev:   '<path d="M4 5h9M4 9.5h12M4 14h6"/><rect x="14.4" y="3.4" width="3" height="3.2" rx="1" fill="currentColor" stroke="none"/>',
  panel: '<path d="M4 5.5h12M4 10h12M4 14.5h7"/>',
  look:  '<circle cx="10" cy="10" r="4"/><path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.8 4.8l1.3 1.3M13.9 13.9l1.3 1.3M15.2 4.8L13.9 6.1M6.1 13.9l-1.3 1.3" stroke-linecap="round"/>',
  more:  '<circle cx="5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/>',
  undo:  '<path d="M6 7H12.5a4 4 0 010 8H8"/><path d="M8.5 4L5.5 7l3 3"/>',
  redo:  '<path d="M14 7H7.5a4 4 0 000 8H12"/><path d="M11.5 4l3 3-3 3"/>',
  zoomOut: '<path d="M5 10h10"/>',
  zoomIn:  '<path d="M5 10h10M10 5v10"/>',
  back:  '<path d="M8 4L3.5 10 8 16"/><path d="M3.5 10H16"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
  add:   '<path d="M10 5v10M5 10h10"/>',
  chev:  '<path d="M7 5l5 5-5 5"/>',
  trash: '<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6"/>',
  copy:  '<rect x="7" y="7" width="9" height="9" rx="1.6"/><path d="M13 7V5.4A1.4 1.4 0 0011.6 4H5.4A1.4 1.4 0 004 5.4v6.2A1.4 1.4 0 005.4 13H7"/>',
  grip:  '<circle cx="7.5" cy="6" r="1.2"/><circle cx="12.5" cy="6" r="1.2"/><circle cx="7.5" cy="10" r="1.2"/><circle cx="12.5" cy="10" r="1.2"/><circle cx="7.5" cy="14" r="1.2"/><circle cx="12.5" cy="14" r="1.2"/>',
};

/* The glyphs the reference fills rather than strokes. `more` is three dots and
   `grip` six; stroking a 1.4r circle draws a ring, not a dot. */
const FILLED = new Set(["more", "grip"]);

export function chrome(name, size = 17) {
  const body = CHROME[name];
  if (!body) return "";
  return FILLED.has(name)
    ? `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="currentColor">${body}</svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor"`
      + ` stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/* The wordmark's glyph, from the reference's own `.logo`. 1.9 stroke on a
   22px grid — it is the brand, not a control, and it is drawn heavier. */
export const LOGO = '<svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor"'
  + ' stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M2.6 12.6l8.4-9.2 8.4 9.2"/><path d="M6.4 12.4l4.6 6.4 4.6-6.4"/></svg>';
