import { useEffect, useRef } from "react";

// The ball. Live, always, on every page it appears on — it is never driven by
// the quiz record and never waits for data. The rim is the half that carries
// the score, and the two run on different clocks.
//
// Desktop follows the pointer anywhere in the viewport. Phone follows device
// orientation, falling back to pointer where that is unavailable or refused.

export const BANK_RANGE = 22;
export const PITCH_RANGE = 18;
const EASE = 0.14;

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

  useEffect(() => {
    const el = node.current;
    if (!el) return undefined;
    if (still) {
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
    const tick = () => {
      // A little mass: ease toward the target rather than snapping to it.
      current.bank += (target.bank - current.bank) * EASE;
      current.pitch += (target.pitch - current.pitch) * EASE;
      // 1 degree of pitch is about 1.1px of travel on a 42px dial.
      el.setAttribute("transform",
        `rotate(${current.bank.toFixed(2)} 60 60) translate(0 ${(current.pitch * 1.1).toFixed(2)})`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("deviceorientation", onTilt);
      cancelAnimationFrame(frame);
    };
  }, [still]);

  return node;
}

// iOS gates orientation behind a user gesture. Called from the first tap
// anywhere; harmless everywhere else.
export function askForOrientation() {
  const D = typeof window !== "undefined" ? window.DeviceOrientationEvent : null;
  if (!D || typeof D.requestPermission !== "function") return Promise.resolve(false);
  return D.requestPermission().then((r) => r === "granted").catch(() => false);
}
