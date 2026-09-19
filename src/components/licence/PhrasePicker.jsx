/* pickPhrase() from docs/launch/code/07-card-and-avatar.js: `.plist` of `.pp`.
   Exactly three, and that is the whole design — a free line under somebody's
   name is a moderation surface, and these three are jokes every AME has heard
   in a hangar. */
import { PHRASES } from "../../lib/cover.js";
import Sheet from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";

export default function PhrasePicker({ phrase, onPick, onClose }) {
  return (
    <Sheet label="Your phrase" onClose={onClose}>
      <h3>Your phrase</h3>
      <div className="plist">
        {PHRASES.map((p) => (
          <button key={p} type="button" className={`pp${phrase === p ? " on" : ""}`}
                  aria-pressed={phrase === p}
                  onClick={() => onPick(phrase === p ? null : p)}>
            {p}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
