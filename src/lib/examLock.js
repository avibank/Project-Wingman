/* =============================================================================
   THE EXAM IS LOCKED, AND THE APP BAR HAS TO KNOW.
   -----------------------------------------------------------------------------
   R4 of the exam brief: "Once started, the exam screen has no way out but End
   exam, which asks first and says what is unanswered and what is flagged. No
   back arrow, no Ready Room, no profile, no links of any kind on the page."

   NONE OF THAT WAS TRUE, and the port check said it was. `exam-port.check.js`
   scopes its three locked lines to `.exam-page` — `$$('.exam-page a[href]')`,
   `!$('.exam-page .pill')` — and this app had no `.exam-page`, so all three
   asked an empty set and all three answered PASS. Measured on the live quiz
   instead: the app bar was fully drawn over an open paper, with the Ready Room
   pill and the profile menu both clickable, and the browser's own Back walked
   straight out of the exam and abandoned it.

   WHY A STORE RATHER THAN A PROP. The bar is in App.jsx, above the router; the
   phase is in Exam.jsx, three lazy chunks down. Threading a boolean up through
   QuizPage and the route switch would put exam state in two files that have no
   other reason to hold it. This is the same shape as toastBus and savesStore:
   one module, one value, subscribed to where it is needed.

   `askEnd` comes with it because the two facts are one fact — the bar is
   locked BECAUSE there is a paper open, and Back has to reach that paper's own
   end-exam dialog rather than a second one built somewhere else.

   IT IS SET IN A LAYOUT EFFECT, for the reason CLAUDE.md gives about
   `data-screen`: the quiz commits after a Suspense retry, and a passive effect
   from that commit runs after the page has been photographed.
   ========================================================================= */
import { useSyncExternalStore } from "react";

const UNLOCKED = { locked: false, askEnd: null };
let state = UNLOCKED;
const subs = new Set();
const emit = () => { for (const f of subs) f(); };

/** Exam.jsx, while a paper is open. `askEnd` opens its end-exam dialog. */
export function lockExam(askEnd) {
  if (state.locked && state.askEnd === askEnd) return;
  state = { locked: true, askEnd: typeof askEnd === "function" ? askEnd : null };
  emit();
}

/** On the result, on unmount, and on any path out. Idempotent. */
export function unlockExam() {
  if (state === UNLOCKED) return;
  state = UNLOCKED;
  emit();
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const snapshot = () => state;

/** For components. */
export const useExamLock = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** For the pop handler, which is registered once and is not a component. */
export const examLock = () => state;
