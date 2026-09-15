import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Av } from "./bits.jsx";
import { Back, Seat, Plane, Tick1 } from "./icons.jsx";
import { clock } from "../../../lib/roomModel.js";
import { dayName } from "../../../lib/rrModel.js";
import { ago } from "../../../lib/familiar.js";

/* ============================================================================
   THE RIGHT SEAT — the people you can fly with, as cards.
   -----------------------------------------------------------------------------
   Only squadron mates appear, and the server says so too: request_right_seat
   refuses anybody you do not share a squadron with (0022), so this list is the
   rule drawn, not the rule itself.

   WHEN A SEAT IS TAKEN the session sits above the cards: who, where each of you
   is, the Hobbs, the hour's warning, the partner's invite, and the session
   chat. None of that was in the design and all of it was already in the room,
   so it is drawn with the design's own parts rather than dropped.
   ========================================================================= */

function hobbs(from) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 60000));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function Session({ me, seat, who, myPlace, invite, onFollowInvite, onDismissInvite }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const idle = Math.round((Date.now() - Date.parse(seat.lastActiveAt)) / 60000);
  const them = who(seat.partnerId);
  return (
    <div className="rr-ctxcard">
      <h4 className="rr-micro">In the right seat · Hobbs {hobbs(seat.startedAt)}</h4>
      <div className="rr-faces">
        <Av id={me} name="You" size={38} />
        <Av id={seat.partnerId} name={them} size={38} />
      </div>
      <div className="rr-ctxnames">
        <b>You and {them}.</b> Both free to move, and neither of you follows the other.
        <br />You: {myPlace}
        <br />{them}: {seat.partnerPlace || "In the Ready Room"}{seat.partnerSince ? ` · ${ago(seat.partnerSince)}` : ""}
      </div>
      {idle >= 50 && (
        <div className="rr-draft">
          <div className="rr-mid">
            <b>Quiet for {idle} minutes</b>
            <span>Anything either of you does keeps the seat.</span>
          </div>
        </div>
      )}
      {invite && (
        <div className="rr-draft">
          <div className="rr-mid">
            <b>{them} opened {invite.label}</b>
            <span>Join them, or stay where you are.</span>
          </div>
          <button type="button" className="rr-linkbtn is-inline" onClick={onFollowInvite}>Join</button>
          <button type="button" className="rr-linkbtn is-inline" onClick={onDismissInvite}>Not now</button>
        </div>
      )}
    </div>
  );
}

function SessionChat({ me, seat, who, messages = [], draft = "", onDraft, onSend, onKeep }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, parseFloat(getComputedStyle(el).maxHeight) || 132)}px`;
  }, [draft]);
  const can = Boolean(draft.trim());
  const them = who(seat.partnerId);
  return (
    <div className="rr-ctxcard">
      <h4 className="rr-micro">Session chat</h4>
      <div className="rr-ctxnames">Cleared when the seat empties. Tap a line to keep it.</div>
      <div className="rr-seatlog">
        {messages.map((m) => (
          <button type="button" className="rr-oq" key={m.id} aria-pressed={Boolean(m.kept)}
                  onClick={() => onKeep(m.id, !m.kept)}>
            {m.body}
            <span className="rr-micro">
              {m.authorId === me ? "You" : them} · {clock(m.createdAt)} · {m.kept ? "Kept" : "Tap to keep"}
            </span>
          </button>
        ))}
        {!messages.length && <div className="rr-ctxnames">Say something and it lives until you land.</div>}
      </div>
      <div className="rr-cin">
        <div className="rr-cfield">
          <textarea ref={ref} rows={1} value={draft} placeholder={`Message ${them}`} aria-label={`Message ${them}`}
                    onChange={(e) => onDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (can) onSend(); } }} />
        </div>
        <button type="button" className="rr-send" data-idle={can ? "0" : "1"} disabled={!can}
                onClick={onSend} aria-label="Send"><Plane /></button>
      </div>
    </div>
  );
}

export default function Seats({
  me, seat = null, requests = { in: [], out: [] }, mates = [], flightLog = [], online = new Set(),
  squadrons = [], who, onBack, onAsk, onCancelAsk, onAnswer, onEnd, onProfile, session = {},
}) {
  const sharedName = (id) => squadrons.find(
    (s) => (s.members || []).includes(id) && (s.members || []).includes(me))?.name;
  const lastFlew = (id) => flightLog.find((f) => f.userId === id)?.lastAt || null;
  const asking = new Set(requests.in.map((r) => r.userId));
  const people = mates
    .filter((id) => id !== me && id !== seat?.partnerId && !asking.has(id))
    .sort((a, b) => (online.has(b) ? 1 : 0) - (online.has(a) ? 1 : 0)
      || String(lastFlew(b) || "").localeCompare(String(lastFlew(a) || ""))
      || who(a).localeCompare(who(b)));
  const sub = (id) => {
    if (online.has(id)) return `Online · ${sharedName(id) || "your squadron"}`;
    const flew = lastFlew(id);
    if (flew) return `Last flew ${dayName(flew)}`;
    return sharedName(id) || "In your squadron";
  };
  const face = (id, size = 44) => (
    <button type="button" className="rr-face is-inline" onClick={() => onProfile(id)} aria-label={`${who(id)}'s profile`}>
      <Av id={id} name={who(id)} size={size} />
    </button>
  );

  return (
    <>
      <div className="rr-phead">
        <button type="button" className="rr-iconbtn rr-backbtn is-inline" onClick={onBack} aria-label="Back"><Back /></button>
        <div className="rr-tt">
          <b>Right seat</b>
          <span>{seat ? `Flying with ${who(seat.partnerId)}` : "Squadron mates you can fly with"}</span>
        </div>
      </div>

      <div className="rr-seatgrid">
        {seat && (
          <div className="rr-seatwide">
            <Session me={me} seat={seat} who={who} myPlace={session.myPlace} invite={session.invite}
                     onFollowInvite={session.onFollowInvite} onDismissInvite={session.onDismissInvite} />
            <SessionChat me={me} seat={seat} who={who} messages={session.messages} draft={session.draft}
                         onDraft={session.onDraft} onSend={session.onSend} onKeep={session.onKeep} />
          </div>
        )}

        {requests.in.map((r) => (
          <div className="rr-seatcard" key={r.id}>
            {face(r.userId)}
            <div><b>{who(r.userId)}</b><span>Wants the right seat · {sharedName(r.userId) || "your squadron"}</span></div>
            <button type="button" className="rr-go is-inline" onClick={() => onAnswer(r.id, true)}><Seat /> Take the right seat</button>
            <button type="button" className="rr-go is-inline" onClick={() => onAnswer(r.id, false)}>Not now</button>
          </div>
        ))}

        {seat && (
          <div className="rr-seatcard">
            {face(seat.partnerId)}
            <div><b>{who(seat.partnerId)}</b><span>In the right seat · {seat.partnerPlace || "In the Ready Room"}</span></div>
            <button type="button" className="rr-go is-inline" onClick={onEnd}>End the right seat</button>
          </div>
        )}

        {people.map((id) => {
          const asked = requests.out.some((r) => r.userId === id);
          return (
            <div className="rr-seatcard" key={id}>
              {face(id)}
              <div><b>{who(id)}</b><span>{sub(id)}</span></div>
              {asked ? (
                <button type="button" className="rr-go is-inline" onClick={() => onCancelAsk(id)}><Tick1 /> Asked — waiting</button>
              ) : (
                <button type="button" className="rr-go is-inline" disabled={Boolean(seat)}
                        title={seat ? "End the right seat first" : undefined}
                        onClick={() => onAsk(id)}><Seat /> Take the right seat</button>
              )}
            </div>
          );
        })}

        {!people.length && !seat && !requests.in.length && (
          <div className="rr-dempty">Join a squadron and the people in it appear here.</div>
        )}
      </div>
    </>
  );
}
