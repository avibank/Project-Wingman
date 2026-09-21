/* =============================================================================
   THE DEMO, STEP BY STEP.
   -----------------------------------------------------------------------------
   The owner's brief (2026-09-21): walk the real site, tab by tab. First the
   Flight Deck and everything on it, then a module in all its states, then the
   Ready Room, and last the profile. Explain what each thing is, why it is
   there and how to use it, plainly: this is a new student's first impression,
   and a clever sentence costs them a second read. The app is a study app and
   a social hub, made by students for students; the motto is Never fly alone.
   No organisation is named anywhere.

   Every step is on the real screen, with the demo's class in it (seed.js).
     where  the address the step shows; the guide goes there first
     find   what the light is drawn round; a list, first match wins; none
            means the whole screen is dimmed and the card sits in the middle
     act    something to do once the screen is there (open a chat, say)
     what / why / how   the three things every step answers
     body   instead of the three, for the welcome and the end

   Every claim is checked against the app, not the brief: the 75% pass mark
   and the 20-minute clock (quiz.js), the target that only goes up
   (minimums.js), the ticks (0027), the hour meter stopping on a hidden tab
   (hobbs.js), and the numbers in the demo's own class.
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
   that is not on screen opens it first. On a wide screen it is already there
   and nothing is pressed. */
const unless = (sel, act) => () => { if (!shown(sel)) act(); };
const firstQuestion = () => document.querySelector(".rr-fopen")?.click();
/* Back to the rail on a phone: the room keeps whichever column was open, so
   its own back button is pressed until the rail is the one showing. */
const toRail = () => {
  let n = 0;
  const step = () => {
    if (shown(".rr-rail") || n++ > 3) return;
    document.querySelector(".rr-backbtn")?.click();
    setTimeout(step, 180);
  };
  step();
};

export const SECTIONS = ["Welcome", "Flight Deck", "The module", "Ready Room", "Your profile", "Done"];

export const STEPS = [
  {
    section: "Welcome", where: "/",
    title: "Welcome to Wingman",
    body: [
      "Wingman is a study app and a social hub for Part-66 aircraft maintenance students, made by students for students.",
      "You learn each module through short lessons, practice exams and study cards, and you do it alongside the people studying the same module. Our motto is Never fly alone.",
      "This is a demo with a class already in it. Nothing in it is saved to your account. Swipe or use the arrow keys to move through it.",
    ],
  },

  /* ------------------------------------------------------------ the Flight Deck */
  {
    section: "Flight Deck", where: "/", find: [".deck .title"],
    title: "The Flight Deck",
    what: "Your home screen, and the first thing you see every time you open Wingman.",
    why: "So you never have to work out where you were. What you are in the middle of, and anything that needs you, is on this one page.",
    how: "Tap Wingman at the top left of any screen to come back here.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .card .cardbody", ".deck .card"],
    title: "Pick up where you left off",
    what: "The card at the top shows the last thing you were doing. Here it is a lesson in Algebra, stopped five minutes in.",
    why: "Study happens in short sessions. Starting again should take one tap, not a search.",
    how: "Tap Resume and you are back in that lesson at the same moment.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(1)"],
    title: "Your average, against your target",
    what: "The dial shows your average exam score on this module. It reads 77% here, which is 8 points under this student's target of 85%.",
    why: "An average hides nothing. One weak chapter pulls it down, and you see it here long before the real exam does.",
    how: "Tap the dial to open this module's exams. On your first day it waits for your first exam.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(2)"],
    title: "Your flight bag",
    what: "The bag counts what you have saved in this module: questions, study cards and moments in lessons. There are five here.",
    why: "Revision works best on the things you found hard. Saving them as you go builds that list for you.",
    how: "Tap the bookmark on anything to save it, then tap the bag to open your Bookmarks.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(3)"],
    title: "Time on this module",
    what: "The meter counts the hours and minutes you have studied this module: lessons, exams and cards.",
    why: "It is an honest record of effort. It only runs while the app is on screen, so a tab left open overnight adds nothing.",
    how: "Nothing to do. It runs as you study. Tap it to open the module.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .strip > :nth-child(4)"],
    title: "Who is studying right now",
    what: "The radar shows classmates who are online at this moment.",
    why: "It is easier to keep going when you can see you are not the only one, and a question gets answered faster when people are around.",
    how: "Tap the radar to go to the Ready Room and talk to them.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .sec"],
    title: "Your modules",
    what: "Every Part-66 module you study has a card. The line on each card is your progress through its chapters.",
    why: "You can see at a glance which modules are moving and which have stalled.",
    how: "Tap a module to open it.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .rail .mod"],
    title: "The Master Caution light",
    what: "When a module's average drops below your target, its card lights a Master Caution. Mathematics is lit because its average is 77% against a target of 85%.",
    why: "It only lights when something needs you, so when it is lit, it means it.",
    how: "Open the module, find the chapter pulling the average down, and sit its exam again.",
  },
  {
    section: "Flight Deck", where: "/", find: [".deck .bog"],
    title: "Back on the ground",
    what: "The social side of your home screen: who is on your route, unread messages from your squadrons, open questions on your modules, and your right seat.",
    why: "You study with a crew. This is where you see them without leaving home.",
    how: "Tap any line to go straight to it in the Ready Room.",
  },

  /* --------------------------------------------------------------- the module */
  {
    section: "The module", where: "/m/m1", find: [".ref-mod .mod", ".mscreen"],
    title: "Inside a module",
    what: "A module is one Part-66 subject, split into chapters. This is Mathematics, with four chapters.",
    why: "A chapter is small enough to finish in a sitting, so there is always a next step you can see.",
    how: "The tabs underneath are Lessons, Library and Crew. Each one is next.",
  },
  {
    section: "The module", where: "/m/m1", find: [".mtabs + *", ".card[data-ref='module-panel']"],
    title: "Lessons",
    what: "Short videos, chapter by chapter. A lesson you have finished is signed off with your stamp, and the one you are on shows how much is left.",
    why: "Short lessons fit between shifts and lectures, and the stamps show you exactly what is done.",
    how: "Tap a lesson to watch it. Save a moment with the bookmark to find it again later.",
  },
  {
    section: "The module", where: "/m/m1/library", find: ["section[aria-labelledby='lsec-quizzes']", ".libtab"],
    title: "The Library",
    what: "Every chapter has a practice exam and a set of study cards made from the same questions. Your score sits beside each exam, and one below the pass mark says so.",
    why: "Lessons teach it. The Library is where you prove it, as many times as you like.",
    how: "Tap an exam to sit it, or a card set to revise it.",
  },
  {
    section: "The module", where: "/m/m1/M1.03/quiz", find: [".exam-frame", ".exam-page"],
    title: "Practice exams work like the real one",
    what: "You answer every question, then hand the paper in. Nothing is marked until you do. You have 20 minutes and the pass mark is 75%, the same as the real exam.",
    why: "Practising under exam conditions means the real one holds no surprises.",
    how: "Answer each question and hand it in. Every question you missed is shown with the correct answer beside it. If you leave, the clock stops and the paper waits for you.",
  },
  {
    section: "The module", where: "/m/m1/library/cards/2", find: [".cards-page", ".deck main", "main"],
    title: "Study cards",
    what: "The same questions as the exam, one at a time, as cards.",
    why: "The exam tests recall. A card makes you remember the answer rather than recognise it.",
    how: "Think of your answer, flip the card to check it, and keep the cards you want to see again.",
  },
  {
    section: "The module", where: "/m/m1/crew", find: [".crew", ".card[data-ref='module-panel']"],
    title: "Crew",
    what: "Everybody studying this module, and the chapter each of them has reached. Twelve people are on Mathematics here, and eight of them are studying right now.",
    why: "Finding someone at the same chapter as you is how study partners find each other.",
    how: "Tap a person to see their licence. To study unseen, turn on Fly solo in Preferences.",
  },
  {
    section: "The module", where: "/m/m1/library",
    title: "The reader: one PDF for the whole module",
    body: [
      "Wingman also has a reader for PDFs shared across a whole module: handouts and notes that everyone on the module reads, marks up and discusses on the page itself.",
      "A note one student leaves on a hard page helps the whole class. It opens to students next, and shared papers will appear in the Library when it does.",
    ],
  },

  /* ----------------------------------------------------------- the Ready Room */
  {
    section: "Ready Room", where: "/ready-room", find: [".rr-app"],
    title: "The Ready Room",
    what: "Where students talk: a question board for every module, group chats called squadrons, and your right seat.",
    why: "Nobody should be stuck on the same page alone at midnight. This room is what Never fly alone means.",
    how: "Open it from the Ready Room button at the top of any screen.",
  },
  {
    section: "Ready Room", where: "/ready-room/m1", find: [".rr-threads", ".rr-feed"],
    act: unless(".rr-threads", clickText(".rr-rail", "Mathematics")),
    title: "Ask the module",
    what: "Each module has a question board. Anyone studying the module can ask, and anyone can answer.",
    why: "Someone has always just understood what you are stuck on, and their answer stays here for the next person.",
    how: "Tap Ask to post a question. Vote up questions you want answered too.",
  },
  {
    section: "Ready Room", find: [".rr-detail", ".rr-answers", ".rr-pane"],
    act: unless(".rr-detail", firstQuestion),
    title: "Answers, most helpful first",
    what: "Answers sit under the question. The person who asked signs off the answer that solved it, and it moves to the top.",
    why: "A signed-off answer tells everyone reading later which one to trust.",
    how: "Write an answer in the box at the bottom, and endorse the answers that helped you.",
  },
  {
    section: "Ready Room", where: "/ready-room", find: [".rr-rail"], act: toRail,
    title: "Squadrons",
    what: "A squadron is a group chat for a small group studying together. You can start one, or join one from Find one.",
    why: "A small group keeps each other going, agrees exam dates and shares what works.",
    how: "Tap a squadron to open its chat. Night Shift opens next.",
  },
  {
    section: "Ready Room", find: [".rr-chat", ".rr-pane"],
    act: clickText(".rr-rail", "Night Shift"),
    title: "The squadron chat",
    what: "A normal group chat, with ticks that tell the truth: one grey tick until everyone has the message, two grey once they do, and blue once everyone has read it.",
    why: "You know when a message has actually been seen, not only sent.",
    how: "Type at the bottom to reply. Right click a message, or long press on a phone, to react, reply, pin or report it.",
  },
  {
    section: "Ready Room", where: "/ready-room", find: [".rr-seats", ".rr-rail"], act: toRail,
    title: "Your right seat",
    what: "Squadron mates who are online appear at the top, under Right seat. Your right seat is one of them, studying alongside you right now, like the second pilot in the cockpit.",
    why: "Working at the same time as one other person keeps you both going, and the seat ends by itself when you stop.",
    how: "Tap a classmate to ask them into your right seat. You can message each other while you both work.",
  },

  /* ------------------------------------------------------------- the profile */
  {
    section: "Your profile", where: "/account/licence", find: [".lic", "[data-ref='licence-card']", ".ref-lic"],
    title: "Your licence",
    what: "Your profile: your name, your callsign, your stamp, and three numbers: hours studied, lessons signed off and days you studied.",
    why: "It is how classmates recognise you, and a record of the work you have put in.",
    how: "Tap See it as others do to check what classmates see. The cover, photo and phrase are yours to change.",
  },
  {
    section: "Your profile", where: "/account/licence", find: [".sblock", ".lic-stamp", ".lic"],
    title: "Your stamp and your code",
    what: "Your stamp is an emblem built around a code of three letters or numbers, like A7K. It marks every lesson and chapter you complete.",
    why: "It makes your work yours. Nobody else has your code.",
    how: "You choose the code and design the stamp once. They are issued together and cannot be changed, so take your time.",
  },
  {
    section: "Your profile", where: "/account/preferences", find: [".pref-bar", "[data-ref='preferences']", "main"],
    title: "Preferences",
    what: "Set your target score, which every warning light in the app measures you against, and turn on Fly solo if you want to study unseen.",
    why: "The pass mark is 75%. Aiming higher leaves you room for a bad day in the real exam.",
    how: "Your target starts at 75% and can only go up.",
  },
  {
    section: "Your profile", where: "/account/appearance", find: ["main"],
    title: "Appearance",
    what: "Choose the colours, day or night, and the size of the text. Smooth Air turns every animation off.",
    why: "You will spend hours here. It should be comfortable to look at.",
    how: "Changes apply straight away, on every device you sign in on. The walkthrough can be replayed from the foot of your Licence.",
  },

  {
    section: "Done", where: "/",
    title: "That is Wingman",
    body: [
      "Lessons to learn it, exams to prove it, cards to remember it, and a class around you the whole way. Made by students, for students.",
      "The demo ends here and nothing from it is kept. Your own Flight Deck fills as you study.",
      "Never fly alone.",
    ],
    last: true,
  },
];
