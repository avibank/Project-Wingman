import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import {
  observeSlot, notesFor, commentsFor, repliesFor,
  deleteNote, publishNote, postComment, postReply,
} from "../../lib/lessonSurface.js";
import "./module.css";
import "./lesson.css";

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
  module: mod, chapters, chapter, lesson, state,
  onBack, onOpenLesson, onOpenQuiz, onSeekSaved, onComplete, onMarkDone, done,
}) {
  const { session, mutate, dispatchPlayer, setStage, requestSeek, setTab, clearWatch } = useSession();
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
    dispatchPlayer({ type: "load", lessonId: lesson.id, seconds: 0 });
    if (watch) clearWatch();
    return () => setStage(null);
  }, [lesson.id]);

  const next = nextAfterLesson(chapters, chapter.id, lesson.id, state);
  const tab = session.tab;
  const myNotes = notesFor(session.notes, lesson.id);
  const comments = commentsFor(session.threads, lesson.id);
  const at = session.player.seconds || 0;

  return (
    <div className="mscreen lesson">
      <div className="hdr">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {mod.name}
        </button>
      </div>

      <div className="lesson-head">
        <span className="lesson-code">{lesson.code || lesson.id}</span>
        <h1 className="lesson-name">{lesson.title}</h1>
        <span className="lesson-where">{chapter.title} · {mod.name}</span>
      </div>

      <div className="lesson-body">
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
                      onSeek={requestSeek} mutate={mutate} />
          : <CommentsTab comments={comments} replies={session.replies} at={at}
                         lesson={lesson} moduleName={mod.name} moduleId={mod.code || mod.id}
                         onSeek={requestSeek} mutate={mutate} />}
      </div>
    </div>
  );
}

// The private half. A note is yours, nobody else ever sees it, and it can be
// deleted freely because nobody has replied to it.
function NotesTab({ notes, at, lesson, moduleId, onSeek, mutate }) {
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
              <div className="compose-acts">
                {n.body && (
                  <button type="button" className="compose-act"
                          onClick={() => mutate((s) => publishNote(s, n.id, { moduleId }))}>
                    Publish as a comment
                  </button>
                )}
                <button type="button" className="ldel"
                        onClick={() => mutate((s) => deleteNote(s, n.id))}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// The public half. Same rows People shows — one table, two queries — in moment
// order, because scrolling this list is scrubbing the video above it.
function CommentsTab({ comments, replies, at, lesson, moduleName, moduleId, onSeek, mutate }) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");

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
            return (
              <li key={c.id} className="litem" data-kind="thread">
                <button type="button" className="lseek" onClick={() => onSeek(c.t)}>
                  <span className="lt">{mmss(c.t)}</span>
                  <span className="lbody">
                    {c.body}
                    <span className="lwho" data-state={rs.length ? "answered" : "waiting"}>
                      {c.authorId === "u_you" ? "You" : c.authorId}
                      {rs.length ? ` · ${rs.length} ${rs.length === 1 ? "reply" : "replies"}` : " · waiting for an answer"}
                    </span>
                  </span>
                </button>

                {/* Flat, not nested. A tree earns its keep at ten thousand
                    comments, not at forty. */}
                {rs.length > 0 && (
                  <ul className="lreplies">
                    {rs.map((r) => (
                      <li key={r.id} className="lreply">
                        <span className="lreply-who">{r.authorId === "u_you" ? "You" : r.authorId}</span>
                        <p className="lreply-body">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {replyTo === c.id ? (
                  <div className="compose" data-vis="public">
                    <span className="compose-t" />
                    <textarea className="compose-field" rows={1} value={replyBody} autoFocus
                              placeholder="Answer this" onChange={(e) => setReplyBody(e.target.value)} />
                    <div className="compose-acts">
                      <button type="button" className="compose-act" data-primary=""
                              onClick={() => {
                                if (!replyBody.trim()) return;
                                mutate((s) => postReply(s, { threadId: c.id, body: replyBody }));
                                setReplyBody(""); setReplyTo(null);
                              }}>Reply</button>
                      <button type="button" className="compose-act" onClick={() => setReplyTo(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="compose-acts">
                    <button type="button" className="compose-act" onClick={() => setReplyTo(c.id)}>Reply</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
