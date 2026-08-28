export const PLACE_KEY = "pw-last-place";

// Where you actually were, rather than which chapter contains it.
//
// The hero card's Resume went to the chapter page — the list of lessons — no
// matter what you had been doing, so "pick up where you left off" put you a
// click or two away from where you left off, and the card carried a TODO
// admitting it. This is the record that closes that: one entry, overwritten by
// whichever surface you are on, holding enough to land on the exact spot.
//
//   { kind: "lesson", moduleCode, chapterId, lessonId, pct }
//   { kind: "quiz",   moduleCode, chapterId, at, total }
//   { kind: "paper",  moduleCode, paperId, title, file }
//
// A lesson stores the fraction only so the card can say the timestamp; the
// player resumes from pw-lesson-pos on its own, and two stores of one fact is
// the bug this app keeps re-learning.
//
// It keeps a few, not one. Finishing a quiz retires that place, and with a
// single record the card fell all the way back to "pick up where you left
// off" while a half-watched lesson was still sitting there — which is the
// vagueness this was built to remove.

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Where Resume should go. Papers are the exception: they open in the browser's
// own PDF viewer in a new tab, so there is no in-app address for one.
export function placeTarget(place, path) {
  if (!place) return null;
  if (place.kind === "lesson" && place.chapterId && place.lessonId)
    return { href: path.lesson(place.moduleCode, place.chapterId, place.lessonId) };
  if (place.kind === "quiz" && place.chapterId)
    return { href: path.quizResume(place.moduleCode, place.chapterId) };
  if (place.kind === "paper" && place.file)
    return { file: place.file };
  return null;
}

// The line under the chapter title. It names the spot, so the button's promise
// is visible before it is pressed.
export function placeLine(place, lesson, midRun) {
  if (!place) return null;
  if (place.kind === "lesson") {
    const name = lesson?.title || "the lesson";
    const dur = lesson?.duration || 0;
    return dur && place.pct > 0
      ? `${mmss(place.pct * dur)} into ${name}.`
      : `${name}, from the top.`;
  }
  if (place.kind === "quiz")
    // Only a run still open has a question to go back to. Once it is sat, the
    // place is still the quiz — it is where you were — but the line should not
    // keep pointing at a question you already answered.
    return midRun && place.total
      ? `Question ${Math.min(place.at + 1, place.total)} of ${place.total}.`
      : "The chapter quiz.";
  if (place.kind === "paper") return `${place.title || "A paper"}, still open.`;
  return null;
}

export const placeVerb = (place) =>
  place?.kind === "quiz" ? "Back to the quiz"
    : place?.kind === "paper" ? "Reopen the paper"
    : "Resume";

const DEPTH = 6;

const sameSpot = (a, b) =>
  a.kind === b.kind && a.chapterId === b.chapterId
  && a.lessonId === b.lessonId && a.paperId === b.paperId;

// Stored oldest-last. Reading tolerates the single-object shape this used to
// have, so an account written by the previous build still resumes.
export const placeList = (stored) =>
  Array.isArray(stored) ? stored : stored ? [stored] : [];

export const pushPlace = (stored, place) =>
  [place, ...placeList(stored).filter((p) => !sameSpot(p, place))].slice(0, DEPTH);
