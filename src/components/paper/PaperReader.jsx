import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, ChevronRight, ChevronDown, Search, X, Minus, Plus,
  RotateCw, RotateCcw, Download, Printer, PanelLeft, Highlighter, MessageSquare,
  HelpCircle, Flag, Trash2, RefreshCw, MousePointer2, MoreHorizontal, Check,
  Pen, Eraser, Underline, Strikethrough, Maximize2, Minimize2, Info, Keyboard,
  Eye, EyeOff,
  Rows3, Square, Columns2, Sun, Undo2, Redo2, Users, ThumbsUp, Plus as PlusIcon, Type, Ruler, Stamp, Shapes,
} from "lucide-react";
import { loadPaper, releasePaper, paperText, quoteOf, pageOf, PDFJS_VERSION } from "../../lib/paperText.js";
import { setRasterFocus } from "../../lib/rasterBudget.js";
import {
  resolveAll, segmentsFor, anchorFor, mergeRows, sentenceAround,
  applyFilter, FILTERS, filterCounts, RINGS, ringLabel, DOCKS, TOOL_SIZES,
} from "../../lib/paperMarks.js";
import { MEANINGS, meaning, threadState, takesMeaning, meaningOr, DEFAULT_MEANING } from "../../lib/meanings.js";
import {
  DEFAULT_TRAY, LOCKED, GROUPS, capFor, loadTray, saveTray,
  addTool, removeTool, moveTool, shortcutFor,
} from "../../lib/paperTray.js";
import {
  INK_COLOURS, PEN_SIZES, penWidth,
  DEFAULT_HIGHLIGHT, DEFAULT_PEN, DEFAULT_PEN_SIZE,
} from "../../lib/paperInk.js";
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
import PaperPage from "./PaperPage.jsx";
import PaperThumbs from "./PaperThumbs.jsx";
import PaperOutline from "./PaperOutline.jsx";
import "./paper.css";

/* =============================================================================
   THE PAPER READER

   The layout is the one every reader already knows, because a student opening a
   handout should not have to learn anything: a slim bar across the top, a rail
   of tools down one side, a panel of pages and contents, and the document
   itself taking every pixel that is left.

   Three references, and each answers a different question:

     Edge      the document controls belong in ONE slim bar, and everything
               that is not reached every minute belongs behind a menu.
     Drawboard the marking tools belong in a rail, and the armed tool's
               properties belong beside it — not in a third horizontal band.
     Preview   the page floats on the ground with nothing around it, and the
               chrome gets out of the way the moment you stop touching it.

   What is NOT the familiar reader: there is no margin rail of comments. Notes
   open in the flow, under the page they belong to, on a phone and on a desktop
   alike (R6). A rail would have meant two layouts and a column of orphaned
   speech bubbles pointing at nothing.
   ========================================================================= */

/* THE TOOLS, IN FOUR GROUPS.

   Grouped and not listed, because ten buttons in a column is a menu wearing a
   rail's clothes. The groups are the four things a person does to a document:
   point at it, mark the words, draw on it, and say something about it.

   `ink` marks a tool that draws freehand rather than acting on a selection —
   the text layer stops taking pointer events while one is armed, or the first
   stroke would come out as a text selection. */
const TOOLS = [
  { id: "select", group: 0, label: "Select", key: "V", hint: "Drag to select. The bar that appears offers everything below." },
  { id: "highlight", group: 1, label: "Highlight", key: "H", hint: "Select any line and it is marked. Nothing to type.", colour: "hl" },
  { id: "underline", group: 1, label: "Underline", key: "U", hint: "A line under the words, in the colour you pick.", colour: "hl" },
  { id: "strikethrough", group: 1, label: "Strike through", key: "S", hint: "A line through the words, for what no longer applies.", colour: "hl" },
  { id: "pen", group: 2, label: "Pen", key: "P", hint: "Draw anywhere on the page.", ink: true, colour: "pen", size: true },
  { id: "marker", group: 2, label: "Marker", key: "M", hint: "A broad translucent nib, over the words.", ink: true, colour: "pen", size: true },
  { id: "eraser", group: 2, label: "Eraser", key: "E", hint: "Touch a stroke you drew and it goes.", ink: true },
  { id: "note", group: 5, label: "Note", key: "N", hint: "Tap a line, or select one. Write what you want to remember.", ring: true },
  { id: "question", group: 5, label: "Question", key: "Q", hint: "Tap a line, or select one. It opens a thread in the Ready Room.", ring: true },
  { id: "correction", group: 5, label: "Correction", key: "C", hint: "Select what is wrong. Only the author ever sees it." },
  /* On the tray only if a student adds them. Nothing is unreachable — the Add
     sheet always lists the full set — but nothing is on the rail by default
     that most people will never touch. */
  { id: "shape", group: 3, label: "Shape", key: "R", hint: "Line, arrow, box or circle.", colour: "pen", size: true },
  { id: "text", group: 3, label: "Text box", key: "T", hint: "Type on the page.", colour: "pen" },
  { id: "measure", group: 3, label: "Measure", key: "K", hint: "Calibrate once, then measure." },
  { id: "stamp", group: 4, label: "Sign off", key: "G", hint: "An inspection seal with your code on it." },
];
const TOOL_ICONS = {
  select: <MousePointer2 size={17} aria-hidden="true" />,
  highlight: <Highlighter size={17} aria-hidden="true" />,
  underline: <Underline size={17} aria-hidden="true" />,
  strikethrough: <Strikethrough size={17} aria-hidden="true" />,
  pen: <Pen size={17} aria-hidden="true" />,
  marker: <Highlighter size={17} aria-hidden="true" />,
  eraser: <Eraser size={17} aria-hidden="true" />,
  note: <MessageSquare size={17} aria-hidden="true" />,
  shape: <Shapes size={17} aria-hidden="true" />,
  text: <Type size={17} aria-hidden="true" />,
  measure: <Ruler size={17} aria-hidden="true" />,
  stamp: <Stamp size={17} aria-hidden="true" />,
  question: <HelpCircle size={17} aria-hidden="true" />,
  correction: <Flag size={17} aria-hidden="true" />,
};
/* THE TRAY IS BUILT, NOT SHIPPED. See lib/paperTray.js.

   What follows is the note from before the tray existed, kept because the
   arithmetic is why the tray exists at all:

   TEN TOOLS IN A COLUMN IS 659px OF RAIL, and this window is 720px tall.

   Every button in this app is at least 44px on its shortest side — §12, enforced
   globally in App.jsx because it had leaked in eleven places — so a single
   column of ten leaves the document eight pixels. The answer is not to shrink
   the buttons, because 44px is a finger and fingers have not got smaller. It is
   to stop insisting on one column: the rail runs two abreast, group by group,
   which is what Drawboard's own rail does once it has more than a handful. Ten
   tools, four groups, seven rows, and the hit targets untouched. */
const TEXT_MARKS = new Set(["highlight", "underline", "strikethrough"]);
const INK_TOOLS = new Set(["pen", "marker", "eraser"]);
const WRITTEN = new Set(["note", "question", "correction"]);
const toolAt = (id) => TOOLS.find((t) => t.id === id) || TOOLS[0];

const PAGE_GAP = 24;      // brief 4.3 — a sheet reads as a sheet
const EMPTY = [];
const tempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private */ } };

/* ---------------------------------------------------------------------------
   The bar that appears over a selection. R5: the first and largest control is
   the highlight, and it needs nothing typed. Everything after it is one tap
   further away, in the order people reach for them.
   ------------------------------------------------------------------------ */
function SelectionBar({ at, colour, onHighlight, onUnderline, onStrike, onNote, onAsk, onCorrect, canCorrect }) {
  if (!at) return null;
  return (
    <div className="selbar" style={{ left: at.x, top: at.y }} role="toolbar" aria-label="Mark this passage">
      <button type="button" className="selbar-main" onClick={onHighlight} data-colour={colour}>
        <Highlighter size={16} aria-hidden="true" /> Highlight
      </button>
      <button type="button" className="selbar-ico" onClick={onUnderline} aria-label="Underline">
        <Underline size={15} aria-hidden="true" />
      </button>
      <button type="button" className="selbar-ico" onClick={onStrike} aria-label="Strike through">
        <Strikethrough size={15} aria-hidden="true" />
      </button>
      <span className="selbar-rule" aria-hidden="true" />
      <button type="button" className="selbar-act" onClick={onNote}>
        <MessageSquare size={15} aria-hidden="true" /> Note
      </button>
      <button type="button" className="selbar-act" onClick={onAsk}>
        <HelpCircle size={15} aria-hidden="true" /> Ask
      </button>
      {canCorrect && (
        <button type="button" className="selbar-act" onClick={onCorrect}>
          <Flag size={15} aria-hidden="true" /> Correction
        </button>
      )}
    </div>
  );
}

/* THE PROPERTIES TRAY — Drawboard's idea, and the reason this screen has one
   toolbar instead of three.

   The armed tool's settings appear beside the rail and nowhere else. A
   highlighter has a colour; a pen has a colour and a nib; an eraser has a size;
   a note has an audience; the pointer has nothing at all and the tray is simply
   absent. A permanent properties strip would have to show all of those at once,
   which means showing six controls that do nothing to the tool in your hand.

   It floats over the document rather than taking a band of its own, because
   every pixel this screen spends on furniture is a pixel of paper. */
function Swatches({ value, onPick, label, set = INK_COLOURS }) {
  return (
    <div className="tray-row" role="radiogroup" aria-label={label}>
      {set.map((c) => (
        <button key={c.id} type="button" role="radio" aria-checked={value === c.id}
                className="swatch" data-colour={c.id}
                title={c.does ? `${c.name} — ${c.does}` : c.label}
                aria-label={c.name || c.label}
                onClick={() => onPick(c.id)} />
      ))}
    </div>
  );
}

function Nibs({ value, onPick }) {
  return (
    <div className="tray-nibs" role="radiogroup" aria-label="Nib">
      {PEN_SIZES.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id}
                className="nib" title={p.label} aria-label={p.label} onClick={() => onPick(p.id)}>
          <span style={{ width: 3 + PEN_SIZES.indexOf(p) * 3.5, height: 3 + PEN_SIZES.indexOf(p) * 3.5 }} />
        </button>
      ))}
    </div>
  );
}

function ToolTray({ tool, hlColour, penColour, penSize, ring, onHl, onPen, onSize, onRing }) {
  const spec = toolAt(tool);
  if (tool === "select") return null;
  return (
    <div className="ptray" role="group" aria-label={`${spec.label} settings`}>
      <p className="tray-name">{spec.label}</p>
      {spec.colour === "hl" && (
        <>
          <Swatches value={hlColour} onPick={onHl} label="What this mark means" set={MEANINGS} />
          {/* THE MEANING CARD. The panel is settings without it: a student has
              to be able to see what the colour in their hand will DO, at the
              moment they pick it, not remember it. */}
          <div className="tray-mean" data-colour={hlColour}>
            <i aria-hidden="true" />
            <span><b>{meaning(hlColour).name}</b>{meaning(hlColour).does}</span>
          </div>
        </>
      )}
      {spec.colour === "pen" && <Swatches value={penColour} onPick={onPen} label="Ink colour" />}
      {spec.size && <Nibs value={penSize} onPick={onSize} />}
      {spec.ring && (
        <label className="tray-ring">
          <span>Seen by</span>
          <select value={ring} onChange={(e) => onRing(e.target.value)}>
            {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      )}
      <p className="tray-hint">{spec.hint}</p>
    </div>
  );
}

/* THE SPOTLIGHT.

   One panel, and what it makes is a segmented choice inside it rather than a
   different dialog per kind. That matters more than it looks: a note and a
   question are the same gesture on the same passage, differing only in who is
   meant to answer, and making them two doors means deciding which door before
   you have written the sentence that tells you.

   Spotlight's shape because Spotlight's shape is the right one for this — it
   arrives over the thing you were looking at, it is one field, it takes the
   keyboard immediately, and Escape puts it away. A highlight never opens it;
   that is the whole of R5. */
const KINDS = [
  { id: "note", label: "Note", say: "What do you want to remember?" },
  { id: "question", label: "Question", say: "What is not landing?" },
  { id: "correction", label: "Correction", say: "What is wrong with this passage?" },
];

function Spotlight({ kind, onKind, quote, ring, onRing, value, onChange, onSave, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [kind]);
  const here = KINDS.find((k) => k.id === kind) || KINDS[0];
  const hint = kind === "correction"
    ? "Goes to the author. Nobody else on the module ever sees it."
    : kind === "question"
      ? "Opens a thread in the Ready Room, with the passage quoted."
      : "Only the people in the ring you pick will see it.";

  return (
    <div className="spot" role="dialog" aria-label={here.label} aria-modal="true">
      <div className="spot-seg" role="tablist" aria-label="What kind of mark">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id}
                  className="spot-tab" onClick={() => onKind(k.id)}>{k.label}</button>
        ))}
      </div>

      <blockquote className="spot-quote">{quote}</blockquote>

      <textarea ref={ref} className="spot-field" rows={3} value={value} placeholder={here.say}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancel();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
                }} />

      <div className="spot-foot">
        {kind !== "correction" ? (
          <label className="spot-ring">
            <span>Who sees it</span>
            <select value={ring} onChange={(e) => onRing(e.target.value)}>
              {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        ) : <span className="spot-hint">{hint}</span>}
        <button type="button" className="spot-go" disabled={busy || !value.trim()} onClick={onSave}>
          {busy ? "Saving…" : kind === "question" ? "Ask" : "Save"}
        </button>
      </div>
      {kind !== "correction" && <p className="spot-hint">{hint}</p>}
    </div>
  );
}


/* =============================================================================
   THE MARK CARD (brief §10). Named MarkPop so it does not collide with the
   inline note card further down — that one is a note in the FLOW under a page,
   this one is a popover over a mark, and they are different objects.

   One popover does everything: what a mark is, who made it, and the right
   actions for whose it is. It REPLACES the idea of a separate selection
   toolbar — two overlapping popovers is exactly the clutter this rebuild is
   removing.

   It opens on hover after 240ms on a desktop AND on tap, and the second half
   is not optional: an iPad has no hover, so a card that only appears on hover
   is a card an iPad user can never see. That is called out specifically in the
   brief because it is the sort of thing that ships broken.
   ========================================================================= */
function MarkPop({ mark, me, at, isStaff, onRecolour, onDelete, onNote, onAgree, onThread, onClose }) {
  if (!mark || !at) return null;
  const mine = mark.author_id === me;
  const anon = mark.anonymous && !mine;
  const m = meaning(mark.colour);
  const thread = threadState(mark);
  const who = anon ? "Asked anonymously" : mine ? "You" : (mark.author_name || "Someone");

  return (
    <div className="selbar" role="dialog" aria-label={`${m.name} mark`}
         style={{ left: at.x, top: at.y }} data-flip={at.flip ? "" : undefined}>
      <div className="mc-head" data-colour={mark.colour || undefined}>
        <i aria-hidden="true" />
        <b>{m.name}</b>
        <em className="mono">p.{at.page}</em>
        <button type="button" className="ptool mc-x" onClick={onClose} aria-label="Close">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Rule: the card always states what the colour DOES. A student should
          never have to remember which of five things amber was. */}
      <p className="mc-does">{m.does}</p>

      <div className="mc-who">
        <span className="mc-av" data-anon={anon ? "" : undefined} aria-hidden="true">
          {anon ? "?" : (who.slice(0, 2) || "?").toUpperCase()}
        </span>
        <span className="mc-name">
          <b>{who}</b>
          <span>
            {anon
              ? "Name hidden on questions"
              : mine ? "Yours" : `${mark.agree_count || 0} agreed`}
          </span>
        </span>
        {!mine && (
          <button type="button" className="mc-agree" onClick={() => onAgree(mark)}>
            <ThumbsUp size={14} aria-hidden="true" /> {mark.agree_count || 0}
          </button>
        )}
      </div>

      {/* §6.1 — the thread strip, violet only. Open or answered, said in words
          as well as in the treatment on the page. */}
      {thread && (
        <div className="mc-thread">
          <span className="mc-dot" data-state={thread} aria-hidden="true" />
          {thread === "answered" ? "Answered" : "Open thread"}
          <button type="button" className="mc-link" onClick={() => onThread(mark)}>
            Open in the Ready Room
          </button>
        </div>
      )}

      <div className="mc-acts">
        {mine ? (
          <>
            {/* Restyle in place — the five, and nothing else, for a text mark. */}
            <span className="mc-cols" role="radiogroup" aria-label="What this mark means">
              {MEANINGS.map((c) => (
                <button key={c.id} type="button" className="swatch" role="radio"
                        aria-checked={mark.colour === c.id} data-colour={c.id}
                        title={`${c.name} — ${c.destination}`} aria-label={c.name}
                        onClick={() => onRecolour(mark, c.id)} />
              ))}
            </span>
            <button type="button" className="ptool" onClick={() => onNote(mark)}
                    aria-label="Add a note" title="Add a note">
              <MessageSquare size={15} aria-hidden="true" />
            </button>
            <button type="button" className="ptool" onClick={() => onDelete(mark)}
                    aria-label="Delete this mark" title="Delete">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </>
        ) : (
          <button type="button" className="mc-go" onClick={() => onThread(mark)}>
            {thread ? "Answer this" : anon ? "Reply" : `Ask ${(mark.author_name || "them").split(" ")[0]}`}
          </button>
        )}
      </div>
      {isStaff && mark.anonymous && (
        <p className="mc-note">Instructors can see who asked.</p>
      )}
    </div>
  );
}

/* A note in the flow, under the page it belongs to. */
function MarkCard({ mark, me, onOpenThread, onDelete, onJump, active }) {
  const kindWord = mark.kind === "question" ? "asked" : "noted";
  return (
    <article className={`mcardp ${active ? "is-active" : ""}`} data-kind={mark.kind}
             data-colour={mark.colour || undefined}>
      <button type="button" className="mcardp-quote" onClick={() => onJump(mark)}>
        {mark.quote}
      </button>
      <p className="mcardp-body">{mark.body}</p>
      <p className="mcardp-foot">
        <b>{mark.author_name}</b> {kindWord}
        {mark.ring !== "module" && <span className="mcardp-ring"> · {ringLabel(mark.ring)}</span>}
        {mark.kind === "question" && mark.thread_id && (
          <button type="button" className="mcardp-link" onClick={() => onOpenThread(mark.thread_id)}>
            Answer in the Ready Room
          </button>
        )}
        {mark.author_id === me && (
          <button type="button" className="mcardp-del" onClick={() => onDelete(mark)} aria-label="Delete this mark">
            <Trash2 size={14} aria-hidden="true" />
          </button>
        )}
      </p>
    </article>
  );
}

/* The keys, written down. Every reader worth using has this sheet and it is
   always the same sheet, so nobody has to read it twice. */
const SHORTCUTS = [
  ["⌘F / Ctrl F", "Find in this paper"],
  ["⌘+ / ⌘−", "Zoom in and out"],
  ["⌘0", "Fit the width"],
  ["⌘Z", "Undo the last thing you made"],
  ["← →", "Previous and next page"],
  ["Home / End", "First and last page"],
  ["V H U S", "Pointer, highlight, underline, strike"],
  ["P M E", "Pen, marker, eraser"],
  ["N Q", "Note, question"],
  ["Esc", "Put away whatever is open"],
];

function Sheet({ title, onClose, children }) {
  return (
    <div className="spot-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="psheet" role="dialog" aria-label={title} aria-modal="true">
        <header className="psheet-top">
          <h2>{title}</h2>
          <button type="button" className="ptool" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/* ========================================================================= */
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
  const [light, setLight] = useState(() => read("pw-paper-light", "day"));
  const [full, setFull] = useState(false);

  const [rows, setRows] = useState([]);
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

  const [tool, setTool] = useState("select");
  /* THE TRAY. Loaded per device class, so a laptop and a tablet keep their own.
     See lib/paperTray.js for why they must not be one list. */
  const [tray, setTray] = useState(() => loadTray(
    typeof window === "undefined" ? 1440 : window.innerWidth, TOOLS,
  ));
  const [trayNote, setTrayNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState(1);
  const cap = capFor(typeof window === "undefined" ? 1440 : window.innerWidth);
  const keepTray = useCallback((next) => {
    setTray(next);
    saveTray(window.innerWidth, next);
  }, []);
  const dragging = useRef(null);
  const pressT = useRef(null);
  /* LONG-PRESS THE DOCK TO REARRANGE IT. `-webkit-touch-callout: none` and
     `user-select: none` are on the dock in CSS, or iOS raises its own callout
     menu over this and the gesture belongs to Safari instead. */
  const startLongPress = useCallback((e) => {
    if (!e.target.closest?.(".ptoolbtn")) return;
    pressT.current = setTimeout(() => { setEditing(true); setAdding(false); }, 450);
  }, []);
  const cancelLongPress = useCallback(() => { clearTimeout(pressT.current); }, []);
  const [hlColour, setHlColour] = useState(() => read("pw-paper-hl", DEFAULT_MEANING));
  const [penColour, setPenColour] = useState(() => read("pw-paper-pen", DEFAULT_PEN));
  const [penSize, setPenSize] = useState(() => read("pw-paper-nib", DEFAULT_PEN_SIZE));

  /* Where the rail sits and how big it is. localStorage and not the account,
     for the same reason the player bar's position is: it belongs to the screen
     in front of you. A phone and a laptop should not argue about it. */
  const [dock, setDock] = useState(() => read("pw-paper-dock", "left"));
  const [toolSize, setToolSize] = useState(() => read("pw-paper-toolsize", "m"));
  useEffect(() => { write("pw-paper-dock", dock); }, [dock]);
  useEffect(() => { write("pw-paper-toolsize", toolSize); }, [toolSize]);
  useEffect(() => { write("pw-paper-layout", want); }, [want]);
  useEffect(() => { write("pw-paper-light", light); }, [light]);
  useEffect(() => { write("pw-paper-hush", hush ? "1" : "0"); }, [hush]);
  useEffect(() => { write("pw-paper-hl", hlColour); }, [hlColour]);
  useEffect(() => { write("pw-paper-pen", penColour); }, [penColour]);
  useEffect(() => { write("pw-paper-nib", penSize); }, [penSize]);

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

  const shellRef = useRef(null);
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
    const col = el.querySelector(".pcol");
    const cs = getComputedStyle(el);
    const room = col
      ? col.clientWidth - parseFloat(getComputedStyle(col).paddingLeft) - parseFloat(getComputedStyle(col).paddingRight)
      : el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
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
  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
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
    setRows((held) => (merge ? mergeRows(held, incoming) : incoming));
    setStrokes((held) => (merge ? mergeRows(held, ink) : ink));
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
    await syncFromServer(true);
    requestAnimationFrame(() => {
      const node = pageEls.current.get(page);
      if (el && before != null && node) {
        const after = node.getBoundingClientRect().top;
        el.scrollTop += after - before;
      }
      setRefreshing(false);
    });
  }, [refreshing, syncFromServer, page]);

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
    const paint = takesMeaning(kind) ? meaningOr(colour || hlColour) : null;
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
  }, [model, me, paper, moduleCode, ring, hlColour]);

  const markSelection = useCallback(async (kind, from = sel) => {
    if (!from) return;
    const { start, end } = from;
    clearSelection();
    await addMark({ kind, start, end });
  }, [sel, addMark]);

  /* ------------------------------------------------------------------ ink */
  /* Same optimistic shape as a mark, and for the same reason: a line that
     appears a beat after the finger lifts is a line you drew twice. */
  const addStroke = useCallback(async (pageNumber, points) => {
    if (!me || !paper?.id || !points.length) return;
    const wide = penWidth(penSize) * (tool === "marker" ? 3.2 : 1);
    const optimistic = {
      id: tempId(), paper_id: paper.id, module_code: moduleCode, author_id: me,
      author_name: "You", page: pageNumber, tool: tool === "marker" ? "marker" : "pen",
      colour: penColour, width: wide, ring, points, mine: true,
      created_at: new Date().toISOString(),
    };
    setStrokes((held) => [...held, optimistic]);
    const saved = await createStroke({
      paperId: paper.id, moduleCode, me, page: pageNumber,
      tool: optimistic.tool, colour: penColour, width: wide, ring, points,
    });
    setStrokes((held) => (saved
      ? held.map((s) => (s.id === optimistic.id ? { ...saved, author_name: "You", mine: true } : s))
      : held.filter((s) => s.id !== optimistic.id)));
    if (!saved) setError("That stroke did not save. Nothing else was touched.");
    else remember({ op: "add", row: { ...saved, __ink: true, author_name: "You", mine: true } });
  }, [me, paper, moduleCode, tool, penColour, penSize, ring]);

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
    return {
      x: Math.max(12, Math.min(clientX - host2.left - W / 2, host2.width - W - 12)),
      y: above > 8 ? above : Math.min(host2.height - H - 12, clientY - host2.top + 18),
      flip: above <= 8,
      page: pageOf(model, mark.start),
    };
  }, [model]);

  const open = useCallback((mark, x, y) => {
    if (!mark) { setPicked(null); return; }
    setActiveId(mark.id);
    setPicked({ mark, at: cardFor(mark, x, y) });
  }, [cardFor]);

  /* Hover on a desktop, tap on touch — and the tap half is the one that
     matters. An iPad reports no hover, so a card that only opens on hover is a
     card half the users can never see. */
  const hoverT = useRef(null);
  const onPageMove = useCallback((e) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    clearTimeout(hoverT.current);
    hoverT.current = setTimeout(() => {
      const m = markAt(e.clientX, e.clientY);
      if (m) open(m, e.clientX, e.clientY);
    }, 240);
  }, [markAt, open]);

  const handled = useRef(0);
  const tapToMark = useCallback((e) => {
    /* Click and pointerup both arrive for a mouse; one gesture, one action. */
    if (e.timeStamp && e.timeStamp === handled.current) return;
    handled.current = e.timeStamp;
    /* A tap on an existing mark opens its card, whatever tool is in hand —
       except while a drawing tool is armed, where a tap is a dot. */
    if (!INK_TOOLS.has(tool) && !window.getSelection()?.toString().trim()) {
      const hit = markAt(e.clientX, e.clientY);
      if (hit) { open(hit, e.clientX, e.clientY); return; }
      setPicked(null);
    }
    if (!WRITTEN.has(tool)) return;
    if (!model) return;
    if (window.getSelection()?.toString().trim()) return;      // a drag, not a tap
    if (e.target.closest?.("button, a, input, textarea, select, .mcardp, .spot, .ptray")) return;
    const at = offsetFromPoint(e.clientX, e.clientY);
    if (at == null) return;
    const span = sentenceAround(model.text, at);
    if (!span) return;
    setComposer({ kind: tool, start: span.start, end: span.end, quote: quoteOf(model, span.start, span.end) });
    setDraft("");
    if (tool === "correction") setRing("solo");
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
    if (!sel || tool === "select" || INK_TOOLS.has(tool)) return;
    const made = sel;
    if (TEXT_MARKS.has(tool)) {
      clearSelection();
      addMark({ kind: tool, start: made.start, end: made.end });
    } else {
      openComposer(tool, made);
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
      if (e.key === "Escape") { setComposer(null); setFindOpen(false); setSel(null); setMenu(null); setSheet(null); setPicked(null); setAdding(false); setEditing(false); return; }
      /* One letter per tool — but ONLY for tools on the tray. A key that
         silently switches to something the student took off is the tray not
         meaning anything. */
      const byKey = shortcutFor(tray, TOOLS, e.key);
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

  const drawing = INK_TOOLS.has(tool);
  const totalPages = sizes.length || paper?.pages || 0;
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

  if (!paper || !host) return null;

  return createPortal(
    <div className="paper" ref={shellRef}
         data-rail={rail || "none"} data-dock={dock} data-toolsize={toolSize}
         data-layout={layout} data-light={light} data-drawing={drawing ? "" : undefined}
         data-editing={editing ? "" : undefined}
         /* The furniture recedes while you read, and comes back the moment you
            move. Never while something is open — a menu that faded under the
            pointer would be a menu you cannot use. */
         data-quiet={quiet && !menu && !sheet && !composer && !editing ? "" : undefined}
         data-hush={hush ? "" : undefined}>

      {/* ------------------------------------------------------------ bar */}
      <header className="pbar">
        <div className="pbar-l">
          <button type="button" className="ptool" onClick={onBack} aria-label="Back to the Library">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-pressed={rail ? "true" : "false"}
                  aria-label="Pages and contents" onClick={() => setRail(rail ? null : "thumbs")}>
            <PanelLeft size={17} aria-hidden="true" />
          </button>
          <h1 className="pbar-title">{paper.title}</h1>
          {moduleCode && <span className="pbar-mod mono">{moduleCode}</span>}
        </div>

        <div className="pbar-r">
          <button type="button" className="ptool" onClick={refreshNow} disabled={refreshing}
                  aria-label="Check for new marks on this paper">
            <RefreshCw size={16} aria-hidden="true" data-spin={refreshing ? "" : undefined} />
          </button>
          <button type="button" className="ptool" aria-label="Find in this paper"
                  aria-pressed={findOpen ? "true" : "false"} onClick={() => setFindOpen(!findOpen)}>
            <Search size={16} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-label="How the page is shown"
                  aria-expanded={menu === "view" ? "true" : "false"}
                  onClick={() => setMenu(menu === "view" ? null : "view")}>
            <Sun size={16} aria-hidden="true" />
          </button>
          <button type="button" className="ptool"
                  aria-label={hush ? "Bring the controls back" : "Just the paper"}
                  aria-pressed={hush ? "true" : "false"}
                  title={hush ? "Bring the controls back" : "Just the paper"}
                  onClick={() => setHush(!hush)}>
            {hush ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="ptool" aria-label="More"
                  aria-expanded={menu === "more" ? "true" : "false"}
                  onClick={() => setMenu(menu === "more" ? null : "more")}>
            <MoreHorizontal size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* THE MENUS.

          Everything not reached every minute lives behind one of two, which is
          the rule the readers people already use all follow: Preview and Edge
          put rotate, print and download behind a control and give the rest of
          the window to the document. This screen once had three horizontal
          bands — a toolbar, a properties strip and a footer — 141px of
          furniture before the page started.

          Two menus and not one, because they answer different questions. The
          sun is "how does this page look"; the ellipsis is "what else can I do
          with it". A single list of fourteen items answers neither. */}
      {menu && (
        <button type="button" className="menu-scrim" aria-label="Close menu" onClick={closeMenus} />
      )}

      {menu === "zoom" && (
        <div className="pmenu pmenu-zoom" role="menu" aria-label="Zoom">
          {FITS.map((f) => (
            <button key={f.id} type="button" role="menuitemradio" aria-checked={fit === f.id}
                    onClick={() => { setFit(f.id); if (f.id === "actual") setScale(1); closeMenus(); }}>
              <Check size={15} aria-hidden="true" data-on={fit === f.id ? "" : undefined} />
              {f.label}
            </button>
          ))}
          <span className="pmenu-rule" aria-hidden="true" />
          <p className="pmenu-read mono">Now at {Math.round(scale * 100)}%</p>
          {ZOOM_STEPS.filter((z) => z >= 0.5 && z <= 4).map((z) => (
            <button key={z} type="button" role="menuitemradio"
                    aria-checked={!fit && Math.abs(scale - z) < 0.005}
                    onClick={() => { setFit(null); setScale(clampZoom(z)); closeMenus(); }}>
              <Check size={15} aria-hidden="true" data-on={!fit && Math.abs(scale - z) < 0.005 ? "" : undefined} />
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      )}

      {menu === "view" && (
        <div className="pmenu pmenu-view" role="menu" aria-label="How the page is shown">
          <p className="pmenu-head">Pages</p>
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={layout === l.id}
                    onClick={() => { setLayout(l.id); closeMenus(); }}>
              {l.id === "scroll" ? <Rows3 size={15} aria-hidden="true" />
                : l.id === "single" ? <Square size={15} aria-hidden="true" />
                  : <Columns2 size={15} aria-hidden="true" />}
              {l.label}
              {layout === l.id && <Check size={14} aria-hidden="true" className="pmenu-tick" data-on="" />}
            </button>
          ))}

          <span className="pmenu-rule" aria-hidden="true" />
          <p className="pmenu-head">Light</p>
          <div className="lights" role="radiogroup" aria-label="Light">
            {PAPER_LIGHTS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={light === l.id}
                      className="light" data-light={l.id} onClick={() => setLight(l.id)}>
                <span className="light-chip" aria-hidden="true" />
                {l.label}
              </button>
            ))}
          </div>

          <span className="pmenu-rule" aria-hidden="true" />
          <button type="button" role="menuitem" onClick={() => setRotation((r) => (r + 270) % 360)}>
            <RotateCcw size={15} aria-hidden="true" /> Turn left
          </button>
          <button type="button" role="menuitem" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw size={15} aria-hidden="true" /> Turn right
          </button>
          <button type="button" role="menuitem" onClick={() => { toggleFull(); closeMenus(); }}>
            {full ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
            {full ? "Leave full screen" : "Full screen"}
          </button>
        </div>
      )}

      {menu === "more" && (
        <div className="pmenu" role="menu" aria-label="More">
          <button type="button" role="menuitemcheckbox" aria-checked={density}
                  onClick={() => setDensity(!density)}>
            <Check size={15} aria-hidden="true" data-on={density ? "" : undefined} />
            Show what the module marked
          </button>

          <span className="pmenu-rule" aria-hidden="true" />

          {/* A default, not a decision you look at all day. Per mark it is
              still chosen in the Spotlight, where you are actually deciding. */}
          <label className="pmenu-pick">
            <span>New marks seen by</span>
            <select value={ring} onChange={(e) => setRing(e.target.value)}>
              {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="pmenu-pick">
            <span>Tools on</span>
            <select value={dock} onChange={(e) => setDock(e.target.value)}>
              {DOCKS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label className="pmenu-pick">
            <span>Tool size</span>
            <select value={toolSize} onChange={(e) => setToolSize(e.target.value)}>
              {TOOL_SIZES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </label>

          <span className="pmenu-rule" aria-hidden="true" />

          <button type="button" role="menuitem" onClick={() => { printNow(); closeMenus(); }}>
            <Printer size={15} aria-hidden="true" /> Print
          </button>
          <a role="menuitem" href={url} download onClick={closeMenus}>
            <Download size={15} aria-hidden="true" /> Download
          </a>
          <button type="button" role="menuitem" onClick={() => { onOpenOriginal?.(paper); closeMenus(); }}>
            <Search size={15} aria-hidden="true" /> Open the original
          </button>

          <span className="pmenu-rule" aria-hidden="true" />

          <button type="button" role="menuitem" onClick={() => { setSheet("details"); closeMenus(); }}>
            <Info size={15} aria-hidden="true" /> Document details
          </button>
          <button type="button" role="menuitem" onClick={() => { setSheet("keys"); closeMenus(); }}>
            <Keyboard size={15} aria-hidden="true" /> Keyboard shortcuts
          </button>
          {isStaff && <p className="pmenu-note">You are looking at this as the author.</p>}
        </div>
      )}

      {findOpen && (
        <div className="findbar">
          <Search size={15} aria-hidden="true" />
          <input autoFocus value={query} placeholder="Find in this paper"
                 onChange={(e) => { setQuery(e.target.value); setFindAt(0); }}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") setFindAt((i) => (finds.length ? (i + (e.shiftKey ? -1 : 1) + finds.length) % finds.length : 0));
                   if (e.key === "Escape") { setFindOpen(false); setQuery(""); }
                 }} />
          <button type="button" className="findopt" aria-pressed={matchCase ? "true" : "false"}
                  title="Match case" onClick={() => setMatchCase(!matchCase)}>Aa</button>
          <button type="button" className="findopt" aria-pressed={wholeWord ? "true" : "false"}
                  title="Whole words only" onClick={() => setWholeWord(!wholeWord)}>Ab|</button>
          <span className="find-count">
            {query.trim() ? (finds.length ? `${findAt + 1} of ${finds.length}` : "Nothing yet") : ""}
          </span>
          <button type="button" className="ptool" aria-label="Previous match"
                  onClick={() => setFindAt((i) => (finds.length ? (i - 1 + finds.length) % finds.length : 0))}>
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-label="Next match"
                  onClick={() => setFindAt((i) => (finds.length ? (i + 1) % finds.length : 0))}>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-label="Close find"
                  onClick={() => { setFindOpen(false); setQuery(""); }}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Drawboard's rail, in four groups, with the armed tool's settings
          floating beside it rather than taking a band of their own. */}
      {/* THE DOCK — the student's tray, grouped, with the way to change it at
          the bottom. Long-press anywhere on it to rearrange. */}
      <div className="ptools" role="toolbar" aria-label="Marking tools"
           onPointerDown={startLongPress} onPointerUp={cancelLongPress}
           onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}>
        {GROUPS.map((g) => {
          const mine = tray.map((id) => toolAt(id)).filter((t) => t.group === g.id);
          if (!mine.length) return null;
          return (
            <div className="ptoolgroup" key={g.id}>
              {mine.map((t) => (
                <span className="ptoolslot" key={t.id}
                      draggable={editing}
                      onDragStart={() => { dragging.current = t.id; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); if (dragging.current) keepTray(moveTool(tray, dragging.current, t.id)); dragging.current = null; }}>
                  <button type="button" className="ptoolbtn" aria-pressed={tool === t.id}
                          aria-label={t.label} title={`${t.label} (${t.key}) — ${t.hint}`}
                          onClick={() => { if (!editing) setTool(t.id); }}>
                    {TOOL_ICONS[t.id]}
                    {t.colour && (
                      <span className="ptool-sw" aria-hidden="true"
                            data-colour={t.colour === "hl" ? hlColour : penColour} />
                    )}
                  </button>
                  {editing && !LOCKED.includes(t.id) && (
                    <button type="button" className="ptool-rm"
                            aria-label={`Take ${t.label} off the tray`}
                            onClick={() => keepTray(removeTool(tray, t.id))}>
                      <X size={11} aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          );
        })}

        <button type="button" className="ptool-add" aria-label="Add a tool"
                aria-expanded={adding ? "true" : "false"}
                onClick={() => { setAdding(!adding); setEditing(false); }}>
          <PlusIcon size={17} aria-hidden="true" />
        </button>

        {editing && (
          <div className="ptray ptray-edit" role="status">
            <p className="tray-name">Rearranging</p>
            <p className="tray-hint">Drag to reorder. Take one off with its ✕. Select stays.</p>
            <button type="button" className="tray-done" onClick={() => setEditing(false)}>Done</button>
          </div>
        )}

        {/* ADD A TOOL — the full set, always, so nothing a student removed is
            ever unreachable. Tools already on the tray are shown dimmed rather
            than hidden, so the sheet reads the same every time. */}
        {adding && !editing && (
          <div className="ptray ptray-add" role="dialog" aria-label="Add a tool">
            <p className="tray-name">Add a tool</p>
            <div className="add-tabs" role="tablist">
              {GROUPS.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={addTab === g.id}
                        onClick={() => setAddTab(g.id)}>{g.name}</button>
              ))}
            </div>
            <div className="add-grid">
              {TOOLS.filter((t) => t.group === addTab).map((t) => (
                <button key={t.id} type="button" className="add-cell"
                        data-have={tray.includes(t.id) ? "" : undefined}
                        disabled={tray.includes(t.id)}
                        onClick={() => {
                          const { tray: next, note } = addTool(tray, t.id, TOOLS, cap);
                          setTrayNote(note);
                          if (!note) { keepTray(next); setTool(t.id); setAdding(false); }
                        }}>
                  <span className="add-ic">{TOOL_ICONS[t.id]}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <p className="tray-hint">
              {trayNote || `${tray.length} of ${cap} on your tray`}
            </p>
            <div className="tray-foot">
              <button type="button" className="tray-done"
                      onClick={() => { setAdding(false); setEditing(true); }}>
                Rearrange
              </button>
              <button type="button" className="tray-done"
                      onClick={() => { keepTray([...DEFAULT_TRAY]); setTrayNote(null); }}>
                Reset to the course default
              </button>
            </div>
          </div>
        )}

        {!adding && !editing && <ToolTray tool={tool} hlColour={hlColour} penColour={penColour} penSize={penSize}
                  ring={ring} onHl={setHlColour} onPen={setPenColour}
                  onSize={setPenSize} onRing={setRing} />}
      </div>


      {/* THE BOTTOM BAR (§8.4). Undo and redo live here because rule 4 says
          undo is a button, always — not a shortcut a student on an iPad with
          no keyboard cannot reach. Then where you are in the paper, then what
          the module marked, then zoom. */}
      <div className="pbot">
        <button type="button" className="ptool" onClick={undo} disabled={!canUndo}
                aria-label="Undo" title="Undo (⌘Z)">
          <Undo2 size={17} aria-hidden="true" />
        </button>
        <button type="button" className="ptool" onClick={redo} disabled={!canRedo}
                aria-label="Redo" title="Redo (⇧⌘Z)">
          <Redo2 size={17} aria-hidden="true" />
        </button>
        <span className="pbot-rule" aria-hidden="true" />
        <div className="pbot-c">
          <button type="button" className="ptool" aria-label="Previous page"
                  onClick={() => turn(-1)} disabled={page <= 1}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {/* §11.3 — THE PAGE NUMBER IS A SCRUBBER. Drag it and fly through
              the manual, with a card showing where you would land and how many
              marks are near it. In a 1012-page document this is faster than
              typing a number and far faster than scrolling. */}
          <span className="pnum" data-scrubbing={scrub ? "" : undefined}>
            <input value={scrub ? scrub.page : page} aria-label="Page"
                   title="Drag to fly through the paper"
                   onChange={(e) => {
                     const n = Number(e.target.value.replace(/\D/g, ""));
                     if (n >= 1 && n <= totalPages) jumpTo(n);
                   }}
                   onPointerDown={(e) => {
                     if (totalPages < 8) return;          // nothing to fly through
                     try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not ours */ }
                     drag.current = { x: e.clientX, from: page, page };
                     setScrub({ page });
                   }}
                   onPointerMove={(e) => {
                     const d = drag.current;
                     if (!d) return;
                     e.preventDefault();
                     /* The whole paper across roughly half a screen width, so a
                        thousand pages is a comfortable drag rather than a
                        twitch. */
                     const perPx = totalPages / Math.max(320, window.innerWidth * 0.55);
                     const n = Math.max(1, Math.min(totalPages,
                       Math.round(d.from + (e.clientX - d.x) * perPx)));
                     if (n !== d.page) { d.page = n; setScrub({ page: n }); }
                   }}
                   onPointerUp={() => {
                     const d = drag.current;
                     drag.current = null;
                     setScrub(null);
                     if (d && d.page !== d.from) jumpTo(d.page);
                   }}
                   onPointerCancel={() => { drag.current = null; setScrub(null); }} />
            <span>/ {totalPages || "—"}</span>
          </span>
          <button type="button" className="ptool" aria-label="Next page"
                  onClick={() => turn(1)} disabled={page >= totalPages}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <span className="pbot-rule" aria-hidden="true" />

          <button type="button" className="ptool" aria-label="Zoom out"
                  onClick={() => zoomAbout(stepZoom(scale, -1))}>
            <Minus size={16} aria-hidden="true" />
          </button>
          {/* THE LABEL IS THE MODE, NOT THE NUMBER (brief 4.4, rule 8).

              "Fit width" is what a student means; 176% is what the renderer
              happens to be doing about it. The percentage is still there —
              inside the menu, where somebody who wants it is already looking. */}
          <button type="button" className="pzoom" aria-expanded={menu === "zoom" ? "true" : "false"}
                  onClick={() => setMenu(menu === "zoom" ? null : "zoom")}>
            {fit ? (FITS.find((f) => f.id === fit)?.label ?? "Fit width") : `${Math.round(scale * 100)}%`}
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-label="Zoom in"
                  onClick={() => zoomAbout(stepZoom(scale, 1))}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        <span className="pbot-rule" aria-hidden="true" />
        <button type="button" className="ptool" aria-pressed={density ? "true" : "false"}
                onClick={() => setDensity(!density)}
                aria-label="Show what the module marked" title="What the module marked">
          <Users size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="pbody">
        {/* ------------------------------------------------------- the rail */}
        {rail && (
          <aside className="prail" aria-label="Pages, contents and marks">
            <div className="prail-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={rail === "thumbs"}
                      onClick={() => setRail("thumbs")}>Pages</button>
              <button type="button" role="tab" aria-selected={rail === "outline"}
                      onClick={() => setRail("outline")}>Contents</button>
              <button type="button" role="tab" aria-selected={rail === "marks"}
                      onClick={() => setRail("marks")}>Marks</button>
              {isStaff && (
                <button type="button" role="tab" aria-selected={rail === "queue"}
                        onClick={() => setRail("queue")}>
                  Queue{queue.length ? ` ${queue.length}` : ""}
                </button>
              )}
            </div>

            {rail === "thumbs" && (
              <PaperThumbs doc={doc} pages={totalPages} current={page} onPick={jumpTo}
                           boxes={paper?.manifest?.boxes}
                           thumbSrc={paper?.manifest ? (n) => thumbUrl(paper, n) : null} />
            )}

            {rail === "outline" && (
              <div className="prail-marks">
                <PaperOutline doc={doc} onPick={jumpTo} />
              </div>
            )}

            {rail === "queue" && isStaff && (
              <div className="prail-marks">
                {queue.length ? (
                  <ul className="mlist">
                    {queue.map((c) => (
                      <li key={c.id}>
                        <div className="qrow">
                          <p className="qrow-quote">“{c.anchor?.quote}”</p>
                          <p className="qrow-body">{c.body}</p>
                          <p className="qrow-foot">
                            <span>{c.author_name}</span>
                            <button type="button" className="qrow-act"
                                    onClick={async () => {
                                      await resolveCorrection(c.id);
                                      loadQueue();
                                    }}>Done with it</button>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* R11 again: not "0 corrections". */
                  <p className="mnone">
                    Nothing reported on this module yet. A student who spots
                    something wrong can tell you from the passage itself.
                  </p>
                )}
              </div>
            )}

            {rail === "marks" && (
              <div className="prail-marks">
                <div className="chips" role="group" aria-label="Where your marks went">
                  {FILTERS.map((f) => {
                    const n = counts[f.id] || 0;
                    return (
                      <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id}
                              data-colour={f.id} disabled={!n && f.id !== "all"}
                              onClick={() => setFilter(f.id)}>
                        {f.label}
                        {/* A count only where there is something to count — a
                            chip reading 0 is a chip stating an absence. */}
                        {n > 0 && f.id !== "all" && <em className="mono">{n}</em>}
                      </button>
                    );
                  })}
                </div>
                {marksList.length ? (
                  <ul className="mlist">
                    {marksList.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="mrow" data-kind={a.kind}
                                data-colour={a.colour || undefined}
                                data-orphan={a.status === "orphaned" ? "" : undefined}
                                onClick={() => {
                                  if (a.status === "orphaned") return;
                                  setActiveId(a.id);
                                  jumpTo(pageOf(model, a.start));
                                }}>
                          <span className="mrow-quote">
                            {a.status === "orphaned"
                              ? a.anchor?.quote || "This passage"
                              : quoteOf(model, a.start, a.end, 90)}
                          </span>
                          <span className="mrow-foot">
                            {a.author_name}
                            {a.body ? " · " : ""}
                            {a.body ? a.body.slice(0, 60) : ""}
                            {a.status === "orphaned" && <em> · lost its place</em>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* R11 — empty reads "not yet", never "nothing". */
                  <p className="mnone">
                    Nobody has marked this one up yet. Select a line and yours will be the first.
                  </p>
                )}
              </div>
            )}
          </aside>
        )}

        {/* THE TICK RAIL (§11.2). Every mark in the paper, down the right
            edge, positioned by page. In a 1000-page manual this is the only
            view of the whole thing you ever get — where you have been, where
            the class has been, and how far in you are. */}
        {ticks.length > 0 && totalPages > 1 && (
          /* THE RAIL IS THE CONTROL, AND THE TICKS ARE DRAWN ON IT.

             Forty separate 3px buttons is forty targets nobody can hit and
             forty things for a screen reader to read out. One control, one job
             (rule 7): the rail takes the click, works out which page that
             height is, and SNAPS to a nearby mark if there is one — so aiming
             roughly at a tick lands on it, and aiming at empty rail lands on
             that page. */
          <button
            type="button" className="pticks"
            aria-label={`Marks across this paper — ${ticks.length} of them. Click to jump.`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setRailAt({ y: e.clientY - r.top, page: pageAtRail(e.clientY - r.top, r.height) });
            }}
            onPointerLeave={() => setRailAt(null)}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              jumpTo(pageAtRail(e.clientY - r.top, r.height));
            }}
          >
            <span className="pticks-trk" aria-hidden="true" />
            {ticks.map((t) => (
              <span key={t.id} className="ptick" aria-hidden="true"
                    data-colour={t.colour || undefined}
                    data-mine={t.mine ? "" : undefined}
                    style={{ top: `${((t.page - 0.5) / totalPages) * 100}%` }} />
            ))}
            <span className="pticks-you" aria-hidden="true"
                  style={{ top: `${((page - 0.5) / totalPages) * 100}%` }} />
          </button>
        )}

        {railAt && (
          <div className="pticks-tip" style={{ top: railAt.y }} role="status">
            {(() => {
              const near = ticks.filter((t) => t.page === railAt.page);
              return near.length
                ? <><b data-colour={near[0].colour || undefined}>{near[0].name}</b><em className="mono">p.{railAt.page}</em></>
                : <em className="mono">p.{railAt.page}</em>;
            })()}
          </div>
        )}

        {/* ------------------------------------------------------ the pages */}
        <div className="pscroll" ref={scrollRef} onScroll={onScroll} onClick={tapToMark}
             /* A TAP OPENS THE CARD, and it is bound to pointerup rather than
                only to click: iOS does not reliably synthesise a click from a
                touch sequence on a scrolling surface, and a card that needs a
                mouse is a card an iPad user never sees. Click stays for the
                mouse and for the keyboard's activation. */
             onPointerUp={(e) => { if (e.pointerType !== "mouse") tapToMark(e); }}
             /* AND a touch fallback. Not every WebKit build raises pointer
                events for a touch on a scrolling surface — the harness's does
                not — and the cost of being wrong about that is the mark card
                being unreachable on the primary device. Two listeners, one
                action: the dedupe below drops whichever arrives second. */
             onTouchEnd={(e) => {
               const t = e.changedTouches?.[0];
               if (t) tapToMark({ clientX: t.clientX, clientY: t.clientY, target: e.target, timeStamp: e.timeStamp });
             }}
             onPointerMove={onPageMove}
             onPointerLeave={() => clearTimeout(hoverT.current)}>
          {error && <p className="perr">{error}</p>}

          <div className="pcol" style={{ gap: PAGE_GAP }}>
            {/* The pages above the window, as one box of exactly their height. */}
            {win[0] > 0 && <div className="ppgap" style={{ height: offsets[win[0]] }} aria-hidden="true" />}
            {sizes.slice(win[0], win[1]).map((s, k) => {
              const i = win[0] + k;
              const n = i + 1;
              const rotated = rotation % 180 !== 0;
              const w = (rotated ? s.h : s.w) * scale;
              const h = (rotated ? s.w : s.h) * scale;
              const hidden = onScreen ? !onScreen.has(n) : false;
              return (
                <div className="pslot" key={n} data-off={hidden ? "" : undefined}>
                  {!hidden && drawSet.has(n) ? (
                    <PaperPage
                      doc={doc} model={model} pageNumber={n} scale={scale} rotation={rotation}
                      size={s} segments={drawSegments} activeId={activeId} light={light}
                      strokes={strokes} me={me}
                      inkTool={drawing ? tool : null} inkColour={penColour}
                      inkWidth={penWidth(penSize) * (tool === "marker" ? 3.2 : 1)}
                      onInk={addStroke} onErase={eraseStrokes}
                      registerEl={registerEl} onDivs={takeDivs}
                    />
                  ) : (
                    /* Rule 1 — never an empty white rectangle where a page
                       belongs. A page outside the window keeps its box and its
                       number, at the right shape, because the size came from
                       the manifest rather than from the file. */
                    <div className="pp pp-ghost" data-page={n} style={{ width: w, height: h }}
                         ref={(el) => { if (el) pageEls.current.set(n, el); }}>
                      <span className="pp-no mono" aria-hidden="true">{n}</span>
                    </div>
                  )}

                  {notesOnPage(n).map((mark) => (
                    <MarkCard key={mark.id} mark={mark} me={me} active={activeId === mark.id}
                              onOpenThread={onOpenThread} onDelete={removeMark}
                              onJump={(m) => { setActiveId(m.id); jumpTo(pageOf(model, m.start)); }} />
                  ))}
                </div>
              );
            })}
            {win[1] < sizes.length && (
              <div className="ppgap" aria-hidden="true"
                   style={{ height: Math.max(0, offsets[sizes.length] - offsets[win[1]]) }} />
            )}
          </div>

          {orphans.length > 0 && (
            <section className="orphans">
              <h2>
                {orphans.length} {orphans.length === 1 ? "mark" : "marks"} lost
                {orphans.length === 1 ? " its" : " their"} place when this paper changed
              </h2>
              <ul>
                {orphans.map((o) => (
                  <li key={o.id}>
                    <span className="orph-q">“{o.anchor?.quote}”</span>
                    {o.body && <span className="orph-b">{o.body}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {layout === "scroll" && (
            <p className="pcoda">
              That is all of {paper.title} — {totalPages} page
              {totalPages === 1 ? "" : "s"}. Marked with pdf.js {PDFJS_VERSION}.
            </p>
          )}

          <MarkPop
            mark={picked?.mark} at={picked?.at} me={me} isStaff={isStaff}
            onRecolour={(m, c) => { recolour(m, c); setPicked((p) => (p ? { ...p, mark: { ...p.mark, colour: c } } : p)); }}
            onDelete={(m) => { removeMark(m); setPicked(null); }}
            onNote={(m) => { setPicked(null); setComposer({ kind: "note", start: m.start, end: m.end, quote: quoteOf(model, m.start, m.end) }); setDraft(""); }}
            onAgree={(m) => agree(m)}
            onThread={(m) => { if (m.thread_id) onOpenThread?.(m.thread_id); else { setPicked(null); setComposer({ kind: "question", start: m.start, end: m.end, quote: quoteOf(model, m.start, m.end) }); setDraft(""); } }}
            onClose={() => setPicked(null)}
          />

          <SelectionBar
            at={sel} canCorrect={!!me} colour={hlColour}
            onHighlight={() => markSelection("highlight")}
            onUnderline={() => markSelection("underline")}
            onStrike={() => markSelection("strikethrough")}
            onNote={() => openComposer("note")}
            onAsk={() => openComposer("question")}
            onCorrect={() => openComposer("correction")}
          />
        </div>
      </div>

      {scrub && (
        <div className="pscrub" role="status">
          <b className="mono">{scrub.page}</b>
          <span>
            of {totalPages}
            <em>{(() => {
              const near = ticks.filter((t) => Math.abs(t.page - scrub.page) <= 2).length;
              /* Never "0 marks near here" — an absence stated is an absence
                 you have to read. Silence says it better. */
              return near ? `${near} mark${near === 1 ? "" : "s"} near here` : "";
            })()}</em>
          </span>
        </div>
      )}

      {/* §11.1 — the way back. Appears after a jump, says where it goes, and
          goes away once used. */}
      {cameFrom && cameFrom.page !== page && (
        <button type="button" className="pback"
                onClick={() => {
                  goToPage(cameFrom.page);
                  if (scrollRef.current && cameFrom.top != null) scrollRef.current.scrollTop = cameFrom.top;
                  setCameFrom(null);
                }}>
          <ChevronLeft size={15} aria-hidden="true" />
          Back to page <b className="mono">{cameFrom.page}</b>
        </button>
      )}

      {composer && (
        <div className="spot-scrim" onClick={(e) => { if (e.target === e.currentTarget) setComposer(null); }}>
          <Spotlight kind={composer.kind} onKind={(k) => {
                       setComposer((c) => ({ ...c, kind: k }));
                       if (k === "correction") setRing("solo");
                     }}
                     quote={composer.quote} ring={ring} onRing={setRing}
                     value={draft} onChange={setDraft} busy={busy}
                     onSave={saveComposer} onCancel={() => setComposer(null)} />
        </div>
      )}

      {sheet === "keys" && (
        <Sheet title="Keyboard shortcuts" onClose={() => setSheet(null)}>
          <dl className="keys">
            {SHORTCUTS.map(([k, what]) => (
              <div key={k}><dt>{k}</dt><dd>{what}</dd></div>
            ))}
          </dl>
        </Sheet>
      )}

      {sheet === "details" && (
        <Sheet title="Document details" onClose={() => setSheet(null)}>
          <dl className="keys">
            <div><dt>Title</dt><dd>{info.Title || paper.title}</dd></div>
            {info.Author && <div><dt>Author</dt><dd>{info.Author}</dd></div>}
            {info.Producer && <div><dt>Made with</dt><dd>{info.Producer}</dd></div>}
            <div><dt>Pages</dt><dd>{totalPages}</dd></div>
            <div><dt>Version</dt><dd>PDF {info.PDFFormatVersion || "—"}</dd></div>
            <div><dt>Drawn by</dt><dd>pdf.js {PDFJS_VERSION}</dd></div>
          </dl>
          <p className="psheet-note">
            Marks are stored against the words, not against a position, so they
            survive this paper being re-issued. Ink is drawn on the page itself.
          </p>
        </Sheet>
      )}

    </div>,
    host,
  );
}
