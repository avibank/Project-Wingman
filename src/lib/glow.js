// The study glow — §7.6.
//
// The chapter body's one social element, and it is not an element: it is the
// lighting. No counter, no faces, no notification. The room is simply warmer,
// and warm in a colour you recognise.

export const LIVERY_HUE = {
  aurora: 350,
  "sunset-approach": 20,
  "carrier-deck": 40,
  "dawn-patrol": 55,
  contrail: 70,
  "night-ops": 88,
};

// Circular mean, not arithmetic. Hues near 350 and 20 must blend to ~5, not
// ~185 — an arithmetic mean would send two warm neighbours to the cold arc,
// which would break the "warm means people" law outright.
export function circularMean(hues) {
  if (!hues.length) return null;
  let x = 0, y = 0;
  for (const h of hues) {
    const r = (h * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return hues[0];
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// alpha = clamp(0.03 + 0.022n, 0.03, 0.12)
export function glowAlpha(n) {
  return Math.min(0.12, Math.max(0.03, 0.03 + 0.022 * n));
}

// `others` excludes invisible users before it reaches here (§8.3): they do not
// warm the room and are not counted.
export function computeGlow({ others = [], ownLivery = "dawn-patrol" }) {
  const recent = others.slice(0, 4);                      // cap at the 4 most recent
  const hues = recent.map((o) => LIVERY_HUE[o.livery] ?? LIVERY_HUE["dawn-patrol"]);
  const n = others.length;
  return {
    n,
    hue: n === 0 ? LIVERY_HUE[ownLivery] ?? 55 : circularMean(hues),
    alpha: glowAlpha(n),
  };
}
