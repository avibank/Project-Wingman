/* The Clerk surface the app touches, as a fixture.
 *
 * Identity is Clerk's job in production and there is no way to sign in from a
 * test without a network round trip and a real account, so the harness supplies
 * the answer directly. `?uid=` picks who you are, which is what lets one test
 * assert what a SECOND student's browser receives — the anonymity test in
 * §15b.2 needs exactly that and cannot be written any other way.
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

export const useUser = () => ({ isSignedIn: true, isLoaded: true, user });
export const useClerk = () => ({ signOut: async () => {}, openUserProfile: () => {}, user });
export const useReverification = (fn) => fn;
export const ClerkProvider = ({ children }) => <>{children}</>;
export const SignIn = () => <div>[SignIn]</div>;
export const SignUp = () => <div>[SignUp]</div>;
