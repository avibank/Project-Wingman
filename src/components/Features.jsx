import { useState } from "react";
import { FLAGS, readOverrides, writeOverride, clearOverrides, resolveFlags, flagDefault, isLocked } from "../lib/flags.js";
import { useUser } from "@clerk/clerk-react";

// §8 — one flag per surface, not one big switch. Default on for admin, off for
// everyone else, so the redesign lives in production from day one and the gap
// between review and shipping is never more than a deploy.
//
// A flag is deleted within a few weeks of reaching everyone. Put the deletion
// in the same ticket as the rollout, or you accumulate a second codebase by
// stealth. This panel exists to make that deletion obvious when it's due.

const FEATURES_CSS = `
.features { max-width: 640px; margin: 0 auto; padding: 28px 22px 80px;
  display: flex; flex-direction: column; gap: 16px; }
.feat-h1 { font-size: 32px; font-weight: 700; letter-spacing: -.7px; margin: 0; color: var(--t1); }
.feat-note { font-size: 12.5px; color: var(--t2); line-height: 1.5; margin: 0; }
.feat-card { background: var(--panel); border: 1px solid var(--line); border-top-color: var(--edge-hi);
  border-bottom-color: var(--edge-lo); border-radius: var(--r-panel); padding: 6px 17px; }
.feat-row { display: flex; align-items: center; gap: 16px; min-height: 60px;
  border-bottom: 1px solid var(--line); }
.feat-row:last-child { border-bottom: 0; }
.feat-text { flex: 1; min-width: 0; }
.feat-label { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 14px; font-weight: 600; color: var(--t1); }
.feat-label code { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .04em; color: var(--t3); }
.feat-chip { font-family: var(--font-mono); font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--t3); border: 1px solid var(--line); border-radius: 3px; padding: 1px 5px; }
.feat-chip.is-set { color: var(--ground); background: var(--active-fill); border-color: transparent; }
.feat-sub { font-size: 12.5px; color: var(--t2); line-height: 1.4; }
.feat-acts { display: flex; gap: 10px; flex-wrap: wrap; }
.features .sw:disabled { opacity: .5; cursor: default; }
`;

function Features({ onBack }) {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const [overrides, setOverrides] = useState(() => readOverrides());
  const flags = resolveFlags(isAdmin, overrides);

  if (!isAdmin) {
    return (
      <div className="features">
        <p className="feat-note">This is an admin surface.</p>
        <button className="pill" type="button" onClick={onBack}>Back</button>
        <style>{FEATURES_CSS}</style>
      </div>
    );
  }

  const set = (id, on) => { writeOverride(id, on); setOverrides(readOverrides()); };
  const reset = () => { clearOverrides(); setOverrides({}); };

  return (
    <div className="features">
      <h1 className="feat-h1">Features</h1>
      <p className="feat-note">
        On for you, off for everyone else. Overrides live on this device only, and a flag
        gets deleted within a few weeks of reaching everyone.
      </p>

      <section className="feat-card">
        {FLAGS.map((f) => {
          const on = flags[f.id];
          const overridden = Object.prototype.hasOwnProperty.call(overrides, f.id);
          return (
            <div className="feat-row" key={f.id}>
              <div className="feat-text">
                <div className="feat-label">
                  {f.label}
                  <code>{f.id}</code>
                  {f.everyone && <span className="feat-chip">everyone</span>}
                  {f.off && <span className="feat-chip">no design</span>}
                  {overridden && <span className="feat-chip is-set">overridden</span>}
                </div>
                <div className="feat-sub">{f.note}</div>
              </div>
              <button type="button" role="switch" aria-checked={on} aria-label={f.label}
                      className="sw is-inline"
                      disabled={isLocked(f.id)}
                      onClick={() => set(f.id, !on)} />
            </div>
          );
        })}
      </section>

      <div className="feat-acts">
        <button className="pill" type="button" onClick={reset}>Back to defaults</button>
        <button className="pill" type="button" onClick={onBack}>Done</button>
      </div>

      <p className="feat-note">
        Everyone sees:{" "}
        {FLAGS.filter((f) => flagDefault(f.id, false)).map((f) => f.label).join(", ") || "none of these"}.
        Nothing is admin-only — the surfaces still off are the ones with no approved design.
      </p>

      <style>{FEATURES_CSS}</style>
    </div>
  );
}


export default Features;
