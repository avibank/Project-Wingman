/* =============================================================================
   CLERK'S OWN ACCOUNT UI, ON ITS OWN ADDRESS.
   -----------------------------------------------------------------------------
   Email → "Change" and Password → "Update" were two dead buttons on the
   Licence tab. Both called `onNavigate("account")`; "account" is not one of
   the three profile tabs, so `path.profile` fell back to `/account/licence` —
   the page you were already on. Pressing either did nothing at all, on a
   screen where every other control worked, which is the worst kind of dead:
   the student assumes they mis-tapped.

   THE OWNER DECIDED: THROUGH CLERK. Not a deletion, not a placeholder. Clerk
   owns the email flow, the verification mail, the password rules and the case
   a home-built form always gets wrong — a Google-signed-in account has no
   password to change, and the form would either offer one or refuse without
   saying why. None of that is built here.

   IT IS LAZY, because @clerk/clerk-react's UserProfile is a large component
   nobody who never presses those two buttons should pay for.

   IT IS SKINNED, not restyled: the variables Clerk exposes are pointed at this
   app's own tokens, so the panel is the app's colours and the app's type and
   Clerk's behaviour. Anything Clerk does not expose stays Clerk's.
   ========================================================================= */
import { UserProfile } from "@clerk/clerk-react";
import { ChevronLeft } from "lucide-react";
import "./account-portal.css";

export default function AccountPortal({ section = "email", onBack }) {
  return (
    <div className="acct">
      <button type="button" className="acct-back" onClick={onBack}>
        <ChevronLeft size={16} aria-hidden="true" /> Licence
      </button>
      <h1 className="acct-title">{section === "security" ? "Password and sign-in" : "Your email"}</h1>
      <p className="acct-sub">
        {section === "security"
          ? "Your password, the devices you are signed in on, and how you sign in."
          : "The address Wingman writes to, and the one you sign in with."}
      </p>

      <div className="acct-frame">
        <UserProfile
          routing="hash"
          appearance={{
            variables: {
              colorPrimary: "var(--active)",
              colorBackground: "var(--panel)",
              colorText: "var(--t1)",
              colorTextSecondary: "var(--t2)",
              colorInputBackground: "var(--raised)",
              colorInputText: "var(--t1)",
              borderRadius: "12px",
              fontFamily: "var(--font-ui)",
            },
            elements: {
              rootBox: { width: "100%" },
              cardBox: { boxShadow: "none", border: "1px solid var(--line)" },
            },
          }}
        />
      </div>
    </div>
  );
}
