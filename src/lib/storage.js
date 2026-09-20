/* =============================================================================
   THE STORAGE EPOCH — one sweep, once, when the demo material came out.
   -----------------------------------------------------------------------------
   The database wipe (supabase/wipe-demo-content.sql) clears what a student did;
   it cannot reach what their BROWSER kept. Signed-in progress is read from the
   server, so a reload covers most of it — but a tester's device still holds
   `pw-hobbs`, `pw-last-place`, `pw-quiz-scores`, `pw-completed` and thirty more
   keys from a course that no longer exists. The Flight Deck would greet them
   with "Last flown today" and a hero card pointing at a quiz that is gone, and
   the wipe would look as though it had failed.

   `pw-flags` IS THE ONE THAT MATTERS MOST. flags.js says so in its own words:
   an admin browser sitting on a stale override is how "I still cannot tap
   modules" happened, and there was no way to find out why from inside the app.
   A stale `content.test: true` would now put the placeholder course back in
   front of exactly the person most likely to be showing it to somebody.

   AN ALLOWLIST, NOT A WIPE LIST, and that is the whole design. Anything not
   named below goes. A key added next month is swept by default rather than
   surviving because nobody remembered to add it — which is the failure mode of
   every list of things to delete.

   WHAT IS KEPT is what `user_prefs` is kept for on the server side: nobody's
   settings are demo data. The livery, the lighting, the finish, the type size,
   the greeter, Your bar — and Fly solo, which is a safety decision and is kept
   for the same reason the wipe keeps blocks and mutes.

   BUMP IT ONCE AND IT IS A NO-OP FOREVER. The epoch is written after the sweep,
   so the second load does nothing. Raising the number is how a future wipe
   reaches devices again.
   ========================================================================= */
/* Imported rather than written out. `check:solo` refuses the string
   "pw-invisible" anywhere but the switch and the four faces that draw it — a
   guard worth keeping, so this takes the constant from the one file that owns
   it. flySolo.js imports nothing, so there is no cycle. */
import { FLY_SOLO_KEY } from "./flySolo.js";

export const STORAGE_EPOCH = 1;
const EPOCH_KEY = "pw-epoch";

/* Device preferences. Everything else under `pw-` is state. */
const KEEP = new Set([
  "pw-livery", "pw-finish", "pw-variant-pin", "pw-grain", "pw-ruled",
  "pw-font-size", "pw-dyslexia-font", "pw-reduce-motion", "pw-turbulence",
  "pw-volume", "pw-voice", "pw-greeting", "pw-greet-name",
  "pw-social-preset", "pw-minimums",
  /* Fly solo. A safety decision, not a setting, and never swept: the wipe
     keeps `blocks` and `mutes` on exactly this reasoning. */
  FLY_SOLO_KEY,
  "pw-notices", "pw-dial", "pw-paper-dial", "pw-rdr6-look",
  EPOCH_KEY,
]);

/* `pw-flags` is deliberately NOT in KEEP — see the header. */

/** Runs once per device per epoch, before anything else reads storage. */
export function sweepStorage() {
  try {
    if (typeof localStorage === "undefined") return { swept: 0, ran: false };
    const seen = parseInt(localStorage.getItem(EPOCH_KEY), 10);
    if (Number.isFinite(seen) && seen >= STORAGE_EPOCH) return { swept: 0, ran: false };

    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      /* `pw-reader-bar-<id>` and any other keyed family: the prefix decides. */
      if (k && k.startsWith("pw-") && !KEEP.has(k)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
    localStorage.setItem(EPOCH_KEY, String(STORAGE_EPOCH));
    return { swept: doomed.length, ran: true, keys: doomed };
  } catch {
    /* Storage blocked — a private window, an embedded webview, a browser set
       to refuse site data. There is nothing to sweep there either. */
    return { swept: 0, ran: false };
  }
}

// Small localStorage helpers (safe if run outside a browser)
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
function getNum(key, fallback = 0) {
  // The header above promises these are safe outside a browser, and this one
  // was not: a bare localStorage read throws where storage is blocked (private
  // windows, embedded webviews, a browser set to refuse site data) and took the
  // caller down with it. parseInt also returns NaN on a corrupt value, which
  // then spreads silently through whatever arithmetic it feeds.
  try {
    const n = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export { loadJSON, saveJSON, getNum };
