import { useEffect, useRef, useState } from "react";

// The ball. Live, always, on every page it appears on — it is never driven by
// the quiz record and never waits for data. The rim is the half that carries
// the score, and the two run on different clocks.
//
// Desktop follows the pointer anywhere in the viewport. Phone follows device
// orientation, falling back to pointer where that is unavailable or refused.

export const BANK_RANGE = 22;
export const PITCH_RANGE = 18;
// A real attitude indicator does not drift toward the horizon, it holds it. At
// .14 the ball took about fifteen frames to close on the target, which reads as
// floaty — a slow thing chasing you rather than an instrument. At .34 it is
// there in about five: tight and precise, still smoothed enough not to twitch
// on the pixel noise of a moving pointer or a hand that is not quite still.
const EASE = 0.34;

// Below this the ball is already where it is going. Without it the lerp
// asymptotes forever and writes a new transform every frame for movement no
// one can see — the instrument is never actually at rest.
const SETTLED = 0.01;

const clamp = (v, r) => Math.min(r, Math.max(-r, v));

// Full deflection near the edges rather than in the corner: the pointer runs
// -1..1 across the viewport and the range is applied straight to it.
export const bankFromPointer = (x, vw) => clamp(-((x / vw) - 0.5) * 2 * BANK_RANGE, BANK_RANGE);
export const pitchFromPointer = (y, vh) => clamp(((y / vh) - 0.5) * 2 * PITCH_RANGE, PITCH_RANGE);
export const bankFromTilt = (gamma) => clamp(gamma ?? 0, BANK_RANGE);
// A normal holding angle is about 45 degrees, so that reads as level.
export const pitchFromTilt = (beta) => clamp((beta ?? 45) - 45, PITCH_RANGE);

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
export function useAttitude(still) {
  const node = useRef(null);

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

  useEffect(() => {
    const el = node.current;
    if (!el) return undefined;
    if (still || systemStill) {
      el.setAttribute("transform", "rotate(0 60 60) translate(0 0)");
      return undefined;
    }

    const target = { bank: 0, pitch: 0 };
    const current = { bank: 0, pitch: 0 };

    const onPointer = (e) => {
      target.bank = bankFromPointer(e.clientX, window.innerWidth);
      target.pitch = pitchFromPointer(e.clientY, window.innerHeight);
    };
    const onTilt = (e) => {
      if (e.gamma == null && e.beta == null) return;
      target.bank = bankFromTilt(e.gamma);
      target.pitch = pitchFromTilt(e.beta);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("deviceorientation", onTilt);

    let frame = 0;
    let lastWrite = "";
    const tick = () => {
      const db = target.bank - current.bank, dp = target.pitch - current.pitch;
      // Snap the last hundredth rather than approach it forever.
      current.bank = Math.abs(db) < SETTLED ? target.bank : current.bank + db * EASE;
      current.pitch = Math.abs(dp) < SETTLED ? target.pitch : current.pitch + dp * EASE;
      // 1 degree of pitch is about 1.1px of travel on a 42px dial.
      const next = `rotate(${current.bank.toFixed(2)} 60 60) translate(0 ${(current.pitch * 1.1).toFixed(2)})`;
      // Only touch the DOM when the value actually changed. At rest — which is
      // most of the time on a desktop — this costs nothing.
      if (next !== lastWrite) { el.setAttribute("transform", next); lastWrite = next; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      cancelAnimationFrame(frame);
    };
  }, [still, systemStill]);

  return node;
}

// iOS gates orientation behind a user gesture. Called from the first tap
// anywhere; harmless everywhere else.
export function askForOrientation() {
  const D = typeof window !== "undefined" ? window.DeviceOrientationEvent : null;
  if (!D || typeof D.requestPermission !== "function") return Promise.resolve(false);
  return D.requestPermission().then((r) => r === "granted").catch(() => false);
}
