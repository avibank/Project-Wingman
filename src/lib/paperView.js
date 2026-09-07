/* =============================================================================
   HOW THE PAPER IS SHOWN — zoom, layout, and the light it is read in.

   Pure. The arithmetic every reader gets wrong lives here so it can be checked:
   which pages are in a spread, what "fit page" actually is once the page is
   rotated, and which pages are worth rendering when you are looking at one of
   fourteen.
   ========================================================================= */

/* -----------------------------------------------------------------------------
   ZOOM

   The steps are the ones every reader uses, because a student who has zoomed a
   PDF before already knows what 125% does. Two of the entries are not numbers
   at all — fit width and fit page are computed from the window — and they sit
   in the same menu because to a reader they are the same decision.
   -------------------------------------------------------------------------- */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

export const FITS = [
  { id: "width", label: "Fit width" },
  { id: "page", label: "Fit page" },
  { id: "actual", label: "Actual size" },
];

/* The next step up or down, rather than a multiply. A multiply drifts — three
   presses of + and three of − should land you exactly where you started, and
   with `z * 1.15` they do not. */
export function stepZoom(current, direction) {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_MAX;
  const under = ZOOM_STEPS.filter((z) => z < current - 0.001);
  return under.length ? under[under.length - 1] : ZOOM_MIN;
}

export const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/* What a fit resolves to, given the room available and the page it is fitting.
   Rotation swaps the page's sides BEFORE anything is divided, which is the step
   that gets left out: a landscape page turned upright fits differently. */
export function fitScale(fit, page, room, gutters = { x: 48, y: 48 }, across = 1) {
  if (!page || !room?.width || !room?.height) return 1;
  const w = page.rotated ? page.h : page.w;
  const h = page.rotated ? page.w : page.h;
  const usableW = Math.max(80, room.width - gutters.x) / across;
  const usableH = Math.max(80, room.height - gutters.y);
  if (fit === "width") return clampZoom(usableW / w);
  if (fit === "page") return clampZoom(Math.min(usableW / w, usableH / h));
  return 1;                                     // actual size is 1, by definition
}

/* -----------------------------------------------------------------------------
   LAYOUT

   Three, and they are the three every reader offers: one long scroll, one page
   at a time, and two side by side like an open book. The third is the only one
   with any thinking in it, and the thinking is the cover.
   -------------------------------------------------------------------------- */
export const LAYOUTS = [
  { id: "scroll", label: "Continuous" },
  { id: "single", label: "Single page" },
  { id: "spread", label: "Two pages" },
];

/* A book opens with the cover alone on the right-hand side, so page 1 is by
   itself and 2-3, 4-5 face each other. Pairing 1-2 instead puts every spread
   one page out for the whole document, which is wrong on anything with a
   cover and looks it. */
export function spreads(pages) {
  if (pages <= 0) return [];
  const out = [[1]];
  for (let n = 2; n <= pages; n += 2) {
    out.push(n + 1 <= pages ? [n, n + 1] : [n]);
  }
  return out;
}

export const spreadOf = (page) => (page <= 1 ? 0 : Math.floor((page - 2) / 2) + 1);

/* WHICH PAGES ARE WORTH DRAWING.

   A page is a canvas the size of the page and a text layer of every run on it,
   so rendering all fourteen at 250% is tens of megabytes of bitmap for thirteen
   pages nobody is looking at. Continuous keeps a window either side, so a scroll
   never lands on a blank; the paged layouts draw what is on screen and one
   ahead, because the next thing that happens is almost always "next page". */
export function pagesToDraw(layout, current, total, window = 2) {
  const want = new Set();
  const add = (n) => { if (n >= 1 && n <= total) want.add(n); };
  if (layout === "scroll") {
    for (let d = -window; d <= window; d++) add(current + d);
  } else if (layout === "spread") {
    const list = spreads(total);
    const at = spreadOf(current);
    for (const n of list[at] || []) add(n);
    for (const n of list[at + 1] || []) add(n);
    for (const n of list[at - 1] || []) add(n);
  } else {
    add(current); add(current + 1); add(current - 1);
  }
  return [...want].sort((a, b) => a - b);
}

/* -----------------------------------------------------------------------------
   THE LIGHT

   Reading a white page at midnight is the complaint every PDF reader eventually
   answers, and they all answer it the same way: leave the document alone and
   change the light falling on it. A filter on the rendered picture, so nothing
   about the file, the text layer or a single mark is touched — and the marks
   layer sits outside the filter, because inverting somebody's yellow highlight
   to blue is worse than not dimming at all.

   Sepia is not nostalgia. A warm, slightly dark page is measurably easier to
   look at for an hour than a pure white one, which is the whole session for
   somebody revising.
   -------------------------------------------------------------------------- */
export const PAPER_LIGHTS = [
  { id: "day", label: "Paper", filter: "none" },
  { id: "sepia", label: "Warm", filter: "sepia(.34) brightness(.97) saturate(.9)" },
  { id: "dim", label: "Dim", filter: "brightness(.82) contrast(1.03)" },
  { id: "night", label: "Night", filter: "invert(1) hue-rotate(180deg) brightness(.9) contrast(1.08)" },
];
export const lightFilter = (id) => (PAPER_LIGHTS.find((l) => l.id === id) || PAPER_LIGHTS[0]).filter;

/* -----------------------------------------------------------------------------
   FINDING

   Substring, with the two options every find bar has. Both are off by default,
   because a student looking for "bolt" wants "Bolt" too — and both are honest
   about what they do rather than approximating: whole word means a word
   boundary, not "surrounded by spaces", so it still finds a term at the end of
   a sentence.
   -------------------------------------------------------------------------- */
export function findAll(text, query, { matchCase = false, wholeWord = false } = {}, cap = 2000) {
  const q = String(query || "");
  if (!text || !q.trim()) return [];
  const hay = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? q : q.toLowerCase();
  const isWord = (ch) => ch != null && /[\p{L}\p{N}_]/u.test(ch);
  const out = [];
  for (let at = hay.indexOf(needle); at !== -1 && out.length < cap; at = hay.indexOf(needle, at + 1)) {
    if (wholeWord) {
      if (isWord(hay[at - 1]) || isWord(hay[at + needle.length])) continue;
    }
    out.push({ start: at, end: at + needle.length });
  }
  return out;
}

/* -----------------------------------------------------------------------------
   THE OUTLINE

   pdf.js hands back the document's own table of contents as a tree of
   destinations. Flattened here with a depth on each row, because a tree of
   nested <ul>s is four components and a flat list with an indent is one — and
   the reader only ever needs "how far in is this".
   -------------------------------------------------------------------------- */
export function flattenOutline(nodes = [], depth = 0, out = []) {
  for (const n of nodes) {
    out.push({ title: (n.title || "").trim() || "Untitled", dest: n.dest, depth, bold: !!n.bold, italic: !!n.italic });
    if (n.items?.length && depth < 5) flattenOutline(n.items, depth + 1, out);
  }
  return out;
}
