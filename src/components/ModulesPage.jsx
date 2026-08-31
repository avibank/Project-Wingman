import { MODULES, chaptersForModule } from "../data.js";
import { useUserProgress } from "../lib/userProgress.jsx";
import { moduleSegments, chapterCount, progressCaption } from "../lib/progressModel.js";
import SegmentedBar from "./SegmentedBar.jsx";

// §2.3 — Modules is the library: everything, at a glance, with the same
// segmented bar Home uses for the active one (§9.1.1). Nothing here is a card;
// §9.1.3 removed the horizontal card rail deliberately.

function ModulesPage({ activeModuleCode, onOpenModule, onGoToChapter, onMakeActive }) {
  const progress = useUserProgress();
  const state = {
    completed: new Set(progress.get("pw-completed", [])),
    viewed: new Set(progress.get("pw-viewed-chapters", [])),
    answered: progress.get("pw-chapter-progress", {}),
  };

  return (
    <div className="mods">
      <h1 className="mods-title">Modules</h1>
      <ul className="mods-list">
        {MODULES.map((m) => {
          const chapters = chaptersForModule(m.code);
          const segments = moduleSegments(chapters, state);
          const { full, total } = chapterCount(segments);
          const isActive = m.code === activeModuleCode;
          return (
            <li key={m.code} className={`mods-row ${isActive ? "is-active" : ""}`}>
              <button className="mods-open" onClick={() => onOpenModule(m.code)}>
                <span className="mods-code">{m.code}</span>
                <span className="mods-name">{m.name}</span>
                {/* The terse figure. It used to repeat the caption below it
                    word for word AND get the noun wrong — a segment is a
                    chapter, so this counted chapters and called them lessons
                    while the caption underneath counted the same segments and
                    called them chapters. One fact, two sentences, disagreeing.
                    "0 of 5" is not an option either: nothing states a zero. */}
                <span className="mods-count">
                  {full > 0 ? `${full} of ${total}` : `${total} chapters`}
                </span>
              </button>
              <SegmentedBar
                segments={segments}
                currentId={isActive ? segments.find((s) => s.fill !== "full")?.id : null}
                onPick={(s) => onGoToChapter(m.code, s.id)}
              />
              <p className="mods-caption">
                {progressCaption(segments)}
                {!isActive && (
                  <button className="mods-make" onClick={() => onMakeActive(m.code)}>Make active</button>
                )}
                {isActive && <span className="mods-on">Active</span>}
              </p>
            </li>
          );
        })}
      </ul>

      <style>{`
        .mods { display: flex; flex-direction: column; gap: 20px; padding: 8px 0 40px; max-width: 640px; }
        .mods-title { font-size: 20px; font-weight: 500; color: var(--text-primary); margin: 0; }
        .mods-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 20px; }
        .mods-row { display: flex; flex-direction: column; gap: 6px; }
        .mods-row.is-active { box-shadow: inset 3px 0 0 var(--accent-interactive);
          padding-left: 12px; margin-left: -12px; border-radius: 2px; }
        .mods-open { display: flex; align-items: baseline; gap: 12px; width: 100%; min-height: 44px;
          background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
        .mods-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); width: 46px; flex-shrink: 0; }
        .mods-name { flex: 1; min-width: 0; font-size: 16px; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mods-count { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
          font-variant-numeric: tabular-nums; }
        .mods-caption { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          font-size: 14px; color: var(--text-secondary); margin: 0; }
        .mods-make { min-height: 44px; padding: 0 10px; border: none; border-radius: var(--r-control);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
        .mods-make:hover { color: var(--text-primary); background: var(--bg-raised); }
        .mods-on { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}

export default ModulesPage;
