import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchBlocks, fetchMutes, unblockUser, unmuteUser, fetchProfiles } from "../lib/squadron.js";
import Tail, { TailStyles } from "./Tail.jsx";

// §9 — the pilot sheet tells people they can undo a block in Settings, so this
// has to exist for that sentence to be true.

function Row({ id, profile, action, onAct, busy }) {
  const name = profile?.callsign || "A pilot";
  return (
    <li className="bl-row">
      <Tail name={name} livery={profile?.livery} marking="solid" size={36} staff={profile?.is_staff} />
      <span className="bl-name">{name}</span>
      <button className="bl-undo" disabled={busy} onClick={() => onAct(id)}>{action}</button>
    </li>
  );
}

function BlockedList() {
  const { user } = useUser();
  const [blocks, setBlocks] = useState([]);
  const [mutes, setMutes] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [b, m] = await Promise.all([fetchBlocks(user.id), fetchMutes(user.id)]);
    setBlocks(b); setMutes(m);
    setProfiles(await fetchProfiles([...b, ...m]));
    setLoaded(true);
  }, [user?.id]);

  useEffect(() => { load().catch(() => setLoaded(true)); }, [load]);

  const act = async (fn, id, setList) => {
    setBusy(true);
    setList((l) => l.filter((x) => x !== id));   // optimistic
    try { await fn(user.id, id); } catch (e) { console.error(e); await load(); }
    setBusy(false);
  };

  if (!loaded) return null;

  return (
    <section className="bl">
      <h2 className="bl-head">Blocked and muted</h2>
      {!blocks.length && !mutes.length ? (
        // §10 — no zero. This one is genuinely good news, so it says so.
        <p className="bl-quiet">Nobody yet. Block or mute anyone from their tail, and they'll be listed here to undo.</p>
      ) : (
        <>
          {blocks.length > 0 && (
            <>
              <p className="bl-kind">Blocked · you disappear from each other</p>
              <ul className="bl-list">
                {blocks.map((id) => (
                  <Row key={id} id={id} profile={profiles[id]} action="Unblock" busy={busy}
                    onAct={(x) => act(unblockUser, x, setBlocks)} />
                ))}
              </ul>
            </>
          )}
          {mutes.length > 0 && (
            <>
              <p className="bl-kind">Muted in Comms · they aren't told</p>
              <ul className="bl-list">
                {mutes.map((id) => (
                  <Row key={id} id={id} profile={profiles[id]} action="Unmute" busy={busy}
                    onAct={(x) => act(unmuteUser, x, setMutes)} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <TailStyles />
      <style>{`
        .bl { margin: 28px 0 0; }
        .bl-head { font-family: var(--font-ui); font-size: 17px; font-weight: 500;
          color: var(--text-1); margin: 0 0 8px; }
        .bl-quiet { font-size: 14px; line-height: 1.5; color: var(--text-2); margin: 0; max-width: 52ch; }
        .bl-kind { font-family: var(--font-ui); font-size: 12px; color: var(--text-3); margin: 16px 0 8px; }
        .bl-list { list-style: none; margin: 0; padding: 0;
          display: grid; gap: 1px; background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .bl-row { display: flex; align-items: center; gap: 12px; padding: 8px 14px;
          min-height: 56px; background: var(--surface-1); }
        .bl-name { flex: 1; font-size: 16px; color: var(--text-1); min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bl-undo { min-height: 44px; padding: 0 14px; border: none; border-radius: 8px;
          background: var(--surface-2); color: var(--text-1); font-size: 14px; cursor: pointer; }
        .bl-undo:disabled { color: var(--text-3); cursor: default; }
      `}</style>
    </section>
  );
}

export default BlockedList;
