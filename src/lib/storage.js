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
