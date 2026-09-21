// §8 — one flag per surface, not one big switch.
//
// §8's default is on for admin and off for everyone else, so a half-built
// redesign never reaches a real user. There are no real users yet — only
// testers who know what changed — so that gate is protecting nobody and hiding
// the thing everyone is here to look at. Every surface that is designed and
// built is on for everyone.
//
// What stays off is a different category: §11 items with no approved design,
// and the entry points the kill pass removed. Those are not "not yet rolled
// out", they are "not designed", and rolling them out is not the question.
//
// When there are real users this reverts to §8's default by deleting `everyone`
// from the five that gained it.
//
// A flag is deleted within a few weeks of reaching everyone. Put the deletion
// in the same ticket as the rollout, or you accumulate a second codebase by
// stealth.

import { demoMode } from "../demo/mode.js";
import { useMemo } from "react";
import { useUser } from "./clerk.js";
import { loadJSON, saveJSON } from "./storage.js";

export const FLAGS = [
  { id: "home.v2", label: "Flight Deck", note: "The rebuilt home page.", everyone: true, locked: true },
  { id: "profile.v2", label: "Profile", note: "Licence · Preferences · Appearance.", everyone: true },
  { id: "tokens.global", label: "Wingman colour", note: "The livery and lighting system, site-wide.", everyone: true, locked: true },
  { id: "social.crew", label: "Formation and wingman", note: "The two crew-strip cells and the My flight preset.", everyone: true },
  { id: "social.frequency", label: "Frequency", note: "The channel preview and the Open frequency preset.", everyone: true },
  { id: "voice.characters", label: "Voices", note: "Choosing who greets you.", everyone: true },
  /* Off for now, with the Aurora finish (owner, 2026-09-21). */
  { id: "livery.aurora", label: "Aurora", note: "The one livery with curtains and a starfield.", everyone: false },
  // The kill pass. Each of these hides an entry point; the route and the code
  // stay put, so any of it is one switch away from coming back.
  { id: "nav.root", label: "Bottom nav", note: "Study · Modules · Logbook · Ready Room.", off: true },
  { id: "chrome.boarding", label: "Boarding pass", note: "The full-screen overlay on load.", off: true },
  { id: "chrome.patoast", label: "PA toast", note: "The cabin-crew announcement on theme change.", off: true },
  // `off` means "no approved design yet". There is one now: the module screen
  // was built to the brief and verified, so the gate comes off and a module
  // opens. There is no real content behind it, and that is fine — the brief is
  // explicit that the empty state IS the shipping state, and the screen says
  // what is coming rather than pretending.
  { id: "module.interior", label: "Module interior", note: "Opening a module at all. Off means clicking one does nothing.", everyone: true },
  { id: "module.screen", label: "Module screen", note: "Lessons, Library and People. Off falls back to the old hub.", everyone: true },
  { id: "library.reader", label: "Paper reader", note: "Papers open in the reader, with marking. Off opens the file in a tab.", everyone: true },
  /* The rebuild. On for everyone because it is what the reader is now, and a
     switch rather than a replacement because it is a large change landing the
     night before two people study on it: turning it off puts the previous
     reader back with one click and no deploy. Delete it once a week has passed
     without anybody reaching for it. */
  /* THE VIEWER IS NOT THE READER, and they are two switches on purpose.
     `VITE_PAPERS_READER` pauses the annotation reader — the tools, the marks,
     the ink, the island's rail. What this gates is a different thing entirely:
     a paper that opens to be scrolled, bookmarked and downloaded, and cannot
     mark anything. Turning the reader back on must not be the price of having
     papers at all, and shipping the viewer must not bring the editor with it. */
  /* OFF FOR LAUNCH (owner, 2026-09-21: "kill papers for now"). With it off the
     Library, the module's subtitle, Bookmarks' Pages folder and the paper
     address all show nothing of papers, and a page bookmark is held rather
     than pruned (useSaves.js). The walkthrough says a reader is coming. */
  { id: "paper.viewer", label: "Papers", note: "Papers open in Wingman: scroll, bookmark a page, download. Not the marking reader.", everyone: false },
  { id: "reader.v2", label: "Reader rebuild", note: "The rebuilt papers reader — floating chrome, a tray you build, marks as objects. Off is the previous reader.", everyone: true },
  // The one switch that takes the dev panel out. Off for everyone including
  // admins until it is turned on deliberately, and the panel additionally
  // refuses to render for anyone who is not an admin — two locks, because this
  // one writes progress and resets accounts.
  { id: "dev.panel", label: "Dev panel", note: "Set completion, position and scores; reset a module or the whole account. Developer only.", off: true },
  /* Placeholder content — four modules of general-knowledge quizzes, Blender
     open movies and invented threads. It was `everyone: true` so the screens
     could be walked before there was anything to put in them.

     OFF NOW, AND THIS IS THE FIRST OF THE TWO SWITCHES THAT EMPTY THE APP.
     Beta opens with the owner's own material going in, and placeholder
     content in front of a first cohort is worse than an empty shelf: it is
     indistinguishable from the real thing until somebody reads it, and then
     the whole product looks unfinished. Off means every screen reads
     `src/data.js`, which is the second switch — four named modules and
     nothing inside them.

     `readOverrides` (localStorage["pw-flags"]) still turns it on for an admin
     browser, which is how to walk a populated screen without shipping one. */
  { id: "content.test", label: "Test content", note: "Four modules of placeholder lessons, quizzes and papers. Not real content.", off: true },
  // Had `off` — no approved design. There is one now, so it ships like the
  // module screen did: `everyone`, not admin-only.
  { id: "social.readyroom", label: "Ready Room", note: "The room itself, and every door into it.", everyone: true },
  { id: "page.logbook", label: "Logbook", note: "The logbook page.", off: true },
  /* `page.bookmarks` is gone. It gated the old Saved screen — a list of
     question ids in pw-bookmarks, flipped as flashcards — and that screen has
     been replaced by Bookmarks, which is reached from the profile menu and
     from the Flight Deck's bag rather than from a flag. A toggle that gates
     nothing is a control in the admin panel that does nothing, which is the
     same failure as a dead button on a screen. check:doors is what noticed. */
  { id: "prefs.notices", label: "Notices", note: "The three notice switches in Preferences.", off: true },
  { id: "appearance.grain", label: "Grain switch", note: "The grain control in Appearance. The grain itself stays on.", off: true },
];

const BY_ID = Object.fromEntries(FLAGS.map((f) => [f.id, f]));
// The Features page is gone. Nothing in the app can toggle a flag any more, so
// every `off` below is now a permanent decision rather than a switch someone
// might flip — which is the point: those surfaces are hidden and staying
// hidden. The route and the code behind each one are untouched, so bringing
// one back is a one-word edit here rather than a rebuild.
//
// readOverrides still reads localStorage["pw-flags"], which is the only way
// left in and is deliberately not advertised. It is for turning the dev panel
// or the seeded content on while working, not a feature.

/* ===========================================================================
   PAPERS, PAUSED — the one switch.
   ---------------------------------------------------------------------------
   The reader is paused, not cancelled. Every line of its code and every row of
   its data stays where it is; what this turns off is every way IN and every
   place its work shows up. Set VITE_PAPERS_READER=true and redeploy and it all
   comes back, marks and all.

   WHY IT IS NOT `library.reader`. That flag answers a different question — it
   chooses whether a paper opens in the reader or in a browser tab — so turning
   it off leaves the Library full of papers that open as PDFs. Pausing means
   there are no papers, which is a question nothing in this file was asking.

   WHY AN ENV VAR RATHER THAN A ROW IN FLAGS. The rest of this list is resolved
   per user, at render, inside a hook. This one has to be readable by modules
   that are not components — lastPlace.js, attachments.js, useSaves.js — and it
   has to be the same answer for everybody, so it is a build-time constant.
   Vite folds it, which is also what keeps the reader's chunk out of the build.

   DEFAULT OFF, EVERYWHERE, INCLUDING LOCAL AND CI. A missing variable reads
   false on purpose: nothing should quietly depend on it being on.

   Nothing else in the app reads VITE_PAPERS_READER. Every other file imports
   this value. */
export const papersOn = import.meta.env.VITE_PAPERS_READER === "true";

const READER_FLAGS = new Set(["library.reader", "reader.v2"]);

const KEY = "pw-flags";

// tokens.global and home.v2 are `everyone` because the surfaces they were
// meant to gate no longer have an "off" to fall back to: §2B ships the colour
// system to every page at once and the layer it replaced is deleted, and the
// v2 home page was replaced rather than kept alongside. They stay in the list
// so the set is complete and so they get deleted with the others. The rest
// have a real off state and are admin-only.
export function flagDefault(id, isAdmin) {
  // Both reader flags are downstream of the one switch, so that "papers are
  // paused" is one answer rather than three that can disagree.
  if (!papersOn && READER_FLAGS.has(id)) return false;
  // `off` is a surface with no approved design: off for everyone, admin
  // included, until there is one. `everyone` is the opposite.
  if (BY_ID[id]?.off === true) return false;
  return BY_ID[id]?.everyone === true || !!isAdmin;
}

// `locked` is the pair whose off state no longer exists — the v2 token layer is
// deleted and the v2 home page was replaced rather than kept alongside. Turning
// either off would render nothing to fall back to.
export const isLocked = (id) => BY_ID[id]?.locked === true;

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
    const overridden = Object.prototype.hasOwnProperty.call(overrides, f.id);

    // An override can no longer turn OFF something that ships to everyone.
    //
    // This is what "I still cannot tap modules" was: the Features page used to
    // write these into localStorage, the page is gone, and a stored `false`
    // from back then outlived it with nothing left in the app to clear it. One
    // admin browser could sit on a stale switch and see a feature that shipped
    // to everyone else as missing — and there was no way to find out why from
    // inside the app.
    //
    // Overrides still work in the other direction, which is the only direction
    // that is useful now: turning a hidden surface ON while working.
    const canOverride = overridden && isAdmin && !f.locked && !(f.everyone && !overrides[f.id])
      /* ...and it cannot turn the reader back on. The switch is the switch: an
         admin browser holding a stale `library.reader: true` must not be the
         one account that still sees papers. */
      && !(!papersOn && READER_FLAGS.has(f.id));

    out[f.id] = canOverride ? !!overrides[f.id] : flagDefault(f.id, isAdmin);
  }
  /* The demo has a course in it. content.test is the switch every screen
     already reads for "load the content document", so the demo turns it on
     and moduleContent.js hands over the demo's course instead of the real
     one. Nothing outside the demo is affected. */
  if (demoMode) out["content.test"] = true;
  return out;
}

/* MEMOISED, AND IT IS NOT AN OPTIMISATION — it is the fix for an infinite
   render loop.

   This returned a fresh object literal, holding a fresh resolveFlags object,
   on every single render. Anything with `flags` in a dependency array
   therefore re-ran on every render, and App has an effect that does:

     if (!isSignedIn || !flags["social.readyroom"]) {
       setSquadrons([]); setRoomMessages([]); setRightSeat([]); return;
     }

   Three fresh arrays. New state identity, so React re-renders; new render, so
   `flags` is a new object; new object, so the effect runs again. React climbs
   to its 50-update ceiling, logs "Maximum update depth exceeded", and then
   STOPS APPLYING UPDATES — which is the part that actually hurt. A later
   navigation would push the URL and never re-render: measured, the address bar
   read /m/m1/M1.01/quiz/resume while App still had location.pathname "/", so
   the Flight Deck sat under a perfectly correct URL and the deck's Resume
   button looked broken.

   The identity is now stable while the inputs are. Overrides are compared by
   value because readOverrides() parses fresh JSON each time and would
   otherwise be a new object too — the same trap one level down. */
export function useFlags() {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const overrides = readOverrides();
  const overrideKey = JSON.stringify(overrides);
  return useMemo(
    () => ({ flags: resolveFlags(isAdmin, JSON.parse(overrideKey)), isAdmin }),
    [isAdmin, overrideKey],
  );
}
