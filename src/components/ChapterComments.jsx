import { useState, useEffect } from "react";
import { ThumbsUp, Heart, Trash2, LogIn, Pencil, Check, X } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { fetchComments, postComment, toggleReaction, deleteComment, updateCommentText, canEditComment } from "../lib/comments.js";
import { useIsAdmin } from "../lib/admin.js";
import { useDisplayName } from "../lib/identity.js";

function ChapterComments({ chapterId, onSignIn }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [reacted, setReacted] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const isAdmin = useIsAdmin();
  const { isSignedIn, user } = useUser();
  const displayName = useDisplayName();

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
    if (!text.trim() || !isSignedIn) return;
    const newComment = await postComment(chapterId, displayName, text.trim(), user.id, null, user.fullName || null);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    const ok = await deleteComment(id);
    if (ok) setComments((cs) => cs.filter((c) => c.id !== id));
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditText(c.text);
  };

  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    const updated = await updateCommentText(id, editText.trim());
    if (updated) {
      setComments((cs) => cs.map((c) => (c.id === id ? updated : c)));
    }
    setEditingId(null);
  };

  return (
    <div className="chapter-comments">
      {loading ? (
        <p className="chapter-comments-loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="chapter-comments-empty">No comments yet — be the first to ask something about this chapter.</p>
      ) : (
        <div className="chapter-comments-list">
          {comments.map((c) => {
            const isOwn = isSignedIn && c.user_id === user.id;
            const editable = canEditComment(c, user?.id);
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="chapter-comment">
                <div className="chapter-comment-avatar">{c.author.charAt(0).toUpperCase()}</div>
                <div className="chapter-comment-body">
                  <div className="chapter-comment-meta">
                    <strong>{c.author}</strong>
                    {isAdmin && c.real_name && c.real_name !== c.author && (
                      <span className="chapter-comment-realname"> ({c.real_name})</span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="chapter-comment-edit">
                      <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)} autoFocus />
                      <button onClick={() => saveEdit(c.id)} aria-label="Save"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} aria-label="Cancel"><X size={12} /></button>
                    </div>
                  ) : (
                    <p>{c.text}</p>
                  )}
                  <div className="chapter-comment-reactions">
                    <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => handleReaction(c, "thumbsUp")}>
                      <ThumbsUp size={11} /> {c.reactions?.thumbsUp || 0}
                    </button>
                    <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => handleReaction(c, "heart")}>
                      <Heart size={11} /> {c.reactions?.heart || 0}
                    </button>
                    {editable && !isEditing && (
                      <button onClick={() => startEdit(c)} aria-label="Edit comment"><Pencil size={11} /></button>
                    )}
                    {(isAdmin || isOwn) && (
                      <button className="chapter-comment-delete" onClick={() => handleDelete(c.id)} aria-label="Delete comment">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isSignedIn ? (
        <div className="chapter-comments-input">
          <input
            placeholder="Ask a question…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePost()}
          />
          <button onClick={handlePost}>Post</button>
        </div>
      ) : (
        <button className="chapter-comments-signin" onClick={onSignIn}>
          <LogIn size={14} /> Sign in to comment
        </button>
      )}
      <style>{`
        .chapter-comments { display: flex; flex-direction: column; gap: 10px; }
        .chapter-comments-loading, .chapter-comments-empty { font-size: 12.5px; color: var(--muted); text-align: center; padding: 16px 0; }
        .chapter-comments-list { display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; }
        .chapter-comment { display: flex; gap: 8px; }
        .chapter-comment-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; }
        .chapter-comment-body { flex: 1; min-width: 0; }
        .chapter-comment-meta { font-size: 12px; color: var(--text); margin-bottom: 2px; }
        .chapter-comment-realname { color: var(--muted2); font-weight: 400; font-size: 11px; }
        .chapter-comment p { margin: 0; font-size: 12.5px; color: var(--text-soft); line-height: 1.4; }
        .chapter-comment-edit { display: flex; gap: 4px; align-items: center; }
        .chapter-comment-edit input { flex: 1; background: var(--panel-alt); border: 1px solid var(--accent); border-radius: 6px; padding: 4px 8px; font-size: 12.5px; color: var(--text); }
        .chapter-comment-edit button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .chapter-comment-reactions { display: flex; gap: 6px; margin-top: 4px; }
        .chapter-comment-reactions button { display: flex; align-items: center; gap: 3px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 10px; padding: 2px 6px; border-radius: 20px; cursor: pointer; }
        .chapter-comment-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .chapter-comment-delete { margin-left: auto; }
        .chapter-comment-delete:hover { border-color: var(--bad) !important; color: var(--bad) !important; }
        .chapter-comments-name { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--text); }
        .chapter-comments-input { display: flex; gap: 6px; }
        .chapter-comments-input input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--text); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .chapter-comments-input input:focus { outline: none; border-color: var(--accent-soft); box-shadow: 0 0 8px 1px var(--accent-soft); }
        .chapter-comments-input button { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; }
        .chapter-comments-signin { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--panel-alt); border: 1px dashed var(--border); color: var(--accent); font-size: 12.5px; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; }
        .chapter-comments-signin:hover { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

export default ChapterComments;
