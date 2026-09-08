import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { itemsInRange } from "../../lib/paperText.js";
import { pdfjs } from "../../lib/paperText.js";
import { lightFilter } from "../../lib/paperView.js";
import { claimRaster, releaseRaster, MAX_RASTER_PX } from "../../lib/rasterBudget.js";
import PaperInk from "./PaperInk.jsx";

/* =============================================================================
   One page of the paper: the picture, the words, and the marks on them.

   Five layers, in this order, and the order is the whole trick:

     sheet     a page-shaped card in the page colour — ALWAYS present
     canvas    the page as pdf.js draws it, two of them (see below)
     marks     highlights and density, painted UNDER the words
     ink       freehand strokes, over the picture and under the words
     text      pdf.js's transparent text layer, on top, so selection works

   Putting the marks above the text would tint the letters; putting them below
   the canvas would hide them. Between the two, a highlight sits behind the
   words exactly the way a highlighter does on paper, and dragging across it
   still selects text.

   RECTANGLES ARE MEASURED, NEVER COMPUTED. A mark knows the characters it
   covers, and the browser is asked where those characters ended up — a DOM
   Range over the rendered text run, and whatever rects it reports. Working the
   geometry out from the PDF transform instead gets subtly wrong on rotated
   pages, on runs with letter-spacing, and on every font pdf.js substitutes.

   -----------------------------------------------------------------------------
   WHY THE PAGE IS RENDERED OFF SCREEN AND THEN COPIED IN

   Setting `canvas.width` clears the canvas. So re-rendering at a new zoom —
   which is every zoom change, every rotation, every window resize — necessarily
   blanks the page for as long as the render takes, and on a dense schematic
   that is most of a second of white.

   So the render goes to a detached canvas, and when it finishes the visible one
   is resized and the finished picture is copied onto it — in one synchronous
   run, so no frame is ever painted between the clear and the copy. Until that
   moment the visible canvas keeps its previous raster, stretched to the new
   box, which reads as soft rather than as missing. The transition is a
   sharpening. There is never a frame where this page has nothing on it.

   This was two canvases swapping a `data-on` attribute, which is the obvious
   design and is wrong: two renders overlap whenever the zoom changes mid-pass,
   a cancelled run's late swap lands after a fresh run's, and the page settles
   showing the SOFT raster with the sharp one finished and hidden beside it.
   Measured, not theorised. One canvas and an atomic copy has nothing to race.
   ========================================================================= */

/* A fast pass at a fraction of the target, painted first so a page entering the
   window has something real on it within a frame or two, then the sharp pass
   over the top. Below this scale the fast pass is not worth the extra render. */
const FAST_SCALE = 0.35;
const SHARP_DELAY = 90;          // ms — a zoom drag must not queue twenty renders

export default function PaperPage({
  doc, model, pageNumber, scale, rotation = 0, size,
  segments = [], activeId = null, light = "day",
  strokes = [], inkTool = null, inkColour, inkWidth, onInk, onErase, me,
  onDivs, registerEl, onPenDown, onPenUp,
  notes = [], onOpenThread, onDeleteNote,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [ready, setReady] = useState(false);   // is there a raster on this page yet
  const [divs, setDivs] = useState(null);
  const [tick, setTick] = useState(0);

  /* The two callbacks live in a ref and NOT in the effect's dependencies.

     They arrive as fresh functions on every parent render, and the parent
     re-renders on every scroll tick — so as dependencies they re-ran this
     effect continuously, and each run cancelled the render the last one had
     started. The canvas survived that (a cancelled paint still leaves the last
     frame); the text layer did not, because it is built after the await. The
     symptom was a page you could see and could not select a word of. */
  const cbs = useRef({ onDivs, registerEl });
  cbs.current = { onDivs, registerEl };

  // The runs on this page, in the order pdf.js reports them — which is the
  // order the text layer will build its spans in.
  const pageItems = useMemo(
    () => model?.items.filter((i) => i.page === pageNumber) || [],
    [model, pageNumber],
  );

  /* The page's own box, from the manifest rather than from the file. This is
     what lets 1012 pages lay out at the right height before a single PDF byte
     arrives — the placeholder is the correct shape from the first frame, so the
     scroll height is right and the scrollbar never jumps. */
  const rotated = rotation % 180 !== 0;
  const boxW = Math.round((rotated ? size?.h : size?.w) * scale) || 0;
  const boxH = Math.round((rotated ? size?.w : size?.h) * scale) || 0;

  const drawn = useRef("");
  const hasRaster = useRef(false);              // has anything been painted here yet
  const held = useRef(null);                    // our claim on the raster budget

  /* ---------------------------------------------------------------- render */
  const paint = useCallback(async (run, atScale, withText, cssW, cssH) => {
    if (!doc || !model) return false;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: atScale, rotation });

    /* A canvas above ~4000px on a side is where iPad Safari's total-canvas-area
       ceiling starts refusing to allocate, and it refuses by handing back a
       BLANK one rather than throwing — indistinguishable from the renderer
       giving up. Cap the bitmap and let it be soft: soft is a legible page,
       blank is not. */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const want = Math.max(viewport.width, viewport.height) * dpr;
    const shrink = want > MAX_RASTER_PX ? MAX_RASTER_PX / want : 1;
    const bw = Math.max(1, Math.floor(viewport.width * dpr * shrink));
    const bh = Math.max(1, Math.floor(viewport.height * dpr * shrink));

    if (withText) {
      /* THE WORDS BEFORE THE PICTURE, and the order is load-bearing.

         A canvas render is cancelled whenever this effect re-runs — a rescale, a
         re-mount, anything. When the text layer was built after the render
         awaited, every cancellation took the selectable text with it and put
         nothing back: a page you could see and could not select a word of,
         which also means a page nobody can annotate. The text layer is cheap,
         it does not depend on the canvas, and building it first means the only
         thing a cancelled render costs is a repainted picture. */
      const holder = textRef.current;
      if (holder) {
        holder.replaceChildren();
        holder.style.setProperty("--scale-factor", String(atScale));
        holder.style.width = `${cssW}px`;
        holder.style.height = `${cssH}px`;
        const layer = new pdfjs.TextLayer({
          textContentSource: await page.getTextContent(),
          container: holder,
          viewport,
        });
        await layer.render();

        /* The spans and my runs have to line up one for one, because a mark is
           stored as "characters 412 to 470 of the paper" and the span is the
           only thing that knows where those characters are on screen. pdf.js
           builds one span per text run, in the same order getTextContent
           reported them, so position IS the mapping — but it is checked rather
           than assumed. A page where they disagree draws no marks at all, which
           is the only honest failure: a mark in the wrong place cannot be
           spotted by the person reading it. */
        const spans = layer.textDivs || [];
        const aligned = spans.length === pageItems.length;
        if (aligned) spans.forEach((el, i) => { el.dataset.item = String(i); });
        setDivs(aligned ? spans : null);
        cbs.current.onDivs?.(pageNumber, aligned ? spans : null, pageItems);
        setTick((t) => t + 1);
      }
    }

    const off = document.createElement("canvas");
    off.width = bw;
    off.height = bh;
    const ctx = off.getContext("2d", { alpha: false });
    ctx.setTransform(dpr * shrink, 0, 0, dpr * shrink, 0, 0);
    const task = page.render({ canvasContext: ctx, viewport });
    run.task = task;
    try { await task.promise; } catch { return false; }

    /* THE CANCELLED RUN MUST NOT SWAP. This check is here, immediately before
       the pixels land, and not in the caller — by the time `paint` has returned
       it is too late, the picture is already on screen. A fast third-resolution
       pass that resolved after the sharp one had finished was overwriting it,
       and the page settled soft with the sharp raster thrown away. */
    if (!run.on) return false;

    /* The swap, and it is one run of synchronous work on purpose: the browser
       cannot paint between clearing the visible canvas and copying the finished
       picture onto it, so there is no white frame to see. */
    const vis = canvasRef.current;
    if (!vis) return false;
    vis.width = bw;
    vis.height = bh;
    vis.style.width = `${cssW}px`;
    vis.style.height = `${cssH}px`;
    vis.getContext("2d", { alpha: false }).drawImage(off, 0, 0);
    off.width = off.height = 0;         // let the transient bitmap go at once

    /* Let go of the parsed page too. Without this every page ever scrolled past
       stays in memory for the life of the document, which on a thousand-page
       manual is the whole file. */
    try { page.cleanup(); } catch { /* already gone */ }
    return true;
  }, [doc, model, pageNumber, rotation, pageItems]);

  useEffect(() => {
    if (!doc || !model || !size) return undefined;
    const signature = `${pageNumber}@${scale}r${rotation}#${model.pages}`;
    if (drawn.current === signature) return undefined;

    const run = { on: true, task: null };
    let timer = null;

    (async () => {
      /* A fast pass first, but only when this page has nothing on it yet. Once
         a raster exists, letting the browser stretch it is both sharper and
         free — a low-resolution re-render would be a visible step DOWN in
         quality on the way back up. */
      if (!hasRaster.current) {
        const ok = await paint(run, Math.max(0.2, scale * FAST_SCALE), false, boxW, boxH);
        if (!run.on) return;
        if (ok) { hasRaster.current = true; setReady(true); }
      }

      /* Debounced, so a zoom drag does not queue twenty renders. */
      await new Promise((r) => { timer = setTimeout(r, SHARP_DELAY); });
      if (!run.on) return;

      const ok = await paint(run, scale, true, boxW, boxH);
      if (!run.on || !ok) return;
      held.current = claimRaster(pageNumber, held.current);
      hasRaster.current = true;
      setReady(true);
      drawn.current = signature;
    })();

    return () => {
      run.on = false;
      clearTimeout(timer);
      // Cancel aggressively: a flung scrollbar must not queue fifty renders.
      try { run.task?.cancel(); } catch { /* already done */ }
    };
    // pageItems is deliberately NOT a dependency: it is a fresh array on every
    // parent render, and as a dependency it restarted this effect continuously.
    // `paint` already closes over it and carries the same identity.
  }, [doc, model, size, pageNumber, scale, rotation, paint, boxW, boxH]);

  useEffect(() => () => releaseRaster(held.current), []);
  useEffect(() => { cbs.current.registerEl?.(pageNumber, wrapRef.current); }, [pageNumber]);

  /* ----------------------------------------------------------- mark rects */
  // Measured from the spans, so this recomputes whenever the page re-renders.
  const rects = useMemo(() => {
    if (!divs || !boxW) return [];
    const box = textRef.current?.getBoundingClientRect();
    if (!box) return [];
    const out = [];

    for (const seg of segments) {
      const runs = itemsInRange(model, seg.start, seg.end).filter((r) => r.page === pageNumber);
      for (const run of runs) {
        const i = pageItems.indexOf(pageItems.find((p) => p.index === run.index && p.start === run.start));
        const el = divs[i];
        const node = el?.firstChild;
        if (!node || node.nodeType !== 3) continue;
        const range = document.createRange();
        try {
          range.setStart(node, Math.min(run.from, node.length));
          range.setEnd(node, Math.min(run.to, node.length));
        } catch { continue; }
        for (const r of range.getClientRects()) {
          if (r.width < 0.5 || r.height < 0.5) continue;
          out.push({
            key: `${seg.start}-${seg.end}-${run.index}-${out.length}`,
            seg,
            x: r.left - box.left,
            y: r.top - box.top,
            w: r.width,
            h: r.height,
          });
        }
        range.detach?.();
      }
    }
    return out;
    // `tick` is the signal that the spans were just rebuilt; without it this
    // memo would hold rects measured against the previous scale.
  }, [divs, boxW, segments, model, pageNumber, pageItems, tick]);

  /* The raster on screen may have been drawn at a different zoom, or at a third
     of the resolution. Nothing has to be done about either: the canvas ELEMENT
     is sized to the page box regardless, so the browser stretches whatever
     pixels it is holding. The page softens and re-sharpens; it never blanks. */
  const canvasStyle = { filter: light === "day" ? undefined : lightFilter(light) };

  return (
    /* COMPONENTS.md: a page is an <article class="rdr-page"> with its number in
       the gutter. The stylesheet gives it the sheet, the radius and the one
       shadow that is depth 1 — nothing here paints it. */
    <article className="rdr-page" ref={wrapRef} data-page={pageNumber}
             data-drawn={ready ? "" : undefined}
             style={boxW ? { width: boxW, height: boxH } : undefined}>
      <span className="pg-num mono">{pageNumber}</span>

      {/* THE LIGHT FALLS ON THE PICTURE AND NOTHING ELSE.

          Night is a filter on the rendered page, which is how every reader
          that offers it does it: the file is untouched, the text layer is
          untouched, and — the part that matters — the marks are untouched.
          Inverting the whole stack would turn somebody's yellow highlight
          blue, which is worse than a bright page at midnight. */}
      <canvas className="rdr-canvas" ref={canvasRef} data-on={ready ? "" : undefined}
              style={canvasStyle} />

      <div className="rdr-marks" aria-hidden="true">
        {rects.map((r) => (
          /* THE SHIPPED CLASSES, ON THE ELEMENT THAT IS ACTUALLY PAINTED.
             COMPONENTS.md puts `s is-marked` on a sentence span in the text
             layer; pdf.js's text layer is RUNS, not sentences — a mark
             routinely covers the tail of one run, two whole ones and the head
             of a fourth — so this build measures the mark and draws it as a
             rectangle over that layer instead. Same classes, same two
             variables, same rules out of reader.css; a different element
             carries them. `.rdr-mark` is what positions it. */
          <span
            key={r.key}
            className={`s is-marked rdr-mark${
              r.seg.thread === "open" ? " is-open-thread" : ""}${
              r.seg.ids.includes(activeId) ? " is-selected" : ""}`}
            data-kind={r.seg.kind || undefined}
            data-colour={r.seg.colour || undefined}
            data-thread={r.seg.thread || undefined}
            data-deco={r.seg.deco?.length ? r.seg.deco.join(" ") : undefined}
            data-density={r.seg.density || undefined}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        ))}
      </div>

      {boxW > 0 && (
        <PaperInk
          strokes={strokes} page={pageNumber} me={me}
          width={boxW} height={boxH} rotation={rotation}
          tool={inkTool} colour={inkColour} penWidth={inkWidth}
          onCommit={(pts) => onInk?.(pageNumber, pts)}
          onErase={(ids) => onErase?.(ids)}
          onDown={onPenDown} onUp={onPenUp}
        />
      )}

      <div className="rdr-text" ref={textRef} />

      {/* §8 — notes open IN THE FLOW, under the page they belong to, on a
          phone and a desktop alike. A margin rail would have meant two layouts
          and a column of speech bubbles pointing at nothing. */}
      {notes?.length > 0 && (
        <div className="rdr-notes">
          {notes.map((n) => (
            <article key={n.id} className="rdr-note" data-colour={n.colour || undefined}>
              <p className="q">{n.quote}</p>
              <p className="b">{n.body}</p>
              <p className="w">
                <b>{n.anonymous && n.author_id !== me ? "Anonymous" : n.author_name}</b>
                {n.kind === "question" ? " asked" : " noted"}
                {n.kind === "question" && n.thread_id && (
                  <button type="button" className="btn" onClick={() => onOpenThread?.(n.thread_id)}>
                    Answer in the Ready Room
                  </button>
                )}
                {n.author_id === me && (
                  <button type="button" className="ib" aria-label="Delete this mark"
                          onClick={() => onDeleteNote?.(n)}>×</button>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
