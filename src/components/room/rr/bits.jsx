import { hueFor, initials } from "../../../lib/familiar.js";
import { STATUS_WORD } from "../../../lib/rrModel.js";
import { Seal } from "../../module/SignOff.jsx";
import { Up, Down } from "./icons.jsx";

/* ============================================================================
   THE READY ROOM'S SMALL PARTS — the ones three or more screens use.
   ========================================================================= */

/* A face. The colour is the app's existing avatar recipe, keyed by the same
   hue every other surface uses for this person (rr-app.css), so somebody is
   one colour everywhere. `mod` is a module's tile, which is ink on the sunk
   surface rather than a person's colour. */
export function Av({ id, name, size = 32, square = false, mod = false, label = null }) {
  const text = label || (square || mod ? String(name || id || "?").slice(0, 2).toUpperCase() : initials(name));
  return (
    <span className="rr-av" aria-hidden="true"
          data-sq={square || mod ? "1" : undefined} data-mod={mod ? "1" : undefined}
          style={{ width: size, height: size, fontSize: Math.round(size * (mod ? 0.3 : 0.38)), "--av-h": hueFor(id) }}>
      {text}
    </span>
  );
}

/* ONE VOTE PILL for the feed row, the question and every answer. Pressing the
   arrow you already pressed clears your vote. The arrows are <i>, as the
   stylesheet draws them, so they carry their own role and keys.

   An answer has no down arrow. 0010 made answers endorse-only on purpose —
   "an answer can be endorsed, not buried" — and a pill that offered a
   downvote the table cannot hold would be a control that does nothing. */
export function Vote({ score = 0, mine = 0, onVote, downable = true, what = "this" }) {
  const hit = (dir) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    onVote?.(mine === dir ? 0 : dir);
  };
  const key = (dir) => (e) => { if (e.key === "Enter" || e.key === " ") hit(dir)(e); };
  return (
    <span className="rr-vote" data-v={mine === 1 ? "1" : "0"}>
      <i role="button" tabIndex={0} aria-pressed={mine === 1}
         aria-label={`Useful, ${what}. ${score} so far.`} onClick={hit(1)} onKeyDown={key(1)}><Up /></i>
      <b>{score}</b>
      {downable && (
        <i role="button" tabIndex={0} aria-pressed={mine === -1}
           aria-label={`Not useful, ${what}`} onClick={hit(-1)} onKeyDown={key(-1)}><Down /></i>
      )}
    </span>
  );
}

export function Status({ s }) {
  return <span className="rr-status" data-s={s}>{STATUS_WORD[s]}</span>;
}

/* The lesson player's seal, pressed on when an answer is signed off. */
export function Stamp({ press = false }) {
  return (
    <span className="rr-stamp" data-press={press ? "1" : undefined} role="img" aria-label="Signed off">
      <Seal state="stamped" />
    </span>
  );
}
