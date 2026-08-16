import { useState } from "react";
import { ChevronLeft, Mail, LogOut, UserCog } from "lucide-react";
import { SignIn, SignUp, useUser, useClerk } from "@clerk/clerk-react";

const clerkAppearance = {
  variables: {
    colorPrimary: "var(--accent)",
    colorBackground: "var(--panel)",
    colorInputBackground: "var(--panel-alt)",
    colorInputText: "var(--text)",
    colorText: "var(--text)",
    colorTextSecondary: "var(--muted)",
    colorNeutral: "var(--text)",
    borderRadius: "10px",
    fontFamily: "'Inter', sans-serif",
  },
  elements: {
    card: { boxShadow: "none", border: "1px solid var(--border)" },
    headerTitle: { fontFamily: "'Space Grotesk', sans-serif" },
    footer: { display: "none" },
  },
};

function AuthPage({ onBack }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const { isSignedIn, user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  if (isSignedIn) {
    return (
      <div className="auth-page">
        <button className="auth-back" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="auth-title">Account</h1>
        <div className="auth-block">
          <div className="auth-signed-in-row">
            {user.imageUrl ? (
              <img className="auth-avatar-photo" src={user.imageUrl} alt="" />
            ) : (
              <div className="auth-avatar-icon"><Mail size={16} /></div>
            )}
            <div>
              <div className="auth-signed-in-label">Signed in as</div>
              <div className="auth-signed-in-email">{user.fullName || user.primaryEmailAddress?.emailAddress}</div>
            </div>
          </div>
          <button className="auth-manage-btn" onClick={() => openUserProfile()}>
            <UserCog size={15} /> Manage account (photo, name, email, password)
          </button>
          <button className="auth-signout-btn" onClick={() => signOut().then(onBack)}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
        <style>{authStyles}</style>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="auth-title">{mode === "signin" ? "Sign In" : "Create Account"}</h1>

      <div className="auth-tabs">
        <button className={`auth-tab ${mode === "signin" ? "is-active" : ""}`} onClick={() => setMode("signin")}>Sign In</button>
        <button className={`auth-tab ${mode === "signup" ? "is-active" : ""}`} onClick={() => setMode("signup")}>Sign Up</button>
      </div>

      <div className="auth-clerk-wrap">
        {mode === "signin" ? (
          <SignIn routing="virtual" appearance={clerkAppearance} signUpUrl="#" />
        ) : (
          <SignUp routing="virtual" appearance={clerkAppearance} signInUrl="#" />
        )}
      </div>
      <style>{authStyles}</style>
    </div>
  );
}

const authStyles = `
  .auth-page { max-width: 420px; }
  .auth-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
  .auth-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--text); margin: 0 0 18px; }
  .auth-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
  .auth-tab { flex: 1; background: transparent; border: none; color: var(--muted2); font-size: 13px; padding: 8px; border-radius: 8px; cursor: pointer; }
  .auth-tab.is-active { background: var(--panel); color: var(--text); }
  .auth-clerk-wrap { display: flex; justify-content: center; }
  .auth-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .auth-signed-in-row { display: flex; align-items: center; gap: 12px; }
  .auth-avatar-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
  .auth-avatar-photo { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
  .auth-signed-in-label { font-size: 11px; color: var(--muted); }
  .auth-signed-in-email { font-size: 14px; color: var(--text); font-weight: 600; }
  .auth-manage-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--accent); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; }
  .auth-manage-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
  .auth-signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--bad); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; }
  .auth-signout-btn:hover { background: rgba(224,102,90,0.08); }
`;

export default AuthPage;
