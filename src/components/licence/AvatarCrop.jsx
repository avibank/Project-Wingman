/* =============================================================================
   openCrop() from docs/launch/code/08-photo-and-cover-pickers.js, markup for
   markup: a square `.crop` with a circular `.cmask` over it, drag to move, a
   `.barr` slider between two magnifier glyphs, and Cancel / Use photo.

   WHAT YOU SEE IS WHAT IS STORED. The preview is the photo cover-fitted into a
   square with `translate(x, y) scale(z)` on top — the same three numbers
   avatar.css applies at every size, from 28px in a comment to 104px on the
   licence. Previewing a crop one way and drawing it another is how a face ends
   up centred on somebody's ear.
   ========================================================================= */
import { useEffect, useRef, useState } from "react";
import { clampPan, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX } from "../../lib/avatar.js";
import Sheet from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";

/* The reference's two glyphs: zoom out on the left of the slider, zoom in on
   the right. Same circle, one stroke apart. */
const Mag = ({ plus }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d={`m20 20-3.5-3.5M8 11h6${plus ? "M11 8v6" : ""}`} />
  </svg>
);

export default function AvatarCrop({ src, busy, onUse, onCancel }) {
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const [zoom, setZoom] = useState(120);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [grab, setGrab] = useState(false);

  /* Re-clamp when the zoom drops: at 100 there is no slack at all, so a pan
     set at 300 has to come back to nothing rather than leaving a gap. */
  useEffect(() => {
    setPan((p) => ({ x: clampPan(p.x, zoom), y: clampPan(p.y, zoom) }));
  }, [zoom]);

  const onDown = (e) => {
    const box = boxRef.current;
    if (!box) return;
    box.setPointerCapture(e.pointerId);
    setGrab(true);
    const r = box.getBoundingClientRect();
    const from = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y };
    const drag = (ev) => setPan({
      x: clampPan(from.x + ((ev.clientX - from.px) / r.width) * 100, zoom),
      y: clampPan(from.y + ((ev.clientY - from.py) / r.height) * 100, zoom),
    });
    /* pointerup is not the only way a drag ends; a cancelled pointer never
       fires it and the listener would stay attached to the finger. */
    const up = () => {
      setGrab(false);
      box.removeEventListener("pointermove", drag);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
    box.addEventListener("pointermove", drag);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
  };

  /* The slider's filled half. The reference paints it with --p and so does
     this: the track is one gradient whose stop is the value. */
  const p = `${((zoom - PHOTO_ZOOM_MIN) / (PHOTO_ZOOM_MAX - PHOTO_ZOOM_MIN)) * 100}%`;

  return (
    <Sheet label="Position your photo" onClose={onCancel}>
      <h3>Position your photo</h3>

      <div className={`crop${grab ? " grab" : ""}`} ref={boxRef} onPointerDown={onDown}>
        <img ref={imgRef} src={src} alt="" draggable="false"
             onLoad={() => setReady(true)}
             style={{ "--z": zoom / 100, "--x": `${pan.x}%`, "--y": `${pan.y}%` }} />
        <span className="cmask" aria-hidden="true" />
      </div>

      <div className="crow2">
        <Mag />
        <input type="range" className="barr" min={PHOTO_ZOOM_MIN} max={PHOTO_ZOOM_MAX}
               value={zoom} aria-label="Zoom" style={{ "--p": p }}
               onChange={(e) => setZoom(Number(e.target.value))} />
        <Mag plus />
      </div>
      <p className="snote" style={{ textAlign: "center", margin: "10px 0 0" }}>
        Drag the photo to move it
      </p>

      <div className="pbtns" style={{ marginTop: 16 }}>
        <button type="button" className="pill" onClick={onCancel}>Cancel</button>
        <button type="button" className="pill pri" disabled={busy || !ready}
                onClick={() => onUse(imgRef.current, { zoom, ...pan })}>
          {busy ? "Uploading…" : "Use photo"}
        </button>
      </div>
    </Sheet>
  );
}
