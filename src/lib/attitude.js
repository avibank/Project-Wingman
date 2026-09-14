// The rim of the attitude indicator: the running average of the current
// module's quiz record, read against the student's bar. The ball is the other
// half and lives in useAttitude.js — the two are independent and run on
// different clocks.

export function moduleAverage(results = []) {
  const scores = results.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!scores.length) return { flown: 0, average: null };
  return { flown: scores.length, average: Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) };
}

// Turbulence words, by average. No longer the gyro's caption — the bar is — and
// kept for whatever reads the weather next.
export const chop = (pct) =>
  pct >= 90 ? "Smooth air" : pct >= 75 ? "Light chop" : pct >= 50 ? "Moderate chop" : "Rough air";

/* ------------------------------------------------------------ the reading */
/* THE GYRO READS YOUR BAR.

   The rim is the average, absolute: empty at 0, closed at 100, half at 50, and
   the same number as the centre. The notch is the bar, and it does not move
   with performance. The state is where one sits against the other, and "on"
   is a point either way, because a bar of 67 met by a 66 has been met.

   Geometry is the lit gyro's 120-unit viewBox, exactly as the brief gives it.
   The paper gyro draws the same marks at its own scale. */
export const RIM_R = 49;
export const RIM_W = 3;
export const RIM_C = 2 * Math.PI * RIM_R;          // 307.876
export const DEG_PER_POINT = 3.6;
export const NOTCH_IN = 45.6;
export const NOTCH_OUT = 54.4;
export const NOTCH_W = 1.7;
export const LAST_R = 2.6;
export const ON_BAR = 1;

const onScale = (n) => Math.max(0, Math.min(100, n));
const none = (v) => v === null || v === undefined;

export function gyroState(average, bar) {
  if (none(average)) return "nodata";
  const d = average - bar;
  if (Math.abs(d) <= ON_BAR) return "on";
  return d < 0 ? "under" : "over";
}

// Dash length from the top, clockwise.
export const rimLength = (average) => (none(average) ? 0 : (onScale(average) / 100) * RIM_C);

export const notchAngle = (bar) => onScale(bar) * DEG_PER_POINT;

// The stretch of rim past the notch, drawn over the rim one step brighter.
export function surplusArc(average, bar) {
  if (gyroState(average, bar) !== "over") return null;
  const start = (onScale(bar) / 100) * RIM_C;
  return { offset: -start, length: rimLength(average) - start };
}

// The caption in parts, so the state phrase can carry the state colour while
// the percentage stays quiet. gyroCaption is the same words as one string.
export function gyroWords(average, bar) {
  const state = gyroState(average, bar);
  if (state === "nodata") return { state, pct: null, joiner: "", phrase: "First quiz fills the ring" };
  const pct = `${average}%`;
  if (state === "on") return { state, pct, joiner: " ", phrase: "on your bar" };
  return { state, pct, joiner: " · ", phrase: `${Math.abs(average - bar)} ${state} your bar` };
}

export const gyroCaption = (average, bar) => {
  const w = gyroWords(average, bar);
  return w.pct ? `${w.pct}${w.joiner}${w.phrase}` : w.phrase;
};

export function gyroLabel(average, flown, bar) {
  const state = gyroState(average, bar);
  if (state === "nodata") return "Attitude indicator, no quiz flown yet";
  const quizzes = `${flown} ${flown === 1 ? "quiz" : "quizzes"}`;
  const where = state === "on" ? "on your bar" : `${Math.abs(average - bar)} ${state} your bar`;
  return `Attitude indicator, ${average} per cent average across ${quizzes}, ${where} of ${bar}`;
}
