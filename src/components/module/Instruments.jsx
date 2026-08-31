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
// NOT `lamp`. That class has a second, older owner — the Flight Deck's leg
// indicator bars in Home's DECK_CSS — and sharing it made the two components
// style each other in BOTH directions. This file's bare `.lamp { width: 68px }`
// was landing on those bars, and since a grid item's width becomes its
// automatic minimum, three 68px minimums held a 101px track set open at 214px
// and the bars spilled out of their cel. Specificity could not fix that:
// `.deck .lamp` never set width, so there was nothing to win. Not sharing the
// name is the fix.
// `lit` defaults to true because every existing caller renders this ONLY where
// there is already a fault — the mark exists to say so. Manual's indicator row
// is the first place the lamp is permanent, so it needs to be able to sit dark:
// an instrument at rest, hatched, waiting. A lamp that is lit whether or not
// anything is wrong is not an instrument, it is decoration.
export function CautionMark({ compact = false, className = "", lit = true }) {
  return (
    <span className={`lamp-mark${compact ? " lamp-sm" : ""} ${className}`.trim()}
          data-lit={lit ? "true" : "false"} role="img"
          aria-label={lit ? "Master caution" : "Master caution, off"}>
      {compact ? <span>MASTER CAUTION</span> : (<><span>MASTER</span><span>CAUTION</span></>)}
    </span>
  );
}

/* ====================== §2.3 — THE INDICATOR ROW, MANUAL ONLY ==============
   Three indicators under the module title: accuracy, calibration, master
   caution. They are the ONE piece of the old module banner that Manual keeps.

   Why only Manual. §1 of the module brief removed this row from the screen,
   and that removal stands for Standard and Aurora: one signal (the lamp, on
   whichever chapter owns the problem) and one dial (in the Library). Manual is
   a different argument — it is a paper file, and a paper file has a cover
   sheet with the readings written on it. The instruments here are drawn, not
   lit, so they read as a printed schematic rather than a second dashboard
   competing with the list below.

   Every value comes from the two numbers ModuleScreen already derived, handed
   down rather than recomputed, so this row cannot form its own opinion about
   the same fact — the rule §8 sets for the lamp and the Library dial.
   ========================================================================= */

/* Absolute scale, 0 hard left to 100 hard right, graduated at 0 / 50 / 100.
   The needle is a <line> inside .g-needle rather than a path drawn to the
   computed tip, because both stylesheets already target `.g-needle line`, and
   .g-needle carries the 650ms damping that stops the needle snapping. Rotating
   is the same geometry: straight up is 50, so the angle is (v - 0.5) * 180.
   Checked against the brief — v = 0.68 puts the tip at (30.8, 13.7). */
function AccuracyGauge({ pct }) {
  const has = Number.isFinite(pct);
  const v = has ? Math.max(0, Math.min(1, pct / 100)) : 0;
  const deg = (v - 0.5) * 180;
  return (
    <span className="gauge" data-nodata={has ? undefined : ""} role="img"
          aria-label={has ? `Accuracy, ${Math.round(pct)} per cent`
            : "Accuracy, waiting on your first quiz"}>
      <svg viewBox="0 0 46 30" width="30" height="20" fill="none" aria-hidden="true">
        <path className="g-arc" d="M6 26 A17 17 0 0 1 40 26" />
        <path className="g-tick" d="M3.4 26 L7.2 26 M23 6.4 L23 10.2 M42.6 26 L38.8 26" />
        {/* Parked hard left with no data, which is the off-scale half of the
            two cues .gauge[data-nodata] gives — never colour alone. */}
        <g className="g-needle" transform={`rotate(${deg} 23 26)`}>
          <line x1="23" y1="26" x2="23" y2="11.5" />
        </g>
        <circle className="g-hub" cx="23" cy="26" r="2" />
      </svg>
    </span>
  );
}

/* The legend on a ruled band, the reading beneath it. Manual turns the band's
   fill off and rules it instead; the perforation the other finishes draw is
   off here because it strikes through the word CALIBRATION. */
function CalibrationSticker({ done }) {
  return (
    <span className="sticker" data-state={done ? "ok" : "nodata"} role="img"
          aria-label={done ? "Calibration, current" : "Calibration, a re-check sets this"}>
      <span className="band">CALIBRATION</span>
      <span className="val">{done ? "✓" : "–"}</span>
    </span>
  );
}

export function IndicatorRow({ avgPct, calibrated = false, caution = false }) {
  return (
    <div className="instrow">
      {/* Divs, not buttons. .ind carries button styling from when each one
          opened a panel; those panels are gone, and a cursor: pointer on
          something that does nothing is a promise the screen does not keep.
          Manual turns the cursor back to default. */}
      <div className="ind"><AccuracyGauge pct={avgPct} /></div>
      <div className="ind"><CalibrationSticker done={calibrated} /></div>
      <div className="ind"><CautionMark lit={caution} /></div>
    </div>
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
