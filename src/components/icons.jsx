import { Award } from "lucide-react";

function WindsockIcon({ size = 20, active }) {
  const activePath = "M2 5 L22 3 L18 7 L24 7 L18 11 L22 15 L2 13 Z";
  const idlePath = "M2 6 L18 6 L13 9 L18 11 L13 14 L18 16 L2 12 Z";
  const clipId = active ? "sockClipActive" : "sockClipIdle";
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 26 18" className={`windsock ${active ? "is-active" : "is-idle"}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={active ? activePath : idlePath} />
        </clipPath>
      </defs>
      {active ? (
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="26" height="18" fill="#fff" />
          <rect x="0" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="8" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="16" y="0" width="4" height="18" fill="#E5844D" />
          <rect x="24" y="0" width="4" height="18" fill="#E5844D" />
        </g>
      ) : (
        <path d={idlePath} fill="var(--muted2)" opacity="0.6" />
      )}
      <line x1="1" y1="0" x2="1" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// Rank shown as epaulette-style stripes (and a star at the top rank) instead of a text label
function RankInsignia({ stripes = 1, gold = false, size = 14 }) {
  return (
    <span className="rank-insignia">
      <span className="rank-stripes">
        {Array.from({ length: stripes }).map((_, i) => (
          <span key={i} className={`rank-stripe ${gold ? "is-gold" : ""}`} />
        ))}
      </span>
      {gold && <Award size={size} className="rank-star" fill="currentColor" />}
      <style>{`
        .rank-insignia { display: inline-flex; align-items: center; gap: 4px; }
        .rank-stripes { display: inline-flex; flex-direction: column; gap: 2px; }
        .rank-stripe { display: block; width: 16px; height: 3px; background: var(--accent); border-radius: 1px; }
        .rank-stripe.is-gold { background: #D4AF37; }
        .rank-star { color: #D4AF37; }
      `}</style>
    </span>
  );
}

function Placard({ children }) {
  return (
    <span className="placard">
      {children}
      <style>{`
        .placard {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          border-radius: 3px;
          background: var(--accent-soft);
          color: var(--accent);
          border: 1px solid var(--border-hover);
          text-transform: uppercase;
        }
      `}</style>
    </span>
  );
}

export { WindsockIcon, RankInsignia, Placard };
