import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft, Search, Info, Pin, X, CornerUpLeft, SmilePlus, MoreHorizontal,
  Check, CheckCheck, ChevronDown,
} from "lucide-react";
import { Avatar, Face, Composer } from "./bits.jsx";
import { when, runs, firstUnread, chatUnread } from "../../lib/roomModel.js";
import { hueFor } from "../../lib/familiar.js";

/* ============================================================================
   §4a · A SQUADRON IS A GROUP CHAT.

   Not a forum with avatars. The whole point of splitting the room in two is
   that a squadron is people you know, talking — a transcript you skim and
   forget — and every decision here follows from that: runs collapse, the day
   breaks, the newest message is the one you land on, and nothing asks you for
   a title before you can say "same".

   THE THINGS THAT MAKE IT FEEL LIKE ONE, and that the room did not have:
   reply-with-quote, reactions, a pin, edit and delete your own, a read tick,
   an unread line you land at, and a transcript that does NOT yank you to the
   bottom while you are reading history.

   That last one was a real fault: the scroll handler ran on every change to
   messages.length, so somebody reading back through Tuesday was thrown to
   Friday the moment anyone typed. It sticks to the bottom only when you are
   already at the bottom, which is what every chat app does and what nobody
   notices until it stops happening.
   ========================================================================= */

const NEAR_BOTTOM = 120;

export default function SquadronChat({
  me, squadron, messages = [], draft, onDraft, onSend, sending,
  replyTo, onReplyTo, onReact, onMenu, onBack, onInfo, onProfile,
  onSearchHere, typing = [], who, onSeen, jumpTo,
}) {
  const scrollRef = useRef(null);
  const [stuck, setStuck] = useState(true);
  const list = messages.filter((m) => m.squadronId === squadron.id);
  const unread = chatUnread(messages, squadron.id, squadron.lastReadAt, me);
  const mark = firstUnread(list, squadron.lastReadAt, me);

  /* Stick to the bottom only if we were already there. `stuck` is set by the
     scroll listener, so the decision is made before the new row is painted. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [list.length, squadron.id, stuck]);

  /* A new conversation always opens at the bottom, whatever the last one did. */
  useEffect(() => { setStuck(true); }, [squadron.id]);

  /* Landing on the message a search result pointed at. Highlighted rather than
     just scrolled to, because a message in the middle of a transcript with no
     mark on it is indistinguishable from the one above it. */
  useEffect(() => {
    if (!jumpTo) return;
    const el = scrollRef.current?.querySelector(`[data-msg="${jumpTo}"]`);
    if (!el) return;
    setStuck(false);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.setAttribute("data-lit", "true");
    const t = setTimeout(() => el.removeAttribute("data-lit"), 1400);
    return () => clearTimeout(t);
  }, [jumpTo, list.length]);

  /* Read state is the server's. Marking happens once the transcript is
     actually at the bottom — opening a chat and immediately leaving it should
     not clear a badge you never read. */
  useEffect(() => {
    if (stuck && unread > 0) onSeen(squadron.id);
  }, [stuck, unread, squadron.id, onSeen]);

  const online = (squadron.roster || []).filter((m) => m.online).length;
  const names = (squadron.members || []).map((id) => (id === me ? "You" : who(id)));
  const parentOf = (id) => list.find((m) => m.id === id);

  return (
    <>
      <header className="pane-head">
        <button type="button" className="icon-btn is-inline back" onClick={onBack} aria-label="Back">
          <ChevronLeft aria-hidden="true" />
        </button>
        <Avatar id={squadron.id} name={squadron.code} size="lg" square />
        <button type="button" className="h-id" onClick={onInfo}>
          <h2 className="h-title">{squadron.name}</h2>
          <p className="h-sub">
            {names.slice(0, 4).join(", ")}
            {names.length > 4 ? ` +${names.length - 4}` : ""}
            {online > 0 ? ` · ${online} in the room` : ""}
          </p>
        </button>
        <button type="button" className="icon-btn is-inline" onClick={onSearchHere}
                aria-label="Search this squadron">
          <Search aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn is-inline" onClick={onInfo}
                aria-label="Squadron details">
          <Info aria-hidden="true" />
        </button>
      </header>

      {squadron.pinned && (
        <div className="pinned">
          <Pin aria-hidden="true" />
          <button type="button" className="pin-body is-inline"
                  onClick={() => onMenu(null, { jump: squadron.pinned.id })}>
            <b>{squadron.pinned.by === me ? "You" : who(squadron.pinned.by)}</b>
            {" — "}{squadron.pinned.body}
          </button>
        </div>
      )}

      <div className="scroll" ref={scrollRef}
           onScroll={(e) => {
             const el = e.currentTarget;
             setStuck(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM);
           }}>
        <div className="transcript">
          {runs(list).map((m) => {
            if (m.divider) return <p className="daybreak" key={m.id}>{m.divider}</p>;
            const mine = m.authorId === me;
            const parent = m.replyTo ? parentOf(m.replyTo) : null;
            const reacts = Object.entries(m.reactions || {});
            return (
              <div key={m.id}>
                {mark && mark.id === m.id && (
                  <p className="newmark">{unread} new</p>
                )}
                <div className={`msg${mine ? " out" : ""}${m.first ? " first" : ""}`}
                     data-msg={m.id} style={{ "--av-h": hueFor(m.authorId) }}>
                  {!mine && (
                    <Face id={m.authorId} name={who(m.authorId)} size="sm"
                          onClick={() => onProfile(m.authorId)} label={`${who(m.authorId)}'s profile`} />
                  )}
                  <div className="bubble">
                    {m.first && !mine && <p className="who">{who(m.authorId)}</p>}
                    {parent && (
                      <button type="button" className="quote is-inline"
                              onClick={() => onMenu(null, { jump: parent.id })}>
                        <b>{parent.authorId === me ? "You" : who(parent.authorId)}</b>
                        <span>{parent.body || "Message removed"}</span>
                      </button>
                    )}
                    {m.deletedAt ? (
                      <p className="body gone">Message removed</p>
                    ) : (
                      <p className="body">
                        {m.body}
                        <span className="stamp">
                          {m.editedAt && <em>edited</em>}
                          {when(m.createdAt)}
                          {mine && (m.pending
                            ? <Check aria-label="Sending" />
                            : <CheckCheck className="read" aria-label="Sent" />)}
                        </span>
                      </p>
                    )}
                    {reacts.length > 0 && (
                      <span className="reacts">
                        {reacts.map(([emoji, ids]) => (
                          <button type="button" key={emoji}
                                  className={`react is-inline ${ids.includes(me) ? "mine" : ""}`}
                                  onClick={() => onReact(m.id, emoji)}
                                  aria-pressed={ids.includes(me)}
                                  aria-label={`${emoji}, ${ids.length}`}>
                            {emoji} {ids.length}
                          </button>
                        ))}
                      </span>
                    )}
                    {!m.deletedAt && (
                      <span className="msg-acts">
                        <button type="button" className="icon-btn is-inline"
                                onClick={() => onReplyTo(m.id)} aria-label="Reply to this">
                          <CornerUpLeft aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-btn is-inline"
                                onClick={() => onReact(m.id, "👍")} aria-label="React with a thumbs up">
                          <SmilePlus aria-hidden="true" />
                        </button>
                        <button type="button" className="icon-btn is-inline"
                                onClick={(e) => onMenu(e.currentTarget, { message: m })}
                                aria-label="More for this message">
                          <MoreHorizontal aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!list.length && (
            <p className="pane-none">Say the first thing and the squadron starts.</p>
          )}
        </div>
        {typing.length > 0 && (
          <p className="typingrow">
            <Avatar id={typing[0]} name={who(typing[0])} size="sm" />
            <span>
              {typing.length === 1
                ? `${who(typing[0])} is typing`
                : `${typing.length} people are typing`}
            </span>
            <span className="tdots" aria-hidden="true"><i /><i /><i /></span>
          </p>
        )}
      </div>

      {!stuck && (
        <button type="button" className="jump"
                onClick={() => { setStuck(true); const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }}>
          <ChevronDown aria-hidden="true" />
          {unread > 0 ? `${unread} new` : "Latest"}
        </button>
      )}

      {replyTo && (() => {
        const r = parentOf(replyTo);
        if (!r) return null;
        return (
          <div className="replying">
            <div>
              <b>Replying to {r.authorId === me ? "you" : who(r.authorId)}</b>
              <span>{r.body || "Message removed"}</span>
            </div>
            <button type="button" className="icon-btn is-inline" onClick={() => onReplyTo(null)}
                    aria-label="Stop replying">
              <X aria-hidden="true" />
            </button>
          </div>
        );
      })()}

      <Composer value={draft} onChange={onDraft} onSend={onSend} sending={sending}
                placeholder={`Message ${squadron.name}`} />
    </>
  );
}
