/* =============================================================================
   INK — freehand strokes on a page, and the palette every mark is made in.

   Pure. No React, no network, no DOM. Everything here takes numbers and
   returns numbers, so the parts that are easy to get quietly wrong — how a
   stroke is thinned, how it is smoothed, what the eraser actually hits — can
   be checked rather than reviewed.

   -----------------------------------------------------------------------------
   WHY INK IS NOT AN ANNOTATION, AND WHY THAT IS NOT A LOOPHOLE

   R1 of the annotation brief says an anchor is text, never coordinates, and the
   database refuses any anchor carrying a page or a rect. A pen stroke is
   coordinates and nothing else: it is not a claim about a passage, it is a
   drawing on a page, and there is no sentence you could store instead that
   would let you draw it again.

   So ink is a different record in a different table. That keeps R1 exactly as
   strict as it was — no code path can smuggle a position into an anchor,
   because ink never touches one — while admitting the one thing the rule was
   never about. A stroke says where it is; a mark says what it is about.

   The cost is honest and stated: a stroke cannot survive the paper being
   re-flowed or re-extracted the way a mark can. When a paper's version bumps,
   its marks re-resolve and its strokes are stranded on a page that may have
   moved. That is the true nature of drawing on a page, and pretending
   otherwise would mean putting ink somewhere plausible, which R2 forbids for
   the same reason.

   -----------------------------------------------------------------------------
   COORDINATES ARE FRACTIONS OF THE PAGE, NEVER PIXELS

   A point is stored as [x, y] where each is 0..1 of the UNROTATED page box, and
   a width is stored as a fraction of the page width. So a stroke drawn at 80%
   zoom on a phone is the same stroke at 250% on a laptop, at any device pixel
   ratio, and rotation is applied when it is drawn rather than baked in.

   Pixels would have meant a stroke that is correct only at the zoom it was made
   at, which is the same class of bug as a positional anchor and just as silent.
   ========================================================================= */

/* -----------------------------------------------------------------------------
   THE PALETTE

   One set of colours for every mark a reader makes — highlighter, pen,
   underline, strikethrough. Two renderings of the same eight names rather than
   two palettes: a highlighter lays them down translucent, a pen lays them down
   solid, and "my blue" means the same thing in both.

   The names are stored, never the colours. A row says `blue`, and what blue
   looks like is decided in CSS, so the palette can be re-tinted for the night
   theme, for a livery, or for a screen we have not met yet without a migration
   and without every existing mark changing meaning.

   This is a THIRD colour category and it is deliberate. The house style has a
   module hue (wayfinding: where am I) and the presence amber (what is live,
   what is the action here). Ink is neither: it is what the reader put on the
   page themselves, and it must not move when the app re-tints, or somebody's
   yellow highlight would become somebody else's on a livery change.
   -------------------------------------------------------------------------- */
export const INK_COLOURS = [
  { id: "yellow",   label: "Yellow" },
  { id: "green",    label: "Green" },
  { id: "blue",     label: "Blue" },
  { id: "pink",     label: "Pink" },
  { id: "orange",   label: "Orange" },
  { id: "purple",   label: "Purple" },
  { id: "red",      label: "Red" },
  { id: "graphite", label: "Graphite" },
];
export const COLOUR_IDS = INK_COLOURS.map((c) => c.id);
export const DEFAULT_HIGHLIGHT = "yellow";
export const DEFAULT_PEN = "graphite";
export const isColour = (id) => COLOUR_IDS.includes(id);
/* Anything unrecognised reads as the default rather than as nothing: a row
   written by a newer build must still draw on an older one, and an undrawn
   highlight is indistinguishable from a lost one. */
export const colourOr = (id, fallback = DEFAULT_HIGHLIGHT) => (isColour(id) ? id : fallback);

/* Pen widths, as a fraction of the page width. 0.0016 is roughly a 1pt nib on
   an A4 page, which is what a fine liner puts down. Five steps and not a
   slider: a slider is a thing to fiddle with, and nobody has ever needed 2.7. */
export const PEN_SIZES = [
  { id: "xs", label: "Extra fine", w: 0.0011 },
  { id: "s",  label: "Fine",       w: 0.0019 },
  { id: "m",  label: "Medium",     w: 0.0032 },
  { id: "l",  label: "Broad",      w: 0.0055 },
  { id: "xl", label: "Marker",     w: 0.0105 },
];
export const DEFAULT_PEN_SIZE = "m";
export const penWidth = (id) => (PEN_SIZES.find((p) => p.id === id) || PEN_SIZES[2]).w;

/* -----------------------------------------------------------------------------
   CAPTURE — pixels in, fractions out
   -------------------------------------------------------------------------- */
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/* A pointer position inside a page box, as a fraction of the UNROTATED page.
   Rotation is undone here so that a stroke drawn on a sideways page is stored
   against the same coordinates as one drawn upright, and turning the page
   afterwards turns the ink with it. */
export function toFraction(px, py, box, rotation = 0) {
  const { width: w, height: h } = box;
  if (!w || !h) return null;
  const x = clamp01(px / w);
  const y = clamp01(py / h);
  switch (((rotation % 360) + 360) % 360) {
    case 90:  return [y, 1 - x];
    case 180: return [1 - x, 1 - y];
    case 270: return [1 - y, x];
    default:  return [x, y];
  }
}

/* And back, for drawing. The inverse of the above, in the page's current box. */
export function toPixels(pt, box, rotation = 0) {
  const [fx, fy] = pt;
  const { width: w, height: h } = box;
  switch (((rotation % 360) + 360) % 360) {
    case 90:  return [(1 - fy) * w, fx * h];
    case 180: return [(1 - fx) * w, (1 - fy) * h];
    case 270: return [fy * w, (1 - fx) * h];
    default:  return [fx * w, fy * h];
  }
}

/* -----------------------------------------------------------------------------
   THINNING — Ramer–Douglas–Peucker

   A stroke sampled at pointer rate is a few hundred points for a line somebody
   drew in a second, and every one of them is stored, sent, and re-parsed on
   every open. RDP drops the points that were never carrying any shape: with a
   tolerance well under a hairline the result is indistinguishable, and a
   typical stroke comes out a fifth of the size.

   Iterative rather than recursive on purpose — a long, fast stroke on a
   trackpad is thousands of points, and the recursive form is exactly the shape
   that blows a stack on the one input you cannot reproduce.
   -------------------------------------------------------------------------- */
export const THIN_TOLERANCE = 0.0008;

function segmentDistance(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function thin(points = [], tolerance = THIN_TOLERANCE) {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let at = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i], points[first], points[last]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/* -----------------------------------------------------------------------------
   SMOOTHING — a path, not a polyline

   Points joined with straight lines look like what they are: a recording of a
   pointer. A Catmull-Rom spline through the same points, written out as cubic
   beziers, looks like a pen. It passes through every point rather than near
   them, so the stroke still goes exactly where the hand went.

   Written in the page's own pixel box, because an SVG path in fractions would
   need a viewBox of 1x1 and a stroke-width in thousandths, which no renderer
   antialiases well.
   -------------------------------------------------------------------------- */
export function pathFor(points = [], box, rotation = 0) {
  const pts = points.map((p) => toPixels(p, box, rotation));
  if (!pts.length) return "";
  if (pts.length === 1) {
    // A tap is a dot. Drawn as a hairline to itself so stroke-linecap rounds it.
    const [x, y] = pts[0];
    return `M ${x.toFixed(2)} ${y.toFixed(2)} L ${(x + 0.01).toFixed(2)} ${y.toFixed(2)}`;
  }
  if (pts.length === 2) {
    return `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} L ${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)}`;
  }
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/* -----------------------------------------------------------------------------
   THE ERASER — whole strokes, never pieces

   Drawboard, Notes and Preview all offer both, and the one people reach for is
   the stroke eraser: touch a line, the line goes. Erasing pixels means a stroke
   has to be split into two strokes mid-record, which turns one undo into an
   unbounded number and makes "delete what I just drew" stop working.

   So the eraser asks which strokes it is touching and removes those. The hit is
   tested against the SEGMENTS, not the stored points, or a long straight line
   drawn with three points would only be erasable at its ends.
   -------------------------------------------------------------------------- */
export function strokeHit(stroke, at, radius) {
  const pts = stroke?.points || [];
  if (!pts.length) return false;
  const reach = radius + (stroke.width || 0) / 2;
  if (pts.length === 1) return Math.hypot(pts[0][0] - at[0], pts[0][1] - at[1]) <= reach;
  for (let i = 0; i < pts.length - 1; i++) {
    if (segmentDistance(at, pts[i], pts[i + 1]) <= reach) return true;
  }
  return false;
}

export function strokesUnder(strokes = [], at, radius, page) {
  return strokes.filter((s) => s.page === page && strokeHit(s, at, radius));
}

/* The box a stroke occupies, in fractions. Used to skip strokes that cannot
   possibly be on screen before any of the expensive work happens. */
export function strokeBounds(stroke) {
  const pts = stroke?.points || [];
  if (!pts.length) return null;
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const pad = (stroke.width || 0) / 2;
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}
