import { useState, useEffect } from "react";
import { Radio, Activity, Compass, ChevronRight } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { CHAPTERS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { displayNameFor } from "../lib/social.js";
import { fetchModulePresence } from "../lib/presence.js";
import { fetchThreads } from "../lib/discussion.js";

function when(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Social scoped to one module. Every section has a designed sparse state — a
// motif, a tight hierarchy and a next action — rather than a flat negative line.
function ModuleSocial({ moduleCode, moduleName, onGoToChapter, onSignIn }) {
  const { isSignedIn, user } = useUser();
  const progress = useUserProgress();
  const [roster, setRoster] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const chapters = chaptersForModule(moduleCode);
  const completed = new Set(progress.get("pw-completed", []));
  const viewed = new Set(progress.get("pw-viewed-chapters", []));
  const streak = progress.get("pw-streak", 0);

  useEffect(() => {
    let live = true;
    Promise.all([fetchModulePresence(moduleCode, user?.id), fetchThreads({ moduleCode, limit: 12 })]).then(([p, t]) => {
      if (!live) return;
      setRoster(p); setThreads(t); setLoading(false);
    });
    return () => { live = false; };
  }, [moduleCode, user?.id]);

  // Your activity is never blank: it is seeded from the user's own logged
  // events, which always exist once they have opened anything.
  const ownEvents = [];
  chapters.forEach((ch) => {
    if (completed.has(ch.id)) ownEvents.push({ id: `c-${ch.id}`, kind: "Logged", text: `${ch.code} complete`, chapter: ch });
    else if (viewed.has(ch.id)) ownEvents.push({ id: `v-${ch.id}`, kind: "Opened", text: `${ch.code} briefing opened`, chapter: ch });
  });
  if (streak > 0) ownEvents.unshift({ id: "streak", kind: "Streak", text: `${streak}-day streak running` });
  ownEvents.unshift({ id: "joined", kind: "Enlisted", text: `Joined ${moduleName}` });

  // Genuine module-level aggregates — counts of things that actually exist.
  const threadCount = threads.length;
  const contributors = new Set(threads.map((t) => t.user_id)).size;
  const lastActive = threads[0]?.last_activity_at;

  return (
    <div className="msoc">
      {/* presence */}
      <section className="msoc-panel bezel">
        <p className="msoc-kicker"><Radio size={11} /> Studying now</p>
        {loading ? (
          <p className="msoc-sub">Scanning the frequency…</p>
        ) : roster.length > 0 ? (
          <ul className="msoc-roster">
            {roster.map((r) => (
              <li key={r.user_id}>
                <span className="msoc-live" aria-hidden="true" />
                {r.display_name || "Pilot"}
                <span className="msoc-sub">{CHAPTERS.find((c) => c.id === r.chapter_id)?.code || moduleCode}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="msoc-quiet">
            <span className="msoc-pulse" aria-hidden="true"><span /><span /><span /></span>
            <div>
              <p className="msoc-quiet-title">Frequency open</p>
              <p className="msoc-sub">Be the first — start a session and your squadron sees you go active.</p>
            </div>
            <button className="msoc-cta" onClick={() => onGoToChapter(moduleCode, chapters.find((c) => !completed.has(c.id))?.id || chapters[0]?.id)}>
              Start a session <ChevronRight size={13} />
            </button>
          </div>
        )}
      </section>

      {/* your activity — seeded, never blank */}
      <section className="msoc-panel bezel">
        <p className="msoc-kicker"><Activity size={11} /> Your activity</p>
        <ul className="msoc-log">
          {ownEvents.slice(0, 6).map((e) => (
            <li key={e.id}>
              <span className="msoc-tag">{e.kind}</span>
              <span className="msoc-log-text">{e.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* discovery */}
      <section className="msoc-panel bezel msoc-wide">
        <p className="msoc-kicker"><Compass size={11} /> Discovery</p>
        <div className="msoc-stats">
          <div><b>{threadCount}</b><span>thread{threadCount === 1 ? "" : "s"} in {moduleCode}</span></div>
          <div><b>{contributors}</b><span>pilot{contributors === 1 ? "" : "s"} contributing</span></div>
          <div><b>{chapters.length}</b><span>chapters in sector</span></div>
          {lastActive && <div><b>{when(lastActive)}</b><span>last transmission</span></div>}
        </div>
        {threads.length > 0 ? (
          <ul className="msoc-threads">
            {threads.slice(0, 5).map((t) => (
              <li key={t.id}>
                <span className="msoc-code">{t.chapter_id ? CHAPTERS.find((c) => c.id === t.chapter_id)?.code || moduleCode : moduleCode}</span>
                <span className="msoc-thread-title">{t.title}</span>
                <span className="msoc-sub">{displayNameFor(t)} · {t.reply_count} replies</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="msoc-quiet">
            <span className="msoc-sweep" aria-hidden="true" />
            <div>
              <p className="msoc-quiet-title">No transmissions logged</p>
              <p className="msoc-sub">Open the first thread for {moduleCode} — questions here reach everyone flying this sector.</p>
            </div>
          </div>
        )}
      </section>

      <style>{`
        .msoc { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
        .msoc-wide { grid-column: 1 / -1; }
        .msoc-panel { padding: 18px 20px; }
        .msoc-kicker { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent-tint); opacity: 0.9; margin: 0 0 12px; }
        .msoc-sub { font-size: 12px; color: var(--muted); margin: 0; }
        .msoc-quiet { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .msoc-quiet-title { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 700; color: var(--text-soft); margin: 0 0 3px; }
        /* breathing presence indicator rather than a flat negative line */
        .msoc-pulse { position: relative; width: 34px; height: 34px; flex-shrink: 0; }
        .msoc-pulse span { position: absolute; inset: 0; border-radius: 50%; border: 1px solid var(--accent);
          opacity: 0; animation: msocPulse 3s ease-out infinite; }
        .msoc-pulse span:nth-child(2) { animation-delay: 1s; }
        .msoc-pulse span:nth-child(3) { animation-delay: 2s; }
        @keyframes msocPulse { 0% { transform: scale(0.35); opacity: 0.55; } 100% { transform: scale(1); opacity: 0; } }
        .msoc-sweep { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--border);
          background: conic-gradient(from 0deg, var(--accent-glow), transparent 55%); animation: msocSweep 3.6s linear infinite; }
        @keyframes msocSweep { to { transform: rotate(360deg); } }
        .msoc-cta { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; background: none;
          border: 1px solid var(--accent-dim); color: var(--accent); border-radius: var(--r-sm); padding: 9px 13px;
          font-size: 12px; cursor: pointer; min-height: 38px; }
        .msoc-cta:hover { background: var(--accent-soft); }
        .msoc-roster { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 12.5px; color: var(--text-soft); }
        .msoc-roster li { display: flex; align-items: center; gap: 8px; }
        .msoc-live { width: 7px; height: 7px; border-radius: 50%; background: var(--good); box-shadow: 0 0 6px color-mix(in srgb, var(--good) 55%, transparent); }
        .msoc-log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .msoc-log li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-soft); font-size: 12.5px; }
        .msoc-log li:last-child { border-bottom: none; }
        .msoc-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--accent); border: 1px solid var(--accent-dim); border-radius: var(--r-pill); padding: 2px 8px; flex-shrink: 0; }
        .msoc-log-text { color: var(--text-soft); }
        .msoc-stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 14px; }
        .msoc-stats div { display: flex; flex-direction: column; }
        .msoc-stats b { font-family: 'JetBrains Mono', monospace; font-size: 17px; color: var(--text); font-variant-numeric: tabular-nums; }
        .msoc-stats span { font-size: 11px; color: var(--muted); }
        .msoc-threads { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .msoc-threads li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border-soft); font-size: 12.5px; flex-wrap: wrap; }
        .msoc-threads li:last-child { border-bottom: none; }
        .msoc-code { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--accent-tint); }
        .msoc-thread-title { color: var(--text); }
        .app.reduce-motion .msoc-pulse span, .app.reduce-motion .msoc-sweep { animation: none; }
        @media (prefers-reduced-motion: reduce) { .msoc-pulse span, .msoc-sweep { animation: none; } }
        @media (max-width: 820px) { .msoc { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export default ModuleSocial;
