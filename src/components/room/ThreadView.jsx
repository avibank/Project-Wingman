import { useState } from "react";
import {
  ChevronLeft, Bookmark, Share2, Check, BookOpen, CornerUpLeft, MoreHorizontal,
} from "lucide-react";
import { Face, Votes, Composer } from "./bits.jsx";
import {
  when, titleOf, excerptOf, answerCount, nestAnswers,
} from "../../lib/roomModel.js";

/* ============================================================================
   §4c · ONE QUESTION.

   The asker owns two things nobody else does: the mark that says a particular
   answer settled it, and the ability to take that mark back. Everything else
   on this screen belongs to everyone.

   ANSWERS NEST ONE LEVEL, and one only. A reply hangs off an answer; a reply
   to a reply joins its siblings under the same answer. Deep nesting breaks on
   a phone and turns a question into an argument, and 0022's parent_id is
   deliberately flattened in roomModel rather than left recursive.

   ORDER: the accepted answer first, then by score. Not chronological — the
   person arriving in March wants the answer, not the conversation that got
   there.
   ========================================================================= */

export default function ThreadView({
  me, thread, mod, replies = [], votes = {}, replyVotes = {}, saved = false,
  draft, onDraft, onSend, sending, onVote, onVoteReply, onBest, onSave, onShare,
  onSubReply, onBack, onProfile, onMenu, onOpenLessonAt, who, lessonTag,
}) {
  const [openSub, setOpenSub] = useState(null);
  const [subDraft, setSubDraft] = useState("");
  const answers = nestAnswers(replies, thread.id)
    .sort((a, b) => {
      const best = (thread.bestReplyId === b.id ? 1 : 0) - (thread.bestReplyId === a.id ? 1 : 0);
      if (best) return best;
      return (replyVotes[b.id]?.count || 0) - (replyVotes[a.id]?.count || 0);
    });
  const n = answerCount(thread, replies);
  const v = votes[thread.id] || { score: 0, mine: 0 };
  const tag = lessonTag(thread);

  const sendSub = (parentId) => {
    const body = subDraft.trim();
    if (!body) return;
    onSubReply({ threadId: thread.id, parentId, body });
    setSubDraft(""); setOpenSub(null);
  };

  return (
    <>
      <header className="pane-head">
        <button type="button" className="icon-btn is-inline back" onClick={onBack}
                aria-label={`Back to ${mod?.name || "the module"}`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="mod-icon" aria-hidden="true">{mod?.code || mod?.id}</span>
        <div className="h-id">
          {/* The QUESTION, not the word "Thread" — every other pane head names
              what you are looking at, and two threads are indistinguishable
              once you are inside one otherwise. */}
          <h2 className="h-title">{titleOf(thread)}</h2>
          <p className="h-sub">{mod?.name}</p>
        </div>
        <button type="button" className="icon-btn is-inline" onClick={() => onShare(thread)}
                aria-label="Copy a link to this question">
          <Share2 aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn is-inline" onClick={() => onSave(thread.id)}
                aria-pressed={saved} aria-label={saved ? "Saved" : "Save this question"}>
          <Bookmark aria-hidden="true" />
        </button>
      </header>

      <div className="scroll">
        <div className="thread">
          <article className="op">
            <Votes score={v.score} mine={v.mine} what="this question"
                   onVote={(dir) => onVote(thread.id, dir)} />
            <div>
              <p className="post-meta">
                <Face id={thread.authorId} name={who(thread.authorId)} size="sm"
                      onClick={() => onProfile(thread.authorId)} />
                <b>{thread.authorId === me ? "You" : who(thread.authorId)}</b>
                <span aria-hidden="true">·</span>
                <span>{when(thread.createdAt)}</span>
                {tag && (
                  <button type="button" className="tag lesson is-inline"
                          onClick={() => onOpenLessonAt(thread)}>
                    <BookOpen aria-hidden="true" />{tag}
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
            </div>
          </article>

          {/* No zero count. An unanswered question says what to do about it
              once, in the empty state below, rather than printing "0 answers"
              above it and the same fact again underneath. */}
          {n > 0 && (
            <p className="answers-head">
              <span>{n === 1 ? "1 answer" : `${n} answers`}</span>
            </p>
          )}

          {answers.map((a) => {
            const av = replyVotes[a.id] || { count: 0, mine: false };
            const best = thread.bestReplyId === a.id;
            return (
              <article className={`ans${best ? " best" : ""}`} key={a.id}>
                <Votes score={av.count} mine={av.mine ? 1 : 0} what="this answer"
                       onVote={(dir) => onVoteReply(a.id, dir === 1)} />
                <div className="ans-main">
                  <p className="ans-head">
                    <Face id={a.authorId} name={who(a.authorId)} size="sm"
                          onClick={() => onProfile(a.authorId)} />
                    <b>{a.authorId === me ? "You" : who(a.authorId)}</b>
                    <span aria-hidden="true">·</span>
                    <span>{when(a.createdAt)}</span>
                    {best && <span className="tag solved"><Check aria-hidden="true" />Answered it</span>}
                  </p>
                  {/* Line breaks survive here as well as in the question. They
                      did not, and an answer that lays out three steps arrived
                      as one paragraph. */}
                  <p className="ans-body">{a.body}</p>
                  <div className="post-foot">
                    <button type="button" className="footbtn is-inline"
                            onClick={() => { setOpenSub(openSub === a.id ? null : a.id); setSubDraft(""); }}>
                      <CornerUpLeft aria-hidden="true" />Reply
                    </button>
                    {/* §4c — only the asker marks the best answer. */}
                    {thread.authorId === me && (
                      <button type="button" className="footbtn is-inline"
                              onClick={() => onBest(thread.id, best ? null : a.id)}>
                        <Check aria-hidden="true" />{best ? "Not the one" : "This answered it"}
                      </button>
                    )}
                    <button type="button" className="footbtn is-inline"
                            onClick={(e) => onMenu(e.currentTarget, { answer: a, thread })}
                            aria-label="More for this answer">
                      <MoreHorizontal aria-hidden="true" />
                    </button>
                  </div>

                  {a.children.length > 0 && (
                    <div className="subreplies">
                      {a.children.map((s) => (
                        <div className="sub" key={s.id}>
                          <p className="ans-head">
                            <Face id={s.authorId} name={who(s.authorId)} size="sm"
                                  onClick={() => onProfile(s.authorId)} />
                            <b>{s.authorId === me ? "You" : who(s.authorId)}</b>
                            <span aria-hidden="true">·</span>
                            <span>{when(s.createdAt)}</span>
                          </p>
                          <p>{s.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {openSub === a.id && (
                    <div className="replybox">
                      <label className="vis-hidden" htmlFor={`sub-${a.id}`}>
                        Reply to {who(a.authorId)}
                      </label>
                      <input id={`sub-${a.id}`} value={subDraft} autoFocus
                             placeholder={`Reply to ${who(a.authorId)}`}
                             onChange={(e) => setSubDraft(e.target.value)}
                             onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendSub(a.id); } }} />
                      <button type="button" className="primary is-inline"
                              disabled={!subDraft.trim()} onClick={() => sendSub(a.id)}>
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {!n && <p className="pane-none">Yours would be the first answer.</p>}
        </div>
      </div>

      <Composer value={draft} onChange={onDraft} onSend={onSend} sending={sending}
                placeholder="Write an answer" />
    </>
  );
}
