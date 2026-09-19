/* =============================================================================
   openSheet(), as a component.
   -----------------------------------------------------------------------------
   The reference opens every picker the same way (07-card-and-avatar.js):

     $('#sheet').innerHTML = `<div class="pick"><button class="x2" id="closeP">…
     $('#scrim').classList.add('open');

   — one scrim, one sheet, one `.pick` card with a close button in its corner.
   Five pickers share it there and five share it here, for the same reason: a
   second copy of this markup is a second sheet that drifts.

   The reference's scrim is always in the document and toggles `.open`. React
   mounts and unmounts instead, so `open` is set on the way in; the class is
   what the stylesheet keys the fade off and the pointer events on, and leaving
   it off would leave a picker you could see and not press.
   ========================================================================= */
import { useEffect } from "react";

/* Escape closes it. Every one of these is a choice about the card behind it,
   and a dialog you can only leave by aiming at a 32px corner is one a keyboard
   cannot leave at all. Exported because the stamp creator is the one picker
   that is not a `.pick` sheet — it has the reference's own `.studio` frame —
   and it was the one you could not leave. */
export function useEscape(onClose) {
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
}

export default function Sheet({ label, onClose, children }) {
  useEscape(onClose);

  return (
    <div className="scrim open" role="dialog" aria-modal="true" aria-label={label}
         onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="sheet">
        <div className="pick">
          <button type="button" className="x2" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
