import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, CHAPTERS, chaptersForModule } from "../data.js";
import { fetchAllPresence } from "../lib/presence.js";
import { fetchProfiles, assignMarkings } from "../lib/squadron.js";
import {
  fetchOpenSquawks, fetchMyTeams, fetchTeamMembers, createTeam, leaveTeam,
  fetchProgressByModule, socialEnabledModules,
  fetchFormations, joinFormation,
} from "../lib/readyRoom.js";
import { rankPartners, partnerReason, teamCapacity, TEAM_MIN } from "../lib/teams.js";
import { SQUAWK_LABEL } from "../lib/questions.js";
import { visibleFormations, formationLabel, FORMATION_MAX } from "../lib/formation.js";
import Tail, { TailStyles } from "./Tail.jsx";
import Comms from "./Comms.jsx";

// §9.4 — a room, not a feed. Present tense only: feeds are graveyards at low
// density. One scroll, four bands, in the order the door was opened for.
//
// §7 — the warm register. Lights on, faces everywhere, relative time,
// conversational copy. Crossing the door should read as a change in
// temperature, not a change in identity.

const moduleName = (code) => MODULES.find((m) => m.code === code)?.name || code;
const chapterCode = (id) => CHAPTERS.find((c) => c.id === id)?.code || null;
const ago = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

function ReadyRoom({ moduleCode, onGoToChapter, onOpenChannel }) {
  const { user, isSignedIn } = useUser();
  const [here, setHere] = useState([]);
  const [squawks, setSquawks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamRosters, setTeamRosters] = useState({});
  const [partners, setPartners] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [enabled, setEnabled] = useState(null);
  const [newTeam, setNewTeam] = useState("");
  const [busy, setBusy] = useState(false);
  const [formations, setFormations] = useState([]);

  const load = useCallback(async () => {
    const totals = Object.fromEntries(MODULES.map((m) => [m.code, chaptersForModule(m.code).length]));
    const [presence, sq, myTeams, on, fms] = await Promise.all([
      fetchAllPresence(user?.id),
      fetchOpenSquawks(user?.id, moduleCode),
      isSignedIn ? fetchMyTeams(user.id) : Promise.resolve([]),
      socialEnabledModules(),
      fetchFormations(moduleCode),
    ]);
    // A user can appear in presence more than once (two tabs, a stale row).
    // One face each.
    const uniqueHere = [];
    const seenHere = new Set();
    for (const p of presence || []) {
      if (seenHere.has(p.user_id)) continue;
      seenHere.add(p.user_id);
      uniqueHere.push(p);
    }
    setHere(uniqueHere);
    setSquawks(sq || []);
    setTeams(myTeams || []);
    setEnabled(on);
    // §9.4.3 — never render a formation nobody is in. The filter is a property
    // of the data, not something each surface remembers to apply.
    setFormations(visibleFormations(fms || []));

    const rosters = {};
    for (const t of myTeams || []) rosters[t.id] = await fetchTeamMembers(t.id);
    setTeamRosters(rosters);

    const ids = [
      ...uniqueHere.map((p) => p.user_id),
      ...(fms || []).flatMap((f) => (f.members || []).map((m) => m.user_id)),
      ...(sq || []).map((s) => s.user_id),
      ...Object.values(rosters).flat().map((m) => m.user_id),
    ];
    setProfiles(await fetchProfiles(ids));

    // §9.4 — matched on complementary strengths, not similar ones. Two people
    // stuck on the same thing have no reason to talk.
    if (isSignedIn && uniqueHere.length) {
      const candidateIds = [...new Set(uniqueHere.map((p) => p.user_id))].filter((id) => id !== user.id);
      const progress = await fetchProgressByModule([...candidateIds, user.id], totals);
      setPartners(
        rankPartners(candidateIds.map((id) => ({ id, progress: progress[id] || {} })), progress[user.id] || {})
      );
    }
  }, [user?.id, isSignedIn, moduleCode]);

  useEffect(() => { load().catch(console.error); }, [load]);

  const marked = Object.fromEntries(
    assignMarkings(
      Object.values(profiles).map((p) => ({ ...p, joined_at: p.created_at || new Date(0).toISOString() }))
    ).map((p) => [p.user_id, p])
  );
  const who = (id) => marked[id] || { user_id: id, callsign: "Pilot", marking: "solid" };

  // §10 — a module with no social surface is fine; one with a visibly abandoned
  // surface is not. `enabled` is null when the table is missing, in which case
  // every channel shows rather than none.
  const channels = MODULES.filter((m) => !enabled || enabled.has(m.code));

  return (
    <div className="rr">
      <header className="rr-head">
        <h1 className="rr-title">Ready Room{moduleCode ? ` · ${moduleCode}` : ""}</h1>
        {/* §9.4.4 — set the norm in one line. */}
        <p className="rr-norm">Nobody here has it figured out yet. Ask the dumb question.</p>
      </header>

      {/* 1 · Now — who's on frequency. Top of the room because it is the reason
          the door was opened. */}
      <section className="rr-band">
        <h2 className="rr-h2">Now</h2>
        {here.length ? (
          <ul className="rr-now">
            {here.map((p) => (
              <li key={p.user_id}>
                <button className="rr-face" onClick={() => p.chapter_id && onGoToChapter?.(p.module_code, p.chapter_id)}>
                  <Tail name={who(p.user_id).callsign}
                    marking={who(p.user_id).marking} size={40} staff={who(p.user_id).is_staff} />
                  <span className="rr-face-name">{who(p.user_id).callsign}</span>
                  <span className="rr-face-where">{chapterCode(p.chapter_id) || p.module_code}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rr-quiet">Quiet right now. Answer a squawk below and you'll be the reason someone comes back.</p>
        )}
      </section>

      {/* §9.4 band 1 also asks what's starting. §9.4.3: 2-4 pilots, one
          chapter, one session, and the room dies when it empties. */}
      {formations.length > 0 && (
        <section className="rr-band">
          <h2 className="rr-h2">Starting</h2>
          <ul className="rr-formations">
            {formations.map((f) => (
              <li key={f.id}>
                <span className="rr-formation-where">{chapterCode(f.chapter_id) || f.module_code}</span>
                <span className="rr-formation-when">{formationLabel(f)}</span>
                <span className="rr-formation-faces">
                  {f.members.map((m) => (
                    <Tail key={m.user_id} name={who(m.user_id).callsign}
                      marking={who(m.user_id).marking} size={24} />
                  ))}
                </span>
                <button
                  className="rr-formation-join" disabled={busy || f.full || f.members.some((m) => m.user_id === user?.id)}
                  onClick={async () => { setBusy(true); await joinFormation(f.id, user.id); setBusy(false); load(); }}
                >
                  {f.members.some((m) => m.user_id === user?.id) ? "You're in"
                    : f.full ? `Full at ${FORMATION_MAX}` : "Join"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2 · Open squawks — the room's purpose. A permanent supply of ways to be
          useful, and the reason it is never empty. */}
      <section className="rr-band">
        <h2 className="rr-h2">Open squawks</h2>
        {squawks.length ? (
          <ul className="rr-squawks">
            {squawks.map((s) => (
              <li key={s.id}>
                <button className="rr-squawk" onClick={() => onGoToChapter?.(s.module_code, s.chapter_id, "comments")}>
                  <span className="rr-squawk-top">
                    <Tail name={who(s.user_id).callsign}
                      marking={who(s.user_id).marking} size={26} />
                    <span className="rr-squawk-who">{who(s.user_id).callsign}</span>
                    <span className="rr-squawk-where">{chapterCode(s.chapter_id) || s.module_code}</span>
                    <span className="rr-squawk-when">{ago(s.created_at)}</span>
                  </span>
                  {s.squawk && <span className="rr-code">{s.squawk} · {SQUAWK_LABEL[s.squawk]}</span>}
                  <span className="rr-squawk-body">{s.body}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          // §9.4.4 — a risk-free first action, named.
          <p className="rr-quiet">
            Nothing waiting. When someone marks a question in a chapter and it goes
            unanswered, it lands here.
          </p>
        )}
      </section>

      {/* 3 · Your crew */}
      <section className="rr-band">
        <h2 className="rr-h2">Your crew</h2>

        {teams.map((t) => {
          const roster = teamRosters[t.id] || [];
          const cap = teamCapacity(roster.length);
          return (
            <div key={t.id} className="rr-team">
              <p className="rr-team-name">
                {t.name}
                <span className="rr-team-count">
                  {cap.forming ? `${cap.count} of ${TEAM_MIN} to get going` : `${cap.count} flying`}
                </span>
              </p>
              <ul className="rr-team-roster">
                {roster.map((m) => (
                  <li key={m.user_id}>
                    <Tail name={who(m.user_id).callsign}
                      marking={who(m.user_id).marking} size={28} staff={who(m.user_id).is_staff} />
                    <span>{who(m.user_id).callsign}</span>
                  </li>
                ))}
              </ul>
              <button className="rr-quiet-btn" disabled={busy}
                onClick={async () => { setBusy(true); await leaveTeam(t.id, user.id); setBusy(false); load(); }}>
                Leave
              </button>
            </div>
          );
        })}

        {isSignedIn && (
          <div className="rr-newteam">
            <label className="rr-label" htmlFor="rr-team-name">Start a team</label>
            <div className="rr-newteam-row">
              <input id="rr-team-name" className="rr-input" value={newTeam} maxLength={40}
                placeholder="Three to six people, one name"
                onChange={(e) => setNewTeam(e.target.value)} />
              <button className="rr-go" disabled={!newTeam.trim() || busy}
                onClick={async () => {
                  setBusy(true);
                  await createTeam({ name: newTeam, moduleCode, userId: user.id });
                  setNewTeam(""); setBusy(false); load();
                }}>Create</button>
            </div>
          </div>
        )}

        {partners.length > 0 && (
          <div className="rr-partners">
            <p className="rr-label">On your wing</p>
            <ul>
              {partners.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <Tail name={who(p.id).callsign}
                    marking={who(p.id).marking} size={28} staff={who(p.id).is_staff} />
                  <span className="rr-partner-text">
                    <span className="rr-partner-name">{who(p.id).callsign}</span>
                    {/* the reason, never a score and never a ranking of people */}
                    <span className="rr-partner-why">{partnerReason(p)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 4 · Module channels — broader than a chapter: exam strategy, resources,
          how the test went, morale. */}
      <section className="rr-band">
        <h2 className="rr-h2">Channels</h2>
        {moduleCode ? (
          <>
            <button className="rr-channel-back" onClick={() => onOpenChannel?.(null)}>
              ← All channels
            </button>
            <Comms moduleCode={moduleCode} />
          </>
        ) : (
          <ul className="rr-channels">
            {channels.map((m) => (
              <li key={m.code}>
                <button className="rr-channel" onClick={() => onOpenChannel?.(m.code)}>
                  <span className="rr-channel-code">{m.code}</span>
                  <span className="rr-channel-name">{moduleName(m.code)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TailStyles />
      <style>{`
        /* §7 — the Ready Room's ground is one step lighter than the academic
           side and shifted toward the presence temperature. Lights on. */
        .rr { background: var(--presence-ground); margin: -16px -16px 0; padding: 20px 16px 48px;
          display: flex; flex-direction: column; gap: 28px; min-height: 100%; }
        .rr-head { display: flex; flex-direction: column; gap: 4px; }
        .rr-title { font-size: 20px; font-weight: 500; color: var(--text-primary); margin: 0; }
        .rr-norm { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .rr-band { display: flex; flex-direction: column; gap: 10px; }
        .rr-h2 { font-size: 14px; font-weight: 500; color: var(--text-secondary); margin: 0; }
        .rr-quiet { font-size: 16px; line-height: 1.55; color: var(--text-secondary); margin: 0; max-width: 52ch; }
        .rr-label { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .rr-now { list-style: none; display: flex; gap: 4px; margin: 0; padding: 0 0 4px;
          overflow-x: auto; scrollbar-width: none; }
        .rr-now::-webkit-scrollbar { display: none; }
        .rr-face { display: flex; flex-direction: column; align-items: center; gap: 6px;
          min-width: 72px; min-height: 44px; padding: 4px 6px; background: none; border: none; cursor: pointer; }
        .rr-face-name { font-size: 12px; color: var(--text-secondary); max-width: 72px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rr-face-where { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); }

        .rr-formations { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: var(--r-panel); overflow: hidden; }
        .rr-formations li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 10px 14px; background: var(--bg-panel); min-height: 56px; }
        .rr-formation-where { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); }
        .rr-formation-when { font-size: 14px; color: var(--text-secondary); }
        .rr-formation-faces { display: flex; gap: 4px; margin-left: auto; }
        .rr-formation-join { min-height: 44px; padding: 0 12px; border: none; border-radius: var(--r-control);
          background: var(--accent-interactive); color: var(--bg-ground); font-size: 14px;
          font-weight: 500; cursor: pointer; }
        .rr-formation-join:disabled { background: var(--bg-raised); color: var(--text-tertiary); cursor: default; }
        .rr-squawks { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: var(--r-panel); overflow: hidden; }
        .rr-squawk { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 12px 14px;
          background: var(--bg-panel); border: none; text-align: left; cursor: pointer; }
        .rr-squawk:hover { background: var(--bg-raised); }
        .rr-squawk-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rr-squawk-who { font-size: 14px; color: var(--text-primary); }
        .rr-squawk-where { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); }
        .rr-squawk-when { font-size: 12px; color: var(--text-tertiary); margin-left: auto; }
        .rr-squawk-body { font-size: 16px; line-height: 1.5; color: var(--text-primary); }
        .rr-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary); }

        .rr-team { background: var(--bg-panel); border-radius: var(--r-panel); padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .rr-team-name { font-size: 16px; color: var(--text-primary); margin: 0;
          display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
        .rr-team-count { font-size: 14px; color: var(--text-secondary); }
        .rr-team-roster { list-style: none; margin: 0; padding: 0; display: flex; gap: 12px; flex-wrap: wrap; }
        .rr-team-roster li { display: flex; align-items: center; gap: 6px;
          font-size: 14px; color: var(--text-secondary); }

        .rr-newteam { display: flex; flex-direction: column; gap: 8px; }
        .rr-newteam-row { display: flex; gap: 8px; }
        .rr-input { flex: 1; min-height: 44px; padding: 0 12px; border: none;
          border-radius: var(--r-control); background: var(--bg-raised);
          color: var(--text-primary); font-size: 16px; }
        .rr-input:focus { outline: 2px solid var(--accent-interactive); outline-offset: -1px; }
        .rr-go { min-height: 44px; padding: 0 16px; border: none; border-radius: var(--r-control);
          background: var(--accent-interactive); color: var(--bg-ground); font-size: 16px;
          font-weight: 500; cursor: pointer; }
        .rr-go:disabled { background: var(--bg-raised); color: var(--text-tertiary); cursor: default; }
        .rr-quiet-btn { min-height: 44px; padding: 0 12px; border: none; border-radius: var(--r-control);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; }

        .rr-partners ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: var(--r-panel); overflow: hidden; }
        .rr-partners li { display: flex; align-items: center; gap: 10px; padding: 10px 14px;
          background: var(--bg-panel); }
        .rr-partner-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .rr-partner-name { font-size: 16px; color: var(--text-primary); }
        .rr-partner-why { font-size: 14px; color: var(--text-secondary); }

        .rr-channel-back { align-self: flex-start; min-height: 44px; padding: 0 10px; border: none;
          border-radius: var(--r-control); background: none; color: var(--text-secondary);
          font-size: 14px; cursor: pointer; }
        .rr-channels { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: var(--r-panel); overflow: hidden; }
        .rr-channel { display: flex; align-items: baseline; gap: 12px; width: 100%; min-height: 56px;
          padding: 0 14px; background: var(--bg-panel); border: none; text-align: left; cursor: pointer; }
        .rr-channel:hover { background: var(--bg-raised); }
        .rr-channel-code { font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); width: 46px; }
        .rr-channel-name { font-size: 16px; color: var(--text-primary); }
      `}</style>
    </div>
  );
}

export default ReadyRoom;
