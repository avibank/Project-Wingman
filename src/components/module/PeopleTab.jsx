import { useState } from "react";
import { useSession } from "../../lib/session.jsx";
import {
  repliesFor, isAnchored, watchAt, postModulePost, postReply,
} from "../../lib/lessonSurface.js";
import {
  peopleRows, groupRows, initials, hueFor, ago,
} from "../../lib/familiar.js";
import { mmss } from "./lessonState.js";
import "./familiar.css";

// WhatsApp's chat list, and the measured bug it fixes.
//
// On the previous People tab 7 of 7 thread titles were truncated — 424px of
// text into 253px. Every question cut mid-sentence, and the question IS the
// content. Two changes fix it: the row is full width (the split pane created
// the 253px), and the title gets two lines while the PREVIEW is what gets cut.
// That last part deviates from the model on purpose — a chat name is short, a
// question is a sentence.
//
// Section headings are sentences, not chips. "Waiting for an answer" is
// readable on sight; a pill labelled "Waiting" is something you have to learn.
// Exactly the height of the row it replaces — 72px, avatar and two lines.
function PeopleSkeleton({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-prow">
          <div className="sk sk-av" />
          <div>
            <div className="sk sk-line" />
            <div className="sk sk-line" data-w="short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PeopleTab({ module: mod, people = [], onOpenAt, loading }) {
  const { session, mutate, lastSeen, markSeen, me } = useSession();
  const moduleId = mod.code || mod.id;
  const { threads, replies } = session;

  const [open, setOpen] = useState(null);
  const [post, setPost] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const rows = peopleRows(threads, replies, people, moduleId, me, lastSeen);
  const showSkeleton = loading && rows.length === 0;
  const groups = groupRows(rows);
  const current = open ? threads.find((t) => t.id === open) : null;
  // "Someone", never the id. An account that has not set a callsign yet — and
  // signup lets you skip it — otherwise puts a raw Clerk id under their own
  // question. The room already says "Someone" for the same case; this is the
  // same feed in a second place and must not disagree with it.
  const who = (id) => (id === me ? "You"
    : people.find((p) => p.id === id)?.callsign || "Someone");

  // No split pane. The split is what cut 7 of 7 titles — it gave the list
  // 253px of a wide screen — so the rows are full width and opening a thread
  // replaces the list rather than squeezing it into a column beside one.
  if (current) {
    return (
      <div className="plist-wrap">
        <button type="button" className="up" onClick={() => setOpen(null)}>
          <span aria-hidden="true">‹</span> {mod.name} · everyone
        </button>
        <div className="cmt">
          <span className="av" data-size="lg" aria-hidden="true"
                style={{ "--av-h": hueFor(current.authorId) }}>
            {initials(who(current.authorId))}
          </span>
          <div className="cmt-main">
            <div className="cmt-head">
              <span className="cmt-name">{who(current.authorId)}</span>
              <span className="cmt-when">{ago(current.createdAt)}</span>
              {isAnchored(current) && (
                <button type="button" className="cmt-seek"
                        onClick={() => onOpenAt?.(watchAt(current))}>
                  Watch at {mmss(current.t)}
                </button>
              )}
            </div>
            <p className="cmt-body">{current.body}</p>

            <ul className="cmt-replies">
              {repliesFor(replies, current.id).map((r) => (
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

            <div className="compose" data-vis="public">
              <span className="compose-t" />
              <textarea className="compose-field" rows={1} value={replyBody}
                        placeholder="Answer this" onChange={(e) => setReplyBody(e.target.value)} />
              <div className="compose-acts">
                <button type="button" className="compose-act" data-primary=""
                        onClick={() => {
                          if (!replyBody.trim()) return;
                          mutate((s) => postReply(s, { threadId: current.id, body: replyBody, authorId: me }));
                          setReplyBody("");
                        }}>Reply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plist-wrap">
      <div>
        {showSkeleton ? <PeopleSkeleton /> : rows.length === 0 ? (
          <p className="lempty" style={{ padding: "18px var(--pad)" }}>
            The first question asked on a lesson lands here, where the rest of
            the module can answer it.
          </p>
        ) : groups.map((g) => (
          <div key={g.band}>
            <p className="psection">{g.title}</p>
            <ul className="plist">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <button type="button" className="prow"
                          aria-current={open === r.id}
                          onClick={() => { setOpen(r.id); markSeen(r.id); }}>
                    {/* Decoration, never identification — the callsign is
                        always beside it, because two people can share a hue. */}
                    <span className="av" aria-hidden="true"
                          style={{ "--av-h": hueFor(r.author?.id || "?") }}>
                      {initials(r.author?.callsign)}
                    </span>
                    <span className="prow-main">
                      <span className="prow-title">{r.title}</span>
                      {r.preview && <span className="prow-preview">{r.preview}</span>}
                      {r.anchored && (
                        <span className="prow-watch">Watch at {mmss(r.watchAt.seconds)}</span>
                      )}
                    </span>
                    <span className="prow-side">
                      <span className="prow-when">{r.when}</span>
                      <span className="prow-dot" hidden={!r.unread} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* No lesson, no moment: there is nothing to attach it to, so no lesson
            query can ever return it. That is the whole one-way rule. */}
        <div className="compose" data-vis="public" style={{ marginInline: "var(--pad)" }}>
          <span className="compose-t" />
          <textarea className="compose-field" rows={1} value={post}
                    placeholder={`Ask everyone on ${mod.name}`}
                    onChange={(e) => setPost(e.target.value)} />
          <span className="compose-who">Everyone on {mod.name} sees this. It has no moment, so it stays here.</span>
          <div className="compose-acts">
            <button type="button" className="compose-act" data-primary=""
                    onClick={() => {
                      if (!post.trim()) return;
                      mutate((s) => postModulePost(s, { moduleId, body: post, authorId: me }));
                      setPost("");
                    }}>Post</button>
          </div>
        </div>
      </div>

    </div>
  );
}
