import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, ArrowBigUp, ArrowBigDown } from "lucide-react";
import { initials, hueFor } from "../../lib/familiar.js";

/* ============================================================================
   THE ROOM'S SMALL PARTS.

   Everything here is used by three or more of the room's screens, which is the
   only reason it is shared: a part lifted out before it has a second caller is
   an abstraction with one implementation and two places to read.

   EVERY CONTROL SMALLER THAN 44px CARRIES `is-inline`. The app enforces a
   global 44px floor on `.app button:not(.is-inline)` (App.jsx §12) and that
   floor would turn a 28px reaction chip into a circle. `is-inline` is the
   deliberate opt-out and it restores the hit area with a pseudo-element, so
   the control stays small and the target does not.
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
export function Face({ id, name, size = "", state = "off", onClick, label }) {
  const body = (
    <span className="avwrap">
      <Avatar id={id} name={name} size={size} />
      {state !== "off" && <i className={`dot ${state}`} aria-hidden="true" />}
    </span>
  );
  if (!onClick) return body;
  return (
    <button type="button" className="facebtn is-inline" onClick={onClick}
            aria-label={label || `Open ${name}'s profile`}>
      {body}
    </button>
  );
}

/* §4a — one pill holding the growing textarea, with send outside it. Enter
   sends, Shift+Enter newlines.

   The textarea is UNCONTROLLED above the pill: the room keeps the draft so
   that leaving a conversation abandons it, but every keystroke re-rendering
   the whole transcript made typing lag on a long chat. It reports out on
   change and re-seeds only when the conversation changes. */
/* NO PAPERCLIP AND NO EMOJI BUTTON, and their absence is deliberate rather
   than unfinished: there is no file store behind an attachment and no picker
   behind a face, and a control that opens nothing is the exact fault this
   rebuild exists to remove. Reactions are on the message, where they belong. */
export function Composer({ value, onChange, onSend, placeholder, sending = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);
  return (
    <div className="composer">
      <div className="pill">
        <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
                  }} />
      </div>
      <button type="button" className="send" onClick={onSend}
              disabled={!value.trim() || sending} aria-label="Send">
        <Send aria-hidden="true" />
      </button>
    </div>
  );
}

/* §4b — the vote column, on questions and on answers alike. The number is the
   score INCLUDING your own vote, because a count that does not move when you
   press it reads as a control that did nothing. */
export function Votes({ score = 0, mine = 0, onVote, what = "this" }) {
  return (
    <div className="votes">
      <button type="button" className="is-inline" aria-pressed={mine === 1}
              onClick={() => onVote(mine === 1 ? 0 : 1)}
              aria-label={`Useful. ${score} so far.`}>
        <ArrowBigUp aria-hidden="true" />
      </button>
      <span className="n">{score}</span>
      <button type="button" className="is-inline down" aria-pressed={mine === -1}
              onClick={() => onVote(mine === -1 ? 0 : -1)}
              aria-label={`Not useful, ${what}`}>
        <ArrowBigDown aria-hidden="true" />
      </button>
    </div>
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
