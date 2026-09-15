import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Av, Vote, Status, Stamp } from "./bits.jsx";
import { Prev, Next, Expand, Shrink, Reply, Save, Share, Lesson, Paper } from "./icons.jsx";
import { when, titleOf, excerptOf, answerCount, nestAnswers } from "../../../lib/roomModel.js";
import { statusOf } from "../../../lib/rrModel.js";

/* ============================================================================
   ONE QUESTION — the toolbar, the question, its answers, the answer composer,
   and the context column beside it on a wide screen.
   -----------------------------------------------------------------------------
   Only the asker sees Sign off, and the server agrees: the update is scoped by
   author_id (threads.js), so a client that showed it to anybody else would
   write nothing. Signing another answer moves the mark, because a thread has
   one best reply.

   Answers nest one level, as 0022 has it. The design has no nested row, so a
   reply to an answer sits under it, indented, and nothing deeper exists.
   ========================================================================= */

const paragraphs = (text) => String(text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function AskForm({ mod, onPost, onCancel }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { ref.current?.focus(); return; }
    onPost({ title: t, body: body.trim() || t });
  };
  return (
    <form className="rr-askform" onSubmit={submit}>
      <input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)}
             placeholder="What is the question?" aria-label="Your question" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Say what you have tried or where it stops making sense." aria-label="More about it" />
      <div className="rr-arow">
        <span className="rr-micro">Posts to {mod.name}</span>
        <span className="rr-grow" />
        <button type="button" className="rr-linkbtn is-inline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="rr-ask is-inline">Post the question</button>
      </div>
    </form>
  );
}

function AnswerBar({ thread, me, who, replyTo, onClearReply, onAnswer, wide }) {
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => { setDraft(""); }, [thread.id]);
  useEffect(() => { if (replyTo) ref.current?.focus(); }, [replyTo]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = parseFloat(getComputedStyle(el).maxHeight) || 140;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [draft, wide]);
  const post = () => {
    const body = draft.trim();
    if (!body) return;
    onAnswer({ threadId: thread.id, body, parentId: replyTo?.id || null });
    setDraft("");
    onClearReply();
  };
  return (
    <div className="rr-abar">
      {replyTo && (
        <div className="rr-draft">
          <div className="rr-mid">
            <b>{replyTo.authorId === me ? "You" : who(replyTo.authorId)}</b>
            <span>{replyTo.body}</span>
          </div>
          <button type="button" className="rr-iconbtn is-inline" onClick={onClearReply}
                  aria-label="Stop replying" style={{ width: 28, height: 28 }}>✕</button>
        </div>
      )}
      <div className="rr-in">
        <textarea ref={ref} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } }}
                  placeholder={replyTo
                    ? `Reply to ${replyTo.authorId === me ? "yourself" : who(replyTo.authorId)}…`
                    : `Answer ${thread.authorId === me ? "your own question" : who(thread.authorId)}…`}
                  aria-label={replyTo ? "Write a reply" : "Write an answer"} />
        <button type="button" className="rr-ask is-inline" onClick={post}>Post</button>
      </div>
    </div>
  );
}

export default function Detail({
  me, mod, all = [], list = [], threadId = null, replies = [], votes = {}, replyVotes = {}, saved = {},
  asking = false, onPostQuestion, onCancelAsk, wide = false, onToggleWide,
  who, source, onSelect, onVote, onVoteReply, onSign, onSave, onShare, onAnswer,
  onOpenSource, onProfile, onMenu,
}) {
  const thread = asking ? null : all.find((t) => t.id === threadId) || null;
  const idx = list.findIndex((t) => t.id === threadId);
  const scrollRef = useRef(null);
  const [replyTo, setReplyTo] = useState(null);
  const [press, setPress] = useState(null);

  useEffect(() => { setReplyTo(null); scrollRef.current?.scrollTo?.({ top: 0 }); }, [threadId, asking]);
  useEffect(() => {
    if (!press) return undefined;
    const t = setTimeout(() => setPress(null), 600);
    return () => clearTimeout(t);
  }, [press]);

  const hop = (n) => { if (list[n]) onSelect(list[n].id, { open: true }); };
  const empty = !thread;

  const tool = (
    <div className="rr-dtool">
      <button type="button" className="rr-tbtn is-inline" disabled={idx <= 0}
              title="Previous question" aria-label="Previous question" onClick={() => hop(idx - 1)}><Prev /></button>
      {list.length > 0 && <span className="rr-pos">{`${Math.max(idx + 1, 0)} / ${list.length}`}</span>}
      <button type="button" className="rr-tbtn is-inline" disabled={idx < 0 || idx >= list.length - 1}
              title="Next question" aria-label="Next question" onClick={() => hop(idx + 1)}><Next /></button>
      <span className="rr-grow" />
      <button type="button" className="rr-tbtn rr-wide is-inline" aria-pressed={wide} onClick={onToggleWide}
              title={wide ? "Bring the question list back" : "Let this thread take the whole pane"}>
        {wide ? <Shrink /> : <Expand />}{wide ? "Show the list" : "Fill the pane"}
      </button>
    </div>
  );

  if (empty) {
    return (
      <div className="rr-detail" data-empty="1">
        <div className="rr-dmain">
          {tool}
          <div className="rr-dscroll" ref={scrollRef}>
            <div className="rr-dwrap">
              {asking
                ? <AskForm mod={mod} onPost={onPostQuestion} onCancel={onCancelAsk} />
                : (
                  <div className="rr-dempty">
                    {list.length ? "Pick a question from the list." : "Ask the first one and the module hears it."}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const n = answerCount(thread, replies);
  const status = statusOf(thread, { replies, me });
  const src = source(thread);
  const v = votes[thread.id] || { score: 0, mine: 0 };
  const isSaved = Boolean(saved[thread.id]);
  const answers = nestAnswers(replies, thread.id).sort((a, b) => {
    const best = (thread.bestReplyId === b.id ? 1 : 0) - (thread.bestReplyId === a.id ? 1 : 0);
    return best || (replyVotes[b.id]?.count || 0) - (replyVotes[a.id]?.count || 0);
  });
  const faces = [thread.authorId, ...answers.flatMap((a) => [a.authorId, ...a.children.map((c) => c.authorId)])]
    .filter((id, i, arr) => arr.indexOf(id) === i);
  const waiting = all
    .filter((t) => t.id !== thread.id && answerCount(t, replies) === 0)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .slice(0, 3);
  const name = (id) => (id === me ? "You" : who(id));

  return (
    <div className="rr-detail">
      <div className="rr-dmain">
        {tool}
        <div className="rr-dscroll" ref={scrollRef}>
          <div className="rr-dwrap">
            <div className="rr-dmeta">
              <button type="button" className="rr-face is-inline" onClick={() => onProfile(thread.authorId)}
                      aria-label={`${who(thread.authorId)}'s profile`}>
                <Av id={thread.authorId} name={who(thread.authorId)} size={26} />
              </button>
              <b>{name(thread.authorId)}</b>
              <span className="rr-sep">·</span>
              <span className="rr-t">{when(thread.createdAt)}</span>
              {src && <span className="rr-src">{src.kind === "paper" ? <Paper /> : <Lesson />}{src.label}</span>}
              <span style={{ flex: 1 }} />
              <Status s={status} />
            </div>
            <h2 className="rr-dtitle">{titleOf(thread)}</h2>
            {paragraphs(excerptOf(thread)).length > 0 && (
              <div className="rr-dbody">
                {paragraphs(excerptOf(thread)).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
            {src && (
              <div className="rr-quoteblk">
                <div className="rr-micro rr-qcap">{src.kind === "paper" ? "From the paper" : "From the lesson"} · {src.label}</div>
                {src.quote && <div className="rr-qtxt">{src.quote}</div>}
                <button type="button" className="rr-mini rr-jump-src is-inline" onClick={() => onOpenSource(thread)}>
                  Open where it came from →
                </button>
              </div>
            )}
            <div className="rr-dactions">
              <Vote score={v.score} mine={v.mine} what="this question" onVote={(dir) => onVote(thread.id, dir)} />
              <button type="button" className="rr-mini is-inline" data-on={isSaved ? "1" : "0"} aria-pressed={isSaved}
                      onClick={() => onSave(thread.id)}><Save />{isSaved ? "Saved" : "Save"}</button>
              <button type="button" className="rr-mini is-inline" onClick={() => onShare(thread)}><Share />Share</button>
              {thread.authorId === me && (
                <button type="button" className="rr-mini is-inline" aria-label="More for your question"
                        onClick={(e) => onMenu(e.currentTarget, { thread })}>⋯</button>
              )}
            </div>

            {n > 0 ? (
              <div className="rr-ahead">
                <span className="rr-micro">{`${n} answer${n === 1 ? "" : "s"}`}</span>
                <span className="rr-grow" />
                {n > 1 && <span className="rr-micro">Most helpful first</span>}
              </div>
            ) : (
              <p className="rr-ctxnames">Yours would be the first answer.</p>
            )}

            {answers.map((a) => {
              const signed = thread.bestReplyId === a.id;
              const av = replyVotes[a.id] || { count: 0, mine: false };
              return (
                <div className="rr-ans" data-signed={signed ? "1" : "0"} key={a.id}>
                  <button type="button" className="rr-face is-inline" onClick={() => onProfile(a.authorId)}
                          aria-label={`${who(a.authorId)}'s profile`}>
                    <Av id={a.authorId} name={who(a.authorId)} size={30} />
                  </button>
                  <div>
                    <div className="rr-who">
                      <b>{name(a.authorId)}</b>
                      <span className="rr-sep">·</span>
                      <span className="rr-t">{when(a.createdAt)}</span>
                      {signed && <><span style={{ flex: 1 }} /><Status s="signed" /></>}
                    </div>
                    <div className="rr-txt">{a.body}</div>
                    <div className="rr-arow">
                      <Vote score={av.count} mine={av.mine ? 1 : 0} downable={false} what="this answer"
                            onVote={(dir) => onVoteReply(a.id, dir === 1)} />
                      <button type="button" className="rr-mini is-inline" onClick={() => setReplyTo(a)}><Reply />Reply</button>
                      {thread.authorId === me && !signed && (
                        <button type="button" className="rr-mini rr-sign is-inline"
                                onClick={() => { setPress(a.id); onSign(thread.id, a.id); }}>Sign off this answer</button>
                      )}
                      <button type="button" className="rr-mini is-inline" aria-label="More for this answer"
                              onClick={(e) => onMenu(e.currentTarget, { answer: a, thread })}>⋯</button>
                      <span className="rr-grow" />
                      {signed && <Stamp press={press === a.id} />}
                    </div>
                    {a.children.map((c) => (
                      <div className="rr-sub" key={c.id}>
                        <div className="rr-who">
                          <Av id={c.authorId} name={who(c.authorId)} size={20} />
                          <b>{name(c.authorId)}</b>
                          <span className="rr-sep">·</span>
                          <span className="rr-t">{when(c.createdAt)}</span>
                        </div>
                        <div className="rr-txt">{c.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <AnswerBar thread={thread} me={me} who={who} replyTo={replyTo} wide={wide}
                   onClearReply={() => setReplyTo(null)} onAnswer={onAnswer} />
      </div>

      <aside className="rr-ctx" aria-label="About this question">
        <div className="rr-ctxcard">
          <h4 className="rr-micro">In this thread</h4>
          <div className="rr-faces">{faces.slice(0, 8).map((id) => <Av key={id} id={id} name={who(id)} size={30} />)}</div>
          <div className="rr-ctxnames">{faces.map(name).join(", ")}</div>
        </div>
        {src && (
          <div className="rr-ctxcard">
            <h4 className="rr-micro">Came from</h4>
            <div className="rr-ctxsrc">
              <span className="rr-ic">{src.kind === "paper" ? <Paper /> : <Lesson />}</span>
              <div>
                <b>{src.title || src.label}</b>
                <span>{src.kind === "paper" ? "Marked on the paper" : `${src.label} · Lesson comment, mirrored here`}</span>
              </div>
            </div>
          </div>
        )}
        <div className="rr-ctxcard">
          <h4 className="rr-micro">Still waiting in this module</h4>
          {waiting.length ? waiting.map((o) => (
            <button type="button" className="rr-oq" key={o.id} onClick={() => onSelect(o.id, { open: true })}>
              {titleOf(o)}
              <span className="rr-micro">{name(o.authorId)} · {when(o.createdAt)}</span>
            </button>
          )) : <div className="rr-ctxnames">Unanswered questions land here.</div>}
        </div>
      </aside>
    </div>
  );
}
