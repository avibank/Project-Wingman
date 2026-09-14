/* =============================================================================
   The ball's arithmetic — tilt, pointer and settling — with no React, no DOM
   and no device, so check:gyro can drive it with numbers.
   -----------------------------------------------------------------------------
   THE PHONE READS GRAVITY, NOT ITS ANGLES. beta and gamma are Euler angles,
   and Euler angles lock: hold a phone upright and rolling it moves alpha and
   gamma together, and in landscape beta and gamma trade places. Read straight
   off gamma, the old bank was only right for a phone held nearly flat in
   portrait. So the two angles become the one thing they describe without
   ambiguity — which way down is, in the phone's own frame — that vector is
   turned into the screen's frame by the angle the screen has been rotated to,
   and bank is the direction of down in the plane of the glass.

   A HELD ANGLE BECOMES LEVEL. Nobody holds a phone at zero, so level is a
   baseline that closes on the reading over a few seconds: a quick movement
   shows, a steady hand reads level. Rotating the screen takes level again at
   once, in useAttitude.
   ========================================================================= */

export const BANK_RANGE = 22;
export const PITCH_RANGE = 18;

// Below this much of gravity in the plane of the glass the phone is lying too
// flat to have a bank, and atan2 would turn sensor noise into a spin.
export const FLAT = 0.12;
// How long the baseline takes to close on a held reading, 95% of the way.
export const LEVEL_MS = 3500;
// Degrees. A change smaller than this is a hand, not a movement.
export const DEADBAND = 0.5;
// A pointer that has not moved for this long hands the ball back to level.
export const IDLE_MS = 2200;

// A precision instrument reports an attitude; it does not ease toward one. At
// .14 the ball took sixteen frames to close, at .34 six, and both still read as
// something following you. At .55 it is there in three — about 50ms, which is
// under the threshold where a delay is felt at all — with just enough smoothing
// left to absorb pointer jitter and an unsteady hand.
export const EASE = 0.55;
// Below this the ball is already where it is going. Without it the lerp
// asymptotes forever and writes a new transform every frame for movement no
// one can see.
export const SETTLED = 0.01;

const RAD = Math.PI / 180;
const clamp = (v, r) => Math.min(r, Math.max(-r, v));

// Into (-180, 180], so a bank that passes upside down does not unwind the long
// way round.
export const wrap180 = (deg) => {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
};

// Which way down is, in the device's own frame, from the W3C angles (an
// intrinsic Z-X'-Y'' rotation). Flat on a table, face up, it is (0, 0, -1).
export function gravity(beta, gamma) {
  const b = (beta ?? 0) * RAD, g = (gamma ?? 0) * RAD;
  return { x: Math.cos(b) * Math.sin(g), y: -Math.sin(b), z: -Math.cos(b) * Math.cos(g) };
}

// The same vector in the screen's frame. `angle` is screen.orientation.angle:
// how far the screen has been turned counter-clockwise from the device's own
// upright.
export function inScreen(v, angle = 0) {
  const a = angle * RAD, c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

// One sample, as the glass sees it. Bank is positive with the phone rolled
// clockwise; pitch is positive with the top tipped away, towards lying face up.
// `held` is the bank to keep while the phone is too flat to have one.
export function readTilt(beta, gamma, angle = 0, held = 0) {
  const d = inScreen(gravity(beta, gamma), angle);
  const inPlane = Math.hypot(d.x, d.y);
  const flat = inPlane < FLAT;
  return {
    bank: flat ? held : Math.atan2(d.x, -d.y) / RAD,
    pitch: Math.atan2(-d.z, inPlane) / RAD,
    flat,
  };
}

// The baseline closing on the reading. Exponential in elapsed time rather than
// per sample, so a phone reporting at 30Hz and one at 120Hz settle alike.
export function settle(base, reading, dtMs, { wraps = false, levelMs = LEVEL_MS } = {}) {
  const k = 1 - Math.exp((-3 * Math.max(0, dtMs)) / levelMs);
  const gap = wraps ? wrap180(reading - base) : reading - base;
  const next = base + gap * k;
  return wraps ? wrap180(next) : next;
}

export const deadband = (current, next, band = DEADBAND) =>
  (Math.abs(next - current) < band ? current : next);

// What the instrument draws. The horizon turns against the phone — roll right
// and the horizon rolls left — and rises as the top tips away.
export const bankFromTilt = (bank, base) => clamp(-wrap180(bank - base), BANK_RANGE);
export const pitchFromTilt = (pitch, base) => clamp(-(pitch - base), PITCH_RANGE);

// Desktop. Measured from the instrument's own centre rather than the window's,
// with full deflection half a viewport away, so the ball answers the cursor
// wherever the deck has scrolled the instrument to. Signs are the old ones:
// cursor right banks the horizon left, cursor below lowers it.
export function fromPointer(x, y, cx, cy, vw, vh) {
  return {
    bank: clamp((-(x - cx) / Math.max(1, vw / 2)) * BANK_RANGE, BANK_RANGE),
    pitch: clamp(((y - cy) / Math.max(1, vh / 2)) * PITCH_RANGE, PITCH_RANGE),
  };
}

// Snap the last hundredth rather than approach it forever.
export const ease = (current, target) =>
  (Math.abs(target - current) < SETTLED ? target : current + (target - current) * EASE);

// 1 degree of pitch is about 1.1px of travel on the lit dial.
export const ballTransform = (bank, pitch, cx, cy, travel) =>
  `rotate(${bank.toFixed(2)} ${cx} ${cy}) translate(0 ${(pitch * travel).toFixed(2)})`;
