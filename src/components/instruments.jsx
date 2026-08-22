import { useState, useEffect, useRef } from "react";

// Avionics instrument primitives. Deliberately restrained: legibility first,
// motifs kept low-opacity so they read as hardware rather than skeuomorphic
// decoration. Every ambient motion here has a still fallback.

// ---------------------------------------------------------------- module motif
// Subject-specific texture that sits behind hub content, never in front of it.
export function ModuleMotif({ motif }) {
  const common = { stroke: "currentColor", fill: "none", strokeWidth: 1 };
  return (
    <svg className="instr-motif" viewBox="0 0 200 200" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {motif === "turbine" && (
        <g {...common}>
          {[18, 34, 50, 66, 82].map((r) => <circle key={r} cx="100" cy="100" r={r} />)}
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <line key={i} x1={100 + Math.cos(a) * 20} y1={100 + Math.sin(a) * 20}
              x2={100 + Math.cos(a) * 82} y2={100 + Math.sin(a) * 82} />;
          })}
        </g>
      )}
      {motif === "manifold" && (
        <g {...common}>
          <circle cx="100" cy="100" r="70" />
          <circle cx="100" cy="100" r="58" />
          {Array.from({ length: 13 }).map((_, i) => {
            const a = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
            return <line key={i} x1={100 + Math.cos(a) * 58} y1={100 + Math.sin(a) * 58}
              x2={100 + Math.cos(a) * 70} y2={100 + Math.sin(a) * 70} strokeWidth={i % 3 === 0 ? 2 : 1} />;
          })}
          <line x1="100" y1="100" x2="148" y2="66" strokeWidth="2" />
        </g>
      )}
      {motif === "streamlines" && (
        <g {...common}>
          {[30, 55, 80, 105, 130, 155].map((y, i) => (
            <path key={y} d={`M-10 ${y} C 60 ${y - (i % 2 ? 14 : 8)}, 140 ${y + (i % 2 ? 14 : 8)}, 210 ${y}`} />
          ))}
          <ellipse cx="100" cy="95" rx="46" ry="12" strokeWidth="1.5" />
        </g>
      )}
      {motif === "compass" && (
        <g {...common}>
          <circle cx="100" cy="100" r="78" />
          <circle cx="100" cy="100" r="62" />
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const len = i % 3 === 0 ? 14 : 7;
            return <line key={i} x1={100 + Math.cos(a) * 78} y1={100 + Math.sin(a) * 78}
              x2={100 + Math.cos(a) * (78 - len)} y2={100 + Math.sin(a) * (78 - len)} />;
          })}
          <line x1="100" y1="22" x2="100" y2="178" />
          <line x1="22" y1="100" x2="178" y2="100" />
        </g>
      )}
      {motif === "isobars" && (
        <g {...common}>
          {[24, 40, 56, 72].map((r, i) => (
            <ellipse key={r} cx={92 + i * 4} cy="100" rx={r} ry={r * 0.72} />
          ))}
          <path d="M-10 40 C 50 20, 150 60, 210 34" strokeWidth="1.5" />
          <path d="M-10 168 C 50 148, 150 186, 210 160" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}

// ------------------------------------------------------------------ value tape
// Vertical scrolling tape, as on an altitude or airspeed indicator: neighbouring
// values stay visible above and below the boxed current reading.
export function ValueTape({ value = 0, label, unit = "", hue }) {
  const rows = [value + 2, value + 1, value, value - 1, value - 2];
  return (
    <div className="tape">
      <div className="tape-window">
        <div className="tape-strip">
          {rows.map((n, i) => (
            <div key={i} className={`tape-row ${i === 2 ? "is-current" : ""}`}>
              {n < 0 ? "" : n}
            </div>
          ))}
        </div>
        <div className="tape-box" aria-hidden="true" />
      </div>
      <div className="instr-label">{label}{unit ? ` · ${unit}` : ""}</div>
    </div>
  );
}

// -------------------------------------------------------------------- N1 dial
// Radial gauge in the style of an N1 readout: arc sweep, tick ring, digital
// window beneath the pointer.
export function N1Dial({ pct = 0, label, hue, size = 108 }) {
  const START = -120;
  const SWEEP = 240;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const arc = c * (SWEEP / 360);
  const filled = arc * (Math.max(0, Math.min(100, pct)) / 100);
  const cx = size / 2;
  const deg = START + (Math.max(0, Math.min(100, pct)) / 100) * SWEEP;
  return (
    <div className="dial">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth="6" className="dial-track"
          strokeDasharray={`${arc} ${c}`} transform={`rotate(${90 + START} ${cx} ${cx})`} />
        <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth="6" strokeLinecap="round" className="dial-fill"
          strokeDasharray={`${filled} ${c}`} transform={`rotate(${90 + START} ${cx} ${cx})`} />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = ((START + (t / 100) * SWEEP - 90) * Math.PI) / 180;
          const ro = r + 8;
          return <line key={t} className="dial-tick"
            x1={cx + Math.cos(a) * ro} y1={cx + Math.sin(a) * ro}
            x2={cx + Math.cos(a) * (ro - 5)} y2={cx + Math.sin(a) * (ro - 5)} />;
        })}
        <line className="dial-pointer" x1={cx} y1={cx} x2={cx} y2={cx - r + 8}
          transform={`rotate(${deg} ${cx} ${cx})`} />
        <circle className="dial-hub" cx={cx} cy={cx} r="4" />
      </svg>
      <div className="dial-readout">{Math.round(pct)}<small>%</small></div>
      <div className="instr-label">{label}</div>
    </div>
  );
}

// -------------------------------------------------------------- split-flap row
// Each character flips in with a short stagger when the text changes, giving the
// arrivals-board update rather than a list re-render.
export function SplitFlap({ text, className = "" }) {
  const [shown, setShown] = useState(text);
  const [flipping, setFlipping] = useState(false);
  const prev = useRef(text);

  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    setFlipping(true);
    setShown(text);
    const t = setTimeout(() => setFlipping(false), 620);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <span className={`flap ${className}`}>
      {shown.split("").map((ch, i) => (
        <span key={`${i}-${ch}`} className={`flap-ch ${flipping ? "is-flipping" : ""}`} style={{ animationDelay: `${i * 14}ms` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ radar scope
// Range rings with a blip per active pilot, positioned deterministically from
// the user id so a given person keeps the same bearing between renders.
export function RadarScope({ contacts = [], size = 132 }) {
  const c = size / 2;
  return (
    <div className="radar">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {[0.33, 0.66, 1].map((f) => <circle key={f} className="radar-ring" cx={c} cy={c} r={(size / 2 - 4) * f} fill="none" />)}
        <line className="radar-ring" x1={c} y1="4" x2={c} y2={size - 4} />
        <line className="radar-ring" x1="4" y1={c} x2={size - 4} y2={c} />
        <g className="radar-sweep" style={{ transformOrigin: `${c}px ${c}px` }}>
          <path d={`M ${c} ${c} L ${c} 4 A ${c - 4} ${c - 4} 0 0 1 ${c + (c - 4) * 0.5} ${c - (c - 4) * 0.866} Z`} className="radar-wedge" />
        </g>
        {contacts.map((ct, i) => {
          const seed = String(ct.user_id || i).split("").reduce((h, ch) => ch.charCodeAt(0) + ((h << 5) - h), 0);
          const angle = (Math.abs(seed) % 360) * (Math.PI / 180);
          const dist = 0.32 + ((Math.abs(seed >> 3) % 60) / 100);
          return <circle key={ct.user_id || i} className="radar-blip"
            cx={c + Math.cos(angle) * (c - 8) * dist} cy={c + Math.sin(angle) * (c - 8) * dist} r="3" />;
        })}
      </svg>
      <div className="instr-label">{contacts.length ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : "Check in to appear here"}</div>
    </div>
  );
}

export function InstrumentStyles() {
  return (
    <style>{`
      .instr-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
        color: var(--muted); opacity: 0.75; margin-top: 8px; text-align: center; }

      /* glass bezel panel: hardware edge, not a drop shadow */
      .bezel { position: relative; overflow: hidden; border-radius: var(--r-lg);
        background: linear-gradient(180deg, var(--elev-2), var(--elev-1));
        border: 1px solid var(--border);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.24), 0 10px 26px rgba(0,0,0,0.20); }
      .bezel::before { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
        background: linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 26%, transparent 46%);
        transform: translateX(var(--sweep, -18%)); transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
      .bezel:hover::before { --sweep: 18%; }
      /* screw heads at the panel corners */
      .bezel::after { content: ""; position: absolute; inset: 7px; pointer-events: none; border-radius: calc(var(--r-lg) - 5px);
        background:
          radial-gradient(circle 2.5px at 0 0, var(--border-hover) 60%, transparent 61%),
          radial-gradient(circle 2.5px at 100% 0, var(--border-hover) 60%, transparent 61%),
          radial-gradient(circle 2.5px at 0 100%, var(--border-hover) 60%, transparent 61%),
          radial-gradient(circle 2.5px at 100% 100%, var(--border-hover) 60%, transparent 61%);
        background-repeat: no-repeat; opacity: 0.7; }

      .instr-motif { color: var(--accent); position: absolute; right: -34px; top: 50%; transform: translateY(-50%);
        width: 230px; height: 230px; opacity: 0.055; pointer-events: none; }

      /* value tape */
      .tape { display: flex; flex-direction: column; align-items: center; }
      .tape-window { position: relative; width: 66px; height: 92px; overflow: hidden; border-radius: var(--r-sm);
        background: var(--well); box-shadow: var(--shadow-inset); }
      .tape-strip { display: flex; flex-direction: column; transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
      .tape-row { height: 18.4px; display: flex; align-items: center; justify-content: center;
        font-family: var(--font-mono); font-size: 11px; color: var(--muted2); font-variant-numeric: tabular-nums; }
      .tape-row.is-current { font-size: 17px; font-weight: 500; color: var(--accent); }
      .tape-box { position: absolute; left: 3px; right: 3px; top: 50%; height: 24px; transform: translateY(-50%);
        border-top: 1px solid var(--border-hover); border-bottom: 1px solid var(--border-hover); }

      /* N1 dial */
      .dial { position: relative; display: flex; flex-direction: column; align-items: center; }
      .dial-track { stroke: var(--well); }
      .dial-fill { stroke: var(--accent); transition: stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1); }
      .dial-tick { stroke: var(--muted2); stroke-width: 1.5; opacity: 0.65; }
      .dial-pointer { stroke: var(--accent); stroke-width: 2; stroke-linecap: round;
        transition: transform 0.6s cubic-bezier(0.22,1,0.36,1); }
      .dial-hub { fill: var(--border-hover); }
      .dial-readout { position: absolute; top: 62%; font-family: var(--font-mono); font-size: 15px;
        color: var(--text); font-variant-numeric: tabular-nums; }
      .dial-readout small { font-size: 0.62em; color: var(--muted2); }

      /* split-flap */
      .flap { display: inline-flex; flex-wrap: wrap; }
      .flap-ch { display: inline-block; transform-origin: 50% 0%; }
      .flap-ch.is-flipping { animation: flapIn 0.34s cubic-bezier(0.22,1,0.36,1) both; }
      @keyframes flapIn {
        0% { transform: rotateX(-88deg); opacity: 0; }
        60% { transform: rotateX(8deg); opacity: 1; }
        100% { transform: none; opacity: 1; }
      }

      /* radar */
      .radar { display: flex; flex-direction: column; align-items: center; }
      .radar-ring { stroke: var(--border); stroke-width: 1; opacity: 0.7; }
      .radar-wedge { fill: var(--presence); opacity: 0.09; }
      .radar-sweep { animation: radarSpin 4.2s linear infinite; }
      @keyframes radarSpin { to { transform: rotate(360deg); } }
      .radar-blip { fill: var(--presence); filter: drop-shadow(0 0 3px var(--accent-glow)); }

      .app.reduce-motion .bezel::before,
      .app.reduce-motion .tape-strip,
      .app.reduce-motion .dial-fill,
      .app.reduce-motion .dial-pointer { transition: none; }
      .app.reduce-motion .radar-sweep,
      .app.reduce-motion .flap-ch.is-flipping { animation: none; }
      @media (prefers-reduced-motion: reduce) {
        .bezel::before, .tape-strip, .dial-fill, .dial-pointer { transition: none; }
        .radar-sweep, .flap-ch.is-flipping { animation: none; }
      }
    `}</style>
  );
}
