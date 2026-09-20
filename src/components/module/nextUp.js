// What comes next, always. The order is the brief's and it is not optional:
// it is what makes a module a course rather than a list of pages, because a
// student can work all the way through without ever going back to the route.
//
//   1. the next lesson in this chapter
//   2. that chapter's quiz, if it has not been taken
//   3. the first lesson of the next chapter — or its QUIZ, if it has none
//   4. nothing, on the last item of the module
//
// STEP 3 USED TO STOP AT `nextChapter?.lessons?.length`, and with no video
// that is every chapter. The beta opens on quizzes, study cards and papers:
// no lessons at all. So "what comes next" returned null at every chapter
// boundary and a student who finished a quiz was told there was nothing
// further in the module — with the next chapter's quiz sitting right there.
// A chapter with no lessons is a chapter whose first thing is its quiz.
const firstThingIn = (ch, state) => {
  if (!ch) return null;
  const first = ch.lessons?.[0];
  if (first) return { kind: "lesson", chapter: ch, lesson: first };
  // Its quiz, unless it has already been sat — in which case this chapter has
  // nothing left either and the caller walks on.
  if (state?.quiz?.[ch.id] == null) return { kind: "quiz", chapter: ch };
  return null;
};

// The next chapter that still has something in it. Without this, one finished
// chapter in the middle of a module ends the walk: a student who had already
// sat chapter 2's quiz out of order was told chapter 1 was the end.
const onwardFrom = (chapters, ci, state) => {
  for (let i = ci + 1; i < chapters.length; i += 1) {
    const next = firstThingIn(chapters[i], state);
    if (next) return next;
  }
  return null;
};

export function nextAfterLesson(chapters, chapterId, lessonId, state) {
  const ci = chapters.findIndex((c) => c.id === chapterId);
  if (ci < 0) return null;
  const ch = chapters[ci];
  const lessons = ch.lessons || [];
  const li = lessons.findIndex((l) => l.id === lessonId);

  const nextLesson = lessons[li + 1];
  if (nextLesson) return { kind: "lesson", chapter: ch, lesson: nextLesson };

  if (state?.quiz?.[ch.id] == null) return { kind: "quiz", chapter: ch };

  return onwardFrom(chapters, ci, state);
}

// After a quiz the chapter is finished, so the only way on is the next
// chapter. Same rule, entered one step later.
export function nextAfterQuiz(chapters, chapterId, state) {
  const ci = chapters.findIndex((c) => c.id === chapterId);
  if (ci < 0) return null;
  return onwardFrom(chapters, ci, state);
}

export const nextLabel = (n) =>
  !n ? null
    : n.kind === "quiz" ? `${n.chapter.title} quiz`
    : n.lesson.title;

export const nextWhere = (n) =>
  !n ? null
    : n.kind === "quiz" ? "The last thing in this chapter"
    : n.chapter.title;
