import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { displayNameFor } from "../lib/social.js";
import { fetchThreads, createThread, fetchPosts, addPost } from "../lib/discussion.js";

function when(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Threaded discussion anchored to one chapter. Anyone in the module can read
// and post; there is no approval step.
function ThreadsPanel({ chapter, moduleCode, prefs, onCountChange }) {
  const { isSignedIn, user } = useUser();
  const [threads, setThreads] = useState([]);
  const [openThread, setOpenThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rows = await fetchThreads({ chapterId: chapter.id });
    setThreads(rows);
    onCountChange?.(rows.length);
  }, [chapter.id, onCountChange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!openThread) return;
    fetchPosts(openThread.id).then(setPosts);
  }, [openThread]);

  const startThread = async () => {
    if (!isSignedIn || !title.trim()) return;
    setBusy(true);
    const created = await createThread({ chapterId: chapter.id, moduleCode, title, body, user, prefs });
    setBusy(false);
    if (created) { setTitle(""); setBody(""); load(); }
  };

  const sendReply = async () => {
    if (!isSignedIn || !reply.trim()) return;
    setBusy(true);
    const created = await addPost({ threadId: openThread.id, body: reply, user, prefs });
    setBusy(false);
    if (created) { setReply(""); setPosts((p) => [...p, created]); load(); }
  };

  if (openThread) {
    return (
      <div className="th">
        <button className="th-back" onClick={() => setOpenThread(null)}><ChevronLeft size={14} /> All threads</button>
        <h3 className="th-title">{openThread.title}</h3>
        <p className="th-meta">{displayNameFor(openThread)} · {when(openThread.created_at)}</p>
        {openThread.body && <p className="th-body">{openThread.body}</p>}
        <div className="th-posts">
          {posts.length === 0 && <p className="th-empty">No replies yet.</p>}
          {posts.map((p) => (
            <div key={p.id} className="th-post">
              <div className="th-meta"><span className="th-author">{displayNameFor(p)}</span> · {when(p.created_at)}</div>
              <p className="th-body">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="th-composer">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
            placeholder={isSignedIn ? "Reply…" : "Sign in to reply"} disabled={!isSignedIn} />
          <button className="th-post-btn" onClick={sendReply} disabled={!isSignedIn || busy || !reply.trim()}>
            {busy ? "Posting…" : "Reply"}
          </button>
        </div>
        <ThreadStyles />
      </div>
    );
  }

  return (
    <div className="th">
      {threads.length === 0 && <p className="th-empty">No threads on this chapter yet — start one below.</p>}
      {threads.map((t) => (
        <button key={t.id} className="th-row" onClick={() => setOpenThread(t)}>
          <span className="th-row-title">{t.title}</span>
          <span className="th-row-meta">
            <MessageSquare size={11} /> {t.reply_count} · {displayNameFor(t)} · {when(t.last_activity_at)}
          </span>
        </button>
      ))}
      <div className="th-composer">
        <input className="th-input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={isSignedIn ? "Start a thread…" : "Sign in to post"} disabled={!isSignedIn} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
          placeholder="Add detail (optional)" disabled={!isSignedIn} />
        <button className="th-post-btn" onClick={startThread} disabled={!isSignedIn || busy || !title.trim()}>
          {busy ? "Posting…" : "Post thread"}
        </button>
      </div>
      <ThreadStyles />
    </div>
  );
}

function ThreadStyles() {
  return (
    <style>{`
      .th-back { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted);
        font-size: 12px; cursor: pointer; padding: 4px 0; margin-bottom: 8px; }
      .th-back:hover { color: var(--text); }
      .th-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin: 0 0 3px; }
      .th-meta { font-size: 11.5px; color: var(--muted2); margin: 0 0 8px; }
      .th-author { color: var(--text-soft); font-weight: 600; }
      .th-body { font-size: 13px; line-height: 1.55; color: var(--text-soft); margin: 0 0 12px; white-space: pre-wrap; }
      .th-posts { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
      .th-post { padding-top: 12px; border-top: 1px solid var(--border-soft); }
      .th-row { display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left; background: none; border: none;
        border-bottom: 1px solid var(--border-soft); padding: 12px 0; cursor: pointer; }
      .th-row:hover .th-row-title { color: var(--accent); }
      .th-row-title { font-size: 13.5px; color: var(--text); font-weight: 600; }
      .th-row-meta { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted2); }
      .th-composer { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
      .th-input, .th-composer textarea { width: 100%; background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm);
        color: var(--text); font-family: 'Inter', sans-serif; font-size: 13px; padding: 10px; box-shadow: var(--shadow-inset); }
      .th-composer textarea { resize: vertical; }
      .th-post-btn { align-self: flex-end; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm);
        padding: 10px 16px; font-weight: 600; font-size: 12.5px; cursor: pointer; min-height: 40px; }
      .th-post-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .th-empty { font-size: 12.5px; color: var(--muted); margin: 0; padding: 8px 0; }
    `}</style>
  );
}

export default ThreadsPanel;
