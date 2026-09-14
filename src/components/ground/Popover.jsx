import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* A rounded panel that pops from whatever opened it — the same gesture the
   stacked faces on the route use. It rides scrolling instead of dismissing on
   it, because the browser scrolls the anchor into view when it takes focus. */
export function Popover({ anchor, onClose, label, children }) {
  const boxRef = useRef(null);
  const wrapRef = useRef(null);

  useLayoutEffect(() => {
    const place = () => {
      const wrap = wrapRef.current;
      const box = boxRef.current;
      if (!wrap || !box || !anchor) return;
      if (!document.body.contains(anchor)) return onClose();

      const a = anchor.getBoundingClientRect();
      if (a.bottom < -40 || a.top > window.innerHeight + 40) return onClose();

      const b = box.getBoundingClientRect();
      let left = a.left + a.width / 2 - b.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - b.width - 12));
      const above = a.top - b.height - 10;
      const top = above > 12 ? above : Math.min(a.bottom + 10, window.innerHeight - b.height - 12);

      wrap.style.left = `${left}px`;
      wrap.style.top = `${Math.max(12, top)}px`;
      box.style.transformOrigin = `${a.left + a.width / 2 - left}px ${above > 12 ? "bottom" : "top"}`;
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && e.target !== anchor) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    const first = boxRef.current?.querySelector("button");
    first?.focus();
  }, []);

  return createPortal(
    <div className="bog-pop" ref={wrapRef} data-open>
      <div className="bog-pop-in" ref={boxRef} role="dialog" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body
  );
}
