import { useEffect, useRef, useState } from "react";
import { MIN_FLOOR, MIN_CEIL, PASS_PCT, clampMinimums } from "../../lib/minimums.js";

/* ============================================================================
   §3 — "Tapping the small dial opens the minimums setting — a short popover
   with a slider. That is where the user sets their bar, and it is the only
   place they need to."

   A POPOVER, not a modal: no page dim and no focus trap, the same as the
   instrument popover it replaces. Dimming the whole screen to move one slider
   would make setting your own standard feel like an interruption.

   The slider writes on every input, deliberately. This is a preference with a
   live preview — the dial behind the popover re-reads on each change, so the
   user watches the pass tick slide off centre as they lower their bar, which
   is the one thing that makes the relationship legible. A commit-on-blur
   control would hide exactly that.
   ========================================================================= */

const W = 268;

export default function MinimumsPop({ anchor, value, onChange, onClose }) {
  const ref = useRef(null);
  // Latched at mount so the popover keeps its position while the slider moves.
  const [box] = useState(() => anchor?.getBoundingClientRect?.() || null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchor?.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose, anchor]);

  useEffect(() => { ref.current?.focus(); }, []);

  /* CSS ZOOM, and it is the reason these numbers are divided.

     .content carries `zoom: var(--font-scale)` — the text-size control — and
     CSS zoom scales FIXED descendants too; being position: fixed does not
     exempt an element from an ancestor's zoom. getBoundingClientRect returns
     real screen pixels, but the left/top written here are interpreted in the
     zoomed coordinate space, so at the Large text size every offset came out
     1.15x too far right and too far down. Dividing converts screen pixels
     back into the space the style is read in. */
  const zoom = (() => {
    let z = 1, el = anchor;
    while (el && el !== document.documentElement) {
      const v = parseFloat(getComputedStyle(el).zoom);
      if (Number.isFinite(v) && v > 0) z *= v;
      el = el.parentElement;
    }
    return z || 1;
  })();

  // Clamped to the viewport so it cannot hang off either edge on a phone.
  // The clamp is in the same divided space as the value it bounds.
  const vw = window.innerWidth / zoom;
  const bx = box ? box.left / zoom : 0;
  const bw = box ? box.width / zoom : 0;
  const left = box ? Math.max(8, Math.min(vw - W - 8, bx + bw / 2 - W / 2)) : 8;
  const arrow = box ? Math.max(14, Math.min(W - 24, bx + bw / 2 - left - 5)) : 24;

  return (
    <div className="pop minpop" ref={ref} tabIndex={-1} role="dialog" aria-label="Your minimums"
         style={{
           left: `${left}px`,
           // No scrollY: the popover is position: fixed, so its coordinates are
           // viewport coordinates. Adding the scroll offset to a fixed element
           // pushes it down the page by however far the page happens to be
           // scrolled.
           top: box ? `${box.bottom / zoom + 10}px` : "auto",
           "--arrow": `${arrow}px`,
           width: `${W}px`,
         }}>
      <h3>Your minimums</h3>
      <p className="pop-reading">
        The bar you hold yourself to. Master Caution lights below it. The pass
        mark stays marked at {PASS_PCT}% wherever you set yours.
      </p>

      <label className="minpop-row">
        <span className="sr-only-lbl">Your minimums, per cent</span>
        <input type="range" className="minpop-range"
               min={MIN_FLOOR} max={MIN_CEIL} step="1" value={value}
               onChange={(e) => onChange?.(clampMinimums(e.target.value))} />
      </label>

      <p className="minpop-val">
        <b>{value}%</b>
        <span>{value === PASS_PCT ? "the same as the pass mark"
          : value > PASS_PCT ? `${value - PASS_PCT} above the pass mark`
            : `${PASS_PCT - value} below the pass mark`}</span>
      </p>
    </div>
  );
}
