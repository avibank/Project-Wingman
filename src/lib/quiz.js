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

export const estimate = n => `about ${Math.max(1, Math.round(n * SECONDS_PER_Q / 60))} minutes`;

/* THE CLOCK, AND WHY IT COUNTS DOWN.

   This file used to argue the opposite, at length: that a countdown is a
   threat because it decides when you stop, and that elapsed time is
   information you asked for. That was right for a revision tool and wrong for
   what this screen became. The approved exam screen is a rehearsal for the
   paper these students actually sit, and that paper is timed — so a student
   who has never practised against a clock meets one for the first time in an
   examination hall, which is the one place nobody should meet anything for the
   first time.

   THE ALLOWANCE IS A FLAT TWENTY MINUTES, and that reverses what stood here.
   It used to be this file's own nominal 75 seconds a question, so an
   eight-question chapter quiz was ten minutes and a forty-question one was
   fifty. R5 of the exam brief fixes it instead: "The fixed exam clock is 20
   minutes for any quiz up to 40 questions." Owner's decision, 2026-09-20.

   A FIXED CLOCK IS A DIFFERENT EXERCISE FROM A PER-QUESTION ONE, and that is
   the point rather than a side effect. Scaling the allowance means every
   paper feels the same however long it is, which is comfortable and is not
   what the real one does: the paper these students sit gives a fixed sitting
   and the length of it is part of what they are rehearsing. On a short
   chapter quiz twenty minutes is generous, which is correct — the clock is
   there to be practised against, not to catch anybody out.

   `estimate` keeps the 75 seconds. It answers a different question — "how
   long will this take me" on a row you have not opened — and a row reading
   "about 20 minutes" for every quiz in the module would say nothing at all.

   IT IS NOT ELAPSED-SINCE-START, and that is the bug this replaced rather than
   a detail. `elapsed(startedAt)` shipped, and startedAt is persisted with the
   attempt — so a paper opened on Monday and returned to on Wednesday read
   202:29:37. The time left belongs to the attempt and moves only while the
   paper is on screen, which is also what makes leaving and coming back keep
   it. */
export const SECONDS_LOW = 60;               // the last minute, in --bad
export const EXAM_SECONDS = 20 * 60;     // R5 — flat, for any quiz up to 40 Qs
export const EXAM_MAX_QS = 40;

/* Past forty the brief stops speaking, so the per-question figure comes back
   rather than a forty-one-question paper silently getting the same twenty
   minutes as an eight-question one. Nothing in this app is near it today;
   this is the edge being stated instead of left to be discovered. */
export const allowanceFor = (n) => {
  const qs = Math.max(0, Math.round(n || 0));
  return qs <= EXAM_MAX_QS ? EXAM_SECONDS : qs * SECONDS_PER_Q;
};

export const clock = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* A paper written before the clock existed carries no `left`, and so does one
   whose stored number went missing. Both get the whole allowance, rather than
   a paper that hands itself in the moment it opens. */
export const timeLeft = (a) =>
  Number.isFinite(a?.left) ? Math.max(0, a.left) : allowanceFor(a?.answers?.length || 0);

/* One second off, never below zero, and a handed-in paper's clock is stopped. */
export function tick(a, by = 1) {
  if (!a || a.submittedAt) return a;
  return { ...a, left: Math.max(0, timeLeft(a) - by) };
}

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
    left: allowanceFor(quiz.questions.length),   // seconds, counted down
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

export const flagged = a => a.flagged.reduce((acc, v, i) => v ? [...acc, i] : acc, []);

/* WHAT THE HAND-IN SCREEN SAYS, decided here rather than in the component.

   It is the last thing between a student and a score they cannot take back, so
   it states what is true and nothing else: how many are answered, which have
   no answer, and which were flagged. Never "are you sure?" — a question that
   carries no information and that everybody clicks through.

   R11 of the house voice applies: no sentence here states a zero. A paper with
   nothing outstanding gets one line saying so, in the affirmative. */
export function handIn(a) {
  const blanks = unanswered(a);
  const marks = flagged(a);
  return {
    answered: answeredCount(a),
    total: a.answers.length,
    blanks,
    marks,
    clean: blanks.length === 0 && marks.length === 0,
    line: blanks.length === 0
      ? "Every question has an answer."
      : blanks.length === 1
        ? "One question has no answer yet."
        : `${blanks.length} questions have no answer yet.`,
  };
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
   5 · THE KEYBOARD, AND WHY THERE IS NOT ONE ANY MORE
   ----------------------------------------------------------------------------
   1/2/3 to answer, Enter to advance, F to flag: free, and much faster for
   revision on a laptop. The approved exam screen takes all three away, and
   `quizKey` went with them. On a paper you cannot unsubmit, a shortcut that
   answers a question is a shortcut that answers it by accident — and F is a
   letter people type.

   What is left is what the browser gives any form and what a screen reader
   expects: Tab to the control, Enter or Space to press it, and the arrow keys
   inside the radio group. Nothing on this screen listens for a key itself.
   ========================================================================= */


/* ============================================================================
   6 · THE NAVIGATOR
   ----------------------------------------------------------------------------
   Rule: a row of squares, one per question, showing answered / flagged /
   current. It is the single most reassuring control in any test interface —
   you always know what is left and whether you skipped one.
   ========================================================================= */

export function navigator(a, marks = null) {
  return a.answers.map((v, i) => ({
    index: i,
    n: i + 1,
    state: i === a.at ? 'current' : v !== null ? 'answered' : 'blank',
    /* ANSWERED IS A FACT, NOT A THIRD STATE, for the same reason flagged is
       not a fourth one. `state` collapses the two: the question you are on
       reads 'current' whether or not it has an answer, so a screen that paints
       'answered' from it leaves the box you are standing on looking blank —
       and the box you are standing on is the one you just answered. The
       approved exam screen draws both marks at once, a filled box with a ring
       around it, which is what a student needs to see. */
    answered: v !== null,
    current: i === a.at,
    flagged: a.flagged[i],
    /* After the paper is handed in the same row of squares becomes the map of
       the review, so it carries the mark as well. Before then `marks` is null
       and nothing on this screen knows whether anything is right — which is
       the whole point of an exam. */
    mark: marks ? (marks[i] ? 'right' : 'wrong') : null,
  }));
}
/* Flagged is a separate mark, not a fourth state — a question can be both
   answered and flagged, and that combination is the whole point of flagging. */


/* ============================================================================
   6b · THE OPTION ORDER, AND WHY IT IS SEEDED FROM THE ATTEMPT

   Options are shuffled per sitting so a student cannot learn "it is always B".
   The seed has to come from the ATTEMPT, not from the clock, because an exam
   can be left and come back to: an answer is stored as "the second option", and
   if the shuffle is reseeded on the way back in, the second option is a
   different sentence and every restored answer is silently wrong.

   startedAt is part of the attempt and is persisted with it, so it is the one
   number that is guaranteed to be the same on the way back.
   ========================================================================= */
export function seedOf(attempt) {
  const t = new Date(attempt?.startedAt || 0).getTime();
  return Number.isFinite(t) ? Math.abs(t % 100000) : 1;
}


/* ============================================================================
   7 · WHAT WAS DELIBERATELY NOT TAKEN
   ----------------------------------------------------------------------------
   · No countdown timer — until the approved exam screen made this paper a
     rehearsal for a timed one. Section 1 carries that argument, and what the
     old elapsed clock read on a paper left open for two days.
   · No points, leaderboards, streaks, memes or sound. With eleven classmates
     who all know each other, a leaderboard is a ranking of your friends.
   · No four fixed answer colours. That is Kahoot's branding and it breaks the
     six-livery system — neutral rows, accent on the selected one.
   · No 2x2 tile grid. Real maintenance options are full sentences and a grid
     of sentences is a mess. A vertical list handles any length.
   · No certificate, no "pass", no credential language of any kind.
   ========================================================================= */
