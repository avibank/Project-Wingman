import { useEffect, useState } from "react";
import {
  ChevronLeft, Radio, Users, Zap, MessageSquare, Eye, Check, X, Pin,
} from "lucide-react";
import { Face, Composer } from "./bits.jsx";
import { ago } from "../../lib/familiar.js";
import { when } from "../../lib/roomModel.js";

/* ============================================================================
   §4d · THE RIGHT SEAT — its own thing, and deliberately not a third chat.

   The person is your COPILOT; the position is the RIGHT SEAT. Both names are
   kept because they answer different questions: who, and where.

   WHAT MAKES IT DIFFERENT FROM THE OTHER TWO SCREENS. A squadron is many
   people and no state. A module is no people and permanent state. The right
   seat is exactly one person and state that expires: you are both free to move
   anywhere in the app, the screen says where the other one is, and when they
   open something a bubble invites you rather than dragging you.

   NOBODY IS EVER FOLLOWED. There is no "join their screen". There is an invite
   and a button, and the button is yours to press.

   THE HOUR. A seat nobody has touched for an hour empties itself, with a
   warning first. That is the server's rule (expire_right_seats) and this
   screen only reports it — a countdown drawn from a timestamp the client owns
   would disagree with the server the moment a tab slept.
   ========================================================================= */

function elapsed(from) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 60000));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default function RightSeatPane({
  me, seat, requests = { in: [], out: [] }, candidates = [], squadrons = [],
  seatMessages = [], seatDraft, onSeatDraft, onSendSeat, onKeep,
  myPlace, invite, onDismissInvite, onFollowInvite,
  onAsk, onCancelAsk, onAnswer, onEnd, onBack, onProfile, who,
}) {
  const [tab, setTab] = useState("where");
  const [tick, setTick] = useState(0);

  /* The Hobbs reads in minutes, so it only has to move once a minute. */
  useEffect(() => {
    if (!seat) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [seat]);
  void tick;

  const idleMins = seat ? Math.round((Date.now() - Date.parse(seat.lastActiveAt)) / 60000) : 0;
  const sharedName = (id) => squadrons.find(
    (s) => (s.members || []).includes(id) && (s.members || []).includes(me))?.name;

  return (
    <>
      <header className="pane-head">
        <button type="button" className="icon-btn is-inline back" onClick={onBack} aria-label="Back">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="h-id">
          <h2 className="h-title">Right seat</h2>
          <p className="h-sub">
            {seat ? `Flying with ${who(seat.partnerId)}` : "One person, from a squadron you share"}
          </p>
        </div>
      </header>

      <div className="scroll">
        <div className="seatpane">

          {/* ------------------------------------------- somebody asked you */}
          {requests.in.map((r) => (
            <div className="askcard" key={r.id}>
              <Face id={r.userId} name={who(r.userId)} size="lg" state="on"
                    onClick={() => onProfile(r.userId)} />
              <div className="askcard-id">
                <b>{who(r.userId)} wants the right seat</b>
                <span>{sharedName(r.userId) || "In a squadron with you"} · {ago(r.at)}</span>
              </div>
              <button type="button" className="primary is-inline" onClick={() => onAnswer(r.id, true)}>
                <Check aria-hidden="true" /> Take off
              </button>
              <button type="button" className="ghost is-inline" onClick={() => onAnswer(r.id, false)}>
                <X aria-hidden="true" /> Not now
              </button>
            </div>
          ))}

          {/* ------------------------------------------------ the live seat */}
          {seat && (
            <section className="session">
              <div className="session-top">
                <span className="pair">
                  <Face id={me} name="You" size="lg" state="on" />
                  <Face id={seat.partnerId} name={who(seat.partnerId)} size="lg"
                        state={idleMins > 10 ? "away" : "on"}
                        onClick={() => onProfile(seat.partnerId)} />
                </span>
                <div className="session-id">
                  <h3>You and {who(seat.partnerId)}</h3>
                  <p>Both free to move. Neither of you follows the other.</p>
                </div>
                <div className="hobbs">
                  <b>{elapsed(seat.startedAt)}</b>
                  <span>Hobbs</span>
                </div>
              </div>

              {idleMins >= 50 && (
                /* The warning before the hour, and it says what to do about it
                   rather than counting down at you. */
                <div className="invitebar warn">
                  <Zap aria-hidden="true" />
                  <span>Quiet for {idleMins} minutes. Anything either of you does keeps the seat.</span>
                </div>
              )}

              <div className="doing">
                <div>
                  <p className="eyebrow">You</p>
                  <b>{myPlace || "In the Ready Room"}</b>
                </div>
                <div>
                  <p className="eyebrow">{who(seat.partnerId)}</p>
                  <b>{seat.partnerPlace || "In the Ready Room"}</b>
                  {seat.partnerSince && <small>{ago(seat.partnerSince)}</small>}
                </div>
              </div>

              {invite && (
                <div className="invitebar">
                  <Zap aria-hidden="true" />
                  <span>{who(seat.partnerId)} opened {invite.label}</span>
                  <span className="sp" />
                  <button type="button" className="primary is-inline" onClick={onFollowInvite}>
                    Join
                  </button>
                  <button type="button" className="ghost is-inline" onClick={onDismissInvite}>
                    Not now
                  </button>
                </div>
              )}

              <div className="seg-tabs" role="tablist" aria-label="Right seat">
                <button type="button" className="chip is-inline" role="tab"
                        aria-selected={tab === "where"} onClick={() => setTab("where")}>
                  Where you both are
                </button>
                <button type="button" className="chip is-inline" role="tab"
                        aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
                  <MessageSquare aria-hidden="true" /> Session chat
                </button>
                <span className="sp" />
                <button type="button" className="danger is-inline" onClick={onEnd}>
                  End
                </button>
              </div>

              {tab === "chat" && (
                <div className="seatchat">
                  <p className="seatchat-note">
                    Cleared when the seat empties. Pin a line to keep it as a note.
                  </p>
                  <div className="seatchat-list">
                    {seatMessages.map((m) => (
                      <div className={`seatmsg${m.authorId === me ? " out" : ""}`} key={m.id}>
                        <span className="seatmsg-b">{m.body}</span>
                        <span className="seatmsg-m">
                          {when(m.createdAt)}
                          <button type="button" className="icon-btn is-inline"
                                  aria-pressed={m.kept}
                                  onClick={() => onKeep(m.id, !m.kept)}
                                  aria-label={m.kept ? "Kept" : "Keep this"}>
                            <Pin aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    ))}
                    {!seatMessages.length && (
                      <p className="pane-none">Say something and it lives until you land.</p>
                    )}
                  </div>
                  <Composer value={seatDraft} onChange={onSeatDraft} onSend={onSendSeat}
                            placeholder={`Message ${who(seat.partnerId)}`} />
                </div>
              )}
            </section>
          )}

          {/* ------------------------------------------------- who is around */}
          <section>
            <div className="sectionhead">
              <h3>{seat ? "Also free right now" : "Free right now"}</h3>
              <p>Anyone you share a squadron with</p>
            </div>
            {candidates.length ? (
              <div className="cards">
                {candidates.map((p) => {
                  const asked = requests.out.some((r) => r.userId === p.user_id);
                  const fresh = p.last_seen
                    && Date.now() - Date.parse(p.last_seen) < 3 * 60000;
                  return (
                    <div className="card" key={p.user_id}>
                      <div className="card-top">
                        <Face id={p.user_id} name={who(p.user_id)} size="lg"
                              state={fresh ? "on" : "away"}
                              onClick={() => onProfile(p.user_id)} />
                        <div>
                          <p className="card-n">{who(p.user_id)}</p>
                          <p className="card-s">{sharedName(p.user_id) || "Your squadron"}</p>
                        </div>
                      </div>
                      <p className="card-now">
                        <Eye aria-hidden="true" />
                        {p.module_code
                          ? `${p.module_code}${p.chapter_id ? ` · ${p.chapter_id}` : ""}`
                          : `Last here ${ago(p.last_seen)}`}
                      </p>
                      {asked ? (
                        <button type="button" className="ghost is-inline"
                                onClick={() => onCancelAsk(p.user_id)}>
                          <Check aria-hidden="true" /> Asked — waiting
                        </button>
                      ) : (
                        <button type="button" className="primary is-inline"
                                disabled={Boolean(seat)}
                                onClick={() => onAsk(p.user_id)}>
                          <Radio aria-hidden="true" /> Ask to fly
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="pane-none">
                <Users aria-hidden="true" />
                Your squadronmates show up here as they come in.
              </p>
            )}
          </section>

        </div>
      </div>
    </>
  );
}
