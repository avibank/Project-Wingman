function WindsockIcon({ size = 20, active }) {
  const activePath = "M2 5 L22 3 L18 7 L24 7 L18 11 L22 15 L2 13 Z";
  const idlePath = "M2 6 L18 6 L13 9 L18 11 L13 14 L18 16 L2 12 Z";
  const path = active ? activePath : idlePath;
  const clipId = active ? "sockClipActive" : "sockClipIdle";
  const base = active ? "var(--text)" : "var(--border-hover)";
  const stripe = active ? "var(--accent)" : "var(--border)";
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 26 18" className={`windsock ${active ? "is-active" : "is-idle"}`}>
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="26" height="18" fill={base} />
        <rect x="0" y="0" width="4" height="18" fill={stripe} />
        <rect x="8" y="0" width="4" height="18" fill={stripe} />
        <rect x="16" y="0" width="4" height="18" fill={stripe} />
        <rect x="24" y="0" width="4" height="18" fill={stripe} />
      </g>
      <line x1="1" y1="0" x2="1" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Placard({ children }) {
  return (
    <span className="placard">
      {children}
      <style>{`
        .placard {
          font-family: var(--font-ui);
          font-size: 12px;
          padding: 2px 7px;
          border-radius: 6px;
          background: var(--accent-soft);
          color: var(--accent);
          border: 1px solid var(--border-hover);
        }
      `}</style>
    </span>
  );
}

export { WindsockIcon, Placard };
