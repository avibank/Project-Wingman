/* =============================================================================
   A SIGN-OFF IS A MOMENT AND AN ANGLE.
   -----------------------------------------------------------------------------
   §3 of the launch handoff: "Tapping the stamp signs off with a press
   animation; tapping again voids it. Store a random rotation (±6°) per
   sign-off."

   RANDOM ONCE AND STORED, not derived. The angle could be computed from the
   account's seed and the lesson id — stable, varied, no schema — and that is
   what `stampTilt` does for the places with no record to hang it on (a chapter
   wall). But a stored angle is the one that is TRUE: it was chosen the moment
   the stamp went down, the way a hand chooses one, and it stays that way even
   if the seed is ever regenerated or the lesson is renumbered.

   ITS OWN KEY, BESIDE pw-lesson-done RATHER THAN INSIDE IT. That map is read
   as booleans in a dozen places — `moduleState.done[id]`, the chapter state,
   the deck's counts — and widening a boolean into an object is how each of
   those quietly starts reading `{}` as true. So the flag stays a flag and the
   angle lives here.

   Voiding forgets the angle, deliberately: §3 says tapping again voids it, and
   a sign-off applied again is a NEW one. The same stamp pressed twice does not
   land at the same angle.
   ========================================================================= */

export const SIGNOFF_KEY = "pw-signoff";

/** ±6°, to one decimal — the range §3 asks for. */
export const rollTilt = () => Math.round((Math.random() * 12 - 6) * 10) / 10;

/** The angle a lesson was signed off at, or null if it has not been. */
export function tiltOf(book, lessonId) {
  const at = book?.[lessonId];
  return typeof at?.rot === "number" ? at.rot : null;
}

/** When it was signed off, as an ISO string, or null. */
export function signedAt(book, lessonId) {
  return book?.[lessonId]?.at || null;
}

/** The book with this lesson signed off now, at a fresh angle. */
export function sign(book, lessonId) {
  return { ...(book || {}), [lessonId]: { rot: rollTilt(), at: new Date().toISOString() } };
}

/** The book with this lesson's sign-off taken off it. */
export function unsign(book, lessonId) {
  const { [lessonId]: _gone, ...rest } = book || {};
  return rest;
}
