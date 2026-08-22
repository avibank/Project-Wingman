import { useState } from "react";
import { useUser, useReverification } from "@clerk/clerk-react";
import { Plane, Check } from "lucide-react";

function UsernameGate({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const updateUsername = useReverification((newUsername) => user?.update({ username: newUsername }));
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!isLoaded) return null;
  if (!isSignedIn || user.username) return children;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await updateUsername(trimmed);
    } catch (err) {
      if (err?.code !== "reverification_cancelled") {
        setError(err?.errors?.[0]?.message || "Couldn't save that username — try another.");
      }
    }
    setSaving(false);
  };

  return (
    <div className="username-gate">
      <div className="username-gate-card">
        <Plane size={22} style={{ transform: "rotate(45deg)" }} />
        <h1>Choose a username</h1>
        <p>Pick a username to continue — this is how other pilots will see you in Comments and Discussion.</p>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="e.g. SkyCadet"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={saving || !username.trim()}>
            {saving ? "Saving…" : <>Continue <Check size={14} /></>}
          </button>
        </form>
        {error && <p className="username-gate-error">{error}</p>}
      </div>
      <style>{`
        .username-gate { position: fixed; inset: 0; z-index: 200; background: var(--bg); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .username-gate-card { width: min(360px, 100%); background: var(--panel); border: 1px solid var(--border-hover); border-radius: var(--r-lg); padding: 28px 24px; text-align: center; color: var(--accent); }
        .username-gate-card h1 { font-family: var(--font-display); font-size: 20px; color: var(--text); margin: 12px 0 6px; }
        .username-gate-card p { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0 0 18px; }
        .username-gate-card form { display: flex; flex-direction: column; gap: 10px; }
        .username-gate-card input { background: var(--panel-alt); border: 1px solid var(--border); border-radius: var(--r-md); padding: 11px 14px; color: var(--text); font-size: 14px; text-align: center; }
        .username-gate-card input:focus { outline: none; border-color: var(--accent); }
        .username-gate-card button { display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-md); padding: 11px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .username-gate-card button:disabled { opacity: 0.5; cursor: not-allowed; }
        .username-gate-error { color: var(--bad); font-size: 12px; margin-top: 10px; }
      `}</style>
    </div>
  );
}

export default UsernameGate;
