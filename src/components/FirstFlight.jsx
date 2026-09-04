import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { MODULES, chaptersForModule } from "../data.js";
import { fetchRecentPilots, saveProfile, assignSquadron, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles } from "./Tail.jsx";

// §7.1 — three screens, and a course picker is not the first one. You meet
// people, then choose material, then say when you fly. Assignment happens once
// all three answers exist, because the fill ladder needs module and study-time.

const STUDY_TIMES = [
  { id: "early",   label: "Early",   hint: "before the day starts" },
  { id: "day",     label: "Day",     hint: "between other things" },
  { id: "evening", label: "Evening", hint: "after work or class" },
  { id: "late",    label: "Late",    hint: "when it's quiet" },
];

function MeetSquadron({ onNext }) {
  const { user } = useUser();
  const [pilots, setPilots] = useState(null);

  useEffect(() => {
    let live = true;
    fetchRecentPilots(user?.id, 8)
      .then((p) => live && setPilots(assignMarkings(p || [])))
      .catch(() => live && setPilots([]));
    return () => { live = false; };
  }, [user?.id]);

  return (
    <div className="ff-screen">
      <h1 className="ff-title">Meet your squadron</h1>

      {pilots === null ? (
        <p className="ff-sub">Looking for who's flying…</p>
      ) : pilots.length ? (
        <>
          <p className="ff-sub">Pilots already flying. You'll be placed with people on your material.</p>
          <ul className="ff-pilots">
            {pilots.map((p, i) => (
              <li key={p.user_id} className="ff-pilot" style={{ "--i": i }}>
                <Tail name={p.callsign} marking={p.marking} size={44} staff={p.is_staff} />
                <span className="ff-pilot-name">{p.callsign || "Pilot"}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        // §10 — the empty state names the next action inside the sentence, and
        // §8.1 forbids solving a cold start by inventing anyone to show here.
        <p className="ff-sub">
          You're early. Pick your module and we'll put the next pilots who arrive on your wing.
        </p>
      )}

      <button className="ff-go" onClick={onNext}>Continue</button>
    </div>
  );
}

function PickModule({ value, onPick, onNext }) {
  return (
    <div className="ff-screen">
      <h1 className="ff-title">What are you flying?</h1>
      <p className="ff-sub">You can add the rest later — this is just where you start.</p>
      <ul className="ff-modules">
        {MODULES.map((m) => {
          const count = chaptersForModule(m.code).length;
          return (
            <li key={m.code}>
              <button
                className={`ff-module ${value === m.code ? "is-picked" : ""}`}
                onClick={() => onPick(m.code)}
                aria-pressed={value === m.code}
              >
                <span className="ff-module-code">{m.code}</span>
                <span className="ff-module-name">{m.name}</span>
                <span className="ff-module-meta">{count} chapters</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button className="ff-go" onClick={onNext} disabled={!value}>Continue</button>
    </div>
  );
}

/* THE CALLSIGN, AND WHY IT IS A STEP RATHER THAN A SETTING.
   Onboarding collected a study time and never asked what to call anybody, so
   every account reached the app anonymous. That is not cosmetic:
   people-search matches on the callsign, so an account without one cannot be
   found by anybody, and the room renders "Someone" beside their messages.
   Skippable on purpose. A required field here would be a wall in front of the
   product for somebody who has not decided yet, and Settings still has it. */
function PickCallsign({ value, onPick, onNext, busy }) {
  return (
    <div className="ff-screen">
      <h1 className="ff-title">What should we call you?</h1>
      <p className="ff-sub">
        How you appear in the Ready Room and how squadron-mates find you. Change it
        whenever you like.
      </p>
      <input className="ff-callsign" value={value} maxLength={24} autoFocus
             placeholder="Callsign" aria-label="Callsign"
             onChange={(e) => onPick(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onNext(); }} />
      <button className="ff-go" onClick={onNext} disabled={busy}>
        {busy ? "One moment…" : value.trim() ? "That's me" : "Skip for now"}
      </button>
    </div>
  );
}

function PickTime({ value, onPick, onNext, busy }) {
  return (
    <div className="ff-screen">
      <h1 className="ff-title">When do you usually study?</h1>
      <p className="ff-sub">We use this to find pilots who are awake when you are.</p>
      <ul className="ff-times">
        {STUDY_TIMES.map((t) => (
          <li key={t.id}>
            <button
              className={`ff-time ${value === t.id ? "is-picked" : ""}`}
              onClick={() => onPick(t.id)}
              aria-pressed={value === t.id}
            >
              <span className="ff-time-label">{t.label}</span>
              <span className="ff-time-hint">{t.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="ff-go" onClick={onNext} disabled={!value || busy}>
        {busy ? "Finding your squadron…" : "Continue"}
      </button>
    </div>
  );
}

function FirstFlight({ onDone }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [moduleCode, setModuleCode] = useState(null);
  const [studyTime, setStudyTime] = useState(null);
  const [busy, setBusy] = useState(false);
  const [callsign, setCallsign] = useState("");

  // Both writes are best-effort: a failed placement must not strand someone in
  // onboarding. They land on the Deck either way and get placed on next entry.
  const place = async () => {
    setBusy(true);
    try {
      await saveProfile(user.id, {
        study_time: studyTime,
        // Empty stays null rather than becoming "", so "has no callsign yet"
        // is one value and not two.
        callsign: callsign.trim() || null,
      });
      await assignSquadron(user.id, moduleCode, studyTime);
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
    onDone?.({ moduleCode, studyTime });
  };

  return (
    <div className="ff">
      {step === 0 && <MeetSquadron onNext={() => setStep(1)} />}
      {step === 1 && <PickModule value={moduleCode} onPick={setModuleCode} onNext={() => setStep(2)} />}
      {step === 2 && <PickTime value={studyTime} onPick={setStudyTime} onNext={() => setStep(3)} busy={busy} />}
      {step === 3 && <PickCallsign value={callsign} onPick={setCallsign} onNext={place} busy={busy} />}

      <ol className="ff-dots" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={i === step ? "is-here" : i < step ? "is-done" : ""} aria-hidden="true" />
        ))}
      </ol>

      <TailStyles />
      <style>{`
        .ff { min-height: 100dvh; display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 32px 24px 96px; position: relative; }
        .ff-screen { width: 100%; max-width: 480px; }
        .ff-callsign { width: 100%; margin: 18px 0 22px; padding: 13px 15px;
          background: var(--raised); border: 1px solid var(--line); border-radius: 11px;
          color: var(--t1); font: inherit; font-size: 16px; }
        .ff-callsign:focus { outline: 2px solid var(--active); outline-offset: 1px; }
        .ff-title { font-family: var(--font-ui); font-size: 28px; font-weight: 500;
          letter-spacing: -0.01em; color: var(--text-1); margin: 0 0 8px; }
        .ff-sub { font-size: 16px; line-height: 1.55; color: var(--text-2); margin: 0 0 28px; max-width: 46ch; }

        .ff-pilots { list-style: none; display: flex; flex-wrap: wrap; gap: 20px 14px; padding: 0; margin: 0 0 32px; }
        .ff-pilot { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 64px;
          animation: ff-in 420ms cubic-bezier(0.2,0.8,0.2,1) both; animation-delay: calc(var(--i) * 60ms); }
        .ff-pilot-name { font-size: 12px; color: var(--text-3); max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @keyframes ff-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .ff-modules, .ff-times { list-style: none; padding: 0; margin: 0 0 28px;
          display: grid; gap: 1px; background: var(--hairline); border-radius: 12px; overflow: hidden; }
        .ff-module, .ff-time { display: flex; align-items: baseline; gap: 10px; width: 100%;
          padding: 0 16px; min-height: 56px; background: var(--surface-1); border: none;
          text-align: left; cursor: pointer; color: var(--text-1); }
        .ff-module:hover, .ff-time:hover { background: var(--surface-2); }
        /* §2.2 — selection reads structurally, as a filled leading edge. Not a glow. */
        .ff-module.is-picked, .ff-time.is-picked { background: var(--surface-2);
          box-shadow: inset 3px 0 0 var(--warm); }
        .ff-module-code { font-family: var(--font-mono); font-size: 14px; color: var(--cold); width: 46px; flex-shrink: 0; }
        .ff-module-name { font-size: 16px; flex: 1; }
        .ff-module-meta { font-family: var(--font-mono); font-size: 12px; color: var(--text-3);
          font-variant-numeric: tabular-nums; }
        .ff-time { flex-direction: column; justify-content: center; align-items: flex-start; gap: 2px; }
        .ff-time-label { font-size: 16px; }
        .ff-time-hint { font-size: 14px; color: var(--text-3); }

        .ff-go { width: 100%; min-height: 52px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-family: var(--font-ui);
          font-size: 16px; font-weight: 500; }
        .ff-go:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }

        .ff-dots { list-style: none; display: flex; gap: 6px; padding: 0;
          position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); margin: 0; }
        .ff-dots li { width: 6px; height: 6px; border-radius: 50%; background: var(--hairline); }
        .ff-dots li.is-done { background: var(--text-3); }
        .ff-dots li.is-here { background: var(--warm); }

        @media (prefers-reduced-motion: reduce) { .ff-pilot { animation: none; } }
      `}</style>
    </div>
  );
}

export default FirstFlight;
