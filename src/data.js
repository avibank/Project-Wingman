/* =============================================================================
   COURSE CONTENT — FOUR EMPTY AIRFRAMES.
   -----------------------------------------------------------------------------
   Four modules, and nothing inside them. This is the shipping state for the
   beta: the owner's own material goes in from here, and until it does every
   screen has to read as a shelf waiting to be filled rather than a product
   that was not finished.

   WHY THE MODULES STAY AND THE CHAPTERS GO. A module is a container the
   student recognises — the grid on the Flight Deck is the shape of the course
   and it is true whether or not anything is in it yet. A chapter called
   "Chapter 1" holding a lesson called "Lesson 1" is not a container, it is a
   placeholder wearing the clothes of real content: it makes the module screen
   look populated, it makes progress meters read "1 OF 3" against work nobody
   did, and it is the first thing a tester would click and the first thing
   that would disappoint them.

   NOTHING WAS DELETED FROM THE DATABASE. Progress rows, completions and
   quiz scores keyed to the old placeholder ids are orphaned, not removed —
   supabase/wipe-demo-content.sql is the separate, deliberate pass that clears
   them, and it is run by a person, not by a deploy.

   WHAT EVERY SCREEN HAS TO DO WITH THIS, and what was checked before it
   shipped: no screen may render a blank panel, and no empty state may say
   only that something is absent. Each one names what lands there and how it
   gets there. See the module screen's chapter list, the Library's two
   sections, the Flight Deck's hero card and module cards, and the route
   strip on Back on the ground.

   ADDING THE FIRST REAL MODULE is a data change here (and, for lessons and
   quizzes, a content document through src/lib/contentLoader.js) — not a code
   change anywhere else.

   THE FIRST REAL CHAPTER IS IN (2026-09-21), and it went in the way the
   paragraph above says it would: Module 13d's "Rotary Wing Aerodynamics" —
   its quiz, its study cards and the cards as a PDF — is in the content
   document, src/content/test-content.json, which `content.test` now loads
   for everyone. The chapter list below stays empty because the screens read
   the document once it is loaded; this file is what they draw before that.
   ========================================================================= */

/* THE NAMES ARE THE COURSE'S NOW; THE CODES ARE NOT TOUCHED (owner,
   2026-09-21). M1 is Module 13d, the one the class is on now, M2 is 13e and
   M4 is Module 10. M3 keeps "Module 3" until the owner decides what it is.

   ONLY `name` MOVED, AND THAT IS THE WHOLE POINT. Every progress row, quiz
   score, save, hour-meter entry and route is keyed to the CODE — `pw-quiz-
   scores`, `saves.module_id`, `/m/m1/...` — so renaming a module relabels it
   and re-points nothing. Renumbering the codes to match would have orphaned
   everything anybody has done in the app.

   M1 STAYS FIRST, and that is what makes it current. App.jsx takes the first
   `active` module as the default for the Flight Deck's hero card, so the
   module the students are on is the one the app opens on without a second
   switch saying so.

   THE SAME FOUR NAMES ARE IN src/content/test-content.json, and they have to
   agree: this list is what the Flight Deck draws until the content document
   has loaded, and the document's is what it draws after. Two spellings would
   rename a module in front of the student a frame after they arrived. */
const MODULES = [
  { code: "M1", name: "Module 13d", status: "active", order: 1 },
  { code: "M2", name: "Module 13e", status: "active", order: 2 },
  { code: "M3", name: "Module 3", status: "active", order: 3 },
  { code: "M4", name: "Module 10", status: "active", order: 4 },
];

/* Empty, and the shape is kept so that every reader of it keeps working
   unchanged the moment there is something to put in it.

   WRITTEN OPEN-BRACKET, NEWLINE, CLOSE-BRACKET ON PURPOSE.
   scripts/check-question-ids.mjs reads this file as TEXT: it slices from the
   CHAPTERS declaration to the first line that closes an array and evals what
   is between. Collapsed onto one line the slice finds no terminator and the
   prebuild step dies with "CHAPTERS is not iterable". An empty array written
   across two lines is the same value and a different file. */
const CHAPTERS = [
];

function chaptersForModule(moduleCode) {
  return CHAPTERS.filter((ch) => String(ch.code).split(".")[0] === moduleCode);
}

// The library is the one module surface that stays, so the shape stays too.
const PDFS = [];
function pdfsForModule() {
  return [];
}

const NAV = [];
const TRIVIA = [];

export { MODULES, CHAPTERS, chaptersForModule, PDFS, pdfsForModule, NAV, TRIVIA };
