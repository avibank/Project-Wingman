import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchProfileStatus, saveProfile } from "../lib/squadron.js";

/* =============================================================================
   FIRST FLIGHT HAS NO SCREEN ANY MORE.
   -----------------------------------------------------------------------------
   A new student signs up, lands on the Flight Deck, and the walkthrough opens.
   Its last slide takes them to their licence, where they choose their code and
   design their stamp, issued together. The owner (2026-09-21): account setup
   "shouldn't be a part of" the way in; do it after the walkthrough.

   So this gate no longer holds anybody. It does its two jobs in the
   background and lets the app through at once:

   · A NEW STUDENT'S PROFILE IS MADE HERE, with the username Clerk asked for at
     sign-up as their callsign. The room, the comments, the roster and
     people_search all read the callsign from pilot_profiles, and without a
     row an account is "Someone" to everybody and unfindable.
   · HEALING THE CALLSIGN. The Licence tab once wrote a callsign to Clerk
     alone, so an account from then can hold a NULL here. This is the one
     place with both facts in hand at startup, and the write happens only when
     the two disagree.

   It fails quietly in every uncertain case: a read that errors writes nothing,
   and the next start tries again.
   ========================================================================= */

function FirstFlightGate({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return undefined;
    let live = true;
    fetchProfileStatus(user.id)
      .then(({ profile, failed }) => {
        if (!live || failed) return;
        const mine = user.username?.trim() || null;
        if (!profile) {
          saveProfile(user.id, { callsign: mine }).catch(() => {});
        } else if (mine && profile.callsign !== mine) {
          saveProfile(user.id, { callsign: mine }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [isLoaded, isSignedIn, user?.id, user?.username]);

  return children;
}

export default FirstFlightGate;
