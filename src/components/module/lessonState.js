// The one completion rule, in one place.
//
// A lesson is Done when it has been watched to 90% OR marked done by hand,
// and both write the same flag. That was the decision; the point of it being
// a decision is that everything on the screen hangs off it — the lights, the
// chapter state, the counts, the Flight Deck's progress. Two rules would mean
// those four disagree, which is exactly how progress numbers start drifting.
export const DONE_AT = 0.9;

export const isDone = (state, lessonId) =>
  Boolean(state?.done?.[lessonId]) || (state?.pos?.[lessonId]?.pct ?? 0) >= DONE_AT;

// Where a student is: the first lesson of the module they have not finished.
// Not the furthest they have reached — if they skipped one, the thing to do
// next is the one they skipped.
export function currentLesson(chapters, state) {
  for (const ch of chapters) {
    for (const l of ch.lessons) if (!isDone(state, l.id)) return { chapter: ch, lesson: l };
  }
  return null;
}

export function chapterState(ch, state, hereChapterId) {
  const done = ch.lessons.filter((l) => isDone(state, l.id)).length;
  const quizTaken = state?.quiz?.[ch.id] != null;
  if (done === ch.lessons.length && quizTaken) return "done";
  if (ch.id === hereChapterId) return "here";
  // "Started" is not "here". Returning "here" for anything part-done put YOU
  // ARE HERE on every chapter with a single watched lesson — two at once on
  // the seed data, which makes the phrase mean nothing. There is exactly one
  // here, and it is the chapter you are in.
  return done > 0 ? "started" : "new";
}

// "5 minutes left", the only place a duration is turned into words. Rounds up,
// because a lesson with forty seconds left does not read as "0 minutes left".
export function timeLeft(durationSec, pct) {
  if (durationSec == null) return "You are here";
  const left = Math.max(0, Math.round((durationSec * (1 - (pct || 0))) / 60));
  if (left <= 0) return "Under a minute left";
  return `${left} minute${left === 1 ? "" : "s"} left`;
}

export const mmss = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Null when there is no duration yet. The content that carries them arrives
// with Part 6; until then the row says nothing rather than a made-up number.
export const durationWords = (sec) =>
  sec == null ? null : `${Math.max(1, Math.round(sec / 60))} min`;
