import { X, Copy, BellOff, Bell, RotateCcw } from "lucide-react";
import { Face, Sheet } from "./bits.jsx";
import { inviteUrl } from "../../lib/discovery.js";

/* §4a — WHAT A SQUADRON IS, from inside it.
 *
 * Every group chat anybody already uses has this sheet, and the room did not:
 * the header said "6 members · 2 online" and was not a button, so there was no
 * way to see who the six were, no way to get the invite link out, no way to
 * mute, and no way to leave.
 *
 * The invite link is on this screen rather than behind a menu because it is
 * the single action that grows a squadron, and "revoke" sits next to it
 * because the honest pair for a shareable link is a way to un-share it.
 */
export default function SquadronSheet({
  open, squadron, me, online = new Set(),
  onClose, onCopyInvite, onRevoke, onMute, onLeave, onProfile,
}) {
  if (!squadron) return null;
  const roster = squadron.roster || (squadron.members || []).map((id) => ({ user_id: id }));
  const owner = squadron.ownerId;

  return (
    <Sheet open={open} label={squadron.name} onClose={onClose}>
      {(closeRef) => (
        <>
          <div className="dr-head">
            <button type="button" className="icon-btn is-inline" ref={closeRef}
                    onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
            <span className="h-title">Squadron</span>
          </div>

          <div className="dr-body">
            <div className="who-box">
              <Face id={squadron.id} name={squadron.code} size="lg" />
              <div className="nm">{squadron.name}</div>
              <div className="sub">
                {roster.length} member{roster.length === 1 ? "" : "s"}
                {" · "}{squadron.code}
              </div>
              {squadron.blurb && <p className="sub">{squadron.blurb}</p>}
            </div>

            <div className="acts">
              <button type="button" className="fill" onClick={() => onCopyInvite(squadron)}>
                <Copy aria-hidden="true" /> Copy invite link
              </button>
              <button type="button" className="out" onClick={() => onMute(squadron, !squadron.muted)}>
                {squadron.muted
                  ? <><Bell aria-hidden="true" /> Turn notifications back on</>
                  : <><BellOff aria-hidden="true" /> Mute notifications</>}
              </button>
              {owner === me && (
                <button type="button" className="out" onClick={() => onRevoke(squadron)}>
                  <RotateCcw aria-hidden="true" /> New link, old one stops working
                </button>
              )}
            </div>
            {squadron.inviteToken && (
              <code className="invite-code">{inviteUrl(squadron.inviteToken)}</code>
            )}

            <div>
              <p className="rule">Members</p>
              {roster.map((m) => (
                <button type="button" className="memberrow" key={m.user_id}
                        onClick={() => onProfile(m.user_id)}>
                  <Face id={m.user_id} name={m.name || m.user_id}
                        state={online.has(m.user_id) ? "on" : "off"} />
                  <span className="nm">{m.user_id === me ? "You" : (m.name || m.user_id)}</span>
                  <span className="rl">
                    {m.user_id === owner ? "Owner" : m.role === "staff" ? "Staff" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="safety">
              <button type="button" onClick={() => onLeave(squadron)}>Leave this squadron</button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
