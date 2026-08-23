// §9.1.2 — a round dial answers "how close to a limit?", so it needs a redline.
// Score has one; progress does not, which is why progress is a bar. One dial on
// screen, ever.
//
// It is also the door to the Logbook — a second job for one object, and how the
// Logbook finally gets out of the avatar menu.

const SIZE = 48;
const STROKE = 3;

function ScoreDial({ pct, pass = 75, onOpen }) {
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const START = -120, SWEEP = 240;
  const arc = c * (SWEEP / 360);
  const has = typeof pct === "number";
  const value = has ? Math.max(0, Math.min(100, pct)) : 0;
  const cx = SIZE / 2;
  const markAngle = ((START + (pass / 100) * SWEEP - 90) * Math.PI) / 180;

  return (
    <button className="dial" onClick={onOpen} aria-label={
      has ? `Average score ${Math.round(value)} percent, pass mark ${pass}. Open the Logbook.`
          : "Open the Logbook"}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth={STROKE} className="dial-track"
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round"
          transform={`rotate(${90 + START} ${cx} ${cx})`} />
        {has && (
          <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth={STROKE} className="dial-fill"
            strokeDasharray={`${arc * (value / 100)} ${c}`} strokeLinecap="round"
            transform={`rotate(${90 + START} ${cx} ${cx})`} />
        )}
        {/* the redline: the pass mark, which is the whole reason this is a dial */}
        <line className="dial-redline"
          x1={cx + Math.cos(markAngle) * (r - STROKE)} y1={cx + Math.sin(markAngle) * (r - STROKE)}
          x2={cx + Math.cos(markAngle) * (r + STROKE)} y2={cx + Math.sin(markAngle) * (r + STROKE)} />
      </svg>
      {/* §5 — every instrument carries a plain numeric readout */}
      <span className="dial-readout">{has ? `${Math.round(value)}%` : "Score"}</span>

      <style>{`
        .dial { position: relative; display: grid; place-items: center; width: ${SIZE}px; height: ${SIZE}px;
          background: none; border: none; padding: 0; cursor: pointer; flex-shrink: 0; }
        .dial svg { position: absolute; inset: 0; }
        .dial-track { stroke: var(--hairline-bevel); }
        .dial-fill { stroke: var(--accent-interactive); transition: stroke-dasharray 600ms cubic-bezier(0.22,1,0.36,1); }
        .dial-redline { stroke: var(--text-secondary); stroke-width: 2; }
        .dial-readout { position: relative; font-family: var(--font-mono); font-size: 12px;
          color: var(--text-primary); font-variant-numeric: tabular-nums; }
        @media (prefers-reduced-motion: reduce) { .dial-fill { transition: none; } }
      `}</style>
    </button>
  );
}

export default ScoreDial;
