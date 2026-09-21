/* =============================================================================
   THE STAMP, AS THE APP USES IT.
   -----------------------------------------------------------------------------
   The drawing is src/lib/stamp-engine.js, which is the reference's own
   engine byte for byte (docs/launch/code/05-stamp-engine.js). Nothing in this
   file draws. It is what the app needs around the engine, and each piece says
   why it exists:

     · the lists the creator offers, in the reference's order;
     · the door every component draws through (drawStamp), which cleans what a
       student typed and turns stored ink NAMES into the palette objects the
       engine takes;
     · the stored stamp — a profile row's columns — as the engine's shape;
     · the angle a sign-off sits at.
   ========================================================================= */
import {
  MOTTO, DEFAULT_STAMP, PALETTE, col, SHAPES, MARKS, PATTERNS, FONTS,
  inkFilter, ringPattern, inspStamp, colourGrid,
} from './stamp-engine.js';

export {
  MOTTO, DEFAULT_STAMP, PALETTE, col, SHAPES, MARKS, PATTERNS, FONTS,
  inkFilter, ringPattern, inspStamp, colourGrid,
};

/* SIX SHAPES OFFERED, AND THE SIX PATTERNS, in the engine's own order.
   The engine draws eight; the owner took the shield and the hex out of the
   creator twice (2026-09-21: "kill bolt and shield", then "no hex bolt no
   shield" — the hex reads as a bolt head). So they are left out HERE, the
   app's list, and not cut from the engine, which stays the reference byte
   for byte and would still draw either if a stamp ever carried one. 0037
   holds the database to the same six. */
export const RETIRED_SHAPES = ['shield', 'hex'];
export const SHAPE_IDS = Object.keys(SHAPES).filter((k) => !RETIRED_SHAPES.includes(k));
export const PATTERN_IDS = Object.keys(PATTERNS);
export const SCOPE_IDS = ['both', 'centre', 'rim'];

/* THE FILTER'S ID, for the drawings that are not stamps but wear a stamp's ink
   (the logbook's row stamps, logStamp.js). In a page, asking for it makes
   sure the filter is there — that is the engine's inkFilter. Outside one (a
   check running in Node) it is only the name. */
export const inkFilterId = (seed) => (typeof document !== 'undefined' ? inkFilter(seed) : `ink2_${seed}`);

export const escapeText = (v) => String(v ?? '').replace(/[<>&"']/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
export const cleanCode = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
export const cleanRim = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9 .'-]/g, '').slice(0, 10).trim();
export const inkByName = (n) => PALETTE.find((p) => p.n === n) || null;
const inkName = (v) => (v && typeof v === 'object' ? v.n : v) || null;

export function validStamp(st) {
  if (!st || typeof st !== 'object') return false;
  if (!SHAPE_IDS.includes(st.shape)) return false;
  if (!PATTERN_IDS.includes(st.pattern ?? 'none')) return false;
  if (!SCOPE_IDS.includes(st.pscope ?? 'both')) return false;
  if (cleanCode(st.code).length < 1) return false;
  for (const k of ['ink', 'pink', 'cink']) {
    if (st[k] != null && !inkByName(inkName(st[k]))) return false;
  }
  if (!Number.isInteger(st.seed) || st.seed < 1) return false;
  return true;
}

/* =============================================================================
   THE DOOR. Everything in the app draws a stamp through this.
   -----------------------------------------------------------------------------
   The engine takes its three inks as palette OBJECTS, and a string ink is
   passed straight into CSS (inkVal). A stamp is stored with ink NAMES
   ("Ruby"), because what a name looks like is a CSS decision and a stored
   oklch is a colour nobody can re-tune. So this resolves all three names,
   cleans the code and the rim text, and is what every component calls.
   Nothing a student typed reaches the markup without passing through
   cleanCode/cleanRim first.
   ========================================================================= */
export function drawStamp(st, { on = true, size = 40, rot = 0 } = {}) {
  const s = st || DEFAULT_STAMP;
  const ink = (v) => (typeof v === 'string' ? inkByName(v) : v);
  return inspStamp(on, size, rot, {
    ...s,
    code: cleanCode(s.code),
    ring: escapeText(cleanRim(s.ring)),
    ink: ink(s.ink),
    pink: ink(s.pink) || null,
    cink: ink(s.cink) || null,
  });
}

/* THE GENERIC SEAL, until a student issues one of their own. §4: "until a
   student issues their own, sign-offs use the generic seal (tick, livery
   ink)." A null ink is the livery — inkVal answers var(--accent) for it. */
export const HOUSE_STAMP = { shape: 'seal', code: '', sym: 'tick', ring: '', pattern: 'none', ink: null, seed: 1 };

/* =============================================================================
   THE STORED STAMP.
   -----------------------------------------------------------------------------
   Eleven columns on pilot_profiles (0029, and 0036 for where the pattern goes
   and its two extra inks), so every CHECK there mirrors the lists above and
   nothing unrenderable can be stored. This is the one place that shape
   becomes the one the engine takes.
   ========================================================================= */

/** The stamp a profile row carries, or null while the pilot has not issued one. */
export function stampOf(row) {
  if (!row || !row.stamp_issued_at || !row.stamp_shape) return null;
  return {
    shape: row.stamp_shape,
    code: row.stamp_code || '',
    rim: row.stamp_rim !== false,
    ring: row.stamp_ring || '',
    pattern: row.stamp_pattern || 'none',
    pscope: row.stamp_pscope || 'both',
    ink: row.stamp_ink || null,
    pink: row.stamp_pink || null,
    cink: row.stamp_cink || null,
    seed: row.stamp_seed || 1,
    issuedAt: row.stamp_issued_at,
    /* The account's own resting angle, for the places a stamp is shown as
       ITSELF rather than as a sign-off — the licence, a profile. A sign-off
       gets its own; see stampTilt. */
    tilt: ((row.stamp_seed || 1) * 37 % 121) / 10 - 6,
  };
}

/* THE ANGLE A PARTICULAR SIGN-OFF SITS AT. §3: "Store a random rotation (±6°)
   per sign-off." Random once and stored is the shape that brief asks for, and
   src/lib/signoff.js stores it under pw-signoff. This is the FALLBACK, for
   every lesson signed off before that key did, and for the logbook's row
   stamps, whose angle is decoration rather than a record: every stamp at a
   slightly different angle, and the same one every time you come back. */
export function stampTilt(seed, key) {
  let h = (seed || 1) >>> 0;
  for (const ch of String(key || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round(((h % 121) / 10 - 6) * 10) / 10;
}

/* The palette entry for a colour grid's `sel`, which compares by name. */
export const inkOf = (v) => (typeof v === 'string' ? inkByName(v) : v) || null;
export { inkName };
