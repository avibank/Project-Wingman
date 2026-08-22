import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchProfileStatus } from "../lib/squadron.js";
import FirstFlight from "./FirstFlight.jsx";

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
        setState(failed || profile ? "through" : "onboarding");
      })
      .catch(() => live && setState("through"));
    return () => { live = false; };
  }, [isLoaded, isSignedIn, user?.id]);

  if (state === "checking") return null;
  if (state === "onboarding") return <FirstFlight onDone={() => setState("through")} />;
  return children;
}

export default FirstFlightGate;
