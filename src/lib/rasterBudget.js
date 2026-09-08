/* =============================================================================
   HOW MANY PAGES MAY BE HELD AS PIXELS AT ONCE.

   A rendered page is a bitmap the size of the page times the device pixel
   ratio. At fit-width on a laptop that is roughly 1.5MB a page; at 300% on a
   retina tablet it is twenty times that. Thirty of them is a tab that dies, and
   on iPad Safari it dies quietly — the allocation fails and the canvas comes
   back BLANK rather than throwing, which is indistinguishable from the renderer
   giving up.

   So the number of live rasters is capped and the furthest from the reader is
   evicted first. This is a register, not an allocator: pages report what they
   are holding and are told when to let go, because only the page itself can
   free its own canvas.
   ========================================================================= */

export const MAX_RASTERS = 10;
/* No canvas above this on a side, whatever the zoom. Beyond it the tile path
   is the answer, not a bigger bitmap. */
export const MAX_RASTER_PX = 4000;

let seq = 0;
const held = new Map();          // claim id -> { page, at }
const evictors = new Map();      // claim id -> () => void

export function claimRaster(page, previous = null) {
  if (previous != null) releaseRaster(previous);
  const id = ++seq;
  held.set(id, { page, at: Date.now() });
  evict();
  return id;
}

export function releaseRaster(id) {
  if (id == null) return;
  held.delete(id);
  evictors.delete(id);
}

/* The page furthest from where the reader is looking loses its pixels first —
   not the oldest, which on a scroll back up would evict the page just above the
   viewport. Distance is set by the reader on every page change. */
let focus = 1;
export const setRasterFocus = (page) => { focus = page || 1; };

export function onEvict(id, fn) { if (id != null) evictors.set(id, fn); }

function evict() {
  if (held.size <= MAX_RASTERS) return;
  const byDistance = [...held.entries()]
    .sort((a, b) => Math.abs(b[1].page - focus) - Math.abs(a[1].page - focus));
  for (const [id] of byDistance.slice(0, held.size - MAX_RASTERS)) {
    evictors.get(id)?.();
    releaseRaster(id);
  }
}

export const rasterCount = () => held.size;
