/* =============================================================================
   THE ONE-TIME NOTICE ON A MODULE SCREEN.
   -----------------------------------------------------------------------------
   Owner, 2026-10-12: "show a banner like once for every user in the module
   screen of sorts that the quizes and q banks have been reworked and
   improved."

   ONCE PER ACCOUNT, NOT ONCE PER DEVICE. What has been seen is a progress key
   (`pw-notice`) rather than a localStorage flag, so dismissing it on a laptop
   also dismisses it on the phone. A student who signs in somewhere new has
   already read it.

   IT STORES WHICH NOTICE, NOT WHETHER. A boolean would have to be cleared by
   hand before the next one could be shown, and "remember to clear the flag"
   is the kind of step that gets missed between a content replacement and a
   deploy. The id is the version: change `NOTICE` and everybody sees the new
   one once, including people who dismissed the last.

   NOTHING IS GATED ON IT. It is a line of prose with a close button; it never
   blocks a screen, never counts anything, and has no second state. When it
   has been dismissed there is nothing left behind.

   THE COPY IS THE SHORT FORM (owner picked it over a fuller card). It does
   not open with what was taken away: a student's scores really are gone and
   pretending otherwise would be worse, so it is said — in the middle, after
   the reason. §10 still holds, which is why nothing here is a zero count.

   WHEN THE NEXT ONE COMES: change `NOTICE` to a new id and new words. Do NOT
   reuse an id — the stored value is compared to it, and reusing one leaves
   everybody who dismissed the old notice unable to see the new.
   ========================================================================= */

/** Where the last dismissed notice's id lives in the progress document. */
export const NOTICE_KEY = "pw-notice";

/**
 * The notice on offer, or null for none. One at a time, on purpose: two
 * stacked on a module screen is a screen about notices.
 */
export const NOTICE = {
  id: "quizzes-reworked-2026-10",
  /* Said in two parts so the strip can bold the first and quieten the second
     without the component having to split a sentence. */
  lead: "Quizzes and question banks reworked.",
  rest: "New questions throughout, and attempts start again to match.",
};

/**
 * Whether to draw it. `seen` is whatever `pw-notice` holds — an id, or
 * nothing at all for an account that has never dismissed one.
 *
 * A value that is not a string is treated as unseen rather than trusted: the
 * key is new, and an older client that wrote something else here should not
 * be able to suppress a notice by accident.
 */
export function noticeFor(seen) {
  if (!NOTICE?.id) return null;
  return (typeof seen === "string" && seen === NOTICE.id) ? null : NOTICE;
}
