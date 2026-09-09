import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* =============================================================================
   THE PAGE RAIL.

   Every reader people already use has one, and it is the only control that
   answers "how far in am I" without arithmetic.

   -----------------------------------------------------------------------------
   IT DRAWS WHAT YOU CAN SEE, AND NOTHING ELSE.

   The first version mounted a <Thumb> per page and each one immediately asked
   pdf.js to render. On the fixture's fourteen pages that is invisible. On a
   real 1012-page manual it was 1012 canvases and 1012 render tasks queued at
   once: measured at 8,368 DOM nodes, an average frame of 2.6 SECONDS and a
   worst frame of 161. The reader was unusable and the cause was entirely in
   this file — the document itself was fine.

   So every page gets a slot at its own aspect ratio, from the manifest, so the
   rail scrolls correctly from the first frame — and only the slots actually on
   screen get a picture. An IntersectionObserver decides, with a margin either
   side so scrolling never lands on an empty one.

   And where ingest stored a thumbnail, an <img> is used instead of a render.
   Decoding a 6KB JPEG is nothing; rasterising a page of a technical manual is
   not.
   ========================================================================= */
const THUMB_W = 108;

/* At most a few pdf.js renders in the air at once. A flung rail must not queue
   fifty pages it has already scrolled past. */
const MAX_LIVE_RENDERS = 3;
let liveRenders = 0;

function Thumb({ doc, pageNumber, ratio, current, onPick, src, near }) {
  const ref = useRef(null);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    /* Nothing is drawn until the slot is near the viewport, and a stored
       thumbnail never needs the document at all. */
    if (!near || src || drawn || failed || !doc) return undefined;
    let live = true;
    let task = null;
    const start = async () => {
      if (liveRenders >= MAX_LIVE_RENDERS) {
        // Come back when the queue has drained rather than piling on.
        setTimeout(() => { if (live) start(); }, 180);
        return;
      }
      liveRenders += 1;
      try {
        const page = await doc.getPage(pageNumber);
        if (!live) { page.cleanup(); return; }
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: THUMB_W / base.width });
        const canvas = ref.current;
        if (!canvas) { page.cleanup(); return; }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${THUMB_W}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
        page.cleanup();
        if (live) setDrawn(true);
      } catch { if (live) setFailed(true); }
      finally { liveRenders = Math.max(0, liveRenders - 1); }
    };
    start();
    return () => { live = false; try { task?.cancel(); } catch { /* done */ } };
  }, [doc, pageNumber, near, src, drawn, failed]);

  return (
    <li>
      <button type="button" className={`th${current ? " on" : ""}`} aria-current={current ? "true" : undefined}
              data-page={pageNumber}
              onClick={() => onPick(pageNumber)}>
        {/* The slot is the right shape whether or not it has a picture in it,
            so the rail never reflows as thumbnails arrive. */}
        <span className="thumb-shot" style={{ aspectRatio: `1 / ${ratio}` }}>
          {/* A canvas is only mounted once the slot is near. Nine hundred empty
              ones cost nothing to paint and a great deal to keep. */}
          {src
            ? <img src={src} alt="" loading="lazy" decoding="async" width={THUMB_W} />
            : near ? <canvas ref={ref} /> : null}
        </span>
        <b>{pageNumber}</b>
      </button>
    </li>
  );
}

export default function PaperThumbs({ doc, pages, current, onPick, boxes, thumbSrc }) {
  const listRef = useRef(null);
  const [win, setWin] = useState([0, 24]);

  const ratios = useMemo(() => {
    if (!boxes?.length) return null;
    return boxes.map((b) => (b.h && b.w ? b.h / b.w : 1.414));
  }, [boxes]);

  /* Each slot's height, and where it starts. The rail is virtualised for the
     same reason the document is: a thousand slots is four thousand DOM nodes
     and React walks all of them on every scroll. */
  const LABEL = 20;
  const GAP = 10;
  const tops = useMemo(() => {
    const out = new Float64Array(pages + 1);
    let y = 0;
    for (let i = 0; i < pages; i++) {
      out[i] = y;
      y += THUMB_W * (ratios?.[i] ?? 1.414) + LABEL + GAP;
    }
    out[pages] = y;
    return out;
  }, [pages, ratios]);

  const at = useCallback((y) => {
    let lo = 0, hi = tops.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (tops[m] <= y) lo = m; else hi = m; }
    return lo;
  }, [tops]);

  const tick = useRef(0);
  const measure = useCallback(() => {
    if (tick.current) return;
    tick.current = requestAnimationFrame(() => {
      tick.current = 0;
      const el = listRef.current;
      if (!el) return;
      setWin(([a, b]) => {
        const na = Math.max(0, at(el.scrollTop) - 4);
        const nb = Math.min(pages, at(el.scrollTop + el.clientHeight) + 6);
        return (a === na && b === nb) ? [a, b] : [na, nb];
      });
    });
  }, [at, pages]);
  useEffect(() => { measure(); }, [measure]);
  useEffect(() => () => { if (tick.current) cancelAnimationFrame(tick.current); }, []);

  /* Keep the page you are on in view as the document scrolls — by arithmetic,
     because the slot for it is very often not mounted. */
  useEffect(() => {
    const el = listRef.current;
    if (!el || !current) return;
    const top = tops[current - 1];
    const bottom = tops[current];
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 2);
      measure();
    }
  }, [current, tops, measure]);

  if (!doc && !ratios) return null;
  const [from, to] = win;
  return (
    <ul className="thumbs" ref={listRef} onScroll={measure}>
      {from > 0 && <li className="thumb-space" style={{ height: tops[from] }} aria-hidden="true" />}
      {Array.from({ length: Math.max(0, to - from) }, (_, k) => {
        const n = from + k + 1;
        return (
          <Thumb key={n} doc={doc} pageNumber={n} current={current === n} onPick={onPick}
                 ratio={ratios?.[n - 1] ?? 1.414}
                 src={thumbSrc ? thumbSrc(n) : null}
                 near />
        );
      })}
      {to < pages && (
        <li className="thumb-space" aria-hidden="true"
            style={{ height: Math.max(0, tops[pages] - tops[to]) }} />
      )}
    </ul>
  );
}
