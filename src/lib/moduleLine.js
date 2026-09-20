/* =============================================================================
   THE LINE UNDER A MODULE'S NAME.
   -----------------------------------------------------------------------------
   "6 lessons and 3 quizzes" — the reference's `.sub`, and the live screen had
   nothing there at all (bug 14).

   IT COUNTS WHAT IS THERE, rather than reading a stored number, because a
   stored one goes stale the first time a chapter gains a lesson. Every chapter
   carries exactly one quiz, which is why the second half is the chapter count.

   Both halves pluralise, and a module with one of something says "1 lesson"
   rather than "1 lessons". A module with no chapters yet gets nothing at all
   rather than "0 lessons and 0 quizzes" — CLAUDE.md's Voice rule: never state
   a zero count.
   ========================================================================= */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function moduleSubtitle(chapters = []) {
  const quizzes = chapters.length;
  if (!quizzes) return "";
  const lessons = chapters.reduce((n, c) => n + (c.lessons?.length || 0), 0);
  if (!lessons) return plural(quizzes, "quiz").replace("quizs", "quizzes");
  return `${plural(lessons, "lesson")} and ${quizzes} ${quizzes === 1 ? "quiz" : "quizzes"}`;
}
