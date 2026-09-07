import { useCallback, useEffect, useMemo, useRef } from "react";
import { pathFor, toFraction, strokesUnder } from "../../lib/paperInk.js";

/* =============================================================================
   THE INK LAYER — one SVG over one page.

   It sits between the picture and the words, in the same sandwich a highlight
   does, so ink goes over the page and under the selectable text. When no
   drawing tool is armed it is `pointer-events: none` and might as well not
   exist: selecting, tapping and marking all behave exactly as they did.

   THE LIVE STROKE IS NOT REACT STATE, AND THAT IS THE WHOLE PERFORMANCE STORY.

   A pointer reports at 120Hz or better, and a stroke drawn across a page is
   several hundred moves. Putting each one through setState re-renders this
   component, the page, and every mark rectangle on it — several hundred times,
   while the hand is still moving. The line lags behind the finger, which is the
   one thing ink cannot do.

   So the points accumulate in a ref and the live path's `d` is written straight
   to the DOM. React finds out once, on pointerup, when there is a stroke to
   keep. The committed strokes above it are ordinary React and re-render as
   rarely as anything else here.
   ========================================================================= */

export default function PaperInk({
  strokes = [], width, height, rotation = 0, page,
  tool, colour, penWidth, eraserRadius = 0.012,
  onCommit, onErase, me,
}) {
  const svgRef = useRef(null);
  const liveRef = useRef(null);
  const points = useRef([]);
  const drawing = useRef(false);
  const erased = useRef(new Set());

  const box = useMemo(() => ({ width, height }), [width, height]);
  const drawingTool = tool === "pen" || tool === "marker" || tool === "eraser";

  /* A stroke's on-screen width. Stored as a fraction of the page so the nib is
     the same thickness at 50% and at 300%; multiplied back out here, with a
     floor so a fine liner at 25% zoom is still a line rather than nothing. */
  const px = useCallback((w) => Math.max(0.75, (w || 0.003) * width), [width]);

  const point = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return toFraction(e.clientX - rect.left, e.clientY - rect.top,
                      { width: rect.width, height: rect.height }, rotation);
  }, [rotation]);

  const redrawLive = useCallback(() => {
    const el = liveRef.current;
    if (!el) return;
    el.setAttribute("d", pathFor(points.current, box, rotation));
  }, [box, rotation]);

  const down = useCallback((e) => {
    if (!drawingTool || e.button === 2) return;
    const at = point(e);
    if (!at) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;

    if (tool === "eraser") {
      erased.current = new Set();
      const hit = strokesUnder(strokes, at, eraserRadius, page).filter((s) => s.author_id === me);
      for (const s of hit) erased.current.add(s.id);
      if (hit.length) onErase?.([...erased.current]);
      return;
    }
    points.current = [at];
    redrawLive();
  }, [drawingTool, point, tool, strokes, eraserRadius, page, me, onErase, redrawLive]);

  const move = useCallback((e) => {
    if (!drawing.current) return;

    /* Every position the browser recorded since the last frame, not just the
       one it woke us for. On a trackpad or a stylus that is often four or five
       points per frame, and using only the last one is what makes a fast
       diagonal come out as a visible sequence of straight facets. */
    const raw = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const events = raw.length ? raw : [e];

    if (tool === "eraser") {
      for (const ev of events) {
        const at = point(ev);
        if (!at) continue;
        const hit = strokesUnder(strokes, at, eraserRadius, page)
          .filter((s) => s.author_id === me && !erased.current.has(s.id));
        for (const s of hit) erased.current.add(s.id);
        if (hit.length) onErase?.([...erased.current]);
      }
      return;
    }

    for (const ev of events) {
      const at = point(ev);
      if (at) points.current.push(at);
    }
    redrawLive();
  }, [tool, point, strokes, eraserRadius, page, me, onErase, redrawLive]);

  const up = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === "eraser") { erased.current = new Set(); return; }
    const made = points.current;
    points.current = [];
    liveRef.current?.setAttribute("d", "");
    if (made.length) onCommit?.(made);
  }, [tool, onCommit]);

  /* A pointer that leaves the window mid-stroke still ends the stroke. Without
     this, letting go outside the page leaves `drawing` true and the next tap
     anywhere continues the old line. */
  useEffect(() => {
    if (!drawingTool) return undefined;
    const cancel = () => up();
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drawingTool, up]);

  const mine = useMemo(() => strokes.filter((s) => s.page === page), [strokes, page]);

  return (
    <svg
      ref={svgRef}
      className="pp-ink"
      data-armed={drawingTool ? "" : undefined}
      data-tool={drawingTool ? tool : undefined}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      aria-hidden="true"
    >
      {mine.map((s) => (
        <path
          key={s.id}
          d={pathFor(s.points, box, rotation)}
          className="ink-stroke"
          data-colour={s.colour}
          data-tool={s.tool}
          strokeWidth={px(s.width)}
        />
      ))}
      {/* The one being drawn right now. Its `d` is written by hand, above. */}
      <path
        ref={liveRef} d="" className="ink-stroke ink-live"
        data-colour={colour} data-tool={tool === "marker" ? "marker" : "pen"}
        strokeWidth={px(penWidth)}
      />
    </svg>
  );
}
