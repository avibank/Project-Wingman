import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import CrewTab from "./CrewTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
import { faultChapters } from "../../lib/minimums.js";
import { useCrew, crewCount } from "../../lib/crew.js";
import { moduleSubtitle } from "../../lib/moduleLine.js";
import { placeholderFor, terms } from "../../lib/moduleSearch.js";
import { papersOn, flagDefault } from "../../lib/flags.js";

/* The field offers to search what the Library is actually showing. */
const shelfOn = papersOn || flagDefault("paper.viewer", false);
import "./instruments.css";
import { currentLesson } from "./lessonState.js";
import { useTabPill } from "../../lib/tabMotion.js";
import "./module.css";
import "./ref-module.css";
import "./manual.css";

// The three tabs live in the URL, so a student sharing a link to People lands
// on People. The tab is not component state.
// §2.6 — Lessons and Library. People is hidden rather than deleted: it is
// coming back in a different position, and the strip is built so a third entry
// needs no relayout. Its component and data wiring are untouched.
/* CREW IS THE THIRD TAB, after Lessons and Library, which is the order §2 of
   the launch handoff gives. It is a new screen rather than a renamed one:
   `people` was the question FEED — a thread list — and it keeps its own hidden
   route, because the Ready Room is where questions live now. */
export const MODULE_TABS = [
  { id: "route", label: "Lessons" },
  { id: "library", label: "Library" },
  { id: "crew", label: "Crew" },
];
export const HIDDEN_TABS = [{ id: "people", label: "People" }];

export default function ModuleScreen({
  module: mod, chapters, state, tab, onTab, onBack, onOpenLesson, onOpenQuiz,
  onFindSquadron, onInviteClass,
  papers = [], librarySub = "papers", onOpenPaper,
  readerPin = null, onAddPaper,
  stamp = null, tilts = null,
  me = null, mates = new Set(), myDone = new Set(), onOpenPerson, onOpenThreads,
  // §8's second number. It comes from App with the rest of the account state
  // rather than being read here, so one render of the app cannot hold two
  // values for the bar — the deck's lamp and this screen's lamp are the same
  // fact and must be computed from the same number.
  minimums,

  people = { wingman: null, groups: [], questions: [], moduleRow: { line: "", facts: [] } },
  onOpenQuestion,
  /* True only while a content document is actually being fetched. False means
     this module really has nothing in it, which is a state with its own
     screen rather than a skeleton that never resolves. */
  contentPending = false,
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
  /* THE CREW READ LIVES HERE, not in the panel: "Crew 15" is on the TAB, so
     the number has to exist one level above the thing that draws the people.
     One fetch, both sides. */
  const crew = useCrew(mod?.code || mod?.id, me, chapters.map((c) => c.id));
  const crewTotal = crewCount(crew);

  const [query, setQuery] = useState("");
  useEffect(() => { setQuery(""); }, [tab]);
  const searchable = tab === "route" || tab === "library" || tab === "crew";
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
      {/* THE TITLE AND THE LINE UNDER IT, which the live screen did not have
          at all (bug 14). The reference's `.sub` reads "6 lessons and 3
          quizzes" — what is in the module, said once, in the two units a
          student counts in. It is derived rather than stored: every chapter
          carries one quiz. */}
      <div className="ref-mod">
        <div className="mod">
        <h1>{mod.name}</h1>
        {/* Papers count too: they hang off the module as well as off a
            chapter, so a module can have something to open before it has a
            chapter. */}
        {/* A DOOR, NOT ONLY A LINE. It counts what is in the Library, so it opens
            the Library; worded the same and drawn the same, so the reference
            diff is untouched. Only a module waiting on everything stays text. */}
        <p className="sub">
          {chapters.length || papers.length
            ? <button type="button" className="sub-go is-inline" onClick={() => onTab("library")}>{moduleSubtitle(chapters, papers)}</button>
            : moduleSubtitle(chapters, papers)}
        </p>

      {/* §2.6 — one card: the tabs are a strip along its top edge, joined to
          the surface below, and the list lives inside the same border. */}
      {/* tools/ref-diff.mjs photographs this element and the same one on
          the reference page. The attribute is the contract between them. */}
      <div className="card" data-ref="module-panel">
      {/* THE STRIP IS THE REFERENCE'S `.mtabs`: three tabs and then the field,
          all in one flex row on the card's top edge. The field was a 120px box
          with its own placeholder clipped — "Search lessons and chapt" — because
          it sat in a wrapper the tabs could squeeze (bug 13). It is `flex:1 1
          auto` now and takes whatever the tabs leave. */}
      <div className="mtabs" role="tablist" aria-label={`${mod.name} sections`}
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
            {/* THE COUNT, ON THE TAB (bug 14). Nothing until the answer is
                in — a badge that flickers 1 and then 15 is worse than one
                that arrives once — and the count itself after that, one being
                a real answer: on a module you are the only one on, "Crew 1"
                is the true number and the tab says so. It read `> 1` for a
                day and the badge was missing on the live site for exactly
                that reason. */}
            {t.id === "crew" && crewTotal != null && <small>{crewTotal}</small>}
          </button>
        ))}

        {/* People has no search: it is a handful of rows about other people,
            and a field that filters nothing is worse than no field. Crew DOES:
            it can be forty faces and a wall of stamps, and the reference gives
            it the same field with "Find someone" in it. */}
        {searchable && (
          <label className="search">
            <Search size={15} aria-hidden="true" />
            {/* `is-inline`: §12's 44px floor is on the INPUT, and the thing
                a finger aims at here is the pill around it — 780px wide and
                39.7 tall, which is the design's and clears WCAG 2.2 AA's 24px
                target either way. With the floor on, the field alone made the
                strip 77px against the design's 56.7. */}
            <input ref={fieldRef} type="search" className="is-inline" value={query}
                   placeholder={placeholderFor(tab, shelfOn)}
                   aria-label={placeholderFor(tab, shelfOn)}
                   onChange={(e) => setQuery(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }} />
            {searching && (
              <button type="button" className="tabsearch-x is-inline" aria-label="Clear the search"
                      onClick={() => { setQuery(""); fieldRef.current?.focus(); }}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
        )}
      </div>

      {/* A 560px floor, so switching tabs never makes the page jump.
          Housing goes on the section, never on the rows inside it: hairlines
          separate rows, housing separates sections, and if every row is a card
          then nothing is. */}
      <div className="pane" role="tabpanel">
        {tab === "route" && (
          <RouteTab chapters={chapters} state={state} here={here}
                    open={open} onToggle={toggle} query={query} stamp={stamp} tilts={tilts}
                    /* Waiting and empty, told apart one level up: App knows
                       whether a content document is still in flight, and this
                       screen is the only thing that can name the module. */
                    pending={contentPending} moduleName={mod?.name}
                    /* One tab across, where the work actually is while the
                       video is being made. */
                    onLibrary={() => onTab("library")}
                    onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} />
        )}
        {tab === "library" && (
          <LibraryTab chapters={chapters} papers={papers} state={state}
                      sub={librarySub} query={query} moduleCode={mod?.code || mod?.id || null}
                      readerPin={readerPin} onAddPaper={onAddPaper}
                      faults={faults}
                      onOpenQuiz={onOpenQuiz} onOpenPaper={onOpenPaper} />
        )}
        {tab === "crew" && (
          <CrewTab crew={crew} moduleName={mod?.name}
                   chapters={chapters} me={me} myStamp={stamp} mates={mates}
                   query={query} myDone={myDone}
                   onOpenPerson={onOpenPerson} onOpenThreads={onOpenThreads}
                   /* The empty state's two ways out. Both open the Ready Room
                      at the place that does the thing — Discover finds a
                      squadron, and the module's own feed is where you would
                      tell your class where you are. Neither is a new screen. */
                   onFindSquadron={onFindSquadron} onInviteClass={onInviteClass} />
        )}
        {tab === "people" && (
          <PeopleTab module={mod} people={people.people} onOpenAt={onOpenQuestion}
                     loading={!people.people?.length} />
        )}
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}
