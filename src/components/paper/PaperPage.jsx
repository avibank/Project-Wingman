import { useEffect, useRef, useState, useMemo } from "react";
import { itemsInRange } from "../../lib/paperText.js";
import { pdfjs } from "../../lib/paperText.js";

/* =============================================================================
   One page of the paper: the picture, the words, and the marks on them.

   Three layers, in this order, and the order is the whole trick:

     canvas    the page as pdf.js draws it
     marks     highlights and density, painted UNDER the words
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
   ========================================================================= */

export default function PaperPage({
  doc, model, pageNumber, scale, rotation = 0,
  segments = [], activeId = null,
  onDivs, registerEl,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [size, setSize] = useState(null);
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

  /* WHAT THIS PAGE HAS ALREADY DRAWN.

     The effect below cancels its predecessor, and a cancelled render never
     reaches the text layer — so a re-run for a page that is already correct is
     not merely wasted work, it takes the selectable text away and puts nothing
     back. The signature is the only thing a render actually depends on; if it
     has not moved, there is nothing to do. */
  const drawn = useRef("");

  /* ---------------------------------------------------------------- render */
  useEffect(() => {
    if (!doc || !model) return undefined;
    const signature = `${pageNumber}@${scale}r${rotation}#${model.pages}`;
    if (drawn.current === signature) return undefined;
    let live = true;
    let task = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (!live) return;
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Crisp on a retina screen: the bitmap is bigger than the box it sits in.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      setSize({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });

      /* THE WORDS BEFORE THE PICTURE, and the order is load-bearing.

         A canvas render is cancelled whenever this effect re-runs — a rescale,
         a re-mount, anything. When the text layer was built after `await
         task.promise`, every cancellation took the selectable text with it and
         put nothing back: a page you could see and could not select a word of,
         which also means a page nobody can annotate. The text layer is cheap,
         it does not depend on the canvas, and building it first means the only
         thing a cancelled render costs is a repainted picture.

         pdf.js positions its spans from this custom property, so it has to be
         set before render(). */
      const holder = textRef.current;
      if (!holder) return;
      holder.replaceChildren();
      holder.style.setProperty("--scale-factor", String(scale));
      holder.style.width = `${Math.floor(viewport.width)}px`;
      holder.style.height = `${Math.floor(viewport.height)}px`;
      const layer = new pdfjs.TextLayer({
        textContentSource: await page.getTextContent(),
        container: holder,
        viewport,
      });
      await layer.render();
      if (!live) return;


      /* The spans and my runs have to line up one for one, because a mark is
         stored as "characters 412 to 470 of the paper" and the span is the only
         thing that knows where those characters are on screen. pdf.js builds
         one span per text run, in the same order getTextContent reported them,
         so position IS the mapping — but it is checked rather than assumed. A
         page where they disagree draws no marks at all, which is the only
         honest failure: a mark in the wrong place cannot be spotted by the
         person reading it. */
      const spans = layer.textDivs || [];
      const aligned = spans.length === pageItems.length;
      if (aligned) spans.forEach((el, i) => { el.dataset.item = String(i); });
      setDivs(aligned ? spans : null);
      cbs.current.onDivs?.(pageNumber, aligned ? spans : null, pageItems);
      setTick((t) => t + 1);

      // Now the picture. A cancellation here costs a repaint and nothing else.
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = page.render({ canvasContext: ctx, viewport });
      try { await task.promise; } catch { return; }      // superseded by a rescale
      if (live) drawn.current = signature;
    })();

    return () => { live = false; try { task?.cancel(); } catch { /* already done */ } };
    // pageItems is deliberately NOT a dependency: it is a fresh array on every
    // parent render, and as a dependency it restarted this effect continuously.
  }, [doc, model, pageNumber, scale, rotation, pageItems]);

  useEffect(() => { cbs.current.registerEl?.(pageNumber, wrapRef.current); }, [pageNumber]);

  /* ----------------------------------------------------------- mark rects */
  // Measured from the spans, so this recomputes whenever the page re-renders.
  const rects = useMemo(() => {
    if (!divs || !size) return [];
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
  }, [divs, size, segments, model, pageNumber, pageItems, tick]);

  return (
    <div className="pp" ref={wrapRef} data-page={pageNumber}
         style={size ? { width: size.w, height: size.h } : undefined}>
      <canvas className="pp-canvas" ref={canvasRef} />

      <div className="pp-marks" aria-hidden="true">
        {rects.map((r) => (
          <span
            key={r.key}
            className="pp-mark"
            data-kind={r.seg.kind || undefined}
            data-density={r.seg.density || undefined}
            data-active={r.seg.ids.includes(activeId) ? "" : undefined}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        ))}
      </div>

      <div className="pp-text" ref={textRef} />

      {!size && <div className="pp-wait" aria-hidden="true" />}
    </div>
  );
}
