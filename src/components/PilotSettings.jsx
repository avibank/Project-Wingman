import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchProfileStatus, saveProfile } from "../lib/squadron.js";
import { NOTIFY_MODES } from "../lib/readyRoom.js";
import LiveryPicker from "./LiveryPicker.jsx";
import { resolveLivery } from "../lib/liveries.js";
import Tail, { TailStyles } from "./Tail.jsx";
import Spooling from "./Spooling.jsx";
import { FLY_SOLO_KEY, mirrorFlySolo } from "../lib/flySolo.js";
import { useUserProgress } from "../lib/userProgress.jsx";

// §8.3 makes hiding yourself mandatory and requires it in settings; §7.6
// requires a toggle for the glow. Both flags were already honoured throughout
// the app and neither could be set anywhere, so both were effectively stuck on.
//
// Fly solo is symmetric now — nobody sees you and you see nobody — so the old
// "you still see everyone" framing no longer applies here.

const STUDY_TIMES = [
  { id: "early", label: "Early" },
  { id: "day", label: "Day" },
  { id: "evening", label: "Evening" },
  { id: "late", label: "Late" },
];

function Toggle({ id, on, onChange, label, hint, busy }) {
  return (
    <div className="ps2-row">
      <label className="ps2-row-text" htmlFor={id}>
        <span className="ps2-row-label">{label}</span>
        {hint && <span className="ps2-row-hint">{hint}</span>}
      </label>
      <button
        id={id} role="switch" aria-checked={on} disabled={busy}
        className={`ps2-switch ${on ? "is-on" : ""}`}
        onClick={() => onChange(!on)}
      >
        <span className="ps2-knob" aria-hidden="true" />
        {/* §13 — state is never carried by position or colour alone. */}
        <span className="ps2-switch-state">{on ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

function PilotSettings({ modulesCompleted = 0 }) {
  const { user, isSignedIn } = useUser();
  const progress = useUserProgress();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState("loading");   // loading | ready | unavailable
  const [busy, setBusy] = useState(false);
  const [callsign, setCallsign] = useState("");

  useEffect(() => {
    if (!isSignedIn || !user?.id) { setState("unavailable"); return; }
    let live = true;
    fetchProfileStatus(user.id)
      .then(({ profile: p, failed }) => {
        if (!live) return;
        if (failed) { setState("unavailable"); return; }
        setProfile(p || {});
        setCallsign(p?.callsign || "");
        setState("ready");
      })
      .catch(() => live && setState("unavailable"));
    return () => { live = false; };
  }, [isSignedIn, user?.id]);

  // Optimistic, then reconciled: a toggle that lags reads as broken. On failure
  // the value goes back rather than lying about having saved.
  const patch = async (fields) => {
    const prev = profile;
    setProfile((p) => ({ ...p, ...fields }));
    setBusy(true);
    let saved = null;
    try {
      saved = await saveProfile(user.id, fields);
    } catch (e) {
      console.error(e);
    } finally {
      // Without the finally, a rejected save leaves busy stuck true and every
      // control on this panel disabled for the rest of the session.
      setBusy(false);
    }
    if (!saved) setProfile(prev);
  };

  if (state === "loading") return <Spooling />;
  if (state === "unavailable") return null;
  const invisible = profile?.invisible === true;
  const glowOn = profile?.glow_enabled !== false;

  return (
    <section className="ps2">
      <h2 className="ps2-head">Your pilot</h2>

      <div className="ps2-block">
        <label className="ps2-row-label" htmlFor="ps2-callsign">Callsign</label>
        <div className="ps2-callsign">
          <input
            id="ps2-callsign" className="ps2-input" value={callsign} maxLength={24}
            placeholder="What your squadron sees"
            onChange={(e) => setCallsign(e.target.value)}
          />
          <button
            className="ps2-save" disabled={busy || callsign.trim() === (profile?.callsign || "")}
            onClick={() => patch({ callsign: callsign.trim() || null })}
          >Save</button>
        </div>
      </div>

      <div className="ps2-block">
        <p className="ps2-row-label">Livery</p>
        <LiveryPicker
          current={profile?.livery}
          modulesCompleted={modulesCompleted}
          onSelect={(id) => {
            patch({ livery: id });
            document.documentElement.setAttribute("data-livery", resolveLivery(id));
          }}
        />
      </div>

      <div className="ps2-block">
        <p className="ps2-row-label">When you usually study</p>
        <div className="ps2-chips">
          {STUDY_TIMES.map((t) => (
            <button
              key={t.id} disabled={busy} aria-pressed={profile?.study_time === t.id}
              className={`ps2-chip ${profile?.study_time === t.id ? "is-on" : ""}`}
              onClick={() => patch({ study_time: t.id })}
            >{t.label}</button>
          ))}
        </div>
        <p className="ps2-note">Used to put you with pilots who are awake when you are.</p>
      </div>

      <div className="ps2-block">
        <p className="ps2-row-label">Notifications</p>
        <div className="ps2-chips">
          {NOTIFY_MODES.map((m) => (
            <button
              key={m.id} disabled={busy}
              aria-pressed={(profile?.notify || "default") === m.id}
              className={`ps2-chip ${(profile?.notify || "default") === m.id ? "is-on" : ""}`}
              onClick={() => patch({ notify: m.id })}
            >{m.label}</button>
          ))}
        </div>
        {/* §11 — never send a streak warning, a countdown, or a re-engagement nag. */}
        <p className="ps2-note">Only for things a person actually did. Never a streak warning or a nudge to come back.</p>
      </div>

      <div className="ps2-list">
        {/* The same setting as Fly solo on the licence. It writes through the
            same path deliberately: two controls for one setting that each wrote
            only half of it is how the old one came to hide nothing at all. */}
        <Toggle
          id="ps2-invisible" on={invisible} busy={busy}
          onChange={(v) => { patch({ invisible: v }); progress.set(FLY_SOLO_KEY, v); mirrorFlySolo(v); }}
          label="Fly solo"
          hint="Nobody sees you and you see nobody. For the nights you'd rather just get on with it."
        />
        <Toggle
          id="ps2-glow" on={glowOn} busy={busy}
          onChange={(v) => patch({ glow_enabled: v })}
          label="Study glow"
          hint="Warms the chapter you're reading when others are on it. Off is a plain page."
        />
      </div>

      <TailStyles />
      <style>{`
        .ps2 { margin: 28px 0 0; }
        .ps2-head { font-family: var(--font-ui); font-size: 17px; font-weight: 500;
          color: var(--text-1); margin: 0 0 12px; }
        .ps2-block { margin-bottom: 20px; }
        .ps2-row-label { display: block; font-size: 16px; color: var(--text-1); margin: 0 0 8px; }
        .ps2-row-hint { display: block; font-size: 14px; line-height: 1.45; color: var(--text-2); max-width: 46ch; }
        .ps2-note { font-size: 14px; color: var(--text-2); margin: 8px 0 0; }

        .ps2-callsign { display: flex; gap: 8px; }
        .ps2-input { flex: 1; min-height: 44px; padding: 0 12px; border: none; border-radius: 12px;
          background: var(--surface-2); color: var(--text-1); font-family: var(--font-ui); font-size: 16px; }
        .ps2-input:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .ps2-save { min-height: 44px; padding: 0 16px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-size: 16px; font-weight: 500; }
        .ps2-save:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }

        .ps2-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .ps2-chip { min-height: 44px; padding: 8px 14px; text-align: left; max-width: 100%; border: none; border-radius: 999px; cursor: pointer;
          background: var(--surface-1); color: var(--text-2); font-size: 14px; }
        .ps2-chip.is-on { background: var(--warm); color: var(--surface-0); }

        .ps2-list { display: grid; gap: 1px; background: var(--hairline);
          border-radius: 12px; overflow: hidden; }
        .ps2-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 12px 14px; background: var(--surface-1); min-height: 56px; }
        .ps2-row-text { display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
        .ps2-switch { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
          min-height: 44px; padding: 0 10px 0 4px; border: none; border-radius: 999px;
          background: var(--surface-2); cursor: pointer; color: var(--text-2); font-size: 14px; }
        .ps2-switch.is-on { background: color-mix(in oklab, var(--warm) 22%, var(--surface-2));
          color: var(--text-1); }
        .ps2-knob { width: 18px; height: 18px; border-radius: 50%; background: var(--text-3);
          transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), background 180ms linear; }
        .ps2-switch.is-on .ps2-knob { background: var(--warm); transform: translateX(4px); }
        .ps2-switch-state { font-family: var(--font-ui); font-size: 12px; min-width: 22px; }
        @media (prefers-reduced-motion: reduce) { .ps2-knob { transition: none; } }
      `}</style>
    </section>
  );
}

export default PilotSettings;
