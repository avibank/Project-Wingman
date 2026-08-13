import { useState, useEffect } from "react";
import { ThumbsUp, Heart } from "lucide-react";
import { fetchComments, postComment, toggleReaction, getGuestName, setGuestName } from "../lib/comments.js";

function ChapterComments({ chapterId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(!!getGuestName());
  const [reacted, setReacted] = useState(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchComments(chapterId).then((data) => {
      if (active) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [chapterId]);

  const handlePost = async () => {
    if (!text.trim()) return;
    let author = getGuestName();
    if (!author) {
      if (!name.trim()) return;
      setGuestName(name.trim());
      setNameSaved(true);
      author = name.trim();
    }
    const newComment = await postComment(chapterId, author, text.trim());
    if (newComment) {
      setComments((c) => [...c, newComment]);
      setText("");
    }
  };

  const handleReaction = async (comment, type) => {
    const key = `${comment.id}-${type}`;
    const already = reacted.has(key);
    const nextReactions = await toggleReaction(comment, type, already);
    setComments((cs) => cs.map((c) => (c.id === comment.id ? { ...c, reactions: nextReactions } : c)));
    setReacted((r) => {
      const next = new Set(r);
      already ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="chapter-comments">
      {loading ? (
        <p className="chapter-comments-loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="chapter-comments-empty">No comments yet — be the first to ask something about this chapter.</p>
      ) : (
        <div className="chapter-comments-list">
          {comments.map((c) => (
            <div key={c.id} className="chapter-comment">
              <div className="chapter-comment-avatar">{c.author.charAt(0).toUpperCase()}</div>
              <div>
                <div className="chapter-comment-meta"><strong>{c.author}</strong></div>
                <p>{c.text}</p>
                <div className="chapter-comment-reactions">
                  <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => handleReaction(c, "thumbsUp")}>
                    <ThumbsUp size={11} /> {c.reactions?.thumbsUp || 0}
                  </button>
                  <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => handleReaction(c, "heart")}>
                    <Heart size={11} /> {c.reactions?.heart || 0}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!nameSaved && (
        <input
          className="chapter-comments-name"
          placeholder="Your name (shown on your comments)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <div className="chapter-comments-input">
        <input
          placeholder="Ask a question…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <button onClick={handlePost}>Post</button>
      </div>
      <style>{`
        .chapter-comments { display: flex; flex-direction: column; gap: 10px; }
        .chapter-comments-loading, .chapter-comments-empty { font-size: 12.5px; color: var(--muted); text-align: center; padding: 16px 0; }
        .chapter-comments-list { display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; }
        .chapter-comment { display: flex; gap: 8px; }
        .chapter-comment-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; }
        .chapter-comment-meta { font-size: 12px; color: var(--text); margin-bottom: 2px; }
        .chapter-comment p { margin: 0; font-size: 12.5px; color: var(--text-soft); line-height: 1.4; }
        .chapter-comment-reactions { display: flex; gap: 6px; margin-top: 4px; }
        .chapter-comment-reactions button { display: flex; align-items: center; gap: 3px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 10px; padding: 2px 6px; border-radius: 20px; cursor: pointer; }
        .chapter-comment-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .chapter-comments-name { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--text); }
        .chapter-comments-input { display: flex; gap: 6px; }
        .chapter-comments-input input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--text); }
        .chapter-comments-input button { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; }
      `}</style>
    </div>
  );
}

export default ChapterComments;
