/* =============================================================================
   THE LINE UNDER A MODULE'S NAME.
   -----------------------------------------------------------------------------
   "3 quizzes and 3 card sets" — the reference's `.sub`, and the live screen had
   nothing there at all (bug 14).

   IT COUNTS WHAT IS THERE, rather than reading a stored number, because a
   stored one goes stale the first time a chapter gains anything. Every chapter
   carries exactly one quiz and exactly one card set — the same questions read
   the other way round — so both halves are the chapter count.

   IT NEVER COUNTS LESSONS, and that reverses what this file used to do. The
   beta opens with quizzes, study cards and papers; there is no video, so the
   Lessons tab is a waiting state and will be for a while. A line reading
   "0 lessons and 3 quizzes" is a zero count, which §10 forbids outright, and
   "6 lessons" over a tab that cannot show one is worse than a zero — it is a
   number that is not true. So the line says what a student can actually open.

   Both halves pluralise, and a module with one of something says "1 quiz"
   rather than "1 quizs". A module with no chapters says what it is waiting
   for: it used to return "" — no zero count, which was right — and the screen
   drew an empty paragraph under the title, a gap where every other module has
   a sentence, which reads as a line that failed to load rather than as a
   module nobody has filled yet.
   ========================================================================= */
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function moduleSubtitle(chapters = [], papers = []) {
  const quizzes = chapters.length;
  const sheets = papers.length;
  if (!quizzes) {
    /* Papers hang off a module as well as off a chapter, so a module can have
       something to open before it has a single chapter. Say that rather than
       "waiting", which would be untrue with a paper already on the shelf. */
    return sheets
      ? `${plural(sheets, "paper")} on the shelf, and the first chapter on its way.`
      : "Waiting on its first chapter.";
  }
  const parts = [
    plural(quizzes, "quiz", "quizzes"),
    plural(quizzes, "card set"),
  ];
  if (sheets) parts.push(plural(sheets, "paper"));
  /* "a, b and c" — an Oxford-less list, because three is the most it holds. */
  return parts.length === 2
    ? `${parts[0]} and ${parts[1]}`
    : `${parts[0]}, ${parts[1]} and ${parts[2]}`;
}
