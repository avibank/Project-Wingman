/* =============================================================================
   PLATFORM IS NOT A BREAKPOINT.
   -----------------------------------------------------------------------------
   COMPONENTS.md v5 puts this first and it is the reason so many web readers
   feel wrong on an iPad: a 1024px window on a Mac wants hover affordances and
   32px targets, and a 1024px iPad wants neither. Width alone cannot tell them
   apart, so the question asked is what the POINTER can do.

     const coarse = matchMedia('(pointer:coarse)').matches
                 || !matchMedia('(hover:hover)').matches;
     plat = w < 680 ? 'phone' : (coarse || w < 1100) ? 'tablet' : 'desktop';

   That is the shipped formula, verbatim. Everything downstream is CSS: the
   whole of the platform layer hangs off `data-plat` on the root, and there is
   no JS branching for layout beyond setting this attribute.

   The reference build specifies this and does not implement it — nothing in it
   ever writes `data-plat`, so its own phone and tablet layers are dead code
   there. They are not here.
   ========================================================================= */

export const PLATFORMS = ["desktop", "tablet", "phone"];

export function platformFor(width, { coarse = false } = {}) {
  if (width < 680) return "phone";
  if (coarse || width < 1100) return "tablet";
  return "desktop";
}

/* Read the capability rather than guessing it. Guarded because a media query
   is not available while server-rendering, and because a browser that cannot
   answer should get the desktop answer rather than an exception. */
export function readPlatform() {
  if (typeof window === "undefined") return "desktop";
  let coarse = false;
  try {
    coarse = window.matchMedia("(pointer:coarse)").matches
      || !window.matchMedia("(hover:hover)").matches;
  } catch { /* older engine — width alone, below */ }
  return platformFor(window.innerWidth, { coarse });
}

/* Both signals change: a window resizes, and a hybrid laptop switches between
   trackpad and touchscreen mid-session. Watching only `resize` leaves a Surface
   in the desktop layout with a finger on the screen. */
export function watchPlatform(onChange) {
  if (typeof window === "undefined") return () => {};
  let last = readPlatform();
  onChange(last);
  const tell = () => {
    const now = readPlatform();
    if (now !== last) { last = now; onChange(now); }
  };
  const queries = [];
  try {
    for (const q of ["(pointer:coarse)", "(hover:hover)"]) {
      const m = window.matchMedia(q);
      m.addEventListener("change", tell);
      queries.push(m);
    }
  } catch { /* nothing to watch but the width */ }
  window.addEventListener("resize", tell);
  return () => {
    window.removeEventListener("resize", tell);
    for (const m of queries) m.removeEventListener("change", tell);
  };
}
