// One translation between what the module screen writes and what the Flight
// Deck's instruments read.
//
// The two halves of the app grew their own vocabularies. The module screen
// stores a quiz as {correct, total}, which is the richer record and the right
// thing to keep; the deck's instruments were written against a percentage and
// silently discard anything that is not a number. The deck's segments want a
// `viewed` set and an `answered` map that nothing writes any more. So every
// instrument sat at its default while the data underneath them was perfectly
// good — which reads, from the outside, as an app that does not respond.
//
// Rather than teach every instrument two shapes, the canonical store stays as
// it is and this converts once, here.
export const pctOf = (score) =>
  !score ? null
    : typeof score === "number" ? score
    : score.total ? Math.round((score.correct / score.total) * 100)
    : null;

export function deckStateFrom({ chapters = [], lessonDone = {}, lessonPos = {}, quiz = {}, legacyCompleted = [] } = {}) {
  const isDone = (id) => Boolean(lessonDone[id]) || (lessonPos[id]?.pct ?? 0) >= 0.9;
  const isStarted = (id) => (lessonPos[id]?.pct ?? 0) > 0 || Boolean(lessonDone[id]);

  const completed = new Set(legacyCompleted);
  const viewed = new Set();

  for (const c of chapters) {
    const ls = c.lessons || [];
    if (!ls.length) continue;
    // A chapter is FULL when every lesson in it is done. Taking its quiz is
    // not required: a quiz you have not sat is a thing still to do, not a
    // lesson left unwatched, and the segments count lessons.
    if (ls.every((l) => isDone(l.id))) completed.add(c.id);
    // HALF the moment anything in it has been opened. Started is the honest
    // signal here — it is what makes the bar move on the first lesson rather
    // than staying blank until a whole chapter is finished.
    else if (ls.some((l) => isStarted(l.id))) viewed.add(c.id);
  }

  // The instruments want a number per chapter; the store keeps the richer
  // object. Converted here so nothing downstream has to know both.
  const answered = {};
  const scores = {};
  for (const c of chapters) {
    const pct = pctOf(quiz[c.id]);
    if (pct !== null) { scores[c.id] = pct; answered[c.id] = 1; }
  }

  return { completed, viewed, answered, scores };
}

// Hours actually watched, across a module rather than a chapter.
//
// The Hobbs meter is module-wide on purpose: it is the airframe's total time,
// not this leg's. It used to count chapters "flown" because the content had no
// durations to sum — it has them now, so it counts the thing it is named after.
// Watched time, not elapsed time: sitting on a paused lesson is not flying.
export function hoursWatched(chapters = [], lessonPos = {}, lessonDone = {}) {
  let seconds = 0;
  for (const c of chapters) {
    for (const l of c.lessons || []) {
      const dur = l.duration || 0;
      if (!dur) continue;
      // A finished lesson counts in full even if it was finished by hand —
      // the rule says done is done, and the meter has to agree with the rule.
      const pct = lessonDone[l.id] ? 1 : Math.min(1, lessonPos[l.id]?.pct ?? 0);
      seconds += dur * pct;
    }
  }
  return seconds / 3600;
}
