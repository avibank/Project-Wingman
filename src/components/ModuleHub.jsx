import { useState, useEffect } from "react";
import { ChevronRight, Radio } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS, NAV, PDFS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.js";
import { useDisplayName } from "../lib/identity.js";
import { useSocialPrefs, displayNameFor } from "../lib/social.js";
import { fetchModulePresence } from "../lib/presence.js";
import { fetchThreads } from "../lib/discussion.js";
import { fetchWingmen } from "../lib/partners.js";
import { ModuleMotif, N1Dial, SplitFlap, InstrumentStyles } from "./instruments.jsx";
import ChaptersPanel from "./ChaptersPanel.jsx";
import DiscussPanel from "./DiscussPanel.jsx";
import PdfPanel from "./PdfPanel.jsx";
import ThreadsPanel from "./ThreadsPanel.jsx";
import ModuleSocial from "./ModuleSocial.jsx";

// Radio-callout phrasing rather than app-notification phrasing.
function callout(row, chapters) {
  const who = displayNameFor(row);
  const ch = chapters.find((c) => c.id === row.chapter_id);
  return `${who} — cleared into ${ch ? ch.code : row.module_code}`;
}

// Everything a module owns lives here. Nothing module-specific sits in global nav.
function ModuleHub({ moduleCode, tab, onTab, onSignIn, initialChapterId, onInitialChapterConsumed, onGoToChapter }) {
  const module = MODULES.find((m) => m.code === moduleCode) || MODULES[0];
  const chapters = chaptersForModule(module.code);
  const progress = useUserProgress();
  const { user } = useUser();
  const displayName = useDisplayName();
  const { prefs } = useSocialPrefs();

  const [roster, setRoster] = useState([]);
  const [threads, setThreads] = useState([]);
  const [wingmen, setWingmen] = useState([]);

  const completed = new Set(progress.get("pw-completed", []));
  const done = chapters.filter((c) => completed.has(c.id)).length;
  const pct = chapters.length ? Math.round((done / chapters.length) * 100) : 0;
  const nextChapter = chapters.find((c) => !completed.has(c.id)) || chapters[0];

  useEffect(() => {
    let live = true;
    (async () => {
      const [p, t, w] = await Promise.all([
        fetchModulePresence(module.code, user?.id),
        fetchThreads({ moduleCode: module.code, limit: 6 }),
        user?.id ? fetchWingmen(user.id) : Promise.resolve([]),
      ]);
      if (!live) return;
      setRoster(p); setThreads(t); setWingmen(w);
    })();
    return () => { live = false; };
  }, [module.code, user?.id]);

  const hue = module.hue;
  const wingIds = new Set(wingmen.map((w) => w.wingman_user_id));

  return (
    <div className="hub2" style={{ "--instr-hue": hue }}>
      <header className="hub2-head bezel">
        <ModuleMotif motif={module.motif} hue={hue} />
        <div className="hub2-head-main">
          <div className="hub2-badge">
            <span className="hub2-code">{module.code}</span>
            <span className="hub2-squawk">SQ {1200 + (module.order ?? 1) * 11}</span>
          </div>
          <h1 className="hub2-name">{module.name}</h1>
          <p className="hub2-status">
            {pct === 100 ? "Module complete" : pct > 0 ? "On track" : "Not started"} · {done}/{chapters.length} chapters logged
          </p>
        </div>
        <N1Dial pct={pct} label="Module" hue={hue} size={96} />
      </header>

      <nav className="hub2-tabs" aria-label={`${module.name} sections`}>
        {NAV.map((t) => (
          <button key={t.id} className={`hub2-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => onTab(t.id)}>
            <t.icon size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="hub2-body">
        {tab === "overview" && (
          <div className="ov">
            <section className="ov-resume bezel">
              <p className="ov-kicker">Next leg</p>
              <h2 className="ov-chapter">
                <span className="ov-code">{nextChapter?.code}</span> {nextChapter?.title}
              </h2>
              <button className="switch" onClick={() => onGoToChapter(module.code, nextChapter?.id)}>
                <span className="switch-lever" aria-hidden="true" />
                <span className="switch-label">{pct > 0 ? "Resume" : "Begin"}</span>
              </button>
            </section>

            <section className="ov-panel bezel">
              <p className="ov-kicker">Sector traffic</p>
              {threads.length === 0 ? (
                <p className="ov-empty">Frequency quiet.</p>
              ) : (
                <ul className="ov-feed">
                  {threads.slice(0, 4).map((t) => (
                    <li key={t.id} className="ov-feed-row">
                      <Radio size={11} className="ov-feed-icon" />
                      <SplitFlap text={callout(t, chapters)} className="ov-feed-text" />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ov-panel bezel">
              <p className="ov-kicker">Active roster</p>
              {roster.length === 0 ? (
                <p className="ov-empty">No one else in this sector right now.</p>
              ) : (
                <ul className="ov-roster">
                  {roster.map((r) => (
                    <li key={r.user_id}>
                      <span className="ov-live" aria-hidden="true" />
                      {r.display_name || "Pilot"}
                      {wingIds.has(r.user_id) && <span className="ov-wing">wingman</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "chapters" && (
          <ChaptersPanel
            activeModuleCode={module.code}
            onSignIn={onSignIn}
            initialChapterId={initialChapterId}
            onInitialChapterConsumed={onInitialChapterConsumed}
          />
        )}

        {tab === "discuss" && (
          <div className="hub2-discuss">
            <ThreadsPanel chapter={{ id: null, code: module.code, title: module.name }} moduleCode={module.code} prefs={prefs} />
            <div className="hub2-legacy">
              <p className="ov-kicker">Module-wide board</p>
              <DiscussPanel onSignIn={onSignIn} calmLights={false} />
            </div>
          </div>
        )}

        {tab === "team" && (
          <div className="team">
            <section className="ov-panel bezel">
              <p className="ov-kicker">Roster</p>
              {roster.length === 0 ? (
                <p className="ov-empty">No pilots airborne in this sector.</p>
              ) : (
                <ul className="ov-roster">
                  {roster.map((r) => (
                    <li key={r.user_id}>
                      <span className="ov-live" aria-hidden="true" />
                      {r.display_name || "Pilot"}
                      {wingIds.has(r.user_id) && <span className="ov-wing">wingman</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="ov-panel bezel">
              <p className="ov-kicker">Your wingmen</p>
              {wingmen.length === 0 ? (
                <p className="ov-empty">No wingman assigned. Mark one from Social.</p>
              ) : (
                <ul className="ov-roster">
                  {wingmen.map((w) => <li key={w.wingman_user_id}><span className="ov-live is-idle" aria-hidden="true" />{w.display_name || "Pilot"}</li>)}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "pdf" && <PdfPanel />}

        {tab === "social" && (
          <ModuleSocial moduleCode={module.code} moduleName={module.name} onGoToChapter={onGoToChapter} onSignIn={onSignIn} />
        )}
      </div>

      <InstrumentStyles />
      <style>{`
        .hub2-head { position: relative; display: flex; align-items: center; gap: 20px; padding: 22px 24px; flex-wrap: wrap; }
        .hub2-head-main { flex: 1; min-width: 200px; position: relative; z-index: 1; }
        .hub2-badge { display: flex; align-items: center; gap: 10px; }
        .hub2-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.16em; color: var(--instr-hue);
          border: 1px solid color-mix(in srgb, var(--instr-hue) 40%, transparent); border-radius: var(--r-sm); padding: 3px 9px; }
        .hub2-squawk { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; color: var(--muted2); }
        .hub2-name { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); margin: 10px 0 4px; }
        .hub2-status { font-size: 12.5px; color: var(--muted); margin: 0; }

        .hub2-tabs { display: flex; gap: 2px; overflow-x: auto; margin: 18px 0 16px; border-bottom: 1px solid var(--border-soft);
          scrollbar-width: none; }
        .hub2-tabs::-webkit-scrollbar { display: none; }
        .hub2-tab { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; white-space: nowrap;
          padding: 10px 13px; color: var(--muted); font-size: 12.5px; cursor: pointer; border-bottom: 2px solid transparent; min-height: 42px; }
        .hub2-tab:hover { color: var(--text); }
        .hub2-tab.is-active { color: var(--instr-hue); border-bottom-color: var(--instr-hue); }

        .ov { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; align-items: start; }
        .ov-resume { grid-column: 1 / -1; padding: 20px 22px; }
        .ov-panel { padding: 18px 20px; position: relative; }
        .ov-kicker { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--accent-tint); opacity: 0.9; margin: 0 0 10px; }
        .ov-chapter { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 16px; }
        .ov-code { font-family: 'JetBrains Mono', monospace; font-size: 0.8em; color: var(--accent-tint); }
        .ov-empty { font-size: 12.5px; color: var(--muted); margin: 0; }
        .ov-feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .ov-feed-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--text-soft); }
        .ov-feed-icon { color: var(--instr-hue); flex-shrink: 0; margin-top: 2px; }
        .ov-roster { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 12.5px; color: var(--text-soft); }
        .ov-roster li { display: flex; align-items: center; gap: 8px; }
        .ov-live { width: 7px; height: 7px; border-radius: 50%; background: var(--good);
          box-shadow: 0 0 6px color-mix(in srgb, var(--good) 55%, transparent); }
        .ov-live.is-idle { background: var(--muted2); box-shadow: none; }
        .ov-wing { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--instr-hue); }

        /* tactile primary control: a guarded toggle rather than a flat pill */
        .switch { display: inline-flex; align-items: center; gap: 0; background: var(--well); border: 1px solid var(--accent-dim);
          box-shadow: 0 0 0 6px var(--accent-glow), 0 10px 26px var(--accent-glow);
          border-radius: var(--r-pill); padding: 4px 18px 4px 4px; cursor: pointer; min-height: 46px;
          box-shadow: var(--shadow-inset); transition: border-color 0.18s ease; }
        .switch-lever { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; margin-right: 12px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--instr-hue) 82%, white), var(--instr-hue));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 5px rgba(0,0,0,0.5);
          transition: transform 0.16s cubic-bezier(0.22,1,0.36,1); }
        .switch-label { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13.5px; color: var(--text);
          letter-spacing: 0.02em; }
        .switch:hover { border-color: var(--instr-hue); }
        .switch:hover .switch-lever { transform: translateY(-1px); }
        .switch:active .switch-lever { transform: translateY(2px) scale(0.97); }
        .app.reduce-motion .switch-lever { transition: none; }

        .hub2-legacy { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border-soft); }
        .team { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
        @media (max-width: 820px) { .ov, .team { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export default ModuleHub;
