import { useEffect, useState } from "react";
import { squadronByInvite, joinSquadron, headcountLine } from "../../lib/discovery.js";

/* §6 — WHERE AN INVITE LINK LANDS.
 *
 * The route that carries most of the growth: a classmate pastes
 * wingman.institute/j/<token> into the group chat they already have. So this
 * screen has one job and says one thing.
 *
 * EVERY REFUSAL IS ITS OWN SENTENCE, because "something went wrong" on the
 * first screen a new student ever sees is the worst possible first screen. The
 * one exception is a revoked or expired token, which says the same thing as a
 * token that never existed: a link that says "this was revoked" confirms to a
 * stranger that the room is real.
 */
const COPY = {
  ok:         { line: null },
  already_in: { line: "You're already in here — open it from the rail." },
  full:       { line: "This squadron is full. Ask whoever sent the link to make room, or find another." },
  unavailable:{ line: "This link isn't available to you." },
  missing:    { line: "This link doesn't work any more. Ask for a new one — they can send another from the squadron." },
};

export default function InviteLanding({ me, token, onEnter, onFindInstead }) {
  const [state, setState] = useState("loading");
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    squadronByInvite(me, token).then((r) => {
      if (!live) return;
      setRoom(r);
      setState(r ? r.state : "missing");
    });
    return () => { live = false; };
  }, [me, token]);

  if (state === "loading") {
    return (
      <div className="invite-land">
        <p className="invite-quiet">Opening the link…</p>
      </div>
    );
  }

  const copy = COPY[state] || COPY.missing;

  return (
    <div className="invite-land">
      <p className="eyebrow">You were invited</p>
      <h1 className="invite-name">{room?.name || "A squadron"}</h1>
      {room?.blurb && <p className="invite-blurb">{room.blurb}</p>}
      {typeof room?.members === "number" && (
        /* Never a fraction, here least of all: this is the first impression a
           room makes, and "8 of 32" makes a squadron look like a failure. */
        <p className="invite-meta">{headcountLine(room.members, 0)}</p>
      )}

      {state === "ok" ? (
        <button type="button" className="join" disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  /* Same door as every other route in. The link cannot bypass
                     capacity or a block, so this can still come back "full" —
                     between loading the page and pressing the button, somebody
                     else may have taken the last seat. */
                  const outcome = await joinSquadron(me, room.id);
                  setBusy(false);
                  if (outcome === "joined" || outcome === "already_in") onEnter?.(room);
                  else setState(outcome);
                }}>
          {busy ? "Joining…" : "Join this squadron"}
        </button>
      ) : (
        <>
          <p className="invite-quiet">{copy.line}</p>
          <button type="button" className="join sec" onClick={onFindInstead}>
            {state === "already_in" ? "Open the Ready Room" : "Find a squadron instead"}
          </button>
        </>
      )}
    </div>
  );
}
