/* =============================================================================
   THE LICENCE CARD'S RULES — §5, and nothing that touches the network.
   -----------------------------------------------------------------------------
   Split from licence.js deliberately: that file imports supabaseClient, which
   reads import.meta.env and therefore cannot be loaded by a check running in
   node. Every rule about what a number MEANS is here, where it can be tested
   without a database; the round trips are next door.
   ========================================================================= */
import { daysFlown } from './hobbs.js';

export const BIO_MAX = 80;

/* ------------------------------------------------------------ the numbers */

/* Every module's meter, added up. The Flight Deck's hour meter reads ONE
   module (hobbs.js); the licence reads the lot, because it is a licence. */
export const totalSeconds = (hobbs) =>
  Object.values(hobbs || {}).reduce((a, b) => a + (Number(b) || 0), 0);

/* "13h 54m", and under an hour "54m" — an hour meter that reads "0h 54m" on
   somebody's first week is an hour meter telling them they have done nothing.
   Never "0m" either: a card with no time on it yet says "—", because a zero
   is a count and this app does not print those (CLAUDE.md, Voice). */
export function hoursLabel(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* pw-lesson-done is a map of lesson id to a boolean, and it is written by two
   things — the 90% rule and the sign-off button. Both mean the same thing
   here: a lesson you finished. */
export const signedOff = (done) =>
  Object.values(done || {}).filter(Boolean).length;

/* The three, in §5's order, ready for the card. An em dash where there is
   nothing yet rather than a nought. */
export function statsFrom({ hobbs, done, days }) {
  const n = (v) => (v > 0 ? String(v) : '—');
  return [
    { label: 'Hours flown', value: hoursLabel(totalSeconds(hobbs)) },
    { label: 'Lessons signed off', value: n(signedOff(done)) },
    { label: 'Days flown', value: n(daysFlown(days)) },
  ];
}

/* The same three off a profile row, for somebody else's card. Same labels,
   same order, same em dash — one shape, two sources. */
export const statsOf = (row) => ([
  { label: 'Hours flown', value: hoursLabel(row?.hours_s) },
  { label: 'Lessons signed off', value: (row?.lessons_signed > 0 ? String(row.lessons_signed) : '—') },
  { label: 'Days flown', value: (row?.days_flown > 0 ? String(row.days_flown) : '—') },
]);
