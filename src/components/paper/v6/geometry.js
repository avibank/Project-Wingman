/* Where a passage is, on the page, right now.
 *
 * A mark is stored as characters — HANDOVER section 3, and R1 of the original
 * brief, which the database enforces with a CHECK that refuses any anchor
 * carrying a page, rect or bbox. So every rectangle the reader draws is
 * MEASURED at draw time, from the rendered text layer, and thrown away again.
 * This file is the measuring.
 */

/* ── a DOM Range over a run of characters ───────────────────────────────
   The spans come out of the text layer itself rather than out of a list kept
   beside it, and they are found by the attribute SheetPage writes onto them:
   `data-item` is the index of the run the span was built from, and it is only
   ever written when the spans and the runs were checked to line up one for
   one. So a layer that is mid-rebuild, or one whose runs did not match,
   simply yields nothing — which is the honest failure, a mark that is not
   drawn rather than a mark drawn in the wrong place.

   Keeping a parallel array of spans is what this replaces, and it is worth
   saying why: the array had to be added when a text layer rendered, removed
   when it was replaced, and removed again when the page unmounted, and any
   one of those going out of order left the reader holding spans that were no
   longer on the page — or holding none while 163 of them sat in the DOM. The
   DOM is the copy that cannot drift. */
export function spansIn(textEl) {
  if (!textEl) return null;
  const found = textEl.querySelectorAll("span[data-item]");
  if (!found.length) return null;
  const out = [];
  for (const el of found) out[Number(el.dataset.item)] = el;
  return out;
}

export function rangeOver(spans, items, from, to) {
  if (!spans || !items) return null;
  let a = null, b = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.end <= from) continue;
    if (it.start >= to) break;
    const node = spans[i]?.firstChild;
    if (!node || node.nodeType !== 3) continue;
    const lo = Math.min(Math.max(0, from - it.start), node.length);
    const hi = Math.min(Math.max(0, to - it.start), node.length);
    if (!a) a = [node, lo];
    b = [node, hi];
  }
  if (!a || !b) return null;
  const r = document.createRange();
  try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); } catch { return null; }
  return r;
}

/* ── which characters a selection landed on ─────────────────────────────
   The other direction, for a mark the student has just made. A boundary in a
   span the reader knows about becomes an offset into the paper's text; a
   boundary anywhere else (the gap between two runs, say) is walked to the
   nearest one that is. */
function boundary(node, offset, spans, items, end) {
  let el = node.nodeType === 3 ? node.parentElement : node;
  while (el && el.dataset?.item === undefined) el = el.parentElement;
  if (el?.dataset?.item !== undefined) {
    const i = Number(el.dataset.item);
    const it = items[i];
    if (it) return it.start + Math.min(offset, it.str.length);
  }
  /* Not inside a run. Take the nearest span in the direction the boundary is
     travelling, so a selection that starts in white space still starts on a
     word rather than nowhere. */
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (!s) continue;
    const where = node.compareDocumentPosition(s);
    if (where & Node.DOCUMENT_POSITION_FOLLOWING) {
      return end ? items[Math.max(0, i - 1)]?.end ?? null : items[i]?.start ?? null;
    }
  }
  return end ? items[items.length - 1]?.end ?? null : null;
}

export function offsetsOf(range, spans, items) {
  if (!range || !spans || !items) return null;
  const start = boundary(range.startContainer, range.startOffset, spans, items, false);
  const end = boundary(range.endContainer, range.endOffset, spans, items, true);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

/* ── screen rectangles, in the page's own coordinates ───────────────────
   reader.css rotates the whole sheet — `.sheetpg { transform: rotate(var(--rot)) }`
   — and getClientRects() reports axis-aligned boxes in SCREEN space. Subtract
   the page's own screen box from those and the numbers are right at 0 degrees
   and wrong at every other angle: at 90 the marks land beside the page, at 180
   they land upside down at the other end of it.

   So each rect is mapped back through the inverse of the rotation about the
   page's centre. Exact for the four right angles the page tray offers, which
   are the only ones there are. */
export function toLocal(rect, pageEl, rot) {
  const box = pageEl.getBoundingClientRect();
  const turn = ((rot % 360) + 360) % 360;
  if (!turn) {
    return { left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height };
  }
  const lw = pageEl.offsetWidth, lh = pageEl.offsetHeight;
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  const mx = rect.left + rect.width / 2 - cx;
  const my = rect.top + rect.height / 2 - cy;
  let dx, dy;
  if (turn === 90) { dx = my; dy = -mx; }
  else if (turn === 180) { dx = -mx; dy = -my; }
  else { dx = -my; dy = mx; }                          // 270
  const swap = turn % 180 === 90;
  const w = swap ? rect.height : rect.width;
  const h = swap ? rect.width : rect.height;
  return { left: lw / 2 + dx - w / 2, top: lh / 2 + dy - h / 2, width: w, height: h };
}
