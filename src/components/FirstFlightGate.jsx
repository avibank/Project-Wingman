import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchProfileStatus, saveProfile } from "../lib/squadron.js";
import FirstFlight from "./FirstFlight.jsx";
import Spooling from "./Spooling.jsx";

// §7.1 runs once, for a signed-in user with no profile yet.
//
// It fails open in every uncertain case. A read that errors — which is the
// state until migration 0005 runs — lets the user straight through rather than
// holding them in onboarding for a table that does not exist.

function FirstFlightGate({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState("checking");   // checking | onboarding | through

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user?.id) { setState("through"); return; }
    let live = true;
    fetchProfileStatus(user.id)
      .then(({ profile, failed }) => {
        if (!live) return;
        /* HEALING THE CALLSIGN ON THE WAY PAST.

           The Licence tab used to write a callsign to Clerk alone, so every
           account that set one before that was fixed still has a NULL in
           pilot_profiles — which is the column the room, the comments, the
           roster and people_search all read. They would stay "Someone" to
           everybody forever, and unfindable, without ever being told why.

           This is the one place with both facts in hand at startup, and it is
           already reading the profile, so the check is free. One write, only
           when the two actually disagree. */
        const mine = user.username?.trim();
        if (profile && mine && profile.callsign !== mine) {
          saveProfile(user.id, { callsign: mine }).catch(() => {});
        }
        setState(failed || profile ? "through" : "onboarding");
      })
      .catch(() => live && setState("through"));
    return () => { live = false; };
  }, [isLoaded, isSignedIn, user?.id]);

  if (state === "checking") return <Spooling />;
  if (state === "onboarding") return <FirstFlight onDone={() => setState("through")} />;
  return children;
}

export default FirstFlightGate;
