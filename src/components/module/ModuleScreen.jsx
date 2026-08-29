import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
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
  // EXACTLY ONE CHAPTER OPEN — the one you are in. What made the old screen
  // feel busy was not the fold: it was that every chapter was collapsed and
  // they all looked the same weight, a wall of equal things with no focal
  // point. One open at full scale and the rest as quiet rows keeps the page
  // short at any number of chapters, which is what lets a module grow.
  const [open, setOpen] = useState(() => new Set(here ? [here.chapter.id] : chapters[0] ? [chapters[0].id] : []));
  useEffect(() => {
    if (here?.chapter?.id) setOpen(new Set([here.chapter.id]));
  }, [here?.chapter?.id]);

  // Opening one closes the other. Tapping the open one folds it, so the screen
  // can still be all rows if that is what somebody wants.
  const toggle = (id) =>
    setOpen((s) => (s.has(id) ? new Set() : new Set([id])));

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
        {/* Up, to the parent, labelled with the destination. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {upFrom({ kind: "module" })?.label}
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

      {/* A 560px floor, so switching tabs never makes the page jump.
          Housing goes on the section, never on the rows inside it: hairlines
          separate rows, housing separates sections, and if every row is a card
          then nothing is. */}
      <div className="pane house" role="tabpanel">
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
          <PeopleTab module={mod} people={people.people} onOpenAt={onOpenQuestion}
                     loading={!people.people?.length} />
        )}
      </div>
    </div>
  );
}
