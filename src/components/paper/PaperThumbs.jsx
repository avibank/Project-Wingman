import { useEffect, useRef, useState } from "react";

/* The page rail. Every reader people already use has one, and it is the only
   control that answers "how far in am I" without arithmetic.

   Thumbnails render once, at a fixed width, and are never re-rendered on zoom —
   the rail is a map of the document, not a second view of it. */
const THUMB_W = 108;

function Thumb({ doc, pageNumber, current, onPick }) {
  const ref = useRef(null);
  const [ratio, setRatio] = useState(1.414);            // A4 until we know better

  useEffect(() => {
    let live = true;
    let task = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (!live) return;
      const base = page.getViewport({ scale: 1 });
      const scale = THUMB_W / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = ref.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${THUMB_W}px`;
      canvas.style.height = `${Math.round(viewport.height)}px`;
      setRatio(viewport.height / viewport.width);
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = page.render({ canvasContext: ctx, viewport });
      try { await task.promise; } catch { /* cancelled */ }
    })();
    return () => { live = false; try { task?.cancel(); } catch { /* done */ } };
  }, [doc, pageNumber]);

  return (
    <li>
      <button type="button" className="thumb" aria-current={current ? "true" : undefined}
              onClick={() => onPick(pageNumber)}>
        <span className="thumb-shot" style={{ aspectRatio: `1 / ${ratio}` }}>
          <canvas ref={ref} />
        </span>
        <span className="thumb-n">{pageNumber}</span>
      </button>
    </li>
  );
}

export default function PaperThumbs({ doc, pages, current, onPick }) {
  const listRef = useRef(null);

  // Keep the current page in view as the reader scrolls the document, but never
  // fight a scroll they are making in the rail itself.
  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [current]);

  if (!doc) return null;
  return (
    <ul className="thumbs" ref={listRef}>
      {Array.from({ length: pages }, (_, i) => (
        <Thumb key={i + 1} doc={doc} pageNumber={i + 1}
               current={current === i + 1} onPick={onPick} />
      ))}
    </ul>
  );
}
