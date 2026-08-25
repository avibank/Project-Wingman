// The one line under "Flight Deck".
//
// §0 says the POC carries the real rotation engine and to port it verbatim, so
// this is wingman-poc.html's engine, structure for structure: a bag per
// voice|band|pool, a shuffle followed by one adjacency pass, and the
// avoid-first swap. The copy still comes from wingman-voices.md via voices.js,
// which §0 says wins on lines.
//
// Kept pure — the whole world arrives as arguments and the next state comes
// back — so the dwell, the band punch-through and the adjacency pass are
// checkable without a clock or a browser.

import { VOICES, DEFAULT_CHARACTER, HAS_POOLS } from "./voices.js";

export const DWELL_MS = 2 * 60 * 1000;
export const ARRIVAL_AWAY_MS = 8 * 60 * 60 * 1000;
export const CONTINUATION_AWAY_MS = 2 * 60 * 60 * 1000;

// Device-local and gapless: 4-7, 7-12, 12-17, 17-19, 19-24, 0-4.
export const BANDS = [[4, 7], [7, 12], [12, 17], [17, 19], [19, 24], [0, 4]];

export function bandFor(hour) {
  if (hour >= 4 && hour < 7) return 0;
  if (hour >= 7 && hour < 12) return 1;
  if (hour >= 12 && hour < 17) return 2;
  if (hour >= 17 && hour < 19) return 3;
  if (hour >= 19) return 4;
  return 5;
}

// away > 8h → arrival, < 2h → continuation, otherwise either.
export function moodFor(awayMs) {
  if (awayMs == null) return "arrival";
  if (awayMs > ARRIVAL_AWAY_MS) return "arrival";
  if (awayMs < CONTINUATION_AWAY_MS) return "continuation";
  return "any";
}

// A line carrying {name} is out of the pool when there is no name. Never
// substitute a fallback word.
export function eligible(pool, { name, mood, usePools }) {
  return pool
    .map((line, i) => ({ ...line, i }))
    .filter((l) => (name ? true : l.tag !== "name"))
    .filter((l) => !usePools || mood === "any" || l.pool === "any" || l.pool === mood);
}

// The POC's shuffle: Fisher-Yates, then ONE pass swapping an adjacent
// same-flag pair with the card two places on, then the avoid-first swap.
function shuffle(order, pool, avoidFirst, rand) {
  const a = order.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 1; i < a.length; i++) {
    const f1 = pool[a[i - 1]].tag, f2 = pool[a[i]].tag;
    if (f1 && f1 === f2) {
      const k = (i + 2) % a.length;
      [a[i], a[k]] = [a[k], a[i]];
    }
  }
  if (a[0] === avoidFirst && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

const EMPTY = { bags: {}, last: null, band: null, character: null, line: null, dealt: 0 };

// One bag per voice|band|pool, exactly as the POC keys them.
function deal(state, character, band, mood, name, rand) {
  const pool = VOICES[character][band] || [];
  const usePools = HAS_POOLS[character] !== false;
  let idx = eligible(pool, { name, mood, usePools }).map((l) => l.i);
  if (!idx.length) idx = eligible(pool, { name, mood: "any", usePools }).map((l) => l.i);
  if (!idx.length) return { text: "", state };

  const key = `${character}|${band}|${usePools ? mood : "any"}`;
  let bag = state.bags[key];
  if (!bag || !bag.o.length || bag.i >= bag.o.length || bag.o.length !== idx.length) {
    const avoid = state.last && state.last.key === key ? state.last.i : -1;
    bag = { o: shuffle(idx, pool, avoid, rand), i: 0 };
  }
  const pick = bag.o[bag.i++];
  const line = pool[pick];
  return {
    text: name ? line.text.replace(/\{name\}/g, name) : line.text,
    state: { ...state, bags: { ...state.bags, [key]: bag }, last: { key, i: pick } },
  };
}

/**
 * @param state  persisted bag state, or null on a cold start
 * @param ctx    { now, hour, name, awayMs, character, rand, force }
 */
export function pickGreeting(state, ctx) {
  const s = { ...EMPTY, ...(state || {}) };
  const { now = Date.now(), hour = 12, name = null, awayMs = null, force = false } = ctx || {};
  const character = VOICES[ctx?.character] ? ctx.character : DEFAULT_CHARACTER;
  const rand = ctx?.rand || Math.random;
  const band = bandFor(hour);

  // Two-minute dwell. A band change or a change of voice punches through it —
  // the app visibly noticing midnight passed is the best moment the system has.
  const fresh = force || s.band !== band || !s.line || s.character !== character
    || now - (s.dealt || 0) > DWELL_MS;
  if (!fresh) return { text: s.line, state: s };

  const r = deal(s, character, band, moodFor(awayMs), name, rand);
  if (!r.text) return { text: s.line || "", state: s };
  return { text: r.text, state: { ...r.state, band, character, line: r.text, dealt: now } };
}
