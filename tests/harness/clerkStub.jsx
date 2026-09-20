/* The Clerk surface the app touches, as a fixture.
 *
 * Identity is Clerk's job in production and there is no way to sign in from a
 * test without a network round trip and a real account, so the harness supplies
 * the answer directly. `?uid=` picks who you are, which is what lets one test
 * assert what a SECOND student's browser receives — the anonymity test in
 * §15b.2 needs exactly that and cannot be written any other way.
 *
 * `?uid=none` is NOBODY, signed out, with Clerk finished deciding. It exists
 * because a screen that waits on identity has two failure modes and they look
 * identical from the outside: waiting for an answer, and never getting one.
 * /bookmarks sat blank on the live site for exactly that reason.
 */
import React from "react";

const q = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
const id = q.get("uid") || "student_one";
const staff = q.get("staff") === "1";

const NAMES = {
  student_one: "Alex Rahman",
  student_two: "Dana Silva",
  instructor: "K. Haddad",
};

const user = {
  id,
  fullName: NAMES[id] || "Test Pilot",
  username: id,
  primaryEmailAddress: { emailAddress: `${id}@example.test` },
  imageUrl: "",
  unsafeMetadata: {},
  publicMetadata: staff ? { role: "admin" } : {},
  update: async () => {},
  setProfileImage: async () => {},
  delete: async () => {},
};

const signedOut = id === "none";

export const useUser = () => (signedOut
  ? { isSignedIn: false, isLoaded: true, user: null }
  : { isSignedIn: true, isLoaded: true, user });
export const useClerk = () => ({ signOut: async () => {}, openUserProfile: () => {}, user: signedOut ? null : user });
export const useReverification = (fn) => fn;
export const ClerkProvider = ({ children }) => <>{children}</>;
export const SignIn = () => <div>[SignIn]</div>;
export const SignUp = () => <div>[SignUp]</div>;
/* Clerk's account panel, stood in for. Without this the account route's chunk
   fails to import in the harness and the screen renders nothing at all — which
   is indistinguishable from the two buttons still being dead, and is how a
   walk would have "proved" a fix that was fine. It carries the same landmarks
   the real one does, so a walk can assert it arrived. */
export const UserProfile = () => (
  <div data-qa="clerk-user-profile" className="cl-stub">
    <h2>Account</h2>
    <p>Clerk&rsquo;s own account panel renders here: email, password, devices.</p>
  </div>
);
