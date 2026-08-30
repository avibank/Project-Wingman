// The route line's geometry, extracted from the component so it can be
// measured without mounting anything.
//
// It lived inside Instruments.jsx, where the only way to find out what it does
// at forty chapters and a narrow card was to render it and look. A shape that
// can only be checked by eye is a shape nobody checks.

export const H = 92;
export const GROUND = 70, CRUISE = 26;
export const CLIMB_TO = 0.16, DESCEND_FROM = 0.82;
export const PAD = 8;
export const DOT_R = 5;

export function pathFor(W) {
  return `M ${PAD} ${GROUND} C ${W * 0.06} ${GROUND} ${W * 0.10} ${CRUISE} ${W * CLIMB_TO} ${CRUISE}`
    + ` L ${W * DESCEND_FROM} ${CRUISE}`
    + ` C ${W * 0.90} ${CRUISE} ${W * 0.95} ${GROUND} ${W - PAD} ${GROUND}`;
}

export function pointAt(i, n, W) {
  const f = n === 1 ? 0.5 : i / (n - 1);
  const x = PAD + f * (W - PAD * 2);
  const y = f < CLIMB_TO ? GROUND - (GROUND - CRUISE) * (f / CLIMB_TO)
    : f > DESCEND_FROM ? CRUISE + (GROUND - CRUISE) * ((f - DESCEND_FROM) / (1 - DESCEND_FROM))
      : CRUISE;
  return { x, y };
}

/* THE SPACING RULE, and the reason this file exists.

   A module is allowed to grow. At four chapters the waypoints are 170px apart
   and the route reads as a route; at forty on a narrow card they are 4px apart
   and ten-pixel dots merge into a dotted rule that means nothing — worse, it
   still LOOKS deliberate, so nobody reports it.

   Below the threshold the dots are dropped and the line carries the route on
   its own, with only the current position marked. Nothing is lost: past a
   certain count the individual waypoints were never readable, and the one dot
   that matters is the one you are on. */
// The dot is DOT_R*2 across PLUS its 2px stroke, so the ink is 12px wide, not
// 10. Rendered at 42 chapters the first attempt at this number allowed a 15.8px
// gap — under 4px of air — and the waypoints read as a bead chain rather than
// as separate places. 8px of air is the point where they read as counted.
export const DOT_INK = DOT_R * 2 + 2;
export const MIN_GAP = DOT_INK + 8;

export function gapFor(n, W) {
  if (n <= 1) return Infinity;
  return (W - PAD * 2) / (n - 1);
}
export const showDots = (n, W) => gapFor(n, W) >= MIN_GAP;

/* The label is clamped so it can never overflow either end. The bound is HALF
   THE LABEL'S OWN WIDTH, computed from the string — a fixed 96 was the half of
   a guess, and at "CHAPTER 42 · YOU ARE HERE" the real half is 127, so the text
   hung 30px off the left edge of the card and over the module title.
   The face is monospace, which is the one case where width can be calculated
   instead of measured: every glyph is the same advance. */
export const LABEL_FS = 15;
export const LABEL_TRACKING = 0.08;        // matches .route-label in the CSS
export const MONO_ADVANCE = 0.6;           // Geist Mono, em per glyph

export function labelHalf(text, fontSize = LABEL_FS) {
  const per = fontSize * (MONO_ADVANCE + LABEL_TRACKING);
  return (String(text || "").length * per) / 2;
}

export function labelX(hereX, W, text = "CHAPTER 00 · YOU ARE HERE") {
  const half = labelHalf(text);
  // At a width too narrow to hold the label at all, centring beats clamping to
  // a bound wider than the box.
  if (W <= half * 2) return W / 2;
  return Math.max(half, Math.min(W - half, hereX));
}
