import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { chaptersForModule } from "../data.js";
import { rankWingmen } from "../lib/matching.js";
import { fetchProfiles, fetchProfile, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §7.3 — below the feed. Matched by position in the material, never by profile.
// Shows at most three, because a longer list is a directory, not a suggestion.

const MAX = 3;

function OnYourWing({ moduleCode, people = [], myChapterId, onOpenPilot }) {
  const { user } = useUser();
  const [profiles, setProfiles] = useState({});
  const [studyTime, setStudyTime] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetchProfiles(people.map((p) => p.user_id)),
      user?.id ? fetchProfile(user.id) : Promise.resolve(null),
    ])
      .then(([m, mine]) => { if (live) { setProfiles(m); setStudyTime(mine?.study_time || null); } })
      .catch(() => {});
    return () => { live = false; };
  }, [people.map((p) => p.user_id).join(","), user?.id]);

  const order = chaptersForModule(moduleCode).map((c) => c.id);
  const enriched = people.map((p) => ({ ...p, study_time: profiles[p.user_id]?.study_time }));
  const ranked = rankWingmen(enriched, { userId: user?.id, chapterId: myChapterId, studyTime }, order).slice(0, MAX);

  if (!ranked.length) return null;

  const marked = assignMarkings(
    ranked.map((p) => ({
      ...p,
      callsign: profiles[p.user_id]?.callsign || p.display_name || "Pilot",
      livery: profiles[p.user_id]?.livery || "dawn-patrol",
      is_staff: profiles[p.user_id]?.is_staff || false,
      joined_at: p.last_seen || new Date(0).toISOString(),
    })),
    hueOf
  ).sort((a, b) => a.rung - b.rung);

  return (
    <section className="oyw" aria-label="On your wing">
      <h2 className="oyw-head">On your wing</h2>
      <ul className="oyw-list">
        {marked.map((p) => (
          <li key={p.user_id}>
            <button className="oyw-row" onClick={() => onOpenPilot?.(p)}>
              <Tail name={p.callsign} livery={p.livery} marking={p.marking} size={36} staff={p.is_staff} />
              <span className="oyw-text">
                <span className="oyw-name">{p.callsign}</span>
                {/* the reason is the whole point: never an unexplained suggestion */}
                <span className="oyw-why">{p.reason}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <TailStyles />
      <style>{`
        .oyw { margin: 28px 0 8px; }
        .oyw-head { font-family: var(--font-ui); font-size: 12px; color: var(--text-3); font-weight: 500; margin: 0 0 12px; }
        .oyw-list { list-style: none; margin: 0; padding: 0;
          display: grid; gap: 1px; background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .oyw-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px;
          min-height: 56px; background: var(--surface-1); border: none; text-align: left; cursor: pointer; }
        .oyw-row:hover { background: var(--surface-2); }
        .oyw-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .oyw-name { font-size: 16px; color: var(--text-1); }
        .oyw-why { font-size: 14px; color: var(--text-2); }
      `}</style>
    </section>
  );
}

export default OnYourWing;
