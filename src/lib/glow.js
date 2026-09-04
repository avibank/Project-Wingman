// The study glow — §7.6.
//
// The chapter body's one social element, and it is not an element: it is the
// lighting. No counter, no faces, no notification. The room is simply warmer.
//
// IT USED TO BE WARM IN A COLOUR YOU RECOGNISED. The hue was the circular mean
// of the liveries of whoever was on the chapter, falling back to your own. That
// livery system is gone — it was the old build's, every tail token had already
// been collapsed to --active, and in practice nobody had ever moved off the
// default, so the mean was 55° on every render this app has ever done. What is
// left is the part that carried the meaning: presence changes the brightness,
// not the hue.

// Presence warmth. One number, because a person no longer carries a colour.
export const GLOW_HUE = 55;

// alpha = clamp(0.03 + 0.022n, 0.03, 0.12)
export function glowAlpha(n) {
  return Math.min(0.12, Math.max(0.03, 0.03 + 0.022 * n));
}

// `others` excludes invisible users before it reaches here (§8.3): they do not
// warm the room and are not counted.
export function computeGlow({ others = [] } = {}) {
  return { n: others.length, alpha: glowAlpha(others.length) };
}
