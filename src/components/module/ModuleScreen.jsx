import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { currentLesson } from "./lessonState.js";
import "./module.css";

// The three tabs live in the URL, so a student sharing a link to People lands
// on People. The tab is not component state.
export const MODULE_TABS = [
  { id: "route", label: "Lessons" },
  { id: "library", label: "Library" },
  { id: "people", label: "People" },
];

export default function ModuleScreen({
  module: mod, chapters, state, tab, onTab, onBack, onOpenLesson, onOpenQuiz,
  papers = [], librarySub = "papers", onLibrarySub, onOpenPaper,
  people = { wingman: null, groups: [], questions: [], moduleRow: { line: "", facts: [] } },
  onOpenQuestion,
}) {
  const here = currentLesson(chapters, state);

  // The chapter you are in opens by itself on arrival; after that it is yours
  // to open and close, any number at once.
  const [open, setOpen] = useState(() => new Set(here ? [here.chapter.id] : []));
  useEffect(() => {
    if (here?.chapter?.id) setOpen((s) => (s.has(here.chapter.id) ? s : new Set([...s, here.chapter.id])));
  }, [here?.chapter?.id]);

  const toggle = (id) =>
    setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // The only figure on the screen. Deliberately absent until there is one —
  // nothing pretends on a first visit.
  const taken = chapters.map((c) => state?.quiz?.[c.id]).filter(Boolean);
  const avg = taken.length
    ? Math.round(taken.reduce((n, q) => n + q.correct, 0) / taken.length)
    : null;
  const outOf = taken.length ? taken[0].total : null;

  return (
    <div className="mscreen">
      <div className="hdr">
        <button type="button" className="back" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> Flight Deck
        </button>
        <div className="titlerow">
          <h1 className="title">{mod.name}</h1>
          {avg != null && (
            <p className="avg">Quiz average<b>{avg} of {outOf}</b></p>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label={`${mod.name} sections`}>
        {MODULE_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab"
                  aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* A 560px floor, so switching tabs never makes the page jump. */}
      <div className="pane" role="tabpanel">
        {tab === "route" && (
          <RouteTab module={mod} chapters={chapters} state={state} here={here}
                    open={open} onToggle={toggle}
                    onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} />
        )}
        {tab === "library" && (
          <LibraryTab chapters={chapters} papers={papers} state={state}
                      sub={librarySub} onSub={onLibrarySub}
                      onOpenQuiz={onOpenQuiz} onOpenPaper={onOpenPaper} />
        )}
        {tab === "people" && (
          <PeopleTab module={mod} people={people.people} onOpenAt={onOpenQuestion} />
        )}
      </div>
    </div>
  );
}
