/* =============================================================================
   CREW ON THE QUIZ — who has sat this batch's paper, as their own stamps.
   -----------------------------------------------------------------------------
   §5 of the handoff, and it is what REPLACES the Crew tab: "Who's on this
   module now lives only as the quiz attempt stamps on each batch row."

   THE STAMPS ARE THE REAL ONES. The demo draws a placeholder (`miniStamp`, a
   cog ring with a three-character code and a hue), and §3.2 is explicit that
   on live "every stamp in the attempt strip and its pop-out must be THAT
   STUDENT'S REAL STAMP exactly as Wingman renders it on their Licence — same
   component, same design, same ink colour, just scaled". So this draws
   `<Stamp>`, the app's one renderer, at the demo's two sizes: 26px on the row
   and 44px in the pop-out. The demo's layout, its −9px overlap, its drop
   shadow, its hover spread and its fan-in are the stylesheet's and untouched.

   THE ORDER AND THE TOTAL ARE THE SERVER'S (migration 0038). `quiz_finishers`
   groups runs into people, pins the CALLER first and then orders by recency,
   and counts the whole quiz rather than the capped page. That matters here for
   a reason CLAUDE.md states: a cap applied in the client would have dropped
   the student's own stamp off the end.

   THE PHONE'S CAP IS THE ONE THING SLICED HERE, and it is safe for the same
   reason. §5 asks for 11 on desktop and tablet, 6 on a phone; the fetch is one
   call for the whole tab at the larger cap, so the smaller one is a slice of a
   list that already has the student first. `+N` still counts off the server's
   total, so it never reads as if people had gone missing.

   THE POP-OUT ASKS AGAIN, FOR EVERYBODY. §5 is specific: the strip shows up to
   eleven and then `+N`, but opening it "fans in EVERY stamp". The tab's one
   call is capped at eleven — it is drawing four rows at once and a whole class
   per row is not worth downloading before anybody has asked — so the pop-out
   fetches that one quiz uncapped when it opens, and shows the strip's eleven
   until the rest arrive. It is asked once per quiz and kept.

   ATTEMPTED ONLY — no scores, no pass or fail. The row has a score on the quiz
   thumbnail already, and that one is the student's own.
   ========================================================================= */
import { useEffect, useState } from "react";
import Stamp from "../../Stamp.jsx";
import { stampOf } from "../../../lib/stamp.js";
import { fetchFinishers } from "../../../lib/board.js";
import { tilt } from "../Leaderboard.jsx";

export const ROW_STAMP_PX = 26;
export const POP_STAMP_PX = 44;
export const PHONE_CAP = 6;

const phone = () => (typeof matchMedia === "function" && matchMedia("(max-width:620px)").matches);

function Mini({ person, size, i }) {
  return (
    <Stamp stamp={stampOf(person.profile)} size={size}
           rot={tilt(i) + (i % 2 ? 1 : -1)}
           on={Boolean(person.profile?.stamp_issued_at)} />
  );
}

/* THE POP-OUT. The demo builds it with `document.createElement` and appends it
   to the row, then adds `.show` on the next frame so the fan-in has a state to
   transition from. Rendered rather than appended here, with the same one-frame
   gap — without it the whole grid is already in place when the class lands and
   nothing fans. */
function CrewPop({ people, onProfile }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={`crewpop ${shown ? "show" : ""}`} role="dialog"
         aria-label="Who has sat this quiz">
      <div className="crewgrid">
        {people.map((p, k) => (
          <button key={p.userId} className="cp" style={{ "--i": k }} type="button"
                  onClick={() => onProfile?.(p)}
                  aria-label={`Open ${p.isYou ? "your" : `${p.callsign}'s`} profile`}>
            <Mini person={p} size={POP_STAMP_PX} i={k} />
            <span>{p.isYou ? "You" : p.callsign}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Enough for any class, and still a ceiling rather than "everybody in the
   database" — `quiz_finishers` is one quiz's attempts, so this is the size of a
   cohort, not of the site. */
export const POP_CAP = 400;

export default function CrewStrip({ found, me = null, quizId = null, open = false, onToggle, onProfile }) {
  const [all, setAll] = useState(null);
  useEffect(() => {
    if (!open || all || !me || !quizId) return undefined;
    /* Already complete: the capped page WAS everybody. */
    if (found && (found.total || 0) <= (found.people || []).length) { setAll(found.people); return undefined; }
    let live = true;
    fetchFinishers({ me, quizIds: [quizId], cap: POP_CAP })
      .then((got) => { if (live) setAll(got?.[quizId]?.people || null); })
      .catch(() => {});
    return () => { live = false; };
  }, [open, all, me, quizId, found]);

  const people = found?.people || [];
  const [narrow, setNarrow] = useState(phone);
  /* The cap changes with the window, and the demo reads it at render time with
     a matchMedia check. Watched rather than read once, so turning a phone does
     not leave eleven stamps on a 390px row. */
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const mq = matchMedia("(max-width:620px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  /* NOBODY YET: the demo's dashed circle, and NOT the demo's words.
     Its title is "No one has sat this quiz yet", and §10 of this app forbids
     naming an absence — "every empty state names its next action inside the
     sentence". The same decision was already taken for the old shelves' line
     (CLAUDE.md: a quiz nobody has sat says "Be the first to take it"), so it is
     taken the same way here. The circle, which is the approved picture, is the
     demo's exactly, and it is not a button. */
  if (!people.length) {
    return (
      <span className="crew none" title="Be the first to take it">
        <span className="ghoststamp" />
      </span>
    );
  }

  const cap = narrow ? PHONE_CAP : people.length;
  const shownPeople = people.slice(0, cap);
  const total = found?.total || people.length;
  const more = Math.max(0, total - shownPeople.length);

  return (
    <>
      <button className="crew" type="button" aria-expanded={open}
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              aria-label={`${total} ${total === 1 ? "person has" : "people have"} sat this quiz. Show them`}>
        {shownPeople.map((p, k) => (
          <span className="cs" style={{ "--i": k }} key={p.userId}
                title={p.isYou ? `${p.callsign} (you)` : p.callsign}>
            <Mini person={p} size={ROW_STAMP_PX} i={k} />
          </span>
        ))}
        {more > 0 && <span className="cmore">+{more}</span>}
      </button>
      {open && <CrewPop people={all || people} onProfile={onProfile} />}
    </>
  );
}
