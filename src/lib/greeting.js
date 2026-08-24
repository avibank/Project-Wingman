// §10 — the one line under "Flight Deck".
//
// Shuffle-bag, never random: random clumps, and the same line twice in three
// views reads as a bug. Deal from a shuffled bag, reshuffle only when it
// empties, and on reshuffle swap the first card if it matches the previous
// bag's last.
//
// Kept pure: `pickGreeting` takes the whole world as arguments and returns the
// next state, so the dwell, the band punch-through and the adjacency rules are
// all checkable without a clock or a browser.

export const DWELL_MS = 2 * 60 * 1000;        // home → chapter → home is navigation, not an arrival
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

// TODO(step-4): these are the lines carried by the reference rig. When
// wingman-voices.md lands this pool is replaced wholesale and the character
// becomes a user setting; the machinery below does not change. `kind` is what
// the adjacency rule reads ("tool" and "name" lines never repeat back to
// back) and `when` is the arrival/continuation split.
export const VOICES = {
  wingman: [
    [ // 04–07
      { text: "Show-off", kind: "plain", when: "any" },
      { text: "There you are", kind: "plain", when: "arrival" },
      { text: "Early starts suit you", kind: "plain", when: "any" },
      { text: "Sun's not up. You are", kind: "plain", when: "any" },
    ],
    [ // 07–12
      { text: "Ready before I am", kind: "plain", when: "arrival" },
      { text: "You again. Good", kind: "plain", when: "arrival" },
      { text: "Ready when you are", kind: "plain", when: "any" },
      { text: "Let's make a dent", kind: "plain", when: "any" },
    ],
    [ // 12–17
      { text: "You don't stop, do you?", kind: "plain", when: "any" },
      { text: "Nice having you around", kind: "plain", when: "any" },
      { text: "Got another in you?", kind: "plain", when: "continuation" },
      { text: "Halfway. Second wind?", kind: "plain", when: "continuation" },
    ],
    [ // 17–19
      { text: "You could've gone home", kind: "plain", when: "continuation" },
      { text: "Glad it's you tonight", kind: "plain", when: "any" },
      { text: "Everyone's clocking off. We're clocking on", kind: "plain", when: "any" },
    ],
    [ // 19–24
      { text: "Best hours are yours", kind: "plain", when: "any" },
      { text: "Still going?", kind: "plain", when: "continuation" },
      { text: "You're good company", kind: "plain", when: "any" },
      { text: "Everyone's gone. We're not", kind: "plain", when: "any" },
      { text: "Late shifts suit you", kind: "plain", when: "any" },
    ],
    [ // 00–04
      { text: "Don't know anyone else who'd be here", kind: "plain", when: "any" },
      { text: "Small hours suit you", kind: "plain", when: "any" },
      { text: "I'll stay up", kind: "plain", when: "any" },
      { text: "Coffee? I'll hold your place", kind: "plain", when: "arrival" },
    ],
  ],
};

// Away 8h+ is an arrival; under 2h is a continuation; in between, either.
export function moodFor(awayMs) {
  if (awayMs == null) return "arrival";
  if (awayMs >= ARRIVAL_AWAY_MS) return "arrival";
  if (awayMs < CONTINUATION_AWAY_MS) return "continuation";
  return "any";
}

// Lines carrying {name} are excluded when no name is set — never substitute a
// fallback.
export function eligible(pool, { name, mood }) {
  return pool
    .map((line, i) => ({ ...line, i }))
    .filter((l) => (name ? true : !l.text.includes("{name}")))
    .filter((l) => l.when === "any" || mood === "any" || l.when === mood);
}

function shuffle(ids, rand) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EMPTY = { band: null, bag: [], prevLast: null, lastKind: null, shownAt: 0, shownText: null };

/**
 * @param state  the persisted bag state (or null on a cold start)
 * @param ctx    { now, hour, name, awayMs, character, rand }
 * @returns      { text, state }
 */
export function pickGreeting(state, ctx) {
  const s = { ...EMPTY, ...(state || {}) };
  const { now = Date.now(), hour = 12, name = null, awayMs = null, character = "wingman" } = ctx || {};
  const rand = ctx?.rand || Math.random;

  const band = bandFor(hour);
  const pool = (VOICES[character] || VOICES.wingman)[band] || [];
  if (!pool.length) return { text: "", state: s };

  // Two-minute dwell — but a band change punches straight through it.
  if (s.shownText && s.band === band && now - s.shownAt < DWELL_MS) {
    return { text: s.shownText, state: s };
  }

  const ok = eligible(pool, { name, mood: moodFor(awayMs) });
  const usable = ok.length ? ok : eligible(pool, { name, mood: "any" });
  if (!usable.length) return { text: "", state: s };
  const usableIds = usable.map((l) => l.i);

  let bag = s.band === band ? (s.bag || []).filter((i) => usableIds.includes(i)) : [];
  let prevLast = s.band === band ? s.prevLast : null;

  if (!bag.length) {
    bag = shuffle(usableIds, rand);
    // On reshuffle, swap the first card if it matches the previous bag's last.
    if (bag.length > 1 && prevLast != null && bag[0] === prevLast) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }

  // Adjacency: never two tool lines back to back, never two {name} lines back
  // to back. Push the offender one place down rather than dropping it.
  let pick = 0;
  if (s.lastKind && s.lastKind !== "plain" && bag.length > 1) {
    while (pick < bag.length - 1 && pool[bag[pick]].kind === s.lastKind) pick++;
  }
  const id = bag[pick];
  bag.splice(pick, 1);

  const line = pool[id];
  const text = name ? line.text.replace(/\{name\}/g, name) : line.text;

  return {
    text,
    state: { band, bag, prevLast: bag.length ? prevLast : id, lastKind: line.kind, shownAt: now, shownText: text },
  };
}
