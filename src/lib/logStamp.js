/* ============================================================================
   THE TWO STAMPS A LOGBOOK ROW CARRIES.
   ----------------------------------------------------------------------------
   Ported from docs/launch/reference/01-module-lesson-crew.html — `noteStamp`
   and `askStamp`, path for path. These are NOT the licence stamp: that one is
   the student's own mark, six shapes and thirty-six inks, and it belongs to
   them (src/lib/stamp.js). These two are furniture. A note stamp is a rubber
   date-stamp with the moment in it, a question stamp is a diamond with a
   question mark, and neither is chosen by anybody.

   THREE ADAPTATIONS, and they are the same three the licence stamp took:

   · The ink filter is the ACCOUNT'S, keyed on its seed, so a logbook and a
     sign-off on the same page are pressed with the same pen. The demo had one
     hard-coded `#ink`.
   · No font-family attribute. The face is reached through --font-mono in the
     stylesheet, never named here (CLAUDE.md, Design system).
   · No colour in the markup. `currentColor` throughout, and the kind decides
     it in CSS — which is what lets one rule re-tint the lot when the livery
     changes, and what keeps --copilot the one owner of teal.
   ========================================================================= */
import { inkFilterId, stampTilt } from './stamp.js';

export const LOG_STAMP_W = 86;
export const LOG_STAMP_H = 46;

/* The demo rolls ±2.5° per row. Derived rather than stored, and that is not
   the same call as a sign-off's: a sign-off's angle records an act somebody
   performed, a row's is decoration. What it must not do is change on a
   re-render, which is why it is a function of the row's id and not of the
   clock. */
export const logTilt = (seed, id) =>
  Math.round(stampTilt(seed, id) * (2.5 / 6) * 10) / 10;

const two = n => String(n).padStart(2, '0');
/* m:ss for a row under a minute stays m:ss; the demo prints mm:ss. */
export const stampClock = s =>
  `${two(Math.floor(Math.max(0, s) / 60))}:${two(Math.floor(Math.max(0, s) % 60))}`;

const safe = s => String(s || '').replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase();

export function noteStamp(seconds, code, seed = 1) {
  const f = inkFilterId(seed);
  return `<svg width="${LOG_STAMP_W}" height="${LOG_STAMP_H}" viewBox="0 0 86 46" aria-hidden="true" focusable="false">
  <g filter="url(#${f})" fill="none" stroke="currentColor">
   <rect x="2" y="2" width="82" height="42" rx="3" stroke-width="1.8"/>
   <rect x="5.5" y="5.5" width="75" height="35" rx="1.5" stroke-width=".8"/>
   <line x1="5.5" y1="15" x2="80.5" y2="15" stroke-width=".8"/>
   <g fill="currentColor" stroke="none" text-anchor="middle">
    <text x="43" y="12.6" font-size="7.5" font-weight="600" letter-spacing=".8">${safe(code)}</text>
    <text x="43" y="34" font-size="15" font-weight="600" letter-spacing=".5">${stampClock(seconds)}</text>
   </g></g></svg>`;
}

export function askStamp(seconds, seed = 1) {
  const f = inkFilterId(seed);
  return `<svg width="${LOG_STAMP_W}" height="${LOG_STAMP_H}" viewBox="0 0 86 46" aria-hidden="true" focusable="false">
  <g filter="url(#${f})" fill="none" stroke="currentColor">
   <path d="M23 2 44 23 23 44 2 23Z" stroke-width="1.8"/>
   <path d="M23 7 39 23 23 39 7 23Z" stroke-width=".8"/>
   <g fill="currentColor" stroke="none">
    <text x="23" y="28" font-size="14" font-weight="600" text-anchor="middle">?</text>
    <text x="48" y="20" font-size="7.5" font-weight="600" letter-spacing=".8">ASK</text>
    <text x="48" y="32" font-size="11.5" font-weight="600">${stampClock(seconds)}</text>
   </g></g></svg>`;
}

/* The one door, so no call site assembles markup of its own. `kind` is the
   logbook's kind: a seat entry is somebody else's question and draws the
   question stamp — the colour is what says whose, not the shape. */
export function drawLogStamp(kind, seconds, { code = '', seed = 1 } = {}) {
  return kind === 'note' ? noteStamp(seconds, code, seed) : askStamp(seconds, seed);
}
