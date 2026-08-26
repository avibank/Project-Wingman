// The Manual finish's instrument strip: the same five instruments, drawn
// rather than lit. Geometry ported verbatim from paperStrip(C) in the Livery
// Engine II reference — every coordinate, radius and offset is the reference's.
//
// .ink is the livery's accent, so the drawing is in whatever ink the livery
// supplies. .inkh is the hairline. Both are defined with the finish CSS.

const MONO = "'Geist Mono', monospace";

function PaperStrip({ ring, bag, boxes, hobbs, blips, caps }) {
  return (
    <>
      <div className="cel">
        <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
          <circle cx="40" cy="44" r="30" className="ink" /><path d="M10 44 h60" className="ink" />
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${16 + i * 8} 48 l-4 7`} className="inkh" />
          ))}
          <path d="M22 44 h9 M49 44 h9 M40 39 v-4" className="ink" />
          <path d="M63 24 l9 -9 h9" className="inkh" /><text x="82" y="14" className="cn">1</text>
          {ring ? <text x="40" y="70" textAnchor="middle" className="cn" style={{ fontSize: "9px" }}>{ring}%</text> : null}
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
          {Array.from({ length: 5 }, (_, i) => {
            const x = 8 + (i % 3) * 28, y = 32 + Math.floor(i / 3) * 22;
            return (
              <g key={i}>
                <rect x={x} y={y} width="20" height="15" rx="1" className="inkh" />
                {i < boxes ? <path d={`M${x + 4} ${y + 8} l4 4 l8 -9`} className="ink" /> : null}
              </g>
            );
          })}
        </svg>
        <div className="cap">{caps[2]}</div>
      </div>

      <div className="cel">
        <svg width="96" height="86" viewBox="0 0 96 86" aria-hidden="true">
          <path d="M14 58 h68" className="ink" />
          <path d="M14 58 v-5 M82 58 v-5" className="inkh" />
          <text x="48" y="52" textAnchor="middle"
                style={{ fontFamily: MONO, fontSize: "19px", letterSpacing: "1.7px" }}
                fill="var(--t1)">{hobbs}</text>
        </svg>
        <div className="cap">{caps[3]}</div>
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
          {blips ? (
            <>
              <circle cx="56" cy="33" r="2.2" className="inkf" />
              <circle cx="32" cy="54" r="2.2" className="inkf" />
            </>
          ) : null}
        </svg>
        <div className="cap">{caps[4]}</div>
      </div>
    </>
  );
}

export default PaperStrip;
