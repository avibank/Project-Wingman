import { Search, Plus, Bell, Radio, BellOff } from "lucide-react";
import { Avatar, Face } from "./bits.jsx";
import { when, chatUnread, waitingCount, titleOf } from "../../lib/roomModel.js";

/* ============================================================================
   §3 · THE RAIL — one list, two kinds of row.

   What makes this read as ONE list rather than a chat list stacked on a
   channel tree: squadron rows and module rows use the SAME grid. Leading mark,
   name, time, snippet, badge. Only the content differs, and the difference in
   content is the whole design — a squadron's snippet is the last thing
   somebody said, a module's is the newest question nobody has answered.

   RECENCY THROUGHOUT, to match every messaging app anybody already uses.

   THE SEARCH COVERS WHAT IT SAYS IT COVERS. The old placeholder read "Search
   squadrons and threads" and the field matched squadron names, module names
   and people — never a thread title, never a message. Four sections now, and
   each only appears when it has something in it.
   ========================================================================= */

const matchAll = (q, ...fields) => {
  const terms = String(q || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
};

export default function Rail({
  me, query, onQuery, brand, profile,
  squadrons = [], modules = [], threads = [], replies = [], messages = [],
  foundPeople = [], seat = null, seatFaces = [],
  view, onOpen, onNew, onProfile, onNotifications, unreadTotal = 0,
  who, listRef,
}) {
  const q = query.trim();
  const shownSquadrons = squadrons.filter((s) => matchAll(query, s.name, s.code, s.blurb));
  const shownModules = modules.filter((m) => matchAll(query, m.name, m.code || m.id));
  const shownThreads = q ? threads.filter((t) => matchAll(query, titleOf(t), t.body)).slice(0, 5) : [];
  const shownMessages = q
    ? messages.filter((m) => !m.deletedAt && matchAll(query, m.body)).slice(-4).reverse() : [];
  const nothing = Boolean(q) && !shownSquadrons.length && !shownModules.length
    && !shownThreads.length && !shownMessages.length && !foundPeople.length;

  const cur = view || {};
  const sqOf = (id) => squadrons.find((s) => s.id === id);

  return (
    <aside className="rail" ref={listRef} tabIndex={-1} aria-label="Squadrons, modules and people">
      <div className="rail-top">
        <div className="mark">
          {brand}
          <span>Ready Room</span>
        </div>
        <button type="button" className="icon-btn is-inline" aria-label="New"
                onClick={(e) => onNew(e.currentTarget)}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn is-inline"
                aria-label={unreadTotal
                  ? `Notifications, ${unreadTotal} waiting` : "Notifications"}
                onClick={onNotifications}>
          <Bell aria-hidden="true" />
          {unreadTotal > 0 && <i className="pip" aria-hidden="true" />}
        </button>
        {profile}
      </div>

      <div className="search">
        <Search aria-hidden="true" />
        <input type="search" value={query} placeholder="Search people, chats and questions"
               aria-label="Search people, chats and questions"
               onChange={(e) => onQuery(e.target.value)} />
      </div>

      {/* §3 — THE RIGHT SEAT BLOCK. When a seat is taken it is one card saying
          who and where; when it is empty it is the faces you last flew with
          and the way to everyone else. Never both. */}
      <div className="rightseat">
        <p className="eyebrow">Right seat</p>
        {seat ? (
          <button type="button" className="copilot" onClick={() => onOpen({ kind: "seat" })}>
            <Face id={seat.partnerId} name={who(seat.partnerId)} state="on" />
            <span className="copilot-id">
              <b>{who(seat.partnerId)}</b>
              <span>{seat.partnerPlace || "In the room"}</span>
            </span>
            <i className="pulse" aria-hidden="true" />
          </button>
        ) : seatFaces.length ? (
          <div className="seat-row">
            {seatFaces.map((p) => (
              <button type="button" key={p.user_id} className="seat is-inline"
                      onClick={() => onProfile(p.user_id)}
                      aria-label={`${who(p.user_id)}, in the room. Open their profile.`}>
                <span className="avwrap">
                  <Avatar id={p.user_id} name={who(p.user_id)} />
                  <i className="dot on" aria-hidden="true" />
                </span>
                <span className="seat-name">{who(p.user_id).split(" ")[0]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="seat-none">Take the right seat with anyone from a squadron.</p>
        )}
        <button type="button" className={`seat-cta ${cur.kind === "seat" ? "on" : ""}`}
                aria-current={cur.kind === "seat" ? "true" : undefined}
                onClick={() => onOpen({ kind: "seat" })}>
          <Radio aria-hidden="true" /> {seat ? "Open the right seat" : "Find a right seat"}
        </button>
      </div>

      <div className="rail-scroll">
        {nothing && (
          /* Point at the route that works rather than saying "no results" and
             stopping — and in one line, not a paragraph. */
          <p className="rail-none">
            No match.{" "}
            <button type="button" className="is-inline linky"
                    onClick={() => onOpen({ kind: "discover" })}>Find a squadron</button>
            {" "}or paste an invite link.
          </p>
        )}

        {/* §3 — PEOPLE, and only the ones already in your orbit. The list comes
            back from the server that way; nothing here narrows it, because a
            filter in the client is a directory with a curtain in front of it.
            The rule itself is on the Find a squadron screen, said once, rather
            than under every successful search. */}
        {foundPeople.length > 0 && (
          <>
            <p className="group-head"><b>People</b></p>
            {foundPeople.map((p) => (
              <button type="button" key={p.user_id} className="row"
                      onClick={() => onProfile(p.user_id, p)}>
                <Avatar id={p.user_id} name={p.display_name} size="lg" />
                <span className="row-line">
                  <span className="row-name">{p.display_name}</span>
                </span>
                <span className="row-snip">
                  {p.module_code || "In your modules"}
                  {p.shares_squadron ? " · in a squadron with you" : ""}
                </span>
                <span className="row-meta" />
              </button>
            ))}
          </>
        )}

        {shownThreads.length > 0 && (
          <>
            <p className="group-head"><b>Questions</b></p>
            {shownThreads.map((t) => (
              <button type="button" key={t.id} className="row"
                      onClick={() => onOpen({ kind: "thread", id: t.moduleId, threadId: t.id })}>
                <span className="mod-icon" aria-hidden="true">{t.moduleId}</span>
                <span className="row-line">
                  <span className="row-name">{titleOf(t)}</span>
                  <span className="row-time">{when(t.createdAt)}</span>
                </span>
                <span className="row-snip">
                  {who(t.authorId)} · {replies.filter((r) => r.threadId === t.id).length} answers
                </span>
                <span className="row-meta" />
              </button>
            ))}
          </>
        )}

        {shownMessages.length > 0 && (
          <>
            <p className="group-head"><b>Messages</b></p>
            {shownMessages.map((m) => (
              <button type="button" key={m.id} className="row"
                      onClick={() => onOpen({ kind: "squadron", id: m.squadronId, at: m.id })}>
                <Avatar id={m.authorId} name={who(m.authorId)} size="lg" />
                <span className="row-line">
                  <span className="row-name">{who(m.authorId)}</span>
                  <span className="row-time">{when(m.createdAt)}</span>
                </span>
                <span className="row-snip">{m.body}</span>
                <span className="row-meta">
                  <span className="row-where">{sqOf(m.squadronId)?.name}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {!nothing && (
          <p className="group-head">
            <b>Squadrons</b>
            <button type="button" className="is-inline linky"
                    onClick={() => onOpen({ kind: "discover" })}>Find one</button>
          </p>
        )}
        {shownSquadrons.map((s) => {
          const unread = chatUnread(messages, s.id, s.lastReadAt, me);
          const on = cur.kind === "squadron" && cur.id === s.id;
          return (
            <button type="button" key={s.id} className="row"
                    aria-current={on ? "true" : undefined}
                    onClick={() => onOpen({ kind: "squadron", id: s.id })}>
              <Avatar id={s.id} name={s.code} size="lg" square />
              <span className="row-line">
                <span className="row-name">{s.name}</span>
                <span className="row-time">{s.last ? when(s.last.createdAt) : ""}</span>
              </span>
              <span className="row-snip">
                {s.last
                  ? (<><em>{s.last.authorId === me ? "You" : who(s.last.authorId)}:</em> {s.last.body}</>)
                  : "Start it off"}
              </span>
              <span className="row-meta">
                {unread > 0 && <span className={`badge ${s.muted ? "quiet" : ""}`}>{unread}</span>}
                {s.muted && <BellOff className="mutedi" aria-label="Muted" />}
              </span>
            </button>
          );
        })}
        {!nothing && !squadrons.length && (
          <p className="rail-none">
            <button type="button" className="is-inline linky"
                    onClick={() => onOpen({ kind: "discover" })}>Join a squadron</button>
            {" "}and it appears here.
          </p>
        )}

        {!nothing && <p className="group-head"><b>Modules</b></p>}
        {shownModules.map((m) => {
          const code = m.code || m.id;
          const mine = threads.filter((t) => t.moduleId === code);
          const newest = [...mine].sort(
            (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
          const waiting = waitingCount(mine);
          const on = (cur.kind === "module" || cur.kind === "thread") && cur.id === code;
          return (
            <button type="button" key={code} className="row"
                    aria-current={on ? "true" : undefined}
                    onClick={() => onOpen({ kind: "module", id: code })}>
              <span className="mod-icon" aria-hidden="true">{code}</span>
              <span className="row-line">
                <span className="row-name">{m.name}</span>
                <span className="row-time">{newest ? when(newest.createdAt) : ""}</span>
              </span>
              <span className="row-snip">{newest ? titleOf(newest) : "Ask the first one"}</span>
              <span className="row-meta">
                {waiting > 0 && <span className="badge quiet">{waiting}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
