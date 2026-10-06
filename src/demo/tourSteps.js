/* =============================================================================
   THE TOUR’S SCRIPT — the approved wording, character for character.
   -----------------------------------------------------------------------------
   Handed over 2026-10-06 with one instruction about this file above all
   others: "Wording is final. Copy every title, line and button label
   character for character, including apostrophes and the one em dash in the
   Crew and Licence lines." So the curly apostrophes and the em dashes below
   are the ones that were signed off, not the ones a keyboard would give you.
   `npm run check:tour` compares this file against that list.

   `page` GROUPS STEPS THAT SHARE A SCREEN, and is what decides motion rather
   than the route: moving between different `page` values fades, moving within
   one glides. Module, Library and Crew are three sections of one `page`
   because they are three tabs of one screen, and a tab switch must not fade.

   `pane` and `panelTab` are instructions to the page, not routes. The engine
   asks the app to put the screen in that state before it frames anything.
   ========================================================================= */

export const TOUR_BETA_NOTE = true;

export const BETA_NOTE = {
  kicker: "Beta",
  title: "Thanks for being here",
  text: "We’re really excited to finally share Wingman with you. It’s still in beta, so a lot of it isn’t final yet. Things will move around, change, and hopefully get better, and a lot of that depends on you. If something feels off or confusing, or you just have an idea, tell us and we’ll do our best to make it happen.",
  note: "To my class: the quizzes and question banks I used to send you on Wayground and WhatsApp are now right here in Wingman. They work just like before, only now everything’s in one place. I’ll add new batches as I get through them.",
  cta: "Let’s go",
};

export const TOUR_STEPS = [
  { section: "Welcome", page: "deck", route: "/", target: null,
    title: "Welcome aboard",
    text: "Wingman is a study app made by aircraft maintenance students, for aircraft maintenance students. We’re building it for one reason: a thriving community of future AMEs who get through this together." },

  { section: "Flight Deck", page: "deck", route: "/", whole: true,
    title: "This is your Flight Deck",
    text: "Your home screen. Everything on it follows the module you’re on right now." },
  { section: "Flight Deck", page: "deck", route: "/", target: "deck-hero",
    title: "Pick up where you left off",
    text: "The big card takes you straight back to whatever you were last doing. Under it are four dials: your average on this module, your bag of saved stuff, the hours you’ve actually spent studying it, and a radar showing who else is around. Switch modules and all four switch with you." },
  { section: "Flight Deck", page: "deck", route: "/", target: "deck-modules",
    title: "Your modules",
    text: "The little flight path on each card shows how far along you are, from takeoff to landing. A Master Caution light means your average on that module has dropped below your bar. You can set your bar in Preferences." },

  { section: "Back on the ground", page: "deck", route: "/", target: "deck-ground",
    title: "Back on the ground",
    text: "Everything down here is the social side of Wingman. It’s your way in to everyone studying alongside you." },
  { section: "Back on the ground", page: "deck", route: "/", target: "deck-route",
    title: "On your route",
    text: "It’s easy to feel like you’re the only one falling behind, and you usually aren’t. So your classmates are on the same flight path as you, each sitting at the chapter they’re on." },
  { section: "Back on the ground", page: "deck", route: "/", target: "deck-rightseat",
    title: "Your right seat",
    text: "Studying with a friend just works better, so we built it in. Pick someone from your squadron and they take your right seat. You can see what they’re working on, compete on quizzes, and push each other through the tough chapters." },
  { section: "Back on the ground", page: "deck", route: "/", target: "deck-squadron",
    title: "Your squadron",
    text: "A squadron is your study group, and this is its group chat. It’s the place for the questions you’d feel silly asking the whole class. Join one or start your own." },
  { section: "Back on the ground", page: "deck", route: "/", target: "deck-thread",
    title: "Module threads",
    text: "Every module has its own question board, because chances are someone has already asked what you’re about to ask. Post a question, anyone on the module can answer, and the class backs the good answers." },

  { section: "Module", page: "module", route: "/m/m1", whole: true,
    title: "A module, and everything in it",
    text: "Lessons is for videos. Library has the quizzes, question banks and study cards. Crew is the module’s social side: who’s studying it and how far along they are." },
  { section: "Library", page: "module", route: "/m/m1/library", whole: true,
    title: "The Library",
    text: "Each chapter’s quiz, question bank and study cards are all in one place. We’re also working on shared study material. Everyone will be able to highlight it and take notes on it, so the whole class ends up studying from one shared copy for the unified exams." },
  { section: "Crew", page: "module", route: "/m/m1/crew", whole: true,
    title: "Crew: your class, chapter by chapter",
    text: "Who has signed each chapter off, who is on it right now, and who is a little ahead. It is here so that when you are stuck you can find the person sitting at exactly your problem — or the one who was sitting at it last week and remembers how it went." },

  { section: "Lesson", page: "lesson", route: "/m/m1/M1.02/lesson/M1.02.2", target: "lesson-logbook", panelTab: "logbook",
    title: "Your logbook",
    text: "Anything you write while watching is saved with the exact time in the video. Tap the note later and you jump straight back to that moment." },
  { section: "Lesson", page: "lesson", route: "/m/m1/M1.02/lesson/M1.02.2", target: "lesson-logbook", panelTab: "comments",
    title: "Comments",
    text: "People can answer your comment right there on the lesson. It also shows up as a thread in the Ready Room, so people who aren’t on that lesson can see it and answer too." },

  { section: "Ready Room", page: "ready-room", route: "/ready-room/m1", pane: "squadron:night-shift", whole: true,
    title: "The Ready Room",
    text: "Your right seat, your squadrons and every module’s questions all live here, in one place." },
  { section: "Ready Room", page: "ready-room", route: "/ready-room/m1", pane: "right-seat", target: "rr-rightseat",
    title: "Right seat",
    text: "The people you’ve studied with lately sit at the top. Tap one to ask them into your right seat, or open the full list to find someone else from your squadron." },
  { section: "Ready Room", page: "ready-room", route: "/ready-room/m1", pane: "squadron:night-shift", target: "rr-squadrons",
    title: "Squadrons",
    text: "Every squadron you’re in, with the latest chat at the top. Open one and it’s a normal group chat, the same one you see on your Flight Deck, just with more room." },
  { section: "Ready Room", page: "ready-room", route: "/ready-room/m1", pane: "module:m1", target: "rr-modules",
    title: "Module threads",
    text: "Each module has its own board of questions, including the ones that started as comments on a lesson. Open one to see every thread, and filter by Yours, Answered or All." },

  { section: "Licence", page: "licence", route: "/account/licence", whole: true,
    title: "Your licence, and the stamp you sign with",
    text: "In this trade a signature on a certificate is a stamp, so that is what signing off a chapter puts on it. You design yours once — shape, pattern, ink, and a code of up to three characters that is yours alone — and it turns up on every chapter you sign, on the board after a quiz, and under the quizzes you have finished." },
  { section: "Preferences", page: "preferences", route: "/account/preferences", whole: true,
    title: "Your bar, and the quiet switch",
    text: "This is where you set your bar, the average you want to hold yourself to. It can’t go below 75%, since that’s the pass mark. Fly solo is here too, for when you’d rather keep your head down for a while and stay off other people’s boards." },

  { section: "Ready", page: "deck", route: "/", target: null,
    title: "That’s everything for now",
    text: "Go make your licence, and we’ll see you in there.",
    cta: "Create my licence" },
];
