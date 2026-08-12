import { useState, useRef, useEffect } from "react";

function Dial({ value, size = 96 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setDisplay(Math.round(start + (end - start) * p));
      if (p < 1) raf = requestAnimationFrame(step);
      else prevRef.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (display / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="7"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="var(--text)" fontSize="20" fontFamily="'Space Grotesk', sans-serif" fontWeight="600">
        {display}%
      </text>
    </svg>
  );
}

export default Dial;
