/* =============================================================================
   THE TUTORIAL, STEP BY STEP.
   -----------------------------------------------------------------------------
   The owner (2026-09-21): a tutorial, sweet, clean and explanatory. Not a
   specification read aloud, so no What / Why / How labels; a title and a
   sentence or two, in the voice a classmate would use showing you round. It
   opens with Wingman, not with the syllabus. The right seat gets its due:
   it is how you study WITH somebody, watching a lesson together and taking
   the same quiz.

   Every step is on the real screen, with the demo's class in it (seed.js).
     where  the address the step shows; the guide goes there first
     find   what the light settles on: selectors, or a function returning an
            element, first match wins. None dims the whole screen.
     sweep  instead of find: the light glides from one to the next and round
            again while the step is up
     act    something to do once the screen is there (open a chat, say)

   Every claim is checked against the app: the 20-minute clock and the 75%
   pass mark (quiz.js), sign-off stamps (signoff.js), the right seat's
   marks and filter in a lesson (LessonPage, LogTab), and the board a quiz
   run lands on (0034).
   ========================================================================= */

const clickText = (root, text) => () => {
  const scope = document.querySelector(root) || document;
  const el = [...scope.querySelectorAll("button, [role='button'], a")].find((b) => b.textContent.includes(text));
  el?.click();
};
const shown = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
};
/* ON A PHONE THE ROOM SHOWS ONE COLUMN AT A TIME, so a step about a column
   that is not on screen opens it first. On a wide screen nothing is pressed. */
const unless = (sel, act) => () => { if (!shown(sel)) act(); };
const toRail = () => {
  let n = 0;
  const go = () => {
    if (shown(".rr-rail") || n++ > 3) return;
    document.querySelector(".rr-backbtn")?.click();
    setTimeout(go, 180);
  };
  go();
};
/* The Flight Deck's right-seat card has no class of its own: it is the
   ground card whose OWN label says Right seat. The route strip above it
   names "Your right seat" in a corner, so matching the text anywhere in a
   card lit the wrong one. */
const seatCard = () => [...document.querySelectorAll(".deck .bog-card")]
  .find((el) => /^right seat$/i.test(el.querySelector(".bog-ch .bog-lbl")?.textContent?.trim() || "")) || null;

export const STEPS = [
  {
    section: "Welcome", where: "/",
    title: "Welcome to Wingman",
    text: "A study app and a social hub, made by students for students. Here is a quick look around, with a class already in it.",
    note: "Nothing here is saved. Swipe, or use the arrows.",
  },

  /* ------------------------------------------------------------ Flight Deck */
  {
    section: "Flight Deck", where: "/", find: [".deck .title"],
    title: "This is your Flight Deck",
    text: "Your home screen. Whatever you are in the middle of, and anything that needs you, starts here.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .card .cardbody", ".deck .card"],
    title: "Pick up where you left off",
    text: "Resume takes you straight back into the lesson or quiz you were on, to the minute.",
  },
  {
    section: "Flight Deck", where: "/",
    sweep: [".deck .strip > :nth-child(1)", ".deck .strip > :nth-child(2)", ".deck .strip > :nth-child(3)", ".deck .strip > :nth-child(4)"],
    title: "Your instruments",
    text: "Your average against the score you are aiming for, what you have saved, the time you have put in, and who is online right now. Tap any of them to go there.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .sec"],
    title: "Your modules",
    text: "Each card is a subject, with your progress drawn across it. If a module's average slips under your target it lights Master Caution, like Mathematics here.",
  },
  {
    section: "Flight Deck", where: "/", find: [seatCard, ".deck .bog"],
    title: "Your right seat",
    text: "Pick one classmate to study alongside. Watch a lesson together, take the same quiz and compare, and see each other's questions as you go.",
  },

  /* ------------------------------------------------------------- the module */
  {
    section: "Module", where: "/m/m1", find: [".card[data-ref='module-panel']", ".mscreen"],
    title: "Inside a module",
    text: "Every module is split into chapters, and each chapter starts with short lessons. Finish one and it is signed off with your own stamp.",
  },
  {
    section: "Module", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libtab"],
    title: "The Library",
    text: "Every chapter has a practice quiz and a set of study cards built from the same questions. Shared PDFs for the whole module are on their way here too.",
  },
  {
    section: "Module", where: "/m/m1/M1.03/quiz", find: [".exam-frame", ".exam-page"],
    title: "Quizzes feel like the real thing",
    text: "Answer everything, then hand it in. Twenty minutes, a 75% pass mark, and every question you missed comes back with the right answer.",
  },
  {
    section: "Module", where: "/m/m1/library/cards/2", find: [".cards-page", "main"],
    title: "Study cards",
    text: "Think of the answer, flip to check, and keep the cards you want to see again.",
  },
  {
    section: "Module", where: "/m/m1/crew", find: [".crew", ".card[data-ref='module-panel']"],
    title: "Your crew",
    text: "Everyone studying this module, and the chapter each of them is on. Find someone at the same point as you, or turn on Fly solo to stay out of sight.",
  },

  /* ------------------------------------------------------------ Ready Room */
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-threads", ".rr-feed"],
    act: unless(".rr-threads", clickText(".rr-rail", "Mathematics")),
    title: "Ask the module",
    text: "Stuck on something? Ask. Anyone studying the module can answer, and the answer that helped most rises to the top.",
  },
  {
    section: "Ready Room", find: [".rr-chat", ".rr-pane"],
    act: clickText(".rr-rail", "Night Shift"),
    title: "Squadrons",
    text: "Small group chats for the people you study with. Plan a study night, share what helped, and keep each other going.",
  },
  {
    section: "Ready Room", where: "/ready-room", find: [".rr-seats", ".rr-rail"], act: toRail,
    title: "Fly with a right seat",
    text: "Squadron mates who are online show up here. Invite one into your right seat and their questions and notes appear on your lesson as you watch together.",
  },

  /* ----------------------------------------------------------------- profile */
  {
    section: "Your profile", where: "/account/licence", find: [".lic", "[data-ref='licence-card']", ".ref-lic"],
    title: "Your licence",
    text: "Your profile: your name, your callsign, and the hours, lessons and days you have put in. Your stamp sits on it, built around a code that is yours alone.",
  },
  {
    section: "Your profile", where: "/account/preferences", find: [".pref-bar", "[data-ref='preferences']", "main"],
    title: "Make it yours",
    text: "Set the score you are aiming for, choose your colours, day or night, and come back to this tour from your Licence whenever you like.",
  },

  {
    section: "Ready", where: "/",
    title: "You are ready",
    text: "Learn it, prove it, remember it, with a class beside you the whole way.",
    note: "Never fly alone.",
    last: true,
  },
];
