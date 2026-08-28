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
    return {
    id: m.id,
    code: m.id,
    name: m.name,
    papers: (m.papers || []).map((p) => ({
      id: p.id,
      title: p.title,
      chapterId: idByTitle[p.chapter] || null,   // null = the whole module
      chapterTitle: p.chapter,
      file: p.file,
      pages: p.pages,
    })),
    chapters: (m.chapters || []).map((c) => ({
      id: c.id,
      code: c.id,
      title: c.name,
      quizId: c.quiz?.id,
      quizCount: c.quiz?.questions?.length,
      questions: c.quiz?.questions || [],
      lessons: (c.lessons || []).map((l) => ({
        id: l.id,
        code: l.id,
        title: l.name,
        // Seconds is what the player and the scrub need; the m:ss string is
        // only for display, so it is resolved here rather than in a component.
        duration: l.video?.seconds ?? mmssToSeconds(l.duration),
        video: l.video?.src || null,
        videoKind: l.video?.kind || null,
      })),
    })),
    };
  });

  return { modules, problems };
}

export const findModule = (content, code) =>
  content.modules.find((m) => m.code === code) || content.modules[0];
