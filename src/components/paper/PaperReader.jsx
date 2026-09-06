import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, ChevronRight, ChevronDown, Search, X, Minus, Plus,
  RotateCw, Download, Printer, PanelLeft, Highlighter, MessageSquare,
  HelpCircle, Flag, Trash2, RefreshCw, MousePointer2,
} from "lucide-react";
import { loadPaper, paperText, quoteOf, pageOf, PDFJS_VERSION } from "../../lib/paperText.js";
import {
  resolveAll, segmentsFor, anchorFor, mergeRows, sentenceAround,
  applyFilter, FILTERS, RINGS, ringLabel, DOCKS, TOOL_SIZES,
} from "../../lib/paperMarks.js";
import {
  fetchAnnotations, createAnnotation, deleteAnnotation,
  markOrphaned, askOnPassage, fetchCorrections, resolveCorrection,
} from "../../lib/annotations.js";
import PaperPage from "./PaperPage.jsx";
import PaperThumbs from "./PaperThumbs.jsx";
import "./paper.css";

/* =============================================================================
   THE PAPER READER

   The layout is the one every reader already knows, because a student opening a
   handout should not have to learn anything: a slim bar across the top, a page
   rail down the left, and the pages themselves in one continuous scroll. Page
   number and zoom sit where Preview and Chrome put them. Nothing here is
   clever, and that is the point — the only unfamiliar thing in this screen
   should be the marking, and even that is one tap on a selection.

   What is NOT the familiar reader: there is no margin rail of comments. Notes
   open in the flow, under the page they belong to, on a phone and on a desktop
   alike (R6). A rail would have meant two layouts and a column of orphaned
   speech bubbles pointing at nothing.
   ========================================================================= */

/* THE TOOL RAIL — Drawboard's shape, inside this app's rules.

   Drawboard puts the marking tools in a vertical rail down the left and shows
   the active tool's properties beside it; Edge puts the document controls in
   one slim bar across the top. This screen does both, because they answer
   different questions: the top bar is "where am I in this paper", the rail is
   "what happens when I select something".

   What it deliberately does NOT borrow is the colour palette. Every reader
   like this offers six highlighter colours, and R14 allows one accent off the
   livery — the density layer IS that accent at low alpha, so a second colour
   would stop meaning anything the moment two people used it differently. The
   property a mark actually has here is who can see it, so that is what the
   properties row carries. */
const TOOLS = [
  { id: "select", label: "Select", hint: "Drag to select. The bar that appears offers everything below.", icon: <MousePointer2 size={17} aria-hidden="true" /> },
  { id: "highlight", label: "Highlight", hint: "Select any line and it is marked. Nothing to type.", icon: <Highlighter size={17} aria-hidden="true" /> },
  { id: "note", label: "Note", hint: "Tap a line, or select one. Write what you want to remember.", icon: <MessageSquare size={17} aria-hidden="true" /> },
  { id: "question", label: "Question", hint: "Tap a line, or select one. It opens a thread in the Ready Room.", icon: <HelpCircle size={17} aria-hidden="true" /> },
  { id: "correction", label: "Correction", hint: "Select what is wrong. Only the author ever sees it.", icon: <Flag size={17} aria-hidden="true" /> },
];

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const PAGE_GAP = 18;
const WINDOW = 2;              // pages either side of the viewport that render

const nearest = (z) => ZOOMS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a), ZOOMS[0]);
const tempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ---------------------------------------------------------------------------
   The bar that appears over a selection. R5: the first and largest control is
   the highlight, and it needs nothing typed.
   ------------------------------------------------------------------------ */
function SelectionBar({ at, onHighlight, onNote, onAsk, onCorrect, canCorrect }) {
  if (!at) return null;
  return (
    <div className="selbar" style={{ left: at.x, top: at.y }} role="toolbar" aria-label="Mark this passage">
      <button type="button" className="selbar-main" onClick={onHighlight}>
        <Highlighter size={16} aria-hidden="true" /> Highlight
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

/* A note in the flow, under the page it belongs to. */
function MarkCard({ mark, me, onOpenThread, onDelete, onJump, active }) {
  const kindWord = mark.kind === "question" ? "asked" : "noted";
  return (
    <article className={`mcardp ${active ? "is-active" : ""}`} data-kind={mark.kind}>
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

/* ========================================================================= */
export default function PaperReader({
  paper, moduleCode, me, isStaff = false, onBack, onOpenThread, onOpenOriginal, onPlace,
}) {
  const url = paper ? `/${String(paper.file).replace(/^\//, "")}` : null;

  const [doc, setDoc] = useState(null);
  const [model, setModel] = useState(null);
  const [sizes, setSizes] = useState([]);          // page sizes at scale 1
  const [error, setError] = useState(null);

  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState("width");
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [rail, setRail] = useState("thumbs");      // thumbs | marks | null

  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [density, setDensity] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const [tool, setTool] = useState("select");
  /* Where the rail sits and how big it is. localStorage and not the account,
     for the same reason the player bar's position is: it belongs to the screen
     in front of you. A phone and a laptop should not argue about it. */
  const [dock, setDock] = useState(() => {
    try { return localStorage.getItem("pw-paper-dock") || "left"; } catch { return "left"; }
  });
  const [toolSize, setToolSize] = useState(() => {
    try { return localStorage.getItem("pw-paper-toolsize") || "m"; } catch { return "m"; }
  });
  const [dockOpen, setDockOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem("pw-paper-dock", dock); } catch { /* private */ } }, [dock]);
  useEffect(() => { try { localStorage.setItem("pw-paper-toolsize", toolSize); } catch { /* private */ } }, [toolSize]);
  const [sel, setSel] = useState(null);            // { start, end, x, y }
  const [composer, setComposer] = useState(null);  // { kind, start, end, quote }
  const [draft, setDraft] = useState("");
  const [ring, setRing] = useState("module");
  const [busy, setBusy] = useState(false);

  const [queue, setQueue] = useState([]);
  const [query, setQuery] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findAt, setFindAt] = useState(0);

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

  /* ------------------------------------------------------------- the paper */
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    setError(null);
    (async () => {
      try {
        const d = await loadPaper(url);
        if (!live) return;
        setDoc(d);
        // Every page's size up front, so a page that has not rendered yet still
        // holds the right amount of room and the scrollbar never lies.
        const all = [];
        for (let n = 1; n <= d.numPages; n++) {
          const v = (await d.getPage(n)).getViewport({ scale: 1 });
          all.push({ w: v.width, h: v.height });
        }
        if (!live) return;
        setSizes(all);
        const m = await paperText(url);
        if (live) setModel(m);
      } catch (e) {
        console.error(e);
        if (live) setError("This paper would not open. The original still will.");
      }
    })();
    return () => { live = false; };
  }, [url]);

  /* --------------------------------------------------------------- the fit */
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !sizes.length) return;
    const first = sizes[0];
    const rotated = rotation % 180 !== 0;
    const w = rotated ? first.h : first.w;
    const h = rotated ? first.w : first.h;
    const room = el.clientWidth - 48;
    const tall = el.clientHeight - 48;
    if (fit === "width") setScale(Math.max(0.25, Math.min(3, room / w)));
    else if (fit === "page") setScale(Math.max(0.25, Math.min(3, Math.min(room / w, tall / h))));
  }, [sizes, fit, rotation]);

  useEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [measure]);

  /* --------------------------------------------------------------- reading */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight * 0.35;
    let best = 1;
    for (const [n, node] of pageEls.current) {
      if (node && node.offsetTop <= mid) best = Math.max(best, n);
    }
    setPage(best);
  }, []);

  const goToPage = useCallback((n) => {
    const node = pageEls.current.get(n);
    if (!node || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: node.offsetTop - 12, behavior: "auto" });
    setPage(n);
  }, []);

  /* ------------------------------------------------------------ the marks */
  const syncFromServer = useCallback(async (merge = false) => {
    if (!me || !paper?.id) return;
    const incoming = await fetchAnnotations(me, paper.id, null);
    lastSync.current = new Date().toISOString();
    // Merge rather than replace on a refresh, so a mark made a second ago and
    // still in flight is not wiped by the answer to a question asked before it.
    setRows((held) => (merge ? mergeRows(held, incoming) : incoming));
  }, [me, paper?.id]);

  useEffect(() => {
    setRows([]); lastSync.current = null;
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
  const finds = useMemo(() => {
    const q = query.trim();
    if (!q || !model?.text) return [];
    const hay = model.text.toLowerCase();
    const needle = q.toLowerCase();
    const out = [];
    for (let at = hay.indexOf(needle); at !== -1 && out.length < 500; at = hay.indexOf(needle, at + 1)) {
      out.push({ start: at, end: at + needle.length });
    }
    return out;
  }, [query, model]);

  const drawSegments = useMemo(() => {
    const base = density ? segments : segments.filter((s) => s.mine.length);
    const hits = finds.map((f, i) => ({
      start: f.start, end: f.end, count: 1, mine: [], ids: [`find:${i}`],
      kind: i === findAt ? "find-current" : "find", density: 0,
    }));
    return [...base, ...hits];
  }, [segments, finds, findAt, density]);

  /* ------------------------------------------------------------ selection */
  const locate = useCallback((node, offset) => {
    const el = node?.nodeType === 3 ? node.parentElement : node;
    const span = el?.closest?.("[data-item]");
    if (!span) return null;
    const pageEl = span.closest("[data-page]");
    const n = Number(pageEl?.dataset.page);
    const entry = divsByPage.current.get(n);
    if (!entry) return null;
    const item = entry.items[Number(span.dataset.item)];
    if (!item) return null;
    return item.start + Math.min(offset, item.str.length);
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
    const host = scrollRef.current?.getBoundingClientRect();
    if (!host) return;
    setSel({
      start: Math.min(a, b),
      end: Math.max(a, b),
      x: Math.max(12, Math.min(box.left - host.left + box.width / 2, host.width - 12)),
      y: Math.max(8, box.top - host.top - 8),
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

  /* R8 — your own marks are instant. The row goes in with a temporary id on the
     frame the button is pressed and is reconciled when the insert returns. On
     failure it is removed and the reason is said out loud, rather than left
     sitting there looking saved. */
  const addMark = useCallback(async ({ kind, start, end, body = null, ringId, threadId = null }) => {
    if (!model || !me) return null;
    const anchor = anchorFor(model.text, start, end);
    const optimistic = {
      id: tempId(), paper_id: paper.id, module_code: moduleCode, author_id: me,
      author_name: "You", kind, ring: ringId || ring, body, thread_id: threadId,
      anchor, status: "ok", close: true, created_at: new Date().toISOString(),
    };
    setRows((held) => [...held, optimistic]);
    const saved = await createAnnotation({
      paperId: paper.id, moduleCode, me, kind, ring: ringId || ring, body, anchor, threadId,
    });
    setRows((held) => (saved
      ? held.map((r) => (r.id === optimistic.id ? { ...saved, author_name: "You", close: true } : r))
      : held.filter((r) => r.id !== optimistic.id)));
    if (!saved) setError("That mark did not save. Nothing else was touched.");
    return saved;
  }, [model, me, paper, moduleCode, ring]);

  const highlightNow = useCallback(async () => {
    if (!sel) return;
    const { start, end } = sel;
    clearSelection();
    await addMark({ kind: "highlight", start, end });
  }, [sel, addMark]);

  const tapToMark = useCallback((e) => {
    if (tool !== "note" && tool !== "question" && tool !== "correction") return;
    if (!model) return;
    if (window.getSelection()?.toString().trim()) return;      // a drag, not a tap
    if (e.target.closest?.("button, a, input, textarea, select, .mcardp, .spot")) return;
    const at = offsetFromPoint(e.clientX, e.clientY);
    if (at == null) return;
    const span = sentenceAround(model.text, at);
    if (!span) return;
    setComposer({ kind: tool, start: span.start, end: span.end, quote: quoteOf(model, span.start, span.end) });
    setDraft("");
    if (tool === "correction") setRing("solo");
  }, [tool, model, offsetFromPoint]);

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
    if (!sel || tool === "select") return;
    const made = sel;
    if (tool === "highlight") {
      clearSelection();
      addMark({ kind: "highlight", start: made.start, end: made.end });
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
    setRows((held) => held.filter((r) => r.id !== mark.id));
    await deleteAnnotation(mark.id);
  };

  /* ------------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.("input, textarea, select")) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "f") { e.preventDefault(); setFindOpen(true); return; }
      if (cmd && (e.key === "=" || e.key === "+")) { e.preventDefault(); setFit(null); setScale((z) => nearest(z * 1.15)); return; }
      if (cmd && e.key === "-") { e.preventDefault(); setFit(null); setScale((z) => nearest(z / 1.15)); return; }
      if (cmd && e.key === "0") { e.preventDefault(); setFit("width"); return; }
      if (e.key === "Escape") { setComposer(null); setFindOpen(false); setSel(null); return; }
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goToPage(Math.min(sizes.length, page + 1)); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goToPage(Math.max(1, page - 1)); }
      if (e.key === "Home") { e.preventDefault(); goToPage(1); }
      if (e.key === "End") { e.preventDefault(); goToPage(sizes.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, sizes.length, goToPage]);

  /* Where you got to, so the Library can offer to put you back. Written on the
     page you settle on rather than on every scroll event. */
  useEffect(() => {
    if (!page || !onPlace) return undefined;
    const t = setTimeout(() => onPlace(page), 600);
    return () => clearTimeout(t);
  }, [page, onPlace]);

  useEffect(() => {
    if (!finds.length) return;
    const n = pageOf(model, finds[Math.min(findAt, finds.length - 1)].start);
    goToPage(n);
  }, [findAt, finds, model, goToPage]);

  /* ---------------------------------------------------------------- render */
  const notesOnPage = useCallback(
    (n) => shown.filter((a) => (a.kind === "note" || a.kind === "question") && a.body
      && pageOf(model, a.start) === n)
      .map((a) => ({ ...a, quote: quoteOf(model, a.start, a.end, 120) })),
    [shown, model],
  );

  const visible = (n) => Math.abs(n - page) <= WINDOW;
  const marksList = applyFilter([...placed, ...orphans.map((o) => ({ ...o, status: "orphaned" }))], filter, me);

  if (!paper || !host) return null;

  return createPortal(
    <div className="paper" data-rail={rail || "none"} data-dock={dock} data-toolsize={toolSize}>
      {/* ------------------------------------------------------------ bar */}
      <header className="pbar">
        <div className="pbar-l">
          <button type="button" className="ptool" onClick={onBack} aria-label="Back to the Library">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-pressed={rail ? "true" : "false"}
                  aria-label="Page rail" onClick={() => setRail(rail ? null : "thumbs")}>
            <PanelLeft size={17} aria-hidden="true" />
          </button>
          <h1 className="pbar-title">{paper.title}</h1>
        </div>

        <div className="pbar-c">
          <button type="button" className="ptool" aria-label="Previous page"
                  onClick={() => goToPage(Math.max(1, page - 1))} disabled={page <= 1}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="pnum">
            <input value={page} aria-label="Page"
                   onChange={(e) => {
                     const n = Number(e.target.value.replace(/\D/g, ""));
                     if (n >= 1 && n <= sizes.length) goToPage(n);
                   }} />
            <span>/ {sizes.length || paper.pages || "—"}</span>
          </span>
          <button type="button" className="ptool" aria-label="Next page"
                  onClick={() => goToPage(Math.min(sizes.length, page + 1))} disabled={page >= sizes.length}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <span className="pbar-rule" aria-hidden="true" />

          <button type="button" className="ptool" aria-label="Zoom out"
                  onClick={() => { setFit(null); setScale((z) => nearest(z / 1.15)); }}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <button type="button" className="pzoom" onClick={() => setFit(fit === "width" ? "page" : "width")}>
            {Math.round(scale * 100)}%
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" aria-label="Zoom in"
                  onClick={() => { setFit(null); setScale((z) => nearest(z * 1.15)); }}>
            <Plus size={16} aria-hidden="true" />
          </button>
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
          {/* Optional on a phone. Marked rather than duplicated into a
              second toolbar: the strip wrapped to three rows at 390px and ate
              a fifth of the screen, and rotate and print are the two controls
              nobody reaches for on a handset. */}
          <button type="button" className="ptool" data-optional="" aria-label="Rotate"
                  onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw size={16} aria-hidden="true" />
          </button>
          <button type="button" className="ptool" data-optional="" aria-label="Print" onClick={() => onOpenOriginal?.(paper)}>
            <Printer size={16} aria-hidden="true" />
          </button>
          <a className="ptool" href={url} download aria-label="Download the original">
            <Download size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      {findOpen && (
        <div className="findbar">
          <Search size={15} aria-hidden="true" />
          <input autoFocus value={query} placeholder="Find in this paper"
                 onChange={(e) => { setQuery(e.target.value); setFindAt(0); }}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") setFindAt((i) => (finds.length ? (i + (e.shiftKey ? -1 : 1) + finds.length) % finds.length : 0));
                   if (e.key === "Escape") { setFindOpen(false); setQuery(""); }
                 }} />
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

      {/* Drawboard's rail, and the properties row that belongs to it. */}
      <div className="ptools" role="toolbar" aria-label="Marking tools" aria-orientation="vertical">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="ptoolbtn" aria-pressed={tool === t.id}
                  aria-label={t.label} title={t.label} onClick={() => setTool(t.id)}>
            {t.icon}
          </button>
        ))}

        <span className="ptools-gap" aria-hidden="true" />

        <button type="button" className="ptoolbtn" aria-label="Where the tools sit"
                aria-expanded={dockOpen ? "true" : "false"} title="Where the tools sit"
                onClick={() => setDockOpen(!dockOpen)}>
          <PanelLeft size={16} aria-hidden="true" />
        </button>

        {dockOpen && (
          <div className="dockpop" role="dialog" aria-label="Where the tools sit">
            <p className="dockpop-h">Side</p>
            <div className="dockpop-row">
              {DOCKS.map((d) => (
                <button key={d.id} type="button" aria-pressed={dock === d.id}
                        onClick={() => setDock(d.id)}>{d.label}</button>
              ))}
            </div>
            <p className="dockpop-h">Size</p>
            <div className="dockpop-row">
              {TOOL_SIZES.map((z) => (
                <button key={z.id} type="button" aria-pressed={toolSize === z.id}
                        onClick={() => setToolSize(z.id)}>{z.label}</button>
              ))}
            </div>
            <button type="button" className="dockpop-done" onClick={() => setDockOpen(false)}>Done</button>
          </div>
        )}
      </div>

      <div className="pprops">
        <span className="pprops-what">{TOOLS.find((t) => t.id === tool)?.label}</span>
        <span className="pprops-hint">{TOOLS.find((t) => t.id === tool)?.hint}</span>
        {tool !== "select" && tool !== "correction" && (
          <label className="pprops-ring">
            <span>Who sees it</span>
            <select value={ring} onChange={(e) => setRing(e.target.value)}>
              {RINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="pbody">
        {/* ------------------------------------------------------- the rail */}
        {rail && (
          <aside className="prail" aria-label="Pages and marks">
            <div className="prail-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={rail === "thumbs"}
                      onClick={() => setRail("thumbs")}>Pages</button>
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
              <PaperThumbs doc={doc} pages={sizes.length} current={page} onPick={goToPage} />
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
                <div className="chips" role="group" aria-label="Filter marks">
                  {FILTERS.map((f) => (
                    <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}>{f.label}</button>
                  ))}
                </div>
                {marksList.length ? (
                  <ul className="mlist">
                    {marksList.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="mrow" data-kind={a.kind}
                                data-orphan={a.status === "orphaned" ? "" : undefined}
                                onClick={() => {
                                  if (a.status === "orphaned") return;
                                  setActiveId(a.id);
                                  goToPage(pageOf(model, a.start));
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

        {/* ------------------------------------------------------ the pages */}
        <div className="pscroll" ref={scrollRef} onScroll={onScroll} onClick={tapToMark}>
          {error && <p className="perr">{error}</p>}

          <div className="pcol" style={{ gap: PAGE_GAP }}>
            {sizes.map((s, i) => {
              const n = i + 1;
              const rotated = rotation % 180 !== 0;
              const w = (rotated ? s.h : s.w) * scale;
              const h = (rotated ? s.w : s.h) * scale;
              return (
                <div className="pslot" key={n}>
                  {visible(n) ? (
                    <PaperPage
                      doc={doc} model={model} pageNumber={n} scale={scale} rotation={rotation}
                      segments={drawSegments} activeId={activeId}
                      registerEl={registerEl} onDivs={takeDivs}
                    />
                  ) : (
                    <div className="pp pp-ghost" data-page={n} style={{ width: w, height: h }}
                         ref={(el) => { if (el) pageEls.current.set(n, el); }} />
                  )}

                  {notesOnPage(n).map((mark) => (
                    <MarkCard key={mark.id} mark={mark} me={me} active={activeId === mark.id}
                              onOpenThread={onOpenThread} onDelete={removeMark}
                              onJump={(m) => { setActiveId(m.id); goToPage(pageOf(model, m.start)); }} />
                  ))}
                </div>
              );
            })}
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

          <p className="pcoda">
            That is all of {paper.title} — {sizes.length || paper.pages} page
            {(sizes.length || paper.pages) === 1 ? "" : "s"}. Marked with pdf.js {PDFJS_VERSION}.
          </p>

          <SelectionBar
            at={sel} canCorrect={!!me}
            onHighlight={highlightNow}
            onNote={() => openComposer("note")}
            onAsk={() => openComposer("question")}
            onCorrect={() => openComposer("correction")}
          />
        </div>
      </div>

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

      <div className="pfoot">
        <label className="dtoggle">
          <input type="checkbox" checked={density} onChange={(e) => setDensity(e.target.checked)} />
          <span>Show what the module marked</span>
        </label>
        {isStaff && <span className="pstaff">Author view</span>}
      </div>
    </div>,
    host,
  );
}
