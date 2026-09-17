import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  newAttempt, answer, flag, goTo, next as nextQ, prev as prevQ, submit,
  score, review, weakLessons, retakeWrong, scoreLine,
  navigator as navRow, seedOf, saveAttempt, loadAttempt, clearAttempt,
  passAt, answeredCount, flagged, unanswered, tick, timeLeft, clock,
  SECONDS_LOW, LABELS,
} from "../../lib/quiz.js";
import { shuffleOptions } from "../../lib/retention.js";
import { PASS_PCT } from "../../lib/minimums.js";
import "./exam.css";
/* The matte finish, after the screen's own sheet because it overrides it. It
   is keyed on <html data-screen="exam">, which the effect below sets. */
import "./exam-matte.css";
/* Going through the paper is the drill's stylesheet, not the exam's: it is the
   same screen the re-check and put-right flows draw, and the two should not
   drift apart because one of them was ported. */
import "./quiz.css";

/* =============================================================================
   THE PAPER.

   A chapter quiz is an exam, and this is the shape of one: answer everything,
   hand it in, then see what you missed. Nothing is marked while you are
   sitting it.

   -----------------------------------------------------------------------------
   THIS REVERSES Review.jsx, AND THE REVERSAL IS THE POINT

   Review.jsx's header records that Part 14's exam was replaced by immediate
   feedback — answer, see why, move on. That instruction was right for what
   Review is now used for, and Review keeps doing it: the re-check and put-right
   flows are DRILLS. You are being handed back something you already got wrong,
   and the moment of being wrong again is the whole lesson.

   A chapter quiz is not a drill. It is a rehearsal for a paper these students
   will sit under exam conditions, where you commit to an answer without being
   told, you can go back and change your mind, you flag the ones you are not
   sure about, and you find out at the end.

   -----------------------------------------------------------------------------
   THE SCREEN IS A PORT, THE MODEL IS NOT

   The markup and every size on it come from the approved exam screen
   (`wingman-exam.html` / `.css`, signed off outside the repo). What an attempt
   is, when it may change, what counts, and what the clock reads are all still
   lib/quiz.js — nothing about an attempt is decided in this file.

   Three things the approved screen changed, and they are changes rather than
   ports: the clock counts DOWN and hands the paper in at zero (quiz.js §1 has
   the argument and the 202-hour bug it replaced); the keyboard shortcuts are
   gone (quiz.js §5); and the result screen carries the review inside it, so
   there is no second screen behind a button.
   ========================================================================= */

/* The design's own glyphs, kept as the design drew them. lucide has near
   misses for four of these and the near miss is the problem: the retry arrow
   and the target are the two marks this screen uses to mean "go again" and
   "your bar", and they have to be those exact shapes in both places. */
const IconPass = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="m7.5 12.3 3 3 6-6.3" />
  </svg>
);
/* THE RESULT'S MARK IS THE AEROPLANE, in an outlined circle in the accent —
   the matte finish's own, and the same glyph whatever the score. The screen
   before this one gave the tick to a pass and a retry arrow to a not-yet; the
   matte handoff replaces both, and the verdict is still said in words on the
   line beside it and drawn in the colour of the score line under it. */
const IconPlane = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
  </svg>
);
const IconBar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);
const IconRight = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8.5" strokeWidth="1.4" /><path d="m6.5 10.2 2.4 2.4 4.6-4.8" />
  </svg>
);
const IconMissed = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8.5" strokeWidth="1.4" strokeDasharray="2.5 2.2" /><path d="M10 6v5M10 13.8v.2" />
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
const IconFlagSolid = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 15V2h9l-2 3.25L12 8.5H4.5V15z" /></svg>
);
const IconFlagLine = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 14V2.5h8.5l-1.8 3 1.8 3H3" /></svg>
);
const IconBack = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
);
const IconOn = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
);

/* ONE ROW OF THE REVIEW: the number, the question, what they picked struck
   through, and what was right. A question with no answer shows a dash rather
   than a sentence, because "you left this blank" is a sentence about them.

   AT MODULE SCOPE, AND THAT IS NOT TIDINESS. Declared inside the component it
   is a new component type on every render — and the result screen renders
   about sixty times while the percentage counts up — so React threw every row
   away and built it again each time. Each new row started the rise animation
   over, so rows that should have arrived at 1.1s were still at nothing three
   seconds later, and the list read as empty while it was working. Found by
   measuring: the rows the test was holding were detached from the document. */
function ReviewRow({ item, mine, n, k }) {
  const right = mine === item.correct;
  return (
    <li className="result__row" style={{ "--i": k }}>
      <span className="result__n">{String(n).padStart(2, "0")}</span>
      <span className="result__q">
        {item.question}
        {!right && (
          <span className="ans">
            {mine === null
              ? <span className="ans--blank">—</span>
              : <s className="ans--wrong"><span className="ans__l">{LABELS[mine]}</span> {item.options[mine]}</s>}
            <span className="ans__arrow" aria-label="correct answer"><IconArrow /></span>
            <span className="ans--right"><span className="ans__l">{LABELS[item.correct]}</span> {item.options[item.correct]}</span>
          </span>
        )}
      </span>
      <span className={`result__mark ${right ? "is-right" : "is-wrong"}`} aria-label={right ? "Right" : "Missed"}>
        {right ? <IconRight /> : <IconMissed />}
      </span>
    </li>
  );
}

export default function Exam({
  title, eyebrow, questions, quizId, resumeAt = 0, lessons = [],
  minimums = PASS_PCT, onProgress, onAnswers, onDone, onOpenLesson,
}) {
  /* A lesson id is not a name. Without this, "where these came from" reads as
     a row of ids, which is a worse answer than no list at all. */
  const lessonName = useCallback(
    (id2) => lessons.find((l) => l.id === id2)?.title || "That lesson",
    [lessons],
  );
  /* A SITTING IS A FIXED SET, latched at mount. A set derived from a list that
     changes underneath an index makes the paper skip questions and end early. */
  const [set] = useState(questions);
  const id = quizId || `chapter:${questions[0]?.id || "quiz"}`;

  /* One attempt, restored if there is one to restore — answers, flags, the
     question you were on and the time you had left. The clock only moves while
     the paper is on screen, so coming back tomorrow comes back to the same
     number rather than to a paper that has run out. */
  const [attempt, setAttempt] = useState(() => {
    const held = loadAttempt(id);
    if (held && !held.submittedAt && held.answers?.length === questions.length) {
      return {
        ...held,
        at: Math.min(resumeAt || held.at || 0, questions.length - 1),
        left: timeLeft(held),
      };
    }
    return newAttempt({ id, questions });
  });
  const [phase, setPhase] = useState("paper");     // paper | done | review | retake
  const [leaving, setLeaving] = useState(false);

  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const gridRef = useRef(null);
  const dialogRef = useRef(null);

  /* Smooth Air is this app's own reduced-motion switch and it is a class, not
     a media query, so a student can turn the motion off without changing
     anything about their machine. Both have to stop the same animations, and
     the ones this file runs by hand (the slide, the count-up) are not reachable
     from CSS. */
  const calm = useCallback(() => {
    const byOS = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    return byOS || !!rootRef.current?.closest(".app")?.classList.contains("smooth-air");
  }, []);

  /* Each phase starts at its own top: handing in from the bottom of question 8
     otherwise lands on the result screen already scrolled past the score. */
  useEffect(() => { rootRef.current?.scrollIntoView({ block: "start", behavior: "auto" }); }, [phase]);

  /* THE EXAM IS ITS OWN LIGHT. A paper is read under a flat matte ground with
     nothing moving behind it — no Aurora bands, no ruled Manual paper, no
     gradient glow — so the exam's stylesheet re-grounds the whole document
     while it is on screen, and takes the scenery off with it. The flag goes on
     <html> rather than on this component because the tokens it overrides are
     written there, inline, by the theme layer; it stays through the result and
     comes off when the quiz does. */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.screen = "exam";
    return () => { delete root.dataset.screen; };
  }, []);

  /* The option order is seeded from the ATTEMPT, never from the clock. An
     answer is stored as "the second option"; reseed on the way back in and the
     second option is a different sentence, so every restored answer is quietly
     wrong. startedAt travels with the attempt, so it is the one number that is
     the same both times. */
  const seed = seedOf(attempt);
  const paper = useMemo(
    () => set.map((q, i) => ({ ...q, ...shuffleOptions(q, seed + i * 17) })),
    [set, seed],
  );
  const quiz = useMemo(() => ({ id, questions: paper }), [id, paper]);

  /* EVERY CHANGE IS DERIVED FROM THE LATEST ATTEMPT, NEVER FROM THE RENDER.
     Two changes inside one frame both start from the render's snapshot, and
     the second overwrites the first — the answer simply does not appear, which
     is the worst kind of bug on a paper: silent, rare, and impossible to
     reproduce while somebody is watching. */
  const put = useCallback((fn) => { setAttempt((prev) => saveAttempt(fn(prev))); }, []);
  const at = attempt.at;
  const q = paper[at];
  const total = paper.length;
  const left = timeLeft(attempt);

  /* Where you got to, so the deck can offer to put you back. The handler lives
     in a ref and is NOT a dependency: it arrives as a fresh arrow on every
     render of the parent, and what it calls is a debounced write to the
     server. */
  const report = useRef(onProgress);
  report.current = onProgress;
  useEffect(() => { report.current?.(at, null); }, [at]);

  /* ------------------------------------------------------------- hand it in */
  const handedRef = useRef(false);
  const handOver = useCallback(() => {
    if (handedRef.current) return;
    handedRef.current = true;
    dialogRef.current?.close();
    const done = submit(attempt);
    put(() => done);
    const s = score(done, quiz);
    /* Retention is fed here rather than per question, because in an exam
       nothing is marked until now — and ALL OF THEM IN ONE CALL, not one call
       per question: separate calls land in a single tick, every one reads the
       same pre-render state, and all but the last are overwritten. */
    onAnswers?.(paper.map((question, i) => [question.id, s.marks[i]]));
    onDone?.({ right: s.right, toCaution: s.total - s.right, toHolding: s.right });
    clearAttempt(id);
    if (calm()) { setPhase("done"); return; }
    setLeaving(true);
    setTimeout(() => { setLeaving(false); setPhase("done"); }, 280);
  }, [attempt, quiz, paper, put, onAnswers, onDone, id, calm]);

  /* The clock. One second at a time, only while the paper is open, and the
     paper hands itself in at zero exactly as if End and mark had been
     pressed. */
  useEffect(() => {
    if (phase !== "paper") return undefined;
    const t = setInterval(() => put((a) => tick(a)), 1000);
    return () => clearInterval(t);
  }, [phase, put]);

  useEffect(() => {
    if (phase === "paper" && left <= 0) handOver();
  }, [phase, left, handOver]);

  /* The question slides in from the direction of travel, and the answers
     follow it one after another. WAAPI rather than CSS, because what has to be
     animated is a list that React has just replaced. */
  const cameFrom = useRef(at);
  useEffect(() => {
    const dir = at === cameFrom.current ? 0 : at > cameFrom.current ? 1 : -1;
    cameFrom.current = at;
    if (!dir || calm() || !mainRef.current) return;
    const els = mainRef.current.querySelectorAll(".question__text, .option");
    els.forEach((el, k) => el.animate(
      [{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: "none" }],
      { duration: 320, delay: k * 35, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" },
    ));
  }, [at, calm]);

  /* The grid box pops when its question gets an answer. The class has to come
     off and go back on with a reflow between, or a second answer to the same
     question does nothing. */
  const pop = useCallback((i) => {
    const cell = gridRef.current?.querySelector(`[data-i="${i}"]`);
    if (!cell || calm()) return;
    cell.classList.remove("pop");
    void cell.offsetWidth;
    cell.classList.add("pop");
  }, [calm]);

  /* The model owns what an answer is. `answer()` clears a choice you pick
     twice, which was the old row of buttons; a radio group cannot fire that —
     a browser sends no `change` for the option already checked — so here it
     only ever replaces, which is what the approved screen says it does. */
  const choose = (i) => { put((a) => answer(a, a.at, i)); pop(at); };

  /* ---------------------------------------------------------------- results */
  const result = useMemo(() => {
    if (phase !== "done") return null;
    const s = score(attempt, quiz);
    const pct = Math.round((s.right / s.total) * 100);
    const shortBy = passAt(s.total) - s.right;
    return { ...s, pct, shortBy, bar: minimums, sameBar: minimums === PASS_PCT };
  }, [phase, attempt, quiz, minimums]);

  const [shown, setShown] = useState(0);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!result) { setShown(0); setInView(false); return undefined; }
    if (calm()) { setShown(result.pct); setInView(true); return undefined; }
    let raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setInView(true)); });
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1000);
      setShown(Math.round(result.pct * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const first = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(first); };
  }, [result, calm]);

  const again = () => {
    handedRef.current = false;
    setInView(false);
    setShown(0);
    setPhase("paper");
    put(() => saveAttempt(newAttempt({ id, questions: set })));
  };

  if (!q) return null;

  /* ------------------------------------------------------- going through it
     THE TEACHING MOMENT, AND IT IS ITS OWN SCREEN. The approved result screen
     states the score and corrects every miss in a line — pick struck through,
     arrow, right answer — and that is as much as it will hold without burying
     the one number the student came for. The explanation, the lesson each miss
     came from, and a paper of only the ones they missed are all a step further
     in, behind one button on the result's footer.

     Kept in the language the drill's screens still speak, because that is what
     it shares a stylesheet with; the exam screen's own design stops at the
     result. */
  if (phase === "review") {
    const s = score(attempt, quiz);
    const wrong = review(attempt, quiz);
    const weak = weakLessons(attempt, quiz);
    const missed = new Set(s.wrong);

    return (
      <div className="quiz" ref={rootRef}>
        <div className="quiz-head">
          <span className="quiz-where">{title}</span>
          <span className="quiz-name">Going through it</span>
          <span className="quiz-count">{scoreLine(s)}</span>
          <button type="button" className="quiz-leave" onClick={() => setPhase("done")}>Back</button>
        </div>

        <div className="quiz-body">
          <div className="nav nav-inline" role="list" aria-label="Every question">
            {navRow(attempt, s.marks).map((n) => (
              <span key={n.index} className="nav-sq" role="listitem"
                    data-mark={n.mark} data-flag={n.flagged ? "1" : undefined}>
                {n.n}
              </span>
            ))}
          </div>

          {/* WHICH LESSONS TO GO BACK TO, before the questions themselves. A
              student who missed three questions does not need three
              explanations, they need the one lesson all three came from. The
              join is on lessonId and never on resemblance. */}
          {weak.length > 0 && onOpenLesson && (
            <section className="q-weak">
              <h3 className="q-n">Where these came from</h3>
              {weak.map((w) => (
                <button key={w.lessonId} type="button" className="q-weak-row"
                        onClick={() => onOpenLesson(w.lessonId)}>
                  <b>{lessonName(w.lessonId)}</b>
                  <em>{w.missed} {w.missed === 1 ? "question" : "questions"} from here</em>
                </button>
              ))}
            </section>
          )}

          {/* EVERY QUESTION, NOT ONLY THE MISSES. Showing the wrong ones alone
              throws away the other half of what a student wants to know: which
              of the ones they got right were actually guesses. */}
          {!wrong.length ? (
            <p className="q-rev-line">
              Every one of them right. The next chapter is where this goes now.
            </p>
          ) : (
            <div className="q-review">
              {wrong.map((r) => (
                <article className="q-rev" key={r.index} data-mark="wrong">
                  <p className="q-rev-q"><b>{r.index + 1}.</b> {r.question}</p>
                  <p className="q-rev-line">
                    <span className="q-rev-yours">
                      {r.chose === null ? "You left this one blank" : `You said ${r.choseLabel} — ${r.chose}`}
                    </span>
                  </p>
                  <p className="q-rev-line q-rev-right">{r.correctLabel} — {r.correct}</p>
                  {r.explain && <p className="q-rev-explain">{r.explain}</p>}
                  {r.lessonId && onOpenLesson && (
                    <button type="button" className="q-rev-lesson"
                            onClick={() => onOpenLesson(r.lessonId)}>
                      Back to the lesson this came from
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          {s.right > 0 && (
            <details className="q-got">
              <summary>The {s.right} you got right</summary>
              <div className="q-review">
                {paper.map((q2, i) => (missed.has(i) ? null : (
                  <article className="q-rev" key={q2.id || i} data-mark="right">
                    <p className="q-rev-q"><b>{i + 1}.</b> {q2.question}</p>
                    <p className="q-rev-line q-rev-right">
                      {LABELS[attempt.answers[i]]} — {q2.options[attempt.answers[i]]}
                    </p>
                    {q2.explain && <p className="q-rev-explain">{q2.explain}</p>}
                  </article>
                )))}
              </div>
            </details>
          )}
        </div>

        <div className="quiz-foot">
          {/* Sit only the ones you missed, as their own paper. */}
          {wrong.length > 0 && (
            <button type="button" className="q-btn" onClick={() => setPhase("retake")}>
              Just the {wrong.length} I missed
            </button>
          )}
          <div className="q-move">
            <button type="button" className="q-btn" data-primary="" onClick={() => setPhase("done")}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  /* Only the misses, as a separate sitting on a separate paper, so it cannot
     overwrite the score of the one already sat: the first attempt is the
     record and a drill is not a retake of it. It is handed no onDone and no
     onAnswers for the same reason, and no way out of its own — the module's
     back link is above it, where the way out always is. */
  if (phase === "retake") {
    const only = retakeWrong(attempt, quiz);
    if (!only) { setPhase("review"); return null; }
    return (
      <div ref={rootRef}>
        <Exam
          key={`${id}.retake`}
          quizId={`${id}.retake`}
          title={`${title} — the ones you missed`}
          eyebrow={eyebrow}
          questions={only.quiz.questions}
          lessons={lessons}
          minimums={minimums}
          onOpenLesson={onOpenLesson}
        />
      </div>
    );
  }

  const answered = answeredCount(attempt);
  const blanks = unanswered(attempt).length;
  const marks = flagged(attempt).length;
  const isFlagged = attempt.flagged[at];
  const last = at + 1 >= total;

  const headline = () => {
    if (!result) return "";
    if (!result.passed) return result.shortBy <= 1 ? "So close. Go again" : "Not yet. Keep at it";
    if (result.right === result.total) return "Every one right";
    if (result.pct < result.bar) return "Passed. Keep climbing to your bar";
    if (result.pct === result.bar) return "Passed, right on your bar";
    return "Passed, above your bar";
  };

  const missed = result ? paper.map((_, i) => i).filter((i) => !result.marks[i]) : [];
  const got = result ? paper.map((_, i) => i).filter((i) => result.marks[i]) : [];
  const headText = headline();

  return (
    <div className="exam-frame" ref={rootRef}>
      <div className="exam">
        <header className="exam-bar">
          <div className="exam-bar__title">
            {eyebrow && <span className="exam-bar__eyebrow">{eyebrow}</span>}
            <span className="exam-bar__name">{title}</span>
          </div>
          {/* Hidden once the paper is in: a clock on a marked paper is a number
              that cannot mean anything. */}
          {phase === "paper" && (
            <div className={`exam-timer ${left <= SECONDS_LOW ? "is-low" : ""}`} role="timer" aria-live="off">
              <span className="exam-timer__label">Time left</span>
              <span className="exam-timer__value">{clock(left)}</span>
            </div>
          )}
          {phase === "paper" && (
            <button className="btn" type="button" onClick={() => dialogRef.current?.showModal()}>End exam</button>
          )}
          {/* The route line: a dashed track along the bottom of the bar, filled
              as far as the paper is answered. It repeats what the navigator's
              count says, in the one place a student's eye already is. */}
          <span className="route" aria-hidden="true">
            <span className="route__fill" style={{ width: `${(answeredCount(attempt) / total) * 100}%` }} />
          </span>
        </header>

        {phase === "paper" && (
          <div className={`exam-body ${leaving ? "is-leaving" : ""}`}>
            <section className="question" aria-labelledby="exam-q-text">
              <div className="question__head">
                <span className="question__num">Question <b>{at + 1}</b> of {total}</span>
                {isFlagged && (
                  <span className="question__flagged" title="Flagged for review">
                    <IconFlagSolid />
                    <span className="sr-only">Flagged for review</span>
                  </span>
                )}
              </div>

              <div className="question__main" ref={mainRef}>
                <p className="question__text" id="exam-q-text">{q.question}</p>
                <fieldset className="options">
                  <legend className="sr-only">Choose one answer</legend>
                  {q.options.map((opt, i) => (
                    <label className="option" key={`${at}-${i}`}>
                      <input type="radio" name={`exam-q${at}`} value={i}
                             checked={attempt.answers[at] === i}
                             onChange={() => choose(i)} />
                      <span className="option__radio" />
                      <span className="option__letter">{LABELS[i]}</span>
                      <span className="option__text">{opt}</span>
                    </label>
                  ))}
                </fieldset>
              </div>

              <div className="question__foot">
                <button className="btn" type="button" disabled={at === 0}
                        onClick={() => put((a) => prevQ(a, total))}>
                  <IconBack /> Previous
                </button>
                <button className="btn btn--ghost btn--flag" type="button" aria-pressed={isFlagged}
                        onClick={() => put((a) => flag(a, a.at))}>
                  <IconFlagLine />
                  <span>Flag <span className="label-long">for review</span></span>
                </button>
                <span className="spacer" />
                <button className="btn btn--primary" type="button"
                        onClick={() => (last ? dialogRef.current?.showModal() : put((a) => nextQ(a, total)))}>
                  <span>{last ? "Review" : "Next"}</span>
                  <IconOn />
                </button>
              </div>
            </section>

            <aside className="navigator" aria-label="Question navigator">
              <p className="navigator__title">Questions <span>{answered}/{total}</span></p>
              <div className="navigator__grid" ref={gridRef}>
                {navRow(attempt).map((n) => (
                  <button key={n.index} type="button" data-i={n.index}
                          className={`qcell is-inline${n.answered ? " is-answered" : ""}${n.flagged ? " is-flagged" : ""}${n.current ? " is-current" : ""}`}
                          aria-current={n.current ? "step" : undefined}
                          aria-label={`Question ${n.n}${n.answered ? ", answered" : ""}${n.flagged ? ", flagged" : ""}`}
                          onClick={() => put((a) => goTo(a, n.index, total))}>
                    {n.n}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}

        {result && (
          <section className={`result ${result.passed ? "is-pass" : "is-notyet"} ${inView ? "is-in" : ""}`} aria-live="polite">
            <div className="result__top">
              <span className="result__big">{shown}%</span>
              <h2 className="result__head">
                <span className="result__icon" aria-hidden="true"><IconPlane /></span>{headText}
              </h2>
              {/* NO NUMBERS ON THE MARKERS. The line says the three figures
                  once, where a screen reader will read them and a tooltip will
                  show them, rather than printing them over a 12px bar. */}
              <div className="meter" role="img"
                   aria-label={`${result.pct}%. Pass mark ${PASS_PCT}%. Your bar ${result.bar}%.`}>
                <div className="meter__fill" style={{ width: inView ? `${result.pct}%` : 0 }} />
                <div className="mark mark--pass" style={{ left: `${PASS_PCT}%` }} title="Pass mark">
                  <span className="mark__icon">{result.sameBar ? <IconBar /> : <IconPass />}</span>
                </div>
                {!result.sameBar && (
                  <div className="mark mark--bar" style={{ left: `${result.bar}%` }} title="Your bar">
                    <span className="mark__icon"><IconBar /></span>
                  </div>
                )}
              </div>
            </div>

            {missed.length > 0 && (
              <ol className="result__list review">
                {missed.map((i, k) => <ReviewRow key={i} item={paper[i]} mine={attempt.answers[i]} n={i + 1} k={k} />)}
              </ol>
            )}

            {got.length > 0 && (
              <details className="review" open={missed.length === 0}>
                <summary aria-label="Answers you got right">
                  <span className="result__mark is-right"><IconRight /></span>
                  <span className="chev" aria-hidden="true" />
                </summary>
                {/* The fold's own rows are numbered from nought: their delay
                    counts from the moment it opens, not from the moment the
                    result arrived. See exam.css. */}
                <ol className="result__list">
                  {got.map((i, k) => <ReviewRow key={i} item={paper[i]} mine={attempt.answers[i]} n={i + 1} k={k} />)}
                </ol>
              </details>
            )}

            <div className="result__foot">
              {/* ONE STEP FURTHER IN. The rows above correct every miss in a
                  line; this is where the explanation, the lesson it came from
                  and a paper of only the misses live, so the score screen
                  keeps its shape and the teaching still has somewhere to be. */}
              <button className="btn" type="button" onClick={() => setPhase("review")}>
                Go through the paper
              </button>
              <button className={`btn ${result.passed ? "" : "btn--primary"}`} type="button" onClick={again}>
                {result.passed ? "Retake" : "Try again"}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* THE LAST THING BETWEEN A STUDENT AND A SCORE THEY CANNOT TAKE BACK, so
          it states what is true and nothing else: what is answered, what is
          not, and what was flagged. A native dialog, so Esc closes it and the
          focus goes back where it came from without a line of code. */}
      <dialog className="exam-dialog" ref={dialogRef} aria-labelledby="exam-confirm-title"
              onClick={(e) => { if (e.target === dialogRef.current) dialogRef.current.close(); }}>
        <div className="dialog__body">
          <h2 id="exam-confirm-title">End the exam?</h2>
          <p>Once you end it, your answers are marked and can&rsquo;t be changed.</p>
          <ul className="review-list">
            <li>Answered <b>{answered}</b></li>
            <li>Not answered <b>{blanks}</b></li>
            <li>Flagged <b>{marks}</b></li>
          </ul>
        </div>
        <div className="dialog__foot">
          <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>Back to exam</button>
          <button className="btn btn--primary" type="button" onClick={handOver}>End and mark</button>
        </div>
      </dialog>
    </div>
  );
}
