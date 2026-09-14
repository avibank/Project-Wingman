import { useEffect, useRef, useState } from "react";
import {
  IDLE_MS, readTilt, settle, deadband, bankFromTilt, pitchFromTilt,
  fromPointer, ease, ballTransform,
} from "./tilt.js";

// The ball. Live on every page it appears on and never driven by the quiz
// record — the rim is the half that carries the score, and the two run on
// different clocks. The arithmetic is in tilt.js, where check:gyro can reach
// it; this file is the plumbing.
//
// Desktop follows the pointer, measured from the instrument. A phone follows
// gravity. Before the first quiz the deck passes still, and the ball parks.

// iOS gates orientation behind a user gesture. It is asked from the Tilt control
// in settings, beside the bar — never on load and never from the instrument.
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
/* WHETHER TO OFFER THE TAP AT ALL.
 *
 * requestPermission exists only on iOS, which is the whole reason this prompt
 * exists: iOS will not report attitude until it has been asked, and it will
 * only ask from a real tap. Every other platform either reports attitude
 * freely or has no sensor, and on both the button is noise.
 *
 * AND IT HAS TO HONOUR STILLNESS, which it did not. useAttitude already stops
 * the ball for prefers-reduced-motion and for Smooth Air, but this hook knew
 * about neither — so on an iPhone with motion switched off the app still
 * offered the tilt prompt, asking permission to start something the app has
 * already agreed not to do. Tapping it would have granted a permission and
 * changed nothing on screen, which is the worst kind of control.
 *
 * `still` is the in-app switch, passed in because only the caller knows it.
 * The system one is read here, so the answer cannot be stale when somebody
 * turns reduce-motion on with the deck already open.
 */
export function useTiltPermission(still = false) {
  /* THE API IS NOT THE TEST, and assuming it was is why this prompt kept
     appearing on desktop. DeviceOrientationEvent.requestPermission was Safari's
     alone when this was written; Chrome 152 on macOS implements it too, and
     measured in a real desktop Chrome it returns "function". So the check that
     was supposed to mean "iOS" meant "a browser that has caught up", and the
     button rendered next to a mouse cursor on a machine with no sensor at all.

     What the prompt is actually for is a device that HAS an orientation sensor
     and gates it behind a tap. maxTouchPoints is the signal that survives:
     0 on every desktop, 5 on an iPhone or iPad. It is a property of the
     hardware rather than of the vendor, so it does not go stale the next time
     a browser ships the API.

     Not (pointer: coarse) — an iPad with a trackpad attached reports a fine
     pointer and would lose the prompt it still needs. */
  const canBeTilted = typeof window !== "undefined"
    && typeof window.DeviceOrientationEvent?.requestPermission === "function"
    && (navigator.maxTouchPoints || 0) > 0;

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

  const [asked, setAsked] = useState(() => granted);
  useEffect(() => onOrientationGrant(() => setAsked(true)), []);

  return { needed: canBeTilted && !asked && !still && !systemStill, ask: askForOrientation };
}

export function askForOrientation() {
  const D = typeof window !== "undefined" ? window.DeviceOrientationEvent : null;
  if (!D || typeof D.requestPermission !== "function") return Promise.resolve(granted);
  return D.requestPermission().then((r) => {
    if (r === "granted") { granted = true; watchers.forEach((fn) => fn()); }
    return granted;
  }).catch(() => false);
}

// How far the screen is turned from the device's own upright, counter-clockwise,
// in degrees. window.orientation is older iOS's spelling of the same number,
// with -90 where the newer API says 270.
function screenAngle() {
  const a = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  return Number.isFinite(a) ? ((a % 360) + 360) % 360 : 0;
}

/**
 * Writes the ball's transform straight onto the node.
 *
 * Deliberately NOT React state. A lerp in state re-renders the whole deck every
 * frame — and the deck runs SVG layout effects that measure and repaint the
 * flight profiles, so at 60fps it locks the page up. The ball is an animation,
 * not application state, and nothing else needs to know where it is pointing.
 *
 * ONE LOOP, AND IT SLEEPS. It runs while the ball is travelling and stops when
 * it arrives; the next input wakes it. An IntersectionObserver stops it while
 * the instrument is scrolled out of view, and the two stillness switches keep
 * it from starting at all.
 *
 * @returns a ref to put on the group inside the dial's clip path
 */
export function useAttitude(still, dial) {
  const node = useRef(null);
  // The lit dial is a 120 viewBox centred on 60,60. The Manual finish draws the
  // same instrument at 86, centred on 40,44 — same attitude, different paper.
  const cx = dial?.cx ?? 60, cy = dial?.cy ?? 60, travel = dial?.travel ?? 1.1;

  // Smooth Air is the person asking; this is the device asking. CSS gets the
  // second one through a media query, but a rAF loop is not CSS.
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
      el.setAttribute("transform", ballTransform(0, 0, cx, cy, travel));
      return undefined;
    }

    const svg = el.ownerSVGElement || el;
    const target = { bank: 0, pitch: 0 };
    const current = { bank: 0, pitch: 0 };

    // A coarse pointer is a finger. Fingers scroll; they do not aim. Until iOS
    // has been asked, a phone therefore holds the ball level.
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;

    let tilting = false;   // once the device reports attitude, the pointer stops being an input
    let base = null;       // level: where held readings settle, and when it last moved
    let held = 0;          // the last bank the glass could give, kept while it lies flat
    let pointer = null;    // the newest pointer position, not yet read
    let idle = 0;
    let frame = 0;
    let shown = true;      // on screen, as far as the observer has said
    let written = el.getAttribute("transform") || "";

    const tick = () => {
      frame = 0;
      if (pointer) {
        // At most one layout read a frame, taken before this frame writes.
        const r = svg.getBoundingClientRect();
        const t = fromPointer(pointer.x, pointer.y, r.left + r.width / 2, r.top + r.height / 2,
          window.innerWidth, window.innerHeight);
        target.bank = t.bank;
        target.pitch = t.pitch;
        pointer = null;
      }
      current.bank = ease(current.bank, target.bank);
      current.pitch = ease(current.pitch, target.pitch);
      const next = ballTransform(current.bank, current.pitch, cx, cy, travel);
      // Only touch the DOM when the value actually changed.
      if (next !== written) { el.setAttribute("transform", next); written = next; }
      // Arrived: nothing is scheduled until an input moves the target again.
      if (shown && (current.bank !== target.bank || current.pitch !== target.pitch)) {
        frame = requestAnimationFrame(tick);
      }
    };
    const wake = () => { if (!frame && shown) frame = requestAnimationFrame(tick); };

    const onPointer = (e) => {
      if (tilting || coarse) return;
      pointer = { x: e.clientX, y: e.clientY };
      clearTimeout(idle);
      idle = setTimeout(() => { target.bank = 0; target.pitch = 0; wake(); }, IDLE_MS);
      wake();
    };

    const onTilt = (e) => {
      if (e.beta == null && e.gamma == null) return;
      tilting = true;
      clearTimeout(idle);
      const now = performance.now();
      const r = readTilt(e.beta, e.gamma, screenAngle(), held);
      held = r.bank;
      if (!base) {
        base = { bank: r.bank, pitch: r.pitch, at: now };
      } else {
        const dt = now - base.at;
        base = {
          bank: settle(base.bank, r.bank, dt, { wraps: true }),
          pitch: settle(base.pitch, r.pitch, dt),
          at: now,
        };
      }
      target.bank = deadband(target.bank, bankFromTilt(r.bank, base.bank));
      target.pitch = deadband(target.pitch, pitchFromTilt(r.pitch, base.pitch));
      wake();
    };

    // A rotated screen is a different frame entirely, so level is taken again
    // from the next sample rather than settled toward.
    const onRotate = () => { base = null; };

    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
        shown = entries[entries.length - 1].isIntersecting;
        if (!shown && frame) { cancelAnimationFrame(frame); frame = 0; }
        if (shown) wake();
      })
      : null;
    io?.observe(svg);

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("orientationchange", onRotate);
    window.screen?.orientation?.addEventListener?.("change", onRotate);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("orientationchange", onRotate);
      window.screen?.orientation?.removeEventListener?.("change", onRotate);
      io?.disconnect();
      clearTimeout(idle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [still, systemStill, tiltAllowed, cx, cy, travel]);

  return node;
}
