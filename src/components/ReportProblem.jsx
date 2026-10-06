import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useUser } from "../lib/clerk.js";
import { reportContent } from "../lib/squadron.js";

/* Only ever needed after a press — see its own header. */
const ReportAsk = lazy(() => import("./ReportAsk.jsx"));

/* THE PILL IN THE CORNER, and what pressing it is for.
   -----------------------------------------------------------------------------
   It already knew WHERE a student was — the route, the viewport and the device
   go with every report, so nobody has to describe the page they are looking at.
   What it never asked was WHAT was wrong (owner, 2026-10-06: "should mean
   something when pressed"), so three reports reached the table saying only that
   somebody somewhere was unhappy with /account/appearance. A route with no
   sentence is a bug report you cannot act on.

   SO IT ASKS, AND THE ANSWER IS OPTIONAL. One line, pre-focused, Send. Sending
   nothing still sends — a student who taps the pill and cannot put words to it
   has still told you the page is wrong, and refusing that would lose the
   report this feature was built for. The placeholder says the route is already
   attached so nobody wastes their sentence describing it.

   IT IS A LAST RESORT BY DESIGN, so it never blocks the page: Escape closes
   it, the scrim is a click-away, and nothing about it is required.
   ========================================================================= */
export default function ReportProblem({ route, extra = null }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const { user } = useUser();
  /* One timer, restarted per report. Two reports four seconds apart used to
     leave two running, and the FIRST one's expiry cleared the second's
     confirmation early — so the second report looked like it had not been
     taken. Cleared on unmount too, since it outlives the route otherwise. */
  const clearAt = useRef(null);
  useEffect(() => () => clearTimeout(clearAt.current), []);


  const send = () => {
    const said = note.trim();
    const report = {
      at: new Date().toISOString(),
      said: said || null,
      route,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ua: navigator.userAgent,
      ...extra,
    };
    /* The sink is the `reports` table, which has existed since 0005.
       target_type is 'route' rather than 'message' — this is the broken-page
       report, not content moderation, and the two share a table but not a
       meaning. The whole context goes in `reason` because that is the column
       that takes free text, and the context IS the report here. `said` is
       first in the object so an admin reading raw rows sees the sentence
       before the user agent. */
    reportContent({
      reporterId: user?.id || "anonymous",
      targetType: "route",
      targetId: String(route || "unknown"),
      reason: JSON.stringify(report),
    });
    setOpen(false);
    setNote("");
    setSent(true);
    clearTimeout(clearAt.current);
    clearAt.current = setTimeout(() => setSent(false), 4000);
  };

  return (
    <>
      {/* `data-diff-ignore`: it is fixed to the corner of every screen, so a
          visual diff against a design that does not have it reports the pill
          as a difference on every page. scripts/visual-diff.mjs hides anything
          carrying this attribute on BOTH sides, so what it changes is what the
          comparison looks at, never what a student sees. */}
      <button type="button" className="rpt" data-diff-ignore="" aria-live="polite"
              aria-expanded={open} onClick={() => (sent ? null : setOpen((v) => !v))}>
        {sent ? "Thanks — noted where you were." : "Something's wrong here"}
      </button>

      {open && (
        <Suspense fallback={null}>
          <ReportAsk note={note} onNote={setNote} onSend={send} onClose={() => setOpen(false)} />
        </Suspense>
      )}

      <style>{`
        /* OPAQUE, because it is fixed and the page scrolls underneath it.
           With background: none the module screen's chapter rows ran straight
           through the pill — "Something's wrong here" and "2 lessons · 1 quiz"
           interleaved letter by letter and neither could be read. --ground is
           the one surface token with no alpha, so it follows every livery and
           finish while still stopping the text behind it. --drop lifts it off
           the page in the finishes that cast one, and is none in Manual. */
        .rpt { position: fixed; left: 12px; bottom: 12px; z-index: 55;
          background: var(--ground); box-shadow: var(--drop, none);
          border: 1px solid var(--line); color: var(--t3);
          border-radius: 999px; padding: 9px 15px; font-family: inherit;
          font-size: var(--fs-xs, 13px); cursor: pointer; min-height: var(--tap, 44px); }
        .rpt:hover { color: var(--t1); }

      `}</style>
    </>
  );
}
