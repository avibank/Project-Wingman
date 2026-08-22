import { useState, useEffect, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { CHAPTERS, chaptersForModule } from "../data.js";
import { useIsAdmin } from "../lib/admin.js";
import { useSocialPrefs, displayNameFor } from "../lib/social.js";
import { fetchModulePresence } from "../lib/presence.js";
import { fetchMyCompletions } from "../lib/partners.js";
import { fetchMyAttempts } from "../lib/quizStats.js";
import {
  fetchThreads, createThread, fetchPosts, addPost, deletePost,
  votePost, fetchMyPostVotes, buildTree,
  fetchReactions, fetchMyReactions, toggleReactionChip,
} from "../lib/discussion.js";
import { Comment, Composer, ThreadStyles, timeAgo } from "./Thread.jsx";

// One community surface, not three sub-tabs two of which are always blank.
//
// The stream is genuinely chronological and built only from events that carry
// a real timestamp: chapter completions, quiz attempts, and threads. Bookmarks
// and streaks are deliberately absent — nothing records when they happened, so
// placing them on a timeline would be a guess dressed as history.
function ModuleSocial({ moduleCode, moduleName, onGoToChapter }) {
  const { isSignedIn, user } = useUser();
  const isAdmin = useIsAdmin();
  const { prefs } = useSocialPrefs();

  const [threads, setThreads] = useState([]);
  const [entries, setEntries] = useState([]);
  const [roster, setRoster] = useState([]);
  const [open, setOpen] = useState(null);
  const [posts, setPosts] = useState([]);
  const [votes, setVotes] = useState({});
  const [chips, setChips] = useState({});
  const [myChips, setMyChips] = useState({});
  const [loading, setLoading] = useState(true);

  const chapters = chaptersForModule(moduleCode);
  const chapterById = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

  const load = useCallback(async () => {
    const [t, p, done, attempts] = await Promise.all([
      fetchThreads({ moduleCode, limit: 20 }),
      fetchModulePresence(moduleCode, user?.id),
      user?.id ? fetchMyCompletions(user.id, moduleCode) : Promise.resolve([]),
      user?.id ? fetchMyAttempts(user.id) : Promise.resolve([]),
    ]);
    setThreads(t);
    setRoster(p);

    // Merge every timestamped event into one stream, newest first.
    const log = [];
    for (const d of done) {
      const ch = chapterById[d.chapter_id];
      if (ch) log.push({ id: `c-${d.chapter_id}`, at: d.completed_at, kind: "Completed", text: `${ch.code} ${ch.title}`, chapterId: ch.id });
    }
    const byChapter = {};
    for (const a of attempts) {
      if (!chapters.some((c) => c.id === a.chapter_id)) continue;
      byChapter[a.chapter_id] = byChapter[a.chapter_id] || { n: 0, right: 0, at: a.created_at };
      byChapter[a.chapter_id].n += 1;
      if (a.correct) byChapter[a.chapter_id].right += 1;
    }
    for (const [cid, s] of Object.entries(byChapter)) {
      const ch = chapterById[cid];
      if (ch) log.push({ id: `q-${cid}`, at: s.at, kind: "Debrief", text: `${ch.code} — ${s.right}/${s.n} correct`, chapterId: cid });
    }
    for (const th of t) {
      log.push({ id: `t-${th.id}`, at: th.created_at, kind: "Thread", text: th.title, thread: th, who: displayNameFor(th) });
    }
    log.sort((a, b) => new Date(b.at) - new Date(a.at));
    setEntries(log);
    setLoading(false);
  }, [moduleCode, user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    fetchPosts(open.id).then(async (rows) => {
      setPosts(rows);
      const ids = rows.map((r) => r.id);
      setChips(await fetchReactions(ids));
      if (user?.id) {
        setVotes(await fetchMyPostVotes(user.id, ids));
        setMyChips(await fetchMyReactions(user.id, ids));
      }
    });
  }, [open, user?.id]);

  const reply = async (parent, body) => {
    const temp = {
      id: `temp-${Date.now()}`, thread_id: open.id, parent_id: parent?.id || null, body,
      author_username: user?.username, author_real_name: user?.fullName,
      author_display_pref: prefs?.identity_display || "real",
      user_id: user?.id, is_admin: isAdmin, score: 0, created_at: new Date().toISOString(),
    };
    setPosts((p) => [...p, temp]);
    const saved = await addPost({ threadId: open.id, parentId: parent?.id || null, body, user, prefs, isAdmin });
    setPosts((p) => p.map((x) => (x.id === temp.id ? saved || x : x)));
  };

  const vote = async (node, next) => {
    const delta = next - (votes[node.id] || 0);
    setVotes((v) => ({ ...v, [node.id]: next }));
    setPosts((p) => p.map((x) => (x.id === node.id ? { ...x, score: (x.score || 0) + delta } : x)));
    await votePost(node.id, user?.id, next);
  };

  const chip = async (node, kind, on) => {
    setMyChips((m) => {
      const next = new Set(m[node.id] || []);
      on ? next.delete(kind) : next.add(kind);
      return { ...m, [node.id]: next };
    });
    setChips((c) => ({ ...c, [node.id]: { ...(c[node.id] || {}), [kind]: Math.max(0, ((c[node.id]?.[kind]) || 0) + (on ? -1 : 1)) } }));
    await toggleReactionChip(node.id, user?.id, kind, on);
  };

  const remove = async (node) => {
    setPosts((p) => p.filter((x) => x.id !== node.id));
    await deletePost(node.id, user?.id);
  };

  const startThread = async (title) => {
    const created = await createThread({ chapterId: null, moduleCode, title, body: null, user, prefs });
    if (created) load();
  };

  const tree = buildTree(posts.map((p) => ({ ...p, myVote: votes[p.id], reactions: chips[p.id] || {}, myChips: myChips[p.id] })));

  if (open) {
    return (
      <div className="soc">
        <button className="soc-back" onClick={() => setOpen(null)}><ChevronLeft size={14} /> Back</button>
        <h3 className="soc-thread-title">{open.title}</h3>
        <p className="soc-muted">{displayNameFor(open)} · {timeAgo(open.created_at)}</p>
        {open.body && <p className="soc-thread-body">{open.body}</p>}
        <div className="soc-comments">
          {tree.map((n) => (
            <Comment key={n.id} node={n} myVote={votes[n.id]} onVote={vote} onReply={reply} onDelete={remove}
              reactions={n.reactions} mine={n.myChips} onChip={chip} />
          ))}
        </div>
        {isSignedIn && <Composer placeholder="Add a comment" onSubmit={(t) => reply(null, t)} />}
        <ThreadStyles />
        <SocialStyles />
      </div>
    );
  }

  return (
    <div className="soc">
      {roster.length > 0 && (
        <p className="soc-here">
          <span className="soc-dot" aria-hidden="true" />
          {roster.map((r) => r.display_name || "A pilot").join(", ")} studying this module now.
        </p>
      )}

      {isSignedIn && <Composer placeholder="Ask the group something" onSubmit={startThread} />}

      {loading ? (
        <p className="soc-muted">Coming up…</p>
      ) : entries.length === 0 ? (
        <p className="soc-muted">Finish a chapter or ask a question and it shows up here.</p>
      ) : (
        <ol className="soc-log">
          {entries.map((e) => (
            <li key={e.id} className="soc-entry">
              <span className="soc-kind">{e.kind}</span>
              {e.thread ? (
                <button className="soc-entry-main" onClick={() => setOpen(e.thread)}>
                  <span className="soc-entry-text">{e.text}</span>
                  <span className="soc-muted">{e.who} · {e.thread.reply_count} {e.thread.reply_count === 1 ? "reply" : "replies"}</span>
                </button>
              ) : (
                <button className="soc-entry-main" onClick={() => e.chapterId && onGoToChapter?.(moduleCode, e.chapterId)}>
                  <span className="soc-entry-text">{e.text}</span>
                </button>
              )}
              <span className="soc-when">{timeAgo(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
      <ThreadStyles />
      <SocialStyles />
    </div>
  );
}

function SocialStyles() {
  return (
    <style>{`
      .soc-here { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-soft); margin: 0 0 16px; }
      .soc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--presence); flex-shrink: 0; }
      .soc-muted { font-size: 12.5px; color: var(--muted); margin: 14px 0 0; }
      .soc-log { list-style: none; margin: 18px 0 0; padding: 0; }
      .soc-entry { display: flex; align-items: baseline; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--border-soft); }
      .soc-entry:last-child { border-bottom: none; }
      .soc-kind { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--muted2); width: 74px; flex-shrink: 0; }
      .soc-entry-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-align: left;
        background: none; border: none; padding: 0; cursor: pointer; }
      .soc-entry-text { font-size: 13px; color: var(--text-soft); }
      .soc-entry-main:hover .soc-entry-text { color: var(--text); }
      .soc-when { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted2); flex-shrink: 0; }
      .soc-back { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted);
        font-size: 12.5px; cursor: pointer; padding: 4px 0; margin-bottom: 10px; }
      .soc-back:hover { color: var(--text); }
      .soc-thread-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 3px; }
      .soc-thread-body { font-size: 13.5px; line-height: 1.55; color: var(--text-soft); margin: 10px 0 0; }
      .soc-comments { margin: 14px 0; }
      @media (max-width: 560px) { .soc-kind { width: 60px; } }
    `}</style>
  );
}

export default ModuleSocial;
