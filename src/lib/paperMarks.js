/* =============================================================================
   The annotation model — pure, and testable without a browser.
   -----------------------------------------------------------------------------
   Everything here takes records and text and returns plain data. No React, no
   network, no DOM. The rules that are easy to get quietly wrong — how marks
   flatten, when density appears, what counts as orphaned — live here so they
   can be checked rather than reviewed.
   ========================================================================= */

import { createAnchor, resolveAnchor, flatten } from "./anchor.js";

export const KINDS = ["highlight", "note", "question", "correction"];

/* The rings, in the app's own words. `solo` is "nobody" from the reader's side:
   a mark you keep to yourself. */
export const RINGS = [
  { id: "solo", label: "Just me", note: "Nobody else sees this one." },
  { id: "wingman", label: "My wingman", note: "The person on your wing." },
  { id: "formation", label: "My formation", note: "The people you fly with." },
  { id: "module", label: "Everyone on the module", note: "Anyone studying this." },
];
export const ringLabel = (id) => RINGS.find((r) => r.id === id)?.label || RINGS[3].label;

/* -----------------------------------------------------------------------------
   R2 — resolve every mark against the text as it is now.

   A mark whose passage cannot be found is ORPHANED: kept, listed, and never
   drawn somewhere plausible. The caller is expected to persist that status, but
   the decision is made once, here.
   -------------------------------------------------------------------------- */
export function resolveAll(annotations = [], text = "") {
  const placed = [];
  const orphans = [];
  if (!text) return { placed, orphans };
  for (const a of annotations) {
    const at = a.anchor ? resolveAnchor(a.anchor, text) : null;
    if (at) placed.push({ ...a, start: at.start, end: at.end, method: at.method, score: at.score });
    else orphans.push(a);
  }
  placed.sort((x, y) => x.start - y.start || x.end - y.end);
  return { placed, orphans };
}

/* Making one. The caller passes the document text and the offsets a selection
   landed on; nothing else may build an anchor. */
export function anchorFor(text, start, end) {
  return createAnchor(text, start, end);
}

/* -----------------------------------------------------------------------------
   R3 + R4 — segments, and what each one is drawn as.

   Flatten first, always. Eleven people on one paragraph is a handful of
   non-overlapping segments, not eleven nested spans, and the renderer draws
   segments — it never draws an annotation directly.

   Each segment then reports two counts, because they are drawn differently:

     mine     marks from you, your wingman, your formation — drawn individually
     crowd    everyone else on the module — drawn as density and nothing else

   Density is RELATIVE to the busiest passage in this paper, and a passage with
   fewer than two people on it gets none at all. One person is not the class.
   -------------------------------------------------------------------------- */
export const DENSITY_MIN = 2;
export const DENSITY_LEVELS = 3;

export function densityLevel(count, max) {
  if (count < DENSITY_MIN) return 0;
  if (!max || max < DENSITY_MIN) return 0;
  return Math.min(DENSITY_LEVELS, Math.max(1, Math.ceil(DENSITY_LEVELS * count / max)));
}

export function segmentsFor(placed = []) {
  // Corrections never contribute to the shape of the page for anyone: they are
  // an author queue, not a mark on the paper (R9). Notes and questions carry a
  // highlight with them, so they count.
  const drawable = placed.filter((a) => a.kind !== "correction");
  if (!drawable.length) return { segments: [], maxCrowd: 0 };

  const segments = flatten(drawable.map((a) => ({ id: a.id, start: a.start, end: a.end })));
  const byId = new Map(drawable.map((a) => [a.id, a]));

  let maxCrowd = 0;
  const out = segments.map((s) => {
    const marks = s.ids.map((id) => byId.get(id)).filter(Boolean);
    const mine = marks.filter((m) => m.close);
    const crowd = marks.length;
    if (crowd > maxCrowd) maxCrowd = crowd;
    return {
      start: s.start,
      end: s.end,
      count: crowd,
      mine,
      ids: s.ids,
      // The kind that decides the segment's own colour: a question outranks a
      // note, a note outranks a bare highlight, because the stronger claim on
      // the reader's attention should be the one they see.
      kind: mine.some((m) => m.kind === "question") ? "question"
        : mine.some((m) => m.kind === "note") ? "note"
          : mine.length ? "highlight" : null,
    };
  });

  return {
    segments: out.map((s) => ({ ...s, density: densityLevel(s.count, maxCrowd) })),
    maxCrowd,
  };
}

/* -----------------------------------------------------------------------------
   R6 — nothing arrives on this screen unbidden.

   There used to be a split here: density could land silently because it moves
   nothing, while a note waited behind a quiet line because it opens inline and
   pushes text down. That machinery is gone because the thing it defended
   against is gone — the paper has no timer at all now. Marks arrive when the
   reader presses refresh, which is a gesture, and the scroll position is pinned
   across the change regardless.

   Every other surface in the app went the other way, to a socket. The paper is
   the exception precisely BECAUSE its notes move the page.
   -------------------------------------------------------------------------- */

/* Merge a fetched batch over what is held, newest wins, by id. Optimistic rows
   carry a temp id and are replaced when the real row arrives for the same
   anchor and author. */
export function mergeRows(held = [], incoming = []) {
  const byId = new Map(held.map((r) => [r.id, r]));
  for (const r of incoming) byId.set(r.id, r);
  return [...byId.values()];
}

/* -----------------------------------------------------------------------------
   The filter strip. Same four questions the threads screen asks.
   -------------------------------------------------------------------------- */
export const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "mine", label: "Mine" },
  { id: "notes", label: "Notes" },
  { id: "questions", label: "Questions" },
  { id: "orphaned", label: "Lost their place" },
];

export function applyFilter(list, filter, me) {
  switch (filter) {
    case "mine": return list.filter((a) => a.author_id === me);
    case "notes": return list.filter((a) => a.kind === "note");
    case "questions": return list.filter((a) => a.kind === "question");
    case "orphaned": return list.filter((a) => a.status === "orphaned");
    default: return list;
  }
}


/* -----------------------------------------------------------------------------
   Tap anywhere.

   A note needs a passage — R1 is not negotiable, an anchor is the words. But
   asking somebody to drag across a sentence before they can write anything is
   a second gesture in front of a first thought. So a tap picks the sentence it
   landed in, and that is what the note anchors to.

   Sentence rather than paragraph, and rather than the text run under the
   finger: a run is wherever the PDF happened to break, which is meaningless to
   a reader, and a paragraph is usually too much to quote back.
   -------------------------------------------------------------------------- */
const STOPS = ".!?";

export function sentenceAround(text, offset, max = 420) {
  if (!text || offset == null) return null;
  const at = Math.max(0, Math.min(offset, text.length - 1));

  let start = at;
  while (start > 0 && at - start < max) {
    const ch = text[start - 1];
    if (STOPS.includes(ch) || (ch === "\n" && text[start - 2] === "\n")) break;
    start -= 1;
  }
  let end = at;
  while (end < text.length && end - at < max) {
    const ch = text[end];
    end += 1;
    if (STOPS.includes(ch)) break;
    if (ch === "\n" && text[end] === "\n") { end -= 1; break; }
  }

  // Trim the whitespace the walk collected, so the quote starts on a word.
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return end > start ? { start, end } : null;
}

/* Where the tool rail sits and how big it is. A per-device preference, like the
   player bar's position: it belongs to the screen in front of you, not to the
   account. */
export const DOCKS = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
];
export const TOOL_SIZES = [
  { id: "s", label: "Small" },
  { id: "m", label: "Medium" },
  { id: "l", label: "Large" },
];
