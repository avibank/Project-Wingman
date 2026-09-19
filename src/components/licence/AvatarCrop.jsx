/* §5's crop, for a face. Ported from the reference's `openCrop`
   (08-photo-and-cover-pickers.js): a circular window, drag to move, a slider
   to zoom, Cancel or Use.

   WHAT YOU SEE IS WHAT IS STORED. The preview is the photo cover-fitted into
   a square with `translate(x, y) scale(z)` on top — the same three numbers
   avatar.css applies at every size, from 28px in a comment to 104px on the
   licence. Previewing a crop one way and drawing it another is how a face
   ends up centred on somebody's ear. */
import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { clampPan, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX } from "../../lib/avatar.js";
import "./licence.css";

export default function AvatarCrop({ src, busy, onUse, onCancel }) {
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const [zoom, setZoom] = useState(120);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  /* Re-clamp when the zoom drops: at 100 there is no slack at all, so a pan
     set at 300 has to come back to nothing rather than leaving a gap. */
  useEffect(() => {
    setPan((p) => ({ x: clampPan(p.x, zoom), y: clampPan(p.y, zoom) }));
  }, [zoom]);

  const onDown = (e) => {
    const box = boxRef.current;
    if (!box) return;
    box.setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect();
    const from = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
    const drag = (ev) => setPan({
      x: clampPan(from.x + ((ev.clientX - from.px) / r.width) * 100, zoom),
      y: clampPan(from.y + ((ev.clientY - from.py) / r.height) * 100, zoom),
    });
    /* pointerup is not the only way a drag ends; a cancelled pointer never
       fires it and the listener would stay attached to the finger. */
    const up = () => {
      box.removeEventListener("pointermove", drag);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
    box.addEventListener("pointermove", drag);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
  };

  return (
    <div className="lic-scrim" role="dialog" aria-label="Position your photo"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="lic-sheet">
        <button type="button" className="lic-x" onClick={onCancel} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
        <h3>Position your photo</h3>

        <div className="lic-acrop" ref={boxRef} onPointerDown={onDown}>
          <img ref={imgRef} src={src} alt="" draggable="false"
               onLoad={() => setReady(true)}
               style={{ "--z": zoom / 100, "--x": `${pan.x}%`, "--y": `${pan.y}%` }} />
          <span className="lic-acrop-mask" aria-hidden="true" />
        </div>

        <div className="lic-crow">
          <ZoomIn size={16} aria-hidden="true" />
          <input type="range" className="barrange" min={PHOTO_ZOOM_MIN} max={PHOTO_ZOOM_MAX}
                 value={zoom} aria-label="Zoom"
                 onChange={(e) => setZoom(Number(e.target.value))} />
        </div>
        <p className="lic-cnote">Drag the photo to move it.</p>

        <div className="lic-cbtns">
          <button type="button" className="st-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="st-btn is-pri" disabled={busy || !ready}
                  onClick={() => onUse(imgRef.current, { zoom, ...pan })}>
            {busy ? "Uploading…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
