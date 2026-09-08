import { ICONS, TOOLS } from "../../lib/readerIcons.js";

/* =============================================================================
   THE READER'S ICONS.

   Every glyph in this screen comes from lib/readerIcons.js, which is the
   shipped file copied byte for byte — the paths, the tool table and the five
   colours. Not an icon library: the marking tools are drawn as tilted physical
   objects, a nib and a chisel and a marker barrel, and that is what makes the
   dock read as a pen tray rather than a settings menu. A generic set loses
   exactly that.

   One 20px grid, 1.5px stroke, round caps and joins, rendered at 19px unless
   asked otherwise — the wrapper the file's own header specifies.
   ========================================================================= */
export default function Icon({ name, tool, size = 19, className }) {
  const d = tool
    ? TOOLS.find((t) => t.id === tool)?.svg
    : ICONS[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
