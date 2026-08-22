import { useState, useEffect } from "react";
import { ThumbsUp, Heart, Trash2, LogIn, Pencil, Check, X, MessageSquareOff, ShieldCheck } from "lucide-react";
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
    const newComment = await postComment(chapterId, displayName, text.trim(), user.id, null, user.fullName || null, isAdmin);
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
        <div className="chapter-comments-skeleton" aria-label="Loading comments">
          {[0, 1].map((i) => (
            <div key={i} className="chapter-comments-skeleton-item">
              <div className="chapter-comments-skeleton-avatar" />
              <div className="chapter-comments-skeleton-lines">
                <div className="chapter-comments-skeleton-line chapter-comments-skeleton-line--short" />
                <div className="chapter-comments-skeleton-line chapter-comments-skeleton-line--long" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="chapter-comments-empty">
          <MessageSquareOff size={24} className="chapter-comments-empty-icon" />
          <p>Ask the first question about this chapter.</p>
        </div>
      ) : (
        <div className="chapter-comments-list">
          {comments.map((c) => {
            const isOwn = isSignedIn && c.user_id === user.id;
            const editable = canEditComment(c, user?.id);
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="chapter-comment">
                <div className="chapter-comment-avatar-wrap">
                  <div className={`chapter-comment-avatar ${isOwn ? "is-own" : ""}`}>{c.author.charAt(0).toUpperCase()}</div>
                  {c.is_admin && (
                    <span className="chapter-comment-admin-badge" title="Admin">
                      <ShieldCheck size={8} />
                    </span>
                  )}
                </div>
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
                    <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => handleReaction(c, "thumbsUp")} aria-label={reacted.has(`${c.id}-thumbsUp`) ? "Remove thumbs up" : "Give thumbs up"}>
                      <ThumbsUp size={11} /> {c.reactions?.thumbsUp || 0}
                    </button>
                    <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => handleReaction(c, "heart")} aria-label={reacted.has(`${c.id}-heart`) ? "Remove heart" : "Give heart"}>
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
        .chapter-comments-loading { font-size: 12.5px; color: var(--muted); text-align: center; padding: 16px 0; }
        .chapter-comments-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 16px 0; }
        .chapter-comments-empty-icon { color: var(--muted2); opacity: 0.6; }
        .chapter-comments-empty p { margin: 0; font-size: 12.5px; color: var(--muted); max-width: 260px; }
        .chapter-comments-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
        .chapter-comments-skeleton-item { display: flex; gap: 8px; }
        .chapter-comments-skeleton-avatar { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(90deg, var(--panel-alt) 25%, var(--border) 50%, var(--panel-alt) 75%); background-size: 200% 100%; animation: skeletonShine 1.4s ease-in-out infinite; }
        .chapter-comments-skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; padding-top: 3px; }
        .chapter-comments-skeleton-line { height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--panel-alt) 25%, var(--border) 50%, var(--panel-alt) 75%); background-size: 200% 100%; animation: skeletonShine 1.4s ease-in-out infinite; }
        .chapter-comments-skeleton-line--short { width: 35%; }
        .chapter-comments-skeleton-line--long { width: 75%; }
        @keyframes skeletonShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .chapter-comments-list { display: flex; flex-direction: column; gap: 12px; max-height: 260px; overflow-y: auto; mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 16px, black calc(100% - 16px), transparent 100%); }
        .chapter-comment { display: flex; gap: 8px; }
        .chapter-comment-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 11.5px; flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; }
        .chapter-comment-avatar.is-own { box-shadow: 0 0 0 2px var(--accent); }
        .chapter-comment-avatar-wrap { position: relative; flex-shrink: 0; }
        .chapter-comment-admin-badge { position: absolute; bottom: -2px; right: -2px; width: 13px; height: 13px; border-radius: 50%; background: #E8A33D; color: #2A1B04; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--panel); }
        .chapter-comment-body { flex: 1; min-width: 0; }
        .chapter-comment-meta { font-size: 11.5px; color: var(--text); margin-bottom: 2px; }
        .chapter-comment-realname { color: var(--muted2); font-weight: 400; font-size: 10px; }
        .chapter-comment p { margin: 0; font-size: 12.5px; color: var(--text-soft); line-height: 1.4; }
        .chapter-comment-edit { display: flex; gap: 4px; align-items: center; }
        .chapter-comment-edit input { flex: 1; background: var(--panel-alt); border: 1px solid var(--accent); border-radius: var(--r-sm); padding: 4px 8px; font-size: 12.5px; color: var(--text); }
        .chapter-comment-edit button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 22px; height: 22px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .chapter-comment-reactions { display: flex; gap: 6px; margin-top: 4px; }
        .chapter-comment-reactions button { display: flex; align-items: center; gap: 3px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 10px; padding: 2px 6px; border-radius: var(--r-pill); cursor: pointer; }
        .chapter-comment-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .chapter-comment-delete { margin-left: auto; }
        .chapter-comment-delete:hover { border-color: var(--bad) !important; color: var(--bad) !important; }
        .chapter-comments-input { display: flex; gap: 6px; }
                .chapter-comments-input input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; font-size: 12.5px; color: var(--text); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .chapter-comments-input input::placeholder { color: var(--muted); }
        .chapter-comments-input input:focus { outline: none; border-color: var(--accent-soft); box-shadow: 0 0 8px 1px var(--accent-soft); }
        .chapter-comments-input button { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm); padding: 8px 12px; font-size: 11.5px; cursor: pointer; white-space: nowrap; }
        .chapter-comments-signin { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--panel-alt); border: 1px dashed var(--border); color: var(--accent); font-size: 12.5px; padding: 10px; border-radius: var(--r-md); cursor: pointer; width: 100%; }
        .chapter-comments-signin:hover { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

export default ChapterComments;
