function WindsockIcon({ size = 21, active }) {
  return (
    <svg className={`sock ${active ? "is-active" : ""}`} width={size} height={size * (19 / 21)}
         viewBox="0 0 24 22" fill="none" aria-hidden="true">
      <path d="M3.2 1.5v19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".65" />
      <g className="sockbody">
        <path d="M4 5.2 10.4 6.4 10.4 12.6 4 13.8Z" fill="currentColor" opacity=".9" />
        <path d="M10.4 6.4 15.2 7.3 15.2 11.7 10.4 12.6Z" fill="currentColor" opacity=".45" />
        <path d="M15.2 7.3 19.4 8.1 19.4 10.9 15.2 11.7Z" fill="currentColor" opacity=".85" />
        <path d="M19.4 8.1 22.6 8.7 22.6 10.3 19.4 10.9Z" fill="currentColor" opacity=".35" />
      </g>
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
