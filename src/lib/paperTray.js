/* =============================================================================
   THE BAR — six tools the student chose, not thirteen we shipped.
   -----------------------------------------------------------------------------
   v5 answers "thirteen tools, six slots" twice over, and the second answer is
   the one that makes it work: every tool carries its own VARIANTS. One bar
   entry covers Line / Arrow / Box / Ellipse, so a student sees six things and
   the seventh is one tap inside the tool they already picked — which is where
   they would look for it anyway. The bar does not need to grow.

   ONE TRAY PER PLATFORM. A laptop and an iPad want different tools: the pen
   matters on one and barely exists on the other, and on a phone the bar is a
   bottom dock with room for five. Syncing one tray across all three would mean
   every change on one device undoing a choice on another, so the key carries
   the platform and they never meet.

   THE SHIPPED TABLE IS THE SOURCE. readerIcons.js carries the tool ids, the
   default tray, the cap and the group names, copied out of the reference build
   byte for byte. Re-declaring any of them here would be a second opinion that
   drifts.
   ========================================================================= */
import { TOOLS, DEF, CAP } from "./readerIcons.js";

export { DEF, CAP };
/* Select is the way back out of every other tool, and the table says so with
   `lock:1` rather than a second list here. */
export const LOCKED = TOOLS.filter((t) => t.lock).map((t) => t.id);

/* v5's cap is one number, because the bar no longer has to hold everything —
   the variants do. The phone dock is the exception: it is edge to edge with no
   scroll, so it holds what fits a thumb. */
export const capFor = (plat) => (plat === "phone" ? 5 : CAP);
export const trayKey = (plat) => `pw-reader-bar-${plat}`;

export function loadTray(plat, all = TOOLS) {
  try {
    const raw = localStorage.getItem(trayKey(plat));
    const held = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(held) || !held.length) return [...DEF];
    /* Anything this build no longer has is dropped rather than left as a hole,
       and a locked tool is put back if it somehow went missing. */
    const clean = held.filter((id) => all.some((t) => t.id === id));
    for (const id of LOCKED) if (!clean.includes(id)) clean.unshift(id);
    return clean.slice(0, capFor(plat));
  } catch { return [...DEF]; }
}

export function saveTray(plat, tray) {
  try { localStorage.setItem(trayKey(plat), JSON.stringify(tray)); } catch { /* private */ }
}

/* Adding keeps the bar in the tool table's own order, so a student who adds
   Underline finds it beside Highlight rather than at the end. */
export function addTool(tray, id, cap, all = TOOLS) {
  if (tray.includes(id)) return { tray, note: null };
  if (tray.length >= cap) return { tray, note: `Your bar holds ${cap}. Take one off first.` };
  const next = [...tray, id].sort(
    (a, b) => all.findIndex((t) => t.id === a) - all.findIndex((t) => t.id === b),
  );
  return { tray: next, note: null };
}

export function removeTool(tray, id) {
  if (LOCKED.includes(id)) return tray;
  return tray.filter((t) => t !== id);
}

export function moveTool(tray, id, before) {
  const from = tray.indexOf(id);
  const to = tray.indexOf(before);
  if (from < 0 || to < 0 || from === to) return tray;
  const next = [...tray];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/* A shortcut fires only for a tool that is ON the bar. A key that silently
   switches to something the student removed is the bar not meaning anything. */
export const shortcutFor = (tray, key, all = TOOLS) => {
  const hit = all.find((t) => t.k.toLowerCase() === String(key).toLowerCase());
  return hit && tray.includes(hit.id) ? hit.id : null;
};
