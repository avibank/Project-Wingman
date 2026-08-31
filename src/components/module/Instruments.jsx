import { useLayoutEffect, useRef, useState } from "react";
import { mmss } from "./lessonState.js";
import "./instruments.css";
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

/* THE INSTRUMENT ROW IS GONE — §1 and §2.

   Accuracy, Calibration and MasterCaution used to be three pressable
   instruments under the module title, each with a popover. The final brief
   replaces all three: one signal (the lamp, on whichever chapter owns the
   problem) and one dial (deviation from the user's minimums, in the Library
   and on the results screen). Nothing floats above the list any more.

   Their popover went with them, and so did AccuracyPanel — the rebuilt
   Library's Quizzes section IS the quiz record it used to show, chapter by
   chapter with every score. What survives here is the lamp as a static mark
   and the flight profile, which still has a home on the Flight Deck's module
   cards.
   ========================================================================= */

/* §2 — THE LAMP AS A MARK, for the places that are already a button.
   A chapter header and a Flight Deck module card are both <button>. A lamp
   rendered as a button inside one of those is nested interactive content:
   invalid HTML, and in practice an unreachable inner control that still eats
   the click. So the mark is a span with role="img", which keeps the lamp
   nameable — its label folds into the row's own accessible name, giving
   "Chapter 2 … Master caution" — without adding a second focus stop.

   Compact is one line rather than two: at row scale the stacked legend is
   taller than the text beside it and drags the whole row open. */
export function CautionMark({ compact = false, className = "" }) {
  return (
    <span className={`lamp lamp-mark${compact ? " lamp-sm" : ""} ${className}`.trim()}
          data-lit="true" role="img" aria-label="Master caution">
      {compact ? <span>MASTER CAUTION</span> : (<><span>MASTER</span><span>CAUTION</span></>)}
    </span>
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

        {/* Manual's second pencil pass: the same flown path, offset and faded,
            drawn UNDER the line so the leg reads as drawn rather than plotted.
            Hidden in Standard and Aurora by room-less default in manual.css. */}
        {s.started && (
          <path className="pf-pencil" d={PATH} fill="none"
                strokeWidth={P(1.2)}
                strokeDasharray={`${s.behind.toFixed(2)} ${TOTAL + 10}`}
                transform={`translate(${P(1.5)} ${P(1.8)})`} />
        )}

        {/* Two aircraft, one shown. CSS picks by finish rather than JS, so the
            geometry is computed once and neither finish can drift from it. */}
        <g className="pf-plane"
           transform={`translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) rotate(${s.angle.toFixed(2)}) scale(${P(1.15)})`}>
          <path d={PLANE} />
        </g>
        {/* The dart. Folded paper: outline, centre fold, top fold. The
            stroke-linejoin stays round — a mitre reads as a jet, not paper. */}
        <g className="pf-dart"
           transform={`translate(${s.x.toFixed(2)},${s.y.toFixed(2)}) rotate(${s.angle.toFixed(2)}) scale(${P(0.92)}) translate(-23 -11)`}>
          <path className="pf-dart-body" d="M46 11 L0 0 L13 11 L0 22 Z" strokeLinejoin="round" />
          <path className="pf-dart-fold" d="M46 11 L13 11" />
          <path className="pf-dart-fold" d="M46 11 L0 0" opacity=".55" />
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
