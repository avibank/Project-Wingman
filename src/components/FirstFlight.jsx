import { useEffect, useRef, useState } from "react";
import { useUser, useReverification } from "@clerk/clerk-react";
import { saveProfile, claimCode, freeCode } from "../lib/squadron.js";
import { normaliseCode, isCode } from "../lib/code.js";
import "./first-flight.css";

/* =============================================================================
   FIRST FLIGHT: ONE SCREEN, THE TWO THINGS THE APP NEEDS.
   -----------------------------------------------------------------------------
   It used to be four screens and a gate in front of them. "Meet your
   squadron" drew recent students as tails in the retired pilot livery. A
   module picker counted data.js's chapters, which reads "0 chapters" now that
   the skeleton is empty. "When do you usually study?" fed a squadron
   placement by study time that the Ready Room, with its own discovery, no
   longer needs. And the gate in front asked for a username, before the
   callsign screen asked for the same name again. The owner asked for all of
   it gone (2026-09-21).

   What is left is what nothing else in the app can supply:

   · THE CALLSIGN. It is the Clerk username and the profile's callsign, one
     name in two places. FirstFlightGate already heals the second from the
     first on every start, so it is written to both here. It is required,
     because the username gate would otherwise ask for it straight after.
   · THE CODE. Unique, required, suggested before anybody arrives so the field
     starts satisfied, and a code taken a second ago keeps you here with
     another rather than letting you in without one.

   Everything else is on the Flight Deck, where the tour is waiting.
   ========================================================================= */

function FirstFlight({ onDone }) {
  const { user } = useUser();
  const setUsername = useReverification((name) => user?.update({ username: name }));
  const [callsign, setCallsign] = useState(user?.username || "");
  const [code, setCode] = useState("");
  const [codeNote, setCodeNote] = useState(null);
  const [nameNote, setNameNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  /* A free code is fetched before the screen is reached, so the required field
     arrives already satisfied. If the fetch fails, one is made up locally and
     the claim below is what actually settles whether it was free. */
  useEffect(() => {
    let live = true;
    freeCode().then((c) => { if (live && c) setCode(c); });
    return () => { live = false; };
  }, []);

  const place = async () => {
    const name = callsign.trim();
    if (!name) { nameRef.current?.focus(); return; }
    setBusy(true);
    setCodeNote(null);
    setNameNote(null);

    /* The name first: Clerk is the one that can refuse it (taken, too short),
       and the student can do something about that. */
    if (name !== user?.username) {
      try {
        await setUsername(name);
      } catch (err) {
        if (err?.code !== "reverification_cancelled") {
          setNameNote(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message
            || "That callsign could not be saved. Try another.");
          nameRef.current?.focus();
        }
        setBusy(false);
        return;
      }
    }

    const got = await claimCode(user.id, code);
    if (!got) {
      const next = await freeCode();
      setCode(next || "");
      setCodeNote(`${normaliseCode(code)} has just been taken. Here is another.`);
      setBusy(false);
      return;
    }
    /* Best-effort: a failed profile write must not strand anybody here. The
       gate heals the callsign from the username on the next start. */
    try {
      await saveProfile(user.id, { callsign: name });
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
    onDone?.({ code: got });
  };

  return (
    <div className="ff">
      <form className="ff-col" onSubmit={(e) => { e.preventDefault(); if (isCode(code)) place(); }}>
        <p className="ff-eyebrow">Your licence</p>
        <h1 className="ff-title">What should we call you?</h1>
        <p className="ff-sub">
          Your callsign is how you appear in the Ready Room and how classmates
          find you. Change it on your Licence whenever you like.
        </p>

        <label className="ff-l" htmlFor="ff-callsign">Callsign</label>
        <input id="ff-callsign" ref={nameRef} className="ff-in" value={callsign} maxLength={24} autoFocus
               placeholder="Callsign" autoComplete="username" autoCapitalize="off" spellCheck="false"
               aria-invalid={nameNote ? "true" : undefined}
               onChange={(e) => { setCallsign(e.target.value); setNameNote(null); }} />
        {nameNote && <p className="ff-note" role="alert">{nameNote}</p>}

        <label className="ff-l" htmlFor="ff-code">Your code</label>
        <p className="ff-h">
          Three characters, yours alone. It goes on your licence, and it is what
          gets stamped on a chapter when you finish it.
        </p>
        <input id="ff-code" className="ff-code" value={code} maxLength={3}
               placeholder="A7K" aria-label="Your three character code"
               autoCapitalize="characters" autoComplete="off" spellCheck="false"
               onChange={(e) => { setCode(normaliseCode(e.target.value)); setCodeNote(null); }} />
        {codeNote && <p className="ff-note" role="alert">{codeNote}</p>}

        <button type="submit" className="ff-go" disabled={busy || !isCode(code)}>
          {busy ? "One moment…" : "Onto the Flight Deck"}
        </button>
        <p className="ff-after">The Flight Deck will offer you a short tour of the app.</p>
      </form>
    </div>
  );
}

export default FirstFlight;
