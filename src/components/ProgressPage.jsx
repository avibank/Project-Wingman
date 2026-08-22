import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { MODULES, CHAPTERS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.jsx";

const DAY_MS = 86400000;

// The canonical detail view. Every stat tile elsewhere is a summary that links
// here, so this page carries the breakdown rather than restating one number.
function ProgressPage({ onBack }) {
  const progress = useUserProgress();
  const [completed, setCompleted] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [scores, setScores] = useState({});
  const [streak, setStreak] = useState(0);
  const [longest, setLongest] = useState(0);
  const [lastVisit, setLastVisit] = useState(null);

  useEffect(() => {
    if (!progress.loaded) return;
    setCompleted(progress.get("pw-completed", []));
    setBookmarks(progress.get("pw-bookmarks", []));
    setScores(progress.get("pw-quiz-scores", {}));
    setStreak(progress.get("pw-streak", 0));
    setLongest(progress.get("pw-longest-streak", 0));
    setLastVisit(progress.get("pw-last-visit", null));
  }, [progress.loaded, progress.isSignedIn]);

  const done = new Set(completed);
  const scoreValues = Object.values(scores);
  const accuracy = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  // A trailing fortnight, derived from the streak we already track. Only the
  // days we can actually account for are filled — nothing is invented.
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * DAY_MS);
    const withinStreak = streak > 0 && (13 - i) < streak;
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: "narrow" }), active: withinStreak };
  });

  return (
    <div className="prog">
      <button className="prog-back" onClick={onBack}><ChevronLeft size={16} /> Back</button>
      <h1 className="prog-title">Logbook</h1>
      <p className="prog-sub">Everything the app has recorded, in one place.</p>

      <section className="prog-summary">
        <div><b>{done.size || "—"}</b><span>{done.size ? `of ${CHAPTERS.length} chapters` : `${CHAPTERS.length} chapters ahead`}</span></div>
        <div><b>{accuracy === null ? "—" : `${accuracy}%`}</b><span>{accuracy === null ? "no quizzes yet" : "quiz accuracy"}</span></div>
        <div><b>{streak || "—"}</b><span>{streak ? `day streak${longest > streak ? ` · best ${longest}` : ""}` : "study today to start a streak"}</span></div>
        <div><b>{bookmarks.length || "—"}</b><span>{bookmarks.length ? "squawked" : "flag a question to squawk it"}</span></div>
      </section>

      <section className="prog-block">
        <h2 className="prog-h2">By module</h2>
        <ul className="prog-modules">
          {MODULES.map((m) => {
            const chs = chaptersForModule(m.code);
            const n = chs.filter((c) => done.has(c.id)).length;
            const pct = chs.length ? Math.round((n / chs.length) * 100) : 0;
            return (
              <li key={m.code}>
                <div className="prog-mod-head">
                  <span className="prog-code">{m.code}</span>
                  <span className="prog-name">{m.name}</span>
                  <span className="prog-pct">{n}/{chs.length}</span>
                </div>
                <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="prog-block">
        <h2 className="prog-h2">Last two weeks</h2>
        <div className="prog-cal">
          {days.map((d) => <span key={d.key} className={`prog-day ${d.active ? "is-on" : ""}`} title={d.key} />)}
        </div>
        <p className="prog-note">
          {lastVisit ? `Last studied ${lastVisit}.` : "Open a chapter and it starts filling in."}
        </p>
      </section>

      {Object.keys(scores).length > 0 && (
        <section className="prog-block">
          <h2 className="prog-h2">Debrief</h2>
          <ul className="prog-scores">
            {Object.entries(scores).map(([id, s]) => {
              const ch = CHAPTERS.find((c) => c.id === id);
              if (!ch) return null;
              return (
                <li key={id}>
                  <span className="prog-code">{ch.code}</span>
                  <span className="prog-name">{ch.title}</span>
                  <span className={`prog-score ${s < 70 ? "is-low" : ""}`}>{s}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <style>{`
        .prog { max-width: 720px; }
        .prog-back { display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
          color: var(--accent-muted); font-size: 13px; cursor: pointer; padding: 6px 0; margin-bottom: 10px; }
        .prog-title { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
        .prog-sub { font-size: 13.5px; color: var(--muted); margin: 0 0 24px; }
        .prog-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-soft);
          border: 1px solid var(--border-soft); border-radius: var(--r-md); overflow: hidden; margin-bottom: 26px; }
        .prog-summary div { background: var(--elev-1); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
        .prog-summary b { font-family: var(--font-mono); font-size: 19px; color: var(--text); font-variant-numeric: tabular-nums; }
        .prog-summary span { font-size: 11.5px; color: var(--muted); }
        @media (max-width: 620px) { .prog-summary { grid-template-columns: repeat(2, 1fr); } }
        .prog-block { margin-bottom: 26px; }
        .prog-h2 { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text); margin: 0 0 12px; }
        .prog-modules, .prog-scores { list-style: none; margin: 0; padding: 0; }
        .prog-modules li { margin-bottom: 13px; }
        .prog-mod-head { display: flex; align-items: baseline; gap: 9px; margin-bottom: 6px; font-size: 13px; }
        .prog-code { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent-tint); flex-shrink: 0; }
        .prog-name { color: var(--text-soft); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .prog-pct { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .prog-track { height: 5px; border-radius: var(--r-pill); background: var(--well); overflow: hidden; box-shadow: var(--shadow-inset); }
        .prog-fill { height: 100%; border-radius: var(--r-pill);
          background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 45%, transparent), var(--accent));
          transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
        .prog-cal { display: flex; gap: 5px; margin-bottom: 9px; }
        .prog-day { width: 22px; height: 22px; border-radius: 5px; background: var(--well); border: 1px solid var(--border-soft); }
        .prog-day.is-on { background: color-mix(in srgb, var(--accent) 55%, transparent); border-color: transparent; }
        .prog-note { font-size: 12.5px; color: var(--muted); margin: 0; }
        .prog-scores li { display: flex; align-items: center; gap: 10px; padding: 9px 0;
          border-bottom: 1px solid var(--border-soft); font-size: 13px; }
        .prog-scores li:last-child { border-bottom: none; }
        .prog-score { font-family: var(--font-mono); font-size: 12.5px; color: var(--text); font-variant-numeric: tabular-nums; }
        .prog-score.is-low { color: var(--calm); }
        .app.reduce-motion .prog-fill { transition: none; }
      `}</style>
    </div>
  );
}

export default ProgressPage;
