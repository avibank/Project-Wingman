// The attitude indicator, driven by the quiz record for the current module.
//
// Pitch is the running average: 50% sits level, above pitches up, below
// pitches down. Bank comes from the last three results — improving banks left,
// sliding banks right, flat stays wings-level. Both are capped so the
// instrument never reads as an upset.
//
// Pure, so the geometry can be checked without a DOM.

export const MAX_PITCH = 25;
export const MAX_BANK = 20;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param results scores for the current module, oldest first, 0-100
 * @returns { flown, average, pitch, bank } — pitch/bank in degrees
 */
export function attitude(results = []) {
  const scores = results.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!scores.length) return { flown: 0, average: null, pitch: 0, bank: 0 };

  const average = scores.reduce((a, b) => a + b, 0) / scores.length;

  // 50% is level; the full swing to 0 or 100 reaches the cap.
  const pitch = clamp(((average - 50) / 50) * MAX_PITCH, -MAX_PITCH, MAX_PITCH);

  // The last three: improving banks left, which is negative in SVG rotation.
  const last = scores.slice(-3);
  let bank = 0;
  if (last.length >= 2) {
    const trend = last[last.length - 1] - last[0];
    bank = clamp((-trend / 50) * MAX_BANK, -MAX_BANK, MAX_BANK);
  }

  return { flown: scores.length, average: Math.round(average), pitch, bank };
}

// Turbulence words for the caption, by average.
export const chop = (pct) =>
  pct >= 90 ? "Smooth air" : pct >= 75 ? "Light chop" : pct >= 50 ? "Moderate chop" : "Rough air";
