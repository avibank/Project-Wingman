import { useState } from "react";
import {
  ChevronLeft, Plus, MessageSquare, Bookmark, Share2, MoreHorizontal, Check, BookOpen, Search,
} from "lucide-react";
import { Face, Votes } from "./bits.jsx";
import {
  when, titleOf, excerptOf, isAnswered, answerCount, isMine, waitingCount,
  FEED_SORTS, sortFeed,
} from "../../lib/roomModel.js";

/* ============================================================================
   §4b · A MODULE IS A QUESTION FEED.

   The opposite shape to a squadron, deliberately. A question outlives whoever
   asked it: somebody sitting the same paper next term needs to find it, read
   the accepted answer, and never speak to the person who wrote it. So it is
   sorted rather than chronological, voted rather than reacted to, titled
   rather than casual, and every row has a permalink.

   HOT, NOT NEW, by default. New is honest and useless — it buries the question
   with six answers under the one asked four minutes ago. Hot is score over
   age, with answers weighing more than votes, which is the ordering a study
   feed actually wants: the thing the class is working through, not the thing
   somebody typed last.

   ANSWERED IS THE ASKER'S MARK, never a reply count. A question with six
   answers and none of them right is not answered, and saying it is would be
   the feed lying about the one thing it exists to track.
   ========================================================================= */

export default function ModuleFeed({
  me, mod, threads = [], replies = [], votes = {}, saved = {},
  sort, onSort, asking, onAsking, onPost, onOpenThread, onVote, onSave, onShare,
  onBack, onProfile, onMenu, onSearchHere, readers = 0, who, lessonTag,
}) {
  const code = mod.code || mod.id;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const list = sortFeed(threads, sort, { me, replies, votes });

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onPost({ moduleId: code, title: t, body: body.trim() || t });
    setTitle(""); setBody("");
  };

  return (
    <>
      <header className="pane-head">
        <button type="button" className="icon-btn is-inline back" onClick={onBack} aria-label="Back">
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="mod-icon" aria-hidden="true">{code}</span>
        <div className="h-id">
          <h2 className="h-title">{mod.name}</h2>
          <p className="h-sub">
            {/* Counts only when there is something to count. A module nobody
                has asked in yet says what it is for instead. */}
            {threads.length > 0
              ? <>
                  {threads.length === 1 ? "1 question" : `${threads.length} questions`}
                  {waitingCount(threads) > 0 ? ` · ${waitingCount(threads)} still open` : ""}
                  {readers > 0 ? ` · ${readers} reading now` : ""}
                </>
              : "Questions about this module, answered by the people sitting it"}
          </p>
        </div>
        <button type="button" className="icon-btn is-inline" onClick={onSearchHere}
                aria-label="Search this module">
          <Search aria-hidden="true" />
        </button>
      </header>

      <div className="scroll">
        <div className="feed">
          <div className="sortrow">
            {FEED_SORTS.map((s) => (
              <button type="button" key={s.id} className="chip is-inline"
                      aria-pressed={sort === s.id} onClick={() => onSort(code, s.id)}>
                {s.label}
              </button>
            ))}
            <span className="sp" />
            <button type="button" className="primary is-inline" onClick={() => onAsking(code)}>
              <Plus aria-hidden="true" /> Ask
            </button>
          </div>

          {asking === code && (
            <form className="ask" onSubmit={submit}>
              <label className="vis-hidden" htmlFor="ask-title">Your question</label>
              <input id="ask-title" value={title} autoFocus
                     placeholder="Your question in one line"
                     onChange={(e) => setTitle(e.target.value)} />
              <label className="vis-hidden" htmlFor="ask-body">More about it</label>
              <textarea id="ask-body" rows={3} value={body}
                        placeholder="What you tried, and what you expected"
                        onChange={(e) => setBody(e.target.value)} />
              <div className="ask-acts">
                <span className="hint">Goes to {mod.name}</span>
                <button type="button" className="ghost is-inline"
                        onClick={() => { onAsking(null); setTitle(""); setBody(""); }}>
                  Cancel
                </button>
                <button type="submit" className="primary is-inline" disabled={!title.trim()}>
                  Post
                </button>
              </div>
            </form>
          )}

          {list.map((t) => {
            const n = answerCount(t, replies);
            const v = votes[t.id] || { score: 0, mine: 0 };
            const tag = lessonTag(t);
            return (
              <article className="post" key={t.id}>
                <Votes score={v.score} mine={v.mine} what="this question"
                       onVote={(dir) => onVote(t.id, dir)} />
                <div className="post-main">
                  <p className="post-meta">
                    <Face id={t.authorId} name={who(t.authorId)} size="sm"
                          onClick={() => onProfile(t.authorId)} />
                    <b>{t.authorId === me ? "You" : who(t.authorId)}</b>
                    <span aria-hidden="true">·</span>
                    <span>{when(t.createdAt)}</span>
                    {tag && <span className="tag lesson"><BookOpen aria-hidden="true" />{tag}</span>}
                    {isAnswered(t) && <span className="tag solved"><Check aria-hidden="true" />Answered</span>}
                    {isMine(t, replies, me) && t.authorId !== me && <span className="tag mine">You answered</span>}
                  </p>
                  <button type="button" className="post-title"
                          onClick={() => onOpenThread(t)}>{titleOf(t)}</button>
                  {excerptOf(t) && <span className="post-ex">{excerptOf(t)}</span>}
                  <div className="post-foot">
                    <button type="button" className="footbtn is-inline" onClick={() => onOpenThread(t)}>
                      <MessageSquare aria-hidden="true" />
                      {n > 0 ? `${n} ${n === 1 ? "answer" : "answers"}` : "Answer it"}
                    </button>
                    <button type="button" className="footbtn is-inline"
                            aria-pressed={Boolean(saved[t.id])} onClick={() => onSave(t.id)}>
                      <Bookmark aria-hidden="true" />{saved[t.id] ? "Saved" : "Save"}
                    </button>
                    <button type="button" className="footbtn is-inline" onClick={() => onShare(t)}>
                      <Share2 aria-hidden="true" />Share
                    </button>
                    {t.authorId === me && (
                      <button type="button" className="footbtn is-inline"
                              onClick={(e) => onMenu(e.currentTarget, { thread: t })}
                              aria-label="More for your question">
                        <MoreHorizontal aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!list.length && (
            /* Names the way out rather than the emptiness, and in one line. */
            <p className="pane-none">
              {sort === "hot" || sort === "new"
                ? "Put the first question up and the module starts."
                : <>Nothing under {FEED_SORTS.find((s) => s.id === sort)?.label}.{" "}
                    <button type="button" className="is-inline linky"
                            onClick={() => onSort(code, "hot")}>Show Hot</button></>}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
