import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  fetchOpenFormation, fetchMembers, startFormation, joinFormation,
  leaveFormation, fetchChapterPositions,
} from "../lib/formation.js";
import { describePosition, formationCapacity } from "../lib/formationRail.js";
import { fetchProfiles, fetchSquadron, assignMarkings } from "../lib/squadron.js";
import { sendMessage, pinToChapter } from "../lib/comms.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §7.9 — a slim rail. Each participant's tail and where they are relative to
// you. Never a leaderboard, never a timer, never a score. Nobody loses a
// Formation, so nothing here ranks anyone or counts down.
//
// The chapter body it sits beside keeps the social-free rule: this is chrome
// around the body, not something inside it.

const POLL_MS = 30_000;

function Formation({ chapterId, chapterCode, moduleCode }) {
  const { user, isSignedIn } = useUser();
  const [formation, setFormation] = useState(null);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [positions, setPositions] = useState({});
  const [squadron, setSquadron] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!chapterId) return;
    const f = await fetchOpenFormation(chapterId);
    setFormation(f);
    if (!f) { setMembers([]); return; }
    const ms = await fetchMembers(f.id);
    setMembers(ms);
    const ids = ms.map((m) => m.user_id);
    const [profs, pos, sq] = await Promise.all([
      fetchProfiles(ids),
      fetchChapterPositions([...ids, user?.id], chapterId),
      user?.id ? fetchSquadron(user.id, moduleCode) : Promise.resolve(null),
    ]);
    setProfiles(profs); setPositions(pos); setSquadron(sq);
  }, [chapterId, moduleCode, user?.id]);

  useEffect(() => {
    load().catch(console.error);
    const t = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!isSignedIn || !chapterId) return null;

  const iAmIn = members.some((m) => m.user_id === user.id);
  const cap = formationCapacity(members.length);
  const mine = positions[user.id] ?? 0;

  const others = assignMarkings(
    members
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({
        ...m,
        callsign: profiles[m.user_id]?.callsign || "Pilot",
        livery: profiles[m.user_id]?.livery || "dawn-patrol",
        is_staff: profiles[m.user_id]?.is_staff || false,
        joined_at: m.joined_at,
      })),
    hueOf
  );

  const start = async () => {
    setBusy(true);
    await startFormation({ chapterId, moduleCode, squadronId: squadron?.id, userId: user.id });
    setBusy(false);
    load();
  };

  const join = async () => {
    setBusy(true);
    await joinFormation(formation.id, user.id);
    setBusy(false);
    load();
  };

  const leave = async () => {
    setBusy(true);
    if (note.trim()) {
      // §7.9 — leaves behind an optional pinned note in Comms.
      const msg = await sendMessage({
        moduleCode, squadronId: squadron?.id, userId: user.id, body: note.trim(), chapterId,
      });
      if (msg) await pinToChapter(msg.id, chapterId);
    }
    await leaveFormation(formation.id, user.id);
    setBusy(false);
    setLeaving(false);
    setNote("");
    load();
  };

  return (
    <aside
      className="fm"
      // §2.12 — Formation chrome wears the squadron's livery, scoped here so
      // the rest of the cockpit stays yours.
      data-livery={squadron?.livery || undefined}
      data-variant={squadron?.livery ? (document.documentElement.getAttribute("data-variant") || "night") : undefined}
    >
      {!formation ? (
        <button className="fm-cta" onClick={start} disabled={busy}>
          <span className="fm-cta-label">Fly {chapterCode} together</span>
          <span className="fm-cta-hint">Opens a session your squadron can join</span>
        </button>
      ) : (
        <>
          <header className="fm-head">
            <h2 className="fm-title">Formation · {chapterCode}</h2>
            <span className="fm-count">
              {cap.live ? `${cap.count} flying` : "Waiting for one more"}
            </span>
          </header>

          <ul className="fm-rail">
            {others.map((m) => (
              <li key={m.user_id} className="fm-seat">
                <Tail name={m.callsign} livery={m.livery} marking={m.marking} size={32} staff={m.is_staff} />
                <span className="fm-seat-text">
                  <span className="fm-seat-name">{m.callsign}</span>
                  <span className="fm-seat-pos">{describePosition(positions[m.user_id] ?? 0, mine)}</span>
                </span>
              </li>
            ))}
            {!others.length && <li className="fm-quiet">You opened it — the first person to join lands here.</li>}
          </ul>

          {!iAmIn ? (
            <button className="fm-join" onClick={join} disabled={busy || cap.full}>
              {cap.full ? "This one's full — start another" : "Join"}
            </button>
          ) : leaving ? (
            <div className="fm-leave">
              <textarea
                className="fm-note" rows={2} value={note}
                placeholder={`Leave a note pinned to ${chapterCode}? Optional.`}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="fm-leave-actions">
                <button className="fm-join" onClick={leave} disabled={busy}>Leave</button>
                <button className="fm-cancel" onClick={() => { setLeaving(false); setNote(""); }}>Stay</button>
              </div>
            </div>
          ) : (
            <button className="fm-cancel" onClick={() => setLeaving(true)}>Leave formation</button>
          )}
        </>
      )}

      <TailStyles />
      <style>{`
        .fm { border-radius: 14px; background: var(--surface-1); padding: 12px 14px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow: inset 3px 0 0 var(--warm); }
        .fm-cta { display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          background: none; border: none; padding: 4px 0; cursor: pointer;
          text-align: left; min-height: 44px; }
        .fm-cta-label { font-size: 15px; color: var(--text-1); }
        .fm-cta-hint { font-size: 13px; color: var(--text-3); }

        .fm-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .fm-title { font-family: var(--font-ui); font-size: 15px; font-weight: 500; color: var(--text-1); margin: 0; }
        /* a headcount, not a rank */
        .fm-count { font-family: var(--font-mono); font-size: 12px; color: var(--text-2);
          font-variant-numeric: tabular-nums; }

        .fm-rail { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .fm-seat { display: flex; align-items: center; gap: 10px; }
        .fm-seat-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .fm-seat-name { font-size: 14px; color: var(--text-1); }
        .fm-seat-pos { font-size: 12px; color: var(--text-2); }
        .fm-quiet { font-size: 13px; color: var(--text-3); }

        .fm-join { min-height: 44px; padding: 0 14px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-size: 15px; font-weight: 500; }
        .fm-join:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }
        .fm-cancel { min-height: 44px; padding: 0 12px; border: none; border-radius: 12px; cursor: pointer;
          background: none; color: var(--text-3); font-size: 14px; align-self: flex-start; }
        .fm-note { width: 100%; resize: vertical; min-height: 56px; padding: 10px 12px; border: none;
          border-radius: 10px; background: var(--surface-2); color: var(--text-1);
          font-family: var(--font-ui); font-size: 14px; line-height: 1.5; }
        .fm-note:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .fm-leave-actions { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
      `}</style>
    </aside>
  );
}

export default Formation;
