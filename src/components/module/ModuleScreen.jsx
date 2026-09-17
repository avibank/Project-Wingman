import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
import { faultChapters } from "../../lib/minimums.js";
import { placeholderFor, terms } from "../../lib/moduleSearch.js";
import "./instruments.css";
import { currentLesson } from "./lessonState.js";
import { useTabPill } from "../../lib/tabMotion.js";
import "./module.css";
import "./manual.css";

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
  papers = [], librarySub = "papers", onOpenPaper,
  readerPin = null, onAddPaper,
  code = null,
  // §8's second number. It comes from App with the rest of the account state
  // rather than being read here, so one render of the app cannot hold two
  // values for the bar — the deck's lamp and this screen's lamp are the same
  // fact and must be computed from the same number.
  minimums,

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

  // §8 — EVERYTHING DERIVES FROM TWO NUMBERS: the quiz scores, and the user's
  // bar. Computed once here and handed down, so the lamp on a chapter and the
  // row actions cannot form separate opinions about the same fact.
  const faults = faultChapters(chapters, state?.quiz || {}, minimums);

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

  // §12/a11y — ARROW KEYS ON THE TABLIST. The tabs already use roving
  // tabIndex, which takes the unselected one OUT of the tab order — correct
  // for a tablist, but only half of the pattern: without arrow-key movement
  // the second tab becomes unreachable by keyboard entirely, and MODULE_TABS
  // is the only keyboard route into the Library. Mirrors walkTabs in
  // Profile.jsx so the two tablists behave identically.
  const tabsRef = useRef(null);
  useTabPill(tabsRef, tab);
  const walkTabs = (e) => {
    const btns = [...(tabsRef.current?.querySelectorAll('[role="tab"]') || [])];
    const i = btns.indexOf(document.activeElement);
    if (i < 0 || !btns.length) return;
    const move = (n) => { e.preventDefault(); btns[n]?.focus(); onTab(MODULE_TABS[n].id); };
    if (e.key === "ArrowRight") move((i + 1) % btns.length);
    if (e.key === "ArrowLeft") move((i - 1 + btns.length) % btns.length);
    if (e.key === "Home") move(0);
    if (e.key === "End") move(btns.length - 1);
  };


  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the parent, labelled with the destination. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {upFrom({ kind: "module" })?.label}
        </button>
      </div>

      {/* §1 — THE MODULE TITLE, AND NOTHING ELSE, IN EVERY FINISH.
          The instrument row and the flight profile both used to live here. The
          profile is a fleet view and belongs on the Flight Deck's module cards,
          where it already is; the three indicators became one signal (the lamp,
          on whichever chapter owns the problem) and one dial (in the Library).
          Nothing floats above the list any more, and nothing up here repeats a
          fact the row beneath it already states.

          Manual briefly carried a cover sheet here — the drawn indicators and
          the route with its paper dart. That was reverted: the paper world is
          the STENCILLED DRAWING, which it keeps (the hatched lamp, the ruled
          statuses, the folder), not a second layout. Manual's sketch rules for
          the gauge and the tag stay in manual.css and cost nothing while
          nothing renders them, the same as before. */}
      <div className="mhero">
        <h1 className="mhero-title">{mod.name}</h1>
      </div>

      {/* §2.6 — one card: the tabs are a strip along its top edge, joined to
          the surface below, and the list lives inside the same border. */}
      <div className="mcard">
      <div className="tabsbar">
        <div className="tabs" role="tablist" aria-label={`${mod.name} sections`}
             ref={tabsRef} onKeyDown={walkTabs}>
          {MODULE_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab"
                    aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => onTab(t.id)}>
              {/* The selected tab's background, as its own element, so it can
                  travel to the next tab rather than blink out of one and into
                  another — see useTabPill in tabMotion.js. It is what the
                  selected tab always looked like; only who draws it moved. */}
              <span className="tab-pill" aria-hidden="true" />
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
                    open={open} onToggle={toggle} query={query} code={code}
                    onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} />
        )}
        {tab === "library" && (
          <LibraryTab chapters={chapters} papers={papers} state={state}
                      sub={librarySub} query={query}
                      readerPin={readerPin} onAddPaper={onAddPaper}
                      faults={faults}
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
