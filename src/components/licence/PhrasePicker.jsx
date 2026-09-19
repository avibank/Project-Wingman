/* §5's phrase picker. Exactly three, and that is the whole design: a free
   line under somebody's name is a moderation surface, and these three are
   jokes every AME has heard in a hangar. */
import { X } from "lucide-react";
import { PHRASES } from "../../lib/cover.js";
import "./licence.css";

export default function PhrasePicker({ phrase, onPick, onClose }) {
  return (
    <div className="lic-scrim" role="dialog" aria-label="Your phrase"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lic-sheet">
        <button type="button" className="lic-x" onClick={onClose} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
        <h3>Your phrase</h3>
        <div className="lic-plist">
          {PHRASES.map((p) => (
            <button key={p} type="button"
                    className={`lic-pp${phrase === p ? " is-on" : ""}`}
                    aria-pressed={phrase === p}
                    onClick={() => onPick(phrase === p ? null : p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
