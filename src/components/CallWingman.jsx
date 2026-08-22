import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  createCall, fetchMyCalls, fetchResponses, postCallToComms, callState,
} from "../lib/calls.js";
import { fetchProfiles, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §7.7 — not "Mayday". A soft, non-urgent signal with the question attached.
// The aviation flavour is the motion: one warm sweep going outward, once.

function CallWingman({ chapterId, chapterCode, moduleCode, questionId = null }) {
  const { user, isSignedIn } = useUser();
  const [call, setCall] = useState(null);
  const [responses, setResponses] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [mode, setMode] = useState("idle");   // idle | composing | sent
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !chapterId) return;
    const mine = await fetchMyCalls(user.id, chapterId);
    const latest = mine.find((c) => c.status !== "posted") || mine[0] || null;
    setCall(latest);
    if (latest) {
      const rs = await fetchResponses(latest.id);
      setResponses(rs);
      setProfiles(await fetchProfiles(rs.map((r) => r.user_id)));
    } else {
      setResponses([]);
    }
  }, [user?.id, chapterId]);

  useEffect(() => { load().catch(console.error); }, [load]);

  const send = async () => {
    setBusy(true);
    setSweeping(true);
    const made = await createCall({
      userId: user.id, chapterId, questionId, body: note.trim() || null,
    });
    setBusy(false);
    if (made) { setCall(made); setMode("sent"); setNote(""); }
    // The sweep is the confirmation, so it runs whether or not the row landed;
    // a failed insert still shows the honest state below.
    setTimeout(() => setSweeping(false), 900);
  };

  if (!isSignedIn || !chapterId) return null;

  const state = callState(call, responses.length);
  const answered = assignMarkings(
    responses.map((r) => ({
      ...r,
      user_id: r.user_id,
      callsign: profiles[r.user_id]?.callsign || "A pilot",
      livery: profiles[r.user_id]?.livery || "dawn-patrol",
      is_staff: profiles[r.user_id]?.is_staff || false,
      joined_at: r.created_at,
    })),
    hueOf
  );

  return (
    <section className="cw">
      {!call && mode === "idle" && (
        <button className="cw-open" onClick={() => setMode("composing")}>
          <span className="cw-open-label">Call a wingman</span>
          <span className="cw-open-hint">Someone in your squadron who's flown {chapterCode}</span>
        </button>
      )}

      {!call && mode === "composing" && (
        <div className="cw-compose">
          <label className="cw-label" htmlFor="cw-note">What's the sticking point?</label>
          <textarea
            id="cw-note" className="cw-note" rows={3} value={note}
            placeholder={`Anything you say here goes out with ${chapterCode}. Optional.`}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cw-actions">
            <button className="cw-send" onClick={send} disabled={busy}>
              {busy ? "Going out…" : "Send the call"}
            </button>
            <button className="cw-cancel" onClick={() => { setMode("idle"); setNote(""); }}>Not now</button>
          </div>
        </div>
      )}

      {state === "waiting" && (
        <p className="cw-state">
          Your call is out with {chapterCode}. We'll widen it if nobody picks it up.
        </p>
      )}

      {state === "answered" && (
        <div className="cw-answers">
          <p className="cw-state">Someone came back to you.</p>
          {answered.map((r) => (
            <div key={r.id} className="cw-answer">
              <Tail name={r.callsign} livery={r.livery} marking={r.marking} size={32} staff={r.is_staff} />
              <span className="cw-answer-body">{r.body}</span>
            </div>
          ))}
        </div>
      )}

      {/* §7.7 stage 3 — never let a call silently expire. */}
      {state === "unanswered" && (
        <div className="cw-stale">
          <p className="cw-state">Nobody's picked this up yet. Want it in front of the whole module?</p>
          <button className="cw-send" disabled={busy} onClick={async () => {
            setBusy(true);
            await postCallToComms(call, moduleCode);
            setBusy(false);
            load();
          }}>Post it to Comms</button>
        </div>
      )}

      {state === "posted" && <p className="cw-state">It's in Comms now.</p>}

      {/* one warm sweep, outward, once */}
      {sweeping && <span className="cw-sweep" aria-hidden="true" />}

      <TailStyles />
      <style>{`
        .cw { position: relative; margin: 20px 0 0; }
        .cw-open { display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          width: 100%; min-height: 60px; padding: 12px 16px; border: none; border-radius: 14px;
          background: var(--surface-1); cursor: pointer; text-align: left;
          box-shadow: inset 3px 0 0 var(--warm); }
        .cw-open:hover { background: var(--surface-2); }
        .cw-open-label { font-size: 15px; color: var(--text-1); }
        .cw-open-hint { font-size: 13px; color: var(--text-3); }

        .cw-compose { padding: 14px; border-radius: 14px; background: var(--surface-1); }
        .cw-label { display: block; font-size: 14px; color: var(--text-2); margin-bottom: 8px; }
        .cw-note { width: 100%; resize: vertical; min-height: 72px; padding: 10px 12px;
          border: none; border-radius: 10px; background: var(--surface-2); color: var(--text-1);
          font-family: var(--font-ui); font-size: 15px; line-height: 1.5; }
        .cw-note:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .cw-actions { display: flex; gap: 8px; margin-top: 12px; }
        .cw-send { min-height: 44px; padding: 0 16px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-size: 15px; font-weight: 500; }
        .cw-send:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }
        .cw-cancel { min-height: 44px; padding: 0 14px; border: none; border-radius: 12px; cursor: pointer;
          background: none; color: var(--text-3); font-size: 15px; }

        .cw-state { font-size: 14px; line-height: 1.55; color: var(--text-2); margin: 0; max-width: 52ch; }
        .cw-answers, .cw-stale { padding: 14px; border-radius: 14px; background: var(--surface-1);
          display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
        .cw-answer { display: flex; gap: 10px; align-items: flex-start; }
        .cw-answer-body { font-size: 15px; line-height: 1.5; color: var(--text-1); }

        .cw-sweep { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px;
          border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%);
          border: 1px solid var(--warm); animation: cw-out 900ms cubic-bezier(0.2,0.8,0.2,1) forwards; }
        @keyframes cw-out {
          from { width: 10px; height: 10px; opacity: 0.55; }
          to   { width: 320px; height: 320px; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) { .cw-sweep { display: none; } }
      `}</style>
    </section>
  );
}

export default CallWingman;
