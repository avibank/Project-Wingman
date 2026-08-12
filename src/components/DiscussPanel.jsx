import { useState, useRef } from "react";
import { Plus, X, Plane, ThumbsUp, ThumbsDown, Heart } from "lucide-react";
import { Placard } from "./icons.jsx";
import { SEED_COMMENTS } from "../data.js";

function DiscussPanel() {
  const [comments, setComments] = useState(SEED_COMMENTS.ch2);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [reacted, setReacted] = useState(new Set());
  const fileRef = useRef(null);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const post = () => {
    if (!text.trim() && !pendingImage) return;
    setComments((c) => [...c, { id: `c${c.length + 1}`, user: "You", text, image: pendingImage, time: "now", reactions: { thumbsUp: 0, heart: 0 } }]);
    setText("");
    setPendingImage(null);
  };

  const toggleReaction = (commentId, type) => {
    const key = `${commentId}-${type}`;
    const already = reacted.has(key);
    setComments((cs) => cs.map((c) => (c.id === commentId ? { ...c, reactions: { ...c.reactions, [type]: c.reactions[type] + (already ? -1 : 1) } } : c)));
    setReacted((r) => {
      const next = new Set(r);
      already ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const myPosts = comments.filter((c) => c.user === "You").length;

  return (
    <div className="discuss">
      <div className="discuss-head">
        <Placard>JT.02 · Combustion Chamber</Placard>
        <span className="discuss-count">{comments.length} threads</span>
      </div>
      {myPosts > 0 && (
        <div className="leaderboard">🏆 You're the most active flyer today — {myPosts} post{myPosts === 1 ? "" : "s"} and counting.</div>
      )}
      <div className="discuss-list">
        {comments.length === 0 ? (
          <div className="discuss-empty">Be the first to ask a question about this chapter.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="discuss-item">
              <div className="discuss-avatar">{c.user.charAt(0)}</div>
              <div>
                <div className="discuss-meta"><strong>{c.user}</strong><span>{c.time}</span></div>
                {c.text && <p>{c.text}</p>}
                {c.image && <img src={c.image} alt="attachment" className="discuss-img" />}
                <div className="discuss-reactions">
                  <button className={reacted.has(`${c.id}-thumbsUp`) ? "is-on" : ""} onClick={() => toggleReaction(c.id, "thumbsUp")}>
                    <ThumbsUp size={12} /> {c.reactions?.thumbsUp || 0}
                  </button>
                  <button className={reacted.has(`${c.id}-heart`) ? "is-on" : ""} onClick={() => toggleReaction(c.id, "heart")}>
                    <Heart size={12} /> {c.reactions?.heart || 0}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {pendingImage && (
        <div className="discuss-preview">
          <img src={pendingImage} alt="attachment preview" />
          <button onClick={() => setPendingImage(null)} aria-label="Remove attachment"><X size={13} /></button>
        </div>
      )}
      <div className="discuss-input">
        <input type="file" accept="image/*" ref={fileRef} onChange={onFileChange} style={{ display: "none" }} />
        <button className="discuss-attach" onClick={() => fileRef.current?.click()} aria-label="Attach photo"><Plus size={18} strokeWidth={2.5} /></button>
        <input
          placeholder="Ask a question about this lesson…"
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
        .discuss-meta span { font-size: 11px; color: var(--muted2); }
        .discuss-item p { margin: 0; font-size: 13.5px; color: var(--text-soft); line-height: 1.5; }
        .discuss-img { display: block; max-width: 240px; width: 100%; border-radius: 12px; margin-top: 6px; border: 1px solid var(--border); }
        .discuss-reactions { display: flex; gap: 6px; margin-top: 6px; }
        .discuss-reactions button { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px solid var(--border); color: var(--muted2); font-size: 11px; padding: 3px 8px; border-radius: 20px; cursor: pointer; }
        .discuss-reactions button:hover { border-color: var(--accent); color: var(--accent); }
        .discuss-reactions button.is-on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .discuss-preview { position: relative; max-width: 640px; margin: 8px auto 0; width: fit-content; }
        .discuss-preview img { max-height: 90px; border-radius: 10px; border: 1px solid var(--border); display: block; }
        .discuss-preview button { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--panel-alt); border: 1px solid var(--border); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .discuss-input { flex-shrink: 0; display: flex; align-items: center; gap: 8px; max-width: 640px; margin: 8px auto 0; width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 32px; padding: 8px; min-height: 58px; }
        .discuss-attach { background: #E5484D; border: none; color: #fff; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; animation: pulseRed 2.4s ease-in-out infinite; }
        .discuss-attach:hover { background: #f05c61; }
        .discuss-input input[type="text"], .discuss-input input:not([type]) { flex: 1; background: transparent; border: none; padding: 10px 4px; color: var(--text); font-size: 13.5px; }
        .discuss-input input:focus { outline: none; }
        .discuss-send { background: #34C77B; border: none; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; color: #0E1830; cursor: pointer; flex-shrink: 0; animation: pulseGreen 2.4s ease-in-out infinite; animation-delay: 1.2s; }
        .discuss-send:hover { background: #4bd88e; }
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 3px rgba(229,72,77,0.15); opacity: 0.55; }
          50% { box-shadow: 0 0 16px rgba(229,72,77,0.9); opacity: 1; }
        }
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 3px rgba(52,199,123,0.15); opacity: 0.55; }
          50% { box-shadow: 0 0 16px rgba(52,199,123,0.9); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .discuss-attach, .discuss-send { animation: none; box-shadow: 0 0 8px rgba(229,72,77,0.35); }
          .discuss-send { box-shadow: 0 0 8px rgba(52,199,123,0.35); }
        }
      `}</style>
    </div>
  );
}

export default DiscussPanel;
