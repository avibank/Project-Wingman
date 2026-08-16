import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SignIn, SignUp } from "@clerk/clerk-react";

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
`;

export default AuthPage;
