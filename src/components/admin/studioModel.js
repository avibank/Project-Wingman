/* =============================================================================
   THE STUDIO'S MODEL — everything about the course document that is not a
   screen. Exam.jsx and quiz.js already split this way, for the reason given
   in quiz.js's header: a rule that lives in a component is a rule that can be
   changed by somebody tidying the markup. These are also the parts worth
   DRIVING rather than eyeballing, and `npm run check:studio` imports this file
   and runs every one of them.

   The document these functions edit is the RAW one — src/content/test-content.json,
   key for key, not the normalised course contentLoader hands the screens.
   ========================================================================= */

export const clone = (v) => JSON.parse(JSON.stringify(v));

/** Every id in a chapter, quiz and cards together. ONE SPACE on purpose:
 *  `check:question-ids` is in prebuild and fails the build on a duplicate
 *  across either, because a saved bookmark names an id and nothing else. */
export function idsIn(chapter) {
  return new Set([...(chapter?.quiz?.questions || []), ...(chapter?.cards || [])].map((q) => q.id));
}

/** An id for a new question, in the chapter's own space and never colliding
 *  with one that is already there — the ids are what a saved bookmark, a
 *  retention pile and a half-finished paper all point at. `taken` is for a
 *  BATCH: eight copies issued in one go have to avoid each other too, and a
 *  set rebuilt from the document between them would not have seen the
 *  previous seven. */
export function nextId(chapter, kind, taken) {
  const prefix = `${chapter.id}.${kind === "cards" ? "C" : "Q"}`;
  const used = taken || idsIn(chapter);
  for (let n = 1; n < 10000; n += 1) {
    const id = kind === "cards" ? `${prefix}${String(n).padStart(3, "0")}` : `${prefix}${n}`;
    if (!used.has(id)) return id;
  }
  return `${prefix}${Date.now()}`;
}

export const emptyQuestion = (chapter, kind) => ({
  id: nextId(chapter, kind), question: "", options: ["", "", ""], correct: 0, explain: "",
});

/** Questions copied into the other exercise, with ids re-issued.
 *
 *  COPYING BETWEEN THE TWO IS HOW THIS COURSE IS ACTUALLY WRITTEN: the owner's
 *  documents arrive as a full set and a quiz drawn from it, so "these forty
 *  are also the quiz" is the commonest edit there is. The ids cannot travel
 *  with them — a card's id lives in the C space and a quiz question's in the
 *  Q space, both in one id space (`idsIn`), so a copy that kept its id would
 *  be the same id twice and would fail the build. */
export function copiedInto(chapter, kind, picked) {
  const taken = idsIn(chapter);
  return picked.map((q) => {
    const id = nextId(chapter, kind, taken);
    taken.add(id);
    return { ...clone(q), id };
  });
}

/* ---------------------------------------------------------------- searching */
/* A CHAPTER HERE IS THREE HUNDRED AND FORTY-FIVE QUESTIONS. Without this the
   only way to the one about static ports is to scroll past two hundred of
   its neighbours, and every one of those is a mounted textarea.

   Two ways of naming a question, because the owner uses both: by what it says
   ("static port"), and by where it is ("212", or "#212", or its id). A bare
   number is a POSITION rather than a word — there is no question whose text is
   just a number, and asking for the 212th is unambiguous. */
export function askedFor(query) {
  const s = String(query || "").trim();
  if (!s) return { kind: "all" };
  const m = /^#?(\d{1,5})$/.exec(s);
  if (m && Number(m[1]) > 0) return { kind: "at", at: Number(m[1]) };
  return { kind: "text", words: s.toLowerCase().split(/\s+/).filter(Boolean) };
}

/** Does this question answer to these words? Every word, anywhere in it —
 *  the stem, every answer, the reason, and the id. The id is in there because
 *  it is what a bookmark, a caution pile and a bug report all name. */
export function searchHit(q, words) {
  const hay = [q.id, q.question, ...(q.options || []), q.explain || ""].join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** What to show, as `[question, its REAL index]` pairs. The real index is the
 *  load-bearing half: every edit, move and delete addresses the list the
 *  document has, not the list on screen, so a filtered view that renumbered
 *  would delete the wrong question. */
export function shownList(list, query) {
  const a = askedFor(query);
  const pairs = (list || []).map((q, i) => [q, i]);
  if (a.kind === "all") return pairs;
  if (a.kind === "at") return pairs[a.at - 1] ? [pairs[a.at - 1]] : [];
  return pairs.filter(([q]) => searchHit(q, a.words));
}

/* ----------------------------------------------------------------- faults */
/* WHAT CANNOT BE PUBLISHED, and WHERE IT IS. The footer used to carry the
   sentences alone, which told the owner a question three hundred rows down
   was broken and left him to find it. Each fault now carries its address, so
   the footer can be the way there and the row itself can be marked. */
export function faultList(doc) {
  const out = [];
  const seen = new Map();
  (doc?.modules || []).forEach((m, mi) => (m.chapters || []).forEach((c, ci) => {
    const all = [
      ...(c.quiz?.questions || []).map((q, i) => ["quiz", q, i]),
      ...((c.cards || []).map((q, i) => ["cards", q, i])),
    ];
    for (const [kind, q, i] of all) {
      const at = { mi, ci, kind, i, id: q.id || "", where: `${c.name || c.id} · ${kind === "cards" ? "card" : "quiz"} ${q.id || i + 1}` };
      const say = (why) => out.push({ ...at, why });
      if (!q.id) say("no id");
      else if (seen.has(q.id)) say(`${q.id} is used twice`);
      else seen.set(q.id, at);
      if (!String(q.question || "").trim()) say("no question");
      if ((q.options || []).filter((o) => String(o).trim()).length < 2) say("needs at least two answers");
      if (!(q.correct >= 0 && q.correct < (q.options || []).length)) say("no right answer chosen");
    }
  }));
  return out;
}

/** The same faults as the sentences the footer prints. */
export const faultsOf = (doc) => faultList(doc).map((f) => `${f.where}: ${f.why}`);

/** Pages in a PDF, by counting its page objects. 0 when they cannot be seen
 *  — a file whose objects are compressed into streams — and the caller says
 *  so rather than guessing.
 *
 *  COUNTED IN THE BYTES rather than by opening the file with pdf.js. Two
 *  reasons, and the first is a gate: papers are paused, and `check:paused`
 *  asserts that none of the reader's libraries reach the build at all — one
 *  import of the app's pdf.js put a 357KB chunk back in it (caught on the way
 *  in). The second is that this is a page count, not a render. */
export function countPdfPages(bytes) {
  const text = new TextDecoder("latin1").decode(bytes);
  const objects = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (objects > 0) return objects;
  /* Failing that, the page tree's own count, which a linearised file keeps
     near the front. */
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  return counts.length ? Math.max(...counts) : 0;
}
