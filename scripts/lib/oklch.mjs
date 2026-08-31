/* OKLCH -> linear sRGB, and contrast measured on it.
 *
 * Extracted from check-contrast.mjs so the surface check can use exactly the
 * same arithmetic. Two copies of a colour-space conversion is two answers to
 * the same question, and the one that disagrees is always the one nobody is
 * looking at.
 *
 * The important half is `over`: a translucent colour must be composited onto
 * what is ACTUALLY behind it before it is measured. Skipping that is what once
 * made every livery in Day measure the same number.
 */

const M = [[4.0767416621, -3.3077115913, 0.2309699292],
           [-1.2684380046, 2.6097574011, -0.3413193965],
           [-0.0041960863, -0.7034186147, 1.7076147010]];

export function lin(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const v = [(L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
             (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
             (L - 0.0894841775 * a - 1.2914855480 * b) ** 3];
  return M.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));
}

export const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/* oklch(L C H) or oklch(L C H / A), however the engines happen to emit it.
   Returns null for anything else — a caller must decide what that means
   rather than being handed a fabricated colour. */
export function parse(v) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
  if (!m) return null;
  return { L: +m[1], C: +m[2], H: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

/* Composite fg over bg in linear light, honouring fg's alpha. */
export const over = (fg, bg) => {
  const f = lin(fg.L, fg.C, fg.H), b = lin(bg.L, bg.C, bg.H);
  return f.map((v, i) => b[i] + (v - b[i]) * fg.a);
};

/* The luminance of a surface that may itself be translucent, composited onto
   the page ground. */
export const surfaceY = (surface, ground) =>
  (surface.a < 1 ? Y(over(surface, ground)) : Y(lin(surface.L, surface.C, surface.H)));

/* Text on a surface, both possibly translucent, over the ground. */
export function contrastOn(textVar, surfaceVar, groundVar) {
  const t = parse(textVar), s = parse(surfaceVar), g = parse(groundVar);
  if (!t || !s || !g) return null;
  const bgY = surfaceY(s, g);
  // The text is composited onto the OPAQUE surface — a panel at 0.8 alpha is
  // still what the glyph sits on once it has been painted.
  const solidSurface = s.a < 1 ? { ...s, a: 1 } : s;
  const fgY = Y(over(t, solidSurface));
  return ratio(fgY, bgY);
}
