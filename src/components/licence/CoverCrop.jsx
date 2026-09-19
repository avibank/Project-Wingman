/* §5's crop, ported from the reference's `openCrop`: a window the shape of the
   cover, drag to move, a slider to zoom, Cancel or Use.

   THE WINDOW IS THE COVER. 640x128 scaled to whatever the sheet is wide, so
   what you are looking at is exactly what will be drawn — not a square
   preview of a band. Panning is clamped so no edge of it is ever empty, which
   is the whole reason the crop exists rather than a "fit" that letterboxes. */
import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { clampPan, renderCover, COVER_W, COVER_H } from "../../lib/coverImage.js";
import "./licence.css";

export default function CoverCrop({ src, busy, onUse, onCancel }) {
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const [z, setZ] = useState(1.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  /* Re-clamp when the zoom drops: at z 1 there is no slack, so a pan set at
     z 2 has to come back to nothing rather than leaving a grey edge. */
  useEffect(() => {
    setPan((p) => ({ x: clampPan(p.x, z), y: clampPan(p.y, z) }));
  }, [z]);

  /* Drag to pan, in fractions of the WINDOW so the number means the same
     thing whatever size the sheet is. The starting pan is added to the
     movement rather than replaced by it, which is the difference between
     dragging and teleporting. */
  const onDown = (e) => {
    const box = boxRef.current;
    if (!box) return;
    box.setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect();
    const from = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
    const drag = (ev) => setPan({
      x: clampPan(from.x + (ev.clientX - from.px) / r.width, z),
      y: clampPan(from.y + (ev.clientY - from.py) / r.height, z),
    });
    /* pointerup is not the only way a drag ends — a cancelled pointer never
       fires it, and the listener would stay attached to the finger. */
    const up = () => {
      box.removeEventListener("pointermove", drag);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
    box.addEventListener("pointermove", drag);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
  };

  const use = async () => {
    const img = imgRef.current;
    if (!img) return;
    onUse(await renderCover(img, { z, ...pan }));
  };

  return (
    <div className="lic-scrim" role="dialog" aria-label="Position your cover"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="lic-sheet">
        <button type="button" className="lic-x" onClick={onCancel} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
        <h3>Position your cover</h3>

        <div className="lic-crop" ref={boxRef} onPointerDown={onDown}
             style={{ aspectRatio: `${COVER_W} / ${COVER_H}` }}>
          <img ref={imgRef} src={src} alt="" draggable="false"
               onLoad={() => setReady(true)}
               style={{ "--cz": z, "--cx": `${pan.x * 100}%`, "--cy": `${pan.y * 100}%` }} />
        </div>

        <div className="lic-crow">
          <ZoomIn size={16} aria-hidden="true" />
          <input type="range" className="barrange" min="100" max="300" value={Math.round(z * 100)}
                 aria-label="Zoom" onChange={(e) => setZ(Number(e.target.value) / 100)} />
        </div>
        <p className="lic-cnote">Drag the image to move it.</p>

        <div className="lic-cbtns">
          <button type="button" className="st-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="st-btn is-pri" onClick={use} disabled={busy || !ready}>
            {busy ? "Uploading…" : "Use this"}
          </button>
        </div>
      </div>
    </div>
  );
}
