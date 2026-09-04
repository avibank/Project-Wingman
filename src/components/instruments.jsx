import { useState, useEffect, useRef } from "react";

// Avionics instrument primitives. Deliberately restrained: legibility first,
// motifs kept low-opacity so they read as hardware rather than skeuomorphic
// decoration. Every ambient motion here has a still fallback.

export function ValueTape({ value = 0, label, unit = "" }) {
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

// ---------------------------------------------------------------- progress arc
// §5 — the speed-dial gauge is gone: no needle, no ticks, no hub. What is left
// is an indicator, not an instrument, which is the point — a view may hold only
// one instrument and this was never the one worth spending it on.
export function ProgressArc({ pct = 0, label, size = 96 }) {
  const START = -120;
  const SWEEP = 240;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const arc = c * (SWEEP / 360);
  const value = Math.max(0, Math.min(100, pct));
  const filled = arc * (value / 100);
  const cx = size / 2;
  const common = {
    cx, cy: cx, r, fill: "none", strokeWidth: 2, strokeLinecap: "round",
    transform: `rotate(${90 + START} ${cx} ${cx})`,
  };
  return (
    <div className="arc">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle {...common} className="arc-track" strokeDasharray={`${arc} ${c}`} />
        <circle {...common} className="arc-fill" strokeDasharray={`${filled} ${c}`} />
      </svg>
      {/* §5 — every instrument carries a plain numeric readout beside it. */}
      <div className="arc-readout">{Math.round(value)}<small>%</small></div>
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
// §5 — the radar was decoration: blips at a hashed angle and a hashed radius,
// signifying nothing. Now radial distance is how far ahead or behind someone is
// in this module, and angle is arbitrary but stable per member, so a person
// keeps their bearing between visits. Tapping a dot opens that person.
//
// `contacts` are { user_id, callsign, pct }. `pct` is theirs; `you` is yours.
// Centre is your position.
export function RadarScope({ contacts = [], you = 0, size = 148, onPick }) {
  const c = size / 2;
  const usable = c - 12;

  const placed = contacts.map((ct, i) => {
    const seed = String(ct.user_id ?? i)
      .split("")
      .reduce((h, ch) => ch.charCodeAt(0) + ((h << 5) - h), 0);
    const angle = ((Math.abs(seed) % 360) * Math.PI) / 180;
    // Full radius = a whole module apart. Clamped so nobody leaves the scope.
    const delta = Math.max(-100, Math.min(100, (ct.pct ?? 0) - you));
    const dist = Math.min(1, Math.abs(delta) / 100);
    return {
      ...ct, delta, angle,
      x: c + Math.cos(angle) * usable * dist,
      y: c + Math.sin(angle) * usable * dist,
    };
  });

  return (
    <div className="radar">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`${placed.length} squadron members relative to your position`}>
        {[0.33, 0.66, 1].map((f) => (
          <circle key={f} className="radar-ring" cx={c} cy={c} r={usable * f} fill="none" />
        ))}
        <circle className="radar-you" cx={c} cy={c} r="3" />
        {placed.map((p) => (
          <g key={p.user_id} className="radar-contact"
            onClick={() => onPick?.(p)} style={{ cursor: onPick ? "pointer" : "default" }}>
            <title>{`${p.callsign || "Pilot"} — ${
              p.delta === 0 ? "level with you"
              : p.delta > 0 ? `${Math.round(p.delta)}% ahead`
              : `${Math.round(-p.delta)}% behind`}`}</title>
            {/* a generous invisible target: the visible dot is 4px */}
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle className={`radar-blip ${p.delta >= 0 ? "is-ahead" : "is-behind"}`}
              cx={p.x} cy={p.y} r="4" style={{ "--blip": "var(--active)" }} />
          </g>
        ))}
      </svg>
      <div className="instr-label">
        {placed.length
          ? `${placed.length} in this module · you at ${Math.round(you)}%`
          : "Open a chapter and your squadron appears here"}
      </div>
    </div>
  );
}

export function InstrumentStyles() {
  return (
    <style>{`
      .instr-label { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--muted); opacity: 0.75; margin-top: 8px; text-align: center; }

      /* glass bezel panel: hardware edge, not a drop shadow */
      .bezel { position: relative; overflow: hidden; border-radius: var(--r-lg);
        background: linear-gradient(180deg, var(--elev-2), var(--elev-1));
        border: 1px solid var(--border);
        box-shadow: var(--hairline-inset), 0 10px 26px var(--shadow-c); }
      .bezel::before { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
        background: linear-gradient(115deg, color-mix(in oklab, var(--edge-hi), transparent 60%) 0%, color-mix(in oklab, var(--edge-hi), transparent 92%) 26%, color-mix(in oklab, var(--edge-hi), transparent 100%) 46%);
        transform: translateX(var(--sweep, -18%)); transition: transform 180ms cubic-bezier(0.22,1,0.36,1); }
      .bezel:hover::before { --sweep: 18%; }
      /* screw heads at the panel corners */
      .bezel::after { content: ""; position: absolute; inset: 7px; pointer-events: none; border-radius: calc(var(--r-lg) - 5px);
        background:
          radial-gradient(circle 2.5px at 0 0, var(--border-hover) 60%, color-mix(in oklab, var(--border-hover), transparent 100%) 61%),
          radial-gradient(circle 2.5px at 100% 0, var(--border-hover) 60%, color-mix(in oklab, var(--border-hover), transparent 100%) 61%),
          radial-gradient(circle 2.5px at 0 100%, var(--border-hover) 60%, color-mix(in oklab, var(--border-hover), transparent 100%) 61%),
          radial-gradient(circle 2.5px at 100% 100%, var(--border-hover) 60%, color-mix(in oklab, var(--border-hover), transparent 100%) 61%);
        background-repeat: no-repeat; opacity: 0.7; }

      /* value tape */
      .tape { display: flex; flex-direction: column; align-items: center; }
      .tape-window { position: relative; width: 66px; height: 92px; overflow: hidden; border-radius: var(--r-sm);
        background: var(--well); box-shadow: var(--shadow-inset); }
      .tape-strip { display: flex; flex-direction: column; transition: transform 180ms cubic-bezier(0.22,1,0.36,1); }
      .tape-row { height: 18.4px; display: flex; align-items: center; justify-content: center;
        font-family: var(--font-ui); font-size: 12px; color: var(--muted2); font-variant-numeric: tabular-nums; }
      .tape-row.is-current { font-size: 17px; font-weight: 500; color: var(--accent); }
      .tape-box { position: absolute; left: 3px; right: 3px; top: 50%; height: 24px; transform: translateY(-50%);
        border-top: 1px solid var(--border-hover); border-bottom: 1px solid var(--border-hover); }

      /* progress arc */
      .arc { display: flex; flex-direction: column; align-items: center; position: relative; }
      .arc-track { stroke: var(--hairline); }
      .arc-fill { stroke: var(--cold); transition: stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1); }
      .arc-readout { position: absolute; top: 44%; transform: translateY(-50%);
        font-family: var(--font-mono); font-size: 20px; color: var(--text-1);
        font-variant-numeric: tabular-nums; }
      .arc-readout small { font-size: 12px; color: var(--text-3); }

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
      .radar { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .radar-you { fill: var(--text-1); }
      .radar-blip { fill: var(--blip); }
      /* Direction is not carried by colour alone: behind reads as an outline. */
      .radar-blip.is-behind { fill: none; stroke: var(--blip); stroke-width: 1.5; }
      .radar-contact:focus-visible { outline: 2px solid var(--warm); }
      .radar-ring { stroke: var(--hairline); stroke-width: 1; }

      .app.reduce-motion .bezel::before,
      .app.reduce-motion .tape-strip,
      .app.reduce-motion .arc-fill { transition: none; }
      .app.reduce-motion .flap-ch.is-flipping { animation: none; }
      @media (prefers-reduced-motion: reduce) {
        .bezel::before, .tape-strip, .arc-fill { transition: none; }
        .flap-ch.is-flipping { animation: none; }
      }
    `}</style>
  );
}
