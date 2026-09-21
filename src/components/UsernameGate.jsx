import { startTransition, useState } from "react";
import { useUser, useReverification } from "../lib/clerk.js";
import { ERROR_GENERIC } from "../lib/copy.js";
import "./first-flight.css";

/* An account with a profile and no Clerk username. A new student never sees
   this: First Flight, in front of it, sets the username as their callsign.
   It is here for an older account, and it asks in First Flight's words and
   First Flight's look, so nobody meets a second style on the way in. */
function UsernameGate({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const updateUsername = useReverification((newUsername) => user?.update({ username: newUsername }));
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!isLoaded) return null;
  /* `saving` HOLDS THE GATE until the transition below lets go of it. The
     username lives on Clerk's user object, not in React state, so any urgent
     render after it is set, including React's own flush at the end of the
     submitting click, would otherwise swap in the whole app mid-click. */
  if (!isSignedIn || (user.username && !saving)) return children;

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
        setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || ERROR_GENERIC);
      }
      setSaving(false);
      return;
    }
    /* A TRANSITION, because this render is the one that swaps the gate for
       the whole app, and the app's screens are lazy. As an urgent update the
       first lazy screen suspends with no boundary above it, and React
       replaces everything with its error screen (measured in the harness,
       whose Clerk answers at once). */
    startTransition(() => setSaving(false));
  };

  return (
    <div className="ff">
      <form className="ff-col" onSubmit={handleSubmit}>
        <p className="ff-eyebrow">Your licence</p>
        <h1 className="ff-title">What should we call you?</h1>
        <p className="ff-sub">
          Your callsign is how you appear in the Ready Room and how classmates
          find you. Change it on your Licence whenever you like.
        </p>
        <label className="ff-l" htmlFor="ug-callsign">Callsign</label>
        <input id="ug-callsign" className="ff-in" placeholder="Callsign" value={username} maxLength={24}
               autoFocus autoComplete="username" autoCapitalize="off" spellCheck="false"
               aria-invalid={error ? "true" : undefined}
               onChange={(e) => { setUsername(e.target.value); setError(null); }} />
        {error && <p className="ff-note" role="alert">{error}</p>}
        <button type="submit" className="ff-go" disabled={saving || !username.trim()}>
          {saving ? "One moment…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

export default UsernameGate;
