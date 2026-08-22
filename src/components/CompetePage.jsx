import { Lock } from "lucide-react";

// Reserved nav slot. Styled to match how a not-yet-available module reads
// elsewhere in the app; no leaderboard logic exists yet by design.
function CompetePage() {
  return (
    <div className="compete">
      <header className="compete-head">
        <h1 className="compete-title">Compete</h1>
        <p className="compete-sub">Standings, challenges and badges.</p>
      </header>
      <div className="compete-card">
        <span className="compete-rail" aria-hidden="true" />
        <Lock size={16} className="compete-lock" />
        <h2 className="compete-name">Coming soon</h2>
        <p className="compete-body">
          The competitive side isn't open yet. When it lands it'll cover standings across your modules,
          challenges against your wingman, and milestones worth chasing.
        </p>
      </div>
      <style>{`
        .compete-head { margin-bottom: 22px; }
        .compete-title { font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); margin: 0 0 4px; }
        .compete-sub { font-size: 14px; color: var(--muted); margin: 0; }
        .compete-card { position: relative; overflow: hidden; max-width: 520px; padding: 22px 22px 22px 24px;
          background: var(--elev-1); border: 1px solid var(--border-soft); border-radius: var(--r-lg); box-shadow: var(--shadow-1); opacity: 0.72; }
        .compete-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--muted2); opacity: 0.3; }
        .compete-lock { color: var(--muted2); }
        .compete-name { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); margin: 10px 0 6px; }
        .compete-body { font-size: 13px; line-height: 1.6; color: var(--muted); margin: 0; max-width: 46ch; }
      `}</style>
    </div>
  );
}

export default CompetePage;
