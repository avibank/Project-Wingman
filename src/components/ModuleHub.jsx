import { useState, useEffect } from "react";
import { ChevronRight, Radio } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS, NAV, PDFS, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useDisplayName } from "../lib/identity.js";
import { useSocialPrefs, displayNameFor } from "../lib/social.js";
import { fetchModulePresence } from "../lib/presence.js";
import { fetchThreads } from "../lib/discussion.js";
import { fetchWingmen } from "../lib/partners.js";
import { ProgressArc, InstrumentStyles } from "./instruments.jsx";
import ChaptersPanel from "./ChaptersPanel.jsx";
import PdfPanel from "./PdfPanel.jsx";
import ModuleSocial from "./ModuleSocial.jsx";
import Comms from "./Comms.jsx";

function activityLine(row, chapters) {
  const ch = chapters.find((c) => c.id === row.chapter_id);
  return `${displayNameFor(row)} posted in ${ch ? ch.code : row.module_code}`;
}

// Everything a module owns lives here. Nothing module-specific sits in global nav.
function ModuleHub({ moduleCode, tab, onTab, onSignIn, initialChapterId, onInitialChapterConsumed, onGoToChapter, chapterTab, onChapterTab }) {
  // §7.6 — the chapter body carries no tab bar and no module header. While
  // someone is reading, this page gets out of the way entirely.
  const [reading, setReading] = useState(false);
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

  const wingIds = new Set(wingmen.map((w) => w.wingman_user_id));

  return (
    <div className="hub2">
      {!reading && <header className="hub2-head bezel">
        <div className="hub2-head-main">
          <div className="hub2-badge">
            <span className="hub2-code">{module.code}</span>
          </div>
          <h1 className="hub2-name">{module.name}</h1>
          <p className="hub2-status">
            {done} of {chapters.length} chapters
          </p>
        </div>
        <ProgressArc pct={pct} label="Module" size={96} />
      </header>}

      {!reading && <div className="hub2-tabs" role="tablist" aria-label={`${module.name} sections`}>
        {NAV.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
            className={`hub2-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => onTab(t.id)}>
            <t.icon size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>}

      <div className="hub2-body">
        {tab === "chapters" && (
          <ChaptersPanel
            onReadingChange={setReading}
            onGoToChapter={onGoToChapter}
            chapterTab={chapterTab}
            onChapterTab={onChapterTab}
            activeModuleCode={module.code}
            onSignIn={onSignIn}
            initialChapterId={initialChapterId}
            onInitialChapterConsumed={onInitialChapterConsumed}
          />
        )}

        {tab === "pdf" && <PdfPanel moduleCode={module.code} moduleName={module.name} />}

        {tab === "comms" && (
          <Comms moduleCode={module.code} currentChapterId={initialChapterId || null} />
        )}

        {tab === "social" && (
          <ModuleSocial moduleCode={module.code} moduleName={module.name} onGoToChapter={onGoToChapter} onSignIn={onSignIn} />
        )}
      </div>

      <InstrumentStyles />
      <style>{`
        .hub2-head { position: relative; display: flex; align-items: center; gap: 20px; padding: 22px 24px; flex-wrap: wrap; }
        .hub2-head-main { flex: 1; min-width: 200px; position: relative; z-index: 1; }
        .hub2-badge { display: flex; align-items: center; gap: 10px; }
        .hub2-code { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; color: var(--accent);
          border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); border-radius: var(--r-sm); padding: 3px 9px; }
        .hub2-name { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--text); margin: 10px 0 4px; }
        .hub2-status { font-size: 12px; color: var(--muted); margin: 0; }

        .hub2-tabs { display: flex; gap: 2px; overflow-x: auto; margin: 18px 0 16px; border-bottom: 1px solid var(--border-soft);
          scrollbar-width: none; }
        .hub2-tabs::-webkit-scrollbar { display: none; }
        .hub2-tab { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; white-space: nowrap;
          padding: 10px 13px; color: var(--muted); font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent; min-height: 42px; }
        .hub2-tab:hover { color: var(--text); }
        .hub2-tab.is-active { color: var(--accent); border-bottom-color: var(--accent); }

        .ov { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; align-items: start; }
        .ov-resume { grid-column: 1 / -1; padding: 20px 22px; }
        .ov-panel { padding: 18px 20px; position: relative; }
        .ov-kicker { font-family: var(--font-ui); font-size: 12px;
          color: var(--accent-tint); opacity: 0.9; margin: 0 0 10px; }
        .ov-chapter { font-family: var(--font-display); font-size: 17px; font-weight: 600; color: var(--text); margin: 0 0 16px; }
        .ov-code { font-family: var(--font-mono); font-size: 12px; color: var(--accent-tint); }
        .ov-empty { font-size: 12px; color: var(--muted); margin: 0; }
        .ov-feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .ov-feed-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-soft); }
        .ov-feed-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
        .ov-roster { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 12px; color: var(--text-soft); }
        .ov-roster li { display: flex; align-items: center; gap: 8px; }
        .ov-live { width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
           }
        .ov-live.is-idle { background: var(--muted2); box-shadow: none; }
        .ov-wing { font-family: var(--font-ui); font-size: 12px;
          color: var(--accent); }

        /* tactile primary control: a guarded toggle rather than a flat pill */
        .switch { display: inline-flex; align-items: center; gap: 0; background: var(--well); border: 1px solid var(--accent-dim);
          box-shadow: 0 0 0 1px var(--accent-dim), 0 6px 20px var(--accent-glow);
          border-radius: var(--r-pill); padding: 4px 18px 4px 4px; cursor: pointer; min-height: 46px;
          box-shadow: var(--shadow-inset); transition: border-color 0.18s ease; }
        .switch-lever { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; margin-right: 12px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 82%, white), var(--accent));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 5px rgba(0,0,0,0.5);
          transition: transform 0.16s cubic-bezier(0.22,1,0.36,1); }
        .switch-label { font-family: var(--font-display); font-weight: 600; font-size: 14px; color: var(--text);
          letter-spacing: 0.02em; }
        .switch:hover { border-color: var(--accent); }
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
