/* =============================================================================
   THE TUTORIAL, PAGE BY PAGE, TOP TO BOTTOM.
   -----------------------------------------------------------------------------
   The owner (2026-09-21): every page explained, and what each thing on it
   does, top to bottom, rather than a highlight reel. Plain sentences in a
   classmate's voice. It opens with Wingman rather than the syllabus, and the
   right seat is shown as what it is for: studying WITH somebody, a lesson or
   a quiz.

   Every step is on the real screen, with the demo's class in it (seed.js).
     where  the address the step shows; the guide goes there first
     find   what the light settles on: selectors, or functions returning an
            element, first match wins. None dims the whole screen.
     act    something to do once the screen is there (open a chat, say)

   Every claim was checked against the code that does it: the badge counting
   only what is addressed to you (ReadyRoomPill), the gyro opening the quizzes
   and the hour meter the module (Home), the target that cannot go under the
   pass mark (minimums.js), Re-check lighting under YOUR bar (faultChapters),
   the 20-minute clock that stops when you leave (quiz.js), the player's
   stamp, ask and bookmark (PlayerLayer), the signed-off
   answer and then the most endorsed first (Detail), the ticks (0027), the
   logbook's three kinds (lessonLog.js), and the stamp being issued once
   (LicenceCard).
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
const firstQuestion = () => document.querySelector(".rr-fopen")?.click();
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
    title: "Welcome to Wingman",
    text: "A study app and a social hub, made by students for students. This tour walks every page, top to bottom, with a class already in it.",
    note: "Nothing here is saved. Swipe, use the arrow keys, or skip whenever you like.",
  },

  /* ------------------------------------------------------------- the top bar */
  {
    section: "Top bar", where: "/", find: [".topbar .brandmark"],
    title: "Home, from anywhere",
    text: "The bar at the top stays on every page. Tap Wingman to come back to your Flight Deck.",
  },
  {
    section: "Top bar", where: "/", find: [".topbar .rrpill"],
    title: "The Ready Room",
    text: "Where everyone talks. The number counts what is addressed to you: unread squadron messages, and replies in threads you are part of.",
  },
  {
    section: "Top bar", where: "/", find: [".topbar .avbtn", ".topbar-right"],
    title: "Your menu",
    text: "Your initials open your Licence, Preferences, Appearance and Bookmarks.",
  },
  {
    section: "Top bar", where: "/", find: [".rpt"],
    title: "Something's wrong here",
    text: "On every page. Spot a mistake or something broken, tap it once, and it reaches us with the page you were on.",
  },

  /* ------------------------------------------------------------ Flight Deck */
  {
    section: "Flight Deck", where: "/", find: [".deck .dhead"],
    title: "Your Flight Deck",
    text: "Your home screen. What you are in the middle of, and anything that needs you, starts here.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .card .cardbody"],
    title: "Resume",
    text: "The last thing you were doing, and exactly where you stopped. Resume puts you straight back in.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(1)"],
    title: "The dial",
    text: "Your average quiz score in this module, against the target you set. The line under it says how far over or under you are. Tap it for the module's quizzes.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(2)"],
    title: "Your flight bag",
    text: "Counts what you have saved in this module: questions, study cards and moments in lessons. Tap it to open your Bookmarks.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(3)"],
    title: "The hour meter",
    text: "Time spent studying this module. It only runs while Wingman is on your screen, so a forgotten tab adds nothing. Tap it to open the module.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(4)"],
    title: "The radar",
    text: "Classmates online right now. Tap it to go to the Ready Room and talk to them.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .sec"],
    title: "Your modules",
    text: "A card for every module, showing how far into it you are. Tap one to open it.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .rail .mod .lamp-mark", ".deck .rail .mod"],
    title: "Master Caution",
    text: "Lights on a module when your average there falls below your target, and nowhere else. Mathematics is at 77% against a target of 85%.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .bog-head"],
    title: "Back on the ground",
    text: "The social half of your home screen. The line under the heading counts who is on your route, your unread messages and the open threads.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .bog-route", ".deck .bog-card"],
    title: "On your route",
    text: "The module's chapters drawn as a route, with you and your classmates placed along it: who is ahead, who is with you, who is just behind. Tap a face to open their licence.",
  },
  {
    section: "Flight Deck", where: "/", find: [seatCard, ".deck .bog-cards"],
    title: "Your right seat",
    text: "Pick one classmate to study alongside. Watch the same lesson and see each other's questions on it, sit the same quiz and compare. The seat clears after an hour of quiet.",
  },

  /* ------------------------------------------------------------------ module */
  {
    section: "Module", where: "/m/m1", find: [".mscreen .hdr .up"],
    title: "Inside a module",
    text: "Every module opens to the same page. The arrow at the top takes you back to the Flight Deck.",
  },
  {
    section: "Module", where: "/m/m1", find: [".ref-mod .sub-go", ".ref-mod .sub"],
    title: "What is in it",
    text: "Under the name, what this module holds. Tap it to go straight to the Library.",
  },
  {
    section: "Module", where: "/m/m1", find: [".mtabs"],
    title: "Three tabs",
    text: "Lessons are the videos, chapter by chapter. Library has the quizzes and study cards. Crew is everyone studying this module.",
  },
  {
    section: "Module", where: "/m/m1", find: [".mtabs .search"],
    title: "Search",
    text: "Finds a lesson in this module. On the Library tab it finds quizzes and cards, and on Crew it finds people.",
  },
  {
    section: "Module", where: "/m/m1", find: [".pane .chap"],
    title: "A chapter",
    text: "Each chapter opens to its lessons and its quiz. A finished one says Done. Tap it to open or close it.",
  },
  {
    section: "Module", where: "/m/m1", find: [".pane .ch-body .lrow[data-state='done']", ".pane .ch-body .lrow"],
    title: "A finished lesson",
    text: "Watched in full, and signed off with your own stamp.",
  },
  {
    section: "Module", where: "/m/m1", find: [".pane .lrow.cur", ".pane .lrow[data-state='current']"],
    title: "The lesson you are on",
    text: "Shows how long is left. Resume opens it at the second you stopped.",
  },

  /* ------------------------------------------------------------------ lesson */
  {
    section: "Lesson", where: LESSON, find: [".lesson .player", ".lesson .col"],
    title: "A lesson",
    text: "The video picks up where you stopped. The marks along its bar are the moments noted on this lesson: yours, and your right seat's.",
  },
  {
    section: "Lesson", where: LESSON, find: [playerTools, ".player-layer .pctl-row"],
    title: "Note, ask, keep",
    text: "Pause on any second. The stamp writes yourself a note there, the diamond asks the class about it, and the bookmark keeps the moment in your bag.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .title-row"],
    title: "Signing it off",
    text: "Watch to the end and the circle beside the title unlocks. Press it to sign the lesson off with your stamp.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .card .tabs"],
    title: "Logbook and Comments",
    text: "Logbook is everything marked on this lesson, in order. Comments is the whole class's questions on it. Export saves your logbook as a file.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .lg-chips"],
    title: "Whose marks",
    text: "Show everything, only yours, or only your right seat's. That last one is there while someone is beside you.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .lg-entry"],
    title: "A note",
    text: "Stamped with the second it belongs to. Tap the stamp and the video jumps there. Your notes are private: only you see them.",
  },
  {
    section: "Lesson", where: LESSON, find: [withText(".lesson .lg-entry", /SPARROW/), ".lesson .lg-list"],
    title: "Your right seat's questions",
    text: "When you study with someone, their questions on the lesson land in your logbook at the moment they asked. You watch it together, even apart.",
  },
  {
    section: "Lesson", where: LESSON, find: [".lesson .next-h", ".lesson .next-up"],
    title: "The rest of the chapter",
    text: "The other lessons in this chapter, and what comes next.",
  },

  /* ----------------------------------------------------------------- Library */
  {
    section: "Library", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libsplit"],
    title: "Quizzes",
    text: "One quiz for every chapter, with your score beside it. A score under your target says so, and Re-check takes you back in.",
  },
  {
    section: "Library", where: "/m/m1/library", find: [withText(".libtab .libsplit", /Study cards/)],
    title: "Study cards",
    text: "The same questions again, as cards to flip. Good for the ten minutes between other things.",
  },
  {
    section: "Library", where: "/m/m1/library", find: [".libtab .cempty"],
    title: "Shared papers, next",
    text: "Wingman has a reader for PDFs shared across a whole module, so everyone reads and marks up the same handout together. It opens to students here next.",
  },

  /* -------------------------------------------------------------------- quiz */
  {
    section: "Quiz", where: QUIZ, find: [".exam-bar"],
    title: "A quiz sits like the real exam",
    text: "The chapter, the time left, and End exam. Nothing is marked until you hand the whole paper in.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".exam-timer"],
    title: "Twenty minutes",
    text: "The clock counts down and hands the paper in at zero. Leave the page and it stops, and waits for you.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".exam-body .question"],
    title: "The question",
    text: "Pick one answer. The options are shuffled every time you sit it, so you learn the answer rather than where it was.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".question__foot"],
    title: "Move, flag, save",
    text: "Previous and Next move between questions. Flag one to come back to before you hand in. The bookmark keeps the question in your bag for good.",
  },
  {
    section: "Quiz", where: QUIZ, find: [".navigator"],
    title: "The whole paper",
    text: "Jump to any question, and see how many are answered. Hand in from the last one: 75% passes, every miss comes back with the right answer, and your time goes on the module's board.",
  },

  /* ------------------------------------------------------------- study cards */
  {
    section: "Study cards", where: "/m/m1/library/cards/2", find: [".bm-pad"],
    title: "A study card",
    text: "The question on the front, the answer on the back. Tap to turn it over, swipe for the next. The bookmark on a card keeps it for another look.",
  },
  {
    section: "Study cards", where: "/m/m1/library/cards/2", find: [".bm-head .bm-btn"],
    title: "Test yourself",
    text: "Go through the set as a pile: swipe right for the ones you know, left for the ones you don't yet.",
  },

  /* -------------------------------------------------------------------- Crew */
  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .csum"],
    title: "Your crew",
    text: "Everyone studying this module, and how many are studying right now.",
  },
  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .cch"],
    title: "Chapter by chapter",
    text: "Who has signed off each chapter, with everyone's stamps, and who is on it now. It is how you find someone at the same point as you.",
  },
  {
    section: "Crew", where: "/m/m1/crew", find: [".crew .helpers"],
    title: "Answering questions",
    text: "The people answering the most in this module. Open the threads to ask them, or to join in.",
  },

  /* -------------------------------------------------------------- Ready Room */
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-rail .rr-rail-head"], act: toRail,
    title: "The Ready Room",
    text: "The social hub. Search finds people, chats and questions across every module you study.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-rail .rr-seats", withText(".rr-rail .rr-sect", /Right seat/i)], act: toRail,
    title: "Right seat",
    text: "The people you study with, with a dot for who is here now. Tap one, or See all, to take someone into your right seat for a lesson or a quiz.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [withText(".rr-rail .rr-row", /Night Shift/)], act: toRail,
    title: "Squadrons",
    text: "Group chats for the people you study with. The number is unread messages. Find one lists squadrons you can join.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [withText(".rr-rail .rr-row", /Mathematics/)], act: toRail,
    title: "Module boards",
    text: "Every module has a question board for everyone studying it. Each row shows the newest question, and the number is how many are still waiting on an answer.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-chips"], act: unless(".rr-chips", mathsBoard),
    title: "The question board",
    text: "Filter to your own questions or the answered ones. Ask posts a new one to everyone on the module.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-feed .rr-frow"], act: unless(".rr-feed", mathsBoard),
    title: "A question",
    text: "Who asked it, and where it stands: waiting, answered, or signed off by the person who asked. The numbers are votes and answers.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-detail .rr-dtool"], act: unless(".rr-detail", firstQuestion),
    title: "Reading it",
    text: "The question opens beside the list. The arrows step through the board, and Fill the pane gives it the whole width.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-detail .rr-dactions"], act: unless(".rr-detail", firstQuestion),
    title: "Vote, save, share",
    text: "Vote a question up if you want it answered too. Save keeps it in your bag, and Share copies a link to it.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-detail .rr-ans"], act: unless(".rr-detail", firstQuestion),
    title: "Answers",
    text: "The one the asker signed off comes first, then the most endorsed. Endorse an answer that helped you, or reply to it.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-detail .rr-abar"], act: unless(".rr-abar", firstQuestion),
    title: "Write an answer",
    text: "Type your answer and post it. Everyone on the module can read it.",
  },
  {
    section: "Ready Room", find: [lastOf(".rr-chat .rr-msg[data-me='1'] .rr-bub"), ".rr-chat .rr-transcript"],
    act: clickText(".rr-rail", "Night Shift"),
    title: "A squadron chat",
    text: "The ticks tell the truth. One grey until everyone has your message, two grey once they do, blue when everyone has read it.",
  },
  {
    section: "Ready Room", find: [".rr-chat .rr-composer"],
    title: "Sending",
    text: "Type a message, or press + to add a photo or a file. Right click a message, or hold it on a phone, to reply, react, copy, pin or report it.",
  },

  /* ---------------------------------------------------------------- Bookmarks */
  {
    section: "Bookmarks", where: "/bookmarks", find: [".bm-folders"],
    title: "Bookmarks",
    text: "Everything you keep, sorted into folders on its own: questions from quizzes, study cards and moments in lessons. Open a folder to go through it again.",
  },
  {
    section: "Bookmarks", where: "/bookmarks", find: [".bm-switch"],
    title: "One module at a time",
    text: "Bookmarks are kept per module. Switch module here.",
  },

  /* ------------------------------------------------------------------ Licence */
  {
    section: "Licence", where: "/account/licence", find: [".profile .tabs"],
    title: "Your profile",
    text: "Three tabs: your Licence, your Preferences, and how Wingman looks.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .cover"],
    title: "The cover",
    text: "The band across the top of your licence. Cover lets you pick a design or use your own picture.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .avw"],
    title: "Photo and callsign",
    text: "Your photo, or your initials, and your callsign under it: the name classmates know you by. Tap either to change it.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .tag"],
    title: "Your phrase",
    text: "A line about you, picked from a list. Anyone who opens your licence sees it.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .stats"],
    title: "Your numbers",
    text: "Hours studied, lessons signed off, and the days you have studied.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".lic .sblock"],
    title: "Your stamp",
    text: "Built around a three-character code of letters and numbers that is yours alone. It signs off every lesson you finish. You design it once, and it is yours for good.",
  },
  {
    section: "Licence", where: "/account/licence", find: [".profile .boxh .pill"],
    title: "See it as others do",
    text: "Your licence exactly as a classmate sees it when they open it.",
  },
  {
    section: "Licence", where: "/account/licence", find: [withText(".profile .box", /The walkthrough/)],
    title: "Your account",
    text: "Email, password, signing out, and this tour again whenever you want it.",
  },

  /* -------------------------------------------------------------- Preferences */
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Who greets you/i)],
    title: "Who greets you",
    text: "Choose the voice of the line at the top of your Flight Deck, and what it calls you.",
  },
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Fly solo/)],
    title: "How social, and Fly solo",
    text: "How much of the class you want on your screens. Fly solo hides you completely: nobody sees you, and you see nobody, until you turn it off.",
  },
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Your bar/)],
    title: "Your target",
    text: "The score you are aiming for. It cannot go below the 75% pass mark. The dial and Master Caution measure you against it.",
  },
  {
    section: "Preferences", where: "/account/preferences", find: [withText(".profile .box", /Blocked and muted/), ".profile .bl"],
    title: "Blocked and muted",
    text: "Block or mute anyone from their profile. Everyone you have is listed here, and you can undo it.",
  },

  /* --------------------------------------------------------------- Appearance */
  {
    section: "Appearance", where: "/account/appearance", find: [withText(".profile .block", /Panel lighting/i)],
    title: "Light or dark",
    text: "Light, dark, or Auto to follow your device.",
  },
  {
    section: "Appearance", where: "/account/appearance", find: [".profile .block-livery"],
    title: "Livery",
    text: "The colour Wingman is painted in. The preview under the swatches shows it before you leave the page.",
  },
  {
    section: "Appearance", where: "/account/appearance", find: [withText(".profile .block-livery", /Finish/)],
    title: "Finish",
    text: "Standard, or Manual: the whole app drawn in ink on paper, plain or ruled.",
  },
  {
    section: "Appearance", where: "/account/appearance", find: [withText(".profile .block", /Accessibility/)],
    title: "Comfort",
    text: "Smooth Air turns every animation off, and Plain Language switches to a clearer typeface. Text size is just above. Your choices follow you to every device.",
  },

  {
    section: "Ready", where: "/",
    title: "You are ready",
    text: "Learn it, prove it, keep it, with a class beside you the whole way.",
    note: "Never fly alone.",
    last: true,
  },
];
