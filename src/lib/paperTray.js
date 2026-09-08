/* =============================================================================
   THE TRAY — a dock the student builds, not a toolbar we ship.
   -----------------------------------------------------------------------------
   This is the fix for "busy". Fourteen tools in a rail is a rail nobody reads;
   six that somebody chose is a rail they know by shape. Everything else stays
   one tap away in the Add sheet, so nothing is unreachable — the rule that
   makes trimming safe.

   TWO TRAYS, REMEMBERED PER DEVICE. A laptop and a tablet want different tools:
   the pen matters on one and barely exists on the other. Syncing one tray
   across both would mean every change on one device undoes a choice on the
   other, so the key carries the device class and the two never meet.
   ========================================================================= */

export const DEFAULT_TRAY = ["select", "highlight", "pen", "eraser", "note", "question"];
/* Select is the way back out of every other tool. Removing it would leave a
   student holding a highlighter with no way to stop marking. */
export const LOCKED = ["select"];

export const GROUPS = [
  { id: 0, name: "Select" },
  { id: 1, name: "Mark up" },
  { id: 2, name: "Ink" },
  { id: 3, name: "Draw" },
  { id: 4, name: "Sign off" },
  { id: 5, name: "Talk" },
];

/* A cap per device, because a tray longer than the screen is a scrolling
   toolbar, which is the thing being replaced. Adding past it SAYS SO rather
   than silently growing or silently refusing. */
export function capFor(width) {
  if (width < 768) return 5;
  if (width < 1200) return 8;
  return 10;
}
export const deviceClass = (width) => (width < 768 ? "phone" : width < 1200 ? "tablet" : "desktop");
export const trayKey = (width) => `pw-paper-tray-${deviceClass(width)}`;

export function loadTray(width, all) {
  try {
    const raw = localStorage.getItem(trayKey(width));
    const held = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(held) || !held.length) return [...DEFAULT_TRAY];
    /* Anything the build no longer has is dropped rather than left as a hole,
       and Select is put back if it somehow went missing. */
    const clean = held.filter((id) => all.some((t) => t.id === id));
    for (const id of LOCKED) if (!clean.includes(id)) clean.unshift(id);
    return clean.slice(0, capFor(width));
  } catch { return [...DEFAULT_TRAY]; }
}

export function saveTray(width, tray) {
  try { localStorage.setItem(trayKey(width), JSON.stringify(tray)); } catch { /* private */ }
}

/* Adding keeps the tray in the tool set's own order, so a student who adds
   Underline finds it beside Highlight rather than at the end. */
export function addTool(tray, id, all, cap) {
  if (tray.includes(id)) return { tray, note: null };
  if (tray.length >= cap) {
    return { tray, note: `Your tray holds ${cap}. Take one off first.` };
  }
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

/* §6 — a shortcut only fires for a tool that is ON the tray. A key that
   silently switches to a tool the student removed is the tray not meaning
   anything. */
export const shortcutFor = (tray, all, key) => {
  const hit = all.find((t) => t.key.toLowerCase() === String(key).toLowerCase());
  return hit && tray.includes(hit.id) ? hit.id : null;
};
