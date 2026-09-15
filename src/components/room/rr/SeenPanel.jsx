import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Av } from "./bits.jsx";
import { Tick2 } from "./icons.jsx";
import { clock, when } from "../../../lib/roomModel.js";

/* ============================================================================
   MESSAGE INFO — who has read one of your messages, and when they opened it.
   -----------------------------------------------------------------------------
   Anchored under the bubble, kept on screen, opaque, and mounted inside .rr so
   it reads the room's tokens. It closes on a press outside it and on a resize,
   where the bubble it points at moves; Escape is the room's, because Escape is
   one step back and the room decides what the step is.
   ========================================================================= */

const WIDTH = 268;

/* The clock today, and the day in front of it otherwise: "Yesterday 20:32". */
const at = (iso) => (new Date(iso).toDateString() === new Date().toDateString()
  ? clock(iso) : `${when(iso)} ${clock(iso)}`);

export default function SeenPanel({ message, receipts, anchor, who, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({
      left: Math.max(12, Math.min(window.innerWidth - WIDTH - 12, r.right - WIDTH)),
      top: Math.max(12, Math.min(r.bottom + 8, window.innerHeight - el.offsetHeight - 12)),
    });
  }, [anchor, receipts]);

  useEffect(() => {
    const away = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains?.(e.target)) return;
      onClose();
    };
    const moved = () => onClose();
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("resize", moved);
    };
  }, [anchor, onClose]);

  const { others = 0, seen = [], deliv = [] } = receipts || {};
  const preview = message.body
    || message.attachments?.find((a) => a.fileName)?.fileName
    || (message.attachments?.length ? "An attachment" : "");

  const row = ([id, time]) => (
    <div className="rr-sp-row" key={id}>
      <Av id={id} name={who(id)} size={26} />
      <span className="rr-nm">{who(id)}</span>
      <span className="rr-t">{at(time)}</span>
    </div>
  );

  return (
    <div className="rr-seenpanel" ref={ref} role="dialog" aria-label="Message info"
         style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}>
      <div className="rr-sp-head">
        <span className="rr-micro">Message info</span>
        <button type="button" className="rr-sp-x is-inline" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="rr-sp-preview">{preview}</div>

      <div className="rr-sp-sect">
        <span className="rr-sp-lab" data-k="read"><Tick2 />Read <b>{seen.length}/{others}</b></span>
      </div>
      {seen.length ? seen.map(row) : (
        <div className="rr-sp-empty">
          {others ? "Each person who opens it appears here." : "Invite someone to the squadron and it goes to them."}
        </div>
      )}

      <div className="rr-sp-sect">
        <span className="rr-sp-lab"><Tick2 />Delivered <b>{deliv.length}</b></span>
      </div>
      {deliv.length ? deliv.map(row) : (
        <div className="rr-sp-empty">
          {others && seen.length >= others ? "Everyone has read it." : "Each phone it reaches appears here."}
        </div>
      )}
    </div>
  );
}
