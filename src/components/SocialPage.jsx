import { useState, useEffect } from "react";
import { Users, Radio, MessageSquare, NotebookPen, Star } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS } from "../data.js";
import { displayNameFor, MIN_POPULATION } from "../lib/social.js";
import { fetchAllPresence } from "../lib/presence.js";
import { fetchPartnerSuggestions, fetchWingmen, addWingman, fetchJointStreak } from "../lib/partners.js";
import { fetchThreadsForModules, fetchRepliesToUser } from "../lib/discussion.js";

function when(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const chapterTitle = (id) => CHAPTERS.find((c) => c.id === id)?.title || null;

// Ordered by immediacy: who is here now, then what happened to your work, then
// everything else worth browsing.
function SocialPage({ prefs, enrolledCodes = [], onGoToChapter }) {
  const { isSignedIn, user } = useUser();
  const [presence, setPresence] = useState([]);
  const [suggest, setSuggest] = useState({ belowThreshold: true, active: 0, suggestions: [] });
  const [wingmen, setWingmen] = useState([]);
  const [jointStreak, setJointStreak] = useState(null);
  const [replies, setReplies] = useState([]);
  const [threads, setThreads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const modules = enrolledCodes.length ? enrolledCodes : MODULES.map((m) => m.code);

  useEffect(() => {
    let live = true;
    (async () => {
      const [p, s, w, r, t] = await Promise.all([
        fetchAllPresence(user?.id),
        fetchPartnerSuggestions({ userId: user?.id, moduleCode: null, course: prefs?.course }),
        user?.id ? fetchWingmen(user.id) : Promise.resolve([]),
        user?.id ? fetchRepliesToUser(user.id) : Promise.resolve([]),
        fetchThreadsForModules(modules),
      ]);
      if (!live) return;
      setPresence(p); setSuggest(s); setWingmen(w); setReplies(r); setThreads(t);
      setLoading(false);
      if (w[0] && user?.id) setJointStreak(await fetchJointStreak(user.id, w[0].wingman_user_id));
    })();
    return () => { live = false; };
  }, [user?.id, prefs?.course, enrolledCodes.join(",")]);

  const wingmanIds = new Set(wingmen.map((w) => w.wingman_user_id));
  // A wingman's activity always outranks a generic classmate's.
  const rankedPresence = [...presence].sort((a, b) => Number(wingmanIds.has(b.user_id)) - Number(wingmanIds.has(a.user_id)));
  const shownThreads = filter === "all" ? threads : threads.filter((t) => t.module_code === filter);

  const mark = async (p) => {
    if (!user?.id) return;
    await addWingman(user.id, p.user_id, p.display_name);
    setWingmen(await fetchWingmen(user.id));
  };

  return (
    <div className="social">
      <header className="social-head">
        <h1 className="social-title">Social</h1>
        <p className="social-sub">Who's flying, what's happening to your notes, and what's new across your modules.</p>
      </header>

      {/* 1 — presence & suggestions */}
      <section className="social-section">
        <h2 className="social-h2"><Radio size={14} /> Studying now</h2>
        {loading ? (
          <p className="social-empty">Checking the frequency…</p>
        ) : suggest.belowThreshold ? (
          <p className="social-empty">
            No one else studying this yet. Presence and partner suggestions switch on once {MIN_POPULATION} pilots are active.
          </p>
        ) : (
          <div className="social-rows">
            {rankedPresence.map((p) => (
              <div key={p.user_id} className="social-row">
                <span className="social-dot" aria-hidden="true" />
                <span className="social-name">{p.display_name || "Pilot"}</span>
                {wingmanIds.has(p.user_id) && <span className="social-tag"><Star size={10} /> Wingman</span>}
                <span className="social-meta">
                  {p.chapter_id ? chapterTitle(p.chapter_id) || p.module_code : p.module_code || "somewhere"}
                </span>
                {!wingmanIds.has(p.user_id) && isSignedIn && (
                  <button className="social-link" onClick={() => mark(p)}>Mark as wingman</button>
                )}
                {p.chapter_id && (
                  <button className="social-join" onClick={() => onGoToChapter?.(p.module_code, p.chapter_id)}>Join</button>
                )}
              </div>
            ))}
            {suggest.suggestions.slice(0, 3).map((s) => (
              <p key={`s-${s.userId}`} className="social-suggest">
                You match {s.displayName || "a classmate"} — {s.reason}
              </p>
            ))}
          </div>
        )}
        {jointStreak?.current > 0 && (
          <p className="social-joint">Joint streak with your wingman: <strong>{jointStreak.current} days</strong> (best {jointStreak.longest})</p>
        )}
      </section>

      {/* 2 — your activity */}
      <section className="social-section">
        <h2 className="social-h2"><Users size={14} /> Your activity</h2>
        {replies.length === 0 ? (
          <p className="social-empty">Nothing has come back to you yet. Post a note or a thread and replies land here.</p>
        ) : (
          <div className="social-rows">
            {replies.map((r) => (
              <div key={r.id} className="social-row">
                <MessageSquare size={12} className="social-icon" />
                <span className="social-name">{displayNameFor(r)}</span>
                <span className="social-meta">replied to “{r.thread_title}”</span>
                <span className="social-time">{when(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3 — discovery */}
      <section className="social-section">
        <div className="social-head-row">
          <h2 className="social-h2"><NotebookPen size={14} /> Discovery</h2>
          <select className="social-filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by module">
            <option value="all">All modules</option>
            {MODULES.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
        </div>
        {shownThreads.length === 0 ? (
          <p className="social-empty">No threads yet in these modules.</p>
        ) : (
          <div className="social-rows">
            {shownThreads.map((t) => (
              <button key={t.id} className="social-row is-button" onClick={() => onGoToChapter?.(t.module_code, t.chapter_id)}>
                <span className="social-code">{t.module_code}</span>
                <span className="social-name">{t.title}</span>
                <span className="social-meta">{displayNameFor(t)} · {t.reply_count} replies</span>
                <span className="social-time">{when(t.last_activity_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .social-head { margin-bottom: 22px; }
        .social-title { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); margin: 0 0 4px; }
        .social-sub { font-size: 14px; color: var(--muted); margin: 0; }
        .social-section { margin-bottom: 30px; }
        .social-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .social-h2 { display: inline-flex; align-items: center; gap: 7px; font-family: 'Space Grotesk', sans-serif; font-size: 15px;
          font-weight: 700; color: var(--text); margin: 0 0 10px; }
        .social-rows { display: flex; flex-direction: column; }
        .social-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 11px 2px;
          border-bottom: 1px solid var(--border-soft); font-size: 12.5px; }
        .social-row.is-button { width: 100%; text-align: left; background: none; border-left: none; border-right: none; border-top: none; cursor: pointer; }
        .social-row.is-button:hover .social-name { color: var(--accent); }
        .social-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--good);
          box-shadow: 0 0 6px color-mix(in srgb, var(--good) 55%, transparent); flex-shrink: 0; }
        .social-icon { color: var(--muted2); flex-shrink: 0; }
        .social-name { color: var(--text); font-weight: 600; }
        .social-meta { color: var(--muted); }
        .social-time { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--muted2); }
        .social-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent); }
        .social-tag { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); background: var(--accent-soft);
          border-radius: var(--r-pill); padding: 2px 8px; }
        .social-link, .social-join { background: none; border: none; color: var(--muted); font-size: 11.5px; cursor: pointer; padding: 4px 0; }
        .social-link:hover { color: var(--text); }
        .social-join { color: var(--accent); }
        .social-suggest { font-size: 12.5px; color: var(--muted); margin: 10px 0 0; }
        .social-joint { font-size: 12.5px; color: var(--text-soft); margin: 12px 0 0; }
        .social-joint strong { color: var(--accent); }
        .social-empty { font-size: 12.5px; color: var(--muted); margin: 0; padding: 6px 0; }
        .social-filter { background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--text-soft);
          font-size: 12px; padding: 8px 10px; min-height: 38px; }
      `}</style>
    </div>
  );
}

export default SocialPage;
