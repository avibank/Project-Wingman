/* =============================================================================
   "OPEN THE STAMP CREATOR WHEN THE LICENCE ARRIVES."
   -----------------------------------------------------------------------------
   The walkthrough ends by taking a new student to their licence to issue their
   code and stamp. The licence screen is lazy and owns the creator's state, so
   App cannot open it directly. It leaves this note on the way out, and the
   licence reads it once when it mounts.

   A module variable rather than storage, on purpose: the note is meant for
   the very next licence screen in this tab, and never for one after a reload.
   ========================================================================= */
let asked = false;

export const askForLicence = () => { asked = true; };

export const takeLicenceAsk = () => {
  const was = asked;
  asked = false;
  return was;
};
