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
      settled, so when this file runs a failed one is already failed. Failed
      means unreadable, empty, or cut short (see sheetState). The owner's
      screen was half styled rather than bare because a few components carry
      inline styles, and every button fell back to Safari's own because the
      reset lives in this stylesheet. It is fetched again, twice, with a
      query that gets past any cache, and the page reloads once if that
      fails too. Every time this acts it leaves a line in `reports`.
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

/* What state our own stylesheet arrived in: "ok", or why not.

   A FAILED ONE IS NOT A NULL `sheet`: both engines hand back a sheet whose
   rules throw SecurityError, as though it were another site's (measured,
   Chromium and WebKit). Another origin's sheet throws the same way when it
   is fine, so only our own is judged.

   A CUT-SHORT ONE PARSES. Safari on the owner's phone kept serving a copy
   that loaded, had rules, and was missing most of them, while Chrome on the
   same phone had the whole file. So the entry stylesheet ends with a marker
   rule (src/sheet-end.css), and a copy whose last rule is not the marker is
   treated as failed. */
const END = "#pw-sheet-end";
const ENTRY = /\/assets\/index-[^/]*\.css(\?|$)/;
function sheetState(link) {
  let ours = false;
  try { ours = new URL(link.href, window.location.href).origin === window.location.origin; } catch { return "ok"; }
  if (!ours) return "ok";
  if (!link.sheet) return "missing";
  let rules;
  try { rules = link.sheet.cssRules; } catch { return "unreadable"; }
  if (!rules.length) return "empty";
  if (ENTRY.test(link.href) && rules[rules.length - 1].selectorText !== END) return `cut short at ${rules.length} rules`;
  return "ok";
}

/* A line in the reports table whenever this has to act, so a failure on a
   phone nobody here can hold is still seen. Loaded only then. */
function report(detail) {
  import("./squadron.js").then(({ reportContent }) => reportContent({
    reporterId: "anonymous",
    targetType: "route",
    targetId: "stylesheet",
    reason: JSON.stringify({ at: new Date().toISOString(), page: window.location.pathname, ua: navigator.userAgent, ...detail }),
  })).catch(() => { /* nothing more to do from here */ });
}

function refetch(link, attempt, found) {
  const fresh = link.cloneNode();
  const url = new URL(link.href, window.location.href);
  url.searchParams.set("r", `${Date.now()}`);
  fresh.href = url.href;
  const again = (why) => {
    fresh.remove();
    if (attempt < 2) { setTimeout(() => refetch(link, attempt + 1, found), 1200 * (attempt + 1)); return; }
    report({ found, retried: attempt + 1, last: why, reloading: !recentlyReloaded() });
    reloadOnce();
  };
  fresh.addEventListener("load", () => {
    const now = sheetState(fresh);
    if (now !== "ok") { again(now); return; }
    link.remove();
    report({ found, retried: attempt + 1, mended: true });
  });
  fresh.addEventListener("error", () => again("error"));
  link.after(fresh);
}

export function mendStylesheets() {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const found = sheetState(link);
    if (found !== "ok") refetch(link, 0, found);
  }
}

export function installRecovery() {
  if (typeof window === "undefined") return;
  mendStylesheets();
}
