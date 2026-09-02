import { useEffect, useRef } from "react";
import { X, Users, Clock } from "lucide-react";

/* §4 — THE PROFILE SHEET.
 *
 * Opens from a tap on any avatar or name anywhere: a search result, a
 * right-seat tile, a thread author, a squadron member. A drawer on desktop,
 * full screen on a phone, and Escape and a backdrop tap both close it.
 *
 * WHAT IS DELIBERATELY NOT HERE: accuracy, quiz percentage, rank, level, or a
 * streak presented as a score. The moment discovery shows performance it
 * becomes a leaderboard, weaker students get quietly excluded, and the
 * mixed-ability groups are the ones that actually work. Study rhythm —
 * "studied 5 of the last 7 days" — is fine and is the one number here: it says
 * whether somebody is around, not how good they are.
 */
export default function ProfileSheet({
  open, person, sharedSquadrons = [], mutualCount = 0, rhythm = null,
  recent = [], canInvite = true,
  onClose, onInvite, onAskRightSeat, onReport, onBlock,
}) {
  const ref = useRef(null);
  const closeRef = useRef(null);

  /* Escape closes, and focus moves into the drawer when it opens so the first
     Tab lands inside it rather than back in the page behind. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!person) return null;

  /* THE RULE ON THE BUTTON, not a hidden button. Right seat needs a shared
     squadron; a disabled control that says why teaches the rule, and a missing
     one just leaves someone wondering where it went. */
  const shares = sharedSquadrons.length > 0;

  return (
    <>
      <div className="veil" data-open={open ? "true" : "false"}
           onClick={onClose} aria-hidden="true" />
      <aside className="drawer" data-open={open ? "true" : "false"} ref={ref}
             role="dialog" aria-modal="true" aria-label={`${person.callsign || "Profile"}`}
             aria-hidden={open ? undefined : "true"}>
        <div className="dr-head">
          <button type="button" className="icon-btn is-inline" ref={closeRef}
                  onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
          <span className="h-title">Profile</span>
        </div>

        <div className="dr-body">
          <div className="who-box">
            <span className="av lg" style={{ "--av-h": person.hue ?? 240 }} aria-hidden="true">
              {(person.callsign || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="nm">{person.callsign}</div>
            {person.module_code && <div className="sub">{person.module_code}</div>}

            {/* Availability and contribution. Nothing about performance. */}
            <div className="pills">
              {person.active_window && (
                <span className="pill2">
                  {person.active_window}{person.timezone ? ` · ${person.timezone}` : ""}
                </span>
              )}
              {person.exam_window && <span className="pill2">{person.exam_window}</span>}
              {person.answers && <span className="pill2">{person.answers}</span>}
            </div>
          </div>

          {/* WHAT YOU ALREADY SHARE. This is the block that makes a stranger
              legible, and it is why the sheet is worth opening at all. */}
          {(shares || mutualCount > 0 || rhythm) && (
            <div className="shared">
              {shares && (
                <div className="k">
                  <Users aria-hidden="true" />
                  You&rsquo;re both in {sharedSquadrons.join(" and ")}
                </div>
              )}
              {mutualCount > 0 && (
                <div className="k">
                  <Users aria-hidden="true" />
                  {mutualCount} {mutualCount === 1 ? "person" : "people"} you know
                </div>
              )}
              {rhythm && <div className="k"><Clock aria-hidden="true" />{rhythm}</div>}
            </div>
          )}

          <div className="acts">
            <button type="button" className="join" disabled={!canInvite}
                    onClick={() => onInvite?.(person)}>
              Invite to a squadron
            </button>
            {shares ? (
              <button type="button" className="join sec" onClick={() => onAskRightSeat?.(person)}>
                Ask to fly right seat
              </button>
            ) : (
              <button type="button" className="join off" disabled>
                Right seat needs a shared squadron
              </button>
            )}
          </div>

          {recent.length > 0 && (
            <div className="answered">
              <p className="rule">Recently answered</p>
              {recent.map((r) => (
                <button type="button" className="ansrow" key={r.id}
                        onClick={() => r.onOpen?.()}>
                  <span className="q">{r.title}</span>
                  <span className="m">
                    {r.where}
                    {r.best && <span className="tag best">Best answer</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quiet, at the bottom, and on every profile — §7. */}
          <div className="safety">
            <button type="button" onClick={() => onReport?.(person)}>Report</button>
            <button type="button" onClick={() => onBlock?.(person)}>Block</button>
          </div>
        </div>
      </aside>
    </>
  );
}
