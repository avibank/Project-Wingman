import { useState } from "react";
import { ChevronLeft, Mail, Lock, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";

function AuthPage({ onBack, session }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account before signing in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        onBack();
      }
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    onBack();
  };

  if (session) {
    return (
      <div className="auth-page">
        <button className="auth-back" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="auth-title">Account</h1>
        <div className="auth-block">
          <div className="auth-signed-in-row">
            <div className="auth-avatar-icon"><Mail size={16} /></div>
            <div>
              <div className="auth-signed-in-label">Signed in as</div>
              <div className="auth-signed-in-email">{session.user.email}</div>
            </div>
          </div>
          <button className="auth-signout-btn" onClick={handleSignOut} disabled={loading}>
            <LogOut size={15} /> {loading ? "Signing out…" : "Sign out"}
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

      <form className="auth-block" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-label"><Mail size={13} /> Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="auth-field">
          <span className="auth-field-label"><Lock size={13} /> Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-message">{message}</p>}

        <button type="submit" className="btn-primary auth-submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>
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
  .auth-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .auth-field { display: flex; flex-direction: column; gap: 6px; }
  .auth-field-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }
  .auth-field input { background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; color: var(--text); font-size: 13.5px; }
  .auth-field input:focus { outline: none; border-color: var(--accent); }
  .auth-error { font-size: 12.5px; color: var(--bad); margin: 0; }
  .auth-message { font-size: 12.5px; color: var(--good); margin: 0; }
  .auth-submit { width: 100%; }
  .auth-signed-in-row { display: flex; align-items: center; gap: 12px; }
  .auth-avatar-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
  .auth-signed-in-label { font-size: 11px; color: var(--muted); }
  .auth-signed-in-email { font-size: 14px; color: var(--text); font-weight: 600; }
  .auth-signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--bad); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; }
  .auth-signout-btn:hover { background: rgba(224,102,90,0.08); }
`;

export default AuthPage;
