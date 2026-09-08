import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadPaper, releasePaper, paperText, quoteOf, pageOf, warmWorker, PDFJS_VERSION } from "../../lib/paperText.js";
import { setRasterFocus } from "../../lib/rasterBudget.js";
import {
  resolveAll, segmentsFor, anchorFor, mergeRows, sentenceAround,
  applyFilter, FILTERS, filterCounts, RINGS, DOCKS,
} from "../../lib/paperMarks.js";
import { meaning, threadState, meaningOr, DEFAULT_MEANING } from "../../lib/meanings.js";
import {
  DEFAULT_TRAY, LOCKED, GROUPS, capFor, loadTray, saveTray,
  addTool, removeTool, moveTool, shortcutFor,
} from "../../lib/paperTray.js";
import {
  TOOLS, COLOURS, tool as toolAt, kindOf, marksText, isInk, isWritten,
  takesMeaning, takesFreeColour, hasColour, colour as colourAt,
} from "../../lib/readerTools.js";
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
import Icon from "./Icon.jsx";
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
const tempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private */ } };
const rgba = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ---------------------------------------------------------------------------
   THE MARK CARD — one popover for properties, ownership and actions.

   §10: it replaces the idea of a separate selection toolbar, because two
   overlapping popovers is exactly the clutter being removed. It opens on hover
   AND on tap; an iPad has no hover, and a card that only ever appears under a
   mouse is a card an iPad user can never see.
   ------------------------------------------------------------------------ */
function MarkCard({ mark, me, at, onRecolour, onDelete, onNote, onAgree, onThread, onHold, onLeave }) {
  if (!mark || !at) return null;
  const c = colourAt(mark.colour || DEFAULT_MEANING);
  const mine = mark.author_id === me;
  const anon = !!mark.anonymous && !mine;
  const thread = mark.colour === "unsure" || mark.kind === "question";
  const state = threadState(mark);
  const who = anon ? "Asked anonymously" : mine ? "You" : (mark.author_name || "Someone");
  const initials = anon ? "?" : mine ? "YOU"
    : (mark.author_name || "S").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bar pop mark-card is-open"
         style={{ left: at.left, top: at.top }}
         onMouseEnter={onHold} onMouseLeave={onLeave}
         role="dialog" aria-label={`${c.name} on page ${mark.page ?? ""}`}>
      <div className="mch" style={{ "--c": c.hex }}>
        <i /><b>{c.name}</b><em>p.{mark.page ?? "—"}</em>
      </div>
      <div className="mcd">{c.does}</div>

      <div className="mcw">
        <span className={`av${mine ? "" : " other"}`}>{initials}</span>
        <div>
          <b>{who}</b>
          <span>
            {mark.when || "just now"}
            {anon && " · name hidden on questions"}
            {!mine && !anon && mark.contribution ? ` · ${mark.contribution}` : ""}
          </span>
        </div>
        {!mine && !thread && (
          <button type="button" className="btn grow" data-act="agree"
                  onClick={() => onAgree(mark)} aria-label="Agree">
            <Icon name="agree" size={15} /> {mark.agree_count || 0}
          </button>
        )}
      </div>

      {thread && (
        <div className="thr">
          <span className={`state${state === "open" ? " is-open" : ""}`} />
          {state === "open"
            ? `Open thread · ${mark.replies || 0} ${(mark.replies || 0) === 1 ? "reply" : "replies"}`
            : `Answered · ${mark.replies || 0} ${(mark.replies || 0) === 1 ? "reply" : "replies"}`}
          <u role="button" tabIndex={0} onClick={() => onThread(mark)}
             onKeyDown={(e) => e.key === "Enter" && onThread(mark)}>Open in Ready Room</u>
        </div>
      )}

      <div className="mca">
        {mine ? (
          <>
            {COLOURS.map((cc) => (
              <button key={cc.key} type="button"
                      className={`sw${cc.key === mark.colour ? " is-on" : ""}`}
                      data-colour={cc.key}
                      style={{ "--c": cc.hex }} aria-label={cc.name}
                      onClick={() => onRecolour(mark, cc.key)}><i /></button>
            ))}
            <span className="sep" />
            <button type="button" className="ib" aria-label="Add a note" onClick={() => onNote(mark)}>
              <Icon tool="note" size={16} />
            </button>
            <button type="button" className="ib" aria-label="Delete" onClick={() => onDelete(mark)}>
              <Icon name="trash" size={16} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" data-act="ask" onClick={() => onThread(mark)}>
              {thread ? "Answer this" : anon ? "Reply" : `Ask ${(mark.author_name || "them").split(/\s+/)[0]}`}
            </button>
            <button type="button" className="btn grow" data-act="follow">Follow</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   THE INSPECTOR — §8.5. The live preview is the single most important detail;
   without it the panel is a settings sheet.
   ------------------------------------------------------------------------ */
function Inspector({
  open, tool, meaningId, inkColour, size, opacity, smart, smooth, recent,
  onMeaning, onInk, onSize, onOpacity, onSmart, onSmooth, onReset,
}) {
  const spec = toolAt(tool);
  const ink = takesFreeColour(tool);
  const c = ink ? { hex: inkColour, name: "", does: "" } : colourAt(meaningId);
  const ticks = ink ? [1, 2, 4, 8, 16] : [4, 8, 12, 20, 32];
  const [foldOpen, setFoldOpen] = useState(true);

  return (
    <div className={`bar pop bar-insp${open ? " is-open" : ""}`} aria-label={`${spec.name} settings`}>
      <header>
        <h3>{spec.name} <Icon name="chevron" size={13} /></h3>
        <button type="button" className="ib" aria-label="Reset tool" onClick={onReset}>
          <Icon name="reset" size={15} />
        </button>
      </header>

      <div className="body">
        {!hasColour(tool) ? (
          /* Tools with no colour get one drawing and one sentence, never a
             panel of controls that do nothing. */
          <div className="empty">
            <Icon tool={tool} size={40} />
            {spec.hint}.
          </div>
        ) : (
          <>
            <div className="preview">
              {ink ? (
                <svg width="200" height="34" viewBox="0 0 200 34" aria-hidden="true">
                  <path d="M6 24C34 4 46 30 72 17s38-16 60-3 40 12 62 2" fill="none"
                        stroke={c.hex} strokeOpacity={opacity / 100}
                        strokeWidth={Math.max(1, size)} strokeLinecap="round" />
                </svg>
              ) : tool === "ul" || tool === "st" ? (
                <span className="smp" style={{
                  textDecoration: tool === "ul" ? "underline" : "line-through",
                  textUnderlineOffset: 3,
                  textDecorationColor: rgba(c.hex, opacity / 100),
                  textDecorationThickness: `${size}px`,
                }}>Sample text</span>
              ) : (
                <span className="smp" style={{
                  background: rgba(c.hex, opacity / 100),
                  padding: `${Math.round(size / 4)}px 8px`,
                }}>Sample text</span>
              )}
            </div>

            <div className="row">
              <div className="rowhead"><span>Size</span><span className="pill">{size} pt</span></div>
              <input type="range" min={ticks[0]} max={ticks[ticks.length - 1]} value={size}
                     aria-label="Size"
                     style={{ "--trk": `linear-gradient(90deg,${c.hex},${rgba(c.hex, .25)})` }}
                     onChange={(e) => onSize(Number(e.target.value))} />
              <div className="ticks">{ticks.map((t) => <b key={t}>{t}</b>)}</div>
            </div>

            <div className="row">
              {recent.length > 0 && (
                <div className="recent">
                  <span className="lb">Recent</span>
                  {recent.map((k) => (
                    <button key={k} type="button" className="sw sm" style={{ "--c": colourAt(k).hex }}
                            aria-label={colourAt(k).name} onClick={() => onMeaning(k)}><i /></button>
                  ))}
                </div>
              )}
              <div className="rowhead"><span>{ink ? "Ink colour" : "All colours"}</span></div>
              <div className="colours">
                {(ink ? INK_COLOURS : COLOURS).map((cc) => {
                  const key = ink ? cc.id : cc.key;
                  const hex = ink ? undefined : cc.hex;
                  const on = ink ? inkColour === cc.id : meaningId === cc.key;
                  return (
                    <button key={key} type="button" className={`sw${on ? " is-on" : ""}`}
                            data-ink={ink ? cc.id : undefined}
                            data-colour={ink ? undefined : cc.key}
                            style={hex ? { "--c": hex } : undefined}
                            aria-label={ink ? cc.label : cc.name}
                            onClick={() => (ink ? onInk(cc.id) : onMeaning(cc.key))}><i /></button>
                  );
                })}
                <button type="button" className="more" aria-label="More colours">···</button>
              </div>
            </div>

            {/* What this colour DOES. §6 — the picker shows the meaning; the
                card states it again. A colour that only looks different is a
                colour nobody uses consistently. */}
            {!ink && (
              <div className="row">
                <div className="meaning" style={{ "--c": c.hex }}>
                  <i />
                  <div style={{ flex: 1 }}>
                    <b>{c.name}</b>
                    <u>{c.does}</u>
                  </div>
                </div>
              </div>
            )}

            <div className="row" style={{ marginBottom: 4 }}>
              <div className="rowhead"><span>Opacity</span><span className="pill">{opacity}%</span></div>
              <input type="range" min="10" max="100" value={opacity} aria-label="Opacity"
                     style={{ "--trk": `linear-gradient(90deg,${rgba(c.hex, .12)},${c.hex})` }}
                     onChange={(e) => onOpacity(Number(e.target.value))} />
              <div className="ticks"><b>25%</b><b>50%</b><b>75%</b><b>100%</b></div>
            </div>

            {ink && (
              <div className={`fold${foldOpen ? " is-open" : ""}`}>
                <button type="button" onClick={() => setFoldOpen(!foldOpen)}>
                  Smart inking <Icon name="chevron" size={13} />
                </button>
                <div className="inner">
                  <div className="tgl">
                    <div className="lab">
                      <b>Ink to line</b><span>Snap a stroke to the shape you meant</span>
                    </div>
                    <button type="button" className={`switch${smart ? " is-on" : ""}`}
                            role="switch" aria-checked={smart} aria-label="Ink to line"
                            onClick={() => onSmart(!smart)} />
                  </div>
                  <div className="rowhead"><span>Smoothness</span><span className="pill">{smooth}%</span></div>
                  <input type="range" min="0" max="100" value={smooth} aria-label="Smoothness"
                         onChange={(e) => onSmooth(Number(e.target.value))} />
                  <div className="ticks"><b>25%</b><b>50%</b><b>75%</b><b>100%</b></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   THE ADD-TOOL SHEET — §9. The full set is always here, so nothing a student
   takes off the tray becomes unreachable.
   ------------------------------------------------------------------------ */
function AddSheet({ open, tray, cap, onAdd, onReset, meaningId, inkColour }) {
  const [tab, setTab] = useState("Mark up");
  const full = tray.length >= cap;
  return (
    <div className={`bar pop bar-add${open ? " is-open" : ""}`} aria-label="Add a tool">
      <header><h3>Add a tool</h3></header>
      <div className="satabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={tab === g}
                  className={tab === g ? "is-on" : ""} onClick={() => setTab(g)}>{g}</button>
        ))}
      </div>
      <div className="sagrid">
        {TOOLS.filter((t) => t.group === tab).map((t) => (
          <button key={t.id} type="button"
                  className={`sacell${tray.includes(t.id) ? " is-have" : ""}`}
                  data-add={t.id} onClick={() => onAdd(t.id)}>
            <span className="ic" style={t.colour
              ? { color: t.freeColour ? undefined : colourAt(meaningId).hex }
              : undefined}
              data-ink={t.freeColour ? inkColour : undefined}>
              <Icon tool={t.id} size={20} />
            </span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <div className="safoot">
        {/* When it is full it says so rather than silently refusing. */}
        <span>{full ? `Tray is full — remove one first (${cap} max)` : `${tray.length} of ${cap} on your tray`}</span>
        <u role="button" tabIndex={0} onClick={onReset}
           onKeyDown={(e) => e.key === "Enter" && onReset()}>Reset to course default</u>
      </div>
    </div>
  );
}

/* The composer for a note, a question or a correction. Not in COMPONENTS.md —
   the demo opens notes inline — so it borrows the inspector's own classes
   rather than inventing a look. */
const KINDS = [
  { id: "note", label: "Note", say: "What do you want to remember?" },
  { id: "question", label: "Question", say: "What is not landing?" },
  { id: "correction", label: "Correction", say: "What is wrong with this passage?" },
];

function Composer({ kind, onKind, quote, ring, onRing, value, onChange, onSave, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [kind]);
  const here = KINDS.find((k) => k.id === kind) || KINDS[0];
  return (
    <div className="bar pop composer" role="dialog" aria-label={here.label} aria-modal="true">
      <div className="segs" role="tablist" aria-label="What kind of mark">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id}
                  className={kind === k.id ? "is-on" : ""} onClick={() => onKind(k.id)}>{k.label}</button>
        ))}
      </div>
      <blockquote>{quote}</blockquote>
      <textarea ref={ref} rows={3} value={value} placeholder={here.say}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancel();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
                }} />
      <div className="composer-foot">
        {kind !== "correction" ? (
          <label>
            <span>Who sees it</span>
            <select value={ring} onChange={(e) => onRing(e.target.value)}>
              {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        ) : <span className="quiet">Goes to the author. Nobody else on the module sees it.</span>}
        <button type="button" className="btn primary" disabled={busy || !value.trim()} onClick={onSave}>
          {busy ? "Saving…" : kind === "question" ? "Ask" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="rdr-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bar pop rdr-sheet" role="dialog" aria-label={title} aria-modal="true">
        <header>
          <h3>{title}</h3>
          <button type="button" className="ib" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

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
  const cap = capFor(typeof window === "undefined" ? 1440 : window.innerWidth);
  /* LONG-PRESS THE DOCK TO REARRANGE IT. `-webkit-touch-callout: none` and
     `user-select: none` are on the dock in CSS, or iOS raises its own callout
     menu over this and the gesture belongs to Safari instead. */
  const [hlColour, setHlColour] = useState(() => read("pw-paper-hl", DEFAULT_MEANING));
  const [penColour, setPenColour] = useState(() => read("pw-paper-pen", DEFAULT_PEN));
  const [penSize, setPenSize] = useState(() => read("pw-paper-nib", DEFAULT_PEN_SIZE));

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

  const pickMeaning = useCallback((key) => {
    setHlColour(key);
    setRecent((r) => [key, ...r.filter((x) => x !== key)].slice(0, 3));
  }, []);
  const pickInk = useCallback((id) => setPenColour(id), []);

  const resetTool = useCallback(() => {
    if (takesFreeColour(tool)) { setPenColour(DEFAULT_PEN); setPenSize(4); }
    else { setHlColour(DEFAULT_MEANING); setHlSize(12); }
    setOpacity(takesFreeColour(tool) ? 100 : 42);
  }, [tool]);

  /* The tray. Nothing is unreachable: the Add sheet always lists the full set,
     so a tool taken off can always be found again. */
  const pushTool = useCallback((id) => {
    /* addTool returns { tray, note } — the note is why it refused, and the
       Add sheet's footer is already saying it, so a full tray is a no-op
       here rather than a second message. Reading `tray` from the closure is
       safe: this only ever runs from a click, one add at a time. */
    const { tray: next } = addTool(tray, id, TOOLS, cap);
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
    if (!e.target.closest?.(".tool")) return;
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


  /* ------------------------------------------------------------------ ink */
  /* Same optimistic shape as a mark, and for the same reason: a line that
     appears a beat after the finger lifts is a line you drew twice. */
  const addStroke = useCallback(async (pageNumber, points) => {
    if (!me || !paper?.id || !points.length) return;
    const wide = penWidth(penSize) * (tool === "mkr" ? 3.2 : 1);
    const optimistic = {
      id: tempId(), paper_id: paper.id, module_code: moduleCode, author_id: me,
      author_name: "You", page: pageNumber, tool: tool === "mkr" ? "marker" : "pen",
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
    if (!isWritten(tool)) return;
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

  if (!paper || !host) return null;

  /* THE READER FOLLOWS THE APP, and the reading light is a change ON TOP of
     it rather than a second theme.

     `data-look` decides which of the shipped palettes is in force. Defaulting
     it to "paper" meant the reader opened light inside a night app — the whole
     screen disagreeing with the one it came from. It takes the app's variant
     unless the reader's own light has been set to something that overrides it:
     Warm and Paper are light, Dim and Night are dark. */
  const look = light === "paper" ? "paper"
    : light === "night" || light === "dim" ? "night"
      : light === "sepia" ? "paper"
        : appVariant === "day" ? "paper" : "night";

  return createPortal(
    /* ONE ROOT, CARRYING THE STATE AS DATA ATTRIBUTES. The stylesheet reads
       these; they are not duplicated as classes. */
    <div className={`rdr${drawing && penDown ? " is-writing" : ""}`} ref={shellRef}
         style={accent ? {
           "--accent": accent,
           "--accent-dim": `color-mix(in srgb, ${accent} 16%, transparent)`,
         } : undefined}
         data-look={look}
         data-tool={tool}
         data-mode={mode}
         data-mark={marksText(tool) ? "1" : "0"}
         data-edit={editing ? "1" : "0"}
         data-dock={dock}
         data-panel={rail || "none"}
         data-quiet={quiet && !menu && !sheet && !composer && !editing && !adding ? "" : undefined}
         data-hush={hush ? "" : undefined}>

      {/* ── the document ─────────────────────────────────────────────── */}
      <div className="rdr-scroll" ref={scrollRef} onScroll={onScroll}
           onClick={tapToMark} onPointerUp={tapToMark}>
        {error && <p className="rdr-err">{error}</p>}

        <div className="rdr-stack" style={{ gap: PAGE_GAP }}>
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
                segments={drawSegments} activeId={activeId} light={light}
                strokes={strokes} me={me}
                inkTool={drawing ? tool : null} inkColour={penColour}
                inkWidth={penWidth(penSize) * (tool === "mkr" ? 3.2 : 1)}
                onInk={addStroke} onErase={eraseStrokes}
                onPenDown={() => setPenDown(true)} onPenUp={() => setPenDown(false)}
                registerEl={registerEl} onDivs={takeDivs}
                notes={notesOnPage(n)} onOpenThread={onOpenThread}
                onDeleteNote={removeMark}
              />
            ) : (
              /* §4.1 — NEVER a bare white box. A page-shaped card at the right
                 ratio, its number quietly in the gutter, so the scroll height
                 is right before any PDF byte arrives. */
              <article className="rdr-page is-placeholder" key={n} data-page={n}
                       style={{ width: w, height: h }}
                       ref={(el) => { if (el) pageEls.current.set(n, el); }}>
                <span className="pg-num mono">{n}</span>
                <span className="pg-label">Page {n}</span>
              </article>
            );
          })}
          {win[1] < sizes.length && (
            <div className="rdr-gap" aria-hidden="true"
                 style={{ height: Math.max(0, offsets[sizes.length] - offsets[win[1]]) }} />
          )}
        </div>

        {orphans.length > 0 && (
          <section className="rdr-orphans">
            <h2>
              {orphans.length} {orphans.length === 1 ? "mark" : "marks"} lost
              {orphans.length === 1 ? " its" : " their"} place when this paper changed
            </h2>
            <ul>
              {orphans.map((o) => (
                <li key={o.id}>
                  <span>“{o.anchor?.quote}”</span>
                  {o.body && <em>{o.body}</em>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ── marks-only revision view (§12) ───────────────────────────── */}
      <div className="rev">
        <div className="revwrap">
          <div className="revhead">
            <div>
              <h2>Marks only</h2>
              <p>
                {marksList.length
                  ? `${marksList.length} ${marksList.length === 1 ? "passage" : "passages"} across ${
                      new Set(marksList.map((m) => (model ? pageOf(model, m.start) : 0))).size} pages of this paper.`
                  : "Mark a passage and it appears here, grouped by what the colour does."}
              </p>
            </div>
            <button type="button" className="ib" aria-label="Back to the paper"
                    onClick={() => setMode("read")}>
              <Icon name="close" size={17} />
            </button>
          </div>

          <div className="revfilters">
            {FILTERS.map((f) => {
              const n = counts[f.id] || 0;
              if (!n && f.id !== "all") return null;
              return (
                <button key={f.id} type="button" className={`chp${filter === f.id ? " is-on" : ""}`}
                        onClick={() => setFilter(f.id)}>
                  {f.label}
                  {f.id !== "all" && <span style={{ color: COLOURS.find((c) => c.key === f.id)?.hex }}> {n}</span>}
                </button>
              );
            })}
          </div>

          {COLOURS.map((c) => {
            const group = marksList.filter((m) => m.colour === c.key);
            if (!group.length) return null;
            return (
              <div className="rgroup" key={c.key}>
                <div className="rgh" style={{ "--c": c.hex }}>
                  <i /><b>{c.name}</b>
                  <em>{group.length} {group.length === 1 ? "passage" : "passages"} · {c.dest}</em>
                </div>
                {group.map((m) => (
                  <div className="rcard" key={m.id} style={{ "--c": c.hex }}
                       role="button" tabIndex={0}
                       onClick={() => { setMode("read"); jumpTo(pageOf(model, m.start)); }}
                       onKeyDown={(e) => e.key === "Enter" && (setMode("read"), jumpTo(pageOf(model, m.start)))}>
                    <div className="st" />
                    <p>{m.status === "orphaned" ? (m.anchor?.quote || "This passage") : quoteOf(model, m.start, m.end, 220)}</p>
                    <span className="pg mono">p.{model ? pageOf(model, m.start) : "—"}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── top bar ──────────────────────────────────────────────────── */}
      <div className="bar bar-top">
        <button type="button" className="ib" aria-label="Back to the Library" onClick={onBack}>
          <Icon name="back" size={17} />
        </button>
        <button type="button" className={`ib${rail && rail !== "none" ? " is-on" : ""}`}
                aria-label="Pages" onClick={() => setRail(rail && rail !== "none" ? null : "thumbs")}>
          <Icon name="pages" size={17} />
        </button>
        <button type="button" className="title">
          <span className="mono mod">{moduleCode}</span><b>{paper.title}</b>
        </button>
        <span className="sep" />
        <button type="button" className="ib" aria-label="Check for new marks"
                onClick={refreshNow} disabled={refreshing}>
          <Icon name="refresh" size={17} className={refreshing ? "is-spinning" : undefined} />
          <span className="dot" hidden={!freshMarks} />
        </button>
        <button type="button" className={`ib${findOpen ? " is-on" : ""}`} aria-label="Find"
                onClick={() => setFindOpen(!findOpen)}>
          <Icon name="find" size={17} />
        </button>
        <button type="button" className={`ib${mode === "rev" ? " is-on" : ""}`} aria-label="Marks only"
                onClick={() => setMode(mode === "rev" ? "read" : "rev")}>
          <Icon name="revision" size={17} />
        </button>
        <button type="button" className={`ib${rail === "marks" ? " is-on" : ""}`} aria-label="Marks"
                onClick={() => setRail(rail === "marks" ? null : "marks")}>
          <Icon name="marks" size={17} />
          <span className="dot" hidden={!marksList.length} />
        </button>
        <button type="button" className={`ib${menu === "view" ? " is-on" : ""}`} aria-label="Reading light"
                onClick={() => setMenu(menu === "view" ? null : "view")}>
          <Icon name="light" size={17} />
        </button>
        <button type="button" className={`ib${hush ? " is-on" : ""}`}
                aria-label={hush ? "Bring the controls back" : "Just the paper"}
                onClick={() => setHush(!hush)}>
          <Icon name={hush ? "light" : "close"} size={17} />
        </button>
        <button type="button" className={`ib${menu === "more" ? " is-on" : ""}`} aria-label="More"
                onClick={() => setMenu(menu === "more" ? null : "more")}>
          <Icon name="more" size={17} />
        </button>
      </div>

      {/* ── the dock: a tray the student builds (§9) ─────────────────── */}
      <div className="bar bar-dock" ref={dockRef}
           onPointerDown={onDockPointerDown} onPointerUp={onDockPointerUp}
           onPointerLeave={onDockPointerUp} onPointerCancel={onDockPointerUp}>
        {tray.map((id, i) => {
          const t = toolAt(id);
          const prev = i > 0 ? toolAt(tray[i - 1]) : null;
          const swatch = takesFreeColour(id)
            ? INK_COLOURS.find((c) => c.id === penColour)
            : takesMeaning(id) ? colourAt(hlColour) : null;
          return (
            <span key={id} style={{ display: "contents" }}>
              {prev && prev.group !== t.group && <div className="dsep" />}
              <button type="button"
                      className={`tool${tool === id ? " is-on" : ""}${LOCKED.includes(id) ? " is-locked" : ""}`}
                      data-tool={id} draggable aria-label={t.name}
                      /* §15 — the look is the class, the meaning is the ARIA.
                         A screen reader cannot see `is-on`. */
                      aria-pressed={tool === id}
                      onClick={() => pickTool(id)}
                      onDragStart={() => (dragId.current = id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); dropTool(id); }}>
                <Icon tool={id} />
                {t.presets && <span className="cnt mono">{t.presets}</span>}
                {t.colour && (
                  <span className="swatch"
                        style={{ background: swatch ? (swatch.hex || `var(--ink-${swatch.id})`) : undefined }} />
                )}
                {t.mode && <span className="mode" />}
                <span className="x" role="button" tabIndex={-1} aria-label={`Remove ${t.name}`}
                      onClick={(e) => { e.stopPropagation(); dropFromTray(id); }}>×</span>
                <span className="tip">
                  {t.name}<kbd>{t.key}</kbd><em>{t.hint}</em>
                </span>
              </button>
            </span>
          );
        })}
        <div className="dsep" />
        <button type="button" className="addbtn" aria-label="Add a tool"
                onClick={() => { setAdding(!adding); setInspOpen(false); }}>
          <Icon name="add" size={17} />
        </button>
      </div>

      <div className="bar pop bar-edit">
        Drag to reorder · tap ✕ to remove
        <button type="button" onClick={() => setEditing(false)}>Done</button>
      </div>

      <Inspector
        open={inspOpen && !adding && !editing}
        tool={tool}
        meaningId={hlColour} inkColour={penColour}
        size={takesFreeColour(tool) ? penSize : hlSize}
        opacity={opacity} smart={smart} smooth={smooth} recent={recent}
        onMeaning={pickMeaning} onInk={pickInk}
        onSize={(v) => (takesFreeColour(tool) ? setPenSize(v) : setHlSize(v))}
        onOpacity={setOpacity} onSmart={setSmart} onSmooth={setSmooth}
        onReset={resetTool}
      />

      <AddSheet
        open={adding} tray={tray} cap={cap}
        meaningId={hlColour} inkColour={penColour}
        onAdd={(id) => { pushTool(id); }}
        onReset={() => { setTray([...DEFAULT_TRAY]); saveTray(window.innerWidth, [...DEFAULT_TRAY]); }}
      />

      {/* ── marks panel ──────────────────────────────────────────────── */}
      <div className={`bar bar-panel${rail && rail !== "none" ? " is-open" : ""}`}>
        <header>
          <div className="segs" role="tablist" aria-label="What the panel shows">
            <button type="button" role="tab" aria-selected={rail === "marks"}
                    className={rail === "marks" ? "is-on" : ""}
                    onClick={() => setRail("marks")}>Marks</button>
            <button type="button" role="tab" aria-selected={rail === "thumbs"}
                    className={rail === "thumbs" ? "is-on" : ""}
                    onClick={() => setRail("thumbs")}>Pages</button>
            <button type="button" role="tab" aria-selected={rail === "outline"}
                    className={rail === "outline" ? "is-on" : ""}
                    onClick={() => setRail("outline")}>Contents</button>
            {isStaff && (
              <button type="button" role="tab" aria-selected={rail === "queue"}
                      className={rail === "queue" ? "is-on" : ""}
                      onClick={() => setRail("queue")}>Queue</button>
            )}
          </div>
        </header>

        {rail === "marks" && (
          <>
            <div className="chips">
              {FILTERS.map((f) => {
                const n = counts[f.id] || 0;
                return (
                  <button key={f.id} type="button"
                          className={`chp${filter === f.id ? " is-on" : ""}`}
                          aria-pressed={filter === f.id}
                          disabled={!n && f.id !== "all"}
                          onClick={() => setFilter(f.id)}>
                    {f.label}
                    {/* The count is its own element, the way the reference
                       draws it — a label and a number run together read as
                       one string to anything reading the DOM. */}
                    {n > 0 && f.id !== "all" && (
                      <span style={{ color: COLOURS.find((c) => c.key === f.id)?.hex }}>{n}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="plist">
              {marksList.length ? (() => {
                let last = null;
                return marksList.map((m) => {
                  const pg = model ? pageOf(model, m.start) : 0;
                  const head = pg !== last ? (last = pg, true) : false;
                  const c = colourAt(m.colour || DEFAULT_MEANING);
                  return (
                    <span key={m.id} style={{ display: "contents" }}>
                      {head && <div className="pgh">Page {pg}</div>}
                      <div className="mrow" data-mark-id={m.id} style={{ "--c": c.hex }}
                           role="button" tabIndex={0}
                           onClick={() => { setActiveId(m.id); jumpTo(pg); }}
                           onKeyDown={(e) => e.key === "Enter" && (setActiveId(m.id), jumpTo(pg))}>
                        <div className="stripe" />
                        <div>
                          <div className="t"><b>{c.name}</b><em>p.{pg}</em></div>
                          <p>{m.status === "orphaned"
                            ? (m.anchor?.quote || "This passage")
                            : quoteOf(model, m.start, m.end, 160)}</p>
                          <div className="w">
                            {m.author_id === me ? "You" : (m.anonymous ? "Anonymous" : m.author_name)}
                            {m.status === "orphaned" ? " · couldn’t be placed" : ""}
                          </div>
                        </div>
                      </div>
                    </span>
                  );
                });
              })() : (
                /* A drawing and one useful line, never an apology.
                   COMPONENTS.md's own copy opens "Nothing matches this
                   filter." — the shape is the ship's, the sentence is not:
                   this app never states absence, it names the next action
                   (CLAUDE.md, Voice). Two cases, because they have different
                   next actions. */
                <div className="empty">
                  <Icon name="marks" size={42} />
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
          <div className="plist"><PaperOutline doc={doc} onPick={jumpTo} /></div>
        )}

        {rail === "queue" && isStaff && (
          <div className="plist">
            {queue.length ? queue.map((c) => (
              <div className="mrow" key={c.id} style={{ "--c": "var(--c-wrong)" }}>
                <div className="stripe" />
                <div>
                  <div className="t"><b>Correction</b><em>{c.author_name}</em></div>
                  <p>{c.body}</p>
                  <div className="w">
                    <button type="button" className="btn" onClick={async () => {
                      await resolveCorrection(c.id); loadQueue();
                    }}>Done with it</button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="empty">
                <Icon tool="cor" size={42} />
                Nothing reported on this module yet. A student who spots something
                wrong can tell you from the passage itself.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── tick rail (§11.2) ────────────────────────────────────────── */}
      {ticks.length > 0 && totalPages > 1 && (
        <div className="rail" title="Your marks across this paper"
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
          <div className="you" style={{ top: `${((page - 0.5) / totalPages) * 100}%` }} />
          {ticks.map((t) => (
            <div key={t.id} className={`tk${t.mine ? " is-mine" : ""}`} data-page={t.page}
                 style={{ top: `${((t.page - 0.5) / totalPages) * 100}%`,
                          "--c": colourAt(t.colour || DEFAULT_MEANING).hex }} />
          ))}
        </div>
      )}
      {railAt && (
        <div className="bar pop railtip is-open"
             style={{ top: railAt.y + 64, "--c": colourAt(ticks.find((t) => t.page === railAt.page)?.colour || DEFAULT_MEANING).hex }}>
          <b>{ticks.find((t) => t.page === railAt.page)?.name || "Page"}</b>
          <em>p.{railAt.page}</em>
        </div>
      )}

      {/* ── bottom bar ───────────────────────────────────────────────── */}
      <div className="bar bar-bot">
        <button type="button" className="ib" aria-label="Undo" onClick={undo} disabled={!canUndo}>
          <Icon name="undo" size={17} />
        </button>
        <button type="button" className="ib" aria-label="Redo" onClick={redo} disabled={!canRedo}>
          <Icon name="redo" size={17} />
        </button>
        <span className="sep" />
        <div className="pgctl">
          <button type="button" className="ib" aria-label="Previous page"
                  onClick={() => step(-1)} disabled={page <= 1}>
            <Icon name="prev" size={15} />
          </button>
          <span className="pgpill" title="Drag to fly through this paper"
                role="button" tabIndex={0}
                onPointerDown={scrubDown} onPointerMove={scrubMove}
                onPointerUp={scrubUp} onPointerCancel={scrubUp}>
            {scrub ? scrub.page : page}
          </span>
          <span className="tot">/ {totalPages || "—"}</span>
          <button type="button" className="ib" aria-label="Next page"
                  onClick={() => step(1)} disabled={page >= totalPages}>
            <Icon name="next" size={15} />
          </button>
        </div>
        <span className="sep" />
        <button type="button" className={`ib${density ? " is-on" : ""}`} aria-label="Class marks"
                onClick={() => setDensity(!density)}>
          <Icon name="density" size={17} />
        </button>
        <span className="sep" />
        <div className="zoom">
          <button type="button" className="ib" aria-label="Zoom out"
                  onClick={() => { setFit(null); setScale((z) => stepZoom(z, -1)); }}>
            <Icon name="zoomOut" size={15} />
          </button>
          <button type="button" className="v" onClick={() => setMenu(menu === "zoom" ? null : "zoom")}>
            {fit ? (FITS.find((f) => f.id === fit)?.label || "Fit width") : `${Math.round(scale * 100)}%`}
          </button>
          <button type="button" className="ib" aria-label="Zoom in"
                  onClick={() => { setFit(null); setScale((z) => stepZoom(z, 1)); }}>
            <Icon name="zoomIn" size={15} />
          </button>
        </div>
      </div>

      {/* ── scrubber, back pill, toast ───────────────────────────────── */}
      {scrub && (
        <div className="bar pop scrub is-open">
          <div className="thumb">
            <i className="t" /><i /><i /><i className="m" /><i /><i />
          </div>
          <div className="meta">
            <b className="mono">{scrub.page}</b>
            <span>of {totalPages}</span>
            {(() => {
              const near = ticks.filter((t) => Math.abs(t.page - scrub.page) <= 2).length;
              return near > 0 ? <u>{near} {near === 1 ? "mark" : "marks"} near here</u> : null;
            })()}
          </div>
        </div>
      )}

      {cameFrom && cameFrom.page !== page && (
        <div className="bar pop back is-open">
          <b className="mono">Back to page {cameFrom.page}</b>
          <button type="button" className="ib" aria-label="Go back"
                  onClick={() => {
                    goToPage(cameFrom.page);
                    if (scrollRef.current && cameFrom.top != null) scrollRef.current.scrollTop = cameFrom.top;
                    setCameFrom(null);
                  }}>
            <Icon name="backTo" size={16} />
          </button>
        </div>
      )}

      {toast && (
        <div className="bar pop toast is-open" role="status">
          <span>{toast.text}</span>
          {toast.action && <button type="button" onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}

      {/* ── find ─────────────────────────────────────────────────────── */}
      {findOpen && (
        <div className="bar pop findbar is-open">
          <Icon name="find" size={15} />
          <input autoFocus value={query} placeholder="Find in this paper" aria-label="Find in this paper"
                 onChange={(e) => { setQuery(e.target.value); setFindAt(0); }}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") setFindAt((i) => (finds.length ? (i + (e.shiftKey ? -1 : 1) + finds.length) % finds.length : 0));
                   if (e.key === "Escape") { setFindOpen(false); setQuery(""); }
                 }} />
          <button type="button" className={`chp${matchCase ? " is-on" : ""}`} title="Match case"
                  onClick={() => setMatchCase(!matchCase)}>Aa</button>
          <button type="button" className={`chp${wholeWord ? " is-on" : ""}`} title="Whole words only"
                  onClick={() => setWholeWord(!wholeWord)}>Ab|</button>
          <span className="tot">
            {query.trim() ? (finds.length ? `${findAt + 1} of ${finds.length}` : "Nothing yet") : ""}
          </span>
          <button type="button" className="ib" aria-label="Previous match"
                  onClick={() => setFindAt((i) => (finds.length ? (i - 1 + finds.length) % finds.length : 0))}>
            <Icon name="prev" size={15} />
          </button>
          <button type="button" className="ib" aria-label="Next match"
                  onClick={() => setFindAt((i) => (finds.length ? (i + 1) % finds.length : 0))}>
            <Icon name="next" size={15} />
          </button>
          <button type="button" className="ib" aria-label="Close find"
                  onClick={() => { setFindOpen(false); setQuery(""); }}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {/* ── menus ────────────────────────────────────────────────────── */}
      {menu && <button type="button" className="rdr-scrim-quiet" aria-label="Close menu" onClick={closeMenus} />}

      {menu === "zoom" && (
        <div className="bar pop rdr-menu rdr-menu-zoom" role="menu" aria-label="Zoom">
          {FITS.map((f) => (
            <button key={f.id} type="button" role="menuitemradio" aria-checked={fit === f.id}
                    onClick={() => { setFit(f.id); if (f.id === "actual") setScale(1); closeMenus(); }}>
              {f.label}
            </button>
          ))}
          <span className="dsep" />
          {ZOOM_STEPS.filter((z) => z >= 0.5 && z <= 4).map((z) => (
            <button key={z} type="button" role="menuitemradio"
                    aria-checked={!fit && Math.abs(scale - z) < 0.005}
                    onClick={() => { setFit(null); setScale(clampZoom(z)); closeMenus(); }}>
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      )}

      {menu === "view" && (
        <div className="bar pop rdr-menu rdr-menu-view" role="menu" aria-label="How the page is shown">
          <p className="rdr-menu-head">Pages</p>
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={layout === l.id}
                    onClick={() => { setLayout(l.id); closeMenus(); }}>{l.label}</button>
          ))}
          <span className="dsep" />
          <p className="rdr-menu-head">Light</p>
          <div className="rdr-lights" role="radiogroup" aria-label="Light">
            {PAPER_LIGHTS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={light === l.id}
                      className={`chp${light === l.id ? " is-on" : ""}`} data-light={l.id}
                      onClick={() => setLight(l.id)}>{l.label}</button>
            ))}
          </div>
          <span className="dsep" />
          <button type="button" role="menuitem" onClick={() => setRotation((r) => (r + 270) % 360)}>Turn left</button>
          <button type="button" role="menuitem" onClick={() => setRotation((r) => (r + 90) % 360)}>Turn right</button>
          <button type="button" role="menuitem" onClick={() => { toggleFull(); closeMenus(); }}>
            {full ? "Leave full screen" : "Full screen"}
          </button>
        </div>
      )}

      {menu === "more" && (
        <div className="bar pop rdr-menu" role="menu" aria-label="More">
          <label className="rdr-menu-pick">
            <span>New marks seen by</span>
            <select value={ring} onChange={(e) => setRing(e.target.value)}>
              {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="rdr-menu-pick">
            <span>Tools on</span>
            <select value={dock} onChange={(e) => setDock(e.target.value)}>
              {DOCKS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <span className="dsep" />
          <button type="button" role="menuitem" onClick={() => { printNow(); closeMenus(); }}>Print</button>
          <a role="menuitem" href={url} download onClick={closeMenus}>Download</a>
          <button type="button" role="menuitem" onClick={() => { onOpenOriginal?.(paper); closeMenus(); }}>
            Open the original
          </button>
          <span className="dsep" />
          <button type="button" role="menuitem" onClick={() => { setSheet("details"); closeMenus(); }}>
            Document details
          </button>
          <button type="button" role="menuitem" onClick={() => { setSheet("keys"); closeMenus(); }}>
            Keyboard shortcuts
          </button>
        </div>
      )}

      {/* ── the mark card ────────────────────────────────────────────── */}
      {picked && (
        <MarkCard
          mark={picked.mark} me={me} at={picked.at}
          onHold={holdCard} onLeave={leaveCard}
          onRecolour={recolour} onDelete={(m) => { removeMark(m); setPicked(null); }}
          onNote={(m) => openNoteOn(m)} onAgree={agree}
          onThread={(m) => onOpenThread?.(m.thread_id)}
        />
      )}

      {composer && (
        <div className="rdr-scrim" onClick={(e) => { if (e.target === e.currentTarget) setComposer(null); }}>
          <Composer kind={composer.kind}
                    onKind={(k) => { setComposer((c) => ({ ...c, kind: k })); if (k === "correction") setRing("solo"); }}
                    quote={composer.quote} ring={ring} onRing={setRing}
                    value={draft} onChange={setDraft} busy={busy}
                    onSave={saveComposer} onCancel={() => setComposer(null)} />
        </div>
      )}

      {sheet === "keys" && (
        <Sheet title="Keyboard shortcuts" onClose={() => setSheet(null)}>
          <dl className="rdr-keys">
            {SHORTCUTS.map(([k, what]) => <div key={k}><dt className="mono">{k}</dt><dd>{what}</dd></div>)}
          </dl>
        </Sheet>
      )}

      {sheet === "details" && (
        <Sheet title="Document details" onClose={() => setSheet(null)}>
          <dl className="rdr-keys">
            <div><dt>Title</dt><dd>{info.Title || paper.title}</dd></div>
            {info.Author && <div><dt>Author</dt><dd>{info.Author}</dd></div>}
            <div><dt>Pages</dt><dd className="mono">{totalPages}</dd></div>
            <div><dt>Size</dt><dd className="mono">{paper.bytes ? `${(paper.bytes / 1e6).toFixed(1)} MB` : "—"}</dd></div>
            <div><dt>Loads by range</dt><dd>{paper.linearized ? "Yes — linearized" : "Slower — not linearized"}</dd></div>
            <div><dt>Searchable</dt><dd>{paper.has_text === false ? "No text layer in this file" : "Yes"}</dd></div>
            <div><dt>Drawn by</dt><dd className="mono">pdf.js {PDFJS_VERSION}</dd></div>
          </dl>
        </Sheet>
      )}
    </div>,
    host,
  );
}
