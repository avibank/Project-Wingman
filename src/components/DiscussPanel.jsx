import { useState, useEffect } from "react";
import { Plane, ThumbsUp, Heart } from "lucide-react";
import { Placard } from "./icons.jsx";
import { fetchComments, postComment, toggleReaction, getGuestName, setGuestName } from "../lib/comments.js";

function DiscussPanel() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(!!getGuestName());
  const [reacted, setReacted] = useState(new Set());

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
    if (!text.trim()) return;
    let author = getGuestName();
    if (!author) {
      if (!name.trim()) return;
      setGuestName(name.trim());
      setNameSaved(true);
      author = name.trim();
    }
    const newComment = await postComment(null, author, text.trim());
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

  const myName = getGuestName();
  const myPosts = myName ? comments.filter((c) => c.author === myName).length : 0;

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
          comments.map((c) => (
            <div key={c.id} className="discuss-item">
              <div className="discuss-avatar">{c.author.charAt(0).toUpperCase()}</div>
              <div>
                <div className="discuss-meta"><strong>{c.author}</strong></div>
                {c.text && <p>{c.text}</p>}
                <div className="discuss-reactions">
                  <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => handleReaction(c, "thumbsUp")}>
                    <ThumbsUp size={12} /> {c.reactions?.thumbsUp || 0}
                  </button>
                  <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => handleReaction(c, "heart")}>
                    <Heart size={12} /> {c.reactions?.heart || 0}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {!nameSaved && (
        <input
          className="discuss-name"
          placeholder="Your name (shown on your comments)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <div className="discuss-input">
        <input
          placeholder="Ask a question about the subject…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
        />
        <button className="discuss-send" onClick={post} aria-label="Post"><Plane size={18} style={{ transform: "rotate(45deg)" }} /></button>
      </div>
      <style>{`
        .discuss { display: flex; flex-direction: column; height: calc(100vh - 250px); min-height: 360px; padding-bottom: 20px; }
        .discuss-head { display: flex; align-items: center; justify-content: space-between; margin: 0 auto 10px; max-width: 640px; width: 100%; flex-shrink: 0; }
        .discuss-count { font-size: 12px; color: var(--muted); }
        .leaderboard { max-width: 640px; margin: 0 auto 12px; width: 100%; font-size: 12px; color: var(--muted); background: var(--panel-alt); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; flex-shrink: 0; }
        .discuss-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin: 0 auto; width: 100%; padding: 4px 4px 12px; }
        .discuss-empty { text-align: center; color: var(--muted); font-size: 13px; padding: 30px 0; }
        .discuss-item { display: flex; gap: 12px; }
        .discuss-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--avatar-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-family: 'Space Grotesk', sans-serif; font-size: 13px; flex-shrink: 0; }
        .discuss-meta { display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: var(--text); margin-bottom: 3px; }
        .discuss-item p { margin: 0; font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }
        .discuss-reactions { display: flex; gap: 6px; margin-top: 6px; }
        .discuss-reactions button { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 11px; padding: 3px 8px; border-radius: 20px; cursor: pointer; }
        .discuss-reactions button:hover { border-color: var(--accent); color: var(--accent); }
        .discuss-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .discuss-name { max-width: 640px; margin: 0 auto; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--text); flex-shrink: 0; }
        .discuss-input { flex-shrink: 0; display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 8px auto 0; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 32px; padding: 8px; min-height: 58px; }
        .discuss-input input[type="text"], .discuss-input input:not([type]) { flex: 1; background: transparent; border: none; padding: 10px 14px; color: var(--text); font-size: 13.5px; }
        .discuss-input input:focus { outline: none; }
        .discuss-send { background: #34C77B; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; color: #0E1830; cursor: pointer; flex-shrink: 0; animation: pulseGreen 2.4s ease-in-out infinite; }
        .discuss-send:hover { background: #4bd88e; }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 3px rgba(52,199,123,0.15); opacity: 0.55; }
          50% { box-shadow: 0 0 16px rgba(52,199,123,0.9); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .discuss-send { animation: none; box-shadow: 0 0 8px rgba(52,199,123,0.35); }
        }
      `}</style>
    </div>
  );
}

export default DiscussPanel;
