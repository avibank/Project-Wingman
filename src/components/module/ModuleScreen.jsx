import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
import { Accuracy, Calibration, MasterCaution, FlightProfile } from "./Instruments.jsx";
import { cautionCount, dueCount } from "../../lib/retention.js";
import { passAt } from "../../lib/quiz.js";
import { placeholderFor, terms } from "../../lib/moduleSearch.js";
import "./instruments.css";
import { currentLesson } from "./lessonState.js";
import "./module.css";

// The three tabs live in the URL, so a student sharing a link to People lands
// on People. The tab is not component state.
// §2.6 — Lessons and Library. People is hidden rather than deleted: it is
// coming back in a different position, and the strip is built so a third entry
// needs no relayout. Its component and data wiring are untouched.
export const MODULE_TABS = [
  { id: "route", label: "Lessons" },
  { id: "library", label: "Library" },
];
export const HIDDEN_TABS = [{ id: "people", label: "People" }];

export default function ModuleScreen({
  module: mod, chapters, state, tab, onTab, onBack, onOpenLesson, onOpenQuiz,
  papers = [], librarySub = "papers", onLibrarySub, onOpenPaper,
  retention, onInstrument,
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
  const outOf = taken.length ? taken[0].total : null;

  // The ammeter reads MEAN FIRST-ATTEMPT score as a percentage, against the
  // pass mark — and it reads from the same data as the rows, because a hero
  // that is hardcoded is a hero that eventually contradicts the list under it.
  const avgPct = taken.length
    ? Math.round(taken.reduce((n, q) => n + (q.correct / q.total) * 100, 0) / taken.length)
    : null;
  const passMark = Math.round((passAt(outOf || 8) / (outOf || 8)) * 100);

  const hereIndex = Math.max(0, chapters.findIndex((c) => c.id === here?.chapter?.id));
  const started = Boolean(here?.chapter?.id) || taken.length > 0;

  // §2.3 — one field, beside the tabs. It belongs to the screen rather than to
  // either tab: the Library used to carry its own, which meant the same words
  // had to be typed twice to search two halves of one module.
  //
  // Cleared when the tab changes. Carrying a query across tabs shows somebody a
  // filtered list they did not ask to filter, and the commonest way to meet an
  // empty tab is to arrive at one still holding a search.
  const [query, setQuery] = useState("");
  useEffect(() => { setQuery(""); }, [tab]);
  const searchable = tab === "route" || tab === "library";
  const searching = terms(query).length > 0;
  const fieldRef = useRef(null);

  const caution = cautionCount(retention);
  const due = dueCount(retention);

  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the parent, labelled with the destination. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {upFrom({ kind: "module" })?.label}
        </button>
      </div>

      {/* Horizontal in emphasis. The left block names the module; the right is
          the route, vertically centred against it. */}
      <div className="mhero">
        <div>
          <h1 className="mhero-title">{mod.name}</h1>
          {/* §2.2 — the indicator row sits directly under the module title,
              inside the banner's left block, so title and instruments read as
              one identity rather than as a heading and a toolbar. */}
          <div className="instrow">
            <Accuracy mean={avgPct} passMark={passMark}
                      onPress={() => onInstrument?.("accuracy")} />
            <Calibration count={due} hasData={taken.length > 0}
                         onPress={() => onInstrument?.("recheck")} />
            <MasterCaution count={caution} onPress={() => onInstrument?.("caution")} />
          </div>
        </div>
        <FlightProfile chapters={chapters} atIndex={hereIndex} started={started} />
      </div>



      {/* §2.6 — one card: the tabs are a strip along its top edge, joined to
          the surface below, and the list lives inside the same border. */}
      <div className="card">
      <div className="tabsbar">
        <div className="tabs" role="tablist" aria-label={`${mod.name} sections`}>
          {MODULE_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab"
                    aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* People has no search: it is a handful of rows about other people,
            and a field that filters nothing is worse than no field. */}
        {searchable && (
          <div className="tabsearch">
            <Search className="tabsearch-i" aria-hidden="true" />
            <input ref={fieldRef} type="search" className="tabsearch-f" value={query}
                   placeholder={placeholderFor(tab, librarySub)}
                   aria-label={placeholderFor(tab, librarySub)}
                   onChange={(e) => setQuery(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }} />
            {searching && (
              <button type="button" className="tabsearch-x" aria-label="Clear the search"
                      onClick={() => { setQuery(""); fieldRef.current?.focus(); }}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* A 560px floor, so switching tabs never makes the page jump.
          Housing goes on the section, never on the rows inside it: hairlines
          separate rows, housing separates sections, and if every row is a card
          then nothing is. */}
      <div className="pane" role="tabpanel">
        {tab === "route" && (
          <RouteTab module={mod} chapters={chapters} state={state} here={here}
                    open={open} onToggle={toggle} query={query}
                    onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} />
        )}
        {tab === "library" && (
          <LibraryTab chapters={chapters} papers={papers} state={state}
                      sub={librarySub} onSub={onLibrarySub} query={query}
                      // §2.8 — the same number the Calibration sticker shows.
                      // One source, passed down, so the two can never disagree.
                      outstanding={due}
                      onOpenQuiz={onOpenQuiz} onOpenPaper={onOpenPaper} />
        )}
        {tab === "people" && (
          <PeopleTab module={mod} people={people.people} onOpenAt={onOpenQuestion}
                     loading={!people.people?.length} />
        )}
      </div>
      </div>
    </div>
  );
}
