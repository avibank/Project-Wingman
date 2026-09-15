import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { initials, hueFor } from "../../lib/familiar.js";

/* ============================================================================
   THE OLD ROOM'S SMALL PARTS — still used by Discover, the profile and squadron
   sheets, the menu and the toast, all styled by room.css through the bridge in
   rr-app.css. The rebuilt screens keep their own parts in ./rr.

   A control smaller than 44px carries `is-inline`, which opts it out of the
   app's 44px floor (App.jsx §12); rr-app.css gives it back a 44px target.
   ========================================================================= */

export function Avatar({ id, name, size = "", square = false }) {
  return (
    <span className={`av ${size} ${square ? "sq" : ""}`.trim()}
          style={{ "--av-h": hueFor(id) }} aria-hidden="true">
      {square ? String(name || id || "?").slice(0, 2).toUpperCase() : initials(name)}
    </span>
  );
}

/* A face with a presence dot. `state` is 'on' | 'away' | 'off' and 'off' draws
   no dot at all rather than a grey one — a grey dot is still a dot, and a row
   of them says "everyone is here, dimly". */
export function Face({ id, name, size = "", state = "off" }) {
  return (
    <span className="avwrap">
      <Avatar id={id} name={name} size={size} />
      {state !== "off" && <i className={`dot ${state}`} aria-hidden="true" />}
    </span>
  );
}

/* A popover anchored to whatever opened it. Closes on Escape, on a click
   outside, and on scroll — a menu that stays put while the page moves under it
   points at the wrong thing, which is worse than closing. */
export function Menu({ anchor, items = [], onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    setPos({
      left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left)),
      top: r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6,
    });
  }, [anchor]);

  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target) && e.target !== anchor) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, onClose]);

  return (
    <div className="menu" ref={ref} role="menu"
         style={pos ? { left: pos.left, top: pos.top } : { opacity: 0 }}>
      {items.map((it, i) => (it === "-" ? (
        <div className="sep" key={`s${i}`} aria-hidden="true" />
      ) : (
        <button type="button" key={it.id} role="menuitem"
                className={it.danger ? "danger" : undefined}
                onClick={() => { onClose(); it.run(); }}>
          {it.icon}<span>{it.label}</span>
        </button>
      )))}
    </div>
  );
}

/* One line, bottom centre, gone in a few seconds. It exists because half the
   room's actions are invisible when they succeed — a reaction that fails, a
   link that copied, an invite that sent — and silence after a press reads as
   a broken button. It is `role="status"`, so it is announced without stealing
   focus. */
export function Toast({ message, icon = null }) {
  return (
    <div className="toast" data-open={message ? "true" : "false"} role="status">
      {message && <>{icon}<span>{message}</span></>}
    </div>
  );
}

/* Both sheets are the same object: a drawer on a desktop, full height on a
   phone, Escape and the backdrop both close it, and focus moves inside on
   open so the first Tab lands in the sheet rather than behind it. */
export function Sheet({ open, label, onClose, children }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);
  return (
    <>
      <div className="veil" data-open={open ? "true" : "false"} onClick={onClose} aria-hidden="true" />
      <aside className="drawer" data-open={open ? "true" : "false"} role="dialog" aria-modal="true"
             aria-label={label} aria-hidden={open ? undefined : "true"}>
        {open && children(closeRef)}
      </aside>
    </>
  );
}
