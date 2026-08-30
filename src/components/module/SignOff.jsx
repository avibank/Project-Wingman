import { useEffect, useRef, useState } from "react";

// §3.3 — the sign-off stamp.
//
// A serrated seal, not a circle. A plain circle with a tick in it is a
// checkbox, and a checkbox says "tick me"; a seal says something was issued.
// The edge is rouletted, there is an inner ring, and the ink is denser at the
// ring than in the middle, the way a real stamp presses.
//
// Three states, and they are not interchangeable:
//   not armed — dashed and faint, and NOT clickable. Nothing to sign off yet.
//   armed     — solid, in the accent. Set when the lesson has been watched to
//               the end. Watching arms it; the person applies it.
//   stamped   — filled ink, sitting a few degrees off square.
//
// The tilt alone reads as a bug. The tilt plus the press reads as a hand,
// which is why the press animation is not decoration and why it is the one
// piece of motion here that earns its keep.

/* The rouletted edge: alternating outer and inner radius around the circle. */
function serrated(cx, cy, r1, r2, teeth) {
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  return `${d}Z`;
}

const EDGE = serrated(17, 17, 16.2, 14.7, 26);

function Seal({ state }) {
  const st = state === "stamped";
  const idle = state === "idle";
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <path d={EDGE}
            fill={st ? "color-mix(in srgb, currentColor 15%, transparent)" : "none"}
            stroke="currentColor" strokeWidth={st ? 1.7 : 1.3}
            strokeLinejoin="round" opacity={idle ? 0.8 : 1} />
      <circle cx="17" cy="17" r="11.6" fill="none" stroke="currentColor"
              strokeWidth={st ? 1.5 : 1} opacity={st ? 0.85 : 0.6}
              strokeDasharray={idle ? "2.6 2.8" : undefined} />
      <path d="M11.6 17.5 L15.3 21.2 L22.6 13.4" fill="none" stroke="currentColor"
            strokeWidth={st ? 2.7 : 1.8} strokeLinecap="round" strokeLinejoin="round"
            opacity={idle ? 0.55 : 1} />
    </svg>
  );
}

/**
 * @param armed    the lesson has been watched to the end
 * @param stamped  already signed off
 * @param onApply  apply the stamp
 * @param onVoid   void it — asked for, never assumed
 * @param when     the date it was signed off, for the accessible name
 */
export default function SignOff({ armed, stamped, onApply, onVoid, when }) {
  const state = stamped ? "stamped" : armed ? "armed" : "idle";
  const [pressing, setPressing] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);

  // §3.3/§5 — the state lives in the accessible name, not in words beside it.
  const label = stamped
    ? `Signed off${when ? ` on ${when}` : ""}. Press to void.`
    : armed
      ? "Watched to the end. Press to sign off."
      : "Not watched to the end yet — nothing to sign off.";

  const press = () => {
    if (state === "idle") return;
    if (stamped) { onVoid?.(); return; }   // asks before voiding, upstream
    setPressing(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setPressing(false), 460);
    onApply?.();
  };

  return (
    <button type="button" className="stamp" data-s={state}
            disabled={state === "idle"} aria-label={label} title={label}
            onClick={press}>
      <span className={`sc${pressing ? " press" : ""}`}><Seal state={state} /></span>
    </button>
  );
}
