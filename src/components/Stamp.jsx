/* =============================================================================
   A STAMP ON SCREEN. One component, everywhere it appears.
   -----------------------------------------------------------------------------
   The drawing is in src/lib/stamp.js, ported from the reference. This is what
   puts it on the page, and it has two jobs the drawing cannot do:

   · THE FILTERS ARE SHARED. Every stamp is drawn through an ink filter keyed
     on its seed, and §8 asks for exactly this: "Crew walls with 100+ stamps
     stay smooth. Cache the rendered SVG per user stamp and share the filter
     defs." <StampDefs> collects the seeds on screen and renders one filter
     each; a hundred stamps from one account share one filter.
   · THE SVG IS CACHED. Building one is ~150 lines of string work. The cache is
     keyed on everything that changes the drawing, so a wall of stamps builds
     each distinct one once and a re-render builds none.

   dangerouslySetInnerHTML is deliberate and it is safe HERE specifically: the
   string is assembled in stamp.js from a fixed vocabulary of paths, and the
   only student-supplied parts — the code and the rim text — go through
   cleanCode/cleanRim/escapeText on the way in. drawStamp is the only door.
   ========================================================================= */
import { useEffect, useState } from "react";
import { drawStamp, inkFilterMarkup, HOUSE_STAMP } from "../lib/stamp.js";

/* ---------------------------------------------------------------- the cache */
const CACHE = new Map();
const MAX = 400;                       // a Crew wall is ~100; this is room to spare
const keyOf = (st, on, size, rot) =>
  `${st.shape}|${st.code}|${st.sym || ""}|${st.ring || ""}|${st.pattern || ""}|${st.ink || ""}|${st.seed}|${on ? 1 : 0}|${size}|${rot}`;
function svgFor(st, on, size, rot) {
  const k = keyOf(st, on, size, rot);
  const had = CACHE.get(k);
  if (had) return had;
  const svg = drawStamp(st, { on, size, rot });
  if (CACHE.size >= MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, svg);
  return svg;
}

/* ------------------------------------------------------------- the filters
   A MODULE-LEVEL REGISTRY, NOT A PROVIDER. Every stamp on screen needs its
   seed's filter in the document, and the obvious shape — a context provider
   wrapping the app — means the one component that must appear on every screen
   has to wrap the whole tree. The saves store solved the same problem the same
   way: a small store, a subscription, and one component that renders what it
   holds, mounted wherever is convenient. <StampFilters/> sits next to the
   toast host. */
const seeds = new Set();
const listeners = new Set();

/* THE SEED IS REGISTERED DURING RENDER, NOT IN THE EFFECT, and that is what
   makes the sharing real. It used to be added in an effect, so `seeds.has()`
   below was false for EVERY stamp in the first commit — a hundred and twenty
   of them each emitted its own <filter> and never re-rendered to drop it.
   Measured on a 120-person Crew wall: 132 filter definitions for 12 distinct
   seeds, which is §8's requirement ("share the filter defs") inverted.

   Adding to a module-level Set during render is idempotent and touches no
   React state, so a double render in StrictMode changes nothing. The
   NOTIFICATION stays in the effect, because that one does set state. */
function claimSeed(seed) {
  if (seeds.has(seed)) return true;
  seeds.add(seed);
  return false;                     // first one in: it draws its own for now
}
export function useSeed(seed) {
  useEffect(() => { listeners.forEach((f) => f()); }, [seed]);
}
/** One <filter> per seed on screen. A hundred stamps from one account share one. */
export function StampFilters() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => listeners.delete(f);
  }, []);
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false"
         style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs dangerouslySetInnerHTML={{ __html: [...seeds].map(inkFilterMarkup).join("") }} />
    </svg>
  );
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
  const seed = st.seed || 1;
  /* Claimed on the way past, before the markup below asks. */
  const shared = claimSeed(seed);
  useSeed(seed);

  /* THE FIRST STAMP OF A SEED CARRIES ITS OWN FILTER; every later one shares.
     A stamp must never draw unfiltered for a frame — the filter is most of
     what it looks like — and the shared defs only arrive after an effect. So
     exactly one stamp per seed pays for that frame, rather than all of them:
     on a wall of 120 from 12 accounts that is 12 spare definitions instead of
     120. Two <filter> elements with the same id are harmless; the first wins. */
  const own = shared ? "" : `<svg width="0" height="0" style="position:absolute"><defs>${inkFilterMarkup(seed)}</defs></svg>`;
  const svg = svgFor(st, on, size, rot);

  return (
    /* `insp-stamp`, not `stamp`: lesson.css already owns a bare `.stamp` — the
       sign-off BUTTON — with a cursor, an opacity and a transition on it, and
       a drawn stamp on that page would have inherited all three. */
    <span className={`insp-stamp ${className}`} style={{ display: "inline-block", lineHeight: 0 }}
          role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}
          dangerouslySetInnerHTML={{ __html: own + svg }} />
  );
}
