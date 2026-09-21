/* =============================================================================
   THE WALKTHROUGH — what it says, slide by slide.
   -----------------------------------------------------------------------------
   Written for somebody who has never heard of Wingman and has not yet opened
   anything in it. So every slide says what a thing IS and what it is FOR, in
   plain sentences, before it uses a single one of the app's own names; and
   once it has used one ("Flight Deck", "Ready Room", "Crew") it says where
   that is. Nothing is clever. A student reading this is deciding whether the
   app is worth their evening, and a joke costs them a second read.

   It USED TO BE a spotlight over the live app (2026-09-21, first version):
   each step navigated the real screen and waited for the element it pointed
   at. That is why it felt slow. Every step was a route change, a lazy chunk
   and a hunt for a selector. The owner asked for a walkthrough you swipe
   through, smoothly, and that cannot be done over a page that is still
   loading. So each slide carries its own drawing of the thing it describes
   (Scenes.jsx), and moving between them is one transform.

   Every claim here is checked against the app rather than the brief: the
   pass mark (quiz.js), the twenty minutes (quiz.js), the clock stopping when
   you leave (the exam lock), the four folders, the menu's five rows.
   ========================================================================= */

export const TOUR_KEY = "pw-tour";

export const SLIDES = [
  {
    id: "welcome",
    title: "Wingman helps you pass your Part-66 exams",
    body: "Part-66 is the licence for aircraft maintenance engineers, and it is examined one module at a time. Wingman gives you practice exams, study cards and reference papers for each module, and a place to ask other students for help. This walkthrough takes about two minutes.",
  },
  {
    id: "deck",
    title: "The Flight Deck is your home screen",
    body: "It lists your modules and shows how you are doing: how long you have studied, how much you have saved, and a warning light on any module where your average has dropped below the score you are aiming for. Open a module from here.",
  },
  {
    id: "module",
    title: "Each module is split into chapters",
    body: "A module has three tabs. Library holds the practice exams, study cards and papers for every chapter. Lessons holds video lessons as they are added. Crew shows the other students on the module.",
  },
  {
    id: "exam",
    title: "Practice exams work like the real one",
    body: "Every chapter has a practice exam. You answer all the questions and then hand it in, so you only see your mark at the end. You have 20 minutes and need 75% to pass, the same pass mark as the real exam. Each question you missed is shown with the correct answer. If you leave the page, the clock stops.",
  },
  {
    id: "cards",
    title: "Study cards help you learn the answers",
    body: "The same questions also come as cards. Read the question, flip the card to check the answer, and save the ones you want to see again.",
  },
  {
    id: "papers",
    title: "Reference papers open inside the app",
    body: "Handouts and reference documents are in the Library too. Read them here, bookmark the page you are on, and download a copy to your device.",
  },
  {
    id: "bookmarks",
    title: "Everything you save is kept in one place",
    body: "Saved questions, study cards, moments in a video and pages are sorted into four folders in Bookmarks. The bag on the Flight Deck opens them.",
  },
  {
    id: "room",
    title: "The Ready Room is where students help each other",
    body: "Every module has a question board. Post a question and anyone studying that module can answer it. Squadrons are group chats you can start or join. Open it with the Ready Room button at the top of the screen.",
  },
  {
    id: "crew",
    title: "See who is studying with you",
    body: "The Crew tab shows the other students on a module and which chapter each of them has reached. If you would rather study privately, turn on Fly solo in Preferences: nobody will see you, and you will not see anyone else.",
  },
  {
    id: "bar",
    title: "Choose the score you are aiming for",
    body: "The pass mark is 75%, and in Preferences you can set your own target. The warning lights across the app compare your results with your target. In Appearance you can change the colours and turn the animations off.",
  },
  {
    id: "menu",
    title: "Settings and help are behind your initials",
    body: "The round button with your initials, at the top right, opens your licence, Preferences, Appearance and Bookmarks, and can play this walkthrough again. If anything looks wrong, the button in the bottom corner sends us a report.",
  },
  {
    id: "licence",
    title: "Last step: create your licence",
    body: "Your licence is your profile. On it is your stamp, an emblem built around a three-character code of letters and numbers that marks every chapter you complete. You choose the code and design the stamp together. Once they are issued, neither can be changed.",
  },
];
