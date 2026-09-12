import { useState } from "react";
import { ChevronLeft, Plus, Link2, Copy } from "lucide-react";
import { Avatar } from "./bits.jsx";
import { activityLine, headcountLine, inviteUrl } from "../../lib/discovery.js";

/* §5 — FIND A SQUADRON.
 *
 * The answer for someone who arrives alone. One join hands them twenty people
 * instead of one, which is why a room comes before a person: you must share a
 * squadron with somebody before you can take the right seat with them.
 *
 * Sorted by activity rather than size — a busy room of nine beats a dead room
 * of forty — and that ordering is the server's, in discover_squadrons.
 *
 * CAPACITY IS NEVER A FRACTION anywhere on this screen. Not "8 of 32", no bar,
 * no "24 spaces left". A group of eight is a squadron; rendered as a fraction
 * it becomes a half-empty one, and that framing is what kills small groups
 * rather than their size. The only place a cap may surface is a disabled Join
 * on a room that genuinely is full, labelled "Full".
 *
 * WHAT WENT: the lede paragraph explaining the product's philosophy, and the
 * note explaining to the reader how other people behave. Both were true and
 * neither belonged on a screen whose job is to list rooms. The one rule worth
 * stating — that people are only findable inside your own orbit — is said once
 * here, at the bottom, instead of under every successful search.
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
  rooms = [], filter = "yours", onFilter, onJoin, onCreate, onBack,
  mySquadrons = [], onCopyInvite, onOpenLink, who = (id) => id,
}) {
  const [link, setLink] = useState("");

  return (
    <>
      <header className="pane-head">
        <button type="button" className="icon-btn is-inline back" onClick={onBack} aria-label="Back">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="h-id">
          <h2 className="h-title">Find a squadron</h2>
          <p className="h-sub">Busiest first</p>
        </div>
        <button type="button" className="primary is-inline" onClick={onCreate}>
          <Plus aria-hidden="true" /> Create
        </button>
      </header>

      <div className="scroll">
        <div className="disc">
          <div className="sortrow">
            {FILTERS.map((f) => (
              <button type="button" key={f.id} className="chip is-inline"
                      aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {rooms.map((r) => {
            const state = r.already_in ? "joined"
              : r.requested ? "requested"
              : r.is_full ? "full"
              : r.join_policy;
            const disabled = state !== "open" && state !== "request";
            return (
              <div className="sqcard" key={r.id}>
                <Avatar id={r.id} name={r.module_code || r.name} size="lg" square />
                <div className="sqcard-main">
                  <h4>{r.name}</h4>
                  <div className="tags">
                    {r.module_code && <span className="tag">{r.module_code}</span>}
                    {r.exam_window && <span className="tag">{r.exam_window}</span>}
                    {r.active_week >= 10 && <span className="tag mine">Busy this week</span>}
                  </div>
                  {r.blurb && <p className="sqcard-blurb">{r.blurb}</p>}
                  <div className="known">
                    {r.known_ids?.length ? (
                      <>
                        <span className="faces" aria-hidden="true">
                          {r.known_ids.slice(0, 4).map((id) => (
                            <Avatar key={id} id={id} name={who(id)} size="sm" />
                          ))}
                        </span>
                        <span>
                          {r.known_ids.slice(0, 2).map(who).join(" and ")}
                          {r.known_ids.length > 2 ? ` and ${r.known_ids.length - 2} more` : ""}
                          {r.known_ids.length > 1 ? " are" : " is"} in here
                        </span>
                      </>
                    ) : (
                      <span>You&rsquo;d be the first here from your modules</span>
                    )}
                    <span>· {activityLine(r.members, r.active_week)}</span>
                  </div>
                </div>
                <button type="button" className={disabled ? "ghost is-inline" : "primary is-inline"}
                        disabled={disabled} onClick={() => onJoin(r)}>
                  {LABEL[state] || "Join"}
                </button>
              </div>
            );
          })}

          {!rooms.length && (
            <p className="pane-none">
              Nothing open under this filter.{" "}
              <button type="button" className="is-inline linky" onClick={() => onFilter("all")}>
                Show all
              </button>
            </p>
          )}

          {/* ROUTE ONE, AND THE ONE THAT CARRIES THE GROWTH. Most people arrive
              because a classmate pasted a link into the group chat they already
              have, so it is on the screen rather than behind a menu. */}
          <p className="rule">Given a link</p>
          <div className="linkbox">
            <label className="vis-hidden" htmlFor="paste-link">Paste a squadron link</label>
            <input id="paste-link" value={link} placeholder="Paste a squadron link"
                   onChange={(e) => setLink(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" && link.trim()) onOpenLink(link.trim()); }} />
            <button type="button" className="ghost is-inline" disabled={!link.trim()}
                    onClick={() => onOpenLink(link.trim())}>
              Open
            </button>
          </div>

          {mySquadrons.length > 0 && (
            <>
              <p className="rule">Yours, to share</p>
              {mySquadrons.map((s) => (
                <div className="linkbox" key={s.id}>
                  <Avatar id={s.id} name={s.code} size="lg" square />
                  <div className="grow">
                    <div className="sq-name">{s.name}</div>
                    <div className="meta">
                      {headcountLine((s.members || []).length, s.online || 0)}
                    </div>
                    {s.inviteToken && <code className="invite-code">{inviteUrl(s.inviteToken)}</code>}
                  </div>
                  <button type="button" className="primary is-inline" onClick={() => onCopyInvite(s)}>
                    <Copy aria-hidden="true" /> Copy link
                  </button>
                </div>
              ))}
            </>
          )}

          <p className="scope">
            <Link2 aria-hidden="true" />
            A name only finds someone you already share a squadron with, or who has
            answered in a module you study. A link reaches anyone.
          </p>
        </div>
      </div>
    </>
  );
}
