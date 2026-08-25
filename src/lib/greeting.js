// The one line under "Flight Deck". Rotation spec from
// docs/reference/wingman-voices.md; the copy itself lives in voices.js.
//
// DO NOT re-port this from wingman-poc.html. It was ported verbatim once,
// under §0's "the code wins", and measurably failed an invariant the .md
// states absolutely — "never two tool lines back to back, never two {name}
// lines back to back". Over 153,600 draws the POC's engine produced 119
// adjacent same-tag pairs; this one produces zero. §0's rule settles design
// disagreements, not a reference implementing its own spec incorrectly. The
// .md's adjacency rule is the spec; the POC's version of it is a bug, and
// this reversal was agreed explicitly.
//
// The two things the POC's single pass cannot do, and why they matter:
//   - a clash on the last two cards of a bag has nothing ahead of it to swap
//     with, so a forward-only pass leaves it there
//   - it never looks across the seam from one bag to the next
// Both are handled here by scoring the whole bag, seam included, and only
// accepting swaps that strictly reduce the clash count — which is also why
// it terminates.
//
// Shuffle-bag, never random: random clumps, and the same line twice in three
// views reads as a bug. Kept pure — `pickGreeting` takes the whole world as
// arguments and returns the next state, so the dwell, the band punch-through
// and the adjacency pass are all checkable without a clock or a browser.

import { VOICES, DEFAULT_CHARACTER, HAS_POOLS } from "./voices.js";

export const DWELL_MS = 2 * 60 * 1000;
export const ARRIVAL_AWAY_MS = 8 * 60 * 60 * 1000;
export const CONTINUATION_AWAY_MS = 2 * 60 * 60 * 1000;

// Device-local, no gaps.
export const BANDS = [[4, 7], [7, 12], [12, 17], [17, 19], [19, 24], [0, 4]];

export function bandFor(hour) {
  for (let i = 0; i < BANDS.length; i++) {
    const [a, z] = BANDS[i];
    if (a < z ? hour >= a && hour < z : hour >= a || hour < z) return i;
  }
  return 0;
}

// Away 8h+ is an arrival; under 2h is a continuation; in between, either.
export function moodFor(awayMs) {
  if (awayMs == null) return "arrival";
  if (awayMs >= ARRIVAL_AWAY_MS) return "arrival";
  if (awayMs < CONTINUATION_AWAY_MS) return "continuation";
  return "any";
}

// A line carrying {name} is excluded when the user hasn't set one. Never
// substitute a fallback word.
export function eligible(pool, { name, mood, usePools }) {
  return pool
    .map((line, i) => ({ ...line, i }))
    .filter((l) => (name ? true : !l.text.includes("{name}")))
    .filter((l) => !usePools || mood === "any" || l.pool === "any" || l.pool === mood);
}

function shuffle(ids, rand) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Never two tool lines back to back, never two {name} lines back to back.
//
// The spec calls this "one pass: swap any adjacent pair sharing a tag", and a
// single forward pass is what it sounds like — but a clash sitting on the last
// two cards has nothing ahead of it to swap with, so it survives and shows up
// at the seam. This repairs by swapping with the best partner anywhere in the
// bag, and only accepts a swap that strictly reduces the clash count, so it
// always terminates.
function clashes(bag, pool, seamTag, prevLast) {
  let n = 0;
  if (seamTag && bag.length && pool[bag[0]].tag === seamTag) n++;
  // "On reshuffle, if the new first card is the old last card, swap it with
  // the second." Folded into the same objective so the repair cannot undo it.
  if (prevLast != null && bag.length && bag[0] === prevLast) n++;
  for (let i = 0; i + 1 < bag.length; i++) {
    const a = pool[bag[i]].tag;
    if (a && a === pool[bag[i + 1]].tag) n++;
  }
  return n;
}

function deClump(bag, pool, seamTag = null, prevLast = null) {
  let best = clashes(bag, pool, seamTag, prevLast);
  for (let guard = 0; best > 0 && guard < bag.length; guard++) {
    let improved = false;
    outer: for (let i = 0; i < bag.length && !improved; i++) {
      for (let j = i + 1; j < bag.length; j++) {
        [bag[i], bag[j]] = [bag[j], bag[i]];
        const now = clashes(bag, pool, seamTag, prevLast);
        if (now < best) { best = now; improved = true; break outer; }
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    if (!improved) break;   // nothing left that a swap can fix
  }
  return bag;
}

const EMPTY = { band: null, character: null, bag: [], prevLast: null, lastTag: null, shownAt: 0, shownText: null };

/**
 * @param state  the persisted bag state (or null on a cold start)
 * @param ctx    { now, hour, name, awayMs, character, rand }
 * @returns      { text, state }
 */
export function pickGreeting(state, ctx) {
  const s = { ...EMPTY, ...(state || {}) };
  const { now = Date.now(), hour = 12, name = null, awayMs = null } = ctx || {};
  const character = VOICES[ctx?.character] ? ctx.character : DEFAULT_CHARACTER;
  const rand = ctx?.rand || Math.random;

  const band = bandFor(hour);
  const pool = VOICES[character][band] || [];
  if (!pool.length) return { text: "", state: s };

  // Two-minute dwell — but a band change punches straight through it, and so
  // does swapping the character, which is a deliberate act with a live preview.
  const sameContext = s.band === band && s.character === character;
  if (s.shownText && sameContext && now - s.shownAt < DWELL_MS) {
    return { text: s.shownText, state: s };
  }

  const usePools = HAS_POOLS[character] !== false;
  const mood = moodFor(awayMs);
  const ok = eligible(pool, { name, mood, usePools });
  // "In between, or that pool's bag is empty → any pool."
  const usable = ok.length ? ok : eligible(pool, { name, mood: "any", usePools });
  if (!usable.length) return { text: "", state: s };
  const usableIds = usable.map((l) => l.i);

  let bag = sameContext ? (s.bag || []).filter((i) => usableIds.includes(i)) : [];
  const prevLast = sameContext ? s.prevLast : null;

  if (!bag.length) {
    // The seam between bags counts too: the last card dealt must not be the
    // first card of the new bag, and must not share its tag.
    bag = deClump(shuffle(usableIds, rand), pool, s.lastTag, prevLast);
  }

  const id = bag.shift();
  const line = pool[id];
  const text = name ? line.text.replace(/\{name\}/g, name) : line.text;

  return {
    text,
    state: { band, character, bag, prevLast: bag.length ? prevLast : id, lastTag: line.tag, shownAt: now, shownText: text },
  };
}
