/* §5's crop, ported from the reference's `openCrop`: a window the shape of the
   cover, drag to move, a slider to zoom, Cancel or Use.

   THE WINDOW IS THE COVER. 640x128 scaled to whatever the sheet is wide, so
   what you are looking at is exactly what will be drawn — not a square
   preview of a band. Panning is clamped so no edge of it is ever empty, which
   is the whole reason the crop exists rather than a "fit" that letterboxes. */
import { useEffect, useRef, useState } from "react";
import { clampPan, renderCover, COVER_W, COVER_H } from "../../lib/coverImage.js";
import Sheet from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";

/* The reference's two glyphs: zoom out left of the slider, zoom in right. */
const Mag = ({ plus }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d={`m20 20-3.5-3.5M8 11h6${plus ? "M11 8v6" : ""}`} />
  </svg>
);

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

  /* The slider's filled half, painted the way the reference paints it. */
  const p = `${((z * 100 - 100) / 200) * 100}%`;

  return (
    <Sheet label="Position your cover" onClose={onCancel}>
      <h3>Position your cover</h3>

      {/* THE WINDOW IS THE COVER, so it is not the reference's square `.crop`:
          a 640x128 band cropped in a circle would be a crop of something else.
          The chrome around it — slider, note and buttons — is the reference's,
          because that part IS the same choice. */}
      <div className="lic-crop" ref={boxRef} onPointerDown={onDown}
           style={{ aspectRatio: `${COVER_W} / ${COVER_H}` }}>
        <img ref={imgRef} src={src} alt="" draggable="false"
             onLoad={() => setReady(true)}
             style={{ "--cz": z, "--cx": `${pan.x * 100}%`, "--cy": `${pan.y * 100}%` }} />
      </div>

      <div className="crow2">
        <Mag />
        <input type="range" className="barr" min="100" max="300" value={Math.round(z * 100)}
               aria-label="Zoom" style={{ "--p": p }}
               onChange={(e) => setZ(Number(e.target.value) / 100)} />
        <Mag plus />
      </div>
      <p className="snote" style={{ textAlign: "center", margin: "10px 0 0" }}>
        Drag the image to move it
      </p>

      <div className="pbtns" style={{ marginTop: 16 }}>
        <button type="button" className="pill" onClick={onCancel}>Cancel</button>
        <button type="button" className="pill pri" onClick={use} disabled={busy || !ready}>
          {busy ? "Uploading\u2026" : "Use this"}
        </button>
      </div>
    </Sheet>
  );
}
