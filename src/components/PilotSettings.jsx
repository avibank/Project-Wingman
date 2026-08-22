import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchProfileStatus, saveProfile } from "../lib/squadron.js";
import { LIVERIES, unlockedLiveries } from "./LiveryPicker.jsx";
import Tail, { TailStyles } from "./Tail.jsx";

// §8.3 makes invisible mode mandatory and requires it in settings; §7.6
// requires a toggle for the glow. Both flags were already honoured throughout
// the app and neither could be set anywhere, so both were effectively stuck on.

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

  if (state === "loading") return null;
  if (state === "unavailable") return null;

  const unlocked = unlockedLiveries(modulesCompleted);
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
        <ul className="ps2-liveries">
          {LIVERIES.map((l) => {
            const locked = !unlocked.has(l.id);
            const current = (profile?.livery || "dawn-patrol") === l.id;
            return (
              <li key={l.id}>
                <button
                  className={`ps2-livery ${current ? "is-current" : ""}`}
                  disabled={locked || busy} aria-pressed={current}
                  onClick={() => { patch({ livery: l.id }); document.documentElement.setAttribute("data-livery", l.id); }}
                >
                  <Tail name={l.name} livery={l.id} marking="solid" size={32} />
                  <span className="ps2-livery-name">{l.name}</span>
                  {locked && <span className="ps2-livery-lock">Complete a module</span>}
                </button>
              </li>
            );
          })}
        </ul>
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

      <div className="ps2-list">
        <Toggle
          id="ps2-invisible" on={invisible} busy={busy}
          onChange={(v) => patch({ invisible: v })}
          label="Fly invisible"
          // §8.3 — no penalty, no badge, no reduced matching. Say so.
          hint="You still see everyone. Nobody sees where you are, and nothing else changes."
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
        .ps2-row-label { display: block; font-size: 15px; color: var(--text-1); margin: 0 0 8px; }
        .ps2-row-hint { display: block; font-size: 13px; line-height: 1.45; color: var(--text-3); max-width: 46ch; }
        .ps2-note { font-size: 13px; color: var(--text-3); margin: 8px 0 0; }

        .ps2-callsign { display: flex; gap: 8px; }
        .ps2-input { flex: 1; min-height: 44px; padding: 0 12px; border: none; border-radius: 12px;
          background: var(--surface-2); color: var(--text-1); font-family: var(--font-ui); font-size: 15px; }
        .ps2-input:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .ps2-save { min-height: 44px; padding: 0 16px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-size: 15px; font-weight: 500; }
        .ps2-save:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }

        .ps2-liveries { list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .ps2-livery { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px;
          padding: 8px 12px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--surface-1); color: var(--text-1); text-align: left; }
        .ps2-livery:hover:not(:disabled) { background: var(--surface-2); }
        .ps2-livery.is-current { background: var(--surface-2); box-shadow: inset 3px 0 0 var(--warm); }
        .ps2-livery:disabled { cursor: default; }
        .ps2-livery-name { font-size: 14px; }
        .ps2-livery-lock { font-size: 12px; color: var(--text-3); margin-left: auto; white-space: nowrap; }

        .ps2-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .ps2-chip { min-height: 44px; padding: 0 14px; border: none; border-radius: 999px; cursor: pointer;
          background: var(--surface-1); color: var(--text-2); font-size: 14px; }
        .ps2-chip.is-on { background: var(--warm); color: var(--surface-0); }

        .ps2-list { display: grid; gap: 1px; background: var(--hairline);
          border-radius: 14px; overflow: hidden; }
        .ps2-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 12px 14px; background: var(--surface-1); min-height: 56px; }
        .ps2-row-text { display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
        .ps2-switch { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
          min-height: 44px; padding: 0 10px 0 4px; border: none; border-radius: 999px;
          background: var(--surface-2); cursor: pointer; color: var(--text-3); font-size: 13px; }
        .ps2-switch.is-on { background: color-mix(in oklab, var(--warm) 22%, var(--surface-2));
          color: var(--text-1); }
        .ps2-knob { width: 18px; height: 18px; border-radius: 50%; background: var(--text-3);
          transition: transform 160ms cubic-bezier(0.2,0.8,0.2,1), background 160ms linear; }
        .ps2-switch.is-on .ps2-knob { background: var(--warm); transform: translateX(4px); }
        .ps2-switch-state { font-family: var(--font-mono); font-size: 12px; min-width: 22px; }
        @media (prefers-reduced-motion: reduce) { .ps2-knob { transition: none; } }
      `}</style>
    </section>
  );
}

export default PilotSettings;
