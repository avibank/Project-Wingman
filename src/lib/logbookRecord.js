// The logbook RECORD. Append-only, and nothing reads it yet.
//
// Separate from lib/logbook.js, which is the Logbook page's analysis — what
// was weakest, what is due another pass. That reads state; this writes
// history. Keeping them apart matters because one is a view that can be
// rewritten freely and the other is a record that must not be.
//
// That is the whole argument for building it now: a record of what someone
// did and when can be captured for almost nothing while it is happening, and
// cannot be reconstructed afterwards at any price. If completion and quiz
// events are not written today, the history of everyone who used the app
// before the Logbook page exists is simply gone.
//
// Append-only is not a style choice here. A logbook that can be edited is not
// a record of anything — entries are added, never changed and never removed,
// which is why every function below returns a NEW array and why nothing
// exposes a way to rewrite one.
export const LOGBOOK_KEY = "pw-logbook";

// A closed set, like the analytics events, for the same reason: a free-text
// kind is a kind nobody can query later.
export const ENTRY_KINDS = ["lesson_done", "quiz_taken"];

// Capped so a long-lived account cannot grow its progress row without bound.
// The cap drops the OLDEST entries, which is the wrong end for a logbook — so
// it is deliberately high enough that a real student will not reach it, and it
// is here to stop a runaway loop rather than to manage size.
export const MAX_ENTRIES = 2000;

export function entry(kind, payload) {
  if (!ENTRY_KINDS.includes(kind)) {
    throw new Error(`Unknown logbook entry "${kind}". The kinds are: ${ENTRY_KINDS.join(", ")}`);
  }
  return { kind, at: new Date().toISOString(), ...payload };
}

// The only way to add. Takes the current log and returns a new one — it never
// mutates what it was given, so a caller cannot accidentally rewrite history
// by holding a reference to it.
export function append(log, e) {
  const next = [...(Array.isArray(log) ? log : []), e];
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
}

// Writing a lesson twice is not an error — someone can finish, rewatch and
// finish again, and both are true. But the automatic 90% rule and a manual
// "mark as done" firing together would write the same moment twice, so an
// identical entry within the same minute is treated as one.
export function appendOnce(log, e) {
  const prev = (Array.isArray(log) ? log : []).slice(-8);
  const minute = e.at.slice(0, 16);
  const dupe = prev.some((p) =>
    p.kind === e.kind && p.id === e.id && String(p.at).slice(0, 16) === minute);
  return dupe ? log : append(log, e);
}

export const lessonDone = (log, lessonId, chapterId, moduleCode) =>
  appendOnce(log, entry("lesson_done", { id: lessonId, chapterId, moduleCode }));

export const quizTaken = (log, chapterId, moduleCode, correct, total) =>
  appendOnce(log, entry("quiz_taken", { id: chapterId, moduleCode, correct, total }));
