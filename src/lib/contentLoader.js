// One loader. Content comes in through here and nowhere else, which is the
// only way "swapping in real content is a data change, not a code change" can
// actually be true — if the loader only works for the file it was written
// against, it has not been built.
//
// It takes the document shape and hands back the shape the screens read, so
// the two can differ and only this file has to know.
import { validateContent } from "./contentSchema.js";

const mmssToSeconds = (s) => {
  const m = /^(\d+):([0-5]\d)$/.exec(String(s || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function loadContent(doc, { strict = false } = {}) {
  const problems = validateContent(doc);
  if (problems.length) {
    // Loud, and it says where. A typo must not become a blank chapter that
    // gets debugged as a bug in the app.
    const msg = `Content failed validation:\n  ${problems.join("\n  ")}`;
    if (strict) throw new Error(msg);
    if (typeof console !== "undefined") console.error(msg);
  }

  const modules = (doc?.modules || []).map((m) => {
    // Papers name their chapter by TITLE ("Chapter 2") while the Library
    // filters by id. Resolved here rather than in the component, so the
    // component never has to know the two ways a chapter can be referred to.
    const idByTitle = Object.fromEntries((m.chapters || []).map((c) => [c.name, c.id]));
    const nameById = Object.fromEntries((m.chapters || []).map((c) => [c.id, c.name]));
    // Part 12 gives every object a scope — {module, chapter, lesson}, absent
    // levels null — and papers name their chapter by id there rather than by
    // title. Both spellings resolve here so no component learns two of them.
    const chapterOf = (p) =>
      (p.scope && p.scope.chapter) || idByTitle[p.chapter] || null;
    return {
    id: m.id,
    code: m.id,
    name: m.name,
    papers: (m.papers || []).map((p) => ({
      id: p.id,
      title: p.title,
      chapterId: chapterOf(p),                   // null = the whole module
      chapterTitle: nameById[chapterOf(p)] || p.chapter || null,
      scope: p.scope || null,
      file: p.file,
      pages: p.pages,
    })),
    /* DOWNLOADS (2026-09-21, owner request) — a file handed over whole, with
       no viewer. The href is resolved here, rooted at the site, because the
       Library sits at /m/m1/library and a relative "downloads/x.pdf" would
       be looked for under /m/m1/. Always an array, so a module with none
       draws nothing rather than being asked whether it has any. */
    downloads: (m.downloads || []).map((d) => ({
      id: d.id,
      title: d.title,
      file: d.file,
      href: `/${String(d.file || "").replace(/^\//, "")}`,
      pages: d.pages,
    })),
    chapters: (m.chapters || []).map((c) => ({
      id: c.id,
      code: c.id,
      title: c.name,
      quizId: c.quiz?.id,
      quizCount: c.quiz?.questions?.length,
      // lessonId on a question is new in Part 12: it is what lets a quiz
      // question point back at the moment it was taught.
      questions: (c.quiz?.questions || []).map((q, i) => ({ ...q, id: q.id || `${c.id}.Q${i + 1}` })),
      /* THE CHAPTER'S OWN STUDY CARDS, when it has them (2026-09-21, owner
         request). Until now the card set WAS the quiz, read the other way
         round. Module 13d's first chapter has a forty-question quiz and a
         hundred and seventy cards, and the quiz must stay forty — so the
         cards travel separately and the quiz questions are left exactly as
         they were. null, not [], when the chapter has none: that is what
         tells the bookmarks adapter to fall back to the quiz questions.

         The positional fallback id is the same compromise as the quiz's
         above: a runtime without an id still renders, and
         scripts/check-question-ids.mjs fails the build before one ships. */
      cards: Array.isArray(c.cards) && c.cards.length
        ? c.cards.map((q, i) => ({ ...q, id: q.id || `${c.id}.C${i + 1}` }))
        : null,
      scope: c.scope || null,
      lessons: (c.lessons || []).map((l) => ({
        id: l.id,
        code: l.id,
        title: l.name,
        // Seconds is what the player and the scrub need; the m:ss string is
        // only for display, so it is resolved here rather than in a component.
        duration: l.video?.seconds ?? mmssToSeconds(l.duration),
        video: l.video?.src || null,
        videoKind: l.video?.kind || null,
        // Part 13: the seeded watch state, and the thumbnail slot that stays
        // null until there is real video to take a frame from.
        durationS: l.durationS ?? l.video?.seconds ?? null,
        watchedS: l.watchedS ?? 0,
        thumb: l.thumb ?? null,
      })),
    })),
    };
  });

  // The lesson surface's three objects travel with the content, unchanged.
  // One table for threads: lessonId + t set is a comment and appears under
  // that video AND in People; lessonId null is a module post and appears in
  // People only. Nothing copies, so nothing can drift.
  return {
    modules,
    notes: doc?.notes || [],
    threads: doc?.threads || [],
    replies: doc?.replies || [],
    people: doc?.people || [],
    presence: doc?.presence || [],
    problems,
  };
}

export const findModule = (content, code) =>
  content.modules.find((m) => m.code === code) || content.modules[0];
