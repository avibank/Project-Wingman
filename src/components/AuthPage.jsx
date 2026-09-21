import { useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import "./auth-page.css";

/* =============================================================================
   SIGNING IN, AND JOINING.
   -----------------------------------------------------------------------------
   One centred column: the wordmark line, Clerk's card, and one line under it
   to cross between signing in and joining. It used to be three headers deep:
   "Sign In", then a Sign In / Sign Up tab strip, then Clerk's own "Sign in to
   Wingman". It sat flush left in a 780px column, on tokens from two design
   passes ago.

   THE TITLE IS CLERK'S HEADER, reworded in `lib/clerkWords.js`, because that
   header changes at every step ("Check your email") and ours could not.

   THE MAIN BUTTON IS STYLED HERE, NOT THROUGH colorPrimary. Clerk derives its
   button shades from colorPrimary, and given `var(--accent)` it painted the
   button transparent: white words on nothing, which is how the live Continue
   button looked until this file changed (measured on wingman.institute,
   2026-09-21). The variables that are only ever used as they are, backgrounds
   and text, take the app's tokens safely.
   ========================================================================= */

const clerkLook = {
  variables: {
    colorPrimary: "var(--active)",
    colorBackground: "var(--panel)",
    colorInputBackground: "var(--raised)",
    colorInputText: "var(--t1)",
    colorText: "var(--t1)",
    colorTextSecondary: "var(--t2)",
    colorNeutral: "var(--t1)",
    borderRadius: "12px",
    fontFamily: "var(--font-ui)",
    fontSize: "15px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", maxWidth: "none", boxShadow: "none", border: "1px solid var(--line)", borderRadius: "16px" },
    card: { boxShadow: "none", background: "var(--panel)", padding: "28px 24px", "@media (max-width: 430px)": { padding: "24px 18px" } },
    headerTitle: { fontFamily: "var(--font-ui)", fontSize: "24px", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--t1)" },
    headerSubtitle: { fontSize: "14px", lineHeight: 1.5, color: "var(--t2)" },
    formButtonPrimary: {
      background: "var(--active-fill)", color: "var(--ground)", border: 0, boxShadow: "none",
      borderRadius: "999px", padding: "14px 20px", fontSize: "15px", lineHeight: "20px", fontWeight: 600, textTransform: "none",
      "&:hover, &:focus": { background: "var(--active-fill)", color: "var(--ground)", filter: "brightness(1.06)" },
      "&:active": { transform: "scale(.98)" },
    },
    socialButtonsBlockButton: {
      padding: "13px 20px", borderRadius: "999px", border: "1px solid var(--line)", boxShadow: "none",
      background: "var(--raised)", color: "var(--t1)",
      "&:hover": { background: "var(--raised)", filter: "brightness(1.12)" },
    },
    socialButtonsBlockButtonText: { fontSize: "15px", fontWeight: 500, color: "var(--t1)" },
    formFieldLabel: { color: "var(--t2)", fontWeight: 500 },
    formFieldInput: { border: "1px solid var(--line)", boxShadow: "none", fontSize: "16px" },
    dividerLine: { background: "var(--line)" },
    dividerText: { color: "var(--t3)" },
    formFieldAction: { color: "var(--active-text)" },
    formResendCodeLink: { color: "var(--active-text)" },
    identityPreviewEditButton: { color: "var(--active-text)" },
    footerActionLink: { color: "var(--active-text)" },
    /* The footer's own "Sign up" link goes nowhere under virtual routing, and
       the line under the card does its job. */
    footer: { display: "none" },
  },
};

/* The demo's last button sends a visitor here to join, as /signin?join=1. */
const startsOnJoin = () => {
  try { return new URLSearchParams(window.location.search).has("join"); } catch { return false; }
};

export default function AuthPage() {
  const [mode, setMode] = useState(() => (startsOnJoin() ? "signup" : "signin"));
  const signin = mode === "signin";
  return (
    <div className="auth">
      <p className="auth-mark">Wingman <span aria-hidden="true">·</span> Part-66</p>
      <div className="auth-card">
        {signin
          ? <SignIn routing="virtual" appearance={clerkLook} signUpUrl="#" />
          : <SignUp routing="virtual" appearance={clerkLook} signInUrl="#" />}
      </div>
      <p className="auth-switch">
        {signin ? "New to Wingman?" : "Already have an account?"}
        <button type="button" className="auth-switch-go" onClick={() => setMode(signin ? "signup" : "signin")}>
          {signin ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
