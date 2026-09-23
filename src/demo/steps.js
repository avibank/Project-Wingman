/* =============================================================================
   THE TUTORIAL — OUR QUIRKS, NOT A MANUAL.
   -----------------------------------------------------------------------------
   The owner, 2026-09-23, on the twenty-five step version that came before
   this one: "we are dealing with university students who are familiar with
   study apps. We aren't trying to teach them how to operate an OS but to
   introduce them to our own system, our own quirks and ideas, rather than
   teach them how to use a video player. Draw up a more intuitive demo."

   So it is TWELVE steps, and every one of them is a decision this app has
   made that another study app has not:

     the instruments that refuse to flatter you · the pass mark you set for
     yourself and the one lamp that watches it · the right seat · the class
     living inside the module · a logbook pinned to the minute of the video
     that caused it · a quiz sat as an exam, with the clock belonging to the
     paper · what comes back afterwards · what the class has already finished
     · an answer that can be endorsed but never buried · a signature you
     design once and sign chapters with.

   What is NOT in it: how to press play, how to send a message, what a tab is
   for, where Previous and Next are. A student who has used a study app knows
   all of that, and a tour that explains it reads as a tour for somebody else.

   THIS REVERSES NOTHING ABOUT THE MACHINERY. Every step is still on the real
   screen, with the demo's class in it (seed.js):
     where  the address the step shows; the guide goes there first
     find   what the light settles on: selectors, or functions returning an
            element, first match wins. None dims the whole screen.
     act    something to do once the screen is there (open a board, say)

   Every claim is checked against the code that does it: the hour meter
   running only inside a module and stopping on a hidden tab (hobbs.js),
   Master Caution lighting on a module AVERAGE under the student's own bar and
   staying dark otherwise (minimums.js), the bar that cannot go under the pass
   mark, the flat twenty minutes and the clock that belongs to the attempt
   (quiz.js), nothing marked before hand-in and the correction carried inside
   the result (Exam.jsx), the board listing runs with one stamp per person
   (Leaderboard.jsx), the Library's finisher line (0038), study cards opening
   where you stopped (cardsSeen.js), the logbook's three kinds and their
   timestamps (lessonLog.js), answers being endorse-only (0010), and the stamp
   and the code being issued together (0035, 0039). Change the feature and the
   paragraph has to change with it.
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
const mathsBoard = clickText(".rr-rail", "Mathematics");
/* The Flight Deck's right-seat card: the ground card whose OWN label says so. */
const seatCard = () => [...document.querySelectorAll(".deck .bog-card")]
  .find((el) => /^right seat$/i.test(el.querySelector(".bog-ch .bog-lbl")?.textContent?.trim() || "")) || null;

const LESSON = "/m/m1/M1.02/lesson/M1.02.2";
const QUIZ = "/m/m1/M1.03/quiz";

export const STEPS = [
  {
    section: "Welcome", where: "/",
    title: "This is Wingman",
    text: "A study app for aircraft maintenance students, made by people sitting the same exams. You have used a study app before, so this goes straight to what is different here: the course and the people doing it are in one place, and everything below is built on that.",
    note: "Nothing here is real — it is a class we made up. Swipe, use the arrow keys, or skip whenever you like.",
  },

  {
    section: "Flight Deck", where: "/", find: [".deck .strip"],
    title: "Instruments that will not flatter you",
    text: "The hours only count while you are actually inside a module, and they stop when you leave the tab — an evening with the window open is not an evening of work, and this meter refuses to say it was. The rest of the row is the same idea: your average, what you have put in your bag, and who else is around, with nothing rounded up.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .rail .mod .lamp-mark", ".deck .rail .mod"],
    title: "You set the pass mark. One lamp watches it",
    text: "Seventy-five per cent passes the real exam, and you can hold yourself higher but never lower. Master Caution then lights on exactly one thing — a module whose AVERAGE has fallen under your own bar — and on nothing else, because a warning that comes on while everything is fine is one you learn to look past.",
  },
  {
    section: "Flight Deck", where: "/", find: [seatCard, ".deck .bog-cards"],
    title: "The right seat",
    text: "One person you fly with, and the whole app changes shape around it: you can see what they are on, their questions arrive inside the lessons you are watching, and yours arrive in theirs. Not a group, not a feed — one person, which is what actually gets somebody through a module.",
  },

  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .cch", ".crew .csum"],
    title: "The class lives inside the module",
    text: "Chapter by chapter: who has signed each one off, who is on it right now, and who is ahead of you. The conversation is not in some other app with none of this in it, which is why you can find the person sitting at exactly your problem instead of asking a room of strangers.",
  },

  {
    section: "Lesson", where: LESSON, find: [".lesson .lg-entry", ".lesson .lg-list"],
    title: "A logbook, pinned to the minute",
    text: "Anything you write while watching is stamped with the moment that caused it, so tapping it later takes the video back there. A question asked here carries the lesson and the timestamp onto the module's board, and the answer comes back to the same spot — along with whatever your right seat left on the same lesson.",
  },

  {
    section: "Quiz", where: QUIZ, find: [".exam-bar", ".exam-body .question"],
    title: "A quiz is sat, not played",
    text: "Nothing is marked until you hand the whole paper in, because knowing question three was right changes how you answer question four — and the real paper will not tell you either. The clock is twenty minutes and it belongs to the paper: leave and it stops where it was, come back and it carries on.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".navigator"],
    title: "What comes back",
    text: "The result carries the correction inside it — every question you missed, your pick struck through and the right answer after it — so the paper is a diagnosis rather than a score. Under it is the board: everyone's runs on that paper, ranked by score and then time, one stamp each.",
  },

  {
    section: "Library", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libsplit"],
    title: "What the class has already been through",
    text: "Under each quiz are the stamps of the people who have finished it, most recent first, which tells you what your class is working on this week without anybody posting about it. The study cards beside them open where you stopped and deal the ones that slipped first.",
  },

  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-feed .rr-frow", ".rr-feed"], act: unless(".rr-feed", mathsBoard),
    title: "An answer can be endorsed, never buried",
    text: "Each module has a board of questions, and an answer can only be backed — there is no way to vote one down. So the board settles on the answer the class agrees with rather than the one nobody dared question, and most of what you are about to ask has been asked by somebody a week ahead of you.",
  },

  {
    section: "Licence", where: "/account/licence", find: [".lic .sblock", ".lic"],
    title: "You sign chapters with a stamp you made",
    text: "In this trade a signature on a certificate is a stamp, so that is what finishing a chapter puts on it. You design yours once — shape, pattern, ink and a code of up to three characters that belongs to you alone — and after that it is fixed, which is the entire point of a stamp. It appears on every chapter you sign, on the board after a quiz, and under the quizzes you have finished.",
  },

  {
    section: "Ready", where: "/",
    title: "You are ready",
    text: "Learn it, prove it, keep it, with a class beside you the whole way.",
    note: "Never fly alone.",
    last: true,
  },
];
