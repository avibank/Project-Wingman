import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Radio, Flag, Ban } from "lucide-react";
import {
  isAnchored, originOf, orderThreads, applyFilter, byModule, openByDefault,
  rowUnread, matches, FILTERS,
} from "../../lib/roomModel.js";
import { initials, hueFor, ago } from "../../lib/familiar.js";
import { mmss } from "../module/lessonState.js";
import { FlightProfile } from "../module/Instruments.jsx";
import "./room.css";

// Declared above the component: a dependency array is evaluated during render,
// so a const declared below is in the temporal dead zone.
const toggle = (set, k) => {
  const next = new Set(set);
  if (next.has(k)) next.delete(k); else next.add(k);
  return next;
};

// §4 — a desktop-messaging shell: a sidebar of conversations, a main pane.
//
// THE CRITICAL RULE: every row in the sidebar opens something in the main pane.
// Modules are HEADINGS, not destinations. Making a module row open a thread
// list adds a third navigation level, and a two-pane layout has nowhere to put
// one.
//
// §3 — the room holds two genuinely different registers and they must not
// converge. A THREAD is a question with answers: author, then replies, no
// bubbles, because it is writing that improves the lesson over time. A SQUADRON
// CHAT is a group chat: bubbles, own messages right, day separators, fast and
// disposable. If they looked alike, thread quality would collapse into chatter.

export default function ReadyRoom({
  me = "u_you", modules = [], activeModuleCode,
  threads = [], replies = [], people = [], presence = [],
  squadrons = [], messages = [], seen = {}, chapters = [],
  onOpenLessonAt, onPost, onReport, onBlock, onSeen,
}) {
  const [openId, setOpenId] = useState(null);     // what the main pane shows
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const listRef = useRef(null);
  const paneRef = useRef(null);

  const who = (id) => (id === me ? "You" : people.find((p) => p.id === id)?.callsign || id);
  const teaches = (id) => people.find((p) => p.id === id)?.role === "instructor";
  const replyCount = (tid) => replies.filter((r) => r.threadId === tid).length;
  const lessonOf = (lid) => {
    for (const c of chapters) for (const l of (c.lessons || [])) if (l.id === lid) return { c, l };
    return null;
  };
  const originFor = (t) => originOf(t, {
    chapterOf: (lid) => lessonOf(lid)?.c.title,
    lessonName: (lid) => lessonOf(lid)?.l.title,
    mmss,
  });

  const grouped = useMemo(() => {
    const visible = threads.filter((t) => matches(query, t.body, t.moduleId, who(t.authorId)));
    return byModule(visible);
  }, [threads, query, people]);

  const openThread = threads.find((t) => t.id === openId) || null;
  const openSquadron = squadrons.find((s) => s.id === openId) || null;
  const rightSeat = openId === "__rightseat__";

  const open = (id) => {
    setOpenId(id);
    onSeen?.(id);
    // §11 — focus moves to the conversation when it opens.
    requestAnimationFrame(() => paneRef.current?.focus());
  };
  const back = () => {
    setOpenId(null);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  return (
    <div className="room" data-open={openId ? "1" : "0"}>
      {/* ------------------------------------------------------ the sidebar */}
      <aside className="room-side" ref={listRef} tabIndex={-1} aria-label="Conversations">
        <div className="room-top">
          <div className="room-search">
            <Search aria-hidden="true" />
            <input type="search" value={query} placeholder="Search threads and squadrons"
                   aria-label="Search threads and squadrons"
                   onChange={(e) => setQuery(e.target.value)} />
          </div>

          {/* §4 — the presence strip. §11: the status is in the accessible
              name, never carried by the dot's colour alone. */}
          <div className="room-presence">
            <span className="room-presence-label">In the room</span>
            <ul className="room-faces">
              {presence.slice(0, 6).map((p) => (
                <li key={p.user_id}>
                  <button type="button" className="room-face" onClick={() => open("__rightseat__")}
                          aria-label={`${who(p.user_id)}, online`}
                          style={{ "--av-h": hueFor(p.user_id) }}>
                    {initials(who(p.user_id))}
                    <i className="room-dot" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {presence.length === 0 && (
                <li className="room-quiet">Nobody in the room just now.</li>
              )}
            </ul>
            <button type="button" className="room-seat" onClick={() => open("__rightseat__")}>
              <Radio aria-hidden="true" /> Right seat
            </button>
          </div>
        </div>

        <div className="room-list">
          {/* Squadrons first — they are global, and they are the rows people
              return to most. */}
          <Section title="Squadrons" open={!collapsed.has("__sq__")}
                   onToggle={() => setCollapsed((c) => toggle(c, "__sq__"))}>
            {squadrons.filter((s) => matches(query, s.name, s.code)).map((s) => {
              const unread = s.unread || 0;
              return (
                <button key={s.id} type="button" className="room-row" data-active={openId === s.id ? "1" : undefined}
                        onClick={() => open(s.id)}
                        aria-label={`${s.name}, squadron${unread ? `, ${unread} unread` : ""}`}>
                  <span className="room-patch" style={{ "--av-h": hueFor(s.id) }}>{s.code}</span>
                  <span className="room-row-main">
                    <span className="room-row-title">{s.name}</span>
                    <span className="room-row-sub">{s.preview || "No messages yet"}</span>
                  </span>
                  <span className="room-row-end">
                    <span className="room-row-when">{s.at ? ago(s.at) : ""}</span>
                    {unread > 0 && <span className="room-badge">{unread > 9 ? "9+" : unread}</span>}
                  </span>
                </button>
              );
            })}
            {squadrons.length === 0 && (
              <p className="room-empty">Join a squadron and it appears here.</p>
            )}
          </Section>

          {/* One section per module. §9 — modules you are not studying start
              collapsed, because an active module fills this list fast. */}
          {modules.map((mod) => {
            const key = mod.code || mod.id;
            const all = grouped.get(key) || [];
            const shown = orderThreads(
              applyFilter(all, filter, { replyCount, me }),
              { unread: (t) => rowUnread(t, replies, seen, me) },
            );
            const isOpen = collapsed.has(key) ? false : openByDefault(key, activeModuleCode);
            return (
              <Section key={key} title={mod.name} count={all.length}
                       open={isOpen}
                       onToggle={() => setCollapsed((c) => toggle(c, key))}>
                {isOpen && (
                  <>
                    {/* §9 — the filter row, built in from the start. */}
                    <div className="room-filters" role="group" aria-label={`Filter ${mod.name} threads`}>
                      {FILTERS.map((f) => (
                        <button key={f.id} type="button" className="room-filter"
                                aria-pressed={filter === f.id}
                                onClick={() => setFilter(f.id)}>{f.label}</button>
                      ))}
                    </div>

                    {shown.map((t) => {
                      const n = replyCount(t.id);
                      const dot = rowUnread(t, replies, seen, me);
                      return (
                        <button key={t.id} type="button" className="room-row"
                                data-active={openId === t.id ? "1" : undefined}
                                onClick={() => open(t.id)}
                                aria-label={`${t.body.slice(0, 60)}, ${n} ${n === 1 ? "reply" : "replies"}${dot ? ", unread" : ""}`}>
                          <span className="av" style={{ "--av-h": hueFor(t.authorId) }} aria-hidden="true">
                            {initials(who(t.authorId))}
                          </span>
                          <span className="room-row-main">
                            <span className="room-row-title">{t.body}</span>
                            <span className="room-row-sub">
                              {n} {n === 1 ? "reply" : "replies"} · {who(t.authorId)}
                            </span>
                            {/* §9 — the origin, always. Three threads about one
                                lesson are indistinguishable without it. */}
                            <span className="room-row-origin">{originFor(t)}</span>
                          </span>
                          {/* §8 — the quiet second level of unread. Never in
                              the app-bar badge; only here, only while you are
                              in the room. */}
                          {dot && <span className="room-dot-row" aria-hidden="true" />}
                        </button>
                      );
                    })}

                    {shown.length === 0 && (
                      <p className="room-empty">
                        {filter === "unanswered" ? "Every question here has an answer."
                          : filter === "mine" ? "Ask one and it appears here."
                            : "Start the first thread for this module."}
                      </p>
                    )}

                    {/* §4 — each module section ends with its own action. */}
                    <button type="button" className="room-new"
                            onClick={() => onPost?.({ kind: "new-thread", moduleId: key })}>
                      New thread in {mod.name}
                    </button>
                  </>
                )}
              </Section>
            );
          })}
        </div>
      </aside>

      {/* ----------------------------------------------------- the main pane */}
      <section className="room-main" ref={paneRef} tabIndex={-1} aria-label="Conversation">
        {!openId && (
          <div className="room-blank">
            <p>Pick a thread or a squadron.</p>
          </div>
        )}

        {openThread && (
          <ThreadView
            thread={openThread} replies={replies.filter((r) => r.threadId === openThread.id)}
            who={who} teaches={teaches} origin={originFor(openThread)}
            onBack={back} onOpenLessonAt={onOpenLessonAt} onReport={onReport} onBlock={onBlock}
            onPost={(body) => onPost?.({ kind: "reply", threadId: openThread.id, body })}
          />
        )}

        {openSquadron && (
          <SquadronView
            squadron={openSquadron} messages={messages.filter((m) => m.squadronId === openSquadron.id)}
            who={who} me={me} presence={presence} chapters={chapters}
            onBack={back} onReport={onReport} onBlock={onBlock}
            onPost={(body) => onPost?.({ kind: "message", squadronId: openSquadron.id, body })}
          />
        )}

        {rightSeat && (
          <RightSeat candidates={presence} who={who} squadrons={squadrons}
                     onBack={back} onPost={onPost} />
        )}
      </section>
    </div>
  );
}

function Section({ title, count, open, onToggle, children }) {
  return (
    <section className="room-section">
      <button type="button" className="room-sec-head" aria-expanded={open} onClick={onToggle}>
        <ChevronRight aria-hidden="true" className="room-sec-chv" />
        <span>{title}</span>
        {count > 0 && <span className="room-sec-n">{count}</span>}
      </button>
      {open && <div className="room-sec-body">{children}</div>}
    </section>
  );
}

/* ---------------------------------------------------------- §5 THREAD VIEW */
// A question with answers. No bubbles — this is writing that improves the
// lesson, and it is meant to read like a page rather than a conversation.
function ThreadView({ thread, replies, who, teaches, origin, onBack, onOpenLessonAt, onReport, onBlock, onPost }) {
  const [body, setBody] = useState("");
  const anchored = isAnchored(thread);
  return (
    <>
      <header className="room-head">
        <button type="button" className="room-back" onClick={onBack} aria-label="Back to the list">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1 className="room-title">{thread.body}</h1>
          <p className="room-sub">{replies.length} {replies.length === 1 ? "answer" : "answers"} · {who(thread.authorId)}</p>
        </div>
      </header>

      {/* §5 — the origin bar. A mirrored thread says where it came from and
          offers the way there; a hub thread says plainly that it has no lesson,
          so nobody waits for a link that is never coming. */}
      <div className="room-origin" data-kind={anchored ? "mirrored" : "hub"}>
        {anchored ? (
          <>
            <span className="room-origin-t">{origin}</span>
            <button type="button" className="room-origin-go"
                    onClick={() => onOpenLessonAt?.(thread)}>
              Open the lesson at {mmss(thread.t)}
            </button>
            <span className="room-origin-note">It also appears under that lesson.</span>
          </>
        ) : (
          <span className="room-origin-note">
            Started here, and not attached to a lesson.
          </span>
        )}
      </div>

      <div className="room-body">
        <article className="room-answer is-question">
          <Avatar id={thread.authorId} who={who} />
          <div>
            <p className="room-a-head">
              <span className="room-a-name">{who(thread.authorId)}</span>
              {teaches(thread.authorId) && <span className="cmt-badge">Instructor</span>}
              <span className="room-a-when">{ago(thread.createdAt)}</span>
            </p>
            <p className="room-a-body">{thread.body}</p>
          </div>
        </article>

        {replies.map((r) => (
          <article key={r.id} className="room-answer">
            <Avatar id={r.authorId} who={who} />
            <div>
              <p className="room-a-head">
                <span className="room-a-name">{who(r.authorId)}</span>
                {teaches(r.authorId) && <span className="cmt-badge">Instructor</span>}
                <span className="room-a-when">{ago(r.createdAt)}</span>
                <button type="button" className="room-report"
                        onClick={() => onReport?.({ kind: "reply", id: r.id, authorId: r.authorId })}
                        aria-label="Report this answer"><Flag aria-hidden="true" /></button>
                {/* §10 — blocking hides both directions and removes the person
                    from the presence strip. Offered wherever a person speaks. */}
                <button type="button" className="room-report"
                        onClick={() => onBlock?.(r.authorId)}
                        aria-label={`Block ${who(r.authorId)}`}><Ban aria-hidden="true" /></button>
              </p>
              <p className="room-a-body">{r.body}</p>
            </div>
          </article>
        ))}
      </div>

      <Composer value={body} onChange={setBody} placeholder="Write an answer…"
                onSend={() => { onPost?.(body); setBody(""); }} />
    </>
  );
}

/* ------------------------------------------------------- §6 SQUADRON VIEW */
// A group chat — bubbles, own messages right — and above it the roster, which
// is flight profiles rather than progress bars. It reuses the module screen's
// own profile component, which is the point: one drawing of where somebody is.
function SquadronView({ squadron, messages, who, me, presence, chapters, onBack, onReport, onBlock, onPost }) {
  const [body, setBody] = useState("");
  const online = new Set(presence.map((p) => p.user_id));
  const roster = squadron.members || [];
  return (
    <>
      <header className="room-head">
        <button type="button" className="room-back" onClick={onBack} aria-label="Back to the list">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1 className="room-title">{squadron.name}</h1>
          <p className="room-sub">
            {roster.length} {roster.length === 1 ? "member" : "members"} ·{" "}
            {roster.filter((m) => online.has(m.user_id)).length} online
          </p>
        </div>
      </header>

      {/* §6 — the roster IS flight profiles. Do not substitute a progress bar. */}
      <ul className="room-roster">
        {roster.map((m) => {
          const at = m.atIndex ?? 0;
          return (
            <li key={m.user_id} className="room-crew">
              <span className="room-crew-head">
                <Avatar id={m.user_id} who={who} small />
                <span className="room-crew-name">{who(m.user_id)}</span>
                <span className="room-crew-state">
                  {online.has(m.user_id) ? "Online" : "Away"}
                </span>
              </span>
              {/* §11 — the position is in words as well as in the drawing. */}
              <FlightProfile chapters={chapters} atIndex={at} started={at > 0} />
            </li>
          );
        })}
        {roster.length === 0 && <li className="room-empty">Nobody has joined yet.</li>}
      </ul>

      <div className="room-chat">
        {messages.map((msg) => (
          <div key={msg.id} className="room-msg" data-own={msg.authorId === me ? "1" : undefined}>
            <span className="room-bubble">{msg.body}</span>
            <span className="room-msg-when">
              {ago(msg.createdAt)}
              <button type="button" className="room-report"
                      onClick={() => onReport?.({ kind: "message", id: msg.id, authorId: msg.authorId })}
                      aria-label="Report this message"><Flag aria-hidden="true" /></button>
              {msg.authorId !== me && (
                <button type="button" className="room-report"
                        onClick={() => onBlock?.(msg.authorId)}
                        aria-label={`Block ${who(msg.authorId)}`}><Ban aria-hidden="true" /></button>
              )}
            </span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="room-empty">Say the first thing and the room starts.</p>
        )}
      </div>

      <Composer value={body} onChange={setBody} placeholder={`Message ${squadron.name}…`}
                onSend={() => { onPost?.(body); setBody(""); }} />
    </>
  );
}

/* ---------------------------------------------------------- §7 RIGHT SEAT */
// The empty state matters more than the populated one: with a small user base
// nobody is online most of the time, and a feature that reads as broken the
// first three times is a feature nobody opens a fourth.
function RightSeat({ candidates, who, squadrons, onBack, onPost }) {
  return (
    <>
      <header className="room-head">
        <button type="button" className="room-back" onClick={onBack} aria-label="Back to the list">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <h1 className="room-title">Right seat</h1>
          <p className="room-sub">Someone to work through questions with, live.</p>
        </div>
      </header>

      <div className="room-body">
        {candidates.length > 0 ? (
          <ul className="room-seats">
            {candidates.map((p) => (
              <li key={p.user_id} className="room-seat-row">
                <Avatar id={p.user_id} who={who} />
                <div className="room-row-main">
                  <span className="room-row-title">{who(p.user_id)}</span>
                  <span className="room-row-sub">
                    {squadrons.find((s) => s.id === p.squadronId)?.name || "Your squadron"}
                    {p.module_code ? ` · on ${p.module_code}` : ""}
                  </span>
                </div>
                {/* One concrete thing to do. "Study together" is not an
                    activity; quizzing each other from the re-check queues is. */}
                <button type="button" className="room-go"
                        onClick={() => onPost?.({ kind: "right-seat", with: p.user_id })}>
                  Quiz each other
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="room-standing">
            <p className="room-a-body">
              Nobody from your squadrons is in the room right now.
            </p>
            <button type="button" className="room-go"
                    onClick={() => onPost?.({ kind: "standing-request" })}>
              Leave a standing request
            </button>
            <p className="room-row-sub">
              We will match you the next time one of them is here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Avatar({ id, who, small }) {
  return (
    <span className="av" data-size={small ? "sm" : undefined}
          style={{ "--av-h": hueFor(id) }} aria-hidden="true">
      {initials(who(id))}
    </span>
  );
}

// §4 — one composer at the foot, and its placeholder follows what is open.
function Composer({ value, onChange, placeholder, onSend }) {
  return (
    <div className="room-composer">
      <textarea rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
                onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="room-send" disabled={!value.trim()} onClick={onSend}>
        Send
      </button>
    </div>
  );
}
