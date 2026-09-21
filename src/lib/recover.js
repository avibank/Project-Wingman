/* =============================================================================
   WHEN A DOWNLOAD FAILS, THE APP MENDS ITSELF.
   -----------------------------------------------------------------------------
   The owner opened the live site on a phone (2026-09-21) and got the Flight
   Deck with no stylesheet: every button in Safari's own grey, nothing laid
   out, and "The first chapter goes in here." because the course document had
   not arrived either. The same build rendered perfectly for a fresh visitor in
   Chromium and WebKit, at both widths, on both addresses — so what failed was
   the downloads on that visit (a flaky connection, or a deploy landing
   mid-load). The screens' own code already recovers — `chunk()` in App.jsx
   reloads once when a lazy screen fails — but two downloads had nothing:

   1. THE STYLESHEET. Module scripts run only once the head's stylesheets have
      settled, so when this file runs a failed one is already failed — and it
      is NOT a null `sheet`: Chromium and WebKit both hand back a sheet whose
      rules cannot be read (measured). The owner's screen was half styled
      rather than bare because a few components carry inline styles. Our own
      sheet with no readable rules is a failed one. It is fetched again,
      twice, with a query that gets past any cache, and the page reloads once
      if that fails too.
   2. THE COURSE DOCUMENT, which `loadTestContent` (moduleContent.js) now
      retries, and answers with `reloadOnce` when its retries run out. It
      used to keep the failed promise for the rest of the visit.

   ONE RELOAD, NEVER A LOOP. A reload is remembered for 30 seconds in this
   tab; inside that window nothing here reloads again, and the page is left
   as it is rather than cycling. `tests/recover-run.mjs` fails each download
   on purpose against the production harness and checks the page mends. */

const KEY = "pw-recovered-at";
const WINDOW_MS = 30000;

const recentlyReloaded = () => {
  try { return Date.now() - Number(window.sessionStorage.getItem(KEY) || 0) < WINDOW_MS; } catch { return true; }
};

/* Reload the page, unless this tab already did in the last 30 seconds.
   True when a reload is on its way. */
export function reloadOnce() {
  if (recentlyReloaded()) return false;
  try { window.sessionStorage.setItem(KEY, String(Date.now())); } catch { return false; }
  window.location.reload();
  return true;
}

function refetch(link, attempt) {
  const fresh = link.cloneNode();
  const url = new URL(link.href, window.location.href);
  url.searchParams.set("r", `${Date.now()}`);
  fresh.href = url.href;
  fresh.addEventListener("load", () => link.remove());
  fresh.addEventListener("error", () => {
    fresh.remove();
    if (attempt < 2) setTimeout(() => refetch(link, attempt + 1), 1200 * (attempt + 1));
    else reloadOnce();
  });
  link.after(fresh);
}

/* Our own stylesheet, failed. A failed one is not a null `sheet`: both
   engines hand back a sheet whose rules throw SecurityError, as though it
   were another site's (measured, Chromium and WebKit). Another origin's
   sheet throws the same way when it is fine, so only our own is judged. */
const failed = (link) => {
  let ours = false;
  try { ours = new URL(link.href, window.location.href).origin === window.location.origin; } catch { return false; }
  if (!ours) return false;
  if (!link.sheet) return true;
  try { return link.sheet.cssRules.length === 0; } catch { return true; }
};

export function mendStylesheets() {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    if (failed(link)) refetch(link, 0);
  }
}

export function installRecovery() {
  if (typeof window === "undefined") return;
  mendStylesheets();
}
