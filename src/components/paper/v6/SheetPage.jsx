import { useCallback, useEffect, useRef, useState } from "react";
import { pdfjs } from "../../../lib/paperText.js";
import { claimRaster, releaseRaster, MAX_RASTER_PX } from "../../../lib/rasterBudget.js";

/* =============================================================================
   ONE PAGE OF THE PAPER, IN THE SHAPE HANDOVER SECTION 1 FIXES

     <article class="sheetpg" data-pg="126">
       <span class="bmk">                 the bookmark ribbon
       <svg class="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none">
       <span class="marks">               the mark quads
       <canvas>                           the page as pdf.js draws it
       <div class="textLayer">            pdf.js's text layer, z-index 2
       <span class="pgno">0126

   `.marks` at z-index 1, the text at 2, `.ink` at 3. Text above marks is what
   keeps the words crisp under a highlight and selectable through it.

   REACT OWNS THE PICTURE AND THE WORDS. IT DOES NOT OWN THE MARKS OR THE INK.
   Those two elements are rendered empty and never given children in JSX: the
   chrome appends into them imperatively, exactly as the handed-over file does,
   and React leaves foreign children alone as long as it never renders any of
   its own. Give either of them a child here and every mark on the page
   disappears on the next render.

   -----------------------------------------------------------------------------
   THREE RULES CARRIED OVER FROM THE v5 PAGE, WITH THE REASONS

   1 THE WORDS BEFORE THE PICTURE. A canvas render is cancelled whenever this
     effect re-runs. When the text layer was built after the render awaited,
     every cancellation took the selectable text with it and put nothing back:
     a page you could see and could not select a word of, which also means a
     page nobody can mark.

   2 RENDER OFF SCREEN, THEN COPY IN. Setting `canvas.width` clears the canvas,
     so re-rendering at a new zoom necessarily blanks the page for as long as
     the render takes. The render goes to a detached canvas and the finished
     picture is copied across in one synchronous run, so no frame is painted
     between the clear and the copy. Until then the visible canvas keeps its
     previous raster stretched to the new box, which reads as soft rather than
     as missing. HANDOVER, Making it feel smooth: never show a blank page.

   3 A FAST PASS, THEN THE SHARP ONE. A page entering the window has something
     real on it within a frame or two. Only when it has nothing yet: once a
     raster exists, letting the browser stretch it is both sharper and free.
   ========================================================================= */

const FAST_SCALE = 0.35;
const SHARP_DELAY = 90;          // ms — a zoom drag must not queue twenty renders

export default function SheetPage({
  doc, pageNumber, scale, size, items, bookmarked, pad, onEls, onText,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const marksRef = useRef(null);
  const inkRef = useRef(null);
  const [ready, setReady] = useState(false);

  /* Fresh functions on every parent render, and the parent re-renders on every
     scroll tick — so as dependencies they re-ran this effect continuously, and
     each run cancelled the render the last one started. */
  const cbs = useRef({ onEls, onText });
  cbs.current = { onEls, onText };

  /* THE STYLESHEET OWNS THE WIDTH. reader.css says
     `.sheetpg { width: var(--pw); max-width: calc(100% - 210px) }`, and the
     island's zoom writes `--pw`. Setting a width here instead took the zoom
     out of the reader entirely and, worse, fed the page's own rendered width
     back into the scale that produced it — a loop with a fixed point, which
     is why it looked like it worked.

     So the box is an ASPECT RATIO and nothing else. The height follows the
     width the stylesheet chose, which is what lets 1012 pages lay out at the
     right shape before a single PDF byte arrives: the placeholder is correct
     from the first frame, so the scroll height is right and the scrollbar
     never jumps. `scale` is the measured width over the page's own width, and
     it sizes the RASTER, never the element. */

  const drawn = useRef("");
  const hasRaster = useRef(false);
  const held = useRef(null);

  const paint = useCallback(async (run, atScale, withText) => {
    if (!doc) return false;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: atScale });

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
      const holder = textRef.current;
      if (holder) {
        holder.replaceChildren();
        /* pdf.js positions its spans in percentages and sizes them in
           `calc(var(--scale-factor) * Npx)`, and works its own width and
           height out from the same variable. Setting either by hand here put
           the words at one scale inside a box at another. */
        holder.style.setProperty("--scale-factor", String(atScale));
        const layer = new pdfjs.TextLayer({
          textContentSource: await page.getTextContent(),
          container: holder,
          viewport,
        });
        await layer.render();
        if (!run.on) return false;

        /* THE SPANS AND THE RUNS HAVE TO LINE UP ONE FOR ONE, because a mark
           is stored as "characters 412 to 470 of the paper" and the span is
           the only thing that knows where those characters ended up on
           screen. pdf.js builds one span per text run, in the order
           getTextContent reported them, so position IS the mapping — but it
           is checked rather than assumed. A page where they disagree draws no
           marks at all, which is the only honest failure: a mark in the wrong
           place cannot be spotted by the person reading it. */
        const spans = layer.textDivs || [];
        const aligned = spans.length === (items?.length || 0);
        if (aligned) spans.forEach((el, i) => { el.dataset.item = String(i); });
        cbs.current.onText?.(pageNumber, aligned ? spans : null);
      }
    }

    const off = document.createElement("canvas");
    off.width = bw;
    off.height = bh;
    const c2d = off.getContext("2d", { alpha: false });
    c2d.setTransform(dpr * shrink, 0, 0, dpr * shrink, 0, 0);
    const task = page.render({ canvasContext: c2d, viewport });
    run.task = task;
    try { await task.promise; } catch { return false; }

    /* THE CANCELLED RUN MUST NOT SWAP. Here, immediately before the pixels
       land, and not in the caller — by the time `paint` has returned it is too
       late, the picture is already on screen. A fast third-resolution pass
       that resolved after the sharp one had finished was overwriting it, and
       the page settled soft with the sharp raster thrown away. */
    if (!run.on) return false;

    const vis = canvasRef.current;
    if (!vis) return false;
    vis.width = bw;
    vis.height = bh;
    /* No inline width or height: the canvas is `width:100%;height:100%` of the
       page box, so whatever raster it is holding is stretched to fit. That is
       the whole of "never show a blank page" — the previous picture stays,
       soft, until the sharp one is copied over it. */
    vis.getContext("2d", { alpha: false }).drawImage(off, 0, 0);
    off.width = off.height = 0;         // let the transient bitmap go at once

    /* Let go of the parsed page too. Without this every page ever scrolled
       past stays in memory for the life of the document, which on a
       thousand-page manual is the whole file. */
    try { page.cleanup(); } catch { /* already gone */ }
    return true;
  }, [doc, pageNumber, items]);

  useEffect(() => {
    if (!doc || !size) return undefined;
    /* THE RUN COUNT IS PART OF THE SIGNATURE, and leaving it out cost an
       afternoon. The paper's extracted text lands seconds after the pages do,
       so the first text layer is built when this page does not yet know its
       runs — the span-to-run check fails, the spans are handed over as null,
       and no mark can be drawn on the page. Without the count here the
       signature is unchanged when the text finally arrives, this effect
       returns early, and the layer is never rebuilt: a paper that draws
       perfectly and carries no highlights at all. */
    const signature = `${pageNumber}@${scale}#${items?.length || 0}`;
    if (drawn.current === signature) return undefined;

    const run = { on: true, task: null };
    let timer = null;

    (async () => {
      if (!hasRaster.current) {
        const ok = await paint(run, Math.max(0.2, scale * FAST_SCALE), false);
        if (!run.on) return;
        if (ok) { hasRaster.current = true; setReady(true); }
      }
      await new Promise((r) => { timer = setTimeout(r, SHARP_DELAY); });
      if (!run.on) return;

      const ok = await paint(run, scale, true);
      if (!run.on || !ok) return;
      held.current = claimRaster(pageNumber, held.current);
      hasRaster.current = true;
      setReady(true);
      drawn.current = signature;
    })();

    return () => {
      run.on = false;
      clearTimeout(timer);
      /* HANDOVER, Making it feel smooth: cap and cancel. A page that scrolls
         out of the window before its render finishes has its render cancelled,
         so a flung scrollbar does not queue fifty paints that all land at
         once. */
      try { run.task?.cancel(); } catch { /* already done */ }
    };
  }, [doc, size, pageNumber, scale, paint, items]);

  useEffect(() => () => releaseRaster(held.current), []);

  /* The chrome finds its pages with `document.querySelector('.sheetpg')`, so
     it needs nothing from here — but the mark layer does its work against the
     text spans, and relayout has to be told when a page arrives and when it
     goes. */
  useEffect(() => {
    cbs.current.onEls?.(pageNumber, {
      page: wrapRef.current, marks: marksRef.current, ink: inkRef.current, text: textRef.current,
    });
    return () => cbs.current.onEls?.(pageNumber, null);
  }, [pageNumber]);

  return (
    <article
      className="sheetpg"
      ref={wrapRef}
      data-pg={pageNumber}
      data-real=""
      /* The page's own size in PDF points, 72 to the inch. The tape measure
         reads it off the element rather than being handed the model, because
         it is measuring the page in front of it. */
      data-ptw={size?.w || undefined}
      data-pth={size?.h || undefined}
      data-bm={bookmarked ? "1" : "0"}
      style={size ? { aspectRatio: `${size.w} / ${size.h}` } : undefined}
    >
      <span className="bmk" />
      {/* 0-1000 of the unrotated page, stretched to whatever box it ends up in,
          which is why a stroke drawn at 80% on a phone is the same stroke at
          250% on a laptop — and why ink survives zoom for free. */}
      <svg className="ink" ref={inkRef} viewBox="0 0 1000 1000" preserveAspectRatio="none" />
      <span className="marks" ref={marksRef} />
      <canvas ref={canvasRef} data-on={ready ? "" : undefined} />
      <div className="textLayer" ref={textRef} />
      <span className="pgno">{pad(pageNumber)}</span>
    </article>
  );
}
