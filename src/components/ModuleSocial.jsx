import { useState, useEffect, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { CHAPTERS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { useIsAdmin } from "../lib/admin.js";
import { useSocialPrefs, displayNameFor } from "../lib/social.js";
import { fetchModulePresence } from "../lib/presence.js";
import { fetchWingmen } from "../lib/partners.js";
import {
  fetchThreads, createThread, fetchPosts, addPost, deletePost,
  votePost, fetchMyPostVotes, buildTree,
  fetchReactions, fetchMyReactions, toggleReactionChip,
} from "../lib/discussion.js";
import { Comment, Composer, ThreadStyles, timeAgo } from "./Thread.jsx";

// Study tips rotate by day so the space has something real in it before anyone
// else arrives. Not fake activity — no author, no timestamp, no implied user.
const STUDY_TIPS = [
  "Read the question stem twice before looking at the options. Most wrong answers are misread, not unknown.",
  "If two options are opposites, one of them is usually correct. Eliminate the pair that agrees.",
  "Say the concept out loud in your own words before moving on. If you can't, you haven't got it yet.",
  "Space your review: a chapter revisited tomorrow sticks better than the same chapter read twice today.",
  "Work the numbers before you look at the answer choices, so the options can't anchor you.",
  "When a question mentions altitude, temperature or weight, check which way the effect runs before answering.",
  "Flag what you guessed, not just what you got wrong — a lucky guess is still a gap.",
];

// Prompts are built from the module's own chapters, so they are always
// relevant and never a blank page. Nothing here implies another user.
function promptsFor(chapters) {
  const shapes = [
    (c) => `What surprised you most in ${c.code}?`,
    (c) => `Which part of ${c.title.toLowerCase()} took longest to click?`,
    (c) => `How would you explain ${c.title.toLowerCase()} to someone on day one?`,
    (c) => `What tripped you up on the ${c.code} quiz?`,
  ];
  return chapters.slice(0, 4).map((c, i) => shapes[i % shapes.length](c));
}

const SUBS = [
  { id: "feed", label: "Feed" },
  { id: "threads", label: "Threads" },
  { id: "team", label: "Team" },
];

// One connected social space: the feed, the threads, and who's around, rather
// than three shallow tabs.
function ModuleSocial({ moduleCode, moduleName, onGoToChapter }) {
  const { isSignedIn, user } = useUser();
  const isAdmin = useIsAdmin();
  const progress = useUserProgress();
  const { prefs } = useSocialPrefs();

  const [sub, setSub] = useState("feed");
  const [sort, setSort] = useState("new");
  const [threads, setThreads] = useState([]);
  const [open, setOpen] = useState(null);
  const [posts, setPosts] = useState([]);
  const [votes, setVotes] = useState({});
  const [chips, setChips] = useState({});
  const [myChips, setMyChips] = useState({});
  const [roster, setRoster] = useState([]);
  const [wingmen, setWingmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState("");
  const [seedKey, setSeedKey] = useState(0);

  const chapters = chaptersForModule(moduleCode);
  const completed = new Set(progress.get("pw-completed", []));
  const viewed = new Set(progress.get("pw-viewed-chapters", []));
  const streak = progress.get("pw-streak", 0);

  const load = useCallback(async () => {
    const [t, p, w] = await Promise.all([
      fetchThreads({ moduleCode, limit: 20 }),
      fetchModulePresence(moduleCode, user?.id),
      user?.id ? fetchWingmen(user.id) : Promise.resolve([]),
    ]);
    setThreads(t); setRoster(p); setWingmen(w); setLoading(false);
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

  // Optimistic: the comment shows immediately, then reconciles.
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

  // Optimistic, same as votes: the chip flips instantly.
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
    if (created) setThreads((t) => [created, ...t]);
  };

  const sorted = [...threads].sort((a, b) =>
    sort === "top" ? (b.reply_count || 0) - (a.reply_count || 0) : new Date(b.last_activity_at) - new Date(a.last_activity_at)
  );

  const tree = buildTree(posts.map((p) => ({ ...p, myVote: votes[p.id], reactions: chips[p.id] || {}, myChips: myChips[p.id] })));

  // Your own history, so the feed is never empty on a first visit.
  const events = [{ id: "join", label: "Joined", text: moduleName }];
  if (streak > 0) events.push({ id: "streak", label: "Streak", text: `${streak} days` });
  chapters.forEach((ch) => {
    if (completed.has(ch.id)) events.push({ id: `c${ch.id}`, label: "Completed", text: `${ch.code} ${ch.title}` });
    else if (viewed.has(ch.id)) events.push({ id: `v${ch.id}`, label: "Opened", text: `${ch.code} ${ch.title}` });
  });

  return (
    <div className="soc">
      <div className="soc-subs">
        {SUBS.map((s) => (
          <button key={s.id} className={`soc-sub ${sub === s.id ? "is-active" : ""}`} onClick={() => { setSub(s.id); setOpen(null); }}>
            {s.label}
          </button>
        ))}
        {sub === "threads" && !open && (
          <div className="soc-sort">
            <button className={sort === "new" ? "is-on" : ""} onClick={() => setSort("new")}>New</button>
            <button className={sort === "top" ? "is-on" : ""} onClick={() => setSort("top")}>Top</button>
          </div>
        )}
      </div>

      {sub === "feed" && (
        <div className="soc-cols">
          <div className="soc-main">
            <div className="soc-pinned">
              <span className="soc-pin-label">Tip of the day</span>
              <p className="soc-pin-text">{STUDY_TIPS[new Date().getDate() % STUDY_TIPS.length]}</p>
            </div>
            {roster.length > 0 && (
              <p className="soc-line">{roster.map((r) => r.display_name || "A pilot").join(", ")} studying now.</p>
            )}
            <ul className="soc-events">
              {events.slice(0, 8).map((e) => (
                <li key={e.id}><span className="soc-ev-label">{e.label}</span>{e.text}</li>
              ))}
            </ul>
          </div>
          <aside className="soc-side">
            <p className="soc-side-title">Recent threads</p>
            {sorted.length === 0 ? (
              <p className="soc-muted">Threads open here every week. Start one.</p>
            ) : (
              sorted.slice(0, 4).map((t) => (
                <button key={t.id} className="soc-side-row" onClick={() => { setSub("threads"); setOpen(t); }}>
                  <span>{t.title}</span>
                  <span className="soc-muted">{t.reply_count} · {timeAgo(t.last_activity_at)}</span>
                </button>
              ))
            )}
          </aside>
        </div>
      )}

      {sub === "threads" && (open ? (
        <div className="soc-thread">
          <button className="soc-back" onClick={() => setOpen(null)}><ChevronLeft size={14} /> Threads</button>
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
        </div>
      ) : (
        <div className="soc-threadlist">
          {isSignedIn && <Composer placeholder="Start a thread" onSubmit={startThread} seed={seed} seedKey={seedKey} />}
          <div className="soc-prompts">
            {promptsFor(chapters).map((p) => (
              <button key={p} className="soc-prompt" onClick={() => { setSeed(p); setSeedKey((k) => k + 1); }}>
                {p}
              </button>
            ))}
          </div>
          {loading ? (
            <p className="soc-muted">Coming up…</p>
          ) : sorted.length === 0 ? (
            <div className="soc-invite">
              <p className="soc-invite-title">Open the first thread on {moduleCode}</p>
              <p className="soc-muted">Threads stay open — someone working through this chapter later will read it.</p>
            </div>
          ) : (
            sorted.map((t) => (
              <button key={t.id} className="soc-row" onClick={() => setOpen(t)}>
                <span className="soc-row-title">{t.title}</span>
                <span className="soc-muted">{displayNameFor(t)} · {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"} · {timeAgo(t.last_activity_at)}</span>
              </button>
            ))
          )}
        </div>
      ))}

      {sub === "team" && (
        <div className="soc-cols">
          <div className="soc-main">
            <p className="soc-side-title">Studying now</p>
            {roster.length === 0 ? (
              <div className="soc-seats">
                <span className="soc-seat" aria-hidden="true" />
                <span className="soc-seat" aria-hidden="true" />
                <span className="soc-seat" aria-hidden="true" />
                <p className="soc-muted">Open seats. Check in and you're the first voice in this cabin.</p>
              </div>
            ) : (
              <ul className="soc-people">
                {roster.map((r) => (
                  <li key={r.user_id}>
                    <span className="soc-dot" aria-hidden="true" />
                    {r.display_name || "Pilot"}
                    <span className="soc-muted">{CHAPTERS.find((c) => c.id === r.chapter_id)?.code || moduleCode}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="soc-side">
            <p className="soc-side-title">Your wingmen</p>
            {wingmen.length === 0 ? (
              <div className="soc-seats">
                <span className="soc-seat" aria-hidden="true" />
                <span className="soc-seat" aria-hidden="true" />
                <p className="soc-muted">Add a wingman and your streaks fly together.</p>
              </div>
            ) : (
              <ul className="soc-people">
                {wingmen.map((w) => <li key={w.wingman_user_id}>{w.display_name || "Pilot"}</li>)}
              </ul>
            )}
          </aside>
        </div>
      )}

      <ThreadStyles />
      <style>{`
        .soc-subs { display: flex; align-items: center; gap: 4px; margin-bottom: 16px; }
        .soc-sub { background: none; border: none; color: var(--muted); font-size: 13px; cursor: pointer;
          padding: 8px 12px; border-radius: var(--r-sm); min-height: 38px; }
        .soc-sub:hover { color: var(--text); background: var(--elev-2); }
        .soc-sub.is-active { color: var(--text); background: var(--elev-2); }
        .soc-sort { margin-left: auto; display: flex; gap: 2px; }
        .soc-sort button { background: none; border: none; color: var(--muted2); font-size: 12px; cursor: pointer;
          padding: 6px 10px; border-radius: var(--r-sm); min-height: 34px; }
        .soc-sort button.is-on { color: var(--accent); }
        .soc-cols { display: grid; grid-template-columns: 1.6fr 1fr; gap: 22px; align-items: start; }
        @media (max-width: 820px) { .soc-cols { grid-template-columns: 1fr; } }
        .soc-line { font-size: 13px; color: var(--text-soft); margin: 0 0 14px; }
        .soc-muted { font-size: 12.5px; color: var(--muted); margin: 0; }
        .soc-events { list-style: none; margin: 0; padding: 0; }
        .soc-events li { display: flex; align-items: center; gap: 10px; padding: 9px 0;
          border-bottom: 1px solid var(--border-soft); font-size: 13px; color: var(--text-soft); }
        .soc-events li:last-child { border-bottom: none; }
        .soc-ev-label { font-size: 11px; color: var(--muted2); min-width: 68px; }
        .soc-side-title { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
        .soc-side-row, .soc-row { display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left;
          background: none; border: none; border-bottom: 1px solid var(--border-soft); padding: 10px 0; cursor: pointer; }
        .soc-side-row:last-child { border-bottom: none; }
        .soc-side-row span:first-child, .soc-row-title { font-size: 13px; color: var(--text); }
        .soc-row:hover .soc-row-title, .soc-side-row:hover span:first-child { color: var(--accent); }
        .soc-threadlist { display: flex; flex-direction: column; gap: 2px; }
        .soc-threadlist > .composer, .soc-threadlist > .composer-collapsed { margin-bottom: 10px; }
        .soc-back { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted);
          font-size: 12.5px; cursor: pointer; padding: 4px 0; margin-bottom: 10px; }
        .soc-back:hover { color: var(--text); }
        .soc-thread-title { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 3px; }
        .soc-thread-body { font-size: 13.5px; line-height: 1.55; color: var(--text-soft); margin: 10px 0 0; }
        .soc-comments { margin: 14px 0; }
        .soc-people { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 13px; color: var(--text-soft); }
        .soc-people li { display: flex; align-items: center; gap: 8px; }
        /* prompt cards: swipeable on touch, one tap to open a filled composer */
        .soc-prompts { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 10px; margin-bottom: 6px;
          scroll-snap-type: x proximity; scrollbar-width: none; }
        .soc-prompts::-webkit-scrollbar { display: none; }
        .soc-prompt { flex: 0 0 auto; max-width: 250px; scroll-snap-align: start; text-align: left;
          background: var(--elev-1); border: 1px solid var(--border-soft); border-radius: var(--r-md);
          padding: 11px 14px; color: var(--text-soft); font-size: 12.5px; line-height: 1.4; cursor: pointer;
          min-height: 44px; transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease; }
        .soc-prompt:hover { border-color: var(--accent-dim); color: var(--text); transform: translateY(-2px); }
        .app.reduce-motion .soc-prompt { transition: none; }
        .app.reduce-motion .soc-prompt:hover { transform: none; }
        .soc-pinned { border: 1px solid var(--border-soft); border-radius: var(--r-md); padding: 13px 15px; margin-bottom: 16px;
          background: var(--presence-soft); }
        .soc-pin-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--presence); }
        .soc-pin-text { font-size: 13px; line-height: 1.55; color: var(--text-soft); margin: 6px 0 0; }
        .soc-invite { border: 1px dashed var(--accent-dim); border-radius: var(--r-md); padding: 22px; text-align: center; }
        .soc-invite-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); margin: 0 0 5px; }
        .soc-seats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .soc-seat { width: 26px; height: 26px; border-radius: 50%; border: 1px dashed var(--border-hover); flex-shrink: 0; }
        .soc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--presence);
          box-shadow: 0 0 0 3px var(--presence-soft); animation: presencePulse 3.6s ease-in-out infinite; }
        @keyframes presencePulse { 0%,100% { box-shadow: 0 0 0 2px var(--presence-soft); } 50% { box-shadow: 0 0 0 6px var(--presence-soft); } }
        .app.reduce-motion .soc-dot { animation: none; }
      `}</style>
    </div>
  );
}

export default ModuleSocial;
