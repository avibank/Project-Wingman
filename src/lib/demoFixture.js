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

/* How many answers each of them has written in this module's threads, in the
   reference's own order (`ANS` there). It is what fills the "Answering
   questions" row at the foot of Crew — with every count at nought the row
   does not render at all, which is correct behaviour and a 146px hole in a
   diff. */
const ANSWERS = [3, 0, 1, 5, 0, 0, 2, 0, 9, 0, 0, 14, 11, 0];

/* Shaped the way fetchCrew answers, so the screen cannot tell the difference.
   `ch: 4` in the reference means "past the last chapter" — finished the
   module — which is where its "2 have finished it" comes from. */
export function demoCrew(chapterIds = []) {
  const idOf = (n) => chapterIds[n - 1] || `M1.0${n}`;
  const people = PEOPLE.map((p, i) => ({
    userId: `demo_${i}`,
    /* The REAL name, not the callsign: the reference draws initials from it
       on the wall and the first word of it on a helper pill ("Sara", not
       "SPARROW"), and `fetchCrew` answers with `display_name` for the same
       reason. The callsign is beside it for anything that wants it. */
    name: p.n,
    callsign: p.cs || null,
    on: p.on,
    chapterId: p.ch <= chapterIds.length ? idOf(p.ch) : null,
    done: new Set(chapterIds.slice(0, Math.max(0, p.ch - 1))),
    answers: ANSWERS[i] || 0,
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

/* ---------------------------------------------------------------- the licence
   `ME` from reference/02-licence-stamp-creator.html, the profile the reference
   card is drawn from. The same reason as the Crew fixture above: a diff
   between different content measures the content. Hassan is the owner's own
   name and is in the reference build as sample data; nothing here reaches a
   server, and `demoOn()` is false in every production build. */
export const DEMO_ME = {
  name: 'Hassan Alrefaei',
  callsign: 'h.alrefaei',
  bio: '',
  phrase: 'Torqued to spec. Emotionally too.',
  cover: 'contour',
  cover_ink: null,
  admin: true,
  stats: [
    { label: 'Hours flown', value: '13h 54m' },
    { label: 'Lessons signed off', value: '7' },
    { label: 'Days flown', value: '12' },
  ],
};

/* The card's profile, with the reference's own values in front of whatever the
   harness store holds. One place, so the licence card and "how others see you"
   cannot disagree. Off the flag it is exactly the object that was written
   inline before. */
export function demoProfile(card, { callsign, real_name } = {}) {
  const base = { ...(card || {}), callsign: callsign || card?.callsign, real_name: real_name || card?.real_name };
  if (!demoOn()) return base;
  return {
    ...base,
    callsign: DEMO_ME.callsign,
    real_name: DEMO_ME.name,
    bio: DEMO_ME.bio,
    phrase: DEMO_ME.phrase,
    cover: DEMO_ME.cover,
    cover_ink: DEMO_ME.cover_ink,
    photo_url: null,
  };
}

/* ------------------------------------------------------------- preferences
   The two values the reference's Preferences panel is drawn with. Same reason
   as everything above: a diff between different settings measures the
   settings. `open` is the reference's selected social preset and 86 is where
   its bar sits. */
export const DEMO_PRESET = 'open';
export const DEMO_BAR = 86;

/* -------------------------------------------------------------- the Library
   The reference's own three papers (`PAPERS` in
   docs/launch/code/13-module-tabs-and-library.js). Same reason as everything
   above: with one paper on one side and three on the other, a diff of the
   Library measures the shelf rather than the row.

   `chapterId` is left null on all three: the reference files them by chapter
   number and this app files them by chapter id, and the chip row is what that
   would change — not a row's layout. */
export const DEMO_PAPERS = [
  { id: 'demo-p1', title: 'B2 13d Instruments, Rotary Wing Aerodynamics, Autoflight and Equipment & Furnishings LTT (2)',
    kind: 'PDF', pages: 1012, chapterId: null, status: 'ready' },
  { id: 'demo-p2', title: 'Numbers and arithmetic · class handout',
    kind: 'PDF', pages: 42, chapterId: null, status: 'ready' },
  { id: 'demo-p3', title: 'Standard form worked examples',
    kind: 'PDF', pages: 18, chapterId: null, status: 'ready' },
];
