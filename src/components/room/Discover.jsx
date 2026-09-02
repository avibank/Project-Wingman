import { useState } from "react";
import { Plus, Link2 } from "lucide-react";
import { activityLine, headcountLine, inviteUrl } from "../../lib/discovery.js";

/* §5 — FIND A SQUADRON.
 *
 * The answer for someone who arrives alone. One join hands them twenty people
 * instead of one, which is why the brief puts a room ahead of a person: you
 * must share a squadron with somebody before you can take the right seat with
 * them, so a room is the door and a person is what is behind it.
 *
 * Sorted by activity rather than size — a busy room of nine beats a dead room
 * of forty — and that ordering is the server's, in discover_squadrons.
 *
 * CAPACITY IS NEVER A FRACTION anywhere on this screen. Not "8 of 32", no bar,
 * no "24 spaces left". A group of eight is a squadron; rendered as a fraction
 * it becomes a half-empty one, and that framing is what kills small groups
 * rather than their size. The only place a cap may surface is a disabled Join
 * on a room that genuinely is full, labelled "Full".
 */
const FILTERS = [
  { id: "yours", label: "Your modules" },
  { id: "exam", label: "Your exam window" },
  { id: "all", label: "All" },
];

const LABEL = {
  open: "Join", request: "Ask to join", full: "Full",
  joined: "Joined", requested: "Requested", invite_only: "Invite only",
};

export default function Discover({
  rooms = [], filter = "yours", onFilter, onJoin, onCreate,
  mySquadron = null, inviteToken = null, onCopyInvite, onOpenLink,
  who = (id) => id,
}) {
  const [link, setLink] = useState("");

  return (
    <div className="scroll">
      <div className="wrap">
        <div className="lede">
          <h3>Start with a room, not a person</h3>
          <p>
            Joining one squadron gives you everyone in it at once — and you need to
            share a squadron with someone before you can take the right seat with them.
          </p>
        </div>

        <div className="filters">
          {FILTERS.map((f) => (
            <button type="button" key={f.id} className="chip"
                    aria-pressed={filter === f.id}
                    onClick={() => onFilter?.(f.id)}>
              {f.label}
            </button>
          ))}
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onCreate}>
            <Plus aria-hidden="true" /> Create one
          </button>
        </div>

        {rooms.map((r) => {
          const state = r.already_in ? "joined"
            : r.requested ? "requested"
            : r.is_full ? "full"
            : r.join_policy;
          const disabled = state !== "open" && state !== "request";
          const cls = state === "open" ? "join"
            : state === "request" ? "join sec" : "join off";
          return (
            <div className="sq" key={r.id}>
              <span className="badge-sq" aria-hidden="true">
                {(r.module_code || r.name || "?").slice(0, 3).toUpperCase()}
              </span>
              <div className="sq-main">
                <h4>{r.name}</h4>
                <div className="tags">
                  {r.module_code && <span className="tag">{r.module_code}</span>}
                  {r.exam_window && <span className="tag">{r.exam_window}</span>}
                  {r.active_week >= 10 && <span className="tag hot">Busy this week</span>}
                  {r.is_full && <span className="tag full">At capacity</span>}
                </div>
                {r.blurb && <p className="sq-blurb">{r.blurb}</p>}

                {/* THE SOCIAL-PROOF LINE, and when nobody is known it says so
                    plainly rather than disappearing. A line that vanishes reads
                    as a rendering bug; one that says "nobody yet" is an answer. */}
                <div className="known">
                  {r.known_ids?.length ? (
                    <>
                      <span className="faces" aria-hidden="true">
                        {r.known_ids.slice(0, 4).map((id) => (
                          <span className="av sm" key={id} style={{ "--av-h": 240 }}>
                            {(who(id) || "?").slice(0, 2).toUpperCase()}
                          </span>
                        ))}
                      </span>
                      <span>
                        {r.known_ids.slice(0, 2).map(who).join(" and ")}
                        {r.known_ids.length > 2 ? ` and ${r.known_ids.length - 2} more` : ""}
                        {r.known_ids.length > 1 ? " are" : " is"} in here
                      </span>
                    </>
                  ) : (
                    /* The brief says to keep this line rather than hide it —
                       a line that vanishes reads as a bug. The voice rule says
                       not to state an absence. Both hold if it names what the
                       reader would be doing instead. */
                    <span className="quiet">You&rsquo;d be the first here from your modules</span>
                  )}
                  <span className="quiet">· {activityLine(r.members, r.active_week)}</span>
                </div>
              </div>
              <span className="act">
                <button type="button" className={cls} disabled={disabled}
                        onClick={() => onJoin?.(r)}>
                  {LABEL[state] || "Join"}
                </button>
              </span>
            </div>
          );
        })}

        {/* ROUTE ONE, AND THE ONE THAT CARRIES THE GROWTH. Most people arrive
            because a classmate pasted a link into the group chat they already
            have, so it is on the screen rather than behind a menu. */}
        <p className="rule">Been given a link</p>
        <div className="linkbox">
          <div className="note">
            Most people arrive this way. A classmate pastes the squadron link into the
            group chat they already have, and it opens straight into the room.
          </div>
          <div className="row2">
            <input className="linkfield" value={link} placeholder="Paste a squadron link"
                   aria-label="Paste a squadron link"
                   onChange={(e) => setLink(e.target.value)} />
            <button type="button" className="join sec" disabled={!link.trim()}
                    onClick={() => onOpenLink?.(link.trim())}>
              Open link
            </button>
          </div>
        </div>

        {mySquadron && (
          <>
            <p className="rule">Your squadron</p>
            <div className="linkbox">
              <div className="row2">
                <span className="av lg sq" aria-hidden="true">
                  {(mySquadron.name || "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="grow">
                  <div className="sq-name">{mySquadron.name}</div>
                  <div className="meta">
                    {headcountLine(mySquadron.members, mySquadron.online)}
                  </div>
                </div>
                <button type="button" className="join" onClick={onCopyInvite}>
                  <Link2 aria-hidden="true" /> Invite
                </button>
              </div>
              {inviteToken && <code className="invite-code">{inviteUrl(inviteToken)}</code>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
