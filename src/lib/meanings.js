/* =============================================================================
   COLOURS ARE VERBS.

   This is the part that makes the reader Wingman's rather than a generic
   annotator. Each colour a student can put on a passage DOES something: the
   mark is not a label they will have to act on later, it is the action.

   -----------------------------------------------------------------------------
   THE SET IS CLOSED FOR TEXT MARKS, AND THAT IS THE WHOLE DESIGN

   Highlight, underline and strike offer these five and nothing else. There is
   deliberately no "plain" highlight, because a plain highlight is what everyone
   picks — it asks nothing and means nothing — and the moment it exists the
   other five stop being used and the system is decoration again.

   Free colour stays with the pen, the marker and shapes, where ink is ink and
   carries no claim. Those keep the palette in paperInk.js, which is a different
   thing wearing the same word: one is what a mark MEANS, the other is what a
   nib is loaded with. See CLAUDE.md's note on the two colour categories.

   "Wrong in the paper" is NOT here. That is the Correction tool — a snag on the
   document rather than a fact about the student — and it routes to the author's
   queue instead of to the student's own piles.
   ========================================================================= */

export const MEANINGS = [
  {
    id: "critical",
    name: "Exam likely",
    destination: "Revision",
    does: "Goes into your revision deck, and adds to the class heat on this passage.",
    /* The five are FIXED ACROSS LIVERIES. They carry meaning, so they cannot
       shift with the accent — a student who learns that amber means "exam
       likely" must not find it means something else after changing livery.
       They are the only colours in the app that do not derive from the
       livery, and this is the second such exception after ink. */
    oklch: "oklch(.80 .155 84)",
  },
  {
    id: "definition",
    name: "Definition",
    destination: "Glossary",
    does: "The term and this passage are pulled into the module glossary.",
    oklch: "oklch(.70 .135 253)",
  },
  {
    id: "limit",
    name: "Testable fact",
    destination: "Questions",
    does: "Offers to become a question in your bank — figures, limits, procedures.",
    oklch: "oklch(.74 .125 162)",
  },
  {
    id: "unsure",
    name: "Ask",
    destination: "Threads",
    does: "Opens a thread on this passage in the Ready Room. Turns solid once somebody answers.",
    oklch: "oklch(.70 .135 320)",
  },
  {
    id: "wrong",
    name: "Weak spot",
    destination: "Master Caution",
    does: "Counts toward Master Caution until you answer it right twice.",
    oklch: "oklch(.68 .165 32)",
  },
];

export const MEANING_IDS = MEANINGS.map((m) => m.id);
export const DEFAULT_MEANING = "critical";
export const isMeaning = (id) => MEANING_IDS.includes(id);
export const meaning = (id) => MEANINGS.find((m) => m.id === id) || MEANINGS[0];
/* An unrecognised name reads as the default rather than as nothing: a row
   written by a newer build must still draw on an older one, and an undrawn
   highlight is indistinguishable from a lost one. */
export const meaningOr = (id, fallback = DEFAULT_MEANING) => (isMeaning(id) ? id : fallback);

/* The kinds that take a meaning. Ink and shapes take a colour instead. */
export const TEXT_KINDS = ["highlight", "underline", "strikethrough"];
export const takesMeaning = (kind) => TEXT_KINDS.includes(kind) || kind === "note" || kind === "question";

/* -----------------------------------------------------------------------------
   §6.1 — VIOLET HAS A STATE.

   The colour says "this is a question"; the treatment says whether anybody has
   dealt with it. Hollow while the thread is open, filled once it is answered,
   and visible at a glance without opening anything.
   -------------------------------------------------------------------------- */
export const threadState = (mark) => {
  if (mark?.colour !== "unsure" && mark?.kind !== "question") return null;
  return mark.resolved_at || mark.answered ? "answered" : "open";
};

/* -----------------------------------------------------------------------------
   §6.3 — THE FILTER CHIPS ARE THE DESTINATIONS, not invented categories.

   Where a mark WENT is the only grouping a student can act on: five piles they
   already know, with real counts. "Highlights" and "Notes" would be a filter by
   what the mark looks like, which answers nothing.
   -------------------------------------------------------------------------- */
export const DESTINATIONS = MEANINGS.map((m) => ({ id: m.id, label: m.destination }));

export function countByDestination(marks = [], me = null) {
  const counts = Object.fromEntries(MEANING_IDS.map((id) => [id, 0]));
  for (const m of marks) {
    if (me && m.author_id !== me) continue;
    if (isMeaning(m.colour)) counts[m.colour] += 1;
  }
  return counts;
}
