import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, Search, Plus, Send, Flag, Ban, Radio, MessageSquare, ArrowBigUp,
} from "lucide-react";
import {
  matches, presenceRail, PRESENCE_SHOWN,
  titleOf, excerptOf, isAnswered, answerCount, waitingCount,
  FEED_FILTERS, applyFeedFilter, nestAnswers, isMine, orderThreads, rowUnread,
} from "../../lib/roomModel.js";
import { initials, hueFor, ago } from "../../lib/familiar.js";
import { mmss } from "../module/lessonState.js";
import "./room.css";

/* ============================================================================
   THE READY ROOM — a desktop-messaging layout with one important twist:
   SQUADRONS ARE GROUP CHATS, MODULES ARE QUESTION FEEDS.

   That twist is the whole design. A squadron is people you know, talking; a
   module is a body of questions that outlives whoever asked them. Those want
   opposite shapes — a transcript you skim and forget, versus a feed you search
   and answer — and the old room tried to be one thing for both.

   What makes the rail read as ONE list rather than a chat list stacked on a
   channel tree: squadron rows and module rows use the SAME grid. Leading mark,
   name, time, snippet, badge. Only the content differs.

   TOKENS. Everything here uses the app's real tokens — --ground --panel
   --raised --sunk --edge --t1/2/3 --active --caution --ok. The brief's list
   (--bg-ground, --hairline, --text-primary, --accent-interactive) describes a
   different codebase; so does the reference demo's (--ink, --accent). Neither
   exists here, and inventing them would be the second design system the brief
   forbids in its first line.

   LIVERIES. §6 prescribes a CSS hue-triplet so a theme rule cannot overwrite a
   livery rule. That trap cannot occur in this app: liveryEngine.js computes
   every token in JS and writes it as an INLINE STYLE on documentElement, which
   beats any stylesheet rule regardless of specificity. Adding the prescribed
   CSS would be dead code that looks authoritative. The requirement it protects
   — an accent that survives a theme switch — is already met, and
   check:contrast measures it across every livery x variant.
   ========================================================================= */

/* A short, absolute time for a list row: the clock today, the weekday this
   week, then the date. Relative time ("2 days ago") is right for a single
   item and wrong for a column of them, where the eye wants to compare. */
function when(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((now - d) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
const dayLabel = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
};

/* §4a — consecutive messages from one sender collapse: the avatar and the
   name appear only on the first of a run, and a run breaks on a new day. */
function runs(messages = []) {
  const out = [];
  let lastBy = null, lastDay = null;
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString();
    if (day !== lastDay) { out.push({ divider: dayLabel(m.createdAt), id: `d-${day}` }); lastBy = null; lastDay = day; }
    out.push({ ...m, first: m.authorId !== lastBy });
    lastBy = m.authorId;
  }
  return out;
}

function Avatar({ id, who, size = "" }) {
  return (
    <span className={`av ${size}`.trim()} style={{ "--av-h": hueFor(id) }} aria-hidden="true">
      {initials(who(id))}
    </span>
  );
}

export default function ReadyRoom({
  me = "u_you", modules = [], activeModuleCode,
  threads = [], replies = [], people = [], presence = [],
  squadrons = [], messages = [], seen = {}, chapters = [],
  seatCandidates = [], votes = {},
  brand = null, profile = null,
  onOpenLessonAt, onPost, onReport, onBlock, onSeen, onVote, onBest,
}) {
  // WHAT THE PANE IS SHOWING. One piece of state, not four booleans: the four
  // states are mutually exclusive and a boolean each is how two of them end up
  // on screen together.
  const [view, setView] = useState(null);     // {kind:'squadron'|'module'|'thread'|'seat', id, threadId}
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({}); // per module — §4b, and only here
  const [draft, setDraft] = useState("");
  // §5 — a thread asked here NEEDS a title, because a feed of untitled
  // paragraphs cannot be scanned. Two fields, and the title is required; the
  // lesson comment box deliberately gets neither.
  const [asking, setAsking] = useState(null);   // {moduleId} | null
  const [askTitle, setAskTitle] = useState("");
  // The ask form gets its OWN body. It shared `draft` with the reply composer,
  // and back() cleared neither — so typing half a reply, going back, and
  // opening "Ask the module" pre-filled the question with the abandoned reply,
  // one Enter away from publishing it.
  const [askBody, setAskBody] = useState("");
  const paneRef = useRef(null);
  const listRef = useRef(null);
  const scrollRef = useRef(null);

  const who = (id) => (id === me ? "You"
    : people.find((p) => p.id === id)?.callsign || "Someone");
  const rail = useMemo(() => presenceRail(presence, PRESENCE_SHOWN), [presence]);

  const open = (next) => {
    setView(next);
    setDraft("");
    setAsking(null); setAskTitle("");
    // THE KEY MUST BE WHAT THE BADGE READS. badgeCount tests
    // seen[thread.id]; chatUnread tests seen[squadron.id]. Stamping next.id
    // for a thread wrote the MODULE code — a key nothing reads — so opening
    // the reply you were notified about left the badge lit for ever.
    const seenKey = next?.kind === "thread" ? next.threadId : next?.id;
    if (seenKey) onSeen?.(seenKey);
    requestAnimationFrame(() => paneRef.current?.focus());
  };
  const back = () => {
    // Leaving a conversation abandons what was typed in it.
    setDraft(""); setAsking(null); setAskTitle(""); setAskBody("");
    // §4c — from a thread the arrow returns to the module feed, not the rail.
    if (view?.kind === "thread") { setView({ kind: "module", id: view.id }); return; }
    setView(null);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const squadron = view?.kind === "squadron" ? squadrons.find((s) => s.id === view.id) : null;
  const mod = (view?.kind === "module" || view?.kind === "thread")
    ? modules.find((m) => (m.code || m.id) === view.id) : null;
  const modThreads = useMemo(
    () => threads.filter((t) => t.moduleId === (mod?.code || mod?.id)),
    [threads, mod]);
  const thread = view?.kind === "thread" ? modThreads.find((t) => t.id === view.threadId) : null;

  // The transcript sticks to the bottom, the way every chat does.
  useEffect(() => {
    if (view?.kind !== "squadron") return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view, messages.length]);

  /* Filtered once, because the rail needs to know whether the SEARCH emptied
     it — not just whether a section happens to be empty. Typing something that
     matches nothing used to leave two bare headings and no words at all: the
     list vanished and nothing said why or how to get it back. */
  const shownSquadrons = squadrons.filter((s) => matches(query, s.name, s.code));
  const shownModules = modules.filter((m) => matches(query, m.name, m.code || m.id));
  const searchFoundNothing = Boolean(query.trim()) && !shownSquadrons.length && !shownModules.length;

  const online = new Set(rail.all.map((p) => p.user_id));
  const lessonOf = (lid) => {
    for (const c of chapters) for (const l of (c.lessons || [])) if (l.id === lid) return { c, l };
    return null;
  };
  const lessonTag = (t) => {
    if (!t.lessonId) return null;
    const found = lessonOf(t.lessonId);
    return found ? `From ${found.l.title}` : "From a lesson";
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    if (view?.kind === "squadron") onPost?.({ kind: "message", squadronId: view.id, body });
    else if (view?.kind === "thread") onPost?.({ kind: "reply", threadId: view.threadId, body });
    setDraft("");
  };

  return (
    <div className="room" data-mobile={view ? "pane" : "rail"}>
      {!view && <h1 className="room-h1">Ready Room</h1>}

      {/* ===================================================== §3 · RAIL === */}
      <aside className="rail" ref={listRef} tabIndex={-1} aria-label="Squadrons and modules">
        <div className="rail-top">
          <div className="mark">
            {brand}
            <span>Ready Room</span>
          </div>
          <button type="button" className="icon-btn is-inline" aria-label="New thread"
                  onClick={() => {
                    const code = mod?.code || activeModuleCode;
                    open({ kind: "module", id: code });
                    setAsking({ moduleId: code });
                  }}>
            <Plus aria-hidden="true" />
          </button>
          {profile}
        </div>

        <div className="search">
          <Search aria-hidden="true" />
          <input type="search" value={query} placeholder="Search squadrons and threads"
                 aria-label="Search squadrons and threads"
                 onChange={(e) => setQuery(e.target.value)} />
        </div>

        {/* §3 — the right seat block: three faces you most recently studied
            with, then the way to everyone else. */}
        <div className="rightseat">
          <p className="eyebrow">Right seat</p>
          {rail.shown.length ? (
            <div className="seat-row">
              {rail.shown.map((p) => (
                <button type="button" key={p.user_id} className="seat is-inline"
                        onClick={() => open({ kind: "seat" })}
                        aria-label={`${who(p.user_id)}, online. Open the right seat.`}>
                  <span className="seat-av">
                    <Avatar id={p.user_id} who={who} />
                    <i className="dot on" aria-hidden="true" />
                  </span>
                  <span className="seat-name">{who(p.user_id).split(" ")[0]}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="seat-none">You haven&rsquo;t flown with anyone yet.</p>
          )}
          <button type="button" className="seat-cta"
                  aria-current={view?.kind === "seat" ? "true" : undefined}
                  onClick={() => open({ kind: "seat" })}>
            <Radio aria-hidden="true" /> Find a right seat
          </button>
        </div>

        <div className="rail-scroll">
          {searchFoundNothing && (
            <p className="rail-none">Clear the search to see every squadron and module.</p>
          )}
          {!searchFoundNothing && <p className="group-head"><b>Squadrons</b></p>}
          {shownSquadrons.map((s) => {
            const last = messages.filter((m) => m.squadronId === s.id).slice(-1)[0];
            const unread = messages.filter(
              (m) => m.squadronId === s.id && m.authorId !== me
                && (Date.parse(m.createdAt) || 0) > (seen[s.id] || 0)).length;
            return (
              <button type="button" key={s.id} className="row"
                      aria-current={view?.kind === "squadron" && view.id === s.id ? "true" : undefined}
                      onClick={() => open({ kind: "squadron", id: s.id })}>
                <span className="av lg sq" style={{ "--av-h": hueFor(s.id) }} aria-hidden="true">
                  {(s.code || s.name || "?").slice(0, 2).toUpperCase()}
                </span>
                <span className="row-line">
                  <span className="row-name">{s.name}</span>
                  <span className="row-time">{last ? when(last.createdAt) : ""}</span>
                </span>
                <span className="row-snip">
                  {last ? (<><em>{who(last.authorId)}:</em> {last.body}</>) : "Say the first thing"}
                </span>
                <span className="row-meta">{unread > 0 && <span className="badge">{unread}</span>}</span>
              </button>
            );
          })}
          {/* Only when there are genuinely none — during a search that matched
              nothing the rail already says one thing, and two messages under
              one empty list is worse than none. */}
          {!searchFoundNothing && !squadrons.length && (
            <p className="rail-none">Join a squadron and it appears here.</p>
          )}

          {!searchFoundNothing && <p className="group-head"><b>Modules</b></p>}
          {shownModules.map((m) => {
            const code = m.code || m.id;
            const mine = threads.filter((t) => t.moduleId === code);
            const newest = [...mine].sort(
              (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
            const waiting = waitingCount(mine);
            const cur = (view?.kind === "module" || view?.kind === "thread") && view.id === code;
            return (
              <button type="button" key={code} className="row"
                      aria-current={cur ? "true" : undefined}
                      onClick={() => open({ kind: "module", id: code })}>
                <span className="mod-icon" aria-hidden="true">{code}</span>
                <span className="row-line">
                  <span className="row-name">{m.name}</span>
                  <span className="row-time">{newest ? when(newest.createdAt) : ""}</span>
                </span>
                <span className="row-snip">
                  {newest ? titleOf(newest) : "Ask the first question"}
                </span>
                <span className="row-meta">
                  {waiting > 0 && <span className="badge">{waiting}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ===================================================== §4 · PANE === */}
      <main className="pane" ref={paneRef} tabIndex={-1} aria-label="Conversation">
        {!view && (
          <div className="pane-blank"><p>Pick a squadron or a module.</p></div>
        )}

        {/* ------------------------------------------- §4a squadron chat --- */}
        {squadron && (
          <>
            <header className="pane-head">
              <button type="button" className="back is-inline" onClick={back} aria-label="Back">
                <ChevronLeft aria-hidden="true" />
              </button>
              <span className="av lg sq" style={{ "--av-h": hueFor(squadron.id) }} aria-hidden="true">
                {(squadron.code || "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="h-id">
                <h2 className="h-title">{squadron.name}</h2>
                <p className="h-sub">
                  {squadron.members?.length || 0} member{squadron.members?.length === 1 ? "" : "s"}
                  {" · "}
                  {(squadron.members || []).filter((m) => online.has(m.user_id)).length} online
                </p>
              </div>
            </header>

            <div className="scroll" ref={scrollRef}>
              <div className="transcript">
                {runs(messages.filter((m) => m.squadronId === squadron.id)).map((m) => (
                  m.divider ? (
                    <p className="daybreak" key={m.id}>{m.divider}</p>
                  ) : (
                    <div key={m.id} className={`msg${m.authorId === me ? " out" : ""}${m.first ? " first" : ""}`}>
                      <Avatar id={m.authorId} who={who} size="sm" />
                      <div className="bubble">
                        {m.first && m.authorId !== me && <p className="who">{who(m.authorId)}</p>}
                        <p>
                          {m.body}
                          <span className="stamp">{when(m.createdAt)}</span>
                        </p>
                        <span className="msg-acts">
                          <button type="button" className="icon-btn is-inline"
                                  onClick={() => onReport?.({ kind: "message", id: m.id, authorId: m.authorId, squadronId: squadron.id })}
                                  aria-label="Report this message"><Flag aria-hidden="true" /></button>
                          {m.authorId !== me && (
                            <button type="button" className="icon-btn is-inline"
                                    onClick={() => onBlock?.(m.authorId)}
                                    aria-label={`Block ${who(m.authorId)}`}><Ban aria-hidden="true" /></button>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                ))}
                {!messages.filter((m) => m.squadronId === squadron.id).length && (
                  <p className="pane-none">Say the first thing and the room starts.</p>
                )}
              </div>
            </div>

            <Composer value={draft} onChange={setDraft} onSend={send}
                      placeholder={`Message ${squadron.name}`} />
          </>
        )}

        {/* --------------------------------------------- §4b module feed --- */}
        {mod && !thread && (() => {
          const code = mod.code || mod.id;
          const f = filters[code] || "all";
          // ORDERED, not raw. The query has no .order() and nothing sorted
          // downstream, so the feed rendered in whatever order Postgres
          // happened to return — which for a question feed means the thing
          // waiting on you can sit anywhere. orderThreads is the room's
          // existing rule: what has moved since you last looked first, then
          // most recent activity.
          const list = orderThreads(applyFeedFilter(modThreads, f, { me, replies }), {
            unread: (t) => rowUnread(t, replies, seen, me),
            lastAt: (t) => replies
              .filter((r) => r.threadId === t.id)
              .reduce((x, r) => Math.max(x, Date.parse(r.createdAt) || 0), 0),
          });
          return (
            <>
              <header className="pane-head">
                <button type="button" className="back is-inline" onClick={back} aria-label="Back">
                  <ChevronLeft aria-hidden="true" />
                </button>
                <span className="mod-icon" aria-hidden="true">{code}</span>
                <div className="h-id">
                  <h2 className="h-title">{mod.name}</h2>
                  <p className="h-sub">
                    {modThreads.length} thread{modThreads.length === 1 ? "" : "s"}
                    {" · "}{waitingCount(modThreads)} waiting on an answer
                  </p>
                </div>
              </header>

              <div className="scroll">
                <div className="feed">
                  <div className="chips">
                    {FEED_FILTERS.map((c) => (
                      <button type="button" key={c.id} className="chip is-inline"
                              aria-pressed={f === c.id}
                              onClick={() => setFilters((s) => ({ ...s, [code]: c.id }))}>
                        {c.label}
                      </button>
                    ))}
                    <span className="chips-sp" />
                    <button type="button" className="newpost is-inline"
                            onClick={() => setAsking({ moduleId: code })}>
                      <Plus aria-hidden="true" /> Ask the module
                    </button>
                  </div>

                  {asking?.moduleId === code && (
                    <form className="ask-form" onSubmit={(e) => {
                      e.preventDefault();
                      const title = askTitle.trim(); const body = askBody.trim();
                      if (!title || !body) return;
                      onPost?.({ kind: "thread", moduleId: code, title, body });
                      setAsking(null); setAskTitle(""); setAskBody("");
                    }}>
                      <label className="ask-l" htmlFor="ask-title">Your question</label>
                      <input id="ask-title" className="ask-t" value={askTitle} autoFocus
                             placeholder="What are you stuck on?"
                             onChange={(e) => setAskTitle(e.target.value)} />
                      <textarea className="ask-b" rows={3} value={askBody}
                                placeholder="Say a bit more — what you tried, and what you expected."
                                onChange={(e) => setAskBody(e.target.value)} />
                      <div className="ask-acts">
                        <button type="button" className="chip is-inline"
                                onClick={() => { setAsking(null); setAskTitle(""); setAskBody(""); }}>
                          Cancel
                        </button>
                        <button type="submit" className="newpost is-inline"
                                disabled={!askTitle.trim() || !askBody.trim()}>
                          Ask the module
                        </button>
                      </div>
                    </form>
                  )}

                  {list.map((t) => {
                    const n = answerCount(t, replies);
                    return (
                      <button type="button" key={t.id} className="post"
                              onClick={() => open({ kind: "thread", id: code, threadId: t.id })}>
                        <span className="post-top">
                          <Avatar id={t.authorId} who={who} size="sm" />
                          <span className="who2">{who(t.authorId)}</span>
                          <span>·</span><span>{when(t.createdAt)}</span>
                          {lessonTag(t) && <span className="tag lesson">{lessonTag(t)}</span>}
                          {isAnswered(t) && <span className="tag solved">Answered</span>}
                          {isMine(t, replies, me) && <span className="tag mine">Yours</span>}
                        </span>
                        <span className="post-title">{titleOf(t)}</span>
                        {excerptOf(t) && <span className="post-ex">{excerptOf(t)}</span>}
                        {/* A question with no answers said "0 answers" and
                            "Nobody has answered this yet" — a zero count and a
                            statement of absence, which the voice section
                            forbids in the same sentence. It names the action
                            now, in the house phrasing the empty pane already
                            uses ("Ask the first question in this module"). */}
                        <span className="post-foot">
                          {n > 0
                            ? <span><MessageSquare aria-hidden="true" />{n} {n === 1 ? "answer" : "answers"}</span>
                            : <span className="post-waiting"><MessageSquare aria-hidden="true" />Be the first to answer</span>}
                        </span>
                      </button>
                    );
                  })}

                  {!list.length && (
                    <p className="pane-none">
                      {/* Both name the way out rather than the emptiness. The
                          second used to open "Nothing here under this filter",
                          which states absence first and only then helps. */}
                      {f === "all" ? "Ask the first question in this module."
                        : "All shows every question in this module."}
                    </p>
                  )}
                </div>
              </div>
            </>
          );
        })()}

        {/* ------------------------------------------------- §4c a thread --- */}
        {thread && (
          <>
            <header className="pane-head">
              <button type="button" className="back is-inline" onClick={back}
                      aria-label={`Back to ${mod?.name || "the module"}`}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <span className="mod-icon" aria-hidden="true">{mod?.code || mod?.id}</span>
              <div className="h-id">
                {/* The QUESTION, not the word "Thread". Every other pane head
                    names what you are looking at; this one named the type,
                    which tells you nothing and makes two threads
                    indistinguishable once you are inside one. titleOf falls
                    back to the first line and caps its own length. */}
                <h2 className="h-title">{titleOf(thread)}</h2>
                <p className="h-sub">{mod?.name}</p>
              </div>
            </header>

            <div className="scroll">
              <div className="thread">
                <article className="op">
                  <p className="post-top">
                    <Avatar id={thread.authorId} who={who} size="sm" />
                    <span className="who2">{who(thread.authorId)}</span>
                    <span>·</span><span>{when(thread.createdAt)}</span>
                    {lessonTag(thread) && (
                      <button type="button" className="tag lesson is-inline"
                              onClick={() => onOpenLessonAt?.(thread)}>
                        {lessonTag(thread)}{thread.t != null ? ` · ${mmss(thread.t)}` : ""}
                      </button>
                    )}
                  </p>
                  <h3 className="op-title">{titleOf(thread)}</h3>
                  {excerptOf(thread) && (
                    <div className="op-body">
                      {String(excerptOf(thread)).split(/\n{2,}/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  )}
                </article>

                <p className="answers-head">
                  {answerCount(thread, replies)} {answerCount(thread, replies) === 1 ? "answer" : "answers"}
                </p>

                {nestAnswers(replies, thread.id).map((a) => {
                  const v = votes[a.id] || { count: 0, mine: false };
                  const best = thread.bestReplyId === a.id;
                  return (
                    <div key={a.id} className={`ans${best ? " best" : ""}`}>
                      <Avatar id={a.authorId} who={who} size="sm" />
                      <div className="ans-main">
                        <p className="ans-head">
                          <b>{who(a.authorId)}</b>
                          <span>{when(a.createdAt)}</span>
                          {best && <span className="tag solved">Best answer</span>}
                        </p>
                        <p className="ans-body">{a.body}</p>
                        <p className="ans-acts">
                          <button type="button" className="is-inline" aria-pressed={v.mine}
                                  onClick={() => onVote?.(a.id, !v.mine)}
                                  aria-label={`${v.count} found this useful. ${v.mine ? "Take back" : "Add"} yours.`}>
                            <ArrowBigUp aria-hidden="true" />{v.count}
                          </button>
                          {/* §4c — only the asker marks the best answer. */}
                          {thread.authorId === me && (
                            <button type="button" className="is-inline"
                                    onClick={() => onBest?.(thread.id, best ? null : a.id)}>
                              {best ? "Not the one" : "This answered it"}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {!answerCount(thread, replies) && (
                  <p className="pane-none">No answers yet. Yours would be the first.</p>
                )}
              </div>
            </div>

            <Composer value={draft} onChange={setDraft} onSend={send} placeholder="Write an answer" />
          </>
        )}

        {/* ---------------------------------------------- §4d right seat --- */}
        {view?.kind === "seat" && (
          <>
            <header className="pane-head">
              <button type="button" className="back is-inline" onClick={back} aria-label="Back">
                <ChevronLeft aria-hidden="true" />
              </button>
              <div className="h-id">
                <h2 className="h-title">Right seat</h2>
                <p className="h-sub">People from your squadrons who can study with you now</p>
              </div>
            </header>

            <div className="scroll">
              <div className="match">
                <div className="match-intro">
                  <h3>Who&rsquo;s free to fly?</h3>
                  <p>
                    You can only take the right seat with someone you share a squadron
                    with. Sorted by who you flew with most recently.
                  </p>
                </div>
                {seatCandidates.length ? (
                  <div className="cards">
                    {seatCandidates.map((p) => (
                      <div className="card" key={p.user_id}>
                        <div className="card-top">
                          <span className="seat-av">
                            <Avatar id={p.user_id} who={who} size="lg" />
                            <i className="dot on" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="card-n">{who(p.user_id)}</p>
                            <p className="card-s">
                              {squadrons.find((s) => s.id === p.squadronId)?.name || "Your squadron"}
                            </p>
                          </div>
                        </div>
                        <p className="card-now">
                          {p.module_code
                            ? `${p.module_code}${p.chapter_id ? ` · ${p.chapter_id}` : ""}`
                            : `Last seen ${ago(p.last_seen)}`}
                        </p>
                        <button type="button" className="ask"
                                onClick={() => onPost?.({ kind: "seat", to: p.user_id })}>
                          Ask to fly
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pane-none">
                    Nobody from your squadrons is in the room right now. Leave a
                    request and the first one back will see it.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* §4a — one pill holding the growing textarea, with the send button outside
   it. Enter sends, Shift+Enter newlines. */
function Composer({ value, onChange, onSend, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);
  return (
    <div className="composer">
      <div className="pill">
        <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
                  }} />
      </div>
      <button type="button" className="send" onClick={onSend} disabled={!value.trim()}
              aria-label="Send">
        <Send aria-hidden="true" />
      </button>
    </div>
  );
}
