import { useState } from "react";
import { initials } from "./route.js";
import { Motif } from "./motifs.jsx";

/* What your squadron just said, and the fastest way to answer it.
   The composer names where it is going so you never type into thin air. */
export function SquadronCard({
  squadron,        // { name, members, messages: [{ id, who, text, mine }], unread, quietSince } | null
  limit = 3,
  onSend,
  onFindSquadron,
}) {
  const [draft, setDraft] = useState("");

  if (!squadron) {
    return (
      <div className="bog-card">
        <div className="bog-ch"><span className="bog-lbl">Squadron</span></div>
        <div className="bog-body">
          <div className="bog-invite">
            <Motif kind="squad" />
            <p className="bog-lead">A squadron fills this card.</p>
            <p className="bog-why">Join one on this module, or start your own.</p>
            <button className="bog-btn is-inline" type="button" data-primary="" onClick={onFindSquadron}>
              Find a squadron
            </button>
          </div>
        </div>
      </div>
    );
  }

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  const messages = (squadron.messages || []).slice(-limit);

  return (
    <div className="bog-card">
      <div className="bog-ch">
        <span className="bog-lbl">{squadron.name}</span>
        <span className="bog-aside">
          {squadron.unread ? <span className="bog-unread">{squadron.unread}</span>
            : messages.length ? squadron.quietSince
            : squadron.members.length
              ? `${squadron.members.length} ${squadron.members.length === 1 ? "member" : "members"}`
              : "Invite someone"}
        </span>
      </div>

      <div className="bog-body">
        {messages.length ? (
          <div className="bog-msgs">
            {messages.map((m) => (
              <div className="bog-msg" key={m.id} data-me={m.mine ? "" : undefined}>
                <span className="bog-mini">{m.mine ? "YOU" : initials(m.who)}</span>
                <span className="bog-mbody"><b>{m.mine ? "You" : m.who}</b>{m.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bog-invite">
            <Motif kind="squad" />
            <p className="bog-lead">The first message fills this card.</p>
            <p className="bog-why">Say the thing you are stuck on.</p>
          </div>
        )}
      </div>

      <form className="bog-reply" onSubmit={send}>
        <input
          className="bog-field"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={messages.length ? `Reply to ${squadron.name}…` : "Start it off…"}
          aria-label={`Message ${squadron.name}`}
        />
        <button className="is-inline" type="submit" aria-label="Send">➤</button>
      </form>
    </div>
  );
}
