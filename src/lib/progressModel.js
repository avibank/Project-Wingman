// §9.1.1 — the segmented bar is the centrepiece of Home, and it answers three
// questions with one object: how many chapters there are, how far into each one
// you are, and how far through the module you are.
//
// Kept pure and free of any client import so the fill rules are checkable.

export const SEGMENT = { EMPTY: "empty", HALF: "half", FULL: "full" };

// hairline outline = not started · half = brief watched · full = quiz passed.
// Comments is deliberately not progress and fills nothing.
export function segmentState(chapterId, { completed, viewed, answered } = {}) {
  if (completed?.has?.(chapterId)) return SEGMENT.FULL;
  if (viewed?.has?.(chapterId) || (answered?.[chapterId] ?? 0) > 0) return SEGMENT.HALF;
  return SEGMENT.EMPTY;
}

export function moduleSegments(chapters, state) {
  return chapters.map((c) => ({ id: c.id, code: c.code, title: c.title, fill: segmentState(c.id, state) }));
}

// §8.2 — one way of counting, everywhere: "1 of 4 chapters".
export function chapterCount(segments) {
  const full = segments.filter((s) => s.fill === SEGMENT.FULL).length;
  const half = segments.filter((s) => s.fill === SEGMENT.HALF).length;
  return { full, half, total: segments.length };
}

// The caption under the bar. Never states a zero: with nothing started it is an
// invitation, per §8.4.
export function progressCaption(segments) {
  const { full, half, total } = chapterCount(segments);
  if (!full && !half) {
    // CHAPTERS, not lessons. `total` is segments.length and a segment is a
    // chapter — moduleSegments builds one per chapter — so this counted
    // chapters and called them lessons: the Modules page read "5 lessons
    // waiting" beside a module with five chapters and about twice that many
    // lessons. The other branch below has always said chapters, so the two
    // captions on the same card disagreed about what was being counted.
    //
    // The zero is guarded because the Voice rule is that nothing states an
    // absence: with no chapters at all this said "0 lessons waiting".
    return total ? `${total} chapters waiting` : "Pick a module and start.";
  }
  const parts = [`${full} of ${total} chapters`];
  if (half) parts.push(`${half} in progress`);
  return parts.join(" · ");
}

// §9.1 — the next action is the attitude indicator, so it must always resolve
// to something. First unfinished chapter, else the last one.
export function nextChapter(chapters, state) {
  return chapters.find((c) => segmentState(c.id, state) !== SEGMENT.FULL) || chapters[chapters.length - 1] || null;
}
