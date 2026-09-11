import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadPaper, releasePaper, paperText, warmWorker } from "../../../lib/paperText.js";
import { setRasterFocus } from "../../../lib/rasterBudget.js";
import { fileHref, storedText } from "../../../lib/papers.js";
import { LIVERIES, deckVars, DEFAULT_LIVERY } from "../../../lib/liveryEngine.js";
import { mountWM } from "./part1.js";
import { mountIsland } from "./part2.js";
import { mountToolbar } from "./part3.js";
import { mountPanel } from "./part4.js";
import { capture } from "./mount.js";
import { createMarkStore } from "./marks.js";
import SheetPage from "./SheetPage.jsx";
import "./reader.css";
import "./additions.css";

/* =============================================================================
   THE PAPERS READER

   HANDOVER.md, "The one rule": the chrome is finished, copy it. So the DOM
   below is reader.html, and the behaviour is reader.js, generated into
   ./part{1,2,3,4}.js by scripts/build-reader-v6.mjs with every departure
   listed. Nothing in this file styles anything or decides how anything looks.

   What this file owns is the two things the handover says to replace, and the
   plumbing between them and the chrome:

     the paper    #stage, rendered from PDF.js in the element shape section 1
                  fixes, as a window of pages with spacers holding the rest
     the data     marks, ink, settings and who the student is

   THE CHROME PAINTS ITSELF. React renders this shell once and then keeps its
   hands off: the island's tray, the tool rail, the popovers and the panel are
   all built imperatively by the parts, into elements React renders empty and
   never gives children to. That is not a compromise — it is what "copy it"
   means when the thing being copied is 1300 lines of DOM code that was
   finished before this file existed.
   ========================================================================= */

export const warm = () => warmWorker();

/* reader.css: `.sheetpg { width: var(--pw); max-width: calc(100% - 210px) }`,
   and applyPage() writes `--pw: 720 * zoom/100`. Restated here because the
   raster has to be sized before it is drawn — but only as a first guess: the
   page's real width is measured once it is on screen and the measurement
   wins, so a change to either value in the stylesheet corrects itself on the
   next frame rather than drifting. */
const BASE_W = 720;
const CLEARS = 210;
const PAGE_GAP = 22;              // `.sheetpg { margin: 0 auto 22px }`
const WINDOW = 2;                 // the page in view plus two either side
const GRID = 40;                  // the page selector's reach, either way
const POLL_MS = 60_000;

/* A livery's accent, through the app's own engine rather than a second table
   of colours. `--active` is the accent token every other screen paints with. */
const accentOf = (id, variant) => deckVars(id, variant).C.active;

const read = (k, f) => { try { return localStorage.getItem(k) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private */ } };
const readJSON = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };

export default function ReaderV6({
  paper, moduleCode, me, onBack, onOpenThread, onOpenOriginal, onPlace,
  livery = DEFAULT_LIVERY, variant = "night", onLivery,
}) {
  const url = paper ? fileHref(paper.file) : null;
  const key = `pw-rdr6-${paper?.id || "none"}`;

  const [doc, setDoc] = useState(null);
  const [model, setModel] = useState(null);
  const [sizes, setSizes] = useState([]);
  const [outline, setOutline] = useState([]);
  const [error, setError] = useState(null);

  /* What the island owns, mirrored here because the stage has to draw at it.
     The island is the writer; these are a copy kept in step through ctx. */
  const [zoom, setZoom] = useState(100);
  const [rot, setRot] = useState(0);
  const [page, setPage] = useState(1);
  const [stageW, setStageW] = useState(0);
  const [measured, setMeasured] = useState(0);
  const [bookmarks, setBookmarks] = useState(() => readJSON(`${key}-bm`, []));

  /* WHY THE READER IS PORTALLED, AND WHY TO `.app` RATHER THAN THE BODY.
     Rendered where the route puts it, the reader came up as a WHITE STRIP
     across the middle of the screen with the app's own header painted on top
     of it — measured, not guessed: `.deck` two ancestors up is
     `position:relative; z-index:1`, which is a stacking context, so a fixed
     child at z-index 60 is still capped at the deck's level 1 and the header
     at 20 wins. `.deck-inner` above it carries `.route-fade`, which animates
     opacity on every navigation and takes its own composited layer, so a
     fixed descendant is painted against that layer rather than against the
     window — and on this route that layer is a few pixels tall. Hence a strip.

     `.app` and not `document.body`: the Smooth Air rules are written
     `.app.smooth-air ...`, and a portal to the body would take the reader out
     of their reach and quietly stop it respecting the preference. */
  const [host] = useState(() => (typeof document === "undefined"
    ? null
    : document.querySelector(".app") || document.body));

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const store = useRef(null);
  /* Owned here rather than by the mark store, because the pages exist before
     the store does — see the note in marks.js. */
  const live = useRef({ pages: new Map() });
  /* The panel looks names up in this on every paint, so it is one object that
     is written into rather than a value that is passed. An id it has never
     seen shows as "Someone" until the profile lands, which is a name arriving
     late — never a name being wrong. */
  const people = useRef({ anon: { n: "Anonymous", i: "?" } });
  const chrome = useRef({});
  const island = useRef(null);
  const panel = useRef(null);

  /* ------------------------------------------------------------- the paper
     THE SIDECARS FIRST, AND THE PDF ONLY FOR PIXELS. Never touch the file for
     anything the manifest can answer: asking the document for all 1012
     viewports made 1012 range requests before anything drew, measured at
     119MB over the wire on a 44MB file, and the first page never appeared. */
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    setError(null);
    (async () => {
      try {
        const boxes = paper?.manifest?.boxes;
        if (boxes?.length) setSizes(boxes.map((b) => ({ w: b.w, h: b.h })));

        /* NOT AWAITED. It is 3MB on a long manual and nothing on screen needs
           it — the pages draw without it, and marks resolve against it when it
           lands. Awaiting it put three seconds between opening a paper and
           seeing any of it. */
        const textPromise = paper?.manifest ? storedText(paper) : Promise.resolve(null);
        textPromise.then((t) => { if (live && t) setModel(t); });

        const d = await loadPaper(url, paper?.bytes);
        if (!live) return;
        setDoc(d);

        if (!boxes?.length) {
          const all = [];
          for (let n = 1; n <= d.numPages; n++) {
            const p = await d.getPage(n);
            const v = p.getViewport({ scale: 1 });
            all.push({ w: v.width, h: v.height });
            p.cleanup();
          }
          if (live) setSizes(all);
        }

        /* The paper's own headings, for the panel's page groups and its page
           selector. One call, resolved to page numbers once. */
        d.getOutline().then(async (items) => {
          if (!live || !items?.length) return;
          const out = [];
          for (const it of items.slice(0, 400)) {
            try {
              const dest = typeof it.dest === "string" ? await d.getDestination(it.dest) : it.dest;
              const i = dest ? await d.getPageIndex(dest[0]) : null;
              if (i != null) out.push({ pg: i + 1, title: it.title });
            } catch { /* a destination that does not resolve is not a heading */ }
          }
          out.sort((a, b) => a.pg - b.pg);
          if (live) setOutline(out);
        }).catch(() => {});

        if (!(await textPromise)) {
          const m = await paperText(url);
          if (live) setModel(m);
        }
      } catch (e) {
        console.error(e);
        if (live) setError("This paper would not open. The original still will.");
      }
    })();
    return () => { live = false; releasePaper(url); };
  }, [url, paper]);

  /* ------------------------------------------------------------ the stage
     A ResizeObserver rather than a resize listener, because the reader can
     open in a pane that reports 0x0 and is given its real size later — and no
     resize event fires when that happens. Measured, not assumed: the reader
     came up as a phone with a zero-width stage exactly once, and this is why
     it does not any more. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      setStageW(el.clientWidth);
      const first = el.querySelector(".sheetpg");
      if (first) setMeasured(first.getBoundingClientRect().width);
      store.current?.relayout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* What the stylesheet is actually going to make a page, restated so the
     first raster is drawn at roughly the right size — and then replaced by the
     measurement, which is the authority. Change either value in reader.css and
     this corrects itself on the next frame rather than drifting. */
  const guess = Math.max(240, Math.min(BASE_W * zoom / 100, (stageW || BASE_W + CLEARS) - CLEARS));
  const pageW = measured > 1 ? measured : guess;
  const scale = sizes[0] ? pageW / sizes[0].w : 1;

  /* Where every page starts, so a spacer can hold the exact height of the ones
     that are not drawn and the scrollbar never jumps. */
  const heights = useMemo(
    () => sizes.map((s) => Math.round(s.h * (pageW / s.w)) + PAGE_GAP),
    [sizes, pageW],
  );

  const total = sizes.length;
  const from = Math.max(1, page - WINDOW);
  const to = Math.min(total, page + WINDOW);
  const before = heights.slice(0, from - 1).reduce((a, b) => a + b, 0);
  const after = heights.slice(to).reduce((a, b) => a + b, 0);

  useEffect(() => { setRasterFocus(page); }, [page]);

  /* HANDOVER, Making it feel smooth: ask for the marks on the pages you are
     about to show, never for the document. */
  useEffect(() => {
    if (!store.current || !total) return;
    store.current.loadWindow(Math.max(1, from - 4), Math.min(total, to + 4));
  }, [from, to, total, model]);

  /* Prefetch while idle: the byte range for the page after this one. It costs
     nothing and removes the pause when they scroll on. */
  useEffect(() => {
    if (!doc || page >= total) return undefined;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => {
      doc.getPage(page + 1).then((p) => p.cleanup()).catch(() => {});
    });
    return () => cancel(id);
  }, [doc, page, total]);

  const headOf = useCallback((pg) => {
    let title = "";
    for (const o of outline) { if (o.pg <= pg) title = o.title; else break; }
    return title;
  }, [outline]);

  /* The runs on each page, built once per document. Computed inline in the
     JSX this was a fresh array on every render, which changed the identity of
     the page's render callback, which cancelled and restarted the raster on
     every scroll tick — a paper that never finished drawing and never showed a
     word of selectable text. */
  const itemsByPage = useMemo(() => {
    const by = new Map();
    if (!model) return by;
    for (const it of model.items) {
      let list = by.get(it.page);
      if (!list) { list = []; by.set(it.page, list); }
      list.push(it);
    }
    return by;
  }, [model]);

  const padTo = useMemo(() => {
    const width = String(total || 1).length;
    return (n) => String(n).padStart(Math.max(4, width), "0");
  }, [total]);

  /* --------------------------------------------------------- the chrome */
  useLayoutEffect(() => {
    if (!total || !model || !rootRef.current) return undefined;

    const WM = mountWM();
    const initial = readJSON(`${key}-view`, {});
    let counts = { hl: 0, rv: 0 };

    const ctx = {
      doc: paper?.title || "Paper",
      total,
      first: 1,
      page: Number(read(`${key}-page`, 1)) || 1,
      zoom: initial.zoom || 100,
      fit: initial.fit !== false,
      rot: initial.rot || 0,
      warm: Number(read("pw-rdr6-warm", 0)) || 0,
      /* THERE IS ONE LIVERY SYSTEM AND IT IS THE APP'S. The demo carried six
         hexes of its own; this feeds `--lv` from whichever livery the student
         has chosen, through the same engine every other screen reads, so the
         reader is tinted by the app rather than beside it. */
      livery: accentOf(livery, variant),
      liveries: LIVERIES.map((l) => accentOf(l.id, variant)),
      bookmarks,
      me: {
        i: (me?.initials || me?.name || "?").slice(0, 2).toUpperCase(),
        n: me?.name || "You",
        sub: [me?.school, moduleCode && `Module ${moduleCode.replace(/^M/, "")}`, me?.licence]
          .filter(Boolean).join(" · "),
      },
      people: Object.assign(people.current, {
        me: { n: "You", i: (me?.initials || "?").slice(0, 2).toUpperCase() },
      }),
      tally: () => ({ hl: counts.hl, bm: bookmarks.length, rv: counts.rv }),
      recent: store.current?.recent() || [],
      head: headOf,
      orphans: () => store.current?.orphans() || [],
      gridPages: () => {
        const lo = Math.max(1, (island.current?.page?.() || 1) - GRID);
        const hi = Math.min(total, lo + GRID * 2);
        return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      },

      /* ── what the chrome tells us ─────────────────────────────────── */
      onPage(n) { setPage(n); write(`${key}-page`, String(n)); panel.current?.repaint(); },
      onView(z, f, r) {
        setZoom(z); setRot(r);
        write(`${key}-view`, JSON.stringify({ zoom: z, fit: f, rot: r }));
        store.current?.setRotation(r);
      },
      onBookmark(pg, on) {
        setBookmarks((was) => {
          const next = on ? [...new Set([...was, pg])] : was.filter((x) => x !== pg);
          write(`${key}-bm`, JSON.stringify(next));
          return next;
        });
      },
      onLook(v) { write("pw-rdr6-look", v); },
      onLivery(v) {
        const picked = LIVERIES.find((l) => accentOf(l.id, variant) === v);
        if (picked) onLivery?.(picked.id);
      },
      onWarm(v) { write("pw-rdr6-warm", String(v)); },
      onGo(what) {
        if (what === "rr") onOpenThread?.(null);
        else onPlace?.(what);
      },
      onPull() {
        const n = store.current?.pull() || 0;
        island.current?.arrived(n);
        panel.current?.repaint();
      },
      async onRedo() {
        const what = await store.current?.redo();
        panel.current?.repaint();
        if (what) island.current?.say("mark", 1200);
      },

      /* Settings save locally first and sync in the background: nothing the
         student touches waits on the network. */
      settings: (defaults) => ({ ...defaults, ...readJSON(`${key}-tools`, {}) }),
      onSettings(S) { write(`${key}-tools`, JSON.stringify(S)); },
      expose(api) { chrome.current = api; },

      onMade(mark, range, pgEl) { store.current?.made(mark, range, pgEl); },
      onDropped(g) { store.current?.dropped(g); },
      onConverted(g, kind, k) { store.current?.converted(g, kind, k); },
      onRecoloured(g, k) { store.current?.recoloured(g, k); },
      onStroke(pgEl, path, pts, tool, S) { store.current?.stroke(pgEl, path, pts, tool, S); },
      onErasedInk(ids) { store.current?.erasedInk(ids); },
      mine: (id) => store.current?.mine(id) ?? false,
      onAnswer(markId, text) { store.current?.answer(markId, text); },
      onNote(markId, text) { store.current?.note(markId, text); panel.current?.repaint(); },
    };

    /* Every listener the parts bind to window or document, every observer and
       every timer, recorded and undone when the reader closes. See mount.js
       for why that happens here rather than as edits to the chrome. */
    const island2 = capture(() => mountIsland(ctx));
    const tools = capture(() => mountToolbar(ctx));
    const panel2 = capture(() => mountPanel(ctx));
    island.current = island2.out;
    panel.current = panel2.out;

    store.current = createMarkStore({
      paper, moduleCode, me, model, WM, chrome: chrome.current, live: live.current,
      people: people.current,
      onNames() { panel.current?.repaint(); },
      onTrouble() { island.current?.offline(true); },
      onCounts(c) { counts = c; },
    });
    store.current.loadInk();
    store.current.loadThreads();
    setPage(ctx.page);

    /* Undo and redo. The chrome has the message and the Redo button; the key
       that fires them belongs to the shell, because the chrome binds its own
       keys to tools and Z is not one of them. */
    const keys = async (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // they are typing
      e.preventDefault();
      const what = e.shiftKey ? await store.current?.redo() : await store.current?.undo();
      panel.current?.repaint();
      if (!what) return;
      island.current?.undone(what, e.shiftKey);
    };
    window.addEventListener("keydown", keys);

    /* Check for new marks quietly, apply them loudly. The only thing this may
       do is light the dot. */
    const poll = setInterval(async () => {
      const n = await store.current.poll();
      if (n) island.current?.waiting(n);
    }, POLL_MS);

    return () => {
      window.removeEventListener("keydown", keys);
      clearInterval(poll);
      panel2.off(); tools.off(); island2.off();
      delete window.islandSay; delete window.readerGoTo; delete window.WM;
      island.current = null; panel.current = null; store.current = null;
    };
    // The chrome mounts once, against a paper whose shape is known. Re-running
    // it on a state change would rebuild the whole reader under the student,
    // which is why the state it reads is read through ctx rather than closed
    // over as a dependency.
  }, [total, model]);

  /* The stage moved: re-lay every mark on the pages that are showing. */
  useEffect(() => { store.current?.relayout(); }, [pageW, rot, page]);

  /* AND AGAIN WHEN THE PAGE HAS FINISHED MOVING. reader.css gives `.sheetpg`
     a 0.42s spring on `transform` and a 0.34s ease on `width`, so the layout
     above runs against a page that is halfway through turning: the rectangles
     are measured at some angle between the old one and the new one, and the
     marks settle sideways across the words.

     Zoom got away with it, because changing the width makes the ResizeObserver
     fire all the way through the animation and the last fire is the correct
     one. Rotation changes no size at all, so there was nothing to correct it —
     measured at 180 degrees with the quads still carrying the width and height
     they were given at 90. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const settled = (e) => {
      if (e.propertyName === "transform" || e.propertyName === "width") store.current?.relayout();
    };
    el.addEventListener("transitionend", settled);
    return () => el.removeEventListener("transitionend", settled);
  }, []);

  const onEls = useCallback((pg, els) => {
    if (els) live.current.pages.set(pg, els); else live.current.pages.delete(pg);
    store.current?.page(pg, els);
  }, []);
  /* The spans themselves are not passed anywhere: they are read off the text
     layer when a mark needs them. All this says is that they changed. */
  const onText = useCallback(() => { store.current?.text(); }, []);

  /* The reader's own dark and light, which is a reading preference and not
     the app's theme: a student reads a scanned manual on white at a desk and
     on dark in bed, without changing the rest of the site. It starts wherever
     the app is, so the first thing they see matches what they came from. */
  const look = read("pw-rdr6-look", variant === "day" ? "light" : "dark");

  if (!host) return null;

  return createPortal(
    /* reader.html, and the five attributes every layout rule reads. */
    <div
      className="rdr"
      id="rdr"
      ref={rootRef}
      data-look={look}
      data-bar="left"
      data-rail="on"
      data-side="right"
      data-pan="1"
    >
      {/* The way back to the library. reader.html has this as a div, because
          the demo had nowhere to go; a button with the same class takes the
          same rules and gives the corner the job the corner already looks like
          it has. */}
      <button className="logo" type="button" onClick={onBack} aria-label="Back to the library">
        <span className="gl">W</span><span>Wingman</span>
      </button>

      <div className="stage" id="stage" ref={stageRef}>
        {error && (
          <div className="sheeterr">
            <b>This paper would not open.</b>
            The original still will, and everything marked on it is safe.
            <button type="button" onClick={() => onOpenOriginal?.(paper)}>Open the original</button>
          </div>
        )}
        {!error && before > 0 && <div className="sheetgap" style={{ height: before }} />}
        {!error && sizes.slice(from - 1, to).map((size, i) => (
          <SheetPage
            key={from + i}
            doc={doc}
            pageNumber={from + i}
            scale={scale}
            size={size}
            items={itemsByPage.get(from + i) || null}
            bookmarked={bookmarks.includes(from + i)}
            pad={padTo}
            onEls={onEls}
            onText={onText}
          />
        ))}
        {!error && after > 0 && <div className="sheetgap" style={{ height: after }} />}
      </div>

      <div className="isl" id="isl" data-msg="0">
        <div className="head">
          <div className="base" id="base">
            <span className="dotw">
              <span className="dot" id="dot" data-live="0" title="Class marks" />
              <button className="bk" id="bk" type="button" aria-label="Back to the paper">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19.4 12H5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10.6 5.4L4 12l6.6 6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </span>
            <span className="spacer" />
            <div className="cnt" id="cnt" />
            <span className="spacer" />
            <button className="you" id="you" type="button" aria-label="You">
              {(me?.initials || "?").slice(0, 2).toUpperCase()}
            </button>
          </div>
          <div className="msg" id="msg" />
        </div>
        <div className="tray" id="tray" />
      </div>
      <div className="sizer" id="sizer" />

      <div className="glass rail" id="rail" />
      <div className="edge" id="edge" />
      <div className="handle" id="handle" />

      <div className="po" id="props"><div className="notch" id="notch1" /><div className="glass pop inner" id="propsIn" /></div>
      <div className="po" id="chest" style={{ width: 268 }}><div className="notch" id="notch2" /><div className="glass pop inner" id="chestIn" /></div>
      <div className="po" id="cgrid" style={{ width: 250 }}><div className="notch" id="notch4" /><div className="glass pop inner" id="cgridIn" /></div>

      <button className="ptab" id="tab" type="button" aria-label="Open the panel">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14.6 5.4L8 12l6.6 6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <b id="tabn">3</b>
      </button>

      <aside className="pan" id="pan">
        <div className="ph">
          <div className="srch" id="srchw">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="10.6" cy="10.6" r="6.6" stroke="currentColor" strokeWidth="1.9" /><path d="M15.6 15.6l4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
            <input id="q" placeholder="Search the paper, a mark, or a name" autoComplete="off" />
            <button className="clr" id="clr" type="button" aria-label="Clear">&times;</button>
          </div>
          <div className="pseg" id="view">
            <button className="on" type="button" data-v="marks">Marks<span id="cm" /></button>
            <button type="button" data-v="pages">Pages<span id="cp" /></button>
          </div>
          <div id="filters" />
        </div>
        <div className="body" id="body" />
        <div className="pf" id="pf" />
      </aside>

      <div className="zone" data-z="left" /><div className="zone" data-z="right" />
      <div className="zone" data-z="bottom" /><div className="zone" data-z="top" />

      <div className="glass pop tip" id="tip" />

      <div className="selp" id="selp" data-cols="0" data-del="0">
        <div className="rowa">
          <button className="swatch" id="selsw" type="button" aria-label="Change colour"><i /></button>
          <span className="vr" />
          <button className="a" type="button" data-act="hl"><span className="cue hl" /><span className="tx">Highlight</span></button>
          <button className="a" type="button" data-act="ul"><span className="cue ul" /><span className="tx">Underline</span></button>
          <button className="a" type="button" data-act="ask"><span className="cue ak" /><span className="tx">Ask</span></button>
          <span className="vr del" />
          <button className="a rm" type="button" data-rmv aria-label="Remove this mark"><span className="cue tr" /></button>
        </div>
        <div className="cols" id="selcols" />
        <span className="tail" />
      </div>

      <div className="backp" id="backp">
        <b id="backl">Back to 0001</b>
        <button className="act" id="backx" type="button" aria-label="Dismiss">&times;</button>
      </div>

      {/* The one thing reader.html has that this does not is the demo strip.
          HANDOVER section 5: it goes before shipping. What it switched — where
          the bar sits, dark or light, auto-hide — are the student's own
          settings, and the island's You tray already owns them. */}
    </div>,
    host,
  );
}
