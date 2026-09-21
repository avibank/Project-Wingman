/* =============================================================================
   THE DEMO IS A SEPARATE STATE OF THE APP.
   -----------------------------------------------------------------------------
   A new student's first look at Wingman should be the app with a class
   already in it: lessons signed off, a module mid-way, people on the Crew tab,
   a Ready Room with questions and a squadron talking. Their own account has
   none of that yet, and faking it there would be writing somebody else's
   progress into theirs.

   So the demo is the REAL app, pointed at a copy of the database that lives in
   this tab's memory (backend.js), with a class already in it (seed.js) and a
   course in it (content.json). Starting it sets this flag and reloads, so
   every screen boots against the copy from its first frame, and nothing is
   half in one world and half in the other. Leaving clears the flag and reloads
   into the real account. Nothing written during the demo survives it:
   requests go to the copy (supabaseClient.js), localStorage is a copy in
   memory (boot.js), and the live socket stays shut (live.js).

   sessionStorage, so it is this tab's and nobody else's, and it ends with the
   tab. Tiny on purpose: this file is in the entry chunk, and everything else
   in src/demo/ is loaded only when the flag is set.
   ========================================================================= */
const KEY = "pw-demo";

let state = null;
try { state = JSON.parse(window.sessionStorage.getItem(KEY) || "null"); } catch { state = null; }

/** True for the whole life of a page that booted into the demo. */
export const demoMode = Boolean(state && state.me);

/** { me, look, from, how, guest, at } — who the demo is for, how their app looks, where they started, whether it was their first, and whether they have an account. */
export const demoState = state;

/* Into the demo: remember who it is for and how their app looks, then reload
   so the whole app boots against the copy. */
export function enterDemo({ me, look = {}, from = "/", how = "replay", guest = false }) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ me, look, from, how, guest, at: Date.now() })); } catch { /* private mode */ }
  window.location.assign("/");
}

/* Out of it: forget the copy and reload into the real account, at `to`. */
export function leaveDemo(to = "/") {
  try { window.sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  window.location.assign(to);
}

/* A VISITOR WITH NO ACCOUNT gets the demo the first time they arrive signed
   out (owner, 2026-09-21), as "You": a student who exists only in the demo's
   copy of the database (src/lib/clerk.js). A signed-in student only ever
   gets it by asking.

   SEEN IS WRITTEN WHEN IT ENDS, finished or skipped, not when it starts: a
   tab closed half way through has not seen it. The key carries a version,
   so a device marked by an earlier walkthrough is shown this one. It was
   `pw-walkthrough-seen`, written on the way in, and the owner, testing on a
   device an earlier build had marked, could not make it appear at all. */
export const GUEST_ID = "demo_you";
export const SEEN_KEY = "pw-walkthrough-seen-2";
const real = () => { try { return window.__pwRealStorage || window.localStorage; } catch { return null; } };
export const walkthroughSeen = () => {
  try { return Boolean(real()?.getItem(SEEN_KEY)); } catch { return true; }
};
export const markWalkthroughSeen = () => {
  try { real()?.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* shown again next time, then */ }
};
export function enterGuestDemo(from = "/") {
  enterDemo({ me: GUEST_ID, guest: true, how: "first", from, look: { callsign: "you", name: "You" } });
}
