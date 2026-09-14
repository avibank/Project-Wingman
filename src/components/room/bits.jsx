import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, ArrowBigUp, ArrowBigDown } from "lucide-react";
import AttachmentSheet from "./AttachmentSheet.jsx";
import AttachmentTray from "./AttachmentTray.jsx";
import { SendPlane, PlusIcon } from "./chatIcons.jsx";
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

/* §4a — the composer. One bar holding the attach button and a growing field,
   with send outside it. Enter sends, Shift+Enter makes a new line, and the
   field grows to five lines and then scrolls.

   The draft is the room's, not this component's: the room keeps it so that
   leaving a conversation abandons it. This reports every change out and is
   re-seeded when the conversation changes.

   ATTACHMENTS ARE OPT-IN PER PANE. The squadron chat passes `pending` and gets
   the attach button, the sheet and the tray; a thread and the right seat pass
   nothing and get the same bar without them. A pane that cannot send a photo
   must not show a button that offers to — that is the fault the room rebuild
   existed to remove, and it is still the rule.

   There is still no emoji button. Reactions are on the message, where they
   belong. */
export function Composer({
  value, onChange, onSend, placeholder, sending = false,
  pending = null, onRemovePending = () => {}, onAttachFiles = () => {},
  onAttachPassage = () => {}, marks = [], marksLoading = false, onWantMarks = () => {},
}) {
  const ref = useRef(null);
  const [sheet, setSheet] = useState(false);
  const attaching = Array.isArray(pending);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // The cap is the stylesheet max-height, read rather than repeated, so the
    // two cannot disagree about where the fifth line ends.
    const cap = parseFloat(getComputedStyle(el).maxHeight) || 105;
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
  }, [value]);
  const canSend = Boolean((value.trim() || (attaching && pending.length > 0)) && !sending);
  return (
    <>
      {attaching && <AttachmentTray items={pending} onRemove={onRemovePending} />}
      <div className="composer">
        {attaching && (
          <AttachmentSheet open={sheet} onClose={() => setSheet(false)}
                           onPickFiles={onAttachFiles} onPickPassage={onAttachPassage}
                           onWantMarks={onWantMarks} marks={marks} marksLoading={marksLoading} />
        )}
        <div className="bar">
          {attaching && (
            <button type="button" className="attach is-inline" aria-expanded={sheet}
                    aria-label="Add an attachment" onClick={() => setSheet((o) => !o)}>
              <PlusIcon />
            </button>
          )}
          <div className="field">
            <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
                      onChange={(e) => onChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) onSend(); }
                      }}
                      onPaste={(e) => {
                        /* A screenshot pasted straight into the field becomes a photo. */
                        if (!attaching) return;
                        const files = Array.from(e.clipboardData?.files || []);
                        if (files.length) { e.preventDefault(); onAttachFiles(files, "image"); }
                      }} />
          </div>
        </div>
        <button type="button" className="send" onClick={onSend} disabled={!canSend} aria-label="Send">
          <SendPlane />
        </button>
      </div>
    </>
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
