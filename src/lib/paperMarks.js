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
   R6 — what may land silently, and what has to wait.

   Density changes no layout, so a new bare highlight can appear under a reader
   without moving anything. A note opens inline and pushes text down, so it
   waits in a buffer behind a quiet line until the reader asks for it.
   -------------------------------------------------------------------------- */
export const movesLayout = (a) => a.kind === "note" || a.kind === "question";

export function splitIncoming(rows = []) {
  const silent = [];
  const pending = [];
  for (const r of rows) (movesLayout(r) ? pending : silent).push(r);
  return { silent, pending };
}

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

/* R7 — the backoff, as a function so the timer has nothing to decide.
   Five minutes, then ten, then twenty while nothing is happening; back to five
   the moment anything lands. */
export const POLL_STEPS = [5, 10, 20].map((m) => m * 60_000);
export const nextPoll = (emptyRuns) => POLL_STEPS[Math.min(emptyRuns, POLL_STEPS.length - 1)];
