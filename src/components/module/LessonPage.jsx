import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, Bookmark, BookmarkCheck,
         MessageSquare, PenLine } from "lucide-react";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import {
  initials, hueFor, ago, replyCountLabel, toggleReplies, presenceFor,
} from "../../lib/familiar.js";
import {
  observeSlot, notesFor, commentsFor, repliesFor,
  deleteNote, postReply,
} from "../../lib/lessonSurface.js";
import "./module.css";
import "./lesson.css";
import "./familiar.css";
import NoteDeck from "./NoteDeck.jsx";
import "./deck.css";

// A time inside a comment is pressable — [2:17] or a bare 2:17. YouTube taught
// everyone that, and the seek already exists, so looking like the known thing
// costs one regex. The text is SPLIT rather than replaced, so nothing is ever
// rendered as raw HTML.
const T_RE = /\[?(\d{1,2}):([0-5]\d)\]?/g;
function seekable(text, onSeek) {
  const out = [];
  let last = 0, m;
  T_RE.lastIndex = 0;
  while ((m = T_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const secs = Number(m[1]) * 60 + Number(m[2]);
    out.push(
      <button key={`${m.index}-${secs}`} type="button" className="tseek"
              onClick={() => onSeek(secs)}>{`${m[1]}:${m[2]}`}</button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

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
  bookmarks = [], onToggleSave,
  onBack, onOpenLesson, onOpenQuiz, onSeekSaved, onComplete, onMarkDone, done,
}) {
  const { session, mutate, dispatchPlayer, setStage, requestSeek, setTab,
          clearWatch, pending, postOptimistic } = useSession();
  const slotRef = useRef(null);
  const watch = session.watchAt?.lessonId === lesson.id ? session.watchAt : null;

  // The slot is what is watched, not the player — the player leaves it.
  useEffect(() => {
    if (!slotRef.current) return undefined;
    return observeSlot(slotRef.current, dispatchPlayer, slotRef.current.closest(".deck"));
  }, [dispatchPlayer]);

  // Hand the player this lesson, the slot to sit over, and where to report.
  useEffect(() => {
    setStage({
      lesson,
      slotEl: slotRef.current,
      // The mini player needs these to route back to this lesson from any page.
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      moduleCode: mod.code || mod.id,
      // One step ahead: the player prefetches this at halfway.
      next: nextAfterLesson(chapters, chapter.id, lesson.id, state)?.lesson || null,
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

  // The meta line, in the shape of a view count. Watchers comes from presence,
  // which is the only real signal there is — it is not invented.
  const watchers = presence.filter((p) => p.lessonId === lesson.id && p.userId !== "u_you").length;
  const added = lesson.addedAt
    ? new Date(lesson.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;
  const saved = bookmarks.includes(lesson.id);

  // ONE composer, in one position, serving both tabs. It does not move when the
  // tab changes — only its placeholder does — and it carries a timestamp chip
  // pre-filled with the playhead, so nobody has to type a timestamp.
  const composerRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [chip, setChip] = useState(null);
  const [detached, setDetached] = useState(false);
  const [justSaved, setJustSaved] = useState(null);
  const focusComposer = () => setTimeout(() => composerRef.current?.focus(), 0);

  // One field, two destinations. The chip decides whether the moment travels
  // with it; detached, a note has no second and a comment is not prefixed.
  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    const t = detached ? null : Math.floor(chip ?? at);
    if (tab === "notes") {
      const id = `N${Date.now().toString(36)}`;
      mutate((st) => ({ ...st, notes: [...st.notes, {
        id, lessonId: lesson.id, t: t ?? 0, body: text,
        authorId: "u_you", createdAt: new Date().toISOString(),
      }]}));
      setJustSaved(id);
    } else {
      const id = `T${Date.now().toString(36)}`;
      // Posting with the chip attached prefixes the comment, so the moment
      // becomes a link like any other timestamp written by hand.
      const body = t === null ? text : `[${mmss(t)}] ${text}`;
      postOptimistic(id, (st) => ({ ...st, threads: [...st.threads, {
        id, moduleId: mod.code || mod.id, lessonId: lesson.id,
        t: t ?? 0, body, authorId: "u_you", createdAt: new Date().toISOString(),
      }]}));
    }
    setDraft(""); setChip(null); setDetached(false);
  };

  return (
    <div className="mscreen lesson">
      {/* Up, not history. Tap a question in People and land here: history-back
          returns you to People, up takes you to the module. Up is predictable,
          cannot loop, and doubles as the breadcrumb this page was missing —
          and it is labelled with the destination, never a bare arrow. */}
      <button type="button" className="up" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        {chapter.title} · {mod.name}
      </button>

      <div className="lesson-head">
        <h1 className="lesson-name">{lesson.title}</h1>
        {/* Where a view count sits, and reading like one. This replaces the
            "Callsign X and 2 others have been here" row. */}
        <span className="lesson-where">
          {chapter.title}
          {watchers > 0 && ` · ${watchers} from your module ${watchers === 1 ? "has" : "have"} watched this`}
          {added && ` · added ${added}`}
        </span>

        <div className="lact">
          <button type="button" className="pill" aria-pressed={saved}
                  onClick={() => onToggleSave?.(lesson.id, !saved)}>
            {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
            {saved ? "Saved" : "Save"}
          </button>
          <button type="button" className="pill"
                  onClick={() => { setTab("comments"); focusComposer(); }}>
            <MessageSquare aria-hidden="true" /> Ask a question
          </button>
          <button type="button" className="pill"
                  onClick={() => { setTab("notes"); setChip(Math.floor(at)); focusComposer(); }}>
            <PenLine aria-hidden="true" /> Mark this moment
          </button>
        </div>
      </div>

      {/* ONE CENTRED COLUMN, ~860px. This replaces Part 13's route sidebar:
          that brief argued a lesson list beside a video is the least novel
          sidebar in education, and it is — but this one says the whole page is
          the player and nothing else lives here, and a full-bleed video at
          1400px pushes the comments below the fold until they stop existing.
          The newer instruction wins; the sidebar is gone. */}
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

        {/* ONE composer, one position. Only the placeholder changes. */}
        <div className="composer" data-vis={tab === "notes" ? "private" : "public"}>
          <button type="button" className="chip" data-off={detached ? "1" : undefined}
                  onClick={() => setDetached((v) => !v)}
                  aria-pressed={!detached}
                  aria-label={detached ? "Attach the current timestamp" : "Detach the timestamp"}>
            {mmss(chip ?? Math.floor(at))}
          </button>
          <textarea ref={composerRef} className="composer-field" rows={1} value={draft}
                    placeholder={tab === "notes"
                      ? "Write a note — only you see this"
                      : `Ask the module…`}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitDraft(); }
                    }} />
          {/* Only once there is something to confirm. */}
          {draft.trim() && (
            <div className="composer-acts">
              <button type="button" className="composer-act"
                      onClick={() => { setDraft(""); setDetached(false); setChip(null); }}>Cancel</button>
              <button type="button" className="composer-act" data-primary="" onClick={submitDraft}>
                {tab === "notes" ? "Save note" : "Post"}
              </button>
            </div>
          )}
          {tab === "comments" && (
            <span className="composer-who">Everyone on {mod.name} sees this.</span>
          )}
        </div>

        {tab === "notes"
          ? <NoteDeck notes={myNotes} jumpTo={justSaved}
                      onSeek={requestSeek}
                      onDelete={(id) => mutate((st) => deleteNote(st, id))} />
          : <CommentsTab comments={comments} replies={session.replies} at={at}
                         lesson={lesson} moduleName={mod.name} moduleId={mod.code || mod.id}
                         people={people} onSeek={requestSeek} mutate={mutate}
                         pending={pending} postOptimistic={postOptimistic} />}
      </div>

      </div>
    </div>
  );
}


// The public half. Same rows People shows — one table, two queries — in moment
// order, because scrolling this list is scrubbing the video above it.
// YouTube's comment thread: avatar, name, relative time, body, Reply — with
// replies collapsed behind one expander, because that is what everyone has
// seen ten thousand times and because an expanded thread pushes the next
// question off the screen.
function CommentsTab({ comments, replies, at, lesson, moduleName, moduleId, people, onSeek, mutate, pending, postOptimistic }) {
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
                    // On screen this frame, settled underneath. No spinner.
                    const id = `T${Date.now().toString(36)}`;
                    postOptimistic(id, (s) => ({ ...s, threads: [...s.threads, {
                      id, moduleId, lessonId: lesson.id, t: Math.floor(at),
                      body: body.trim(), authorId: "u_you",
                      createdAt: new Date().toISOString(),
                    }]}));
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
              <li key={c.id} className="cmt"
                  data-pending={pending?.[c.id] === "pending" ? "1" : undefined}
                  data-failed={pending?.[c.id] === "failed" ? "1" : undefined}>
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
                  <p className="cmt-body">{seekable(c.body, onSeek)}</p>
                  <div className="cmt-acts">
                    {pending?.[c.id] === "failed" ? (
                      /* It stays, with a way back. Never delete what someone
                         typed because a network dropped. */
                      <button type="button" className="cmt-retry"
                              onClick={() => postOptimistic(c.id, (s) => ({ ...s, threads: [...s.threads] }))}>
                        Not sent — tap to retry
                      </button>
                    ) : (
                      <button type="button" className="cmt-act" onClick={() => setReplyTo(c.id)}>Reply</button>
                    )}
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
                          <p className="cmt-body">{seekable(r.body, onSeek)}</p>
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
