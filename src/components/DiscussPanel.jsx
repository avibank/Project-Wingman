import { useState, useEffect, useRef } from "react";
import { Plane, ThumbsUp, Heart, Trash2, LogIn, Paperclip, X, Pencil, Check } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { Placard } from "./icons.jsx";
import { fetchComments, postComment, toggleReaction, deleteComment, uploadCommentPhoto, updateCommentText, canEditComment } from "../lib/comments.js";
import { useIsAdmin } from "../lib/admin.js";
import { useDisplayName } from "../lib/identity.js";

function nameToGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 60%, 42%), hsl(${(hue + 45) % 360}, 60%, 32%))`;
}

function DiscussPanel({ onSignIn, calmLights }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [reacted, setReacted] = useState(new Set());
  const [bounceKey, setBounceKey] = useState(null);
  const [pendingImage, setPendingImage] = useState(null); // { url }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const fileInputRef = useRef(null);
  const isAdmin = useIsAdmin();
  const { isSignedIn, user } = useUser();
  const displayName = useDisplayName();

  useEffect(() => {
    let active = true;
    fetchComments(null).then((data) => {
      if (active) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const post = async () => {
    if ((!text.trim() && !pendingImage) || !isSignedIn) return;
    const newComment = await postComment(null, displayName, text.trim(), user.id, pendingImage?.url || null, user.fullName || null);
    if (newComment) {
      setComments((c) => [...c, newComment]);
      setText("");
      setPendingImage(null);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const result = await uploadCommentPhoto(file);
    setUploading(false);
    if (result.error) {
      setUploadError(result.error);
    } else {
      setPendingImage({ url: result.url });
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
    setBounceKey(key);
    setTimeout(() => setBounceKey((k) => (k === key ? null : k)), 350);
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

  const myPosts = isSignedIn ? comments.filter((c) => c.user_id === user.id).length : 0;

  return (
    <div className="discuss">
      <div className="discuss-head">
        <Placard>Aviation Fundamentals</Placard>
        <span className="discuss-count">{comments.length} threads</span>
      </div>
      {myPosts > 0 && (
        <div className="leaderboard">🏆 You're the most active flyer today — {myPosts} post{myPosts === 1 ? "" : "s"} and counting.</div>
      )}
      <div className="discuss-list">
        {loading ? (
          <div className="discuss-empty">Loading discussion…</div>
        ) : comments.length === 0 ? (
          <div className="discuss-empty">Be the first to ask a question.</div>
        ) : (
          comments.map((c) => {
            const isOwn = isSignedIn && c.user_id === user.id;
            const editable = canEditComment(c, user?.id);
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="discuss-item">
                <div className="discuss-avatar" style={{ background: nameToGradient(c.author) }}>{c.author.charAt(0).toUpperCase()}</div>
                <div className="discuss-item-body">
                  <div className="discuss-meta">
                    <strong>{c.author}</strong>
                    {isAdmin && c.real_name && c.real_name !== c.author && (
                      <span className="discuss-realname">({c.real_name})</span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="discuss-edit">
                      <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)} autoFocus />
                      <button onClick={() => saveEdit(c.id)} aria-label="Save"><Check size={13} /></button>
                      <button onClick={() => setEditingId(null)} aria-label="Cancel"><X size={13} /></button>
                    </div>
                  ) : (
                    c.text && <p>{c.text}</p>
                  )}
                  {c.image_url && (
                    <div className="discuss-photo-frame">
                      <img className="discuss-photo" src={c.image_url} alt="Attached" />
                    </div>
                  )}
                  <div className="discuss-reactions">
                    <button
                      className={`${reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} ${bounceKey === `${c.id}-thumbsUp` ? "is-bouncing" : ""}`}
                      onClick={() => handleReaction(c, "thumbsUp")}
                    >
                      <ThumbsUp size={12} /> {c.reactions?.thumbsUp || 0}
                    </button>
                    <button
                      className={`${reacted.has(`${c.id}-heart`) ? "is-on" : ""} ${bounceKey === `${c.id}-heart` ? "is-bouncing" : ""}`}
                      onClick={() => handleReaction(c, "heart")}
                    >
                      <Heart size={12} /> {c.reactions?.heart || 0}
                    </button>
                    {editable && !isEditing && (
                      <button onClick={() => startEdit(c)} aria-label="Edit comment"><Pencil size={12} /></button>
                    )}
                    {(isAdmin || isOwn) && (
                      <button className="discuss-delete" onClick={() => handleDelete(c.id)} aria-label="Delete comment">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {isSignedIn ? (
        <div className="discuss-composer">
          {uploadError && <div className="discuss-upload-error">{uploadError}</div>}
          {pendingImage && (
            <div className="discuss-pending-image">
              <img src={pendingImage.url} alt="Attachment preview" />
              <button onClick={() => setPendingImage(null)} aria-label="Remove photo"><X size={12} /></button>
            </div>
          )}
          <div className="discuss-input">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className={`discuss-attach ${calmLights ? "is-calm" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Attach photo"
            >
              <Paperclip size={16} />
            </button>
            <input
              placeholder={uploading ? "Uploading photo…" : "Ask a question about the subject…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && post()}
            />
            <button className={`discuss-send ${calmLights ? "is-calm" : ""}`} onClick={post} aria-label="Post"><Plane size={18} style={{ transform: "rotate(45deg)" }} /></button>
          </div>
        </div>
      ) : (
        <button className="discuss-signin" onClick={onSignIn}>
          <LogIn size={15} /> Sign in to join the discussion
        </button>
      )}
      <style>{`
        .discuss { display: flex; flex-direction: column; height: calc(100vh - 250px); min-height: 360px; padding-bottom: 20px; }
        .discuss-head { display: flex; align-items: center; justify-content: space-between; margin: 0 auto 10px; max-width: 640px; width: 100%; flex-shrink: 0; }
        .discuss-count { font-size: 12px; color: var(--muted); }
        .leaderboard { max-width: 640px; margin: 0 auto 12px; width: 100%; font-size: 12px; color: var(--muted); background: var(--panel-alt); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; flex-shrink: 0; }
        .discuss-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin: 0 auto; width: 100%; padding: 4px 4px 12px; }
        .discuss-empty { text-align: center; color: var(--muted); font-size: 13px; padding: 30px 0; }
        .discuss-item { display: flex; gap: 12px; }
        .discuss-avatar { width: 32px; height: 32px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-size: 13px; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
        .discuss-item-body { flex: 1; min-width: 0; }
        .discuss-meta { display: flex; gap: 6px; align-items: baseline; font-size: 13px; color: var(--text); margin-bottom: 3px; }
        .discuss-realname { color: var(--muted2); font-weight: 400; font-size: 11.5px; }
        .discuss-item p { margin: 0; font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }
        .discuss-edit { display: flex; gap: 6px; align-items: center; }
        .discuss-edit input { flex: 1; background: var(--panel-alt); border: 1px solid var(--accent); border-radius: 8px; padding: 6px 10px; font-size: 13.5px; color: var(--text); }
        .discuss-edit button { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .discuss-photo-frame { display: inline-block; margin-top: 10px; padding: 6px 6px 14px; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 4px; box-shadow: 0 6px 14px rgba(0,0,0,0.2); transform: rotate(-1.2deg); transition: transform 0.2s ease; }
        .discuss-photo-frame:hover { transform: rotate(0deg); }
        .discuss-photo { display: block; max-width: 260px; width: 100%; border-radius: 2px; }
        .discuss-reactions { display: flex; gap: 6px; margin-top: 6px; }
        .discuss-reactions button { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 11px; padding: 3px 8px; border-radius: 20px; cursor: pointer; }
        .discuss-reactions button:hover { border-color: var(--accent); color: var(--accent); }
        .discuss-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .discuss-reactions button.is-bouncing { animation: reactionBounce 0.35s ease; }
        @keyframes reactionBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .discuss-delete { margin-left: auto; }
        .discuss-delete:hover { border-color: var(--bad) !important; color: var(--bad) !important; }
        .discuss-composer { flex-shrink: 0; max-width: 640px; margin: 8px auto 0; width: 100%; }
        .discuss-upload-error { font-size: 11.5px; color: var(--bad); margin-bottom: 6px; text-align: center; }
        .discuss-pending-image { position: relative; display: inline-block; margin-bottom: 8px; }
        .discuss-pending-image img { display: block; height: 64px; border-radius: 10px; border: 1px solid var(--border); }
        .discuss-pending-image button { position: absolute; top: -6px; right: -6px; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .discuss-input { display: flex; align-items: center; gap: 8px; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 32px; padding: 8px; min-height: 58px; }
        .discuss-input input[type="text"], .discuss-input input:not([type]) { flex: 1; background: transparent; border: none; padding: 10px 14px; color: var(--text); font-size: 13.5px; }
        .discuss-input input:focus { outline: none; }
        .discuss-attach { background: #E5484D; border: none; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; color: #2A0C0D; cursor: pointer; flex-shrink: 0; animation: pulseRed 4s ease-in-out infinite; }
        .discuss-attach:hover { background: #f05a5f; }
        .discuss-attach:disabled { opacity: 0.5; cursor: not-allowed; animation: none; }
        .discuss-attach.is-calm { background: var(--avatar-bg); color: var(--accent); animation: none; box-shadow: none; opacity: 1; }
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 2px rgba(229,72,77,0.15); opacity: 0.6; }
          50% { box-shadow: 0 0 9px rgba(229,72,77,0.55); opacity: 0.95; }
        }
        .discuss-send { background: #34C77B; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; color: #0E1830; cursor: pointer; flex-shrink: 0; animation: pulseGreen 4s ease-in-out infinite; animation-delay: 2s; }
        .discuss-send:hover { background: #4bd88e; }
        .discuss-send.is-calm { background: var(--avatar-bg); color: var(--accent); animation: none; box-shadow: none; opacity: 1; }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 2px rgba(52,199,123,0.15); opacity: 0.6; }
          50% { box-shadow: 0 0 9px rgba(52,199,123,0.55); opacity: 0.95; }
        }
        @media (prefers-reduced-motion: reduce) {
          .discuss-send, .discuss-attach { animation: none; box-shadow: 0 0 8px rgba(52,199,123,0.35); }
          .discuss-reactions button.is-bouncing { animation: none; }
        }
        .discuss-signin { flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 8px; max-width: 640px; margin: 8px auto 0; width: 100%; background: var(--panel-alt); border: 1px dashed var(--border); color: var(--accent); font-size: 13px; padding: 14px; border-radius: 16px; cursor: pointer; }
        .discuss-signin:hover { border-color: var(--accent); }
      `}</style>
    </div>
  );
}

export default DiscussPanel;
