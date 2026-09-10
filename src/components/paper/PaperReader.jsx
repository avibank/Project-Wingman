import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadPaper, releasePaper, paperText, quoteOf, pageOf, warmWorker, PDFJS_VERSION } from "../../lib/paperText.js";
import { setRasterFocus } from "../../lib/rasterBudget.js";
import {
  resolveAll, segmentsFor, anchorFor, mergeRows, sentenceAround,
  applyFilter, FILTERS, filterCounts, RINGS,
} from "../../lib/paperMarks.js";
import { meaning, threadState, meaningOr, DEFAULT_MEANING } from "../../lib/meanings.js";
import {
  DEF, CAP, LOCKED, capFor, loadTray, saveTray,
  addTool, removeTool, moveTool, shortcutFor,
} from "../../lib/paperTray.js";
/* The shipped table and the shipped icon function, both copied verbatim out of
   the reference build, plus the join between its five colour keys and the five
   meanings the database has stored since 0017. */
import {
  TOOLS, COL, GROUPS, tool as T, col, colourKey, MEANING_OF, INK_OF,
  TOOL_COLOUR, TOOL_SIZE, TOOL_ALPHA,
  kindOf, marksText, isInk, isTaker, hasColour, fixedColour, variants,
} from "../../lib/readerIcons.js";
import { readPlatform, watchPlatform } from "../../lib/readerPlatform.js";
import { penWidth } from "../../lib/paperInk.js";
import {
  LAYOUTS, PAPER_LIGHTS, FITS, ZOOM_STEPS, stepZoom, clampZoom, fitScale,
  spreads, spreadOf, pagesToDraw, findAll,
} from "../../lib/paperView.js";
import {
  fetchAnnotations, createAnnotation, deleteAnnotation, updateAnnotation,
  markOrphaned, askOnPassage, fetchCorrections, resolveCorrection, agreeWithMark,
} from "../../lib/annotations.js";
import { fetchInk, createStroke, deleteStrokes } from "../../lib/ink.js";
import { fileHref, storedText, thumbUrl } from "../../lib/papers.js";
import Icon from "./Icon.jsx";
import { Card, SelPop, Props, Chest, Coach } from "./parts.jsx";
import PaperPage from "./PaperPage.jsx";
import PaperThumbs from "./PaperThumbs.jsx";
import PaperOutline from "./PaperOutline.jsx";
import "./reader.css";
import "./reader-additions.css";

/* =============================================================================
   THE PAPER READER

   The markup below is COMPONENTS.md, transliterated and not reinterpreted:
   the same class names, the same nesting, the same state as data attributes on
   one root. reader.css is the shipped stylesheet, generated into src/ with
   every selector scoped under `.rdr` and no value touched — see
   scripts/scope-reader-css.mjs for the one reason that was necessary.

   What this file owns is state, data and events. What it does not own is the
   look: if something here looks wrong, the DOM diverged from COMPONENTS.md,
   and that is the thing to fix rather than a value in the stylesheet.
   ========================================================================= */

/* Called by App the moment a paper route is entered, before this component
   renders, so pdf.js's worker is already in the cache when it is needed. */
export const warm = () => warmWorker();

const PAGE_GAP = 26;
const EMPTY = [];
/* reader.css: `.page { width: min(870px, 100%) }`. Named here because the
   scale is what enforces it. */
const PAGE_MAX = 870;

const tempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private */ } };
/* A per-tool map, merged over the shipped defaults so a tool added in a later
   build arrives with its own starting values rather than undefined. */
const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch { return { ...fallback }; }
};
const rgba = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const SHORTCUTS = [
  ["⌘F / Ctrl F", "Find in this paper"],
  ["⌘+ / ⌘−", "Zoom in and out"],
  ["⌘0", "Fit the width"],
  ["⌘Z / ⇧⌘Z", "Undo and redo"],
  ["← →", "Previous and next page"],
  ["Home / End", "First and last page"],
  ["1 – 5", "Recolour the selected mark"],
  ["V H U S", "Pointer, highlight, underline, strike"],
  ["P M E", "Pen, marker, eraser"],
  ["N Q C", "Note, question, correction"],
  ["Esc", "Put away whatever is open"],
];
export default function PaperReader({
  paper, moduleCode, me, isStaff = false, onBack, onOpenThread, onOpenOriginal, onPlace,
}) {
  const url = paper ? fileHref(paper.file) : null;

  const [doc, setDoc] = useState(null);
  const [model, setModel] = useState(null);
  const [sizes, setSizes] = useState([]);          // page sizes at scale 1
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState("width");
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  /* THE PANEL IS OPEN ON A DESKTOP AND SHUT ON A PHONE, and that is not a
     preference — it is the same decision either way. On a laptop the panel
     costs 248px of 1280 and earns it; on a phone it is an overlay, so opening
     it by default would mean the first thing a reader sees when they tap a
     paper is a list of thumbnails with the paper behind it. The toggle is the
     first control in the bar in both cases. */
  const [rail, setRail] = useState(
    () => (typeof window !== "undefined" && window.innerWidth <= 768 ? null : "thumbs"),
  );                                               // thumbs | outline | marks | queue | null
  const [want, setWant] = useState(() => read("pw-paper-layout", "scroll"));
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 900,
  );
  /* TWO PAGES SIDE BY SIDE NEEDS ROOM FOR TWO PAGES.

     The layout is remembered per device, so a reader who chose the spread on a
     laptop arrives on their phone still holding it — and a spread in 375px is
     two pages at 29%, which is a picture of a document rather than a document.
     So the preference is kept and the layout is not: what is stored is what
     they asked for, what is drawn is what fits. Widen the window and the
     spread comes back on its own. */
  const layout = narrow && want === "spread" ? "single" : want;
  const setLayout = setWant;
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 900);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  /* "follow" is the default and it means what it says: whatever the app is.
     A reader with its own remembered theme is a screen that disagrees with the
     one it opened from. */
  const [light, setLight] = useState(() => read("pw-paper-light", "follow"));
  const [appVariant, setAppVariant] = useState("night");
  useEffect(() => {
    const root = document.querySelector(".app");
    if (!root) return undefined;
    const read2 = () => setAppVariant(root.dataset.variant === "day" ? "day" : "night");
    read2();
    const mo = new MutationObserver(read2);
    mo.observe(root, { attributes: true, attributeFilter: ["data-variant"] });
    return () => mo.disconnect();
  }, []);

  /* §8.3 — the accent comes from the livery. Everything else in the shipped
     palette is fixed, the five mark colours especially: they carry meaning and
     must not shift between liveries. */
  const [accent, setAccent] = useState(null);
  useEffect(() => {
    const root = document.querySelector(".app");
    if (!root) return;
    const cs = getComputedStyle(root);
    const a = cs.getPropertyValue("--active").trim();
    if (a) setAccent(a);
  }, [appVariant]);
  const [full, setFull] = useState(false);

  const [rows, setRows] = useState([]);
  /* Read by the refresh so it can say how many arrived, without making the
     handler depend on the list and rebuild on every mark. */
  const rowsRef = useRef([]);
  rowsRef.current = rows;
  const [strokes, setStrokes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [density, setDensity] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [picked, setPicked] = useState(null);   // { mark, at } — the mark card
  /* §11.1 — where you were before you jumped. A jump from the Marks panel, the
     tick rail or a search result is the most-missed control in a long manual:
     you go and look at a figure and then cannot find your way back. */
  const [cameFrom, setCameFrom] = useState(null);
  /* THE DRAG LIVES IN A REF AND ONLY ITS RESULT LIVES IN STATE.

     Held in state alone, the move handler reads whatever the last render
     captured — and pointerdown and the first pointermove can land in the same
     tick, so the drag had not started yet as far as the handler could tell and
     nothing happened. The ref is written synchronously; the state is only what
     the card draws. */
  const drag = useRef(null);
  const [scrub, setScrub] = useState(null);     // { page } while dragging
  const [railAt, setRailAt] = useState(null);   // hovering the tick rail

  /* THE PAPER IS THE SUBJECT, SO THE FURNITURE GETS OUT OF THE WAY.

     Rule 5 of the brief — chrome recedes while the nib is down and returns
     when it lifts — is the same instinct one step further: it recedes while
     you are READING too. Sit still for a couple of seconds and the bars fade
     back; move the pointer, touch the screen or press a key and they are
     there again, immediately.

     They fade rather than vanish. A control that disappears completely is a
     control you have to remember exists; one at a tenth of its opacity is
     still visibly there and still exactly where you left it.

     `hush` is the deliberate version of the same thing — a toggle for somebody
     who wants nothing but the page. The way back is any pointer movement, so
     it can never trap you. */
  const [quiet, setQuiet] = useState(false);
  const [hush, setHush] = useState(() => read("pw-paper-hush", "0") === "1");
  /* The rail's snapping reads the ticks from a ref rather than closing over
     them, so the handler does not need rebuilding every time a mark is made. */
  const ticksRef = useRef([]);

  const [tool, setTool] = useState("sel");
  /* THE TRAY. Loaded per device class, so a laptop and a tablet keep their own.
     See lib/paperTray.js for why they must not be one list. */
  const [tray, setTray] = useState(() => loadTray(
    typeof window === "undefined" ? 1440 : window.innerWidth, TOOLS,
  ));
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  /* LONG-PRESS THE DOCK TO REARRANGE IT. `-webkit-touch-callout: none` and
     `user-select: none` are on the dock in CSS, or iOS raises its own callout
     menu over this and the gesture belongs to Safari instead. */
  /* ONE PALETTE, PER TOOL. v4 split this in two — five closed meanings for the
     text tools and eight free colours for the ink — and v5 collapses it: every
     tool that has a colour picks from the same five, and the tool remembers
     its own. A highlighter at 38% and a marker at 55% are different
     instruments; one shared slider made every tool wrong but the last touched.
     What gets STORED is unchanged, which is the point of readerIcons' join. */
  const [tcol, setTcol] = useState(() => readJSON("pw-reader-colour", TOOL_COLOUR));
  const [tsize, setTsize] = useState(() => readJSON("pw-reader-size", TOOL_SIZE));
  const [talpha, setTalpha] = useState(() => readJSON("pw-reader-alpha", TOOL_ALPHA));
  const [variant, setVariant] = useState(() => readJSON("pw-reader-variant", {}));
  const [inkOnly, setInkOnly] = useState(() => read("pw-reader-inkonly", "1") === "1");

  /* ── v5's root state ────────────────────────────────────────────────────
     PLATFORM IS NOT A BREAKPOINT. A 1024px window on a Mac is desktop and a
     1024px iPad is tablet; width alone cannot tell them apart, so the question
     asked is what the pointer can do. Everything downstream is CSS — the whole
     platform layer hangs off this one attribute. */
  const [plat, setPlat] = useState(() => readPlatform());
  const cap = capFor(plat);
  useEffect(() => watchPlatform(setPlat), []);

  /* WHERE THE BAR SITS, AND THE PANEL ALWAYS OPPOSITE IT. Two settings would
     let a student put both on the same edge, which is the one arrangement that
     cannot work — so there is one setting and the other is derived. */
  const [bar, setBar] = useState(() => read("pw-reader-bar", "left"));
  const side = bar === "right" ? "left" : "right";
  useEffect(() => { write("pw-reader-bar", bar); }, [bar]);

  /* AUTO-HIDE. 2800ms idle hides the chrome; any input brings it back; a
     marking pointerdown hides it at once. Popovers hold it open with a COUNTER
     rather than a boolean, because two open at once and closing one would
     otherwise let the whole lot fade while the other is still up. */
  /* Declared here rather than with the other refs, because `wake` below
     writes to it and a ref used before its declaration is a ReferenceError
     waiting for the first render that reaches it. */
  const shellRef = useRef(null);
  const [chromeOn, setChromeOn] = useState(true);
  const holds = useRef(0);
  const idleT = useRef(0);
  const wake = useCallback(() => {
    /* THE ATTRIBUTE FIRST, SYNCHRONOUSLY, AND THAT IS THE WHOLE POINT.

       Hidden chrome is `pointer-events:none` — the shipped sheet's rule, and
       the right one. But a reader who has been still moves the mouse and
       clicks in one motion, and React has not re-rendered between the two: the
       bar is still inert when the click lands, so the first click after a
       pause is swallowed and the second one works. Writing the attribute here
       means the CSS has already changed by the time the click arrives. The
       state below still runs, and re-renders to the value already set. */
    shellRef.current?.setAttribute("data-chrome", "on");
    setChromeOn(true);
    clearTimeout(idleT.current);
    if (holds.current > 0) return;
    idleT.current = setTimeout(() => setChromeOn(false), 2800);
  }, []);
  const hold = useCallback((on) => {
    holds.current = Math.max(0, holds.current + (on ? 1 : -1));
    if (on) { clearTimeout(idleT.current); setChromeOn(true); } else wake();
  }, [wake]);
  useEffect(() => () => clearTimeout(idleT.current), []);

  /* A course paper routes marks somewhere; your own document does not. The
     sheet removes the whole class layer on [data-ctx="me"], so this is one
     attribute rather than a condition repeated at every mention of it. */
  const ctx = paper?.visibility === "solo" ? "me" : "course";

  /* Notes and pins: windows on the page, at a FRACTION of it (0..1) so a note
     written at 80% on a phone is in the same place at 250% on a laptop. Same
     rule as ink, and for the same reason. */
  const [notes, setNotes] = useState([]);
  const [selPop, setSelPop] = useState(null);   // { left, top, start, end, quote }
  const [dragNote, setDragNote] = useState(null);
  const [dropOn, setDropOn] = useState(null);
  const [coach, setCoach] = useState(() => (read("pw-reader-coached", "0") === "1" ? -1 : 0));
  /* Read wherever the armed tool's own value is wanted. */
  const ck = tcol[tool] || "y";
  const size = tsize[tool] ?? 12;
  const alpha = talpha[tool] ?? 100;

  /* Where the rail sits and how big it is. localStorage and not the account,
     for the same reason the player bar's position is: it belongs to the screen
     in front of you. A phone and a laptop should not argue about it. */
  const [dock, setDock] = useState(() => read("pw-paper-dock", "left"));
  const [toolSize] = useState(() => read("pw-paper-toolsize", "m"));
  useEffect(() => { write("pw-paper-dock", dock); }, [dock]);
  useEffect(() => { write("pw-paper-toolsize", toolSize); }, [toolSize]);
  useEffect(() => { write("pw-paper-layout", want); }, [want]);
  useEffect(() => { write("pw-paper-light", light); }, [light]);
  useEffect(() => { write("pw-paper-hush", hush ? "1" : "0"); }, [hush]);
  useEffect(() => { write("pw-reader-colour", JSON.stringify(tcol)); }, [tcol]);
  useEffect(() => { write("pw-reader-size", JSON.stringify(tsize)); }, [tsize]);
  useEffect(() => { write("pw-reader-alpha", JSON.stringify(talpha)); }, [talpha]);
  useEffect(() => { write("pw-reader-variant", JSON.stringify(variant)); }, [variant]);
  useEffect(() => { write("pw-reader-inkonly", inkOnly ? "1" : "0"); }, [inkOnly]);

  const [menu, setMenu] = useState(null);          // view | more | zoom | null
  const [sheet, setSheet] = useState(null);        // keys | details | null
  const [sel, setSel] = useState(null);            // { start, end, x, y }
  const [composer, setComposer] = useState(null);  // { kind, start, end, quote }
  const [draft, setDraft] = useState("");
  const [ring, setRing] = useState("module");
  const [busy, setBusy] = useState(false);

  const [queue, setQueue] = useState([]);
  const [query, setQuery] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findAt, setFindAt] = useState(0);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  /* ---------------------------------------------------------------------
     What the shipped markup needs that the old one did not.
     ------------------------------------------------------------------ */
  const [mode, setMode] = useState("read");        // read | rev  (§12)
  const [penDown, setPenDown] = useState(false);   // §8.7 chrome recedes
  const [inspOpen, setInspOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [freshMarks, setFreshMarks] = useState(false);

  /* The inspector's values, per tool family. A highlighter's 12pt and a pen's
     4pt are not the same number wearing two hats. */
  const [hlSize, setHlSize] = useState(() => Number(read("pw-paper-hlsize", "12")) || 12);
  const [opacity, setOpacity] = useState(() => Number(read("pw-paper-op", "42")) || 42);
  const [smart, setSmart] = useState(() => read("pw-paper-smart", "1") === "1");
  const [smooth, setSmooth] = useState(() => Number(read("pw-paper-smooth", "100")) || 100);
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(read("pw-paper-recent", "[]")) || []; } catch { return []; }
  });
  useEffect(() => { write("pw-paper-hlsize", String(hlSize)); }, [hlSize]);
  useEffect(() => { write("pw-paper-op", String(opacity)); }, [opacity]);
  useEffect(() => { write("pw-paper-smart", smart ? "1" : "0"); }, [smart]);
  useEffect(() => { write("pw-paper-smooth", String(smooth)); }, [smooth]);
  useEffect(() => { write("pw-paper-recent", JSON.stringify(recent)); }, [recent]);

  const dockRef = useRef(null);
  const dragId = useRef(null);
  /* The scrubber's handlers are stable, so what they need about the document
     comes through refs rather than through a closure that would rebuild them
     on every page change. */
  const totalPagesRef = useRef(0);
  const pageRef = useRef(1);
  const jumpToRef = useRef(null);

  /* Picking a tool opens its inspector, because the inspector IS the tool's
     properties and a tool with hidden properties is a tool you have to guess
     at. Select has none, so it closes it. */
  const pickTool = useCallback((id) => {
    if (editing) return;
    setTool(id);
    setAdding(false);
    setInspOpen(id !== "sel");
    if (id !== "sel") setPicked(null);
  }, [editing]);

  /* Setting a colour sets it FOR THE ARMED TOOL. v5 dropped the recents row —
     five colours never needed one, and it was a fourth thing in the panel
     competing with the three that matter. */
  const pickColour = useCallback((k) => setTcol((m) => ({ ...m, [tool]: k })), [tool]);
  const pickSize = useCallback((n) => setTsize((m) => ({ ...m, [tool]: n })), [tool]);
  const pickAlpha = useCallback((n) => setTalpha((m) => ({ ...m, [tool]: n })), [tool]);
  const pickVariant = useCallback((i) => setVariant((m) => ({ ...m, [tool]: i })), [tool]);

  /* Reset puts THIS tool back where it shipped, not the whole reader. */
  const resetTool = useCallback(() => {
    setTcol((m) => ({ ...m, [tool]: TOOL_COLOUR[tool] || "y" }));
    setTsize((m) => ({ ...m, [tool]: TOOL_SIZE[tool] ?? 12 }));
    setTalpha((m) => ({ ...m, [tool]: TOOL_ALPHA[tool] ?? 100 }));
    setVariant((m) => ({ ...m, [tool]: 0 }));
  }, [tool]);

  /* The tray. Nothing is unreachable: the Add sheet always lists the full set,
     so a tool taken off can always be found again. */
  const pushTool = useCallback((id) => {
    /* addTool returns { tray, note } — the note is why it refused, and the
       Add sheet's footer is already saying it, so a full tray is a no-op
       here rather than a second message. Reading `tray` from the closure is
       safe: this only ever runs from a click, one add at a time. */
    /* (tray, id, cap) — v5's signature takes the tool table LAST and
       optionally. Passed v4's order the cap arrived as the table and the table
       as the cap, so `all.findIndex` threw on every add and nothing was ever
       added to the bar. */
    const { tray: next } = addTool(tray, id, cap);
    if (next === tray) return;
    setTray(next);
    saveTray(window.innerWidth, next);
    pickTool(id);
  }, [tray, cap, pickTool]);

  const dropFromTray = useCallback((id) => {
    setTray((held) => {
      const next = removeTool(held, id);
      saveTray(window.innerWidth, next);
      if (tool === id) setTool(next[0] || "sel");
      return next;
    });
  }, [tool]);

  const dropTool = useCallback((onto) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === onto) return;
    setTray((held) => {
      const next = moveTool(held, from, onto);
      saveTray(window.innerWidth, next);
      return next;
    });
  }, []);

  /* Long-press the dock to edit it (§9). 450ms, and only from a press that
     stays put — a press that becomes a drag is a drag. */
  const lp = useRef(0);
  const onDockPointerDown = useCallback((e) => {
    /* `.t` is v5's tool button. This still said `.tool`, which is v4's, so
       the long-press never armed and there was no way into edit mode at all. */
    if (!e.target.closest?.(".t")) return;
    clearTimeout(lp.current);
    lp.current = setTimeout(() => { setEditing(true); setInspOpen(false); setAdding(false); }, 450);
  }, []);
  const onDockPointerUp = useCallback(() => clearTimeout(lp.current), []);
  useEffect(() => () => clearTimeout(lp.current), []);

  /* The page number is a scrubber (§11.3). The drag lives in a ref because
     pointerdown and the first pointermove can land in the same tick. */
  const scrubDown = useCallback((e) => {
    if (totalPagesRef.current < 8) return;
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not ours */ }
    drag.current = { x: e.clientX, from: pageRef.current, page: pageRef.current };
    setScrub({ page: pageRef.current });
  }, []);
  const scrubMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const total = totalPagesRef.current;
    const perPx = total / Math.max(320, window.innerWidth * 0.55);
    const n = Math.max(1, Math.min(total, Math.round(d.from + (e.clientX - d.x) * perPx)));
    if (n !== d.page) { d.page = n; setScrub({ page: n }); }
  }, []);
  const scrubUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    setScrub(null);
    if (d && d.page !== d.from) jumpToRef.current?.(d.page);
  }, []);

  /* The mark card is held open while the pointer is on it — otherwise moving
     from the mark to the card dismisses the card on the way. */
  const cardTimer = useRef(0);
  const holdCard = useCallback(() => clearTimeout(cardTimer.current), []);
  const leaveCard = useCallback(() => {
    clearTimeout(cardTimer.current);
    cardTimer.current = setTimeout(() => setPicked(null), 260);
  }, []);
  useEffect(() => () => clearTimeout(cardTimer.current), []);

  const openNoteOn = useCallback((mark) => {
    if (!model) return;
    setComposer({ kind: "note", start: mark.start, end: mark.end,
                  quote: quoteOf(model, mark.start, mark.end) });
    setDraft(mark.body || "");
    setPicked(null);
  }, [model]);


  /* WHY THIS SCREEN IS A PORTAL, AND IT IS NOT A PREFERENCE.

     The reader is `position: fixed; inset: 0`, which should make it the size of
     the window wherever it sits in the tree. It did not: it painted as a white
     strip a few pixels tall, across the middle of the page.

     Every box measured correctly — 1280x720 for the screen, 996x1408 for the
     page, the canvas full of ink — which is what made this take so long to
     believe. Layout was never wrong. Painting was.

     The cause is two ancestors up. `.deck-inner` carries `.route-fade`, which
     animates opacity on every navigation, and an animating element gets its own
     composited layer. A fixed-position descendant inside that layer is painted
     against it rather than against the window, and `.deck-inner` is 28px tall
     on this route because its only child is the empty <main> the paper route
     renders. Hence a strip.

     Rendering into `.app` instead puts the reader outside the deck's animated
     wrapper. `.app` and not `document.body` on purpose: the Smooth Air rules
     are written `.app.smooth-air …`, and a portal to the body would take the
     reader out of their reach and quietly break R13. */
  const [host] = useState(() => (typeof document === "undefined"
    ? null
    : document.querySelector(".app") || document.body));

  const scrollRef = useRef(null);
  const pageEls = useRef(new Map());
  const divsByPage = useRef(new Map());
  const lastSync = useRef(null);

  const registerEl = useCallback((num, el) => { if (el) pageEls.current.set(num, el); }, []);
  const takeDivs = useCallback((num, spans, items) => {
    if (spans) divsByPage.current.set(num, { divs: spans, items });
    else divsByPage.current.delete(num);
  }, []);

  /* Idle is measured from the last thing a person did, not from a clock. Held
     in a ref so a wake-up costs no render when it is already awake. */
  const awake = useRef(0);
  useEffect(() => {
    if (!host) return undefined;
    let timer = 0;
    const sleep = () => setQuiet(true);
    const wake = () => {
      awake.current = Date.now();
      setQuiet((q) => (q ? false : q));
      clearTimeout(timer);
      timer = setTimeout(sleep, 2400);
    };
    wake();
    const opts = { passive: true };
    for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) {
      window.addEventListener(ev, wake, opts);
    }
    return () => {
      clearTimeout(timer);
      for (const ev of ["pointermove", "pointerdown", "keydown", "wheel"]) {
        window.removeEventListener(ev, wake, opts);
      }
    };
  }, [host]);

  /* ------------------------------------------------------------- the paper */
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    setError(null);
    (async () => {
      try {
        /* THE SIDECARS FIRST, AND THE PDF ONLY FOR PIXELS.

           §4.6: never touch the PDF for anything the manifest can answer. The
           layout — how many pages, how big each one is — comes from the
           manifest written at ingest, so a thousand page-shaped placeholders
           are on screen at the right height before a single PDF byte arrives.

           This is not a nicety. Asking the document for all 1012 viewports
           made 1012 range requests before anything drew: measured at 119MB
           over the wire on a 44MB file, and the first page never appeared at
           all. The manifest answers the same question in one row we already
           have. */
        const boxes = paper?.manifest?.boxes;
        if (boxes?.length) {
          setSizes(boxes.map((b) => ({ w: b.w, h: b.h })));
        }

        /* The text layer likewise: stored at ingest, fetched as one file.
           Extracting it here would mean parsing every page of the document to
           read a paper.

           NOT AWAITED HERE. It is 3MB on a long manual and nothing on screen
           needs it — the pages draw without it, and marks resolve against it
           when it lands. Awaiting it put three seconds between opening a paper
           and seeing any of it, for a file that is only needed to search. */
        const textPromise = paper?.manifest ? storedText(paper) : Promise.resolve(null);
        textPromise.then((t) => { if (live && t) setModel(t); });

        const d = await loadPaper(url, paper?.bytes);
        if (!live) return;
        setDoc(d);

        /* Only when there is no manifest — the repo's own fixture papers, which
           are small and local. */
        if (!boxes?.length) {
          const all = [];
          for (let n = 1; n <= d.numPages; n++) {
            const page2 = await d.getPage(n);
            const v = page2.getViewport({ scale: 1 });
            all.push({ w: v.width, h: v.height });
            page2.cleanup();
          }
          if (!live) return;
          setSizes(all);
        }

        d.getMetadata().then((m) => { if (live) setMeta(m); }).catch(() => {});
        /* Only extract in the browser when nothing was stored — the fixture
           papers, which are small and local. */
        if (!(await textPromise)) {
          const m = await paperText(url);
          if (live) setModel(m);
        }
      } catch (e) {
        console.error(e);
        if (live) setError("This paper would not open. The original still will.");
      }
    })();
    /* Let the document go when the reader closes. Without this every paper
       opened in a session stays parsed for the life of the tab, which on a
       tablet is the difference between a long session and a reload. */
    return () => { live = false; releasePaper(url); };
  }, [url]);

  /* --------------------------------------------------------------- the fit */
  const across = layout === "spread" ? 2 : 1;
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !sizes.length || !fit) return;
    const first = sizes[0];
    /* MEASURE THE BOX THE PAGE ACTUALLY SITS IN.

       `clientWidth` on the scroller includes its padding — 398px of it when the
       panel is open — and the column inside has 24px of its own. Fitting to
       either one alone makes the page too wide, and it then runs under the
       panel or the tick rail. Asking the column for its content width accounts
       for every box between the scroller and the sheet, with no arithmetic to
       get wrong the next time the padding changes. */
    const stack = el.querySelector(".stack");
    const cs = getComputedStyle(el);
    let room = stack
      ? stack.clientWidth - parseFloat(getComputedStyle(stack).paddingLeft) - parseFloat(getComputedStyle(stack).paddingRight)
      : el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    /* AND NO WIDER THAN THE SHEET'S OWN CAP. `.page` is `min(870px, 100%)` in
       reader.css, which is a measured line length and not an accident: 870px
       of body text at this size is about 90 characters, and past that the eye
       loses the start of the next line. The reader rasterises at a scale
       rather than transform-scaling a fixed box — a transformed canvas is a
       blurry canvas — so the cap has to be applied to the scale instead, or
       fit-width fills a 1440px window with one page and runs it under the
       panel and the tool bar both. */
    room = Math.min(room, PAGE_MAX);
    const tall = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    setScale(fitScale(
      fit,
      { w: first.w, h: first.h, rotated: rotation % 180 !== 0 },
      { width: room, height: tall },
      { x: 0, y: 0 },
      across,
    ));
    /* `rail` and `hush` are dependencies because both CHANGE THE SCROLLER'S
       PADDING, and the padding is the room. Without them the scale was
       whatever it had been when the panel was last in a different state — so
       opening the panel left the page 322px too wide and running under it, and
       closing it left the page too narrow. The measurement was right; it was
       simply never taken again. */
  }, [sizes, fit, rotation, across, rail, hush]);

  useEffect(() => { measure(); }, [measure, rail]);
  /* WATCH THE BOX, NOT THE WINDOW.

     `resize` only fires when the WINDOW changes, and the reader's box changes
     for other reasons: a pane that opens beside it, a tab restored from the
     background, an embed that starts at zero and is given its size a frame
     later. Found the hard way — opened in a preview pane that reported a 0x0
     viewport, the reader came up as `phone` with a zero-width stage, and when
     the pane was given its real size nothing told it: no resize event was
     fired, so the platform stayed phone and the page never drew. A
     ResizeObserver asks the element itself, which is the only thing that
     actually knows. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      const on = () => { measure(); setPlat(readPlatform()); };
      window.addEventListener("resize", on);
      return () => window.removeEventListener("resize", on);
    }
    const ro = new ResizeObserver(() => { measure(); setPlat(readPlatform()); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /* ZOOM HOLDS THE POINT THE READER WAS LOOKING AT (rule 6).

     Without this, zooming in on a diagram halfway down page 400 throws you to
     the top of it, and the fix is not "scroll back" — it is that the paragraph
     under the cursor should still be under the cursor afterwards. The
     arithmetic is the same either way: work out where the anchor sits as a
     fraction of the scrolled content, apply the new scale, put that fraction
     back under the same screen position.

     Anchored to the pointer, then the pinch centre, then the middle of the
     viewport, in that order — brief 4.4. */
  const zoomAbout = useCallback((next, clientY) => {
    const el = scrollRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const at = clientY == null ? box.height / 2 : clientY - box.top;
    const before = el.scrollTop + at;
    const factor = next / scale;
    setFit(null);
    setScale(next);
    /* After the layout has been recomputed at the new scale — one frame is
       enough, and it must not be a timeout: a timeout lands after the browser
       has already painted the jump. */
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = before * factor - at;
    });
  }, [scale]);

  /* Ctrl/⌘ + wheel on a desktop, pinch on a tablet. Passive:false because both
     have to be prevented — otherwise the browser zooms the whole page instead,
     which puts the reader's own chrome under a magnifying glass. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAbout(clampZoom(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)), e.clientY);
    };
    let pinch = null;
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), from: scale,
                y: (a.clientY + b.clientY) / 2 };
    };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinch.d) return;
      e.preventDefault();
      zoomAbout(clampZoom(pinch.from * (d / pinch.d)), pinch.y);
    };
    const onTouchEnd = () => { pinch = null; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scale, zoomAbout]);

  /* --------------------------------------------------------------- reading */
  /* Only the continuous layout reads the page off the scroll position. In the
     paged layouts the page IS the state and the scroll is just where you are
     inside it, so letting the scroll write back would fight every navigation. */
  /* WHICH PAGE YOU ARE ON, WITHOUT ASKING THE DOM.

     This used to walk every registered page node reading `offsetTop`, which
     forces layout — 3,036 nodes and 6ms on every scroll event of a 1012-page
     manual, on the main thread, while the reader was trying to hold 60fps.

     The page heights are already known (from the manifest), so where each page
     starts is arithmetic. A running total, computed once per scale change, and
     a binary search into it: no layout, no DOM, O(log n).

     Coalesced into a frame as well, because a trackpad fires scroll events far
     faster than anything can usefully answer them. */
  const offsets = useMemo(() => {
    const out = new Float64Array(sizes.length + 1);
    const rotated = rotation % 180 !== 0;
    let y = 0;
    for (let i = 0; i < sizes.length; i++) {
      out[i] = y;
      const h = (rotated ? sizes[i].w : sizes[i].h) * scale;
      y += h + PAGE_GAP;
    }
    out[sizes.length] = y;
    return out;
  }, [sizes, scale, rotation]);

  const at = useCallback((y) => {
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (offsets[m] <= y) lo = m; else hi = m;
    }
    return lo;
  }, [offsets]);

  /* WHICH SLOTS EXIST AT ALL.

     A thousand page slots re-reconciling on every scroll tick is the last of
     the lag: React does not care that 1009 of them are empty divs, it walks
     them all. Only the pages near the viewport are rendered; the rest are two
     spacers holding exactly the height they would have taken, so the scrollbar
     is unchanged and nothing jumps. */
  const [win, setWin] = useState([0, 8]);
  const scrollTick = useRef(0);
  const onScroll = useCallback(() => {
    if (scrollTick.current) return;
    scrollTick.current = requestAnimationFrame(() => {
      scrollTick.current = 0;
      const el = scrollRef.current;
      if (!el || offsets.length < 2) return;
      const first = at(el.scrollTop);
      const last = at(el.scrollTop + el.clientHeight);
      setWin(([a, b]) => {
        const na = Math.max(0, first - 3);
        const nb = Math.min(sizes.length, last + 4);
        return (a === na && b === nb) ? [a, b] : [na, nb];
      });
      if (layout !== "scroll") return;
      setPage(Math.min(sizes.length || 1, at(el.scrollTop + el.clientHeight * 0.35) + 1));
    });
  }, [layout, offsets, sizes.length, at]);

  /* The window has to be right before the first scroll event too. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || offsets.length < 2) return;
    setWin([Math.max(0, at(el.scrollTop) - 3), Math.min(sizes.length, at(el.scrollTop + el.clientHeight) + 4)]);
  }, [offsets, sizes.length, at]);
  useEffect(() => () => { if (scrollTick.current) cancelAnimationFrame(scrollTick.current); }, []);

  const goToPage = useCallback((n) => {
    const want = Math.max(1, Math.min(n, sizes.length || n));
    setPage(want);
    const el = scrollRef.current;
    if (!el) return;
    /* Arithmetic, not a DOM lookup: with the column virtualised the target
       page very often is not mounted yet, and `offsets` already knows exactly
       where it starts. */
    if (layout === "scroll") el.scrollTo({ top: Math.max(0, (offsets[want - 1] || 0) - 12), behavior: "auto" });
    else el.scrollTo({ top: 0, behavior: "auto" });
  }, [layout, sizes.length, offsets]);

  /* §11.1 — every jump that is not a page-turn records where it left from.
     Turning a page is not a jump, because you can turn back; the long moves —
     a mark in the panel, a tick on the rail, a search hit — are the ones that
     lose you. */
  const jumpTo = useCallback((n) => {
    setCameFrom({ page, top: scrollRef.current?.scrollTop ?? 0 });
    goToPage(n);
  }, [goToPage, page]);

  /* A spread turns two pages at a time, except at the cover. Stepping by one
     from an open book leaves you looking at the same two pages with the number
     changed, which reads as a broken button. */
  const turn = useCallback((direction) => {
    if (layout !== "spread") { goToPage(page + direction); return; }
    const list = spreads(sizes.length);
    const at = spreadOf(page) + direction;
    const target = list[Math.max(0, Math.min(at, list.length - 1))];
    if (target) goToPage(target[0]);
  }, [layout, page, sizes.length, goToPage]);

  /* ------------------------------------------------------------ the marks */
  const syncFromServer = useCallback(async (merge = false) => {
    if (!me || !paper?.id) return;
    const [incoming, ink] = await Promise.all([
      fetchAnnotations(me, paper.id, null),
      fetchInk(me, paper.id),
    ]);
    lastSync.current = new Date().toISOString();
    // Merge rather than replace on a refresh, so a mark made a second ago and
    // still in flight is not wiped by the answer to a question asked before it.
    let after = 0;
    setRows((held) => { const next = merge ? mergeRows(held, incoming) : incoming; after = next.length; return next; });
    setStrokes((held) => (merge ? mergeRows(held, ink) : ink));
    return after;
  }, [me, paper?.id]);

  useEffect(() => {
    setRows([]); setStrokes([]); lastSync.current = null;
    syncFromServer(false);
  }, [syncFromServer]);

  /* THE ONE SCREEN WHERE A REFRESH IS THE MECHANISM, AND ON PURPOSE.

     Everywhere else in this app a socket delivers the moment somebody types —
     see lib/live.js. A paper is the exception, and it is the exception because
     of R6: notes open inline and push text down, so anything arriving on its
     own moves the page under somebody who is reading it. That is the single
     most likely way to make this feel broken while every part of it works.

     So marks arrive when the reader asks, and the button is the asking. The
     scroll position is pinned across the change anyway: the page you are on
     stays where it is even when four notes land above it. */
  const refreshNow = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const el = scrollRef.current;
    const anchorNode = pageEls.current.get(page);
    const before = anchorNode ? anchorNode.getBoundingClientRect().top : null;
    const had = rowsRef.current.length;
    const now = await syncFromServer(true);
    requestAnimationFrame(() => {
      const node = pageEls.current.get(page);
      if (el && before != null && node) {
        const after = node.getBoundingClientRect().top;
        el.scrollTop += after - before;
      }
      setRefreshing(false);
      /* §7.1 — it says what it found, in a sentence, and marks the button when
         something came in. "Up to date" is not an absence stated: it is the
         answer to the question that was asked. */
      const gained = Math.max(0, (typeof now === "number" ? now : rowsRef.current.length) - had);
      setFreshMarks(gained > 0);
      setToast({
        text: gained
          ? `${gained} new ${gained === 1 ? "mark" : "marks"} from the module.`
          : "Up to date. No new marks on this paper.",
      });
    });
  }, [refreshing, syncFromServer, page]);

  /* The toast says one thing and goes. */
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  /* The dot clears when the Marks panel is opened, which is where the new ones
     are. */
  useEffect(() => { if (rail === "marks") setFreshMarks(false); }, [rail]);



  /* R9's other half — the author queue.

     A correction is invisible on the page to everyone but its writer, so
     without somewhere for it to arrive it is a message nobody receives. The
     function returns nothing at all for a student, so this is safe to call
     unconditionally: a queue you cannot see should not tell you it exists. */
  const loadQueue = useCallback(async () => {
    if (!me || !moduleCode) return;
    setQueue(await fetchCorrections(me, moduleCode));
  }, [me, moduleCode]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  /* R2 — resolve against the text as it is now, and record anything that lost
     its place. Never relocated, never dropped. */
  const { placed, orphans } = useMemo(
    () => resolveAll(rows, model?.text || ""), [rows, model],
  );

  const reported = useRef(new Set());
  useEffect(() => {
    if (!model) return;
    for (const o of orphans) {
      if (o.status === "orphaned" || reported.current.has(o.id)) continue;
      reported.current.add(o.id);
      markOrphaned(o.id, true);
    }
    for (const p of placed) {
      if (p.status !== "orphaned" || reported.current.has(`ok:${p.id}`)) continue;
      reported.current.add(`ok:${p.id}`);
      markOrphaned(p.id, false);
    }
  }, [orphans, placed, model]);

  const shown = useMemo(() => {
    const list = applyFilter(placed, filter, me);
    return density ? list : list.filter((a) => a.close);
  }, [placed, filter, me, density]);

  const { segments } = useMemo(() => segmentsFor(shown), [shown]);

  /* Search draws with the same machinery: matches are just segments of another
     kind, so there is one measuring path in this screen and not two. */
  const finds = useMemo(
    () => findAll(model?.text || "", query, { matchCase, wholeWord }),
    [query, model, matchCase, wholeWord],
  );

  const drawSegments = useMemo(() => {
    const base = density ? segments : segments.filter((s) => s.mine.length);
    const hits = finds.map((f, i) => ({
      start: f.start, end: f.end, count: 1, mine: [], ids: [`find:${i}`],
      kind: i === findAt ? "find-current" : "find", density: 0, deco: [],
    }));
    return [...base, ...hits];
  }, [segments, finds, findAt, density]);

  /* ------------------------------------------------------------ selection */
  /* AN OFFSET MEANS TWO DIFFERENT THINGS depending on what it is an offset INTO,
     and getting that wrong produces a mark one character long that looks like a
     mark on a sentence until you read it back.

     In a text node it is a character position, which is what this needs. In an
     ELEMENT it is a child-node index — and a range endpoint is an element more
     often than it looks: a double-click on a word, a triple-click on a line, a
     drag that ends exactly on a span boundary, and anything that calls
     selectNodeContents. Treating the child index as a character count then
     silently truncates the selection to its first character. */
  const locate = useCallback((node, offset) => {
    const isText = node?.nodeType === 3;
    const el = isText ? node.parentElement : node;
    const span = el?.closest?.("[data-item]");
    if (!span) return null;
    const pageEl = span.closest("[data-page]");
    const n = Number(pageEl?.dataset.page);
    const entry = divsByPage.current.get(n);
    if (!entry) return null;
    const item = entry.items[Number(span.dataset.item)];
    if (!item) return null;

    let chars;
    if (isText) {
      chars = offset;
    } else {
      // Every character in the children before this index.
      const kids = [...(node.childNodes || [])].slice(0, offset);
      chars = kids.reduce((sum, k) => sum + (k.textContent?.length || 0), 0);
    }
    return item.start + Math.min(chars, item.str.length);
  }, []);

  /* TAP ANYWHERE.

     A note still anchors to words — R1 does not bend — but asking somebody to
     drag across a sentence before they can write anything puts a second
     gesture in front of a first thought. So the tap picks the sentence it
     landed in and the Spotlight opens on that. The browser is asked where the
     caret would go; both spellings of that API are in the wild. */
  const offsetFromPoint = useCallback((x, y) => {
    let node = null, off = 0;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) { node = pos.offsetNode; off = pos.offset; }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; off = r.startOffset; }
    }
    return node ? locate(node, off) : null;
  }, [locate]);

  const readSelection = useCallback(() => {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return; }
    const range = s.getRangeAt(0);
    const a = locate(range.startContainer, range.startOffset);
    const b = locate(range.endContainer, range.endOffset);
    if (a == null || b == null || a === b) { setSel(null); return; }
    const box = range.getBoundingClientRect();
    const host2 = scrollRef.current?.getBoundingClientRect();
    if (!host2) return;
    setSel({
      start: Math.min(a, b),
      end: Math.max(a, b),
      x: Math.max(12, Math.min(box.left - host2.left + box.width / 2, host2.width - 12)),
      y: Math.max(8, box.top - host2.top - 8),
    });
  }, [locate]);

  /* With a tool armed, a selection IS the action — no popup, no second click.
     That is the whole point of a tool rail, and it is how both references
     behave. `select` keeps the popup, so the one-tap flow still exists for
     somebody who never touches the rail. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const up = () => setTimeout(readSelection, 0);
    el.addEventListener("mouseup", up);
    el.addEventListener("touchend", up);
    return () => { el.removeEventListener("mouseup", up); el.removeEventListener("touchend", up); };
  }, [readSelection]);

  /* --------------------------------------------------------------- writing */
  const clearSelection = () => { window.getSelection()?.removeAllRanges(); setSel(null); };

  /* ONE STACK, REACHING EVERY ACTION (§5.4).

     An undo that only reaches "the last thing you drew" is the one people
     discover is missing at the worst moment — after recolouring the wrong mark,
     or deleting somebody's note by mistake. Every operation pushes its own
     INVERSE, as data rather than as a closure, so the stack survives the
     component re-rendering and each step can be replayed in either direction.

     Cleared on paper change, kept across navigation within one paper. */
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const past = useRef([]);
  const future = useRef([]);
  const remember = useCallback((step) => {
    past.current.push(step);
    future.current = [];
    setDepth({ past: past.current.length, future: 0 });
  }, []);

  const putBack = useCallback(async (row) => {
    if (row.__ink) {
      setStrokes((held) => [...held.filter((k) => k.id !== row.id), row]);
      await createStroke({ ...row, paperId: row.paper_id, moduleCode: row.module_code, me: row.author_id });
    } else {
      setRows((held) => [...held.filter((r) => r.id !== row.id), row]);
      await createAnnotation({
        id: row.id, paperId: row.paper_id, moduleCode: row.module_code, me: row.author_id,
        kind: row.kind, ring: row.ring, body: row.body, anchor: row.anchor,
        threadId: row.thread_id, colour: row.colour,
      });
    }
  }, []);

  const takeAway = useCallback(async (row) => {
    if (row.__ink) {
      setStrokes((held) => held.filter((k) => k.id !== row.id));
      await deleteStrokes([row.id]);
    } else {
      setRows((held) => held.filter((r) => r.id !== row.id));
      await deleteAnnotation(row.id);
    }
  }, []);

  const applyStyle = useCallback((id, patch) => {
    setRows((held) => held.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    updateAnnotation(id, patch);
  }, []);

  const step = useCallback(async (from, to, direction) => {
    const move = from.current.pop();
    if (!move) return;
    const forward = direction === "redo";
    if (move.op === "add") { if (forward) await putBack(move.row); else await takeAway(move.row); }
    else if (move.op === "del") { if (forward) await takeAway(move.row); else await putBack(move.row); }
    else if (move.op === "style") applyStyle(move.id, forward ? move.after : move.before);
    to.current.push(move);
    setDepth({ past: past.current.length, future: future.current.length });
  }, [putBack, takeAway, applyStyle]);

  const undo = useCallback(() => step(past, future, "undo"), [step]);
  const redo = useCallback(() => step(future, past, "redo"), [step]);
  const canUndo = depth.past > 0;
  const canRedo = depth.future > 0;

  /* A different paper is a different stack. Undoing your way out of one paper
     and into edits on another is not a feature. */
  useEffect(() => { past.current = []; future.current = []; setDepth({ past: 0, future: 0 }); }, [paper?.id]);

  /* R8 — your own marks are instant. The row goes in with a temporary id on the
     frame the button is pressed and is reconciled when the insert returns. On
     failure it is removed and the reason is said out loud, rather than left
     sitting there looking saved. */
  const addMark = useCallback(async ({ kind, start, end, body = null, ringId, threadId = null, colour }) => {
    if (!model || !me) return null;
    const anchor = anchorFor(model.text, start, end);
    /* A TEXT MARK TAKES A MEANING, NOT A COLOUR. The five are closed for
       highlight, underline and strike — there is deliberately no plain one,
       because a plain highlight is the one everybody picks and it means
       nothing. Free colour stays with the pen and the marker, where ink is
       ink. See lib/meanings.js. */
    /* The five are closed, and every text tool takes one — there is
       deliberately no plain highlight, because a plain highlight is the one
       everybody picks and it means nothing. `colour` arrives as a reference
       key (y·b·g·p·r); what is stored is the meaning. */
    const paint = kind && kind !== "correction"
      ? meaningOr(MEANING_OF[colour] || MEANING_OF[ck] || DEFAULT_MEANING) : null;
    const optimistic = {
      id: tempId(), paper_id: paper.id, module_code: moduleCode, author_id: me,
      author_name: "You", kind, ring: ringId || ring, body, thread_id: threadId,
      colour: paint, anchor, status: "ok", close: true, created_at: new Date().toISOString(),
    };
    setRows((held) => [...held, optimistic]);
    const saved = await createAnnotation({
      paperId: paper.id, moduleCode, me, kind, ring: ringId || ring, body, anchor, threadId,
      colour: paint,
    });
    setRows((held) => (saved
      ? held.map((r) => (r.id === optimistic.id ? { ...saved, author_name: "You", close: true } : r))
      : held.filter((r) => r.id !== optimistic.id)));
    if (!saved) setError("That mark did not save. Nothing else was touched.");
    else remember({ op: "add", row: { ...saved, author_name: "You", close: true } });
    return saved;
  }, [model, me, paper, moduleCode, ring, ck]);


  /* ------------------------------------------------------------------ ink */
  /* Same optimistic shape as a mark, and for the same reason: a line that
     appears a beat after the finger lifts is a line you drew twice. */
  const addStroke = useCallback(async (pageNumber, points) => {
    if (!me || !paper?.id || !points.length) return;
    const wide = penWidth(size) * (tool === "mkr" ? 3.2 : 1);
    const optimistic = {
      id: tempId(), paper_id: paper.id, module_code: moduleCode, author_id: me,
      author_name: "You", page: pageNumber, tool: tool === "mkr" ? "marker" : "pen",
      colour: INK_OF[ck] || "blue", width: wide, ring, points, mine: true,
      created_at: new Date().toISOString(),
    };
    setStrokes((held) => [...held, optimistic]);
    const saved = await createStroke({
      paperId: paper.id, moduleCode, me, page: pageNumber,
      tool: optimistic.tool, colour: INK_OF[ck] || "blue", width: wide, ring, points,
    });
    setStrokes((held) => (saved
      ? held.map((s) => (s.id === optimistic.id ? { ...saved, author_name: "You", mine: true } : s))
      : held.filter((s) => s.id !== optimistic.id)));
    if (!saved) setError("That stroke did not save. Nothing else was touched.");
    else remember({ op: "add", row: { ...saved, __ink: true, author_name: "You", mine: true } });
  }, [me, paper, moduleCode, tool, ck, size, ring]);

  const eraseStrokes = useCallback(async (ids) => {
    const list = ids.filter((id) => strokes.some((s) => s.id === id && s.author_id === me));
    if (!list.length) return;
    setStrokes((held) => held.filter((s) => !list.includes(s.id)));
    await deleteStrokes(list.filter((id) => !String(id).startsWith("tmp_")));
  }, [strokes, me]);

  /* ------------------------------------------------------- picking one up
     §5.3 — hit-test a mark on click or tap.

     The marks layer is `pointer-events: none` (it has to be, or it would eat
     every text selection), so the hit test is done in DOCUMENT OFFSETS rather
     than in pixels: the click is mapped to a character position, and a mark
     covers it if that position is inside its span. That is exact, it costs
     nothing, and it works identically for a pen, a finger and a mouse. */
  const markAt = useCallback((x, y) => {
    const off = offsetFromPoint(x, y);
    if (off == null) return null;
    const hits = placed.filter((m) => off >= m.start && off <= m.end);
    if (!hits.length) return null;
    // The tightest one wins, so a note inside a long highlight is reachable.
    return hits.reduce((best, m) => (m.end - m.start < best.end - best.start ? m : best));
  }, [placed, offsetFromPoint]);

  const cardFor = useCallback((mark, clientX, clientY) => {
    const host2 = scrollRef.current?.getBoundingClientRect();
    if (!host2) return null;
    const W = 286, H = 210;
    const above = clientY - host2.top - H - 14;
    /* `left`/`top`, because that is what the card's style reads. It used to
       hand back x/y and the card rendered at nothing at all. */
    return {
      left: Math.max(12, Math.min(clientX - host2.left - W / 2, host2.width - W - 12)),
      top: above > 8 ? above : Math.min(host2.height - H - 12, clientY - host2.top + 18),
      flip: above <= 8,
    };
  }, [model]);

  const open = useCallback((mark, x, y) => {
    if (!mark) { setPicked(null); return; }
    setActiveId(mark.id);
    setPicked({ mark: { ...mark, page: model ? pageOf(model, mark.start) : null }, at: cardFor(mark, x, y) });
  }, [cardFor]);

  /* Hover on a desktop, tap on touch — and the tap half is the one that
     matters. An iPad reports no hover, so a card that only opens on hover is a
     card half the users can never see. */

  const handled = useRef(0);
  const tapToMark = useCallback((e) => {
    /* Click and pointerup both arrive for a mouse; one gesture, one action. */
    if (e.timeStamp && e.timeStamp === handled.current) return;
    handled.current = e.timeStamp;
    /* A tap on an existing mark opens its card, whatever tool is in hand —
       except while a drawing tool is armed, where a tap is a dot. */
    if (!isInk(tool) && !window.getSelection()?.toString().trim()) {
      const hit = markAt(e.clientX, e.clientY);
      if (hit) { open(hit, e.clientX, e.clientY); return; }
      setPicked(null);
    }
    if (!isTaker(tool)) return;
    if (!model) return;
    if (window.getSelection()?.toString().trim()) return;      // a drag, not a tap
    if (e.target.closest?.("button, a, input, textarea, select, .rdr-note, .composer, .bar-insp, .mark-card")) return;
    const at = offsetFromPoint(e.clientX, e.clientY);
    if (at == null) return;
    const span = sentenceAround(model.text, at);
    if (!span) return;
    setComposer({ kind: kindOf(tool), start: span.start, end: span.end, quote: quoteOf(model, span.start, span.end) });
    setDraft("");
    if (tool === "cor") setRing("solo");
  }, [tool, model, offsetFromPoint, markAt, open]);

  const openComposer = (kind, from = sel) => {
    if (!from || !model) return;
    setComposer({ kind, start: from.start, end: from.end, quote: quoteOf(model, from.start, from.end) });
    setDraft("");
    if (kind === "correction") setRing("solo");
    clearSelection();
  };

  /* The armed tool fires as soon as a selection settles. Held in a ref and read
     inside the effect rather than listed as a dependency, because rebinding the
     listener on every tool change is how a selection ends up handled twice. */
  useEffect(() => {
    if (!sel || tool === "sel" || isInk(tool)) return;
    const made = sel;
    if (marksText(tool)) {
      clearSelection();
      addMark({ kind: kindOf(tool), start: made.start, end: made.end });
    } else {
      /* kindOf, not the tool id. `ask` is the tool; `question` is what the
         row is, what the CHECK constraint allows, and what saveComposer
         tests for before it opens the thread. */
      openComposer(kindOf(tool), made);
    }
  }, [sel, tool]);

  const saveComposer = async () => {
    if (!composer || !draft.trim()) return;
    setBusy(true);
    let threadId = null;
    if (composer.kind === "question") {
      threadId = await askOnPassage({
        moduleCode, me, quote: composer.quote, body: draft.trim(), paperTitle: paper?.title,
      });
      if (!threadId) {
        setBusy(false);
        setError("The question did not reach the Ready Room, so nothing was saved.");
        return;
      }
    }
    await addMark({
      kind: composer.kind, start: composer.start, end: composer.end,
      body: draft.trim(), ringId: composer.kind === "correction" ? "solo" : ring, threadId,
    });
    setBusy(false);
    setComposer(null);
    setDraft("");
  };

  const removeMark = async (mark) => {
    remember({ op: "del", row: mark });
    setRows((held) => held.filter((r) => r.id !== mark.id));
    await deleteAnnotation(mark.id);
  };

  /* §10 — agreeing with somebody else's mark. A counter, incremented where it
     lives, so two people agreeing in the same second both count. */
  const agree = useCallback((mark) => {
    setRows((held) => held.map((r) => (r.id === mark.id ? { ...r, agree_count: (r.agree_count || 0) + 1 } : r)));
    setPicked((p) => (p ? { ...p, mark: { ...p.mark, agree_count: (p.mark.agree_count || 0) + 1 } } : p));
    agreeWithMark(mark.id);
  }, []);

  /* §5.3 — a mark can be picked back up and restyled in place, and that is an
     undoable step like any other. */
  const recolour = useCallback((mark, colour) => {
    if (!mark || mark.colour === colour) return;
    remember({ op: "style", id: mark.id, before: { colour: mark.colour }, after: { colour } });
    applyStyle(mark.id, { colour });
  }, [remember, applyStyle]);

  /* ---------------------------------------------------------- the whole window */
  const toggleFull = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch { /* a browser that will not, or a user who said no */ }
  }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  /* PRINTING A PDF MEANS HANDING IT TO THE THING THAT PRINTS PDFs.

     Printing this screen would print a canvas of whichever pages happen to be
     rendered, at screen resolution, with the toolbar. The browser already has
     a print path for PDFs that is correct at any size, so the file goes into a
     hidden frame and that frame is asked to print. If the browser refuses —
     some do, for a cross-origin or sandboxed frame — the file opens in a tab,
     where the same command is one keystroke away and visibly available. */
  const printNow = useCallback(() => {
    if (!url) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    frame.src = url;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { window.open(url, "_blank", "noopener"); }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
  }, [url]);

  /* ------------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.("input, textarea, select")) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "f") { e.preventDefault(); setFindOpen(true); return; }
      if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (cmd && e.key.toLowerCase() === "p") { e.preventDefault(); printNow(); return; }
      if (cmd && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomAbout(stepZoom(scale, 1)); return; }
      if (cmd && e.key === "-") { e.preventDefault(); zoomAbout(stepZoom(scale, -1)); return; }
      if (cmd && e.key === "0") { e.preventDefault(); setFit("width"); return; }
      if (cmd) return;
      if (e.key === "Escape") {
        setComposer(null); setFindOpen(false); setSel(null); setMenu(null);
        setSheet(null); setPicked(null); setAdding(false); setEditing(false);
        /* Below the panel breakpoint it is an overlay, and an overlay
           dismisses (§8.6). Above it, it is the workspace — closing it
           on Escape would throw away a place the reader is working. */
        if (window.innerWidth < 1240) setRail("none");
        return;
      }
      /* One letter per tool — but ONLY for tools on the tray. A key that
         silently switches to something the student took off is the tray not
         meaning anything. */
      /* (tray, key) — the middle argument was v4's tool table, which
         paperTray now takes as an optional last one. Passed positionally it
         became the KEY, so no letter ever matched and every shortcut did
         nothing. */
      const byKey = shortcutFor(tray, e.key);
      if (byKey) { e.preventDefault(); setTool(byKey); return; }
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); turn(1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); turn(-1); }
      if (e.key === "Home") { e.preventDefault(); goToPage(1); }
      if (e.key === "End") { e.preventDefault(); goToPage(sizes.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sizes.length, goToPage, turn, undo, redo, printNow, scale, zoomAbout, tray]);

  /* The raster budget evicts the page furthest from where the reader is
     looking, so it has to be told where that is. */
  useEffect(() => { setRasterFocus(page); }, [page]);

  /* Where you got to, so the Library can offer to put you back. Written on the
     page you settle on rather than on every scroll event. */
  useEffect(() => {
    if (!page || !onPlace) return undefined;
    const t = setTimeout(() => onPlace(page), 600);
    return () => clearTimeout(t);
  }, [page, onPlace]);

  useEffect(() => {
    if (!finds.length) return;
    jumpTo(pageOf(model, finds[Math.min(findAt, finds.length - 1)].start));
    // jumpTo is deliberately not a dependency: it changes with `page`, and
    // depending on it would re-fire this jump every time the page moved.
  }, [findAt, finds, model]);

  /* ---------------------------------------------------------------- render */
  /* Grouped once rather than filtered per page. Filtering the whole mark list
     inside the render of every one of a thousand slots is O(pages x marks) on
     every scroll tick. */
  const notesByPage = useMemo(() => {
    const out = new Map();
    if (!model) return out;
    for (const a of shown) {
      if ((a.kind !== "note" && a.kind !== "question") || !a.body) continue;
      const n = pageOf(model, a.start);
      const row = { ...a, quote: quoteOf(model, a.start, a.end, 120) };
      if (out.has(n)) out.get(n).push(row); else out.set(n, [row]);
    }
    return out;
  }, [shown, model]);
  const notesOnPage = useCallback((n) => notesByPage.get(n) || EMPTY, [notesByPage]);

  const drawing = isInk(tool);
  const totalPages = sizes.length || paper?.pages || 0;

  /* Feed the scrubber. Its handlers are deliberately stable (§11.3) — a
     closure rebuilt on every page change would drop the drag mid-flight —
     so this is the one place they learn how long the paper is, where the
     reader is, and how to move. Without it the scrubber is inert. */
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { jumpToRef.current = jumpTo; }, [jumpTo]);
  const drawSet = useMemo(
    () => new Set(pagesToDraw(layout, page, totalPages)), [layout, page, totalPages],
  );
  /* Which pages are on screen at all. Continuous shows every one; the paged
     layouts show what you turned to, and the spread shows the pair. */
  const onScreen = useMemo(() => {
    if (layout === "scroll") return null;
    if (layout === "spread") return new Set(spreads(totalPages)[spreadOf(page)] || [page]);
    return new Set([page]);
  }, [layout, page, totalPages]);

  const everything = [...placed, ...orphans.map((o) => ({ ...o, status: "orphaned" }))];
  const counts = filterCounts(everything, me);
  const marksList = applyFilter(everything, filter, me);

  /* Which page a height on the rail means — and, if a mark is within a few
     pages of it, that mark's page instead. Aiming roughly at a tick should
     land on it. */
  const pageAtRail = useCallback((y, height) => {
    const raw = Math.max(1, Math.min(totalPages, Math.round((y / Math.max(1, height)) * totalPages)));
    const snap = Math.max(1, Math.round(totalPages / 60));
    const near = ticksRef.current
      .filter((t) => Math.abs(t.page - raw) <= snap)
      .sort((a, b) => Math.abs(a.page - raw) - Math.abs(b.page - raw))[0];
    return near ? near.page : raw;
  }, [totalPages]);

  /* §11.2 — every mark in the whole paper, positioned by page. Yours are drawn
     wider and fully opaque, the module's narrower and lighter, so a manual
     somebody has worked through reads as a used book at a glance. */
  const ticks = useMemo(() => (model ? placed.map((m) => ({
    id: m.id,
    page: pageOf(model, m.start),
    colour: m.colour || null,
    mine: m.author_id === me,
    name: m.colour ? meaning(m.colour).name : "Marked",
  })) : []), [placed, model, me]);
  ticksRef.current = ticks;
  const closeMenus = () => setMenu(null);
  const info = meta?.info || {};

  /* ── the panel's tabs ────────────────────────────────────────────────── */
  const PANELS = useMemo(() => [
    { id: "marks", label: "Marks", icon: "panel" },
    { id: "thumbs", label: "Pages", icon: "grip" },
    { id: "outline", label: "Contents", icon: "rev" },
    { id: "find", label: "Find", icon: "sync" },
    ...(isStaff ? [{ id: "queue", label: "Corrections", icon: "trash" }] : []),
  ], [isStaff]);

  /* The zoom readout names the MODE, never a percentage. "Fit width" is what
     the reader asked for; 118% is a number they have to translate back. */
  const zoomLabel = fit === "width" ? "Fit width"
    : fit === "page" ? "Fit page"
      : fit === "actual" ? "Actual size"
        : `${Math.round(scale * 100)}%`;
  const zoom = useCallback((dir) => { setFit("free"); zoomAbout(stepZoom(scale, dir)); }, [scale, zoomAbout]);

  /* Marks-only groups by meaning, so it needs them the other way round from
     the panel: colour first, then the passages under it. */
  const rowsForColour = useCallback(
    (k) => marksList.filter((m) => colourKey(m.colour) === k),
    [marksList],
  );

  /* ── notes and pins ─────────────────────────────────────────────────────
     A note is a window ON the page, held at a fraction of it. Everything below
     is the same three lines with a different field, so they share one setter
     rather than nine copies of the map. */
  const notesOn = useCallback((n) => notes.filter((x) => x.p === n), [notes]);
  const editNote = useCallback((id, patch) => {
    setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);
  const noteTitle = useCallback((id, v) => editNote(id, { title: v }), [editNote]);
  const noteBody = useCallback((id, v) => editNote(id, { body: v }), [editNote]);
  const noteColour = useCallback((id, k) => editNote(id, { k }), [editNote]);
  const openNote = useCallback((id) => editNote(id, { open: 1 }), [editNote]);
  const shutNote = useCallback((id) => editNote(id, { open: 0 }), [editNote]);
  const dropNote = useCallback((id) => setNotes((all) => all.filter((n) => n.id !== id)), []);
  const dropExcerpt = useCallback((id, i) => {
    setNotes((all) => all.map((n) => (n.id === id
      ? { ...n, exc: (n.exc || []).filter((_, j) => j !== i) } : n)));
  }, []);

  /* Dragging a note by its header. The pointer is captured on the element, so
     a fast drag cannot outrun it and drop the note halfway. */
  const grabNote = useCallback((id, e) => {
    if (e.target.closest?.("button, input, textarea")) return;
    const el = e.currentTarget.closest?.(".note, .pin");
    const pageEl = el?.closest?.(".page");
    if (!pageEl) return;
    try { el.setPointerCapture?.(e.pointerId); } catch { /* not ours */ }
    setDragNote({ id, pageEl, dx: e.clientX, dy: e.clientY });
  }, []);
  useEffect(() => {
    if (!dragNote) return undefined;
    const move = (e) => {
      const r = dragNote.pageEl.getBoundingClientRect();
      editNote(dragNote.id, {
        x: Math.min(0.98, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(0.98, Math.max(0, (e.clientY - r.top) / r.height)),
      });
    };
    const up = () => setDragNote(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragNote, editNote]);

  /* Making a note from a mark's card — the card's own "Note" button. */
  const noteOnMark = useCallback((mark) => {
    const pg = mark.page ?? (model ? pageOf(model, mark.start) : 1);
    setNotes((all) => [...all, {
      id: tempId(), p: pg, x: 0.72, y: 0.3, k: colourKey(mark.colour),
      kind: "note", title: "", body: "", open: 1,
      exc: [{ text: mark.quote || "", page: pg }],
    }]);
    setPicked(null);
  }, [model]);

  /* ── the selection popover ──────────────────────────────────────────────
     Select any text and the five colours plus Note / Ask / Copy appear over
     it. No tool to arm first: this is the single most intuitive thing a reader
     can do, and v4 made it the one thing you could not.

     It opens on pointerup and closes when the selection collapses, which is
     what `selectionchange` is for — polling would fight the caret. */
  const closeSel = useCallback(() => { setSelPop(null); hold(false); }, [hold]);

  /* THE POPOVER IS DRIVEN BY THE SELECTION THE READER ALREADY TRACKS.
     `readSelection` above already turns a DOM Range into offsets in the
     model's text through `locate`, and getting that right — across text runs,
     across pages — was most of the work in this file. Listening a second time
     would be a second answer to the same question, and the two would disagree
     the first time one of them was fixed. */
  useEffect(() => {
    if (!sel || !model) { closeSel(); return; }
    if (sel.end - sel.start < 4) { closeSel(); return; }
    /* An armed marking tool acts on the selection itself (see the effect that
       fires addMark), so the popover would be a second way to do the thing
       that already happened. It is for Select — which is also the tool a
       reader who has never touched the bar is holding. */
    if (tool !== "sel") { closeSel(); return; }
    setSelPop({
      left: sel.x, top: Math.max(8, sel.y - 44),
      start: sel.start, end: sel.end,
      quote: quoteOf(model, sel.start, sel.end),
    });
    hold(true);
  }, [sel, model, tool, hold, closeSel]);

  const clearSel = useCallback(() => {
    try { window.getSelection()?.removeAllRanges(); } catch { /* nothing to clear */ }
    closeSel();
  }, [closeSel]);

  const markSelection = useCallback((k) => {
    if (!selPop) return;
    addMark({ kind: kindOf(tool) && marksText(tool) ? kindOf(tool) : "highlight",
      start: selPop.start, end: selPop.end, colour: k });
    clearSel();
  }, [selPop, tool, addMark, clearSel]);

  /* Note and Ask open their widget WITH THE PASSAGE ALREADY IN IT. The
     passage is the reason you are writing the note. */
  const takeFromSelection = useCallback((kind) => {
    if (!selPop || !model) return;
    const pg = pageOf(model, selPop.start);
    setNotes((all) => [...all, {
      id: tempId(), p: pg, x: 0.7, y: 0.28,
      k: kind === "question" ? "p" : ck,
      kind, title: "", body: "", open: 1, anon: kind === "question",
      exc: [{ text: selPop.quote, page: pg }],
    }]);
    clearSel();
  }, [selPop, model, ck, clearSel]);

  const copySelection = useCallback(() => {
    if (!selPop) return;
    try { navigator.clipboard?.writeText(selPop.quote); } catch { /* denied */ }
    setToast("Copied.");
    clearSel();
  }, [selPop, clearSel]);

  /* ── drag a mark into a note ────────────────────────────────────────────
     The one that makes people sit up, and the reason is that it is the whole
     workflow for anybody building a question bank: read, mark, drag the good
     ones into a note, and the note is the draft.

     Four steps, and the second is the one that matters. A pointerdown on a
     marked sentence only ARMS it — the drag does not start until the pointer
     has moved 8px, because starting on pointerdown would mean every tap on a
     mark to open its card began by picking the mark up. */
  const arm = useRef(null);
  const [ghost, setGhost] = useState(null);
  /* The listener below is bound once and never rebuilt — rebinding it on every
     pointermove is how a drag ends up handled twice — so what it needs about
     the drop target comes through a ref rather than a closure. */
  const dropOnRef = useRef(null);
  useEffect(() => { dropOnRef.current = dropOn; }, [dropOn]);

  const armDrag = useCallback((e) => {
    if (tool !== "sel" || !model) return;
    const hit = markAt(e.clientX, e.clientY);
    if (!hit) return;
    arm.current = {
      mark: hit, x: e.clientX, y: e.clientY, live: false,
      quote: quoteOf(model, hit.start, hit.end),
      page: pageOf(model, hit.start),
    };
  }, [tool, model, markAt]);

  useEffect(() => {
    const move = (e) => {
      const a = arm.current;
      if (!a) return;
      if (!a.live) {
        if (Math.hypot(e.clientX - a.x, e.clientY - a.y) < 8) return;
        a.live = true;
        hold(true);
        /* A drag is not a selection. Without this the browser paints its own
           blue over the passage the whole way across the screen. */
        try { window.getSelection()?.removeAllRanges(); } catch { /* nothing to clear */ }
      }
      setGhost({ x: e.clientX, y: e.clientY, text: a.quote });
      /* What is under the pointer — not what the pointer started on. The
         ghost itself is pointer-events:none, so it never finds itself. */
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under?.closest?.(".note, .pin");
      setDropOn(target?.dataset?.note || null);
    };
    const up = () => {
      const a = arm.current;
      arm.current = null;
      if (!a?.live) return;
      hold(false);
      setGhost(null);
      const onto = dropOnRef.current;
      setDropOn(null);
      if (!onto) return;
      setNotes((all) => all.map((n) => (n.id === onto
        ? { ...n, open: 1, exc: [...(n.exc || []), { text: a.quote, page: a.page }] }
        : n)));
      setToast(`Added to the note, with p.${a.page}.`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [hold]);

  /* WHAT HOLDS THE CHROME OPEN. Every surface that is up because the reader
     put it up: the properties popover, the tool chest, the panel, a menu, the
     selection popover, an open note. The counter is what makes this safe to
     write as one effect — two of them can be up at once, and with a boolean
     the second to close would have released a hold the first still wanted. */
  const openSurfaces = (inspOpen ? 1 : 0) + (adding ? 1 : 0) + (editing ? 1 : 0)
    + (menu ? 1 : 0) + (sheet ? 1 : 0) + (rail && rail !== "none" ? 1 : 0)
    + (picked ? 1 : 0) + (notes.some((n) => n.open) ? 1 : 0);
  useEffect(() => {
    if (!openSurfaces) { wake(); return undefined; }
    hold(true);
    return () => hold(false);
  }, [openSurfaces, hold, wake]);

  /* ── the first-run coach ────────────────────────────────────────────────
     Three quiet hints at the three things that are not discoverable by
     looking. Dismissed by the button or after fourteen seconds, and the fact
     is stored so they never come back. */
  const coachAt = useMemo(() => {
    if (coach < 0 || coach > 2) return null;
    if (coach === 0) return bar === "right" ? { right: 76, top: "44%" } : { left: 76, top: "44%" };
    if (coach === 1) return side === "right" ? { right: 34, top: 96 } : { left: 34, top: 96 };
    return { left: "50%", bottom: 44, transform: "translateX(-50%)" };
  }, [coach, bar, side]);
  const nextCoach = useCallback(() => {
    setCoach((n) => {
      const next = n + 1;
      if (next > 2) { write("pw-reader-coached", "1"); return -1; }
      return next;
    });
  }, []);
  useEffect(() => {
    if (coach < 0 || coach > 2) return undefined;
    const t = setTimeout(nextCoach, 14000);
    return () => clearTimeout(t);
  }, [coach, nextCoach]);

  if (!paper || !host) return null;

  /* THE READER FOLLOWS THE APP, and the reading light is a change ON TOP of
     it rather than a second theme.

     `data-look` decides which of the shipped palettes is in force. Defaulting
     it to "paper" meant the reader opened light inside a night app — the whole
     screen disagreeing with the one it came from. It takes the app's variant
     unless the reader's own light has been set to something that overrides it:
     Warm and Paper are light, Dim and Night are dark. */
  /* v5 HAS TWO GROUNDS, dark and light, and that is the whole of `data-look`.
     v4's four reading lights were four grounds AND four raster filters at
     once; v5 keeps the filter on the picture (see PaperPage) and gives the
     surround two states, because a surround that is the brightest thing on
     screen is the bug either way. "Follow" is still the default and still
     means the app's own variant, so a reader who never opens the light menu
     gets the theme the rest of the app is wearing. */
  const look = light === "dark" || light === "night" || light === "dim" ? "dark"
    : light === "light" || light === "paper" || light === "sepia" ? "light"
      : appVariant === "day" ? "light" : "dark";

  return createPortal(
    /* ONE ROOT, CARRYING THE STATE AS DATA ATTRIBUTES — COMPONENTS.md v5's own
       list, in its own order. The stylesheet reads these; nothing here is
       duplicated as a class, and no layout decision is taken in JS beyond
       setting them. */
    <div className="rdr" ref={shellRef}
         style={accent ? {
           "--lv": accent,
           "--accent-soft": `color-mix(in srgb, ${accent} 18%, transparent)`,
         } : undefined}
         data-look={look}
         data-plat={plat}
         data-ctx={ctx}
         data-bar={bar}
         data-side={side}
         data-mode={mode}
         data-tool={tool}
         data-mark={marksText(tool) ? "1" : "0"}
         data-chrome={chromeOn ? "on" : "off"}
         data-edit={editing ? "1" : "0"}
         onPointerMove={wake}
         onPointerDown={wake}
         onKeyDown={wake}>

      {/* ── the document ─────────────────────────────────────────────── */}
      <div className="stage" ref={scrollRef} onScroll={onScroll}
           onClick={tapToMark} onPointerUp={tapToMark} onPointerDown={armDrag}>
        {error && <p className="rdr-err">{error}</p>}

        <div className="stack" style={{ gap: PAGE_GAP }}>
          {win[0] > 0 && <div className="rdr-gap" style={{ height: offsets[win[0]] }} aria-hidden="true" />}
          {sizes.slice(win[0], win[1]).map((s, k) => {
            const i = win[0] + k;
            const n = i + 1;
            const rotated = rotation % 180 !== 0;
            const w = (rotated ? s.h : s.w) * scale;
            const h = (rotated ? s.w : s.h) * scale;
            const hidden = onScreen ? !onScreen.has(n) : false;
            if (hidden) return null;

            return drawSet.has(n) ? (
              <PaperPage
                key={n}
                doc={doc} model={model} pageNumber={n} scale={scale} rotation={rotation} size={s}
                segments={drawSegments} activeId={activeId} light={look}
                strokes={strokes} me={me}
                inkTool={drawing ? tool : null} inkColour={INK_OF[ck] || "blue"}
                inkWidth={penWidth(size) * (tool === "mkr" ? 3.2 : 1)}
                onInk={addStroke} onErase={eraseStrokes}
                onPenDown={() => { setPenDown(true); setChromeOn(false); }}
                onPenUp={() => setPenDown(false)}
                registerEl={registerEl} onDivs={takeDivs}
                notes={notesOn(n)} dropOn={dropOn}
                onNoteGrab={grabNote} onNoteOpen={openNote} onNoteClose={shutNote}
                onNoteTitle={noteTitle} onNoteBody={noteBody} onNoteColour={noteColour}
                onNoteDelete={dropNote} onNoteExcRemove={dropExcerpt}
              />
            ) : (
              /* §4.1 — NEVER a bare white box. A page-shaped card at the right
                 ratio, its number quietly in the gutter, so the scroll height
                 is right before any PDF byte arrives. */
              <article className="page ph" key={n} data-page={n}
                       style={{ width: w, height: h }}
                       ref={(el) => { if (el) pageEls.current.set(n, el); }}>
                <span className="pnum">{n}</span>
                <span>Page {n}</span>
              </article>
            );
          })}
          {win[1] < sizes.length && (
            <div className="rdr-gap" aria-hidden="true"
                 style={{ height: Math.max(0, offsets[sizes.length] - offsets[win[1]]) }} />
          )}
        </div>
      </div>

      {/* ── the logo: pinned, and the one thing that never fades ─────── */}
      <button type="button" className="logo" aria-label="Wingman — Flight Deck" onClick={onBack}>
        <Icon name="logo" />
        <b>Wingman</b>
      </button>

      {/* ── the document's name, floating centre-top ─────────────────── */}
      <div className="chrome glass docbar">
        <button type="button" className="doc" onClick={() => setSheet("details")}>
          <b>{paper?.title || "Paper"}</b>
          <em>{[moduleCode, paper?.id].filter(Boolean).join(" · ")}</em>
        </button>
      </div>

      {/* ── actions, top-right ───────────────────────────────────────── */}
      <div className="chrome glass acts">
        <button type="button" className="ic courseonly" aria-label="Check for new marks"
                onClick={refreshNow}>
          <Icon name="sync" className={refreshing ? "is-spinning" : undefined} />
          {freshMarks && <span className="badge" />}
        </button>
        <button type="button" className={`ic${mode === "rev" ? " on" : ""}`} aria-label="Marks only"
                onClick={() => setMode(mode === "rev" ? "read" : "rev")}>
          <Icon name="rev" />
        </button>
        <button type="button" className={`ic${rail && rail !== "none" ? " on" : ""}`} aria-label="Panel"
                onClick={() => setRail(rail && rail !== "none" ? "none" : "marks")}>
          <Icon name="panel" />
        </button>
        <button type="button" className="ic" aria-label="Reading light"
                onClick={() => setLight(look === "dark" ? "light" : "dark")}>
          <Icon name="look" />
        </button>
        <button type="button" className={`ic${menu === "more" ? " on" : ""}`} aria-label="More"
                onClick={() => setMenu(menu === "more" ? null : "more")}>
          <Icon name="more" />
        </button>
      </div>

      {/* ── the tool bar — four positions, and the panel always opposite ─ */}
      <div className="chrome glass tools" ref={dockRef}
           onPointerDown={onDockPointerDown} onPointerUp={onDockPointerUp}
           onPointerLeave={onDockPointerUp} onPointerCancel={onDockPointerUp}>
        <button type="button" className={`chest${adding ? " on" : ""}`} aria-label="Tool chest"
                onClick={() => { setAdding(!adding); setInspOpen(false); }}>
          <Icon tool="chest" size={21} />
          <span className="tip">Tool chest</span>
        </button>
        <div className="railsep" />
        {tray.map((id) => {
          const spec = T(id);
          /* `fixed` counts as having a colour. Question is fixed to purple —
             a question is a question whatever is in your hand — and it has no
             `c` flag because there is nothing to PICK, not because there is
             nothing to paint. Without this it drew in currentColor: a plain
             white disc where the reference has a purple one. */
          const paint = spec.c || spec.fixed
            ? col(spec.fixed || tcol[id] || "y").hex : undefined;
          return (
            <button key={id} type="button"
                    className={`t${tool === id ? " on" : ""}${LOCKED.includes(id) ? " lock" : ""}`}
                    data-tool={id} draggable aria-label={spec.n} aria-pressed={tool === id}
                    onClick={() => pickTool(id)}
                    onDragStart={() => (dragId.current = id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); dropTool(id); }}>
              <Icon tool={id} colour={paint} size={21} />
              {spec.p && <span className="cnt">{spec.p}</span>}
              <span className="x" role="button" tabIndex={-1} aria-label={`Remove ${spec.n}`}
                    onClick={(e) => { e.stopPropagation(); dropFromTray(id); }}>×</span>
              <span className="tip">{spec.n}<kbd>{spec.k}</kbd></span>
            </button>
          );
        })}
        <div className="railsep" />
        <button type="button" className="addb" aria-label="Add a tool"
                onClick={() => { setAdding(!adding); setInspOpen(false); }}>
          <Icon name="add" size={19} />
          <span className="tip">Add a tool</span>
        </button>
        {editing && (
          <button type="button" className="collapse" aria-label="Done"
                  onClick={() => setEditing(false)}>
            <Icon name="close" size={17} />
            <span className="tip">Done</span>
          </button>
        )}
      </div>

      <Props
        open={inspOpen && !adding && !editing && T(tool)?.id !== "sel"}
        tool={tool} variant={variant[tool] || 0}
        colourKey={T(tool)?.fixed || ck} size={size} opacity={alpha}
        inkOnly={inkOnly} ctx={ctx}
        onVariant={pickVariant} onColour={pickColour} onSize={pickSize}
        onOpacity={pickAlpha} onInkOnly={setInkOnly} onReset={resetTool}
        onClose={() => setInspOpen(false)}
      />

      <Chest
        open={adding} tray={tray} cap={cap} bar={bar} ctx={ctx}
        colourOf={(id) => col(T(id)?.fixed || tcol[id] || "y").hex}
        onAdd={pushTool}
        onReset={() => { setTray([...DEF]); saveTray(plat, [...DEF]); }}
        onBar={setBar}
        onClose={() => setAdding(false)}
      />

      {/* ── corners ──────────────────────────────────────────────────── */}
      <div className="chrome glass corner-ul">
        <button type="button" className="ic" aria-label="Undo" disabled={!canUndo}
                title={canUndo ? "Undo" : "Nothing to undo yet"} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="ic" aria-label="Redo" disabled={!canRedo}
                title={canRedo ? "Redo" : "Nothing to redo yet"} onClick={redo}>
          <Icon name="redo" />
        </button>
      </div>

      <div className="chrome glass corner-z">
        <button type="button" className="ic" aria-label="Zoom out" onClick={() => zoom(-1)}>
          <Icon name="zoomOut" size={15} />
        </button>
        {/* The mode NAME, never a percentage — "Fit width" is what the reader
            asked for and 118% is a number they have to translate. */}
        <span className="v">{zoomLabel}</span>
        <button type="button" className="ic" aria-label="Zoom in" onClick={() => zoom(1)}>
          <Icon name="zoomIn" size={15} />
        </button>
      </div>

      {/* ── the mark card, and the selection popover that is not it ───── */}
      <Card
        mark={picked?.mark} me={me} at={picked?.at} ctx={ctx}
        onRecolour={recolour} onDelete={removeMark} onNote={noteOnMark}
        onAgree={agree} onThread={onOpenThread}
        onHold={holdCard} onLeave={leaveCard}
      />
      <SelPop
        at={selPop} ctx={ctx}
        onColour={markSelection} onNote={() => takeFromSelection("note")}
        onAsk={() => takeFromSelection("question")} onCopy={copySelection}
      />

      {/* ── the tick rail: every mark in the paper, by page ───────────── */}
      {ticks.length > 0 && totalPages > 1 && (
        <div className="chrome rail courseonly" title="Your marks across this paper"
             role="button" tabIndex={0}
             onPointerMove={(e) => {
               const r = e.currentTarget.getBoundingClientRect();
               setRailAt({ y: e.clientY - r.top, page: pageAtRail(e.clientY - r.top, r.height) });
             }}
             onPointerLeave={() => setRailAt(null)}
             onKeyDown={(e) => { if (e.key === "Enter") jumpTo(page); }}
             onClick={(e) => {
               const r = e.currentTarget.getBoundingClientRect();
               jumpTo(pageAtRail(e.clientY - r.top, r.height));
             }}>
          <div className="trk" />
          <div className="now" style={{ top: `${((page - 0.5) / totalPages) * 100}%` }} />
          {ticks.map((t) => (
            <div key={t.id} className={`tk${t.mine ? " mine" : ""}`} data-page={t.page}
                 style={{ top: `${((t.page - 0.5) / totalPages) * 100}%`,
                          "--k": col(colourKey(t.colour)).hex }} />
          ))}
        </div>
      )}
      {railAt && (
        <div className="chrome glass pop railtip on"
             style={{ top: railAt.y + 74, "--k": col(colourKey(ticks.find((t) => t.page === railAt.page)?.colour)).hex }}>
          <b>{ticks.find((t) => t.page === railAt.page)?.name || "Page"}</b>
          <em>p.{railAt.page}</em>
        </div>
      )}

      {/* ── the panel, always opposite the bar ────────────────────────── */}
      <div className={`glass pop panel${rail && rail !== "none" ? " open" : ""}`}
           onPointerEnter={() => hold(true)} onPointerLeave={() => hold(false)}>
        <div className="ptabs" role="tablist" aria-label="What the panel shows">
          {PANELS.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={rail === p.id}
                    className={`pt${rail === p.id ? " on" : ""}`} aria-label={p.label}
                    title={p.label} onClick={() => setRail(p.id)}>
              <Icon name={p.icon} size={16} />
            </button>
          ))}
          <span className="sp" />
          <button type="button" className="pt" aria-label="Close the panel"
                  onClick={() => setRail("none")}>
            <Icon name="close" size={15} />
          </button>
        </div>

        {rail === "marks" && (
          <>
            <div className="filters">
              {FILTERS.map((f) => {
                const n = counts[f.id] || 0;
                if (!n && f.id !== "all") return null;
                return (
                  <button key={f.id} type="button" className={`f${filter === f.id ? " on" : ""}`}
                          aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                    {n > 0 && f.id !== "all" && (
                      <>{" "}<span style={{ color: col(colourKey(f.id)).hex }}>{n}</span></>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Which page the list is standing on. The shipped `.pchip` — one
                line, centred, so a long list still says where you are. */}
            {marksList.length > 0 && (
              <span className="pchip">
                {marksList.length} {marksList.length === 1 ? "mark" : "marks"} in this paper
              </span>
            )}
            <div className="pbody">
              {marksList.length ? (() => {
                const out = [];
                let last = null;
                for (const m of marksList) {
                  const pg = model ? pageOf(model, m.start) : 0;
                  if (pg !== last) { out.push(<div className="gh" key={`h${pg}`}>Page {pg}</div>); last = pg; }
                  const c = col(colourKey(m.colour));
                  out.push(
                    <div className="row" key={m.id} style={{ "--k": c.hex }} role="button" tabIndex={0}
                         onClick={() => { setActiveId(m.id); jumpTo(pg); }}
                         onKeyDown={(e) => e.key === "Enter" && (setActiveId(m.id), jumpTo(pg))}>
                      <div className="bar" />
                      <div>
                        <div className="t2">
                          <b>{ctx === "course" ? c.course : c.name}</b>
                          <em>p.{pg}</em>
                        </div>
                        <p>{m.quote}</p>
                        <div className="meta">{m.author_id === me ? "You" : (m.anonymous ? "Anonymous" : m.author_name)}</div>
                      </div>
                    </div>,
                  );
                }
                /* R11 — A MARK THAT LOST ITS PLACE IS LISTED, NEVER DROPPED.
                   `resolveAnchor` returns null rather than guessing, which is
                   the right call: a mark in the wrong place cannot be spotted
                   by the person reading it. But a mark that silently stops
                   existing is worse than one that says it is lost, so the ones
                   that could not be found go at the end with what they said. */
                if (orphans.length > 0 && filter === "all") {
                  out.push(<div className="gh" key="hlost">Lost their place</div>);
                  for (const o of orphans) {
                    out.push(
                      <div className="row" key={o.id} style={{ "--k": "var(--txt-3)" }}>
                        <div className="bar" />
                        <div>
                          <div className="t2"><b>Lost its place</b></div>
                          <p>{o.anchor?.quote || "This passage is no longer in the paper."}</p>
                          <div className="meta">
                            The words it was on are not in this version. It is kept, not deleted.
                          </div>
                        </div>
                      </div>,
                    );
                  }
                }
                return out;
              })() : (
                /* A drawing and one useful line, never an apology. */
                <div className="blank">
                  <Icon name="panel" size={38} />
                  {filter === "all"
                    ? "Nobody has marked this one up yet. Select a line and yours will be the first."
                    : "Mark a sentence with this meaning and it lands here, with its page and its sentence."}
                </div>
              )}
            </div>
          </>
        )}

        {rail === "thumbs" && (
          <PaperThumbs doc={doc} pages={totalPages} current={page} onPick={jumpTo}
                       boxes={paper?.manifest?.boxes}
                       thumbSrc={paper?.manifest ? (n) => thumbUrl(paper, n) : null} />
        )}

        {rail === "outline" && (
          <div className="pbody"><PaperOutline doc={doc} onPick={jumpTo} /></div>
        )}

        {rail === "find" && (
          <>
            <div className="srch">
              <Icon name="sync" size={15} />
              <input value={query} placeholder="Find in this paper" aria-label="Find in this paper"
                     onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="pbody">
              {finds.length ? finds.map((f, i) => (
                <div className="row" key={i} role="button" tabIndex={0}
                     style={{ "--k": "var(--txt-3)" }}
                     onClick={() => { setFindAt(i); jumpTo(pageOf(model, f.start)); }}
                     onKeyDown={(e) => e.key === "Enter" && (setFindAt(i), jumpTo(pageOf(model, f.start)))}>
                  <div className="bar" />
                  <div>
                    <div className="t2"><b>Page {pageOf(model, f.start)}</b></div>
                    <p>{quoteOf(model, Math.max(0, f.start - 30), f.end + 30)}</p>
                  </div>
                </div>
              )) : (
                <div className="blank">
                  {query ? "Nothing in this paper matches that. Try a shorter phrase."
                    : "Type a phrase and every page carrying it lands here."}
                </div>
              )}
            </div>
          </>
        )}

        {rail === "queue" && isStaff && (
          <div className="pbody">
            {queue.length ? queue.map((c) => (
              <div className="row" key={c.id} style={{ "--k": col("r").hex }}>
                <div className="bar" />
                <div>
                  <div className="t2"><b>Correction</b><em>{c.author_name}</em></div>
                  <p>{c.body}</p>
                  <div className="meta">
                    <button type="button" className="f" onClick={async () => {
                      await resolveCorrection(c.id); loadQueue();
                    }}>Done with it</button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="blank">
                Nothing reported on this module yet. A student who spots something
                wrong can tell you from the passage itself.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── the scrubber along the bottom edge ────────────────────────── */}
      <div className={`chrome scrub${scrub ? " live" : ""}`}
           onPointerDown={scrubDown} onPointerMove={scrubMove}
           onPointerUp={scrubUp} onPointerCancel={scrubUp}>
        <div className="line" />
        <div className="fill" style={{ width: `${((page - 0.5) / Math.max(1, totalPages)) * 100}%` }} />
        <div className="knob" style={{ left: `${((page - 0.5) / Math.max(1, totalPages)) * 100}%` }} />
        <div className="glass read" style={{ left: `${(((scrub?.page ?? page) - 0.5) / Math.max(1, totalPages)) * 100}%` }}>
          {scrub?.page ?? page}<em>of {totalPages}</em>
        </div>
      </div>

      {/* ── the scrubber's card, while you are dragging it ────────────── */}
      {scrub && (
        <div className="glass pop scard open"
             style={{ left: `${((scrub.page - 0.5) / Math.max(1, totalPages)) * 100}%` }}>
          <div className="th2">
            <i className="h" /><i /><i /><i className="m" /><i /><i />
          </div>
          <div className="mt">
            <b>{scrub.page}</b>
            <span>of {totalPages}</span>
            {(() => {
              const near = ticks.filter((t) => Math.abs(t.page - scrub.page) <= 2).length;
              return near > 0 ? <u>{near} {near === 1 ? "mark" : "marks"} near here</u> : null;
            })()}
          </div>
        </div>
      )}

      {/* ── the way back, after any jump ──────────────────────────────── */}
      {cameFrom && cameFrom.page !== page && (
        <div className="chrome glass pop backp open">
          <b>Back to page {cameFrom.page}</b>
          <button type="button" className="ic" aria-label="Go back"
                  onClick={() => {
                    goToPage(cameFrom.page);
                    if (scrollRef.current && cameFrom.top != null) scrollRef.current.scrollTop = cameFrom.top;
                    setCameFrom(null);
                  }}>
            <Icon name="back" size={15} />
          </button>
        </div>
      )}

      {/* ── marks only ───────────────────────────────────────────────── */}
      <div className="rev">
        <div className="revw">
          <div className="revh">
            <div>
              <h2>Marks only</h2>
              <p>
                {marksList.length
                  ? (() => {
                      const pages = new Set(marksList.map((m) => (model ? pageOf(model, m.start) : 0))).size;
                      return `${marksList.length} ${marksList.length === 1 ? "passage" : "passages"} `
                        + `across ${pages} ${pages === 1 ? "page" : "pages"}.`;
                    })()
                  : "Mark a passage and it appears here, grouped by what the colour does."}
              </p>
            </div>
            <button type="button" className="ic" aria-label="Back to the paper"
                    style={{ background: "var(--fill)" }} onClick={() => setMode("read")}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="revf">
            <button type="button" className={`f${filter === "all" ? " on" : ""}`}
                    onClick={() => setFilter("all")}>Everything</button>
            {COL.map((c) => {
              const n = rowsForColour(c.k).length;
              if (!n) return null;
              return (
                <button key={c.k} type="button" className={`f${filter === c.k ? " on" : ""}`}
                        onClick={() => setFilter(c.k)}>
                  {ctx === "course" ? c.course : c.name}{" "}
                  <span style={{ color: c.hex }}>{n}</span>
                </button>
              );
            })}
          </div>
          <div>
            {COL.map((c) => {
              const group = rowsForColour(c.k).filter(
                (m) => filter === "all" || filter === c.k,
              );
              if (!group.length) return null;
              return (
                <div className="rgrp" key={c.k}>
                  <div className="rgh" style={{ "--k": c.hex }}>
                    <i /><b>{ctx === "course" ? c.course : c.name}</b>
                    <em>{group.length} {group.length === 1 ? "passage" : "passages"}</em>
                  </div>
                  {group.map((m) => {
                    const pg = model ? pageOf(model, m.start) : 0;
                    return (
                      <div className="rcard" key={m.id} data-id={m.id} data-p={pg}
                           style={{ "--k": c.hex }} role="button" tabIndex={0}
                           onClick={() => { setMode("read"); setActiveId(m.id); jumpTo(pg); }}
                           onKeyDown={(e) => e.key === "Enter" && (setMode("read"), setActiveId(m.id), jumpTo(pg))}>
                        <div className="st" />
                        <p>{m.quote}</p>
                        <span className="pg">p.{pg}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* The passage, following the pointer. Fixed rather than absolute: it
          has to be able to leave the page it came from. */}
      {ghost && (
        <div className="ghost" style={{ left: ghost.x + 14, top: ghost.y + 14 }}>
          {ghost.text}
        </div>
      )}

      {/* ── the toast, and the first-run coach ────────────────────────── */}
      {toast && <div className="glass pop toast open">{toast}</div>}
      <Coach step={coach} at={coachAt} onDone={nextCoach} />

    </div>,
    host,
  );
}