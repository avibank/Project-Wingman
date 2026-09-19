/* =============================================================================
   ?fixture=demo — THE REFERENCE BUILD'S OWN SAMPLE DATA, IN DEV ONLY.
   -----------------------------------------------------------------------------
   tools/ref-diff.mjs photographs a reference page and the live screen and
   diffs them. Two things have to match before a pixel diff means anything:

   · THE DATA. The reference's Crew has fourteen people on Module 1; the app's
     has whatever the harness store happens to hold. A diff between different
     content measures the content.
   · THE SKIN. The reference's dark values ARE this app's Sky night livery, to
     the decimal — `--ground:oklch(.14 .0178 255)`, `--panel:…/.78`. It has one
     palette and the app has six, so the flag pins the one they share. That is
     not a fudge: it is the same tokens, which is why the reference could be
     written against this app's vocabulary in the first place.

   DEV ONLY, and enforced rather than promised: every export checks
   `import.meta.env.DEV`, so in a production build `demoOn()` is constantly
   false and the sample below is dropped by the bundler. It is also never
   reachable — public/__ref is deleted from dist (vite.config.js).
   ========================================================================= */

export const demoOn = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get('fixture') === 'demo';
  } catch { return false; }
};

/* The skin the reference is drawn in. App.jsx pins these while the flag is on
   so the two sides are the same six colours.

   Three constants rather than one object, because check:one-livery refuses
   any `.livery` read off a row — it is what stops a SECOND livery system
   coming back (CLAUDE.md), and `DEMO_SKIN.livery` looks exactly like one. */
export const DEMO_LIVERY = 'sky';
export const DEMO_VARIANT = 'night';
export const DEMO_FINISH = null;

/* Copied from reference/01-module-lesson-crew.html, `const people`. Fourteen,
   plus the student, is the "15" on the Crew badge and in "15 on Module 1". */
const PEOPLE = [
  { n: 'Sara Al-Mutairi', cs: 'SPARROW', ch: 2, on: true, sq: true },
  { n: 'Fahad Al-Enezi', cs: 'RIVET', ch: 2, on: false, sq: true },
  { n: 'Yousef Karam', cs: 'TORQUE', ch: 1, on: true, sq: true },
  { n: 'Noor Hassan', cs: '', ch: 3, on: false, sq: true },
  { n: 'Mariam Al-Sabah', cs: 'HALO', ch: 1, on: true },
  { n: 'Abdullah Faraj', cs: '', ch: 1, on: false },
  { n: 'Dana Qasem', cs: 'VECTOR', ch: 2, on: true },
  { n: 'Hamad Rashed', cs: '', ch: 2, on: false },
  { n: 'Lulwa Behbehani', cs: 'MACH', ch: 3, on: false },
  { n: 'Omar Saleh', cs: '', ch: 3, on: true },
  { n: 'Reem Al-Ali', cs: 'KITE', ch: 1, on: false },
  { n: 'Bader Al-Shatti', cs: 'GIMBAL', ch: 4, on: false },
  { n: 'Haya Dashti', cs: '', ch: 4, on: true },
  { n: 'Khaled Marafi', cs: 'FLAP', ch: 3, on: false },
];

/* Shaped the way fetchCrew answers, so the screen cannot tell the difference.
   `ch: 4` in the reference means "past the last chapter" — finished the
   module — which is where its "2 have finished it" comes from. */
export function demoCrew(chapterIds = []) {
  const idOf = (n) => chapterIds[n - 1] || `M1.0${n}`;
  const people = PEOPLE.map((p, i) => ({
    userId: `demo_${i}`,
    name: p.cs || p.n,
    on: p.on,
    chapterId: p.ch <= chapterIds.length ? idOf(p.ch) : null,
    done: new Set(chapterIds.slice(0, Math.max(0, p.ch - 1))),
    answers: 0,
    stamp: null,
  }));
  return {
    people,
    onNow: people.filter((p) => p.on).length,
    finished: PEOPLE.filter((p) => p.ch > chapterIds.length).length,
    solo: false,
    here: idOf(2),
  };
}

/* The module's own line, which is missing on the live screen entirely. The
   reference reads "6 lessons and 3 quizzes" for three chapters of two. */
export const demoSubtitle = (chapters = []) => {
  const lessons = chapters.reduce((n, c) => n + (c.lessons?.length || 0), 0);
  return `${lessons} lessons and ${chapters.length} quizzes`;
};
