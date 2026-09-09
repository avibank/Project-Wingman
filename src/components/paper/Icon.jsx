/* =============================================================================
   One place that turns a name into an SVG, and the only one.
   -----------------------------------------------------------------------------
   v5 changed what an icon IS. In v4 every glyph was a stroked path on a 20px
   grid and the tool's colour lived in a separate `.swatch` element beside it.
   In v5 THE ICON IS THE SWATCH: `icon(id, colour)` returns a filled drawing in
   the tool's own colour, which is why the bar reads as a tray of pens rather
   than a row of settings. There is no swatch element any more, and adding one
   back would be reinstating v4's look inside v5's markup.

   So a tool glyph comes from readerIcons.js's `icon()` — the reference build's
   function, verbatim — and a chrome glyph from readerChrome.js. Nothing here
   draws anything itself.
   ========================================================================= */
import { icon } from "../../lib/readerIcons.js";
import { chrome, LOGO } from "../../lib/readerChrome.js";

export default function Icon({ tool, name, colour, size, className }) {
  const svg = tool ? icon(tool, colour, size || 21)
    : name === "logo" ? LOGO
      : chrome(name, size || 17);
  if (!svg) return null;
  return (
    <span className={className} aria-hidden="true" style={{ display: "contents" }}
          dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
