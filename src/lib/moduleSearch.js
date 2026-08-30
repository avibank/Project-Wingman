// §2.3 — one search field beside the tabs, and one rule for what it matches.
//
// Kept out of the components on purpose. Lessons and Library both filter the
// same content by the same words, and a rule written twice is a rule that
// drifts: the day someone adds chapter codes to one of them, the other quietly
// stops finding them.
//
// Matching is deliberately dumb — case-folded substring, no fuzzy, no ranking.
// A student searching a module of twenty chapters is looking for a word they
// already know is there ("hydraulic", "M1.03"), not exploring. Fuzzy matching
// helps the second and actively hurts the first, because it answers a precise
// query with near-misses.

export const norm = (s) => String(s || "").toLowerCase().trim();

// Whitespace-separated terms, ALL of which must appear somewhere in the
// haystack. "brake hyd" finds "Hydraulic brake units" and that is the query a
// student actually types.
export const terms = (q) => norm(q).split(/\s+/).filter(Boolean);

export function hits(haystack, q) {
  const t = terms(q);
  if (!t.length) return true;
  const hay = norm(haystack);
  return t.every((w) => hay.includes(w));
}

/* A chapter matches on its own title or code; a lesson on its title or code.
   If the CHAPTER matches, every lesson inside it is a result — searching
   "Chapter 3" and being shown a chapter with none of its lessons would be a
   strange thing to do to somebody. */
export function filterChapters(chapters, q) {
  if (!terms(q).length) return { chapters, matched: null };
  const out = [];
  for (const ch of chapters) {
    const chapterHit = hits(`${ch.title} ${ch.id} ${ch.code || ""}`, q);
    const lessons = chapterHit
      ? ch.lessons || []
      : (ch.lessons || []).filter((l) => hits(`${l.title} ${l.id} ${l.code || ""}`, q));
    // The quiz is a row too, and "quiz" is a word people search for.
    const quizHit = chapterHit || hits(`${ch.title} quiz`, q);
    if (chapterHit || lessons.length || quizHit) out.push({ ...ch, lessons, quizHit });
  }
  return { chapters: out, matched: new Set(out.map((c) => c.id)) };
}

export const countLessons = (chapters) =>
  chapters.reduce((n, c) => n + (c.lessons?.length || 0), 0);

/* The placeholder is per tab, because "Search" alone makes a student guess what
   it reaches. It says what it searches. */
export const placeholderFor = (tab, sub) =>
  tab === "library" ? (sub === "quizzes" ? "Search quizzes" : "Search papers")
    : "Search lessons and chapters";
