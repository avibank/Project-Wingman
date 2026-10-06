/* =============================================================================
   A BATCH, JOINED TO WHAT THE STUDENT HAS DONE.
   -----------------------------------------------------------------------------
   The Library's rows are the demo's shape and this is where that shape is
   filled in. It is a plain module for the same reason `studioModel.js` and
   `quiz.js` are: these are the numbers a row PRINTS to a student, and a rule
   that lives in a component is a rule a tidy-up can change.

   EVERY FIGURE COMES FROM A REAL SOURCE. The demo's example objects carried
   `score`, `got` and `seen` as literals; here the score is the student's own
   best for that quiz, `got` is derived from it, and `seen` is counted off the
   card ids the chapter actually has. Nothing is estimated, and a figure with
   no source is null rather than zero — §10's rule about absences applies to
   numbers too: a row that has never been sat says so in words, it does not
   claim a score of nought.
   ========================================================================= */

/** Dots filled on the nine-bubble answer sheet, from a percentage. */
export const dotsFor = (score) =>
  (score == null ? 0 : Math.max(0, Math.min(9, Math.round((score / 100) * 9))));

/**
 * The module's chapters as the Library's batches, newest figures joined on.
 *
 * `scoreOf(chapter)` and `seenOf(chapter)` are passed in rather than read
 * here, because the two live behind different stores and this file should not
 * know about either.
 */
export function batchesOf(module, { scoreOf, seenOf, paperOf } = {}) {
  const chapters = module?.chapters || [];
  return chapters
    .filter((c) => Number.isFinite(c.batch))
    .map((c) => {
      const score = scoreOf ? scoreOf(c) : null;
      const paper = paperOf ? paperOf(c) : null;
      const cards = (c.cards || c.questions || []).length;
      return {
        n: c.batch,
        id: c.id,
        chapter: c,
        topic: c.title,
        ref: c.ref || null,
        pages: c.pages || null,
        q: c.quizCount ?? (c.questions || []).length,
        cards,
        seen: seenOf ? Math.min(cards, seenOf(c)) : 0,
        score,
        got: dotsFor(score),
        paper,
        /* The page count the row prints comes off the paper itself, because
           the paper is the thing being counted. A batch with no paper on the
           shelf yet shows the tile disabled rather than a made-up number. */
        pp: paper?.pages ?? 0,
      };
    })
    .sort((a, b) => a.n - b.n);
}

/** Which batch the student is on: the one the module marks current, else the
 *  highest that exists. Null when the module has no batches at all. */
export function hereBatch(batches, currentId = null) {
  if (!batches.length) return null;
  const marked = currentId ? batches.find((b) => b.id === currentId) : null;
  return (marked || batches[batches.length - 1]).n;
}

/** The module header's line: what is open, and how much of it there is. */
export function moduleLine(batches, total) {
  const q = batches.reduce((a, b) => a + (b.q || 0), 0);
  const cards = batches.reduce((a, b) => a + (b.cards || 0), 0);
  const bits = [];
  if (total) bits.push(`${batches.length} of ${total} batches open`);
  else if (batches.length) bits.push(`${batches.length} batches open`);
  if (q) bits.push(`${q} quiz questions`);
  if (cards) bits.push(`${cards} cards`);
  return bits.join(" · ");
}
