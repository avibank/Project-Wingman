// §8 — one flag per surface, not one big switch.
//
// Default on for admin, off for everyone else, so the redesign lives in
// production from day one and the gap between review and shipping is never
// more than a deploy.
//
// A flag is deleted within a few weeks of reaching everyone. Put the deletion
// in the same ticket as the rollout, or you accumulate a second codebase by
// stealth.

import { useUser } from "@clerk/clerk-react";
import { loadJSON, saveJSON } from "./storage.js";

export const FLAGS = [
  { id: "home.v2", label: "Flight Deck", note: "The rebuilt home page.", everyone: true },
  { id: "profile.v2", label: "Profile", note: "Licence · Preferences · Appearance." },
  { id: "tokens.global", label: "Wingman colour", note: "The livery and lighting system, site-wide.", everyone: true },
  { id: "social.crew", label: "Formation and wingman", note: "The two crew-strip cells and the My flight preset." },
  { id: "social.frequency", label: "Frequency", note: "The channel preview and the Open frequency preset." },
  { id: "voice.characters", label: "Voices", note: "Choosing who greets you." },
  { id: "livery.aurora", label: "Aurora", note: "The one livery with curtains and a starfield." },
  // The kill pass. Each of these hides an entry point; the route and the code
  // stay put, so any of it is one switch away from coming back.
  { id: "nav.root", label: "Bottom nav", note: "Study · Modules · Logbook · Ready Room.", off: true },
  { id: "chrome.boarding", label: "Boarding pass", note: "The full-screen overlay on load.", off: true },
  { id: "chrome.patoast", label: "PA toast", note: "The cabin-crew announcement on theme change.", off: true },
  { id: "module.interior", label: "Module interior", note: "The hub, chapters, chapter view, quiz and comments.", off: true },
  { id: "social.readyroom", label: "Ready Room", note: "The room itself, and every door into it.", off: true },
  { id: "page.logbook", label: "Logbook", note: "The logbook page.", off: true },
  { id: "page.bookmarks", label: "Saved", note: "Bookmarks and flashcards.", off: true },
  { id: "appearance.grain", label: "Grain switch", note: "The grain control in Appearance. The grain itself stays on.", off: true },
];

const BY_ID = Object.fromEntries(FLAGS.map((f) => [f.id, f]));
const KEY = "pw-flags";

// tokens.global and home.v2 are `everyone` because the surfaces they were
// meant to gate no longer have an "off" to fall back to: §2B ships the colour
// system to every page at once and the layer it replaced is deleted, and the
// v2 home page was replaced rather than kept alongside. They stay in the list
// so the set is complete and so they get deleted with the others. The rest
// have a real off state and are admin-only.
export function flagDefault(id, isAdmin) {
  // `off` is a hidden surface: off for everyone including admin, until it is
  // designed. `everyone` is the opposite — on for all, no off state left.
  if (BY_ID[id]?.off === true) return false;
  return BY_ID[id]?.everyone === true || !!isAdmin;
}

// Overrides are device-local and admin-only: the Features panel is the only
// thing that writes them.
export function readOverrides() {
  const o = loadJSON(KEY, null);
  return o && typeof o === "object" ? o : {};
}
export function writeOverride(id, on) {
  saveJSON(KEY, { ...readOverrides(), [id]: !!on });
}
export function clearOverrides() {
  saveJSON(KEY, {});
}

export function resolveFlags(isAdmin, overrides = {}) {
  const out = {};
  for (const f of FLAGS) {
    out[f.id] = Object.prototype.hasOwnProperty.call(overrides, f.id) && isAdmin
      ? !!overrides[f.id]
      : flagDefault(f.id, isAdmin);
  }
  return out;
}

export function useFlags() {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  return { flags: resolveFlags(isAdmin, readOverrides()), isAdmin };
}
