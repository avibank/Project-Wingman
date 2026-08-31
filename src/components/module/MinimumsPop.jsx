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

  // Clamped to the viewport so it cannot hang off either edge on a phone.
  const left = box
    ? Math.max(8, Math.min(window.innerWidth - W - 8, box.left + box.width / 2 - W / 2))
    : 8;
  const arrow = box ? Math.max(14, Math.min(W - 24, box.left + box.width / 2 - left - 5)) : 24;

  return (
    <div className="pop minpop" ref={ref} tabIndex={-1} role="dialog" aria-label="Your minimums"
         style={{
           left: `${left}px`,
           top: box ? `${box.bottom + window.scrollY + 10}px` : "auto",
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
