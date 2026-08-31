import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { reportContent } from "../lib/squadron.js";

// One tap, and it carries the route and the state with it. The point is that
// a student never has to describe where they were — the report already knows,
// and "it's broken" with a route attached is worth more than a paragraph
// without one.
// extra is optional enrichment — a default says so, rather than looking like a
// prop every call site forgot to pass.
export default function ReportProblem({ route, extra = null }) {
  const [sent, setSent] = useState(false);
  const { user } = useUser();
  // One timer, restarted per report. Two reports four seconds apart used to
  // leave two running, and the FIRST one's expiry cleared the second's
  // confirmation early — so the second report looked like it had not been
  // taken. Cleared on unmount too, since it outlives the route otherwise.
  const clearAt = useRef(null);
  useEffect(() => () => clearTimeout(clearAt.current), []);

  const send = () => {
    const report = {
      at: new Date().toISOString(),
      route,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
      ...extra,
    };
    // The sink is the `reports` table, which has existed since 0005. This said
    // "there is no destination yet" and went to the console, which meant the
    // button was honest about its shape and dishonest about its effect: it
    // says "noted where you were" to the student, and nothing was noted
    // anywhere anyone would ever look.
    //
    // target_type is 'route' rather than 'message' — this is the broken-page
    // report, not content moderation, and the two share a table but not a
    // meaning. The whole context goes in `reason` because that is the column
    // that takes free text, and the context IS the report here.
    reportContent({
      reporterId: user?.id || "anonymous",
      targetType: "route",
      targetId: String(route || "unknown"),
      reason: JSON.stringify(report),
    });
    setSent(true);
    clearTimeout(clearAt.current);
    clearAt.current = setTimeout(() => setSent(false), 4000);
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
