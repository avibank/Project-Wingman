/* =============================================================================
   BEFORE ANYTHING ELSE LOADS, IN THE DEMO: localStorage BECOMES A COPY.
   -----------------------------------------------------------------------------
   main.jsx imports this first, so it runs before any module reads storage.
   The app writes a great deal to localStorage as it is used (an exam
   attempt, retention, the last place, the flags), and in the demo every one of
   those writes would land in the student's real browser and follow them out.
   So the demo gets a copy of what is there now, in memory. It reads the same
   answers the real one would at the start (their theme, their device
   settings), and anything written is gone when the demo ends.

   Outside the demo this file does nothing at all.
   ========================================================================= */
import { demoMode } from "./mode.js";

if (demoMode) {
  const copy = new Map();
  try {
    const real = window.localStorage;
    for (let i = 0; i < real.length; i++) {
      const k = real.key(i);
      if (k != null) copy.set(k, real.getItem(k));
    }
  } catch { /* storage refused: start from nothing */ }
  const memory = {
    getItem: (k) => (copy.has(String(k)) ? copy.get(String(k)) : null),
    setItem: (k, v) => { copy.set(String(k), String(v)); },
    removeItem: (k) => { copy.delete(String(k)); },
    clear: () => { copy.clear(); },
    key: (i) => [...copy.keys()][i] ?? null,
    get length() { return copy.size; },
  };
  try { Object.defineProperty(window, "localStorage", { configurable: true, get: () => memory }); } catch { /* left as it is */ }
}
