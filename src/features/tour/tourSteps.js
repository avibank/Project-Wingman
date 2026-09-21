/* =============================================================================
   FIRST FLIGHT — the tour, as a list of places rather than a slideshow.
   -----------------------------------------------------------------------------
   A new student opens Wingman and sees a Flight Deck, four modules, a Library,
   a Ready Room, a licence and a bag. Nothing on any of those screens explains
   what it is FOR, and the vocabulary is deliberately aviation's — logbook,
   briefing, debrief, squawk — so a student who has not been told is guessing
   at a second language on top of the one they came to learn.

   SO THE TOUR IS THE APP, NOT A VIDEO OF IT. Every step points at a real
   control on the real screen, and moving to the next step navigates there —
   which means by the end the student has been to every room in the building
   and watched it light up. A carousel of screenshots teaches the screenshots.

   THREE RULES IT KEEPS, all of them the app's own:

   · NO DEAD ENDS. A step whose target is not on the screen is SKIPPED, not
     shown pointing at nothing. Content arrives module by module and a tour
     that breaks the day a chapter is added is worse than no tour.
   · EVERY STEP NAMES THE NEXT ACTION inside the sentence (§10). None of them
     says what is missing.
   · IT CAN ALWAYS BE LEFT, and leaving is not failing — "Find your own way"
     ends it and marks it done, so nobody is asked twice.

   `find` is the selector the spotlight cuts around. `where` is the address the
   step lives at; the tour navigates there and waits. `fallback` is where to
   look if the first selector is not there — a module with no chapters has no
   chapter row, and the step still has something true to point at.
   ========================================================================= */

export const TOUR_KEY = "pw-tour";

export const STEPS = [
  {
    id: "deck",
    where: "/",
    find: ".deck .mod, .modules-grid",
    title: "This is the Flight Deck",
    body: "Everything starts here. Your modules are below, and the row of instruments above them tells you how you are doing — hours flown, what you have saved, and whether anything needs another look.",
    place: "below",
  },
  {
    id: "module",
    where: "/",
    find: ".deck .mod",
    title: "A module is a subject",
    body: "Open one and it stays open. The lamp on a card lights when that module's average has slipped under your own pass mark — nothing at all when it has not.",
    action: "Open Module 1",
    goes: "/m/m1",
  },
  {
    id: "tabs",
    where: "/m/m1",
    find: ".mtabs",
    title: "Three tabs, and the work is in the middle one",
    body: "Lessons is where the videos will be. Library is where the quizzes, the study cards and the papers are. Crew is everybody else on this module.",
    place: "below",
  },
  {
    id: "library",
    where: "/m/m1",
    find: '.mtabs button:nth-child(2), .mtabs [data-mt="library"]',
    title: "Open the Library",
    body: "This is the one you will spend your time in. A quiz for every chapter, the same questions again as cards you can flip, and the papers on the shelf beneath them.",
    action: "Show me",
    goes: "/m/m1/library",
  },
  {
    id: "quiz",
    where: "/m/m1/library",
    /* THE ROW, THEN THE SECTION, THEN THE TAB. With no chapters in the module
       the Library draws its waiting state instead of a Quizzes section, so the
       first two selectors match nothing — and a step that hunts for 2.6s and
       then jumps is the tour looking broken on the screen it most needs to
       look right. The last one is always there. */
    find: 'section[aria-labelledby="lsec-quizzes"] .lrow, section[aria-labelledby="lsec-quizzes"], .libtab .cempty, .libtab',
    title: "A quiz is a paper, not a practice",
    body: "You answer everything, hand it in, and then go through it. The clock is twenty minutes, because the real one is timed — and it stops the moment you leave the page, so you can put it down.",
    place: "below",
  },
  {
    id: "cards",
    where: "/m/m1/library",
    find: ".papers .lrow, .libtab",
    title: "Study cards are the same questions, the other way round",
    body: "Flip them, and keep the ones worth another look. Anything you keep lands in your bag.",
    place: "below",
  },
  {
    id: "papers",
    where: "/m/m1/library",
    find: 'section[aria-labelledby="lsec-papers"]',
    title: "Papers open in Wingman",
    body: "Handouts and past papers open here rather than downloading — one press on the page counter bookmarks where you are, and one on your initials takes the file to your device.",
    place: "above",
    optional: true,
  },
  {
    id: "bag",
    where: "/",
    find: ".bm-bagcell, .bagcell",
    title: "Your flight bag",
    body: "Everything you bookmark — a question, a card, a moment in a lesson, a page in a paper — is in here, filed by kind. It counts the module you are in.",
    action: "Open the bag",
    goes: "/bookmarks",
  },
  {
    id: "folders",
    where: "/bookmarks",
    find: ".bm-folders, .bm-folder",
    title: "Four folders, and they fill themselves",
    body: "Questions, Study cards, Videos and Pages. Nothing to file by hand: bookmark a thing where you meet it and it is already in the right one.",
    place: "below",
  },
  {
    id: "room",
    where: "/",
    find: ".rrpill",
    title: "The Ready Room is where the class is",
    body: "Ask the module a question and anybody on it can answer. Squadrons are group chats. Nobody is graded on any of it and nothing you ask is on your record.",
    action: "Look in",
    goes: "/ready-room",
  },
  {
    id: "licence",
    where: "/account/licence",
    find: ".lic, [data-ref='licence-card']",
    title: "Your licence",
    body: "Your name, your callsign and your stamp — the mark that goes on everything you sign off. You make it once and it is yours; nobody can issue you a second.",
    place: "below",
  },
  {
    id: "bar",
    where: "/account/preferences",
    find: ".pref-bar, [data-ref='preferences']",
    title: "And your own pass mark",
    body: "Set the standard you want to be held to. Every lamp, dial and caution light in the app is measured against this number rather than against anybody else's.",
    place: "below",
    last: true,
  },
];

/* Where the card sits relative to the spotlight, when the step does not say. */
export const placeOf = (step) => step.place || "below";
