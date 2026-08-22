import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useDisplayName } from "../lib/identity.js";
import { fetchAllPresence, heartbeat } from "../lib/presence.js";

// Always-on presence instrument, pinned app-wide rather than living inside the
// Social tab. It is never absence-framed: with nobody else checked in it reads
// as an open channel with a way to join, and it keeps a slow pulse either way
// so the system looks awake rather than broken.
function PresenceGauge({ onOpen }) {
  const { isSignedIn, user } = useUser();
  const displayName = useDisplayName();
  const [contacts, setContacts] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      if (isSignedIn && user?.id) await heartbeat({ userId: user.id, displayName });
      const rows = await fetchAllPresence(user?.id);
      if (live) setContacts(rows);
    };
    tick();
    const t = setInterval(tick, 45000);
    return () => { live = false; clearInterval(t); };
  }, [isSignedIn, user?.id, displayName]);

  const n = contacts.length;

  return (
    <div className={`pg ${expanded ? "is-open" : ""}`}>
      <button
        className="pg-dial"
        onClick={() => (n ? setExpanded((e) => !e) : onOpen?.())}
        aria-label={n ? `${n} studying now` : "Check in to open the channel"}
      >
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
          <circle className="pg-ring" cx="23" cy="23" r="20" fill="none" />
          <circle className="pg-ring" cx="23" cy="23" r="13" fill="none" />
          <g className="pg-sweep" style={{ transformOrigin: "23px 23px" }}>
            <path d="M23 23 L23 3 A20 20 0 0 1 40.3 13 Z" className="pg-wedge" />
          </g>
          {contacts.slice(0, 6).map((c, i) => {
            const seed = String(c.user_id || i).split("").reduce((h, ch) => ch.charCodeAt(0) + ((h << 5) - h), 0);
            const a = (Math.abs(seed) % 360) * (Math.PI / 180);
            const d = 0.35 + ((Math.abs(seed >> 3) % 55) / 100);
            return <circle key={c.user_id || i} className="pg-blip" cx={23 + Math.cos(a) * 18 * d} cy={23 + Math.sin(a) * 18 * d} r="2.4" />;
          })}
        </svg>
        <span className="pg-count">{n || "—"}</span>
      </button>

      {expanded && n > 0 && (
        <div className="pg-panel">
          <p className="pg-title">Studying now</p>
          <ul className="pg-list">
            {contacts.slice(0, 6).map((c) => (
              <li key={c.user_id}>
                <span className="pg-dot" aria-hidden="true" />
                {c.display_name || "Pilot"}
                <span className="pg-where">{c.module_code || ""}</span>
              </li>
            ))}
          </ul>
          <button className="pg-link" onClick={() => { setExpanded(false); onOpen?.(); }}>Open Social</button>
        </div>
      )}
      {!n && (
        <span className="pg-hint">Channel open — check in</span>
      )}

      <style>{`
        .pg { position: fixed; right: 18px; bottom: 60px; z-index: 30; display: flex; align-items: center; gap: 10px;
          flex-direction: row-reverse; }
        .pg-dial { position: relative; width: 54px; height: 54px; border-radius: 50%; border: 1px solid var(--border);
          background: radial-gradient(circle at 36% 28%, var(--elev-2), var(--well)); cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 4px var(--presence-glow);
          animation: pgBreathe 3.6s ease-in-out infinite; }
        @keyframes pgBreathe {
          0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 3px var(--presence-glow); }
          50%     { box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 8px var(--presence-glow); }
        }
        .pg-dial svg { position: absolute; inset: 4px; }
        .pg-ring { stroke: var(--border); stroke-width: 1; opacity: 0.75; }
        .pg-wedge { fill: var(--presence); opacity: 0.14; }
        .pg-sweep { animation: pgSpin 4.6s linear infinite; }
        @keyframes pgSpin { to { transform: rotate(360deg); } }
        .pg-blip { fill: var(--presence); }
        .pg-count { position: relative; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text);
          font-variant-numeric: tabular-nums; }
        .pg-hint { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--presence); background: var(--elev-1); border: 1px solid var(--border-soft);
          border-radius: var(--r-pill); padding: 5px 11px; white-space: nowrap; }
        .pg-panel { background: var(--elev-1); border: 1px solid var(--border); border-radius: var(--r-md);
          box-shadow: var(--shadow-2); padding: 13px 15px; min-width: 190px; }
        .pg-title { font-size: 11.5px; color: var(--muted); margin: 0 0 9px; }
        .pg-list { list-style: none; margin: 0 0 9px; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--text-soft); }
        .pg-list li { display: flex; align-items: center; gap: 8px; }
        .pg-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--presence); flex-shrink: 0; }
        .pg-where { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted2); }
        .pg-link { background: none; border: none; color: var(--accent); font-size: 12px; cursor: pointer; padding: 0; }
        @media (max-width: 640px) { .pg-hint { display: none; } .pg { right: 12px; bottom: 56px; } }
        .app.reduce-motion .pg-dial, .app.reduce-motion .pg-sweep { animation: none; }
        @media (prefers-reduced-motion: reduce) { .pg-dial, .pg-sweep { animation: none; } }
      `}</style>
    </div>
  );
}

export default PresenceGauge;
