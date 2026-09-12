import { X, Users, Clock, Radio, MessageSquare } from "lucide-react";
import { Face, Sheet } from "./bits.jsx";

/* §4 — THE PROFILE SHEET.
 *
 * Opens from a tap on any avatar or name anywhere: a search result, a
 * right-seat tile, a thread author, an answerer, a face in the transcript, a
 * member in the squadron sheet. That sentence used to be in this comment and
 * false — the sheet was reachable from exactly one place, a people-search row,
 * and every other avatar in the room was inert.
 *
 * WHAT IS DELIBERATELY NOT HERE: accuracy, quiz percentage, rank, level, or a
 * streak presented as a score. The moment discovery shows performance it
 * becomes a leaderboard, weaker students get quietly excluded, and the
 * mixed-ability groups are the ones that actually work. Study rhythm —
 * "studied 5 of the last 7 days" — is fine and is the one number here: it says
 * whether somebody is around, not how good they are.
 *
 * THE RULE ON THE BUTTON, not a hidden button. Right seat needs a shared
 * squadron; a disabled control that says why teaches the rule, and a missing
 * one leaves somebody wondering where it went. It reports correctly now:
 * `sharedSquadrons` used to be computed by testing a string id against member
 * ROW OBJECTS, so it was empty for everyone and the sheet told squadronmates
 * they shared nothing.
 */
export default function ProfileSheet({
  open, person, sharedSquadrons = [], rhythm = null, presence = "off",
  canInvite = true, seatState = "free",
  onClose, onInvite, onAskRightSeat, onOpenChat, onReport, onBlock,
}) {
  if (!person) return null;
  const shares = sharedSquadrons.length > 0;
  const name = person.callsign || person.name || "Someone";

  return (
    <Sheet open={open} label={name} onClose={onClose}>
      {(closeRef) => (
        <>
          <div className="dr-head">
            <button type="button" className="icon-btn is-inline" ref={closeRef}
                    onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
            <span className="h-title">Profile</span>
          </div>

          <div className="dr-body">
            <div className="who-box">
              <Face id={person.user_id} name={name} size="lg" state={presence} />
              <div className="nm">{name}</div>
              {person.code && <div className="sub">{person.code}</div>}
              <div className="pills">
                {person.active_window && (
                  <span className="pill2">
                    {person.active_window}{person.timezone ? ` · ${person.timezone}` : ""}
                  </span>
                )}
                {person.exam_window && <span className="pill2">{person.exam_window}</span>}
                {person.module_code && <span className="pill2">{person.module_code}</span>}
              </div>
            </div>

            {/* WHAT YOU ALREADY SHARE. This is the block that makes a stranger
                legible, and it is why the sheet is worth opening at all. */}
            {(shares || rhythm) && (
              <div className="shared">
                {shares && (
                  <div className="k">
                    <Users aria-hidden="true" />
                    You&rsquo;re both in {sharedSquadrons.join(" and ")}
                  </div>
                )}
                {rhythm && <div className="k"><Clock aria-hidden="true" />{rhythm}</div>}
              </div>
            )}

            <div className="acts">
              {shares ? (
                <button type="button" className="fill"
                        disabled={seatState !== "free"}
                        onClick={() => onAskRightSeat(person)}>
                  <Radio aria-hidden="true" />
                  {seatState === "asked" ? "Asked — waiting"
                    : seatState === "flying" ? "You're already flying"
                    : "Ask to fly right seat"}
                </button>
              ) : (
                <button type="button" className="off" disabled>
                  Share a squadron before the right seat
                </button>
              )}
              {shares && (
                <button type="button" className="out" onClick={() => onOpenChat(person)}>
                  <MessageSquare aria-hidden="true" /> Open the squadron
                </button>
              )}
              {canInvite && (
                <button type="button" className="out" onClick={() => onInvite(person)}>
                  Invite to a squadron
                </button>
              )}
            </div>

            {/* Quiet, at the bottom, and on every profile — §7. */}
            <div className="safety">
              <button type="button" onClick={() => onReport(person)}>Report</button>
              <button type="button" onClick={() => onBlock(person)}>Block</button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
