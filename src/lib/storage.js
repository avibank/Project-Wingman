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
  return parseInt(localStorage.getItem(key) || String(fallback), 10);
}

export { loadJSON, saveJSON, getNum };
