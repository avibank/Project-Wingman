/* =============================================================================
   ONE FACE, AND IT IS THIS APP'S.
   -----------------------------------------------------------------------------
   THE BUG THIS FILE EXISTS FOR. The licence card, the app bar and the lesson
   composer each read Clerk's `user.imageUrl`:

       const photo = !flySolo && user?.imageUrl ? user.imageUrl : null;

   `user.imageUrl` is NEVER null. With no photo set, Clerk serves a generated
   default from img.clerk.com — a grey glyph with the initials baked into it —
   so the falsy branch was unreachable, this app's own initials never rendered,
   and the colour somebody picked on their licence had nothing to paint. "Use
   your initials" called `setProfileImage({ file: null })`, which throws.

   So Clerk is the sign-in provider and nothing else. A face is:

     photo      pilot_profiles.photo_url, in this project's own storage, with
                the zoom and offset the student chose (0033). Null means they
                did not pick one, which is a state that can now be reached.
     initials   up to two letters, on the ink they picked for their cover —
                which is what the reference does: one colour, chosen once,
                worn by the cover and the circle together (07-card-and-avatar).

   THE CLERK GUARD IS NOT PARANOIA. If a clerk.com URL ever reaches the column
   the bug is back, silently, wearing this app's clothes. 0033 refuses it at
   the database and this refuses it at the render, because the two failures
   look identical from the screen and only one of them is fixable from here.
   ========================================================================= */
import { PALETTE, col, inkByName } from './stamp.js';

/* The HOST, not the string: `clerk.com` anywhere in a path would match a
   perfectly ordinary filename, and `img.clerk.com` is only one of the
   subdomains Clerk serves generated avatars from. */
export const CLERK_IMAGE = /^https?:\/\/([a-z0-9-]+\.)*clerk\.com(\/|$)/i;
export const isClerkImage = (url) => CLERK_IMAGE.test(String(url || '').trim());

/* Up to two letters, from whatever name there is. Never a question mark and
   never a single "?" glyph: an account with no name at all is new, not
   broken, and a blank circle in their colour says that better. */
export const initialsOf = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/* The ink a face is drawn on. The reference uses the cover's colour for the
   initials — one pick, two surfaces — so this reads cover_ink and falls back
   to the palette's second entry, which is what the reference falls back to. */
export const faceInk = (row) => inkByName(row?.cover_ink) || PALETTE[1];
export const faceFill = (row) => col(faceInk(row));

/* Dark on a light ink, white on a dark one, and MEASURED rather than
   thresholded — the reference switches at l > .7, which puts white on Khaki
   at 2.67:1. Same two colours, and this picks whichever actually has more
   contrast on that ink. See docs/launch/BUGS.md 13. */
const M3 = [[4.0767416621, -3.3077115913, .2309699292],
            [-1.2684380046, 2.6097574011, -.3413193965],
            [-.0041960863, -.7034186147, 1.7076147010]];
const lum = (L, C, H) => {
  const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const v = [(L + .3963377774 * a + .2158037573 * b) ** 3,
             (L - .1055613458 * a - .0638541728 * b) ** 3,
             (L - .0894841775 * a - 1.2914855480 * b) ** 3];
  const [r, g, bl] = M3.map((row) => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2])));
  return .2126 * r + .7152 * g + .0722 * bl;
};
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const DARK = { s: 'oklch(.2 .02 265)', L: .2, C: .02, H: 265 };
const LIGHT = { s: 'oklch(1 0 0)', L: 1, C: 0, H: 0 };
export function faceInkText(row) {
  const c = faceInk(row);
  const bg = lum(c.l ?? .6, c.c ?? 0, c.h ?? 0);
  return ratio(lum(DARK.L, DARK.C, DARK.H), bg) >= ratio(lum(LIGHT.L, LIGHT.C, LIGHT.H), bg)
    ? DARK.s : LIGHT.s;
}

/* The reference's own limits, so the preview and the stored value agree:
   the pan is a percentage of the frame and the slack is (zoom - 1) * 50. */
export const PHOTO_ZOOM_MIN = 100;
export const PHOTO_ZOOM_MAX = 300;
export const panLimit = (zoomPct) => Math.max(0, ((zoomPct / 100) - 1) * 50);
export const clampPan = (v, zoomPct) => {
  const lim = panLimit(zoomPct);
  return Math.round(Math.max(-lim, Math.min(lim, Number(v) || 0)));
};

/* THE ONE DOOR. Everything that draws a face reads this, so no screen has its
   own idea of what somebody looks like — which is how the app bar and the
   licence disagreed for months. */
export function faceOf(row, { name } = {}) {
  const url = row?.photo_url;
  const photo = url && !isClerkImage(url) ? url : null;
  return {
    photo,
    zoom: photo ? Math.max(PHOTO_ZOOM_MIN, Math.min(PHOTO_ZOOM_MAX, row?.photo_zoom ?? 100)) : 100,
    x: photo ? clampPan(row?.photo_x, row?.photo_zoom ?? 100) : 0,
    y: photo ? clampPan(row?.photo_y, row?.photo_zoom ?? 100) : 0,
    initials: initialsOf(name ?? row?.real_name ?? row?.callsign),
    fill: faceFill(row),
    ink: faceInkText(row),
  };
}

export const AVATAR_BUCKET = 'avatars';
