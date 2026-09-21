/* =============================================================================
   "OPEN THE STAMP CREATOR WHEN THE LICENCE ARRIVES."
   -----------------------------------------------------------------------------
   The walkthrough ends by taking a new student to their licence to issue their
   code and stamp. The licence screen is lazy and owns the creator's state, so
   App cannot open it directly. It leaves this note on the way out, and the
   licence reads it once when it mounts.

   It is kept in sessionStorage as well as in memory, because the demo ends
   with a reload into the real account: the note has to outlive exactly one
   page load in this tab, and it is read once and cleared.
   ========================================================================= */
const KEY = "pw-licence-ask";
let asked = false;

export const askForLicence = () => {
  asked = true;
  try { window.sessionStorage.setItem(KEY, "1"); } catch { /* memory is enough */ }
  /* App listens, so a note left after a round trip still takes the student
     to the licence. */
  try { window.dispatchEvent(new Event("pw-licence-ask")); } catch { /* no window */ }
};

/* Whether a note is waiting, without taking it: App uses this to bring a
   student who has just signed up to the licence, where it is taken. */
export const licenceAsked = () => {
  if (asked) return true;
  try { return window.sessionStorage.getItem(KEY) === "1"; } catch { return false; }
};

export const takeLicenceAsk = () => {
  let was = asked;
  asked = false;
  try {
    if (window.sessionStorage.getItem(KEY) === "1") was = true;
    window.sessionStorage.removeItem(KEY);
  } catch { /* memory only */ }
  return was;
};
