import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { blockUser, muteUser, reportContent } from "../lib/squadron.js";
import Tail, { TailStyles } from "./Tail.jsx";

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

function PilotSheet({ pilot, chapterId, channelId, onClose, onChanged }) {
  const { user } = useUser();
  const [mode, setMode] = useState("menu");   // menu | report | confirm-block
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  if (!pilot) return null;
  const name = pilot.callsign || pilot.display_name || "This pilot";

  const run = async (fn, message) => {
    setBusy(true);
    try { await fn(); setDone(message); onChanged?.(); }
    catch (e) { console.error(e); setDone("That didn't go through. Try again in a moment."); }
    setBusy(false);
  };

  return (
    <div className="ps" role="dialog" aria-label={`Options for ${name}`}>
      <button className="ps-scrim" onClick={onClose} aria-label="Close" />
      <div className="ps-sheet">
        <div className="ps-head">
          <Tail name={name} livery={pilot.livery} marking={pilot.marking} size={44} staff={pilot.is_staff} />
          <span className="ps-name">{name}</span>
        </div>

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
              suggestions, and you disappear from theirs. You can undo it in Settings.
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
                  reason, chapterId, channelId,
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
        .ps-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / 0.45); border: none; padding: 0; }
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
