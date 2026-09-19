import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import LicenceCard from "./licence/LicenceCard.jsx";
import { fetchCard, statsOf } from "../lib/licence.js";
import { stampOf } from "../lib/stamp.js";
import { blockUser, muteUser, reportContent } from "../lib/squadron.js";
import Tail, { TailStyles } from "./Tail.jsx";
import { ERROR_GENERIC } from "../lib/copy.js";

// §9 — every user can block, mute and report, so those controls need one home
// that every tail in the app opens. Blocking is symmetric and total; the copy
// says so plainly rather than implying it only hides them from you.

const REASONS = [
  "Harassment or abuse",
  "Spam or advertising",
  "Sexual or graphic content",
  "Sharing exam material",
  "Something else",
];

/* `chapterId` used to be a third field on the report and no call site has ever
   passed it — this sheet opens from the room, the crew and the route strip,
   none of which is inside a chapter. It went rather than being passed as null
   from four places. `channelId` still carries where the report came from. */
function PilotSheet({ pilot, channelId, onClose, onChanged,
                     mates = false, onInvite, onSeat, onChat }) {
  const { user } = useUser();
  const [mode, setMode] = useState("menu");   // menu | report | confirm-block
  /* §5 — "tapping any face or stamp anywhere opens this card for that person
     in a dialog". It is the SAME component the owner edits on their licence,
     with edit off, so what a stranger sees cannot drift from what its owner
     was shown. The safety controls stay underneath: this sheet was the one
     home for block, mute and report, and it still is.

     Null while it loads, and null for good if 0030's function returns no row
     — a pilot flying solo, or a block either way. The sheet then shows what
     it always showed, which is the truthful thing: there is no card. */
  const [card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    setCard(null);
    if (!user?.id || !pilot?.user_id) return undefined;
    fetchCard(user.id, pilot.user_id).then((row) => { if (live) setCard(row); });
    return () => { live = false; };
  }, [user?.id, pilot?.user_id]);
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (!pilot) return null;
  const name = pilot.callsign || pilot.display_name || "This pilot";

  const run = async (fn, message) => {
    setBusy(true);
    try { await fn(); setDone(message); onChanged?.(); }
    catch (e) { console.error(e); setDone(ERROR_GENERIC); }
    setBusy(false);
  };

  return (
    <div className="ps" role="dialog" aria-label={`Options for ${name}`}>
      <button className="ps-scrim" onClick={onClose} aria-label="Close" />
      <div className="ps-sheet">
        {card ? (
          /* The card IS the head when there is one: a second name and face
             above it would be the same person said twice. */
          <LicenceCard
            profile={card}
            stats={statsOf(card)}
            stamp={stampOf(card)}
            admin={card.is_staff}
            action={(
              /* §5's actions, and which pair you get depends on whether you
                 are already squadron mates. A control that cannot do anything
                 is not drawn: no handler, no button. */
              mates ? (
                <div className="ps-acts">
                  {onSeat && (
                    <button type="button" className="pill pri inv" onClick={() => onSeat(card.user_id)}>
                      Invite to right seat
                    </button>
                  )}
                  {onChat && (
                    <button type="button" className="pill inv" onClick={() => onChat(card.user_id)}>
                      Squadron chat
                    </button>
                  )}
                </div>
              ) : (onInvite ? (
                <button type="button" className="pill pri inv" onClick={() => onInvite(card.user_id)}>
                  Invite to squadron
                </button>
              ) : null)
            )}
          />
        ) : (
        <div className="ps-head">
          <Tail name={name} marking={pilot.marking} size={44} staff={pilot.is_staff} />
          <span className="ps-name">{name}</span>
        </div>
        )}

        {done ? (
          <>
            <p className="ps-note">{done}</p>
            <button className="ps-row ps-row--primary" onClick={onClose}>Done</button>
          </>
        ) : mode === "menu" ? (
          <ul className="ps-list">
            <li>
              <button className="ps-row" disabled={busy}
                onClick={() => run(() => muteUser(user.id, pilot.user_id), `You won't see ${name} in Comms.`)}>
                <span className="ps-row-label">Mute in Comms</span>
                <span className="ps-row-hint">Their messages stop showing. They aren't told.</span>
              </button>
            </li>
            <li>
              <button className="ps-row" disabled={busy} onClick={() => setMode("confirm-block")}>
                <span className="ps-row-label">Block</span>
                <span className="ps-row-hint">You disappear from each other everywhere.</span>
              </button>
            </li>
            <li>
              <button className="ps-row" disabled={busy} onClick={() => setMode("report")}>
                <span className="ps-row-label">Report</span>
                <span className="ps-row-hint">Goes to a person, usually within a day.</span>
              </button>
            </li>
          </ul>
        ) : mode === "confirm-block" ? (
          <>
            <p className="ps-note">
              Blocking is symmetric: {name} disappears from your presence, feed, Comms and
              suggestions, and you disappear from theirs. You can undo it in Preferences.
            </p>
            <button className="ps-row ps-row--danger" disabled={busy}
              onClick={() => run(() => blockUser(user.id, pilot.user_id), `${name} is blocked.`)}>
              Block {name}
            </button>
            <button className="ps-row" onClick={() => setMode("menu")}>Back</button>
          </>
        ) : (
          <>
            <p className="ps-note">What's happening? A person reads every report.</p>
            <ul className="ps-list">
              {REASONS.map((r) => (
                <li key={r}>
                  <button className={`ps-row ${reason === r ? "is-picked" : ""}`}
                    aria-pressed={reason === r} onClick={() => setReason(r)}>
                    <span className="ps-row-label">{r}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="ps-row ps-row--primary" disabled={!reason || busy}
              onClick={() => run(
                () => reportContent({
                  reporterId: user.id, targetType: "user", targetId: pilot.user_id,
                  reason, channelId,
                }),
                "Sent. Someone will look at this."
              )}>
              {busy ? "Sending…" : "Send report"}
            </button>
            <button className="ps-row" onClick={() => setMode("menu")}>Back</button>
          </>
        )}
      </div>

      <TailStyles />
      <style>{`
        .ps { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; }
        .ps-scrim { position: absolute; inset: 0; background: color-mix(in oklab, var(--ground), transparent 25%); border: none; padding: 0; }
        .ps-sheet { position: relative; width: 100%; max-width: 640px; margin: 0 auto;
          background: var(--surface-1); border-radius: 12px 12px 0 0;
          padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); }
        .ps-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .ps-name { font-family: var(--font-ui); font-size: 17px; color: var(--text-1); }
        .ps-note { font-size: 14px; line-height: 1.55; color: var(--text-2); margin: 0 0 16px; }

        .ps-list { list-style: none; margin: 0 0 12px; padding: 0;
          display: grid; gap: 1px; background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .ps-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%;
          min-height: 56px; padding: 10px 16px; background: var(--surface-2); border: none;
          text-align: left; cursor: pointer; color: var(--text-1); font-size: 16px;
          border-radius: 12px; margin-bottom: 8px; justify-content: center; }
        .ps-list .ps-row { border-radius: 0; margin: 0; background: var(--surface-1); }
        .ps-list .ps-row:hover { background: var(--surface-2); }
        .ps-row.is-picked { box-shadow: inset 3px 0 0 var(--warm); background: var(--surface-2); }
        .ps-row:disabled { color: var(--text-3); cursor: default; }
        .ps-row-label { font-size: 16px; }
        .ps-row-hint { font-size: 14px; color: var(--text-3); }
        .ps-row--primary { background: var(--warm); color: var(--surface-0); align-items: center; }
        .ps-row--primary:disabled { background: var(--surface-2); color: var(--text-3); }
        /* §14 — red is for genuine danger. Blocking someone qualifies. */
        .ps-row--danger { color: var(--bad); align-items: center; }
      `}</style>
    </div>
  );
}

export default PilotSheet;
