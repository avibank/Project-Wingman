import { useEffect, useRef, useState } from "react";
import {
  SPAN, deviation, isPegged, onScale, passOffset, readingWords, PASS_PCT,
} from "../../lib/minimums.js";
import "./dial.css";

/* ============================================================================
   §3 — THE ACCURACY DIAL.

   It reads DEVIATION FROM THE USER'S MINIMUMS, not an absolute score. Centre
   is their bar. Left is under, right is over, pegging at ±25 points. The
   needle is the running average; the small hollow marker on the same scale is
   the last quiz.

   THE REAL PASS MARK HOLDS ITS TRUE OFFSET FROM CENTRE. Set minimums to 60
   and the pass tick sits at +15 — a quarter of the way right. Lowering your
   own bar moves the requirement visibly off-centre; it can never hide it.
   That is the whole reason the scale is deviation and not percent.

   TWO SIZES, TWO PLACES, AND NOWHERE ELSE (§3): 58px on the Library's Quizzes
   header, 170px on the quiz results screen. The sweep animation exists only on
   results, where the needle travelling from the old average to the new one is
   the thing the screen is about.

   NO DATA: the needle parks OFF-SCALE below the left end and the whole dial
   dims. Hard left is a real reading — someone 25 under — so resting there
   would be a lie, and the dimming is the second cue so the state never rests
   on position alone.

   Every colour is a token. The needle takes --caution left of centre, which
   is the one place outside the lamp that colour carries a meaning, and it is
   corroborated by the needle's position and by the words in the label.
   ========================================================================= */

const CX = 50, CY = 50, R = 44;
const ARC_DEG = 100;            // the scale spans -100..+100 degrees
const PARKED_DEG = -118;        // off-scale, below hard left

/* deviation in points -> degrees on the face */
const degFor = (d) => (onScale(d) / SPAN) * ARC_DEG;

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
};
const f = (n) => n.toFixed(1);

/* A needle angle is the only thing that animates, and it animates by CSS
   transform so the damping and the reduced-motion opt-out are both declarative
   — an SVG attribute transform would silently lose them, which is exactly how
   the existing gauge's damping is wired. */
function useSweep(target, animate, start) {
  // SEEDED AT THE START ANGLE, not the target. Seeding with `target` meant the
  // first paint was already the destination, the effect then set the same
  // value and React bailed out, and the transition had nothing to travel from
  // — the needle rendered at the new average and never moved. The one
  // animation the brief says is the point of the results screen was dead.
  const [shown, setShown] = useState(() => (animate ? start : target));
  const first = useRef(true);
  useEffect(() => {
    const wasFirst = first.current;
    first.current = false;
    if (!animate) { setShown(target); return undefined; }
    // A frame is painted at `start` before this runs, so assigning the target
    // here is what the transition interpolates.
    if (wasFirst) { setShown(target); return undefined; }
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target, animate]);
  return shown;
}

export default function Dial({
  size = 58,
  average = null,          // the running average, percent — the needle
  last = null,             // the last quiz, percent — the hollow marker
  minimums = PASS_PCT,     // the user's bar — the centre of the scale
  from = null,             // results only: the average to sweep FROM
  animate = false,
  label,                   // overrides the accessible name when the caller has a better one
}) {
  const live = average !== null && average !== undefined;
  const dev = deviation(average, minimums);
  const fromDev = from === null || from === undefined ? dev : deviation(from, minimums);

  // The needle starts at `from` and lands on `dev`; with no data it parks.
  const targetDeg = live ? degFor(dev) : PARKED_DEG;
  const startDeg = live ? degFor(fromDev) : PARKED_DEG;
  const shownDeg = useSweep(targetDeg, animate && live && startDeg !== targetDeg, startDeg);

  const pd = passOffset(minimums);
  const passPegged = isPegged(pd);
  const [px0, py0] = polar(R + 6, degFor(pd));
  const [px1, py1] = polar(R - 4, degFor(pd));

  const ticks = [];
  for (let d = -SPAN; d <= SPAN; d += 5) {
    if (d === 0) continue;                       // centre is the index, not a tick
    const [ax, ay] = polar(R + 2.4, degFor(d));
    const [bx, by] = polar(R - 2.4, degFor(d));
    ticks.push(`M${f(ax)},${f(ay)} L${f(bx)},${f(by)}`);
  }

  const [ux, uy] = polar(R + 8, -ARC_DEG);
  const [ox, oy] = polar(R + 8, ARC_DEG);
  const [a0x, a0y] = polar(R, -ARC_DEG);
  const [a1x, a1y] = polar(R, ARC_DEG);

  const name = label || `Accuracy. ${readingWords(average, minimums)}.`;

  return (
    <span className="dial" data-nodata={live ? undefined : ""} style={{ width: size, height: size }}>
      <svg viewBox="-8 -10 116 116" role="img" aria-label={name}>
        <circle className="d-face" cx={CX} cy={CY} r="40" />
        <path className="d-arc" fill="none"
              d={`M${f(a0x)},${f(a0y)} A${R},${R} 0 1 1 ${f(a1x)},${f(a1y)}`} />

        <g className="d-ticks">{ticks.map((d, i) => <path key={i} d={d} />)}</g>

        {/* The syllabus, at its true offset from the user's bar. Dimmed rather
            than dropped when it pegs, so a very low bar still shows that the
            requirement is out there past the edge. */}
        <path className="d-pass" data-pegged={passPegged ? "1" : undefined}
              d={`M${f(px0)},${f(py0)} L${f(px1)},${f(py1)}`} />

        {/* The index: the user's own bar, at top dead centre. */}
        <path className="d-index" d={`M50,${CY - R - 9} L54,${CY - R - 1.5} H46 Z`} />

        {/* The last quiz, hollow, on the same scale as the needle. */}
        {last !== null && last !== undefined && (() => {
          const [lx, ly] = polar(R, degFor(deviation(last, minimums)));
          return <circle className="d-last" cx={f(lx)} cy={f(ly)} r="3" />;
        })()}

        <g className="d-needle"
           data-under={live && dev < 0 ? "1" : undefined}
           data-sweep={animate && live ? "1" : undefined}
           style={{ transform: `rotate(${shownDeg.toFixed(2)}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <line x1={CX} y1={CY - 15} x2={CX} y2={CY - (R - 1)} />
          <circle cx={CX} cy={CY - (R - 1)} r="2.4" />
        </g>

        <circle className="d-hub" cx={CX} cy={CY} r="3.4" />

        {/* under and over, so the direction is readable without colour */}
        <path className="d-end" d={`M${f(ux - 2.4)},${f(uy)} h4.8`} />
        <path className="d-end" d={`M${f(ox - 2.4)},${f(oy)} h4.8 M${f(ox)},${f(oy - 2.4)} v4.8`} />
      </svg>
    </span>
  );
}
