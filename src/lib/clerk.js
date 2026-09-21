/* =============================================================================
   WHO IS SIGNED IN — Clerk's answer, except for a visitor in the demo.
   -----------------------------------------------------------------------------
   The walkthrough is the first thing a new visitor sees, before they have an
   account (owner, 2026-09-21). It is the real app with a class in it
   (src/demo/), and most of the real app hides itself from somebody who is
   not signed in. So inside the demo, a visitor with no account is signed in
   as "You", a student who exists only in the demo's copy of the database.

   Every hook the app takes from Clerk comes through here. Outside the demo,
   and for a signed-in student inside it, these are Clerk's own hooks and
   nothing else. Clerk's components (SignIn, SignUp, UserProfile) still come
   straight from Clerk: a visitor in the demo never reaches them.
   ========================================================================= */
import { useUser as useClerkUser, useClerk as useClerkClerk, useReverification as useClerkReverification } from "@clerk/clerk-react";
import { demoMode, demoState } from "../demo/mode.js";

const GUEST = Boolean(demoMode && demoState?.guest);

const guest = GUEST ? {
  id: demoState.me,
  username: "you",
  firstName: "You",
  lastName: null,
  fullName: "You",
  hasImage: false,
  primaryEmailAddress: null,
  emailAddresses: [],
  externalAccounts: [],
  passwordEnabled: false,
  unsafeMetadata: {},
  publicMetadata: {},
  update: async () => guest,
  reload: async () => guest,
  delete: async () => null,
} : null;

export function useUser() {
  const real = useClerkUser();
  return GUEST ? { isLoaded: true, isSignedIn: true, user: guest } : real;
}

export function useClerk() {
  const real = useClerkClerk();
  return GUEST
    ? { ...real, user: guest, signOut: async () => null, openUserProfile: () => null, openSignIn: () => null }
    : real;
}

export function useReverification(fn) {
  return useClerkReverification(fn);
}
