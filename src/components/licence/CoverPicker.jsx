/* =============================================================================
   THE COVER PICKER — pickCover() from docs/launch/code/08-photo-and-cover-
   pickers.js, markup for markup.
   -----------------------------------------------------------------------------
   Five drawn covers and Your image in the reference's `.cgrid`, then its
   `colourGrid()` under a "Colour" label: `.pal`, and every swatch is a circle
   WITH ITS NAME UNDER IT. That is the part that was missing. Thirty-six bare
   dots with the name only in a `title` is a colour you can point at and never
   say — and the same thirty-six names are the stamp's inks and the initials
   circle's fill, so a pilot who cannot read one here cannot match it there.

   THE INKS ARE THE STAMP'S INKS, not a second palette. One PALETTE in
   src/lib/stamp.js, thirty-six entries, named.
   ========================================================================= */
import { COVERS, COVER_IDS, coverGradient, coverName } from "../../lib/cover.js";
import { PALETTE, col, inkByName } from "../../lib/stamp.js";
import Sheet from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />
  </svg>
);

/* `thumb` in the reference: the chosen ink's gradient with the set drawn over
   it, so the grid previews the colour you already picked rather than six
   pictures of somebody else's card. */
function Thumb({ id, ink, image }) {
  if (id === "image") {
    return (
      <span className="cthumb up"
            style={image ? { backgroundImage: `url("${image}")`, backgroundSize: "cover" } : undefined}>
        {image ? null : <UploadIcon />}
      </span>
    );
  }
  return (
    <span className="cthumb" style={{ background: coverGradient(ink) }}>
      <svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none"
           aria-hidden="true" dangerouslySetInnerHTML={{ __html: COVERS[id].svg() }} />
    </span>
  );
}

export default function CoverPicker({ cover, ink, image, onPick, onUpload, onClose }) {
  const current = inkByName(ink) || null;
  return (
    <Sheet label="Cover" onClose={onClose}>
      <h3>Cover</h3>
      <div className="cgrid">
        {[...COVER_IDS, "image"].map((id) => (
          <button key={id} type="button"
                  className={`copt${cover === id ? " on" : ""}`}
                  aria-pressed={cover === id}
                  /* NAMED EXPLICITLY. Each thumbnail is a real drawn cover, and
                     Runway has "26" painted on it while Chart carries eight
                     waypoint names — all inside an aria-hidden <svg>, but a
                     button whose name depends on that being honoured is one
                     some browser reads as "N29°30'E047°UL602…". */
                  aria-label={coverName(id)}
                  onClick={() => (id === "image" ? onUpload() : onPick({ cover: id }))}>
            <Thumb id={id} ink={current} image={id === "image" ? image : null} />
            <span>{coverName(id)}</span>
          </button>
        ))}
      </div>

      <p className="lab" style={{ margin: "18px 0 8px" }}>Colour</p>
      <div className="pal" role="group" aria-label="Cover colour">
        {PALETTE.map((p) => (
          <button key={p.n} type="button"
                  className={current?.n === p.n ? "on" : undefined}
                  aria-pressed={current?.n === p.n} aria-label={p.n}
                  onClick={() => onPick({ cover_ink: p.n })}>
            <i style={{ background: col(p) }} />
            <span>{p.n}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
