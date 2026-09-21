/* The Clerk surface the app touches, as a fixture.
 *
 * Identity is Clerk's job in production and there is no way to sign in from a
 * test without a network round trip and a real account, so the harness supplies
 * the answer directly. `?uid=` picks who you are, which is what lets one test
 * assert what a SECOND student's browser receives — the anonymity test in
 * §15b.2 needs exactly that and cannot be written any other way.
 *
 * `?username=none` is a student who has not chosen a username yet — the path
 * First Flight takes a new account down. `update` keeps what it is given, so
 * a screen that sets one can be followed onto the next.
 *
 * `?uid=none` is NOBODY, signed out, with Clerk finished deciding. It exists
 * because a screen that waits on identity has two failure modes and they look
 * identical from the outside: waiting for an answer, and never getting one.
 * /bookmarks sat blank on the live site for exactly that reason.
 */
import React from "react";

const q = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
/* WHO YOU ARE LASTS FOR THE TAB, as a real session does. An address that
   says `?uid=` always wins; one that does not keeps the last answer, which
   is what a reload the app makes itself needs (the demo leaving to
   /signin?join=1 would otherwise sign a signed-out visitor in). */
const remembered = (() => { try { return sessionStorage.getItem("harness-uid"); } catch { return null; } })();
const id = q.get("uid") || remembered || "student_one";
try { if (q.get("uid")) sessionStorage.setItem("harness-uid", q.get("uid")); } catch { /* storage refused */ }
const staff = q.get("staff") === "1";

const NAMES = {
  student_one: "Alex Rahman",
  student_two: "Dana Silva",
  instructor: "K. Haddad",
};

const user = {
  id,
  fullName: NAMES[id] || "Test Pilot",
  username: q.get("username") === "none" ? null : id,
  primaryEmailAddress: { emailAddress: `${id}@example.test` },
  imageUrl: "",
  unsafeMetadata: {},
  publicMetadata: staff ? { role: "admin" } : {},
  update: async (patch) => Object.assign(user, patch),
  setProfileImage: async () => {},
  delete: async () => {},
};

const signedOut = id === "none";

/* THE WALKTHROUGH OPENS FOR EVERY SIGNED-OUT VISIT (src/demo/mode.js), and
   every fresh tab is a visit. So the harness counts it as seen, or every
   suite that loads a signed-out page would load the demo instead.
   `?walkthrough=1` is a visit, which is how the demo itself is walked. */
const walking = (() => {
  try {
    if (q.has("walkthrough")) sessionStorage.setItem("harness-walkthrough", "1");
    return sessionStorage.getItem("harness-walkthrough") === "1";
  } catch { return q.has("walkthrough"); }
})();
if (!walking) {
  try { if (!sessionStorage.getItem("pw-walkthrough-visit")) sessionStorage.setItem("pw-walkthrough-visit", "harness"); } catch { /* storage refused */ }
}

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
