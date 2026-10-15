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

/* =============================================================================
   THE LAST FEW BATCHES ARE MOCK EXAMS, AND THEY ARE LETTERED.
   -----------------------------------------------------------------------------
   Owner, 2026-10-15: five mock exams go on the end of Module 13d, and they are
   "not badges — those are mock exams that cover the whole subject", so the
   route reads 1-10 then A B C D E rather than 1-15. They are otherwise an
   ordinary batch: a quiz, a card set and a paper, in a row that opens the same
   way, remembered by the same light, counted in the same header.

   A MOCK IS STILL A NUMBER UNDERNEATH, and that is deliberate. `batch` orders
   the rows, places the waypoint, is what `pw-batch` remembers and is what
   `Number.isFinite` admits to the Library at all; a letter in that field would
   have to be parsed back into a position by everything that touches it. So
   batches 11-15 ARE 11-15 and the letter is a LABEL — one function, used by
   every surface that prints one, so the row, the waypoint and the aria-label
   cannot disagree.

   THE MODULE SAYS HOW MANY, NOT THE CHAPTER, and that is the whole reason this
   is a module-level number. The strip draws a waypoint for every batch the
   module WILL have, landed or not — so waypoints 11-15 have to read A-E before
   there is any chapter to ask. `mocks` is the count of trailing batches that
   are mock exams; `batches: 15, mocks: 5` makes 11 the first of them.
   ========================================================================= */

/** The first batch number that is a mock exam, or null when none are. */
export function firstMock(total = null, mocks = 0) {
  if (!Number.isFinite(total) || !Number.isFinite(mocks) || mocks <= 0) return null;
  return Math.max(1, total - mocks + 1);
}

/** Is this batch number one of the module's mock exams? */
export function isMock(n, total = null, mocks = 0) {
  const first = firstMock(total, mocks);
  return first != null && Number.isFinite(n) && n >= first;
}

/**
 * What a batch is CALLED on the route, the row and every label that names it.
 *
 * A numbered batch keeps the demo's two digits ("01"), which is what lines the
 * row's number tile up. A mock exam is a bare letter: "0A" would be padding a
 * thing that is not a number. Past the 26th mock it falls back to the figure
 * rather than inventing a second letter, because a course with 27 mock exams
 * is a mistake and a silent "AA" would hide it.
 */
export function batchLabel(n, total = null, mocks = 0) {
  const first = firstMock(total, mocks);
  if (first != null && n >= first) {
    const k = n - first;
    if (k < 26) return String.fromCharCode(65 + k);
    return String(n);
  }
  return String(n).padStart(2, "0");
}

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

/* =============================================================================
   WHICH BATCH THE LIGHT IS ON.
   -----------------------------------------------------------------------------
   Owner, 2026-10-08: "have it that the light circle indicates your current or
   last open batch." It used to be the LAST chapter in the module, full stop —
   which on a ten-batch module lit waypoint 10 for a student who had never
   opened anything, and opened batch 10's drawer with it. The filled waypoint
   is the one piece of wayfinding on that strip and it was pointing at the end
   of the course.

   So the batch a student opens is remembered, per module, and that is what the
   light follows. One key, `pw-batch`, a map of module code -> batch number,
   written patch-only through the provider like every other progress key.

   IT IS THE BATCH THEY OPENED, NOT THE ONE THEY SCORED ON. Deriving it from
   quiz scores or cards seen was the other option and it answers a different
   question: a student who opens batch 7 to look at it has moved on, whether or
   not they have sat anything in it yet. Opening a row is the act that says
   "this is where I am".

   WITH NOTHING REMEMBERED IT IS THE FIRST BATCH, not the last. A module the
   student has never opened is a course they have not started, and the start of
   it is batch one. A module that marks a chapter current still wins over both.
   ========================================================================= */
export const BATCH_HERE = 'pw-batch';

/** The batch this student last opened in a module, or null. */
export function lastBatch(progress, moduleCode) {
  if (!progress || !moduleCode) return null;
  const map = progress.get(BATCH_HERE, {}) || {};
  const n = Number(map[moduleCode]);
  return Number.isFinite(n) ? n : null;
}

/** Remember it. A no-op when it is already the one stored, so reopening the
 *  row the light is already on writes nothing. */
export function rememberBatch(progress, moduleCode, n) {
  if (!progress || !moduleCode || !Number.isFinite(n)) return;
  const map = progress.get(BATCH_HERE, {}) || {};
  if (Number(map[moduleCode]) === n) return;
  progress.set(BATCH_HERE, { ...map, [moduleCode]: n });
}

/**
 * Which batch the light is on: the one they last opened, else the one the
 * module marks current, else the first. Null when the module has no batches.
 */
export function hereBatch(batches, currentId = null, remembered = null) {
  if (!batches.length) return null;
  const kept = remembered != null ? batches.find((b) => b.n === remembered) : null;
  if (kept) return kept.n;
  const marked = currentId ? batches.find((b) => b.id === currentId) : null;
  return (marked || batches[0]).n;
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
