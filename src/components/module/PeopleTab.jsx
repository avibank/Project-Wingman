import { useState } from "react";
import { useSession } from "../../lib/session.jsx";
import {
  orderThreads, repliesFor, badges, isAnchored, isWaiting, watchAt,
  postModulePost, postReply,
} from "../../lib/lessonSurface.js";
import { mmss } from "./lessonState.js";

// Threads live here, and every comment written under a video is one of them —
// the same row, not a copy. The lesson asks what is on this lesson; this asks
// what is in this module. Nothing syncs, so nothing can drift.
//
// Two kinds of row and they must look different. A thread from a video has a
// moment and takes you there; a module post has neither and goes nowhere. One
// is a door and one is not, and a door that does not open is the worst row on
// the screen.
//
// Unread discipline is load-bearing rather than a nicety. Every comment on
// every lesson becomes a thread here, so if each one badged, People would be
// permanently red within a week and people would stop opening it — which is
// the failure the module chat room was rejected for. A thread badges only if
// you are in it AND somebody else has done something since you last looked.
function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "··";
}

const who = (id, people) =>
  id === "u_you" ? "You" : (people.find((p) => p.id === id)?.callsign || id);

export default function PeopleTab({ module: mod, people = [], onOpenAt }) {
  const { session, mutate, lastSeen, markSeen } = useSession();
  const moduleId = mod.code || mod.id;
  const { threads, replies } = session;

  const [open, setOpen] = useState(null);
  const [post, setPost] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const ordered = orderThreads(threads, replies, moduleId);
  const badged = new Set(badges(threads, replies, moduleId, "u_you", lastSeen));
  const current = ordered.find((t) => t.id === open) || null;

  const band = (t) => {
    const rs = repliesFor(replies, t.id);
    if (t.authorId === "u_you" || rs.some((r) => r.authorId === "u_you")) return "In it";
    if (isWaiting(t, replies)) return "Waiting for an answer";
    return null;
  };

  return (
    <div className="hub">
      <div className="hublist">
        <div className="hubrows">
          {ordered.length === 0 ? (
            <p className="lempty" style={{ padding: "18px var(--pad)" }}>
              The first question asked on a lesson lands here, where the rest of
              the module can answer it.
            </p>
          ) : ordered.map((t) => {
            const rs = repliesFor(replies, t.id);
            const door = isAnchored(t);
            return (
              <button key={t.id} type="button"
                      className={`hrow${door ? " is-door" : ""}`}
                      aria-current={open === t.id}
                      onClick={() => { setOpen(t.id); markSeen(t.id); }}>
                <span className="hav" aria-hidden="true">{initials(who(t.authorId, people))}</span>
                <span>
                  <span className="hn">{t.body}</span>
                  <span className="hl">
                    {who(t.authorId, people)}
                    {rs.length ? ` · ${rs.length} ${rs.length === 1 ? "reply" : "replies"}` : ""}
                    {band(t) ? ` · ${band(t)}` : ""}
                  </span>
                </span>
                <span className="hr">
                  {/* A moment is what makes this row a door. Without one there
                      is nowhere to go, and the row must not pretend there is. */}
                  {door && <span className="hpos">Watch at {mmss(t.t)}</span>}
                  {badged.has(t.id) && <span className="unread">1</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Posting from here has no lesson and no moment, which is the whole of
            the one-way rule: there is nothing to attach it to, so no lesson
            query can ever return it. Nobody has to remember the rule. */}
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
                      mutate((s) => postModulePost(s, { moduleId, body: post }));
                      setPost("");
                    }}>Post</button>
          </div>
        </div>
      </div>

      <div className="side" style={{ padding: "18px 22px" }}>
        {current ? (
          <>
            <h4>{current.body}</h4>
            <p className="sh">{who(current.authorId, people)}</p>
            {isAnchored(current) && (
              <button type="button" className="nextgo"
                      onClick={() => onOpenAt?.(watchAt(current))}>
                Watch at {mmss(current.t)}
              </button>
            )}
            <ul className="lreplies" style={{ paddingInlineStart: 0 }}>
              {repliesFor(replies, current.id).map((r) => (
                <li key={r.id} className="lreply">
                  <span className="lreply-who">{who(r.authorId, people)}</span>
                  <p className="lreply-body">{r.body}</p>
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
                          mutate((s) => postReply(s, { threadId: current.id, body: replyBody }));
                          setReplyBody("");
                        }}>Reply</button>
              </div>
            </div>
          </>
        ) : (
          <p className="sh">
            Open a thread to read it. The ones waiting for an answer are grouped
            together, so the module can see what still needs one.
          </p>
        )}
      </div>
    </div>
  );
}
