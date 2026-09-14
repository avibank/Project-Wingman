/* One drawing per empty card, same pen, different subject. */
const PATHS = {
  seat: (
    <>
      <rect x="5" y="15" width="13" height="16" rx="3.5" />
      <rect x="22" y="15" width="13" height="16" rx="3.5" strokeDasharray="3 3" />
      <path d="M4 31.5h32" />
    </>
  ),
  squad: (
    <>
      <circle cx="13.5" cy="16" r="6" />
      <circle cx="26.5" cy="16" r="6" />
      <circle cx="20" cy="27" r="6" strokeDasharray="3 3" />
    </>
  ),
  thread: (
    <>
      <path d="M6.5 10.5h27a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H17l-6.5 5.5V25.5H6.5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z" />
      <path d="M11 16h18M11 20.5h10" />
    </>
  ),
};

export function Motif({ kind }) {
  return (
    <svg className="bog-motif" viewBox="0 0 40 40" fill="none" stroke="var(--t3)"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[kind]}
    </svg>
  );
}
