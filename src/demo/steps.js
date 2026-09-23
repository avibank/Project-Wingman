/* =============================================================================
   THE TUTORIAL — THE CONCEPTS, NOT THE CONTROLS.
   -----------------------------------------------------------------------------
   The owner (2026-09-23), on the 75-step page-by-page version that came
   before this one: "way too long — explain concepts generally and what is
   special about us and the features we have, rather than explaining how a
   chat works, which is something everyone knows. Same goes for profile:
   explain concepts, why and how and what, in text, not bullet points."

   So this is twenty-five steps, one per IDEA, and each one is a short
   paragraph in a classmate's voice rather than a label for a button. What
   went out with the old version: Previous and Next, how to send a message,
   what a search box is for, how a tab works, and every step that named a
   control and stopped there. What stayed, and what the length is spent on,
   is the part a student cannot guess from having used other apps — the right
   seat, the logbook pinned to the video, sign-off and the stamp, the bar you
   set for yourself and the caution lamp that watches it, a quiz sat as an
   exam, and the class being inside the module rather than in a group chat
   somewhere else.

   The machinery is unchanged. Every step is on the real screen, with the
   demo's class in it (seed.js):
     where  the address the step shows; the guide goes there first
     find   what the light settles on: selectors, or functions returning an
            element, first match wins. None dims the whole screen.
     act    something to do once the screen is there (open a board, say)

   Every claim is checked against the code that does it: the hour meter
   running only inside a module and stopping on a hidden tab (hobbs.js),
   Master Caution lighting on a module AVERAGE under the student's own bar
   (minimums.js), the bar that cannot go under the pass mark (minimums.js),
   the flat twenty minutes and the clock that belongs to the attempt
   (quiz.js), nothing marked before hand-in and the correction carried inside
   the result (Exam.jsx), the board listing runs with one stamp per person
   (Leaderboard.jsx), the Library's finisher line (0038), the logbook's three
   kinds and their timestamps (lessonLog.js), answers being endorse-only
   (0010), and the stamp and the code being issued once, together (0035).
   Change the feature and the paragraph has to change with it.
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
/* The first element matching `sel` whose text matches `re`, for the parts of
   a page that have no class of their own. */
const withText = (sel, re) => () => [...document.querySelectorAll(sel)].find((el) => re.test(el.textContent || "")) || null;
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
const mathsBoard = clickText(".rr-rail", "Mathematics");
/* The Flight Deck's right-seat card: the ground card whose OWN label says so. */
const seatCard = () => [...document.querySelectorAll(".deck .bog-card")]
  .find((el) => /^right seat$/i.test(el.querySelector(".bog-ch .bog-lbl")?.textContent?.trim() || "")) || null;

/* The player's stamp, ask and bookmark, lit as one. */
const playerTools = () => {
  const els = [".pbtn[data-note]", ".pbtn[data-ask]", ".player-save"].map((s) => document.querySelector(`.player-layer ${s}`));
  return els.every(Boolean) ? els : null;
};

const LESSON = "/m/m1/M1.02/lesson/M1.02.2";
const QUIZ = "/m/m1/M1.03/quiz";

export const STEPS = [
  {
    section: "Welcome", where: "/",
    title: "This is Wingman",
    text: "A study app for aircraft maintenance students, made by people sitting the same exams. One idea holds the whole thing together: the material and the people doing the course belong in the same place, so being stuck is a five-minute problem instead of an evening.",
    note: "Nothing here is real — it is a class we made up. Swipe, use the arrow keys, or skip whenever you like.",
  },

  /* ------------------------------------------------------------- Flight Deck */
  {
    section: "Flight Deck", where: "/", find: [".deck .card .cardbody"],
    title: "It knows where you stopped",
    text: "The Flight Deck opens on the module you are studying and the exact lesson you left, so no part of starting is deciding where to start. Everything else on this screen answers the other two questions worth asking: am I doing enough, and where am I weak.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip"],
    title: "Four honest instruments",
    text: "How you are scoring, what you have put in your bag, how long you have actually spent on this module, and who else is around. The hours are the part to trust: the meter runs only while you are inside the module and stops when you leave the tab, so it is time you really flew rather than time the window was open.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .rail .mod .lamp-mark", ".deck .rail .mod"],
    title: "Master Caution, and when it lights",
    text: "Your modules sit here. A module lights its caution lamp only when its average has fallen under the pass mark you set for yourself — not when a single chapter dips, and never when there is nothing to say. A warning that comes on while everything is fine is one you learn to look past, so this one stays dark until it means something.",
  },
  {
    section: "Flight Deck", where: "/", find: [seatCard, ".deck .bog-cards"],
    title: "The right seat",
    text: "Pick one person to fly with and the app stops being something you use alone. You can see what they are on, their questions land in the lessons you are watching, and yours land in theirs. It is the difference between a study group you have to organise and somebody simply being there.",
  },

  /* ------------------------------------------------------------------ module */
  {
    section: "Module", where: "/m/m1", find: [".mtabs"],
    title: "A module holds three things",
    text: "Lessons is the syllabus in order, Library is everything that is not a video, and Crew is the class on this module. Anything about Module 13d is behind one of those three, and nothing belonging to another module is anywhere near them.",
  },
  {
    section: "Module", where: "/m/m1", find: [".pane .chap"],
    title: "You sign your own chapters off",
    text: "A chapter opens into its lessons, and when you are done with one you sign it off yourself — nothing marks it for you and nothing unlocks. That signature is also what the rest of the class sees, which is what makes their wall worth looking at and yours worth keeping straight.",
  },

  /* ------------------------------------------------------------------ lesson */
  {
    section: "Lesson", where: LESSON, find: [".lesson .player", ".lesson .col"],
    title: "A lesson is a video with a margin",
    text: "The video runs at the top and everything about it lives directly underneath. The point is that you never have to leave: the notes, the questions and the answers are in the same column as the thing they are about.",
  },
  {
    section: "Lesson", where: LESSON, find: [playerTools, ".player-layer .pctl-row"],
    title: "Ask without leaving",
    text: "A question asked from a lesson carries the lesson and the timestamp with it onto the module's board, so whoever answers already knows what you were watching and where. The answer comes back to the place you asked from, not to a notification you have to go and find.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .lg-entry", ".lesson .lg-list"],
    title: "The logbook",
    text: "Anything you write while watching is stamped with the moment you wrote it at, so tapping it later takes the video back there. Your notes, your questions and anything your right seat left on the same lesson sit in one list. Come exam week that list is your own thinking, still attached to the minute that caused it.",
  },

  /* ----------------------------------------------------------------- Library */
  {
    section: "Library", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libsplit"],
    title: "The Library",
    text: "Everything that is not a video: a quiz for each chapter, the study cards, and the module's papers to keep on your phone. Under each quiz are the stamps of the people who have finished it, most recent first, which is a quiet way of seeing what the class is working through this week. A reader for marking those papers up together opens here next.",
  },
  {
    section: "Library", where: "/m/m1/library", find: [withText(".libtab .libsplit", /Study cards/)],
    title: "Study cards",
    text: "The same questions again, as cards to turn over. Recognising the right answer in a list is not the same thing as being able to produce it, and cards are the cheapest way to find out which of the two you have in the ten minutes before a bus.",
  },

  /* -------------------------------------------------------------------- quiz */
  {
    section: "Quiz", where: QUIZ, find: [".exam-bar", ".exam-body .question"],
    title: "A quiz is sat, not played",
    text: "You answer the whole paper and hand it in. Nothing is marked while you are still working, because knowing that question three was right changes how you answer question four — and the real paper will not tell you either. The options are shuffled each sitting, so what sticks is the answer rather than its place in the list.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".exam-timer"],
    title: "Twenty minutes, counting down",
    text: "The clock belongs to the paper rather than to the wall: leave and it stops where it was, come back and it carries on from there. Sitting against a clock for the first time in an examination hall is an expensive place to learn what that feels like.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".navigator"],
    title: "What you get back",
    text: "Seventy-five per cent passes. The result carries the correction inside it — every question you missed, with your pick struck through and the right answer after it — and under that, the board: everyone's runs on that paper, ranked by score and then by time, with one stamp each.",
  },

  /* -------------------------------------------------------------------- Crew */
  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .cch", ".crew .csum"],
    title: "Crew is the class, chapter by chapter",
    text: "Who has signed each chapter off, who is on it right now, and who is ahead of you. It exists so that when you are stuck you can find the person sitting at exactly your point, or the one who was there last week, instead of asking a room of strangers a question with no context.",
  },

  /* ------------------------------------------------------------- Ready Room */
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-rail .rr-rail-head", ".rr-rail"], act: toRail,
    title: "The Ready Room",
    text: "One room for everything with other people in it: a question board for each module, squadrons for your own group, and whoever is in your right seat. It is the only part of Wingman that is not about a single lesson, which is why it is kept in one place rather than scattered through the app.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-feed .rr-frow", ".rr-feed"], act: unless(".rr-feed", mathsBoard),
    title: "Questions the class has already answered",
    text: "Every module has a board. An answer can be endorsed but never buried, and the one the class has backed sits at the top — so the board settles on the best answer instead of the loudest. Most of what you are about to ask has been asked by somebody a week ahead of you.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [withText(".rr-rail .rr-row", /Night Shift/), ".rr-rail .rr-sect"], act: toRail,
    title: "Squadrons",
    text: "A squadron is a small group that stays — your class, or the four of you who study at night. You already know how a group chat works; what is worth knowing here is that it sits inside the course rather than beside it, so the thing you are all studying is one tap from the conversation about it. Its link is how you get your own class in.",
  },

  /* --------------------------------------------------------------- bookmarks */
  {
    section: "Bookmarks", where: "/bookmarks", find: [".bm-folders"],
    title: "One pocket for everything you keep",
    text: "Questions, study cards, videos and pages, in four folders. Whatever you save — from a quiz, a card, a lesson or a paper — lands here and stays with the account rather than the device, and the flight bag on the Flight Deck counts what is in it for the module you are on.",
  },

  /* ----------------------------------------------------------------- licence */
  {
    section: "Licence", where: "/account/licence", find: [".lic .cover", ".lic"],
    title: "Your profile is a licence",
    text: "It carries what the class actually knows you by: your callsign, a three-character code that belongs to you alone, and the chapters and hours behind you. It is a record of what you have done rather than a page about you.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .sblock", ".lic .tag"],
    title: "The stamp, and why it is issued once",
    text: "In this trade a signature on a certificate is a stamp, so that is what you sign a chapter with here. You design yours — shape, pattern, ink, your code in the middle — and it is issued once, with the code, in the same moment. After that neither moves, because a stamp that could be redrawn every week would not be worth putting on anything. It appears on every chapter you sign, on the board after a quiz, and under the quizzes you have finished.",
  },
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Your bar/), ".profile .box"],
    title: "You set the standard you are held to",
    text: "Your bar is the score you count as a pass for yourself. It can go above the official seventy-five per cent but never below it, and it is what Master Caution and every prompt to go back over a chapter measure you against. Beside it, Fly solo takes you off other people's boards and walls without taking any of the app away from you.",
  },
  {
    section: "Appearance", where: "/account/appearance", find: [".profile .block-livery", ".profile .block"],
    title: "Made to be read for hours",
    text: "Day and night, six liveries, and a Manual finish that redraws the whole app in ink, because this is a screen you will be on late and often. And if movement bothers you, Smooth Air turns the animation off rather than making it quicker.",
  },

  {
    section: "Ready", where: "/",
    title: "You are ready",
    text: "Learn it, prove it, keep it, with a class beside you the whole way.",
    note: "Never fly alone.",
    last: true,
  },
];
