/* =============================================================================
   A STAMP ON SCREEN. One component, everywhere it appears.
   -----------------------------------------------------------------------------
   The drawing is src/lib/stamp-engine.js, the reference's engine byte for
   byte, reached through drawStamp in src/lib/stamp.js. This puts it on the
   page and caches it.

   · THE FILTERS ARE SHARED BY THE ENGINE ITSELF. inkFilter(seed) puts one
     <filter> per seed into the page's one <svg><defs> (stamp-engine.js makes
     it, first in <body>) the first time that seed is drawn, and every later
     stamp of that seed refers to it. §8's "share the filter defs" is the
     engine's own behaviour, so the registry this file used to keep is gone.
   · THE SVG IS CACHED. Building one is ~150 lines of string work. The cache is
     keyed on everything that changes the drawing, so a wall of stamps builds
     each distinct one once and a re-render builds none.

   dangerouslySetInnerHTML is deliberate and it is safe HERE specifically: the
   string is assembled by the engine from a fixed vocabulary of paths, and the
   only student-supplied parts — the code and the rim text — go through
   cleanCode/cleanRim/escapeText on the way in. drawStamp is the only door.
   ========================================================================= */
import { drawStamp, HOUSE_STAMP } from "../lib/stamp.js";

/* ---------------------------------------------------------------- the cache */
const CACHE = new Map();
const MAX = 400;                       // a Crew wall is ~100; this is room to spare
const name = (v) => (v && typeof v === "object" ? v.n : v) || "";
const keyOf = (st, on, size, rot) =>
  `${st.shape}|${st.code}|${st.sym || ""}|${st.rim === false ? 0 : 1}|${st.ring || ""}|${st.pattern || ""}|${st.pscope || ""}|${name(st.ink)}|${name(st.pink)}|${name(st.cink)}|${st.seed}|${on ? 1 : 0}|${size}|${rot}`;
function svgFor(st, on, size, rot) {
  const k = keyOf(st, on, size, rot);
  const had = CACHE.get(k);
  if (had) return had;
  const svg = drawStamp(st, { on, size, rot });
  if (CACHE.size >= MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, svg);
  return svg;
}

/**
 * @param {object}  stamp   the student's stamp, or nothing for the house seal
 * @param {number}  size    drawn size in px
 * @param {number}  rot     the per-sign-off rotation, ±6°
 * @param {boolean} on      false draws it faint, for a slot that has none yet
 * @param {string}  label   what a screen reader says; omit for decoration
 */
export default function Stamp({ stamp, size = 40, rot = 0, on = true, label, className = "" }) {
  const st = stamp || HOUSE_STAMP;
  const svg = svgFor(st, on, size, rot);

  return (
    /* `insp-stamp`, not `stamp`: lesson.css already owns a bare `.stamp` — the
       sign-off BUTTON — with a cursor, an opacity and a transition on it, and
       a drawn stamp on that page would have inherited all three. */
    <span className={`insp-stamp ${className}`} style={{ display: "inline-block", lineHeight: 0 }}
          role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}
          dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
