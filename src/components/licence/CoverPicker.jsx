/* §5's cover picker: five drawn sets and Your image in a 3x2 grid, and the
   thirty-six inks under them. Ported from the reference's `pickCover`.

   THE INKS ARE THE STAMP'S INKS. Not a second palette — the same thirty-six
   names, so a pilot's cover and their stamp can be the same colour and mean
   it. The ink tints the cover AND the initials circle, which is why picking
   one changes two things at once and why the preview is the card itself
   rather than a swatch in here. */
import { X, Upload } from "lucide-react";
import { COVERS, COVER_IDS, coverGradient, coverName } from "../../lib/cover.js";
import { PALETTE, col, inkByName } from "../../lib/stamp.js";
import "./licence.css";

function Thumb({ id, ink }) {
  if (id === "image") {
    return <span className="lic-cthumb is-up"><Upload size={20} aria-hidden="true" /></span>;
  }
  return (
    <span className="lic-cthumb" style={{ background: coverGradient(ink) }}>
      <svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none"
           aria-hidden="true" dangerouslySetInnerHTML={{ __html: COVERS[id].svg() }} />
    </span>
  );
}

export default function CoverPicker({ cover, ink, onPick, onUpload, onClose }) {
  const current = inkByName(ink) || null;
  return (
    <div className="lic-scrim" role="dialog" aria-label="Your cover"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lic-sheet">
        <button type="button" className="lic-x" onClick={onClose} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
        <h3>Your cover</h3>
        <div className="lic-cgrid">
          {[...COVER_IDS, "image"].map((id) => (
            <button key={id} type="button"
                    className={`lic-copt${cover === id ? " is-on" : ""}`}
                    aria-pressed={cover === id}
                    /* NAMED EXPLICITLY. Each thumbnail is a real drawn cover,
                       and Runway has "26" painted on it while Chart carries
                       eight waypoint names — all of it inside an aria-hidden
                       <svg>, but a button whose name depends on that being
                       honoured is a button one browser reads as
                       "N29°30'E047°UL602…". */
                    aria-label={coverName(id)}
                    onClick={() => (id === "image" ? onUpload() : onPick({ cover: id }))}>
              <Thumb id={id} ink={current} />
              <span>{coverName(id)}</span>
            </button>
          ))}
        </div>

        <div className="lic-pal" role="group" aria-label="Cover colour">
          {PALETTE.map((p) => (
            <button key={p.n} type="button"
                    className={`lic-cc is-inline${current?.n === p.n ? " is-on" : ""}`}
                    style={{ background: col(p) }}
                    aria-pressed={current?.n === p.n}
                    title={p.n} aria-label={p.n}
                    onClick={() => onPick({ cover_ink: p.n })} />
          ))}
        </div>
      </div>
    </div>
  );
}
