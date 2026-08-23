import { GraduationCap, Layers, BookMarked, Radio } from "lucide-react";

// §2.3 — four destinations, persistent. The avatar menu holds only profile,
// settings and sign out; Logbook and Saved came out of it (§9.6).
//
// §12 — on phone this is a bottom tab bar, and Study and Ready Room are the
// thumb poles: the academic side and the social side at opposite ends, which is
// the §2 split made physical.

const DESTINATIONS = [
  { id: "home",    label: "Study",      icon: GraduationCap },
  { id: "modules", label: "Modules",    icon: Layers },
  { id: "logbook", label: "Logbook",    icon: BookMarked },
  { id: "ready",   label: "Ready Room", icon: Radio },
];

function RootNav({ current, onGo, readyWarm = false }) {
  return (
    <nav className="rootnav" aria-label="Main">
      <ul>
        {DESTINATIONS.map((d) => (
          <li key={d.id}>
            <button
              className={`rootnav-item ${current === d.id ? "is-current" : ""} ${d.id === "ready" && readyWarm ? "is-warm" : ""}`}
              aria-current={current === d.id ? "page" : undefined}
              onClick={() => onGo(d.id)}
            >
              <d.icon size={18} aria-hidden="true" />
              <span>{d.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .rootnav ul { list-style: none; margin: 0; padding: 0; display: flex; }
        .rootnav-item { display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-height: 44px; padding: 0 12px; background: none; border: none;
          cursor: pointer; color: var(--text-secondary); font-size: 14px; border-radius: var(--r-control); }
        .rootnav-item:hover { color: var(--text-primary); background: var(--bg-raised); }
        /* §4.5's doctrine applied to navigation: current is lit, not coloured. */
        .rootnav-item.is-current { color: var(--text-primary); }
        /* §4.4 — the Ready Room door warms when people are in there, and only
           then. Neutral when nobody is. */
        .rootnav-item.is-warm { background: var(--presence-panel); color: var(--text-primary); }

        @media (max-width: 640px) {
          /* §12 — bottom tab bar, thumb poles at the ends. */
          .rootnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
            background: var(--bg-panel); box-shadow: inset 0 1px 0 var(--hairline-bevel);
            padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); }
          .rootnav ul { justify-content: space-between; }
          .rootnav-item { flex-direction: column; gap: 3px; min-height: 52px; font-size: 12px; }
        }
        @media (min-width: 641px) {
          .rootnav ul { gap: 2px; }
          .rootnav-item { width: auto; }
        }
      `}</style>
    </nav>
  );
}

export default RootNav;
