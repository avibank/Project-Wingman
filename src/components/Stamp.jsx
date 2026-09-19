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
import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
   A set of seeds, gathered from whatever is on screen. Rendering a stamp adds
   its seed; the provider draws one <filter> per seed into a single hidden svg.
   Without a provider a stamp still draws — it carries its own filter — which
   is what keeps <Stamp> usable in a screenshot test or a story. */
const SeedCtx = createContext(null);

export function StampDefs({ children }) {
  const [seeds, setSeeds] = useState(() => new Set());
  const api = useMemo(() => ({
    seeds,
    add: (s) => setSeeds((was) => (was.has(s) ? was : new Set(was).add(s))),
  }), [seeds]);
  return (
    <SeedCtx.Provider value={api}>
      {children}
      <svg width="0" height="0" aria-hidden="true" focusable="false"
           style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs dangerouslySetInnerHTML={{ __html: [...seeds].map(inkFilterMarkup).join("") }} />
      </svg>
    </SeedCtx.Provider>
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
  const ctx = useContext(SeedCtx);
  const seed = st.seed || 1;
  useEffect(() => { ctx?.add(seed); }, [ctx, seed]);

  /* Its own filter until the provider has caught up — a stamp must never draw
     unfiltered for a frame, because the filter is most of what it looks like. */
  const own = ctx?.seeds.has(seed) ? "" : `<svg width="0" height="0" style="position:absolute"><defs>${inkFilterMarkup(seed)}</defs></svg>`;
  const svg = svgFor(st, on, size, rot);

  return (
    <span className={`stamp ${className}`} style={{ display: "inline-block", lineHeight: 0 }}
          role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}
          dangerouslySetInnerHTML={{ __html: own + svg }} />
  );
}
