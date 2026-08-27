import { useEffect, useRef, useState } from "react";

// The ball. Live, always, on every page it appears on — it is never driven by
// the quiz record and never waits for data. The rim is the half that carries
// the score, and the two run on different clocks.
//
// Desktop follows the pointer anywhere in the viewport. Phone follows device
// orientation, falling back to pointer where that is unavailable or refused.

export const BANK_RANGE = 22;
export const PITCH_RANGE = 18;
// A precision instrument reports an attitude; it does not ease toward one. At
// .14 the ball took sixteen frames to close, at .34 six, and both still read as
// something following you. At .55 it is there in three — about 50ms, which is
// under the threshold where a delay is felt at all — with just enough smoothing
// left to absorb pointer jitter and an unsteady hand.
const EASE = 0.55;

// Below this the ball is already where it is going. Without it the lerp
// asymptotes forever and writes a new transform every frame for movement no
// one can see — the instrument is never actually at rest.
const SETTLED = 0.01;

const clamp = (v, r) => Math.min(r, Math.max(-r, v));

// Full deflection near the edges rather than in the corner: the pointer runs
// -1..1 across the viewport and the range is applied straight to it.
export const bankFromPointer = (x, vw) => clamp(-((x / vw) - 0.5) * 2 * BANK_RANGE, BANK_RANGE);
export const pitchFromPointer = (y, vh) => clamp(((y / vh) - 0.5) * 2 * PITCH_RANGE, PITCH_RANGE);
// Tilt is relative, not absolute. The old version assumed a 45-degree holding
// angle and read beta against it, which is only true in portrait and only if
// you happen to hold it that way — in landscape beta and gamma swap roles
// entirely and the ball sat pinned at full deflection.
//
// Instead the first sample after the instrument starts, or after the device is
// rotated, becomes level. Everything after is deviation from it. That is
// correct in any orientation and at any holding angle, and needs nothing
// hardcoded.
export const bankFromTilt = (gamma, ref = 0) => clamp((gamma ?? 0) - ref, BANK_RANGE);
export const pitchFromTilt = (beta, ref = 0) => clamp((beta ?? 0) - ref, PITCH_RANGE);

// iOS gates orientation behind a user gesture. Called from the first tap
// anywhere; harmless everywhere else.
//
// The grant has to be announced. A deviceorientation listener registered before
// permission was granted does not start receiving events on iOS when it is —
// the hook has to attach again afterwards. Nothing told it to, so on an iPhone
// the ball only ever followed the pointer, which on a phone means it followed
// scrolling.
let granted = typeof window !== "undefined"
  && typeof window.DeviceOrientationEvent !== "undefined"
  && typeof window.DeviceOrientationEvent.requestPermission !== "function";
const watchers = new Set();
export const onOrientationGrant = (fn) => { watchers.add(fn); return () => watchers.delete(fn); };
export const orientationGranted = () => granted;

/**
 * Whether iOS still needs to be asked, and the asking.
 * `needed` is false everywhere that does not gate orientation behind a prompt.
 */
export function useTiltPermission() {
  const [needed, setNeeded] = useState(
    () => typeof window !== "undefined"
      && typeof window.DeviceOrientationEvent?.requestPermission === "function"
      && !granted,
  );
  useEffect(() => onOrientationGrant(() => setNeeded(false)), []);
  return { needed, ask: askForOrientation };
}

export function askForOrientation() {
  const D = typeof window !== "undefined" ? window.DeviceOrientationEvent : null;
  if (!D || typeof D.requestPermission !== "function") return Promise.resolve(granted);
  return D.requestPermission().then((r) => {
    if (r === "granted") { granted = true; watchers.forEach((fn) => fn()); }
    return granted;
  }).catch(() => false);
}

/**
 * Writes the ball's transform straight onto the node, sixty times a second.
 *
 * Deliberately NOT React state. A lerp in state re-renders the whole deck every
 * frame — and the deck runs SVG layout effects that measure and repaint the
 * flight profiles, so at 60fps it locks the page up. The ball is an animation,
 * not application state, and nothing else needs to know where it is pointing.
 *
 * @returns a ref to put on the group inside the dial's clip path
 */
export function useAttitude(still, dial) {
  const node = useRef(null);
  // The lit dial is a 120 viewBox centred on 60,60. The Manual finish draws the
  // same instrument at 86, centred on 40,44 — same attitude, different paper.
  const cx = dial?.cx ?? 60, cy = dial?.cy ?? 60, travel = dial?.travel ?? 1.1;

  // Smooth Air is the person asking; this is the device asking. CSS gets the
  // second one through a media query, but a rAF loop is not CSS: without this
  // the ball kept easing sixty times a second for someone who had asked the
  // whole system to stop moving.
  const [systemStill, setSystemStill] = useState(
    () => typeof window !== "undefined"
      && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const onChange = () => setSystemStill(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Re-runs the effect below when iOS grants orientation, so the listener is
  // attached after the grant rather than before it.
  const [tiltAllowed, setTiltAllowed] = useState(orientationGranted);
  useEffect(() => onOrientationGrant(() => setTiltAllowed(true)), []);

  useEffect(() => {
    const el = node.current;
    if (!el) return undefined;
    if (still || systemStill) {
      el.setAttribute("transform", `rotate(0 ${cx} ${cy}) translate(0 0)`);
      return undefined;
    }

    const target = { bank: 0, pitch: 0 };
    const current = { bank: 0, pitch: 0 };

    // Level is wherever the device is when the first sample arrives, and again
    // after a rotation. Nulled rather than zeroed so the next sample re-takes it.
    let ref = null;
    let tilting = false;

    // A coarse pointer is a finger. Fingers scroll; they do not aim. The ball
    // follows attitude on a touch device and nothing else, so it stays still
    // under a scroll instead of chasing the thumb.
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;

    const onPointer = (e) => {
      // Once the device is reporting attitude the pointer stops being an input.
      if (tilting || coarse) return;
      target.bank = bankFromPointer(e.clientX, window.innerWidth);
      target.pitch = pitchFromPointer(e.clientY, window.innerHeight);
    };
    const onTilt = (e) => {
      if (e.gamma == null && e.beta == null) return;
      tilting = true;
      if (!ref) ref = { gamma: e.gamma ?? 0, beta: e.beta ?? 0 };
      target.bank = bankFromTilt(e.gamma, ref.gamma);
      target.pitch = pitchFromTilt(e.beta, ref.beta);
    };
    // beta and gamma swap meaning between portrait and landscape, so the old
    // level is meaningless after a rotation. Take it again.
    const onRotate = () => { ref = null; };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("orientationchange", onRotate);
    window.screen?.orientation?.addEventListener?.("change", onRotate);

    let frame = 0;
    let lastWrite = "";
    const tick = () => {
      const db = target.bank - current.bank, dp = target.pitch - current.pitch;
      // Snap the last hundredth rather than approach it forever.
      current.bank = Math.abs(db) < SETTLED ? target.bank : current.bank + db * EASE;
      current.pitch = Math.abs(dp) < SETTLED ? target.pitch : current.pitch + dp * EASE;
      // 1 degree of pitch is about 1.1px of travel on a 42px dial.
      const next = `rotate(${current.bank.toFixed(2)} ${cx} ${cy}) translate(0 ${(current.pitch * travel).toFixed(2)})`;
      // Only touch the DOM when the value actually changed. At rest — which is
      // most of the time on a desktop — this costs nothing.
      if (next !== lastWrite) { el.setAttribute("transform", next); lastWrite = next; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("orientationchange", onRotate);
      window.screen?.orientation?.removeEventListener?.("change", onRotate);
      cancelAnimationFrame(frame);
    };
  }, [still, systemStill, tiltAllowed, cx, cy, travel]);

  return node;
}
