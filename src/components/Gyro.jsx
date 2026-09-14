import {
  RIM_R, RIM_W, RIM_C, NOTCH_IN, NOTCH_OUT, NOTCH_W, LAST_R,
  gyroState, rimLength, notchAngle, surplusArc, gyroWords, gyroLabel,
} from "../lib/attitude.js";
import { DEFAULT_MINIMUMS } from "../lib/minimums.js";
import "./gyro.css";

/* =============================================================================
   The gyro — the Flight Deck's attitude indicator — and what it reads.
   -----------------------------------------------------------------------------
   Two halves on two clocks. The ball is live and is written straight onto its
   node by useAttitude, so nothing here re-renders for it. The rim is the active
   module's quiz average against the student's bar, and changes only when a
   score or the bar does.

   EVERY COLOUR IS THE LIVERY'S, AT RUNTIME. The palette (C) and the ramp (surf)
   come from deckVars(), the same numbers the room is lit with, and go on as
   presentation attributes. State overrides them in gyro.css, because any author
   rule beats an attribute: under takes the caution amber, and the paper finish
   redraws the notch and the surplus in sketch ink. They are not static tokens,
   because a static token is a second opinion about the livery.
   ========================================================================= */

const r3 = (n) => Number(n.toFixed(3));

/* The marks at any size: rim, surplus, the last-quiz dot and the notch, in that
   order so the notch sits on top. `scale` carries the brief's geometry to the
   paper gyro. Nothing at all before the first quiz. */
export function GyroMarks({
  average = null, bar = DEFAULT_MINIMUMS, last = null,
  cx = 60, cy = 60, scale = 1, palette = {},
}) {
  if (gyroState(average, bar) === "nodata") return null;
  const k = scale;
  const r = r3(RIM_R * k);
  const circ = r3(RIM_C * k);
  const len = r3(rimLength(average) * k);
  const surplus = surplusArc(average, bar);
  // Turned -90 so the dash starts at the top and runs clockwise.
  const turn = `rotate(-90 ${cx} ${cy})`;
  const at = (points) => `rotate(${r3(notchAngle(points))} ${cx} ${cy})`;
  return (
    <g className="gy-marks">
      {len > 0 && (
        <circle className="gy-rim" cx={cx} cy={cy} r={r} fill="none" strokeWidth={r3(RIM_W * k)}
                stroke={palette.active} transform={turn} strokeDasharray={`${len} ${circ}`} />
      )}
      {surplus && (
        <circle className="gy-surplus" cx={cx} cy={cy} r={r} fill="none" strokeWidth={r3(RIM_W * k)}
                stroke={palette.lit} transform={turn}
                strokeDasharray={`${r3(surplus.length * k)} ${circ}`}
                strokeDashoffset={r3(surplus.offset * k)} />
      )}
      {/* Built and off: nothing on the deck passes `last`. */}
      {last !== null && last !== undefined && (
        <circle className="gy-last" cx={cx} cy={r3(cy - r)} r={r3(LAST_R * k)} fill="none"
                stroke={palette.t1} strokeWidth={r3(1.4 * k)} transform={at(last)} />
      )}
      <line className="gy-notch" x1={cx} y1={r3(cy - NOTCH_IN * k)} x2={cx} y2={r3(cy - NOTCH_OUT * k)}
            stroke={palette.t1} strokeWidth={r3(NOTCH_W * k)} strokeLinecap="round" transform={at(bar)} />
    </g>
  );
}

/* The caption. The percentage keeps the caption's own colour and the state
   phrase takes the state's. Nodes rather than a string, which both strips can
   take because both render a caption as a child. */
export function GyroCaption({ average = null, bar = DEFAULT_MINIMUMS }) {
  const w = gyroWords(average, bar);
  if (!w.pct) return <>{w.phrase}</>;
  return (
    <>
      <span className="gy-pct">{w.pct}</span>{w.joiner}
      <span className="gy-phrase" data-state={w.state}>{w.phrase}</span>
    </>
  );
}

/* The lit gyro. The ball, the bezel, the wings and the hub are the instrument
   as it was; the rim, the notch and the surplus are GyroMarks. */
export default function Gyro({
  average = null, flown = 0, bar = DEFAULT_MINIMUMS, last = null,
  C, surf, night = true, ballRef = null,
}) {
  const state = gyroState(average, bar);
  return (
    <svg className="ai gy" viewBox="0 0 120 120" role="img" data-state={state}
         aria-label={gyroLabel(average, flown, bar)}>
      <defs><clipPath id="pw-dial"><circle cx="60" cy="60" r="42" /></clipPath></defs>
      <g clipPath="url(#pw-dial)">
        {/* The ball. Its transform is written straight onto the node every
            frame — see useAttitude — so it never re-renders the deck and wants
            no CSS transition of its own. */}
        <g ref={ballRef} transform="rotate(0 60 60) translate(0 0)">
          <rect x="-70" y="-80" width="260" height="140" fill={surf[night ? 7 : 9]} />
          <rect x="-70" y="60" width="260" height="140" fill={surf[night ? 1 : 6]} />
          <rect x="-70" y="59" width="260" height="1.6" fill={C.lit} />
          <g stroke={surf[night ? 10 : 4]} strokeWidth="1.4">
            <line x1="52" y1="46" x2="68" y2="46" /><line x1="55" y1="52.5" x2="65" y2="52.5" />
            <line x1="55" y1="66.5" x2="65" y2="66.5" /><line x1="52" y1="73" x2="68" y2="73" />
          </g>
        </g>
      </g>
      <circle cx="60" cy="60" r="42" fill="none" strokeWidth="1" stroke={C.line} />
      <circle cx="60" cy="60" r="49" fill="none" strokeWidth="3" stroke={C.line} />
      <GyroMarks average={average} bar={bar} last={last} palette={C} />
      <g fill={C.line}>
        <circle cx="21" cy="21" r="1.8" /><circle cx="99" cy="21" r="1.8" />
        <circle cx="21" cy="99" r="1.8" /><circle cx="99" cy="99" r="1.8" />
      </g>
      <g strokeWidth="5.2" strokeLinecap="round" fill="none" opacity=".85" stroke={surf[night ? 0 : 12]}>
        <line x1="38" y1="60" x2="52" y2="60" /><line x1="68" y1="60" x2="82" y2="60" />
      </g>
      <g strokeWidth="2.6" strokeLinecap="round" fill="none" stroke={surf[night ? 11 : 1]}>
        <line x1="38" y1="60" x2="52" y2="60" /><line x1="68" y1="60" x2="82" y2="60" />
      </g>
      <circle cx="60" cy="60" r="3.6" fill={surf[night ? 0 : 12]} opacity=".85" />
      <circle cx="60" cy="60" r="2.2" fill={surf[night ? 11 : 1]} />
      <text className="gy-read" x="60" y="88" textAnchor="middle" fill={C.t1} fontSize="13" fontWeight="500">
        {state === "nodata" ? "--" : `${average}%`}
      </text>
    </svg>
  );
}
