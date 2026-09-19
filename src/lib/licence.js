/* =============================================================================
   THE LICENCE CARD'S DATA — §5.
   -----------------------------------------------------------------------------
   Three stats, one read of somebody else's card, and the writes the owner
   makes. Every rule about what a number MEANS is here; how it is spelled is
   the card's business and how it is stored is 0030's.

   THE STATS ARE A PROJECTION AND THAT IS STATED IN 0030. The truth is the
   account's own progress, which is private and has exactly one reader; the
   three numbers on pilot_profiles are the copy other people are allowed to
   see, written by their owner, the way callsign and real_name already are.
   `syncStats` is the one writer.
   ========================================================================= */
import { supabase } from './supabaseClient.js';
import { HOBBS_KEY, DAYS_KEY, daysFlown } from './hobbs.js';
import { PHRASES, COVER_IDS, DEFAULT_COVER } from './cover.js';
import { inkByName } from './stamp.js';
import { BIO_MAX, totalSeconds, signedOff } from './licenceCard.js';

/* --------------------------------------------------------------- the reads */

/* Somebody else's card, or your own. Returns null when there is nothing to
   show — a pilot flying solo, or a block either way — and the screen says so
   rather than drawing a blank card. 0030's function holds that rule; this
   only carries the answer. */
export async function fetchCard(viewer, userId) {
  if (!viewer || !userId) return null;
  const { data, error } = await supabase.rpc('licence_card', { p_viewer: viewer, p_user: userId });
  if (error) { console.error(error); return null; }
  return (data || [])[0] || null;
}

/* -------------------------------------------------------------- the writes */

/* Clamped here as well as in the CHECK: a value the server refuses is a save
   that fails for a reason nobody can see. */
const clampNum = (v, fallback, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

const clean = (v, max) => {
  const t = String(v ?? '').replace(/[\n\r]+/g, ' ').trim().slice(0, max);
  return t || null;
};

/* One patch, one round trip, and every value checked here as well as in the
   CHECK constraints — a value the server would refuse is better refused
   before it leaves, so the student sees why rather than seeing a failure. */
export async function saveCard(userId, patch) {
  if (!userId) return { ok: false };
  const row = {};
  if ('bio' in patch) row.bio = clean(patch.bio, BIO_MAX);
  if ('phrase' in patch) row.phrase = PHRASES.includes(patch.phrase) ? patch.phrase : null;
  if ('cover' in patch) {
    row.cover = COVER_IDS.includes(patch.cover) || patch.cover === 'image'
      ? patch.cover : DEFAULT_COVER;
  }
  if ('cover_ink' in patch) row.cover_ink = inkByName(patch.cover_ink)?.n || null;
  if ('cover_image' in patch) row.cover_image = patch.cover_image || null;
  /* The face. null is a real value here — it is what "use your initials"
     writes, and the only reason that choice can be made at all now. */
  if ('photo_url' in patch) row.photo_url = patch.photo_url || null;
  if ('photo_zoom' in patch) row.photo_zoom = clampNum(patch.photo_zoom, 100, 100, 400);
  if ('photo_x' in patch) row.photo_x = clampNum(patch.photo_x, 0, -100, 100);
  if ('photo_y' in patch) row.photo_y = clampNum(patch.photo_y, 0, -100, 100);
  if (!Object.keys(row).length) return { ok: true };
  const { error } = await supabase.from('pilot_profiles')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' });
  if (error) { console.error(error); return { ok: false, error }; }
  return { ok: true };
}

/* THE PROJECTION'S ONE WRITER. Called when the licence is opened, which is
   the only moment the numbers are about to be looked at and therefore the
   only moment it is worth a round trip. It writes nothing when nothing has
   changed, so opening the tab twice costs one request and not two. */
export async function syncStats(userId, { hobbs, done, days }, was = null) {
  if (!userId) return was;
  const next = {
    hours_s: Math.floor(totalSeconds(hobbs)),
    lessons_signed: signedOff(done),
    days_flown: daysFlown(days),
  };
  if (was && was.hours_s === next.hours_s && was.lessons_signed === next.lessons_signed
      && was.days_flown === next.days_flown) return was;
  const { error } = await supabase.from('pilot_profiles')
    .upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
  if (error) { console.error(error); return was; }
  return next;
}

/* Re-exported so a screen imports one module, not two, and the split stays an
   implementation detail of where a check can reach. */
export { BIO_MAX, totalSeconds, hoursLabel, signedOff, statsFrom, statsOf } from './licenceCard.js';
export { HOBBS_KEY, DAYS_KEY };
