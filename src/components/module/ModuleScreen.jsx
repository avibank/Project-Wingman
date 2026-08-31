import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import RouteTab from "./RouteTab.jsx";
import LibraryTab from "./LibraryTab.jsx";
import PeopleTab from "./PeopleTab.jsx";
import { upFrom } from "../../lib/lessonSurface.js";
import { holdingCount } from "../../lib/retention.js";
import { takenScores, averagePct, lastPct, faultChapters } from "../../lib/minimums.js";
import { placeholderFor, terms } from "../../lib/moduleSearch.js";
import "./instruments.css";
import { IndicatorRow, FlightProfile } from "./Instruments.jsx";
import { currentLesson } from "./lessonState.js";
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
  // §8's second number. It comes from App with the rest of the account state
  // rather than being read here, so one render of the app cannot hold two
  // values for the bar — the deck's lamp and this screen's lamp are the same
  // fact and must be computed from the same number.
  minimums, onMinimums,
  // "6 days ago" on the Calibration row. It is its OWN progress key
  // (pw-last-recheck), written by the re-check flow when it finishes — NOT a
  // field on `retention`, which is what it looks like it should be. Reading it
  // off retention returns undefined forever and the row silently loses its date.
  lastRecheck = null,
  // Manual draws its own cover sheet — the indicator row and the route with
  // the paper dart. Passed rather than sniffed off the DOM, the same way Home
  // decides between the instrument strip and PaperStrip.
  finish = null,
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

  // §8 — EVERYTHING DERIVES FROM TWO NUMBERS: the quiz scores, and the user's
  // minimums. Computed once here and handed down, so the lamp on a chapter,
  // the needle in the Library and the row actions cannot form separate
  // opinions about the same fact.
  const taken = takenScores(chapters, state?.quiz || {});
  const avgPct = averagePct(taken);          // the needle
  const lastQuizPct = lastPct(taken);        // the hollow marker
  const faults = faultChapters(chapters, state?.quiz || {}, minimums);

  // Manual's cover sheet. `paper` gates the whole branch, so nothing below is
  // computed for a finish that will not draw it — and Standard and Aurora keep
  // the bare <h1> they had.
  const paper = finish === "manual";
  const atIndex = here?.chapter?.id
    ? Math.max(0, chapters.findIndex((c) => c.id === here.chapter.id))
    : 0;
  // "Started" is the dart's own question — is there an aircraft on this route
  // at all. A quiz taken counts as much as a lesson opened; either means you
  // have left the threshold.
  const started = taken.length > 0 || Boolean(here);

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

  // Calibration is the RIGHT answers kept in currency: `holding`. `due` is how
  // many of those have come round. Neither is caution, and §5 forbids the two
  // vocabularies ever meeting.
  // §5 — Calibration counts the RIGHT answers kept in currency (`holding`).
  // `dueCount` used to feed a separate "N to re-check" heading, which the
  // rebuilt Library dropped: the row says what it holds and offers Start, and
  // a second number for the same pile was the kind of restatement §7 cuts.
  const warm = holdingCount(retention);

  return (
    <div className="mscreen">
      <div className="hdr">
        {/* Up, to the parent, labelled with the destination. */}
        <button type="button" className="up" onClick={onBack}>
          <ChevronLeft aria-hidden="true" /> {upFrom({ kind: "module" })?.label}
        </button>
      </div>

      {/* §1 — THE MODULE TITLE, AND NOTHING ELSE. EXCEPT ON PAPER.
          The instrument row and the flight profile used to live here in every
          finish. For Standard and Aurora that removal stands: the profile is a
          fleet view and belongs on the Flight Deck's module cards where it
          already is, and the three indicators became one signal (the lamp, on
          whichever chapter owns the problem) and one dial (in the Library).

          Manual is the exception, and deliberately the only one. It is a paper
          file, and a paper file opens on a cover sheet with the readings
          written across it. Drawn, not lit — a printed schematic rather than a
          second dashboard arguing with the list below.

          The non-paper branch renders the bare <h1> it rendered before, with
          no wrapper, so those two finishes are untouched down to the box tree.
          Every value is handed down from the two numbers derived above; this
          row never recomputes them. */}
      <div className="mhero">
        {paper ? (
          <>
            <div className="mhero-main">
              <h1 className="mhero-title">{mod.name}</h1>
              <IndicatorRow avgPct={avgPct} calibrated={!!lastRecheck}
                            caution={faults.size > 0} />
            </div>
            <FlightProfile chapters={chapters} atIndex={atIndex} started={started} />
          </>
        ) : (
          <h1 className="mhero-title">{mod.name}</h1>
        )}
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
                    // §2 — the lamp, on the chapter whose quiz is below the
                    // bar. Derived above and handed down so the Lessons tab,
                    // the Library and the Flight Deck all light from one Set.
                    faults={faults}
                    onOpenLesson={onOpenLesson} onOpenQuiz={onOpenQuiz} />
        )}
        {tab === "library" && (
          <LibraryTab chapters={chapters} papers={papers} state={state}
                      sub={librarySub} query={query}
                      // §5 — Calibration is the right answers kept warm, and
                      // it is NOT the caution pile. `warm` is everything in
                      // holding; `due` is how much of it has come round.
                      warm={warm}
                      lastRecheck={lastRecheck}
                      // §3 — the dial, on the Quizzes header. Two sizes, two
                      // places; this is the small one.
                      average={avgPct} lastQuiz={lastQuizPct}
                      minimums={minimums} onMinimums={onMinimums}
                      faults={faults}
                      onStartCalibration={() => onInstrument?.("recheck")}
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
