/* =============================================================================
   THE PAPER VIEWER — a reader and a saver, and nothing else.
   -----------------------------------------------------------------------------
   The owner's instruction, in full: "papers that only open to be scrolled and
   or downloaded … remember its not a editor but a reader and saver thats it
   you can bookmark and download it on your device that is it".

   So: open it, scroll it, bookmark a page, download it. No marking, no
   highlighting, no notes, no questions on a passage, no class density layer,
   no tool tray, no rail, no island panel full of stats.

   IT IMPORTS NOTHING FROM `paper/v6/`, and that is the rule this file exists
   to keep rather than a detail of how it was built. That directory IS the
   editor — tools, marks, ink, the outbox — and it is paused. Reaching into it
   for "just the island" or "just the page renderer" would put the paused code
   back in the build, which is the one thing the pause was for. The island was
   LIFTED beside this file instead, and pdf.js is imported here directly.

   ---------------------------------------------------------------- the page

   CONTINUOUS VERTICAL SCROLL, VIRTUALISED. Every page gets a box at its own
   aspect ratio the moment the document's dimensions are known, so the scroll
   bar is the right length from the first frame and never jumps. Only the pages
   near the viewport are actually rendered to a canvas; the rest are the box
   and nothing in it. A three-hundred-page manual would otherwise allocate
   three hundred canvases and take a phone's whole memory doing it.

   THE PAGE NEVER NARROWS FOR CHROME. Panels float over it. A document that
   reflows when a tray opens is a document you lose your place in, and that is
   a locked decision rather than a preference.

   A FIT IS A RELATIONSHIP TO THE ROOM, not a number. It is recomputed on
   resize, which is why `fit` is a boolean beside the zoom rather than a
   remembered percentage.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Island from "../island/Island.jsx";
import "../island/island.css";
import { fileHref } from "../../../lib/papers.js";
import { downloadBlob, downloadSaid } from "../../../lib/outside.js";

/* pdf.js, and its worker, imported here rather than through the paused
   reader's `paperText.js`. The version is pinned exactly in package.json for
   the reason that file's header gives — a minor version changes how text runs
   are split — and although this viewer never reads a text run, the pin is the
   project's and is not this file's to loosen. */
const loadPdfjs = async () => {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
};

/* How many pages either side of the one on screen are drawn. Two is enough to
   scroll a page without seeing a blank box, and small enough that the canvases
   in memory stay in single figures. */
const NEAR = 2;
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;

export default function PaperViewer({
  paper, initials = "YOU", startPage = 1,
  savedPages, onToggleSave, onPlace, onBack,
}) {
  const stageRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [sizes, setSizes] = useState([]);       // [{w,h}] in PDF points, per page
  const [error, setError] = useState(null);
  const [page, setPage] = useState(Math.max(1, startPage | 0));
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState(true);
  const [rot, setRot] = useState(0);
  const [warm, setWarm] = useState(0);
  const [look, setLook] = useState("dark");
  const total = sizes.length;

  /* ---------------------------------------------------------- the document */
  useEffect(() => {
    if (!paper?.file) return undefined;
    let live = true;
    let task = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ url: fileHref(paper.file), withCredentials: false });
        const d = await task.promise;
        if (!live) { d.destroy?.(); return; }
        /* EVERY PAGE'S SIZE UP FRONT, and only its size. `getPage` is cheap
           next to rendering one, and without this the scroll bar grows as you
           read — the document getting longer under your thumb is the exact
           thing the reader's own notes warn about. */
        const dims = [];
        for (let i = 1; i <= d.numPages; i += 1) {
          const p = await d.getPage(i);
          const v = p.getViewport({ scale: 1, rotation: 0 });
          dims.push({ w: v.width, h: v.height });
          p.cleanup?.();
          if (!live) return;
        }
        setDoc(d);
        setSizes(dims);
      } catch (e) {
        if (live) setError(e?.message || "That paper would not open.");
      }
    })();
    return () => { live = false; try { task?.destroy?.(); } catch { /* already gone */ } };
  }, [paper?.file]);

  /* ------------------------------------------------------------- the width
     ONE WRITER. The stage measures itself and the zoom is applied to that, so
     "fit" and "120%" are the same calculation with a different multiplier and
     cannot disagree about what a page is wide. */
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const read = () => setRoom(el.clientWidth || 0);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("resize", read);
    return () => { ro.disconnect(); window.removeEventListener("resize", read); };
  }, []);

  const first = sizes[0];
  const sideways = rot % 180 !== 0;
  const pw = useMemo(() => {
    if (!first || !room) return 720;
    const natural = sideways ? first.h : first.w;
    /* The gutter the sheet's own max-width leaves, so a fit really fits. */
    const usable = Math.max(240, room - 32);
    if (fit) return Math.min(usable, Math.round(natural * 1.34));
    return Math.max(240, Math.round(usable * (zoom / 100)));
  }, [first, room, fit, zoom, sideways]);

  /* What "fit" is as a percentage, for the island's readout. */
  const fitPct = useMemo(() => {
    if (!first || !room) return 100;
    const usable = Math.max(240, room - 32);
    const natural = sideways ? first.h : first.w;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
      Math.round((Math.min(usable, natural * 1.34) / usable) * 100)));
  }, [first, room, sideways]);

  /* ---------------------------------------------------------- the scroll spy
     The page nearest the top of the stage wins, on requestAnimationFrame, off
     a passive listener. Lifted from the reader because it is already right:
     "nearest the top" is what a student means by "the page I am on", and
     anything based on the majority of visible area flickers on a tall page. */
  const pageEls = useRef(new Map());
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !total) return undefined;
    let raf = 0;
    const spy = () => {
      raf = 0;
      const top = stage.getBoundingClientRect().top;
      let best = page;
      let bestD = Infinity;
      for (const [n, el] of pageEls.current) {
        if (!el) continue;
        const d = Math.abs(el.getBoundingClientRect().top - top);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (best !== page) { setPage(best); onPlace?.(best); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => { stage.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [total, page, onPlace]);

  /* `?page=N` on arrival, once the boxes exist to scroll to. */
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !total) return;
    landed.current = true;
    const n = Math.min(total, Math.max(1, startPage | 0));
    if (n === 1) return;
    requestAnimationFrame(() => {
      pageEls.current.get(n)?.scrollIntoView({ block: "start", behavior: "auto" });
      setPage(n);
    });
  }, [total, startPage]);

  /* ------------------------------------------------------------ rendering */
  const near = useMemo(() => {
    const set = new Set();
    for (let n = page - NEAR; n <= page + NEAR; n += 1) if (n >= 1 && n <= total) set.add(n);
    return set;
  }, [page, total]);

  const download = useCallback(async () => {
    try {
      const res = await fetch(fileHref(paper.file));
      if (!res.ok) throw new Error(String(res.status));
      const name = `${String(paper.title || "paper").replace(/[^\w-]+/g, "-").slice(0, 48)}.pdf`;
      return downloadSaid(await downloadBlob(await res.blob(), name), name);
    } catch {
      window.open(fileHref(paper.file), "_blank", "noopener");
      return "It is open — use your browser's Share button to save it.";
    }
  }, [paper]);

  const saved = savedPages?.has?.(page) || false;

  return (
    <div className={`pvw${look === "light" ? " is-light" : ""}`} data-look={look}>
      <div className="stage" ref={stageRef} style={{ "--pw": `${pw}px`, "--warm": warm }}>
        {error && (
          <div className="paper-state">
            <h1>{paper?.title}</h1>
            <p>{error}</p>
            <button type="button" className="nextgo" onClick={onBack}>Back to the Library</button>
          </div>
        )}
        {!error && !total && (
          <div className="paper-state"><p>Opening {paper?.title}…</p></div>
        )}
        {sizes.map((s, i) => {
          const n = i + 1;
          const w = sideways ? s.h : s.w;
          const h = sideways ? s.w : s.h;
          return (
            <div className="sheet" key={n} data-pg={n} data-bm={savedPages?.has?.(n) ? "1" : undefined}
                 ref={(el) => { if (el) pageEls.current.set(n, el); else pageEls.current.delete(n); }}
                 style={{ aspectRatio: `${w} / ${h}` }}>
              {near.has(n) && <PageCanvas doc={doc} n={n} width={pw} rot={rot} />}
              <span className="warmth" aria-hidden="true" />
            </div>
          );
        })}
      </div>

      <Island
        page={page} total={total || 1} saved={saved} initials={initials}
        zoom={fit ? fitPct : zoom} fit={fit} warm={warm} look={look}
        onBookmark={(on) => onToggleSave?.(page, on)}
        onZoom={(by) => { setFit(false); setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (fit ? fitPct : z) + by))); }}
        onFit={() => setFit(true)}
        onRotate={() => setRot((r) => (r + 90) % 360)}
        onDownload={download}
        onWarm={setWarm}
        onLook={setLook}
        onBack={onBack}
      />
    </div>
  );
}

/* One page, drawn at the width it is actually shown at — not at a fixed scale
   and then stretched, which is what makes small type mush on a phone. */
function PageCanvas({ doc, n, width, rot }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!doc || !ref.current || !width) return undefined;
    let live = true;
    let task = null;
    (async () => {
      const p = await doc.getPage(n);
      if (!live) return;
      const base = p.getViewport({ scale: 1, rotation: rot });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = (width / base.width) * dpr;
      const v = p.getViewport({ scale, rotation: rot });
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = Math.round(v.width);
      canvas.height = Math.round(v.height);
      task = p.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport: v });
      try { await task.promise; } catch { /* cancelled by a rescale */ }
      p.cleanup?.();
    })();
    return () => { live = false; try { task?.cancel?.(); } catch { /* already done */ } };
  }, [doc, n, width, rot]);
  return <canvas ref={ref} aria-label={`Page ${n}`} />;
}
