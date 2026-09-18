// The Manual finish's instrument strip: the same four instruments, drawn
// rather than lit. Geometry ported verbatim from paperStrip(C) in the Livery
// Engine II reference — every coordinate, radius and offset is the reference's.
// The checklist's boxes went with the lit strip's lamps: one box per chapter
// flown is the module card's sentence, drawn twice.
//
// .ink is the livery's accent, so the drawing is in whatever ink the livery
// supplies. .inkh is the hairline. Both are defined with the finish CSS.

import { GyroMarks } from "./Gyro.jsx";
import { gyroState, gyroLabel } from "../lib/attitude.js";
import { DEFAULT_MINIMUMS } from "../lib/minimums.js";

const MONO = "'Geist Mono', monospace";

// Both switches, as everywhere else: the device asking and the person asking,
// and either alone stops it. The Smooth Air blanket rule covers this too, but
// the media query has to be stated here because this is a scoped stylesheet.
const PAPER_CSS = `
.papersweep { transform-origin: 43px 44px; animation: papersweep 4.6s linear infinite; opacity: .55; }
@keyframes papersweep { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .papersweep { animation: none; } }
.app.smooth-air .papersweep { animation: none; }
`;

function PaperStrip({
  ring, bar = DEFAULT_MINIMUMS, flown = 0, palette = {},
  bag, hobbs, blips, caps, ballRef,
}) {
  return (
    <>
      <div className="cel">
        <svg width="86" height="86" viewBox="0 0 86 86" className="gy gy-paper" role="img"
             data-state={gyroState(ring, bar)} aria-label={gyroLabel(ring, flown, bar)}>
          <defs>
            <clipPath id="pw-paper-dial"><circle cx="40" cy="44" r="30" /></clipPath>
          </defs>
          {/* Drawn rather than lit, but reading the same attitude: the horizon
              and its hatching bank and pitch, the aircraft symbol does not. */}
          <g clipPath="url(#pw-paper-dial)">
            <g ref={ballRef} transform="rotate(0 40 44) translate(0 0)">
              <path d="M10 44 h60" className="ink" />
              {Array.from({ length: 7 }, (_, i) => (
                <path key={i} d={`M${16 + i * 8} 48 l-4 7`} className="inkh" />
              ))}
            </g>
          </g>
          <circle cx="40" cy="44" r="30" className="ink" />
          {/* The lit gyro's marks at this dial's scale, just outside the drawn
              circle: the rim is the average and the notch is the bar. */}
          <GyroMarks average={ring} bar={bar} cx={40} cy={44} scale={35 / 49} palette={palette} />
          <path d="M22 44 h9 M49 44 h9 M40 39 v-4" className="ink" />
          <path d="M63 24 l9 -9 h9" className="inkh" /><text x="82" y="14" className="cn">1</text>
          <text x="40" y="70" textAnchor="middle" className="cn" style={{ fontSize: "9px" }}>
            {ring === null || ring === undefined ? "--" : `${ring}%`}
          </text>
          <circle cx="40" cy="44" r="2" className="inkf" />
        </svg>
        <div className="cap">{caps[0]}</div>
      </div>

      <div className="cel">
        <svg width="66" height="86" viewBox="0 0 66 86" aria-hidden="true">
          <rect x="16" y="34" width="34" height="30" rx="2" className="ink" />
          <path d="M25 34 v-6 h16 v6" className="ink" />
          <path d="M16 46 h34" className="inkh" /><path d="M52 38 l8 -8 h6" className="inkh" />
          <text x="59" y="28" className="cn">2</text>
          {bag ? (
            <text x="33" y="59" textAnchor="middle" className="inkf"
                  style={{ fontSize: "13px", fontFamily: MONO }}>{bag}</text>
          ) : null}
        </svg>
        <div className="cap">{caps[1]}</div>
      </div>

      <div className="cel">
        <svg width="96" height="86" viewBox="0 0 96 86" aria-hidden="true">
          <path d="M14 58 h68" className="ink" />
          <path d="M14 58 v-5 M82 58 v-5" className="inkh" />
          {/* 0013.9 is six characters where 13:59 was five, so the drawn
              face reads a size down to stay inside its rule. */}
          <text x="48" y="52" textAnchor="middle"
                style={{ fontFamily: MONO, fontSize: "17px", letterSpacing: "1.2px" }}
                fill="var(--t1)">{hobbs}</text>
        </svg>
        <div className="cap">{caps[2]}</div>
      </div>

      <div className="cel">
        <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
          <circle cx="43" cy="44" r="30" className="ink" />
          <circle cx="43" cy="44" r="17" className="inkh" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = i * 30 * Math.PI / 180;
            return (
              <path key={i} className="inkh"
                    d={`M${(43 + Math.cos(a) * 30).toFixed(1)} ${(44 + Math.sin(a) * 30).toFixed(1)} L${(43 + Math.cos(a) * 26).toFixed(1)} ${(44 + Math.sin(a) * 26).toFixed(1)}`} />
            );
          })}
          {/* The sweep. A drawn scope still turns. */}
          <line x1="43" y1="44" x2="43" y2="14" className="ink papersweep" />
          {blips ? (
            <>
              <circle cx="56" cy="33" r="2.2" className="inkf" />
              <circle cx="32" cy="54" r="2.2" className="inkf" />
            </>
          ) : null}
        </svg>
        <div className="cap">{caps[3]}</div>
      </div>
      <style>{PAPER_CSS}</style>
    </>
  );
}

export default PaperStrip;
