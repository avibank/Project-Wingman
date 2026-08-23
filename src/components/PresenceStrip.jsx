import { useEffect, useState } from "react";
import { CHAPTERS, chaptersForModule } from "../data.js";
import { fetchProfiles, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §7.3 — the rail of who is flying right now. Each face wears its owner's tail
// with a mono chapter code beneath, because "who" and "where" are one glance.
//
// This reads the Postgres `presence` table, which §8.3 rules out for the final
// design. It stays until there is a Redis-backed endpoint to replace it; the
// component's shape does not depend on where the rows come from.

function PresenceStrip({ people = [], moduleCode = null, onOpenPilot }) {
  // Resolve the chapter inside this module's partition when there is one. A
  // rail on a module page must never print another module's code, whatever a
  // stray presence row claims.
  const scope = moduleCode ? chaptersForModule(moduleCode) : CHAPTERS;
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    let live = true;
    fetchProfiles(people.map((p) => p.user_id))
      .then((m) => live && setProfiles(m))
      .catch(() => {});
    return () => { live = false; };
  }, [people.map((p) => p.user_id).join(",")]);

  if (!people.length) return null;

  const marked = assignMarkings(
    people.map((p) => ({
      ...p,
      callsign: profiles[p.user_id]?.callsign || p.display_name || "Pilot",
      livery: profiles[p.user_id]?.livery || "dawn-patrol",
      is_staff: profiles[p.user_id]?.is_staff || false,
      joined_at: p.last_seen || new Date(0).toISOString(),
    })),
    hueOf
  );

  return (
    <section className="pstrip" aria-label="Flying now">
      <h2 className="pstrip-head">
        <span className="pstrip-live" aria-hidden="true" />
        Flying now
      </h2>
      <ul className="pstrip-rail">
        {marked.map((p) => {
          const ch = scope.find((c) => c.id === p.chapter_id);
          return (
            <li key={p.user_id} className="pstrip-item">
              <button className="pstrip-btn" onClick={() => onOpenPilot?.(p)}>
                <Tail name={p.callsign} livery={p.livery} marking={p.marking} size={40} staff={p.is_staff} />
                <span className="pstrip-name">{p.callsign}</span>
                {/* §13 — the code is the readout; presence is never colour alone */}
                {/* No dash for a pilot whose chapter is outside this
                    module — the rail simply says nothing about where. */}
                {ch && <span className="pstrip-code">{ch.code}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <TailStyles />
      <style>{`
        .pstrip { margin: 0 0 20px; }
        .pstrip-head { display: flex; align-items: center; gap: 7px; margin: 0 0 12px;
          font-family: var(--font-ui); font-size: 12px; color: var(--text-3); font-weight: 500; }
        /* §2.2 — glow is reserved for presence. This is one of the two places it earns its keep. */
        .pstrip-live { width: 6px; height: 6px; border-radius: 50%; background: var(--warm);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--warm) 22%, transparent); }
        .pstrip-rail { list-style: none; display: flex; gap: 4px; margin: 0; padding: 0 0 4px;
          overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; }
        .pstrip-rail::-webkit-scrollbar { display: none; }
        .pstrip-item { scroll-snap-align: start; }
        .pstrip-btn { display: flex; flex-direction: column; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer; padding: 4px 6px; min-width: 68px; min-height: 44px; }
        .pstrip-name { font-size: 12px; color: var(--text-2); max-width: 68px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pstrip-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-2);
          font-variant-numeric: tabular-nums; }
        .pstrip-btn:hover .pstrip-name { color: var(--text-1); }
        @media (prefers-reduced-motion: reduce) { .pstrip-live { box-shadow: none; outline: 2px solid var(--warm); outline-offset: 1px; } }
      `}</style>
    </section>
  );
}

export default PresenceStrip;
