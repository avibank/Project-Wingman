import { useLayoutEffect, useRef, useState } from "react";
import { mmss } from "./lessonState.js";
import {
  VB, PATH, THRESHOLDS, TOTAL, pointAt, profileState, px,
} from "../../lib/moduleProfile.js";

// §2.3 and §2.4 — the indicator row and the flight profile.
//
// Every colour here is a token. There is not a hex value in this file, and an
// SVG is the easiest place to break that rule.
//
// The three indicators read as one panel because they share a height, a radius,
// a border weight and a typeface, and they differ only in DEPTH: the gauge and
// the lamp are recessed into the surface, the sticker sits proud of it. That
// contrast is the whole reason the row does not look like three unrelated
// widgets.

/* ------------------------------------------------------------ 1 · ACCURACY */
// §2.3 — an ABSOLUTE scale. 0 puts the needle hard left, 100 hard right,
// sweeping the full arc, and a target tick marks the pass mark wherever it
// falls. This reverses the earlier centre-zero dial, which showed deviation
// from the pass mark and so could not answer "what did I actually average".
// Off-centre is correct and expected: a pass mark of 75 sits three quarters of
// the way round, not at twelve o'clock.
const CX = 19, CY = 27, R = 13.5;

// value 0..100 -> degrees, -90 hard left through +90 hard right.
const sweep = (v) => (Math.max(0, Math.min(100, v)) / 100) * 180 - 90;
// No data parks the needle BELOW the left end of the arc. Hard left is a real
// reading of zero, so resting there would be a lie.
const PARKED = -104;

export function Accuracy({ mean, passMark = 75, onPress }) {
  const has = mean != null;
  const angle = has ? sweep(mean) : PARKED;
  const label = has
    ? `Accuracy. Averaging ${Math.round(mean)} out of 100, against a pass mark of ${passMark}.`
    : "Accuracy. No reading yet — take a quiz and the needle comes alive.";

  return (
    <button type="button" className="ind" onClick={(e) => onPress?.(e)} aria-label={label}>
      <span className="gauge" data-nodata={has ? undefined : ""}>
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
          <path className="g-arc" d={`M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`} fill="none" />
          {/* the pass mark, wherever it falls */}
          <path className="g-tick" d={`M${CX},12 L${CX},16.4`}
                transform={`rotate(${sweep(passMark)} ${CX} ${CY})`} />
          <g className="g-needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line x1={CX} y1={CY} x2={CX} y2="15.2" />
          </g>
          <circle className="g-hub" cx={CX} cy={CY} r="2.3" />
        </svg>
      </span>
    </button>
  );
}

/* --------------------------------------------------------- 2 · CALIBRATION */
// §2.3 — a calibration sticker. A banded header, a value, and it sits proud of
// the panel. The band takes the accent when there is data and drains to a
// neutral when there is none, so an idle sticker never looks live.
//
// NO CAP on the number. The reference build caps at "9+"; the brief says the
// actual number, and a student with fourteen to re-check is owed fourteen.
export function Calibration({ count, hasData = true, onPress }) {
  const state = !hasData ? "nodata" : count === 0 ? "clear" : "due";
  const value = state === "nodata" ? "—" : state === "clear" ? "✓" : String(count);
  const label = state === "nodata" ? "Calibration. Nothing recorded yet."
    : state === "clear" ? "Calibration. Clear — nothing to re-check."
      : `Calibration. ${count} question${count === 1 ? "" : "s"} to re-check.`;

  return (
    <button type="button" className="ind" onClick={(e) => onPress?.(e)} aria-label={label}>
      <span className="sticker" data-state={state}>
        <span className="band">CALIBRATION</span>
        <span className="val">{value}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------ 3 · MASTER CAUTION */
// §2.3 — a legend lamp, and the only thing in the app entitled to the caution
// colour. Unlit is a neutral face with the legend still readable: a lamp you
// cannot read when it is dark is a lamp you cannot learn.
export function MasterCaution({ count, onPress }) {
  const lit = count > 0;
  return (
    <button type="button" className="ind" onClick={(e) => onPress?.(e)}
            aria-label={lit
              ? `Master caution. ${count} question${count === 1 ? "" : "s"} to put right.`
              : "Master caution. All clear."}>
      <span className="lamp" data-lit={lit ? "true" : "false"}>
        <span>MASTER</span>
        <span>CAUTION</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------- 4 · THE FLIGHT PROFILE */
// The aircraft sits ON the route, placed by arc length and rotated to the
// path's tangent, lifted off the line along the normal while in flight so the
// waypoint underneath stays countable.
const PLANE = "M11.5,0.3 C5.5,-2.7 -3,-3.3 -10.5,-2.3 L-10.5,2.5 C-3,3.4 5.5,2.9 11.5,0.3 Z"
  + " M-6.2,-2.5 L-8.6,-8.4 L-10.6,-8.4 L-9.7,-2.3 Z"
  + " M-0.6,1.7 L-4.2,6.6 L-1.5,6.6 L2.9,2 Z";

export function FlightProfile({ chapters = [], atIndex = 0, started = false }) {
  // Measured, because every stroke width and radius is divided by the scale.
  // Without it the whole route renders at about one pixel on a phone.
  const wrapRef = useRef(null);
  const [W, setW] = useState(VB.w);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.max(160, Math.round(el.getBoundingClientRect().width));
      setW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = Math.max(1, chapters.length);
  // Not started is step 0 whatever the chapter index says.
  const step = started ? Math.max(1, Math.min(n + 1, atIndex + 1)) : 0;
  const s = profileState(n, step, W);
  const P = (v) => px(v, s.scale);

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <svg className="profile" viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label={s.label}
           preserveAspectRatio="xMidYMid meet">
        {/* Runway thresholds — quiet, and visibly not chapter marks, so nobody
            counts them as chapters. */}
        <g className="pf-thresh" strokeWidth={P(4)}>
          {THRESHOLDS.map((t, i) => <path key={i} d={`M${t.x1},${t.y} L${t.x2},${t.y}`} />)}
        </g>

        {/* the whole route, dashed and neutral — this is all of it before you start */}
        <path className="pf-ahead" d={PATH} fill="none"
              strokeWidth={P(2.4)} strokeDasharray={`${P(5)} ${P(7)}`} />

        {/* what you have flown, drawn over it — one dash as long as the
            distance covered, so no clip path is needed */}
        {s.started && (
          <path className="pf-behind" d={PATH} fill="none"
                strokeWidth={P(2.9)} strokeDasharray={`${s.behind.toFixed(2)} ${TOTAL + 10}`} />
        )}

        {s.showWps && s.wps.map((wl, i) => {
          const q = pointAt(wl);
          const done = i + 1 <= s.idx;
          return <circle key={i} className="pf-wp" data-done={done ? "1" : "0"}
                         cx={q.x.toFixed(2)} cy={q.y.toFixed(2)} r={P(4.4)} strokeWidth={P(2)} />;
        })}

        <g className="pf-plane"
           transform={`translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) rotate(${s.angle.toFixed(2)}) scale(${P(1.15)})`}>
          <path d={PLANE} />
        </g>
      </svg>
    </div>
  );
}

export const minutesWord = (secs) => `${Math.max(1, Math.round((secs || 0) / 60))} min`;
export const stamp = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;
};
export { mmss };
