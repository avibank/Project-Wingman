import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, ChevronLeft, ChevronRight } from "lucide-react";
import QuizResults from "./QuizResults.jsx";
import {
  newAttempt, answer, flag, goTo, next as nextQ, prev as prevQ,
  submit, score, review, handIn, navigator as navRow, elapsed, seedOf,
  saveAttempt, loadAttempt, clearAttempt, resumeLine, quizKey,
  passAt, scoreLine, LABELS,
} from "../../lib/quiz.js";
import { shuffleOptions } from "../../lib/retention.js";
import "./quiz.css";

/* =============================================================================
   THE PAPER.

   A chapter quiz is an exam, and this is the shape of one: answer everything,
   hand it in, then go through it. Nothing is marked while you are sitting it.

   -----------------------------------------------------------------------------
   THIS REVERSES Review.jsx, AND THE REVERSAL IS THE POINT

   Review.jsx's header records that Part 14's exam was replaced by immediate
   feedback — answer, see why, move on. That instruction was right for what
   Review is now used for, and Review keeps doing it: the re-check and put-right
   flows are DRILLS. You are being handed back something you already got wrong,
   and the moment of being wrong again is the whole lesson; withholding the
   answer there would be withholding the only thing you came for.

   A chapter quiz is not a drill. It is a rehearsal for a paper these students
   will sit under exam conditions, where you commit to an answer without being
   told, you can go back and change your mind, you flag the ones you are not
   sure about, and you find out at the end. Practising that is most of what
   practising an exam IS. So the two exercises stopped sharing a component
   rather than one of them pretending to be the other.

   The model — every rule about what an attempt is, when it can change, what
   counts and what the hand-in screen says — is in lib/quiz.js, which was
   written for exactly this and had never been wired to anything. Nothing about
   an attempt is decided in this file.
   ========================================================================= */

export default function Exam({
  title, questions, isRetake = false,
  quizId, resumeAt = 0, onProgress, onAnswers, onDone, onLeave, onOpenLesson,
  minimums, averageBefore = null, averageAfter = null, moduleName, onRecheck,
}) {
  const [retake] = useState(isRetake);
  /* A SITTING IS A FIXED SET, latched at mount. Same reason as Review: a set
     derived from a list that changes underneath an index makes the paper skip
     questions and end early. */
  const [set] = useState(questions);
  const id = quizId || `chapter:${questions[0]?.id || "quiz"}`;

  /* One attempt, restored if there is one to restore. A paper you left open
     yesterday comes back with the answers on it and says so — silently
     restoring them is how somebody hands in six answers they do not remember
     giving. */
  const [attempt, setAttempt] = useState(() => {
    const held = loadAttempt(id);
    if (held && !held.submittedAt && held.answers?.length === questions.length) {
      return { ...held, at: Math.min(resumeAt || held.at || 0, questions.length - 1) };
    }
    return newAttempt({ id, questions });
  });
  const [resumed] = useState(() => resumeLine(loadAttempt(id)));
  const [phase, setPhase] = useState("paper");     // paper | handin | done | review

  /* EVERY PHASE STARTS AT ITS OWN TOP.

     These are four screens wearing one route, and the scroller belongs to the
     app, not to this component — so handing in from the bottom of question 8
     landed on the results screen already scrolled past the score, and going
     through the paper landed halfway down the third wrong answer. scrollIntoView
     on our own root rather than reaching for the app's scroller by name: it
     works whichever ancestor happens to be doing the scrolling. */
  const rootRef = useRef(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [phase]);

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

     `put(answer(attempt, at, i))` reads `attempt` out of the closure this
     render captured. Two changes inside one frame — a keyboard user pressing
     2 then ArrowRight faster than React re-renders, a click landing in the
     same task as another — both start from that same snapshot, and the second
     one overwrites the first. The answer simply does not appear, which is the
     worst kind of bug on a paper: silent, rare, and impossible to reproduce
     while somebody is watching.

     Taking a function of the previous state removes the class rather than the
     instance. `at` comes from the same snapshot for the same reason. */
  const put = useCallback((fn) => {
    setAttempt((prev) => saveAttempt(fn(prev)));
  }, []);
  const at = attempt.at;
  const q = paper[at];

  /* Where you got to, so the deck can offer to put you back.

     The handler lives in a ref and is NOT a dependency. It arrives as a fresh
     arrow on every render of the parent, so as a dependency this effect fires
     on every render rather than on every move — and what it calls is
     progress.set, which is a debounced write to the server. A student sitting
     on one question would have been posting their place five hundred
     milliseconds at a time, forever. */
  const report = useRef(onProgress);
  report.current = onProgress;
  useEffect(() => { report.current?.(at, null); }, [at]);

  /* Elapsed, once a second, and only while the paper is open. Counting up is
     information; counting down would be a threat — see lib/quiz.js. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== "paper") return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const handOver = () => {
    const done = submit(attempt);
    put(() => done);
    const s = score(done, quiz);
    /* Retention is fed here rather than per question, because in an exam
       nothing is marked until now — and it still gets exactly what it needs:
       which questions were right.

       ALL EIGHT IN ONE CALL, not eight calls. Eight separate ones land in a
       single tick and every one reads the same pre-render state, so seven get
       overwritten and one question out of eight reaches the caution pile. The
       score was right, the review was right, and only Put right was quietly
       almost empty — which is the kind of bug that survives a demo. */
    onAnswers?.(paper.map((question, i) => [question.id, s.marks[i]]));
    onDone?.({ right: s.right, toCaution: s.total - s.right, toHolding: s.right });
    clearAttempt(id);
    setPhase("done");
  };

  /* 1/2/3 to answer, arrows to move, F to flag, Enter to go on. Free, and much
     faster for revision on a laptop. The guard is in the model. */
  useEffect(() => {
    if (phase !== "paper") return undefined;
    const onKey = (e) => {
      const hit = quizKey(e);
      if (!hit) {
        if (e.key === "Escape") { e.preventDefault(); onLeave?.(); }
        return;
      }
      e.preventDefault();
      if (hit.type === "answer" && hit.choice < (q?.options.length || 0)) {
        put((a) => answer(a, a.at, hit.choice));
      } else if (hit.type === "next") {
        if (at + 1 >= paper.length) setPhase("handin");
        else put((a) => nextQ(a, paper.length));
      } else if (hit.type === "prev") { put((a) => prevQ(a, paper.length)); }
      else if (hit.type === "flag") { put((a) => flag(a, a.at)); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, attempt, at, q, paper.length, put, onLeave]);

  if (!q) return null;

  /* ---------------------------------------------------------------- results */
  if (phase === "done") {
    const s = score(attempt, quiz);
    return (
      <div ref={rootRef}>
      <QuizResults
        title={title} right={s.right} total={s.total}
        minimums={minimums}
        averageBefore={averageBefore} averageAfter={averageAfter}
        retake={retake} moduleName={moduleName}
        onReview={() => setPhase("review")}
        onRecheck={onRecheck} onLeave={onLeave} />
      </div>
    );
  }

  /* THE REVIEW IS THE TEACHING MOMENT, and it is its own screen.

     The results screen is deliberately bare — a score, a verdict, the dial and
     what moved. Hanging fourteen explanations off the bottom of it would bury
     the one number the student came for. So going through the paper is a
     second, deliberate step, which is also where every reader of this kind
     puts it. */
  if (phase === "review") {
    const s = score(attempt, quiz);
    const wrong = review(attempt, quiz);
    return (
      <div className="quiz exam" ref={rootRef}>
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

          {/* R11 — a clean sheet is stated in the affirmative, never as a zero. */}
          {!wrong.length ? (
            <p className="q-rev-line">
              Every one of them right. The next chapter is where this goes now.
            </p>
          ) : (
            <div className="q-review">
              {wrong.map((r) => (
                <article className="q-rev" key={r.index}>
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
        </div>

        <div className="quiz-foot">
          <button type="button" className="q-btn" data-primary="" onClick={onLeave}>Done</button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- hand it in */
  if (phase === "handin") {
    const h = handIn(attempt);
    const jump = (i) => { put((a) => goTo(a, i, paper.length)); setPhase("paper"); };
    return (
      <div className="quiz exam" ref={rootRef}>
        <div className="quiz-head">
          <span className="quiz-where">{title}</span>
          <span className="quiz-name">Hand it in</span>
          <button type="button" className="quiz-leave" onClick={() => setPhase("paper")}>Back to the paper</button>
        </div>

        <div className="quiz-body">
          <p className="q-text">{h.line}</p>
          <p className="q-rev-line">
            {h.answered} of {h.total} answered. The pass mark is {passAt(h.total)}.
            Once it is in, it is marked.
          </p>

          {h.blanks.length > 0 && (
            <section className="handin-set">
              <h3 className="q-n">Still blank</h3>
              <div className="nav nav-inline">
                {h.blanks.map((i) => (
                  <button key={i} type="button" className="nav-sq" onClick={() => jump(i)}>{i + 1}</button>
                ))}
              </div>
            </section>
          )}

          {h.marks.length > 0 && (
            <section className="handin-set">
              <h3 className="q-n">Flagged for another look</h3>
              <div className="nav nav-inline">
                {h.marks.map((i) => (
                  <button key={i} type="button" className="nav-sq" data-flag="1"
                          onClick={() => jump(i)}>{i + 1}</button>
                ))}
              </div>
            </section>
          )}

          {h.clean && (
            <p className="q-rev-line">Everything is answered and nothing is flagged.</p>
          )}
        </div>

        <div className="quiz-foot">
          <button type="button" className="q-btn" onClick={() => setPhase("paper")}>Keep working</button>
          <div className="q-move">
            <button type="button" className="q-btn" data-primary="" onClick={handOver}>Hand it in</button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- the paper */
  const chosen = attempt.answers[at];
  const isFlagged = attempt.flagged[at];
  const last = at + 1 >= paper.length;

  return (
    <div className="quiz exam" ref={rootRef}>
      <div className="quiz-head">
        <span className="quiz-where">{title}</span>
        <span className="quiz-name">Question {at + 1}</span>
        <span className="quiz-count">of {paper.length}</span>
        <span className="exam-clock" aria-label="Time on this paper">
          {elapsed(attempt.startedAt, now)}
        </span>
        <button type="button" className="quiz-leave" onClick={onLeave}>Leave</button>
      </div>

      <div className="quiz-body">
        {retake && <p className="q-retake">Retake — this does not move the accuracy needle.</p>}
        {resumed && at === (attempt.at ?? 0) && <p className="q-rev-line">{resumed}</p>}

        {/* NO SECOND PROGRESS BAR. The drill has one because it has nothing
            else — it moves in one direction and you cannot go back. An exam has
            the navigator in the footer, which says everything a bar says and
            three things it cannot: which you skipped, which you flagged, and
            how to get to any of them. Two indicators for one fact is furniture. */}
        <div className="q-card">
          <p className="q-text">{q.question}</p>
          <div className="opts">
            {q.options.map((opt, i) => (
              <button key={i} type="button" className="opt"
                      aria-pressed={chosen === i}
                      onClick={() => put((a) => answer(a, a.at, i))}>
                <span className="opt-l">{LABELS[i]}</span>
                <span className="opt-t">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The one sentence that makes an exam an exam. It is said on every
            question rather than once on the cover, because the question a
            student is actually asking — "why has it not told me?" — is asked
            here, not there. Below the card, not inside it: crammed against the
            last option it read as a fourth answer. */}
        <p className="exam-quiet">Nothing is marked until you hand it in.</p>
      </div>

      <div className="quiz-foot exam-foot">
        <button type="button" className="q-flag" aria-pressed={isFlagged}
                onClick={() => put((a) => flag(a, a.at))}>
          <Flag aria-hidden="true" />
          {isFlagged ? "Flagged" : "Flag for another look"}
        </button>

        {/* THE NAVIGATOR. The single most reassuring control in any paper: you
            can always see what is left, what you skipped, and what you wanted
            to come back to — and you can go straight there. */}
        <div className="nav" role="group" aria-label="Every question">
          {navRow(attempt).map((n) => (
            <button key={n.index} type="button" className="nav-sq"
                    data-state={n.state} data-flag={n.flagged ? "1" : undefined}
                    aria-current={n.state === "current" ? "true" : undefined}
                    aria-label={`Question ${n.n}${n.state === "answered" ? ", answered" : ""}${n.flagged ? ", flagged" : ""}`}
                    onClick={() => put((a) => goTo(a, n.index, paper.length))}>
              {n.n}
            </button>
          ))}
        </div>

        <div className="q-move">
          <button type="button" className="q-arrow" aria-label="Previous question"
                  disabled={at === 0} onClick={() => put((a) => prevQ(a, paper.length))}>
            <ChevronLeft aria-hidden="true" />
          </button>
          {last ? (
            <button type="button" className="q-btn" data-primary="" onClick={() => setPhase("handin")}>
              Hand it in
            </button>
          ) : (
            <button type="button" className="q-arrow" aria-label="Next question"
                    onClick={() => put((a) => nextQ(a, paper.length))}>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
