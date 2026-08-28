// §3.4 — the six liveries. One source of truth, matching
// scripts/build-tokens.mjs; a livery that exists in one and not the other
// resolves to no tokens at all, which is what happened when v2 replaced Sunset
// Approach with Altimeter and the picker was not updated.

export const LIVERIES = [
  { id: "contrail",     name: "Contrail",     hue: 240, chromaMult: 0.15, presence: 70,
    mood: "Near-colourless. Presence is the only warmth you ever see." },
  { id: "night-ops",    name: "Night Ops",    hue: 225, chromaMult: 1.0,  presence: 60,
    mood: "Cool steel. The widest gap between the room and the people in it." },
  { id: "carrier-deck", name: "Carrier Deck", hue: 255, chromaMult: 0.9,  presence: 40,
    mood: "Slate, warming to bronze." },
  { id: "altimeter",    name: "Altimeter",    hue: 260, chromaMult: 0.4,  presence: 65,
    mood: "Graphite and lamp-glow." },
  { id: "aurora",       name: "Aurora",       hue: 300, chromaMult: 0.9,  presence: 20,
    mood: "Violet, warming to rose." },
  { id: "dawn-patrol",  name: "Dawn Patrol",  hue: 60,  chromaMult: 0.9,  presence: 45,
    mood: "Already warm. Presence deepens it. First light." },
];

export const DEFAULT_LIVERY = "dawn-patrol";

const BY_ID = Object.fromEntries(LIVERIES.map((l) => [l.id, l]));

// A stored id that no longer exists must resolve to one that does, because
// liveryById feeds the tail ring and an unknown id would draw nothing.
//
// This used to guard the DOM as well: the token block was once selected by
// [data-livery="…"], so an unknown value painted nothing at all. That is no
// longer how the app is coloured — deckVars() writes the tokens onto :root at
// runtime — and data-livery now means the APP's livery, which App.jsx owns.
// These are two different sets of ids that ended up sharing a word.
export function resolveLivery(id) {
  return BY_ID[id] ? id : DEFAULT_LIVERY;
}
export const liveryById = (id) => BY_ID[resolveLivery(id)];

// §2.11 — two at signup, then one per completed module in a fixed global order.
export const UNLOCK_ORDER = ["contrail", "carrier-deck", "altimeter", "aurora"];
export function unlockedLiveries(modulesCompleted = 0) {
  return new Set([DEFAULT_LIVERY, "night-ops", ...UNLOCK_ORDER.slice(0, modulesCompleted)]);
}

// §3.4 — a livery colours your tail ring, and under monochrome the only hue a
// person carries is their presence temperature.
export const tailHue = (id) => liveryById(id).presence;

// The ramp steps a swatch shows: dark to light, so two monochromes are actually
// distinguishable. A single dot cannot do this honestly.
export const SWATCH_STEPS = ["1000", "900", "700", "500", "300", "100", "50"];
