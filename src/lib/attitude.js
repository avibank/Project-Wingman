// The rim of the attitude indicator: the running average of the current
// module's quiz record. The ball is the other half and lives in useAttitude.js
// — the two are independent and run on different clocks.

export function moduleAverage(results = []) {
  const scores = results.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!scores.length) return { flown: 0, average: null };
  return { flown: scores.length, average: Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) };
}

// Turbulence words for the caption, by average.
export const chop = (pct) =>
  pct >= 90 ? "Smooth air" : pct >= 75 ? "Light chop" : pct >= 50 ? "Moderate chop" : "Rough air";
