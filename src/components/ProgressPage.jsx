import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchMyAttempts } from "../lib/quizStats.js";
import { fetchMyCompletions } from "../lib/partners.js";
import { missedTwice, weakestModule, dueForAnotherPass } from "../lib/logbook.js";
import { ChevronLeft } from "lucide-react";
import { allModules, chaptersFor, loadTestContent, testContentSync } from "./module/moduleContent.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useSavesCount } from "../features/bookmarks/deck.js";

// The canonical detail view. Every stat tile elsewhere is a summary that links
// here, so this page carries the breakdown rather than restating one number.

// A summary cell. With something to report it is a number and its unit; with
// nothing, it is the invitation alone — never a number and a dash.
function Tile({ value, suffix = "", unit, invite }) {
  if (!value) return <div className="prog-tile is-invite"><span>{invite}</span></div>;
  return (
    <div className="prog-tile">
      <b>{value}{suffix}</b>
      <span>{unit}</span>
    </div>
  );
}

function ProgressPage({ onBack }) {
  const progress = useUserProgress();
  const [completed, setCompleted] = useState([]);
  /* THE SAVED TILE READS THE SAVES STORE, not pw-bookmarks. That key held the
     old Saved screen's flat list of question ids and nothing writes it any
     more, so this tile counted 0 for every student and showed its invitation
     instead — a stat that had quietly stopped being a stat. */
  const saved = useSavesCount("all");
  const [scores, setScores] = useState({});
  const [lastVisit, setLastVisit] = useState(null);
  /* EVERY CHAPTER IN THE APP, FROM WHAT THE APP IS ACTUALLY SERVING. This page
     read data.js's global `CHAPTERS` array — twenty chapters of skeleton —
     while `content.test` is on for everyone and the app shows twelve. So the
     tile read "of 20 chapters" against a total of twelve, and the Debrief
     looked every score up by id in an array the fixture's ids are not in and
     therefore listed nothing at all. CLAUDE.md calls reading the global array
     "a bug waiting to surface"; this is where it surfaced. */
  const [content, setContent] = useState(() => testContentSync());
  useEffect(() => {
    if (content) return undefined;
    let live = true;
    loadTestContent().then((c) => { if (live) setContent(c); });
    return () => { live = false; };
  }, [content]);
  const chapters = allModules(content).flatMap((m) => chaptersFor(m.code, content));
  // §9.5 — the analysis Home is not allowed to carry.
  const { user } = useUser();
  const [attempts, setAttempts] = useState([]);
  const [completions, setCompletions] = useState([]);

  useEffect(() => {
    if (!progress.loaded) return;
    setCompleted(progress.get("pw-completed", []));
    setScores(progress.get("pw-quiz-scores", {}));
    setLastVisit(progress.get("pw-last-visit", null));
  }, [progress.loaded, progress.isSignedIn]);

  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    Promise.all([fetchMyAttempts(user.id, 200), fetchMyCompletions(user.id)])
      .then(([a, c]) => { if (live) { setAttempts(a || []); setCompletions(c || []); } })
      .catch(() => {});
    return () => { live = false; };
  }, [user?.id]);

  const done = new Set(completed);
  const scoreValues = Object.values(scores);
  const accuracy = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;

  return (
    <div className="prog">
      <button className="prog-back" onClick={onBack}><ChevronLeft size={16} /> Back</button>
      <h1 className="prog-title">Logbook</h1>
      <p className="prog-sub">Everything the app has recorded, in one place.</p>

      {/* §15 — no bare em-dash, and §14 — never state an absence. A tile with
          nothing to report drops the numeral entirely and gives the whole cell
          to the sentence that says what to do next. */}
      <section className="prog-summary">
        <Tile value={done.size} unit={`of ${chapters.length} chapters`}
          invite={`${chapters.length} chapters ahead of you`} />
        <Tile value={accuracy === null ? 0 : accuracy} suffix="%" unit="quiz accuracy"
          invite="Take a quiz to set your accuracy" />
        {/* THERE IS NO STREAK TILE. This app does not use streaks — the
            decision is the owner's, 2026-09-20, and it is the same one
            familiar.js already argued for: a streak works by making you
            afraid to lose something, and these are students with eleven
            classmates, not an audience. `pw-streak` and `pw-longest-streak`
            had no writer either, so the tile could only ever read nothing and
            offer to start a streak nothing would have counted. */}
        {/* "Star" was the old screen's verb and the old screen's icon. The
            control is a bookmark, on four different surfaces now, and the
            invitation has to name the one the student will actually meet. */}
        <Tile value={saved} unit="saved"
          invite="Bookmark a question, a card, a lesson or a page and it lands here" />
      </section>

      {(() => {
        const chapterOf = (id) => chapters.find((c) => c.id === id);
        const moduleOf = (id) => chapterOf(id)?.code.split(".")[0] || null;
        const weak = weakestModule(scores, moduleOf);
        const twice = missedTwice(attempts);
        const due = dueForAnotherPass(completions, scores);
        if (!weak && !twice.length && !due.length) return null;
        return (
          <section className="prog-block">
            <h2 className="prog-h2">Worth another look</h2>
            <ul className="prog-look">
              {weak && (
                <li>
                  <span className="prog-look-what">{weak.code}</span>
                  <span className="prog-look-why">
                    your lowest average — {weak.average}% across {weak.chapters}{" "}
                    {weak.chapters === 1 ? "chapter" : "chapters"}
                  </span>
                </li>
              )}
              {twice.length > 0 && (
                <li>
                  <span className="prog-look-what">
                    {twice.length} {twice.length === 1 ? "question" : "questions"}
                  </span>
                  <span className="prog-look-why">
                    missed more than once — {[...new Set(twice.map((t) => chapterOf(t.chapter_id)?.code).filter(Boolean))].join(", ")}
                  </span>
                </li>
              )}
              {due.slice(0, 3).map((x) => (
                <li key={x.chapter_id}>
                  <span className="prog-look-what">{chapterOf(x.chapter_id)?.code || "A chapter"}</span>
                  <span className="prog-look-why">{x.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <section className="prog-block">
        <h2 className="prog-h2">By module</h2>
        <ul className="prog-modules">
          {allModules(content).map((m) => {
            const chs = chaptersFor(m.code, content);
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

      {/* The fortnight of dots went with the streak: every one of them was
          drawn from it, so with nothing counting days the grid was fourteen
          empty cells stating an absence. The date itself is a real fact from
          a real key and stays, as the sentence it always was. */}
      <p className="prog-note prog-note--lead">
        {lastVisit ? `Last studied ${lastVisit}.` : "Open a chapter and it starts filling in."}
      </p>

      {Object.keys(scores).length > 0 && (
        <section className="prog-block">
          <h2 className="prog-h2">Debrief</h2>
          <ul className="prog-scores">
            {Object.entries(scores).map(([id, s]) => {
              const ch = chapters.find((c) => c.id === id);
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
          color: var(--accent-muted); font-size: 14px; cursor: pointer; padding: 6px 0; margin-bottom: 10px; }
        .prog-title { font-family: var(--font-display); font-size: 28px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
        .prog-sub { font-size: 14px; color: var(--muted); margin: 0 0 24px; }
        .prog-tile { display: flex; flex-direction: column; }
        .prog-tile.is-invite { justify-content: center; }
        .prog-tile.is-invite span { font-size: 14px; line-height: 1.45; }
        .prog-look { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: var(--r-panel); overflow: hidden; }
        .prog-look li { background: var(--bg-panel); padding: 12px 14px; display: flex;
          flex-wrap: wrap; align-items: baseline; gap: 8px; }
        .prog-look-what { font-size: 16px; color: var(--text-primary); }
        .prog-look-why { font-size: 14px; color: var(--text-secondary); }
        .prog-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border-soft);
          border: 1px solid var(--border-soft); border-radius: var(--r-md); overflow: hidden; margin-bottom: 26px; }
        .prog-summary div { background: var(--elev-1); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
        .prog-summary b { font-family: var(--font-mono); font-size: 20px; color: var(--text); font-variant-numeric: tabular-nums; }
        .prog-summary span { font-size: 12px; color: var(--muted); }
        @media (max-width: 620px) { .prog-summary { grid-template-columns: repeat(2, 1fr); } }
        .prog-block { margin-bottom: 26px; }
        .prog-h2 { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 12px; }
        .prog-modules, .prog-scores { list-style: none; margin: 0; padding: 0; }
        .prog-modules li { margin-bottom: 13px; }
        .prog-mod-head { display: flex; align-items: baseline; gap: 9px; margin-bottom: 6px; font-size: 14px; }
        .prog-code { font-family: var(--font-mono); font-size: 12px; color: var(--accent-tint); flex-shrink: 0; }
        .prog-name { color: var(--text-soft); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .prog-pct { font-family: var(--font-mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .prog-track { height: 5px; border-radius: var(--r-pill); background: var(--well); overflow: hidden; box-shadow: var(--shadow-inset); }
        .prog-fill { height: 100%; border-radius: var(--r-pill);
          background: linear-gradient(90deg, color-mix(in oklab, var(--accent), transparent 55%), var(--accent));
          transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
        .prog-note { font-size: 12px; color: var(--muted); margin: 0; }
        .prog-note--lead { margin: -8px 0 22px; }
        .prog-scores li { display: flex; align-items: center; gap: 10px; padding: 9px 0;
          border-bottom: 1px solid var(--border-soft); font-size: 14px; }
        .prog-scores li:last-child { border-bottom: none; }
        .prog-score { font-family: var(--font-mono); font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; }
        .prog-score.is-low { color: var(--calm); }
        .app.reduce-motion .prog-fill { transition: none; }
      `}</style>
    </div>
  );
}

export default ProgressPage;
