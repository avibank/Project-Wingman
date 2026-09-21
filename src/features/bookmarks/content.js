/* =====================================================================
   CONTENT ADAPTER — the only file that knows where Wingman keeps its data.
   Every Bookmarks screen reads content through these functions, so the
   screens never guess.
   ===================================================================== */

/** @typedef {{ id:string, moduleId:string, chapter:number, chapterId:string, stem:string, options:string[], answerIndex:number, explanation?:string, lessonId?:string, fromCards?:boolean }} Question — a quiz question or a study card; the two share a shape */
/** @typedef {{ id:string, moduleId:string, chapter:number, chapterId:string, lesson:number, title:string, durationSeconds:number, thumbnailUrl?:string }} Lesson */
/** @typedef {{ id:string, moduleId:string, title:string, pageCount:number }} Paper */
/** @typedef {{ id:string, name:string }} Module */

/* ---------------------------------------------------------------------
   THE APP HANDS ITS CONTENT IN; THIS FILE DOES NOT REACH FOR IT.
   ---------------------------------------------------------------------
   Wingman loads content asynchronously — `content.test` is on for everyone
   and the seeded document is a lazy chunk (moduleContent.js explains why) —
   so there is a real window in which the app is mounted and knows no
   questions at all. App.jsx calls provideContent() whenever what it knows
   changes, and screens re-render through useContentVersion().

   THREE-STATE LOOKUPS, AND THE REASON IS DESTRUCTIVE. `useSaves.resolve()`
   treats a save whose content it cannot find as dead, and `pruneMissing()`
   DELETES it from the server. Answering "no" while the content chunk is
   still in flight would empty a student's bookmarks on a slow connection,
   permanently, with nothing on screen to say so. So a lookup answers:

     an object   — here it is
     null        — this is gone; the author deleted it
     undefined   — ask again later; nothing is known about this module yet

   Only null prunes. Undefined holds.
   --------------------------------------------------------------------- */
import { useSyncExternalStore } from "react";
import { path as routePath } from "../../lib/routes.js";
import { track as fire } from "./track.js";

let app = {
  doc: null,                      // the loaded content document, or null
  modules: [],                    // [{ id, name }] in display order
  currentModuleId: null,
  papers: new Map(),              // moduleId -> Paper[] | undefined while unknown
  smoothAir: false,
};
let version = 0;
const subs = new Set();
const bump = () => { version += 1; subs.forEach((f) => f()); };

/** App.jsx feeds this. Every field is optional; what is not passed is kept. */
export function provideContent(next) {
  app = { ...app, ...next };
  bump();
}
/** Papers arrive per module, from the database as well as the document. */
export function providePapers(moduleId, papers) {
  if (!moduleId) return;
  const had = app.papers.get(moduleId);
  if (had && had.length === papers.length && had.every((p, i) => p.id === papers[i].id)) return;
  app.papers = new Map(app.papers).set(moduleId, papers);
  bump();
}
export function resetContent() {
  app = { doc: null, modules: [], currentModuleId: null, papers: new Map(), smoothAir: false };
  bump();
}

/** Re-renders a screen when the app learns something new. */
export const useContentVersion = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => version);

const moduleOf = (id) => app.doc?.modules.find((m) => m.code === id) || null;
/* A chapter's NUMBER is its place in the module, because that is what the
   word "Chapter 3" means here; its identity for routing is its id (M1.03).
   Nothing is saved against the number — a save points at ref_id — so
   renumbering a module relabels a bookmark rather than re-pointing it. */
const chapterAt = (m, n) => (m?.chapters || [])[n - 1] || null;

/* `fromCards` says which list a card came from, because the card's face
   names it: a chapter's own study card is not a question from its quiz, and
   "Chapter 1 quiz" over one would be untrue (2026-09-21). */
const asQuestion = (q, m, c, n, fromCards = false) => ({
  id: q.id,
  moduleId: m.code,
  chapter: n,
  chapterId: c.id,
  stem: q.question,
  options: q.options || [],
  answerIndex: q.correct,
  explanation: q.explain || undefined,
  lessonId: q.lessonId || undefined,
  fromCards: fromCards || undefined,
});

const asLesson = (l, m, c, n, i) => ({
  id: l.id,
  moduleId: m.code,
  chapter: n,
  chapterId: c.id,
  lesson: i + 1,
  title: l.title,
  durationSeconds: l.durationS || l.duration || 0,
  thumbnailUrl: l.thumb || undefined,
});

export const content = {
  /** Every module the student can open, in display order. */
  modules() { return app.modules; },

  /** The module the Flight Deck hero card is showing, so the bag and Bookmarks agree. */
  currentModuleId() { return app.currentModuleId || app.modules[0]?.id || null; },

  /* A MODULE ID OUT OF A URL, MATCHED HOW A PERSON WOULD WRITE IT.
     This app's ids are "M1"; `/bookmarks?m=m1` is what a person types and what
     the design's own demo links to, and it matched nothing — so the screen
     said "nothing saved yet" to somebody with a folder full of bookmarks, in
     silence, with the right rows loaded and filtered out one line later.
     Unknown ids still fall through to null, so a nonsense one is still a
     nonsense one. 'all' is not a module and passes straight back. */
  moduleId(raw) {
    if (!raw || raw === 'all') return raw || null;
    const want = String(raw).toLowerCase();
    return app.modules.find((m) => String(m.id).toLowerCase() === want)?.id ?? null;
  },

  /** One question OR study card by its stable id. undefined while its module is unknown.
   *
   *  CARDS ARE LOOKED FOR TOO (2026-09-21). A chapter can now carry its own
   *  card set apart from its quiz, and a card saved from that set is a
   *  `card` row whose ref_id is the CARD's id. Searching the quiz alone
   *  would answer null for it — and null PRUNES, which deletes the save
   *  from the server (see the header). So both lists are searched, and
   *  check:question-ids keeps an id from meaning two things across them. */
  question(id) {
    if (!app.doc) return undefined;
    for (const m of app.doc.modules) {
      const chapters = m.chapters || [];
      for (let n = 0; n < chapters.length; n++) {
        const c = chapters[n];
        const q = (c.questions || []).find((x) => x.id === id);
        if (q) return asQuestion(q, m, c, n + 1);
        const card = (c.cards || []).find((x) => x.id === id);
        if (card) return asQuestion(card, m, c, n + 1, true);
      }
    }
    return null;
  },

  /** The questions of one chapter quiz, in quiz order. The quiz and nothing else — see cardSet. */
  quizQuestions(moduleId, chapter) {
    const m = moduleOf(moduleId);
    if (!m) return app.doc ? [] : undefined;
    const c = chapterAt(m, Number(chapter));
    if (!c) return [];
    return (c.questions || []).map((q) => asQuestion(q, m, c, Number(chapter)));
  },

  /* THE CARD SET IS NO LONGER ALWAYS THE QUIZ (owner, 2026-09-21).
     It used to be, by definition: quizQuestions() was the card set and every
     screen that drew one called it. Module 13d's first chapter has a quiz of
     forty and a set of a hundred and seventy cards, and the quiz has to stay
     forty. So a chapter that carries `cards` has those as its set, and one
     that does not falls back to its quiz questions exactly as before.
     Everything that builds a card set asks here — the Library's Study cards
     rows and the card set page — so the choice is made in one place.
     Same three answers as the rest of this file: undefined while the module
     is unknown, [] for a chapter with nothing to flip. */
  /** The study cards of one chapter, in order: its own `cards` if it has them, else its quiz questions. */
  cardSet(moduleId, chapter) {
    const m = moduleOf(moduleId);
    if (!m) return app.doc ? [] : undefined;
    const c = chapterAt(m, Number(chapter));
    if (!c) return [];
    const own = Array.isArray(c.cards) && c.cards.length;
    return (own ? c.cards : (c.questions || []))
      .map((q) => asQuestion(q, m, c, Number(chapter), !!own));
  },

  /** The chapters of a module that have a card set to flip, as display numbers. */
  cardChapters(moduleId) {
    const m = moduleOf(moduleId);
    if (!m) return [];
    return (m.chapters || [])
      .map((c, i) => ((c.cards || []).length || (c.questions || []).length ? i + 1 : 0))
      .filter(Boolean);
  },

  /** The chapters of a module that have a quiz, as display numbers: [1, 2, 3]. */
  quizChapters(moduleId) {
    const m = moduleOf(moduleId);
    if (!m) return [];
    return (m.chapters || [])
      .map((c, i) => ((c.questions || []).length ? i + 1 : 0))
      .filter(Boolean);
  },

  /** The title of one chapter, for a heading. */
  chapterTitle(moduleId, chapter) {
    return chapterAt(moduleOf(moduleId), Number(chapter))?.title || `Chapter ${chapter}`;
  },

  /** One lesson by id. undefined while nothing is loaded. */
  lesson(id) {
    if (!app.doc) return undefined;
    for (const m of app.doc.modules) {
      const chapters = m.chapters || [];
      for (let n = 0; n < chapters.length; n++) {
        const c = chapters[n];
        const i = (c.lessons || []).findIndex((l) => l.id === id);
        if (i >= 0) return asLesson(c.lessons[i], m, c, n + 1, i);
      }
    }
    return null;
  },

  /** One paper by id. undefined until that module's papers have been listed. */
  paper(id) {
    for (const [moduleId, list] of app.papers) {
      const p = (list || []).find((x) => x.id === id);
      if (p) return { id: p.id, moduleId, title: p.title, pageCount: p.pages || 0 };
    }
    /* A paper lives in the database and is listed one module at a time, so a
       paper this session has never listed is UNKNOWN rather than gone. Saying
       "gone" would prune the save off the server (see the header). A page past
       the end of a paper we DO hold is answered by useSaves, which can see the
       page count. */
    return undefined;
  },

  /** True when the app's Smooth Air setting is on. */
  smoothAir() { return app.smoothAir; },

  /** The app's analytics, which already has a sink and a closed name list. */
  track(name, props) { fire(name, props); },
};

/* Where each saved thing opens. Paths come from src/lib/routes.js — the app
   never constructs one by hand, and neither does this. The three that need
   more than their own id resolve it through the adapter above, because a
   lesson's address carries its module and chapter and a save carries neither. */
export const routes = {
  flightDeck: () => routePath.home(),
  bookmarks: () => "/bookmarks",
  folder: (kind) => `/bookmarks/${kind}`,                      // questions | cards | videos | pages
  module: (moduleId) => routePath.module(moduleId),
  library: (moduleId) => routePath.library(moduleId),
  quizzes: (moduleId) => routePath.library(moduleId, "quizzes"),
  cardSet: (moduleId, chapter) => `${routePath.library(moduleId)}/cards/${chapter}`,
  quiz: (moduleId, chapter) => {
    const c = chapterAt(moduleOf(moduleId), Number(chapter));
    return c ? routePath.chapter(moduleId, c.id, "quiz") : routePath.module(moduleId);
  },
  questionInQuiz: (q) => routePath.chapter(q.moduleId, q.chapterId, "quiz"),
  lessonAt: (lessonId, seconds) => {
    const l = content.lesson(lessonId);
    if (!l) return routePath.home();
    return `${routePath.lesson(l.moduleId, l.chapterId, l.id)}?t=${Math.max(0, seconds | 0)}`;
  },
  readerAt: (paperId, page) => {
    const p = content.paper(paperId);
    if (!p) return routePath.home();
    return `${routePath.paper(p.moduleId, p.id)}?page=${Math.max(1, page | 0)}`;
  },
};

/* Plain helpers every screen uses — no data guessing, only facts stored at save time. */
export const fmtTime = (s) => { s = Math.max(0, s | 0); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
export const letter = (i) => 'ABCDEFGH'[i] ?? '?';
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
