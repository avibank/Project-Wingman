import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, MoreVertical } from "lucide-react";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import {
  thumbTile, clock, initials, hueFor, ago, replyCountLabel, toggleReplies, presenceFor,
  rowActions,
} from "../../lib/familiar.js";
import {
  observeSlot, notesFor, commentsFor, repliesFor,
  deleteNote, publishNote, postComment, postReply, editNote, isPin, upFrom,
} from "../../lib/lessonSurface.js";
import "./module.css";
import "./lesson.css";
import "./familiar.css";

// The lesson page. Four things, in this order, at every width:
//
//     lesson name  ->  player  ->  what comes next  ->  Notes | Comments
//
// A first year opens this and sees a video and a next button. Everything else
// lives inside the player or under one tab strip of two plain words. There is
// no sidebar, no margin column, no edge rail and no transcript — those were
// cancelled after a legibility review, because five novel surfaces before
// thirty seconds of video is the thing that intimidates, not any one of them.
//
// The player is NOT rendered here. This page renders an empty sized slot and
// the one player, which lives above the router, positions itself over it.
export default function LessonPage({
  module: mod, chapters, chapter, lesson, state, people = [], presence = [],
  onBack, onOpenLesson, onOpenQuiz, onSeekSaved, onComplete, onMarkDone, done,
}) {
  const { session, setSession, mutate, dispatchPlayer, setStage, requestSeek, setTab, clearWatch } = useSession();
  const slotRef = useRef(null);
  const watch = session.watchAt?.lessonId === lesson.id ? session.watchAt : null;

  // The slot is what is watched, not the player — the player leaves it.
  useEffect(() => {
    if (!slotRef.current) return undefined;
    return observeSlot(slotRef.current, dispatchPlayer);
  }, [dispatchPlayer]);

  // Hand the player this lesson, the slot to sit over, and where to report.
  useEffect(() => {
    setStage({
      lesson,
      slotEl: slotRef.current,
      // The mini player needs these to route back to this lesson from any page.
      chapterId: chapter.id,
      moduleCode: mod.code || mod.id,
      // Arriving from "Watch at 2:17" opens at that second instead of where
      // you left off — it is the only bridge from People back to the moment,
      // so it has to win over the saved position.
      resume: watch && lesson.duration
        ? watch.seconds / lesson.duration
        : state?.pos?.[lesson.id]?.pct || 0,
      onProgress: (p) => onSeekSaved?.(lesson.id, p),
      onSeek: (p) => onSeekSaved?.(lesson.id, p),
      onComplete: () => onComplete?.(lesson.id),
    });
    dispatchPlayer({ type: "load", lessonId: lesson.id, moduleId: mod.code || mod.id, seconds: 0 });
    if (watch) clearWatch();
    return () => setStage(null);
  }, [lesson.id]);

  const next = nextAfterLesson(chapters, chapter.id, lesson.id, state);
  const tab = session.tab;
  const myNotes = notesFor(session.notes, lesson.id);
  const comments = commentsFor(session.threads, lesson.id);
  const at = session.player.seconds || 0;
  const here = presenceFor(presence, lesson.id, people);

  return (
    <div className="mscreen lesson">
      {/* Up, not history. Tap a question in People and land here: history-back
          returns you to People, up takes you to the module. Up is predictable,
          cannot loop, and doubles as the breadcrumb this page was missing —
          and it is labelled with the destination, never a bare arrow. */}
      <button type="button" className="up" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        {upFrom({ kind: "lesson", moduleId: mod.code || mod.id, moduleName: mod.name })?.label || mod.name}
      </button>

      <div className="lesson-head">
        <span className="lesson-code">{lesson.code || lesson.id}</span>
        <h1 className="lesson-name">{lesson.title}</h1>
        <span className="lesson-where">{chapter.title} · {mod.name}</span>
      </div>

      {/* The watch layout: player in the main column, the chapter route beside
          it. This reverses "one column at every width", deliberately. What was
          cancelled was a sidebar of NOTES AND DOCUMENTS — novel content in a
          novel place on a screen that already had four other novel things. A
          lesson list beside a video is the least novel sidebar in education;
          the test was never "no second column", it was how many things here
          has this person never seen before. Below 1120 there is no sidebar —
          the route is the module screen you came from. */}
      <div className="watch">
      <div className="watch-main lesson-body">
        {/* An empty sized box. Never move the video node into it. */}
        <div className="player-slot" ref={slotRef} />

        {/* Directly under the player and above the tabs on purpose: under a
            comment list this is a footer nobody reaches. */}
        <div className="next-up">
          {next ? (
            <>
              <span className="next-label">Next</span>
              <a className="next-title" href="#next"
                 onClick={(e) => {
                   e.preventDefault();
                   if (next.kind === "quiz") onOpenQuiz(next.chapter);
                   else onOpenLesson(next.chapter, next.lesson);
                 }}>{nextLabel(next)}</a>
              <span className="next-meta">{nextWhere(next)}</span>
            </>
          ) : <span className="next-label">Last in this module</span>}
          {/* The manual half of the completion rule. It writes the same flag
              90% watched writes — one boolean, two writers — and it lives in
              this row rather than becoming a fifth thing on the page. */}
          <button type="button" className="next-done" aria-pressed={done}
                  onClick={() => onMarkDone?.(lesson.id, !done)}>
            {done ? "Done" : "Mark as done"}
          </button>
        </div>

        {/* Presence, and the face. WhatsApp's "last seen" and Netflix's
            "continue watching" — the most familiar signal that other humans
            exist in a piece of software, and the only one that works with zero
            classmates online, because it is past tense. No online dots. */}
        {here && (
          <div className="face">
            <span className="av" data-size="lg" aria-hidden="true"
                  style={{ "--av-h": hueFor(here.people[0].id) }}>
              {initials(here.people[0].callsign)}
            </span>
            <span>
              <span className="face-name">{here.label}</span>
              {/* Not "ask your teacher" — you are a student and the platform
                  does not teach. A person, a line, one action. */}
              <span className="face-line">Ask the module and it stays pinned to this moment.</span>
            </span>
            <button type="button" className="face-act" onClick={() => setTab("comments")}>
              Ask everyone
            </button>
          </div>
        )}

        <div className="ltabs" role="tablist" aria-label="Notes and comments">
          <button type="button" className="ltab" role="tab" aria-selected={tab === "notes"}
                  onClick={() => setTab("notes")}>
            Notes {myNotes.length > 0 && <span className="ltab-n">{myNotes.length}</span>}
          </button>
          <button type="button" className="ltab" role="tab" aria-selected={tab === "comments"}
                  onClick={() => setTab("comments")}>
            Comments {comments.length > 0 && <span className="ltab-n">{comments.length}</span>}
          </button>
        </div>

        {tab === "notes"
          ? <NotesTab notes={myNotes} at={at} lesson={lesson} moduleId={mod.code || mod.id}
                      onSeek={requestSeek} mutate={mutate} setSession={setSession} />
          : <CommentsTab comments={comments} replies={session.replies} at={at}
                         lesson={lesson} moduleName={mod.name} moduleId={mod.code || mod.id}
                         people={people} onSeek={requestSeek} mutate={mutate} />}
      </div>

      <Route chapters={chapters} here={lesson} state={state}
             onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} next={next} />
      </div>
    </div>
  );
}

// The route beside the player, sticky, with its own scroller. Same row as the
// module screen — one brightness for every title, the bar carries the state.
function Route({ chapters, here, state, onOpenLesson, next }) {
  const total = chapters.reduce((n, c) => n + (c.lessons?.length || 0), 0);
  const done = chapters.reduce((n, c) => n + (c.lessons || []).filter(
    (l) => Boolean(state?.done?.[l.id]) || (state?.pos?.[l.id]?.pct ?? 0) >= 0.9).length, 0);
  return (
    <aside className="route" aria-label="This module">
      <div className="route-head">
        <span className="route-title">This module</span>
        <span className="route-meta">{done} of {total} flown</span>
      </div>
      <div className="route-list">
        {chapters.map((ch) => (
          <div key={ch.id}>
            <p className="route-chapter">{ch.title}</p>
            {(ch.lessons || []).map((l) => {
              const isDoneL = Boolean(state?.done?.[l.id]) || (state?.pos?.[l.id]?.pct ?? 0) >= 0.9;
              const pct = state?.pos?.[l.id]?.pct || 0;
              return (
                <button key={l.id} type="button" className="rrow"
                        aria-current={l.id === here.id ? "true" : undefined}
                        onClick={() => onOpenLesson(ch, l)}>
                  <span className="rthumb" data-tile="" data-code={l.code || l.id}
                        data-done={isDoneL ? "1" : "0"} style={thumbTile(l.id)}>
                    {l.duration > 0 && <span className="rdur">{clock(l.duration)}</span>}
                    {(pct > 0 || isDoneL) && (
                      <span className="rprog">
                        <i className="rprog-fill" style={{ width: `${Math.min(100, pct * 100)}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="rbody"><span className="rtitle">{l.title}</span></span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {next && (
        <a className="route-next" href="#next"
           onClick={(e) => { e.preventDefault(); if (next.kind !== "quiz") onOpenLesson(next.chapter, next.lesson); }}>
          Next · {next.lesson?.title || next.chapter?.title}
        </a>
      )}
    </aside>
  );
}

// One overflow button per row, always visible and a full 44px target. A menu
// rather than a row of links, so a third action does not widen the row.
function Overflow({ kind, disabled = [], onPick }) {
  const [open, setOpen] = useState(false);
  const items = rowActions(kind).filter((a) => !disabled.includes(a.id));
  return (
    <span className="ovf">
      <button type="button" className="ovf-btn" aria-haspopup="menu" aria-expanded={open}
              aria-label="More" onClick={() => setOpen((v) => !v)}>
        <MoreVertical aria-hidden="true" />
      </button>
      <div className="ovf-menu" role="menu" hidden={!open}
           onMouseLeave={() => setOpen(false)}>
        {items.map((a) => (
          <button key={a.id} type="button" role="menuitem" className="ovf-item"
                  data-danger={a.danger ? "" : undefined}
                  onClick={() => { setOpen(false); onPick(a.id); }}>
            {a.label}
          </button>
        ))}
      </div>
    </span>
  );
}

// The private half. A note is yours, nobody else ever sees it, and it can be
// deleted freely because nobody has replied to it.
function NotesTab({ notes, at, lesson, moduleId, onSeek, mutate, setSession }) {
  const [body, setBody] = useState("");
  const save = () => {
    if (!body.trim()) return;
    mutate((s) => ({ ...s, notes: [...s.notes, {
      id: `N${Date.now().toString(36)}`, lessonId: lesson.id, t: Math.floor(at),
      body: body.trim(), authorId: "u_you", createdAt: new Date().toISOString(),
    }]}));
    setBody("");
  };

  return (
    <>
      {/* Private: a neutral rule, its own placeholder, its own button, and no
          line about who sees it — because nobody does. */}
      <div className="compose" data-vis="private">
        <span className="compose-t">{mmss(at)}</span>
        <textarea className="compose-field" rows={1} value={body}
                  placeholder="Write a note — only you see this"
                  onChange={(e) => setBody(e.target.value)} />
        <div className="compose-acts">
          <button type="button" className="compose-act" data-primary="" onClick={save}>Save note</button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="lempty">
          The note button in the player pins this moment — two taps, and you can
          fill in the words on the second watch.
        </p>
      ) : (
        <ul className="llist">
          {notes.map((n) => (
            <li key={n.id} className="litem" data-kind="note">
              <button type="button" className="lseek" onClick={() => onSeek(n.t)}>
                <span className="lt">{mmss(n.t)}</span>
                <span className="lbody" data-pin={n.body ? "0" : "1"}>
                  {n.body || "You marked this moment"}
                </span>
              </button>
              {/* Behind one three-dot button, always visible. These were
                  hover-only, and hover does not exist on a phone — which is
                  where the beta will mostly live. */}
              <Overflow kind="note" disabled={isPin(n) ? ["publish"] : []}
                        onPick={(id) => {
                          if (id === "edit") setSession((s) => editNote(s, n.id));
                          if (id === "publish") mutate((s) => publishNote(s, n.id, { moduleId }));
                          if (id === "delete") mutate((s) => deleteNote(s, n.id));
                        }} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// The public half. Same rows People shows — one table, two queries — in moment
// order, because scrolling this list is scrubbing the video above it.
// YouTube's comment thread: avatar, name, relative time, body, Reply — with
// replies collapsed behind one expander, because that is what everyone has
// seen ten thousand times and because an expanded thread pushes the next
// question off the screen.
function CommentsTab({ comments, replies, at, lesson, moduleName, moduleId, people, onSeek, mutate }) {
  // Author ids are the storage key; a callsign is what a person reads. One
  // resolver so a row never shows "u_five" to a student.
  const who = (id) =>
    id === "u_you" ? "You" : (people.find((p) => p.id === id)?.callsign || id);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [openReplies, setOpenReplies] = useState(() => new Set());

  return (
    <>
      {/* Public: the accent rule, a different placeholder, a different button,
          and a line that is permanently on screen saying who sees this. Four
          differences, because the gap in consequence is much bigger than the
          gap in the interface. */}
      <div className="compose" data-vis="public">
        <span className="compose-t">{mmss(at)}</span>
        <textarea className="compose-field" rows={1} value={body}
                  placeholder={`Ask everyone on ${moduleName}`}
                  onChange={(e) => setBody(e.target.value)} />
        <span className="compose-who">Everyone on {moduleName} sees this, in People.</span>
        <div className="compose-acts">
          <button type="button" className="compose-act" data-primary=""
                  onClick={() => {
                    if (!body.trim()) return;
                    mutate((s) => postComment(s, { moduleId, lessonId: lesson.id, seconds: at, body }));
                    setBody("");
                  }}>Post</button>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="lempty">
          The first question asked here stays pinned to its moment, for whoever
          reaches it next.
        </p>
      ) : (
        <ul className="llist">
          {comments.map((c) => {
            const rs = repliesFor(replies, c.id);
            const isOpen = openReplies.has(c.id);
            return (
              <li key={c.id} className="cmt">
                <span className="av" aria-hidden="true" style={{ "--av-h": hueFor(c.authorId) }}>
                  {initials(who(c.authorId))}
                </span>
                <div className="cmt-main">
                  <div className="cmt-head">
                    <span className="cmt-name">{who(c.authorId)}</span>
                    <span className="cmt-when">{ago(c.createdAt)}</span>
                    {/* A time inside a comment is pressable — YouTube taught
                        everyone that, and the behaviour already existed here. */}
                    <button type="button" className="cmt-seek" onClick={() => onSeek(c.t)}>
                      {mmss(c.t)}
                    </button>
                  </div>
                  <p className="cmt-body">{c.body}</p>
                  <div className="cmt-acts">
                    <button type="button" className="cmt-act" onClick={() => setReplyTo(c.id)}>Reply</button>
                    {rs.length > 0 && (
                      <button type="button" className="cmt-expand" aria-expanded={isOpen}
                              onClick={() => setOpenReplies((o) => toggleReplies(o, c.id))}>
                        {replyCountLabel(rs.length)}
                        <ChevronDown aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <ul className="cmt-replies" hidden={!isOpen}>
                    {rs.map((r) => (
                      <li key={r.id} className="cmt-reply">
                        <span className="av" data-size="sm" aria-hidden="true"
                              style={{ "--av-h": hueFor(r.authorId) }}>
                          {initials(who(r.authorId))}
                        </span>
                        <span>
                          <span className="cmt-head">
                            <span className="cmt-name">{who(r.authorId)}</span>
                            <span className="cmt-when">{ago(r.createdAt)}</span>
                          </span>
                          <p className="cmt-body">{r.body}</p>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {replyTo === c.id && (
                    <div className="compose" data-vis="public">
                      <span className="compose-t" />
                      <textarea className="compose-field" rows={1} value={replyBody} autoFocus
                                placeholder="Answer this" onChange={(e) => setReplyBody(e.target.value)} />
                      <div className="compose-acts">
                        <button type="button" className="compose-act" data-primary=""
                                onClick={() => {
                                  if (!replyBody.trim()) return;
                                  mutate((s2) => postReply(s2, { threadId: c.id, body: replyBody }));
                                  setReplyBody(""); setReplyTo(null);
                                  setOpenReplies((o) => new Set(o).add(c.id));
                                }}>Reply</button>
                        <button type="button" className="compose-act" onClick={() => setReplyTo(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
