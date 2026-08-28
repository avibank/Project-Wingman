import { useState } from "react";

// One tap, and it carries the route and the state with it. The point is that
// a student never has to describe where they were — the report already knows,
// and "it's broken" with a route attached is worth more than a paragraph
// without one.
export default function ReportProblem({ route, extra }) {
  const [sent, setSent] = useState(false);

  const send = () => {
    const report = {
      at: new Date().toISOString(),
      route,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
      ...extra,
    };
    // There is no destination yet, and inventing one would be worse than
    // saying so. It goes to the console until a sink exists — the shape is
    // what matters now, and the shape is what will be posted.
    console.info("Problem report", report);
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <>
      <button type="button" className="rpt" onClick={send} aria-live="polite">
        {sent ? "Thanks — noted where you were." : "Something's wrong here"}
      </button>
      <style>{`
        .rpt { position: fixed; left: 12px; bottom: 12px; z-index: 55;
          background: none; border: 1px solid var(--line); color: var(--t3);
          border-radius: 999px; padding: 9px 15px; font-family: inherit;
          font-size: var(--fs-xs, 13px); cursor: pointer; min-height: var(--tap, 44px); }
        .rpt:hover { color: var(--t1); }
      `}</style>
    </>
  );
}
