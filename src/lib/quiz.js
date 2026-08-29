/* ============================================================================
   Wingman — the quiz
   Shaped after the exam these students will actually sit.

   Copy the pure functions verbatim. Do not re-derive them.

   THE SHAPE, AND WHERE IT COMES FROM

   EASA Part-66 basic examinations use three alternatives labelled (A), (B) and
   (C) — one correct, two "plausible/incorrect, being incomplete in some
   definite aspect". Pass mark 75%. Papers are timed at a nominal 75 seconds a
   question.

   So three options is not a style preference: it is the format your students
   are training toward. It also settles three loose decisions for free —
   8 questions reads as "about 10 minutes", the pass mark reads as "6 of 8",
   and the distractor rule is a writing guide, not just a UI note.

   WHAT THIS IS NOT

   It is not a Part-66 examination and the copy must never imply that it is.
   No certificates, no "you passed Module 7", no module numbers mirroring the
   real syllabus. "Pass mark is 6" is a study target. Anything that reads as a
   credential is out.
   ========================================================================= */


/* ============================================================================
   1 · THE RULES
   ========================================================================= */

export const OPTIONS = 3;
export const LABELS = ['A', 'B', 'C'];
export const PASS_MARK = 0.75;          // 75%
export const SECONDS_PER_Q = 75;        // nominal, for the estimate only

/* NO COUNTDOWN. A timer measures reaction speed, not knowledge, and it is
   stressful — fine for a classroom game with a projector, wrong for someone
   revising alone at midnight. Show the estimate on the start screen and then
   leave them alone. */
export const estimate = n => `about ${Math.max(1, Math.round(n * SECONDS_PER_Q / 60))} minutes`;

export const passAt = n => Math.ceil(n * PASS_MARK);   // 8 -> 6


/* ============================================================================
   2 · THE ATTEMPT
   ----------------------------------------------------------------------------
   Rule: answer everything, submit, then review. Nothing is marked until you
   submit.
   ========================================================================= */

/* WHY NOT INSTANT FEEDBACK.

   Instant marking teaches better in the abstract — you learn at the moment of
   being wrong. But the model here is *exam*, and in an exam you commit to a
   paper. It also makes the review screen the teaching moment, which is where
   the explanation, the lesson link and the student's own notes all already
   live.

   Two modes (Exam and Practice) is the obvious "both" answer and it should be
   resisted for now: it is twice the work and the beta has not asked for it. */

export function newAttempt(quiz) {
  return {
    quizId: quiz.id,
    lessonIds: quiz.questions.map(q => q.lessonId),
    answers: new Array(quiz.questions.length).fill(null),  // null = unanswered
    flagged: new Array(quiz.questions.length).fill(false),
    at: 0,                       // which question is on screen
    submittedAt: null,
    startedAt: new Date().toISOString()
  };
}

export function answer(a, index, choice) {
  if (a.submittedAt) return a;                       // a submitted paper is closed
  const answers = [...a.answers];
  answers[index] = answers[index] === choice ? null : choice;   // tap again to clear
  return { ...a, answers };
}

export function flag(a, index) {
  const flagged = [...a.flagged];
  flagged[index] = !flagged[index];
  return { ...a, flagged };
}

export const goTo = (a, index, n) => ({ ...a, at: Math.min(n - 1, Math.max(0, index)) });
export const next = (a, n) => goTo(a, a.at + 1, n);
export const prev = (a, n) => goTo(a, a.at - 1, n);

export const unanswered = a => a.answers.reduce((acc, v, i) => v === null ? [...acc, i] : acc, []);
export const answeredCount = a => a.answers.filter(v => v !== null).length;

/* Submitting with blanks is allowed — it is a study tool, not an invigilated
   room — but it has to say so first, because leaving one blank by accident is
   the commonest way to lose a mark you knew. */
export const submitWarning = a => {
  const u = unanswered(a);
  if (!u.length) return null;
  return u.length === 1
    ? `Question ${u[0] + 1} has no answer.`
    : `${u.length} questions have no answer.`;
};

export function submit(a) {
  return a.submittedAt ? a : { ...a, submittedAt: new Date().toISOString() };
}


/* ============================================================================
   3 · THE RESULT
   ========================================================================= */

export function score(attempt, quiz) {
  const marks = quiz.questions.map((q, i) => attempt.answers[i] === q.correct);
  const right = marks.filter(Boolean).length;
  const need = passAt(quiz.questions.length);
  return {
    right,
    total: quiz.questions.length,
    need,
    passed: right >= need,
    marks,
    wrong: marks.reduce((acc, ok, i) => ok ? acc : [...acc, i], [])
  };
}

/* "6 of 8 — pass mark is 6". Not a percentage. The figure a student can act on
   is how many they got, against how many they needed. */
export const scoreLine = s => `${s.right} of ${s.total} — pass mark is ${s.need}`;

/* THE REVIEW IS THE TEACHING MOMENT.
   Each wrong answer with what you chose, what was right, the explanation, and
   the lesson it came from — which is a JOIN on lessonId, never a semantic
   match. Your own notes for those lessons hang off the same key. */
export function review(attempt, quiz) {
  return score(attempt, quiz).wrong.map(i => {
    const q = quiz.questions[i];
    return {
      index: i,
      question: q.question,
      chose: attempt.answers[i] === null ? null : q.options[attempt.answers[i]],
      choseLabel: attempt.answers[i] === null ? null : LABELS[attempt.answers[i]],
      correct: q.options[q.correct],
      correctLabel: LABELS[q.correct],
      explain: q.explain,
      lessonId: q.lessonId
    };
  });
}

/* THE MOST USEFUL REVISION FEATURE FOR THE LEAST WORK.
   Retake only the ones you got wrong. One button on the results screen. */
export function retakeWrong(attempt, quiz) {
  const wrong = score(attempt, quiz).wrong;
  if (!wrong.length) return null;
  return {
    quiz: { ...quiz, id: quiz.id + '.retake', questions: wrong.map(i => quiz.questions[i]) },
    from: wrong
  };
}

/* Which lessons to rewatch, most-missed first. Feeds the review screen and the
   module hero's finished state. */
export function weakLessons(attempt, quiz) {
  const counts = {};
  for (const i of score(attempt, quiz).wrong) {
    const id = quiz.questions[i].lessonId;
    counts[id] = (counts[id] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([lessonId, missed]) => ({ lessonId, missed }));
}


/* ============================================================================
   4 · IT MUST SURVIVE A DROPPED CONNECTION
   ----------------------------------------------------------------------------
   Rule: every answer is written locally the moment it is given. Nothing waits
   for submit.
   ========================================================================= */

/* THE WORST THING THAT COULD HAPPEN IN THE BETA is eight answers vanishing
   because someone walked past a dead spot on campus wifi. That is the story
   they tell the other ten.

   Write to localStorage on every change, keyed by quiz. Restore on mount. Clear
   only once the server has acknowledged the submission. */
export const attemptKey = quizId => `wingman.attempt.${quizId}`;

export function saveAttempt(a) {
  try { localStorage.setItem(attemptKey(a.quizId), JSON.stringify(a)); } catch {}
  return a;
}

export function loadAttempt(quizId) {
  try {
    const raw = localStorage.getItem(attemptKey(quizId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAttempt(quizId) {
  try { localStorage.removeItem(attemptKey(quizId)); } catch {}
}

/* Coming back to a half-finished paper should say so rather than silently
   restoring — a student who left it open yesterday needs to know why there are
   already answers on it. */
export const resumeLine = a =>
  !a || a.submittedAt ? null
  : `You have ${answeredCount(a)} of ${a.answers.length} answered from earlier.`;


/* ============================================================================
   5 · THE KEYBOARD
   ----------------------------------------------------------------------------
   1/2/3 to answer, Enter to advance, F to flag. Free, and much faster for
   revision on a laptop.
   ========================================================================= */

/* Same guard as everywhere else: dead while anything is being typed into.
   There is no text input on the quiz today, but there will be the day someone
   adds a "report this question" box. */
export function quizKey(e) {
  const el = e.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return null;
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === '1' || e.key === '2' || e.key === '3') return { type: 'answer', choice: +e.key - 1 };
  switch (e.key) {
    case 'Enter': return { type: 'next' };
    case 'ArrowRight': return { type: 'next' };
    case 'ArrowLeft': return { type: 'prev' };
    case 'f': case 'F': return { type: 'flag' };
    default: return null;
  }
}


/* ============================================================================
   6 · THE NAVIGATOR
   ----------------------------------------------------------------------------
   Rule: a row of squares, one per question, showing answered / flagged /
   current. It is the single most reassuring control in any test interface —
   you always know what is left and whether you skipped one.
   ========================================================================= */

export function navigator(a) {
  return a.answers.map((v, i) => ({
    index: i,
    n: i + 1,
    state: i === a.at ? 'current' : v !== null ? 'answered' : 'blank',
    flagged: a.flagged[i]
  }));
}
/* Flagged is a separate mark, not a fourth state — a question can be both
   answered and flagged, and that combination is the whole point of flagging. */


/* ============================================================================
   7 · WHAT WAS DELIBERATELY NOT TAKEN
   ----------------------------------------------------------------------------
   · No countdown timer.
   · No points, leaderboards, streaks, memes or sound. With eleven classmates
     who all know each other, a leaderboard is a ranking of your friends.
   · No four fixed answer colours. That is Kahoot's branding and it breaks the
     six-livery system — neutral rows, accent on the selected one.
   · No 2x2 tile grid. Real maintenance options are full sentences and a grid
     of sentences is a mess. A vertical list handles any length.
   · No certificate, no "pass", no credential language of any kind.
   ========================================================================= */
