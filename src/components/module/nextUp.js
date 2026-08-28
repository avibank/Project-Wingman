// What comes next, always. The order is the brief's and it is not optional:
// it is what makes a module a course rather than a list of pages, because a
// student can work all the way through without ever going back to the route.
//
//   1. the next lesson in this chapter
//   2. that chapter's quiz, if it has not been taken
//   3. the first lesson of the next chapter
//   4. nothing, on the last item of the module
export function nextAfterLesson(chapters, chapterId, lessonId, state) {
  const ci = chapters.findIndex((c) => c.id === chapterId);
  if (ci < 0) return null;
  const ch = chapters[ci];
  const li = ch.lessons.findIndex((l) => l.id === lessonId);

  const nextLesson = ch.lessons[li + 1];
  if (nextLesson) return { kind: "lesson", chapter: ch, lesson: nextLesson };

  if (state?.quiz?.[ch.id] == null) return { kind: "quiz", chapter: ch };

  const nextChapter = chapters[ci + 1];
  if (nextChapter?.lessons?.length) {
    return { kind: "lesson", chapter: nextChapter, lesson: nextChapter.lessons[0] };
  }
  return null;
}

// After a quiz the chapter is finished, so the only way on is the next
// chapter. Same rule, entered one step later.
export function nextAfterQuiz(chapters, chapterId) {
  const ci = chapters.findIndex((c) => c.id === chapterId);
  const nextChapter = chapters[ci + 1];
  if (nextChapter?.lessons?.length) {
    return { kind: "lesson", chapter: nextChapter, lesson: nextChapter.lessons[0] };
  }
  return null;
}

export const nextLabel = (n) =>
  !n ? null
    : n.kind === "quiz" ? `${n.chapter.title} quiz`
    : n.lesson.title;

export const nextWhere = (n) =>
  !n ? null
    : n.kind === "quiz" ? "The last thing in this chapter"
    : n.chapter.title;
