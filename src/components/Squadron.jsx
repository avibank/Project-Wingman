import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchSquadron, fetchRoster, seatLayout, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §7.1 — a squadron below ten is Forming, and says so. It shows its real
// members at full size rather than padding the grid, and open seats render as
// outlined silhouettes. Nothing here is ever filled with a fabricated pilot.

function OpenSeat() {
  return (
    <li className="seat is-open">
      <span className="seat-ghost" aria-hidden="true" />
      <span className="seat-name">open</span>
    </li>
  );
}

function Squadron({ moduleCode, onOpenPilot }) {
  const { user, isSignedIn } = useUser();
  const [state, setState] = useState({ status: "loading", squadron: null, roster: [] });

  useEffect(() => {
    if (!isSignedIn || !user?.id || !moduleCode) return;
    let live = true;
    (async () => {
      const squadron = await fetchSquadron(user.id, moduleCode);
      if (!live) return;
      if (!squadron) { setState({ status: "none", squadron: null, roster: [] }); return; }
      const roster = await fetchRoster(user.id, squadron.id);
      if (!live) return;
      setState({ status: "ready", squadron, roster: assignMarkings(roster || [], hueOf) });
    })().catch(() => live && setState({ status: "error", squadron: null, roster: [] }));
    return () => { live = false; };
  }, [isSignedIn, user?.id, moduleCode]);

  if (state.status === "loading") return <div className="sq-quiet">Finding your squadron…</div>;

  // Failing soft matters here: until migration 0005 runs, every one of these
  // reads returns nothing. The surface must still say what to do next.
  if (state.status !== "ready") {
    return (
      <div className="sq">
        <p className="sq-quiet">
          Pick a module and a study time and we'll put you with pilots flying the same material.
        </p>
        <SquadronStyles />
      </div>
    );
  }

  const seats = seatLayout(state.roster);

  return (
    <div className="sq">
      <div className="sq-head">
        <h2 className="sq-title">Your squadron</h2>
        <span className="sq-count">{seats.filled} of {seats.target}</span>
      </div>

      {seats.forming && <p className="sq-forming">{seats.label}</p>}

      <ul className="sq-grid">
        {state.roster.map((m) => (
          <li key={m.user_id} className="seat">
            <button className="seat-btn" onClick={() => onOpenPilot?.(m)}>
              <Tail name={m.callsign} livery={m.livery} marking={m.marking} size={44} staff={m.is_staff} />
              <span className="seat-name">{m.callsign || "Pilot"}</span>
            </button>
          </li>
        ))}
        {Array.from({ length: seats.openSeats }, (_, i) => <OpenSeat key={`open-${i}`} />)}
      </ul>

      <SquadronStyles />
    </div>
  );
}

function SquadronStyles() {
  return (
    <>
      <TailStyles />
      <style>{`
        .sq { padding: 4px 0 8px; }
        .sq-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
        .sq-title { font-family: var(--font-ui); font-size: 17px; font-weight: 500; color: var(--text-1); margin: 0; }
        .sq-count { font-family: var(--font-mono); font-size: 13px; color: var(--text-3); font-variant-numeric: tabular-nums; }
        .sq-forming { font-size: 14px; line-height: 1.5; color: var(--text-2); margin: 0 0 16px; max-width: 52ch; }
        .sq-quiet { font-size: 14px; line-height: 1.5; color: var(--text-2); margin: 0; max-width: 52ch; }

        .sq-grid { list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 16px 8px; }
        .seat { display: flex; }
        .seat-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%;
          background: none; border: none; padding: 6px 2px; cursor: pointer; min-height: 44px; }
        .seat-name { font-size: 12px; color: var(--text-3); max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seat-btn:hover .seat-name { color: var(--text-1); }

        .seat.is-open { flex-direction: column; align-items: center; gap: 8px; padding: 6px 2px; }
        .seat-ghost { width: 44px; height: 44px; border-radius: 50%;
          border: 1px dashed var(--hairline); }
      `}</style>
    </>
  );
}

export default Squadron;
