/* =============================================================================
   THE TUTORIAL — EVERY SCREEN, IN A FRIENDLY VOICE.
   -----------------------------------------------------------------------------
   Three instructions from the owner, and this file is where all three land.

   · 2026-09-21: 75 steps, page by page, one per thing on the page. Too long.
   · 2026-09-23, on the 25 that replaced them: "we are dealing with university
     students who are familiar with study apps — we aren't trying to teach
     them how to operate an OS but to introduce them to our own system, our
     own quirks and ideas, rather than teach them how to use a video player."
   · 2026-09-23, on the 12 that replaced THOSE: "more charm and kindness in
     the demo, also walk them through every screen, just not every boring
     detail — you hardly explained the social side."

   So: EVERY SCREEN gets a step, no screen gets a manual, and the social half
   of this app — the right seat, Crew, getting your own class in, the room,
   squadrons, the boards — carries as many steps as the studying half,
   because it is half of what Wingman is and it was three lines in the
   version before this.

   THE VOICE IS A CLASSMATE'S, and a kind one. It never tells anybody off,
   never implies they are behind, and says what the app will not do to them
   (no locked chapters, no guilt over a broken streak, no scoring of a card
   set) as plainly as it says what it will. §10 still holds: no absence, no
   zero counts, every sentence with a way forward in it.

   The machinery is unchanged. Every step is on the real screen, with the
   demo's class in it (seed.js):
     where  the address the step shows; the guide goes there first
     find   what the light settles on: selectors, or functions returning an
            element, first match wins. None dims the whole screen.
     act    something to do once the screen is there (open a chat, say)

   Every claim is checked against the code that does it: the hour meter
   running only inside a module and stopping on a hidden tab (hobbs.js),
   Master Caution on a module AVERAGE under the student's own bar
   (minimums.js), the bar that cannot go below the pass mark, the flat twenty
   minutes and the clock that belongs to the attempt (quiz.js), nothing
   marked before hand-in and the correction inside the result (Exam.jsx), the
   board of runs with one stamp per person (Leaderboard.jsx), the Library's
   finisher line (0038), cards that open where you stopped (cardsSeen.js),
   the logbook's three kinds and their timestamps (lessonLog.js), answers
   endorse-only (0010), ticks that tell the truth (0027), the invite link
   (InviteSheet.jsx), Fly solo (flySolo.js), and the stamp and code issued
   together (0035, 0039). Change the feature and the paragraph changes too.
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
const withText = (sel, re) => () => [...document.querySelectorAll(sel)].find((el) => re.test(el.textContent || "")) || null;
const lastOf = (sel) => () => [...document.querySelectorAll(sel)].pop() || null;
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
const nightShift = clickText(".rr-rail", "Night Shift");
/* The Flight Deck's right-seat card: the ground card whose OWN label says so. */
const seatCard = () => [...document.querySelectorAll(".deck .bog-card")]
  .find((el) => /^right seat$/i.test(el.querySelector(".bog-ch .bog-lbl")?.textContent?.trim() || "")) || null;

const LESSON = "/m/m1/M1.02/lesson/M1.02.2";
const QUIZ = "/m/m1/M1.03/quiz";
const CARDS = "/m/m1/library/cards/2";

export const STEPS = [
  {
    section: "Welcome", where: "/",
    title: "Welcome aboard",
    text: "Wingman is a study app for aircraft maintenance students, made by people sitting the same exams as you. You have used a study app before, so we will not walk you through what a tab is — this is a quick look round our own corner of it, and the people in it.",
    note: "None of this class is real, and nothing you touch here is saved. Skip whenever you like.",
  },

  /* ------------------------------------------------------------- Flight Deck */
  {
    section: "Flight Deck", where: "/", find: [".deck .card .cardbody"],
    title: "It remembers, so you do not have to",
    text: "Your Flight Deck opens on the module you are studying and the exact lesson you walked away from — four minutes into the video, if that is where you got to. Deciding where to start is the part of an evening that quietly eats the evening, so we took it off you.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip"],
    title: "Four dials that will not flatter you",
    text: "Your average, what is in your bag, the hours you have flown on this module, and who is about. The hours are the ones to trust: the meter only runs while you are actually inside the module and stops the moment you switch tabs, because a window left open all night is not a night of studying and we would rather not pretend it was.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .rail .mod .lamp-mark", ".deck .rail .mod"],
    title: "You decide what counts as a pass",
    text: "The exam wants seventy-five per cent. You can ask more of yourself than that, never less, and Master Caution lights on one thing only: a module whose average has slipped under the bar you set. The rest of the time it stays dark, because a warning light that comes on when nothing is wrong is one you stop seeing.",
  },
  {
    section: "Flight Deck", where: "/", find: [seatCard, ".deck .bog-cards"],
    title: "The right seat is somebody, not something",
    text: "You pick one person to fly with, and after that you are never quite studying alone: you can see what they are working on, their questions turn up inside the lessons you are watching, and yours turn up in theirs. It is the person you would nudge in a workshop, kept somewhere you can actually reach them.",
  },

  /* ------------------------------------------------------------------ module */
  {
    section: "Module", where: "/m/m1", find: [".mtabs"],
    title: "A module, and everything in it",
    text: "Lessons is the syllabus in order, Library is everything that is not a video, and Crew is the class working through it with you. Three tabs, one module, and nothing from another module hiding in any of them.",
  },
  {
    section: "Module", where: "/m/m1", find: [".pane .chap"],
    title: "You sign your own chapters off",
    text: "Nothing is locked and nothing is graded on its way past: when you are happy with a chapter, you sign it off yourself. Miss a few days and nothing here tuts at you — a streak that breaks just resets, quietly, and the chapters wait exactly where you left them.",
  },

  /* ------------------------------------------------------------------ lesson */
  {
    section: "Lesson", where: LESSON, find: [".lesson .player", ".lesson .col"],
    title: "The video, and the margin beside it",
    text: "A lesson is the video at the top and everything belonging to it directly underneath — your notes, the questions, the answers. You should never have to leave a lesson to do anything a lesson makes you want to do.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .lg-entry", ".lesson .lg-list"],
    title: "Your logbook keeps the timestamps",
    text: "Anything you jot down while watching is pinned to the minute that caused it, so tapping it next month takes the video straight back there. Your notes, your questions and anything your right seat left on this same lesson sit together — by exam week it is your own thinking with the working still attached.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .card .tabs", ".lesson .card"],
    title: "Ask here, and it takes the lesson with it",
    text: "A question asked from a lesson arrives on the module's board carrying the lesson and the moment you asked it, so whoever answers already knows what you were looking at. No screenshots, no \"which video?\", and the answer comes back to the spot you asked from.",
  },

  /* ----------------------------------------------------------------- Library */
  {
    section: "Library", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libsplit"],
    title: "The Library, and who has been through it",
    text: "Everything that is not a video: a quiz for each chapter, the study cards, and the module's papers to keep. Under each quiz sit the stamps of everyone who has finished it, most recent first — a quiet way of seeing what your class is working on this week, without anybody having to announce it.",
  },
  {
    /* THE TOP CARD, not the whole pad: at 390 the pad is 499px tall and its
       light's own padding came down on the docked card by four pixels.
       Measured on the walk — the pad itself was clear. */
    section: "Study cards", where: CARDS, find: [".bm-pad-stage .bm-pc:not(.is-gone)", ".bm-pad"],
    title: "Cards that remember where you got to",
    text: "The chapter's questions as cards to turn over, and the set opens where you stopped rather than back at the top. Test yourself deals the ones that slipped last time first — nobody is keeping score here, it just quietly hands back what you have not got yet.",
  },

  /* -------------------------------------------------------------------- quiz */
  {
    section: "Quiz", where: QUIZ, find: [".exam-bar", ".exam-body .question"],
    title: "A quiz is sat, not played",
    text: "You answer the whole paper and hand it in, with nothing marked while you are still working — knowing question three was right changes how you answer question four, and the real paper will not tell you either. The clock is twenty minutes and it belongs to the paper: step away and it stops, come back and it picks up where it was.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".navigator"],
    title: "And what comes back is useful",
    text: "The result carries the correction inside it — each question you missed, your answer struck through and the right one after it — so a paper is a diagnosis rather than a verdict. Underneath is the board: everyone's runs on that paper, ranked on score and then time, with one stamp each.",
  },

  /* -------------------------------------------------------------------- Crew */
  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .cch", ".crew .csum"],
    title: "Crew: your class, chapter by chapter",
    text: "Who has signed each chapter off, who is on it right now, and who is a little ahead. It is here so that when you are stuck you can find the person sitting at exactly your problem — or the one who was sitting at it last week and remembers how it went.",
  },
  {
    section: "Crew", where: "/m/m2/crew", find: [".cempty .ce-do", ".cempty"],
    title: "And if your class is not here yet, bring them",
    text: "A module nobody you know has opened looks like this, and it comes with a link. Send it to the group chat your class already uses: whoever taps it gets a look round before they decide anything, and when they join they appear right here, chapter by chapter, beside you.",
  },

  /* ------------------------------------------------------------- Ready Room */
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-rail .rr-rail-head", ".rr-rail"], act: toRail,
    title: "The Ready Room is where everybody is",
    text: "One room for every part of Wingman with other people in it: a question board for each module, your squadrons, and whoever is in your right seat. Everything social lives behind this one door, so there is never a conversation happening somewhere you forgot to look.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [lastOf(".rr-chat .rr-msg .rr-bub"), ".rr-chat"],
    act: unless(".rr-chat", nightShift),
    title: "Squadrons are the small group",
    text: "Four of you who study at night, or the whole class — a squadron is a group that stays, and it sits inside the course rather than in another app. The ticks tell the truth, too: one until everybody has it, two until everybody has opened it. This is the place for the question you think is too daft to ask the board. It is not.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-feed .rr-frow", ".rr-feed"],
    act: unless(".rr-feed", mathsBoard),
    title: "On the boards, answers are backed, never buried",
    text: "Each module has a board of questions, and an answer can only be endorsed — there is no way to vote one down. So what rises is the answer the class agrees with rather than the one nobody dared argue with, and most of what you are about to ask has already been asked by somebody a week ahead.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [withText(".rr-rail .rr-sect", /Right seat/i), ".rr-rail .rr-seats"], act: toRail,
    title: "Asking someone into the right seat",
    text: "You ask, they say yes, and it is one person at a time — nobody collects wingmen here. They get a single nudge rather than five, and either of you can leave the seat whenever you like, with nothing said about it.",
  },

  /* --------------------------------------------------------------- bookmarks */
  {
    section: "Bookmarks", where: "/bookmarks", find: [".bm-folders"],
    title: "One pocket for everything you keep",
    text: "Questions, study cards, videos and pages, in four folders. Anything you save anywhere lands here and stays with your account rather than the device you saved it on, and the flight bag on your Flight Deck counts what is in it for the module you are in.",
  },

  /* ----------------------------------------------------------------- account */
  {
    section: "Licence", where: "/account/licence", find: [".lic .sblock", ".lic"],
    title: "Your licence, and the stamp you sign with",
    text: "In this trade a signature on a certificate is a stamp, so that is what signing off a chapter puts on it. You design yours once — shape, pattern, ink, and a code of up to three characters that is yours alone — and it turns up on every chapter you sign, on the board after a quiz, and under the quizzes you have finished.",
  },
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Your bar/), ".profile .box"],
    title: "Your bar, and the quiet switch",
    text: "This is where you set the pass mark you are held to. Beside it is Fly solo: it takes you off other people's boards and walls without taking any of the app away from you — some weeks you want the class, and some weeks you want your head down, and neither needs explaining.",
  },
  {
    section: "Appearance", where: "/account/appearance", find: [".profile .block-livery", ".profile .block"],
    title: "Make it easy on your eyes",
    text: "Day and night, six liveries, and a Manual finish that redraws the whole app in ink — this is a screen you will be on late. If movement bothers you, Smooth Air turns the animation off altogether rather than merely hurrying it along.",
  },

  {
    section: "Ready", where: "/",
    title: "That is the tour",
    text: "Learn it, prove it, keep it — and when it gets hard, there is a class in here who are finding the same chapter hard this week. Come and sit with us.",
    note: "Never fly alone.",
    last: true,
  },
];
