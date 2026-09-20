/* THE PAPER, AS ASSERTIONS.
 *
 * A chapter quiz is an exam: answer everything, hand it in, then go through it.
 * The rules that make it one — and that are easy to lose the next time somebody
 * tidies this screen — are checked here rather than reviewed.
 *
 * The single most important one is negative: NOTHING IS MARKED BEFORE HAND-IN.
 * It is the difference between this and the drill, it is invisible in a
 * screenshot, and it breaks silently the moment a well-meaning change starts
 * colouring the option you picked.
 *
 * Run: npm run check:exam
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  newAttempt, answer, flag, goTo, next, prev, submit, score, review,
  handIn, navigator as navRow, seedOf, unanswered, answeredCount,
  flagged, submitWarning, passAt, scoreLine, retakeWrong, weakLessons,
  estimate, LABELS, OPTIONS, PASS_MARK,
  allowanceFor, clock, tick, timeLeft, SECONDS_LOW,
} from "../src/lib/quiz.js";
import { shuffleOptions } from "../src/lib/retention.js";
import { moduleNeedsYou } from "../src/lib/minimums.js";
import { LIVERIES, deckVars } from "../src/lib/liveryEngine.js";
import { FINISHES, finishVars } from "../src/lib/finishEngine.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (group, name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${name}`); }
  else { fails.push(`${group} · ${name}${detail ? `  ${detail}` : ""}`); console.log(`  FAIL ${group} · ${name}  ${detail}`); }
};

const QUIZ = {
  id: "T.Q",
  questions: [
    { id: "q1", question: "One?", options: ["a", "b", "c"], correct: 0, explain: "e1", lessonId: "L1" },
    { id: "q2", question: "Two?", options: ["a", "b", "c"], correct: 1, explain: "e2", lessonId: "L1" },
    { id: "q3", question: "Three?", options: ["a", "b", "c"], correct: 2, explain: "e3", lessonId: "L2" },
    { id: "q4", question: "Four?", options: ["a", "b", "c"], correct: 0, explain: "e4", lessonId: "L2" },
  ],
};

/* ---- the shape the students are training toward ------------------------- */
console.log("\nthe shape");
{
  ok("shape", "three options, labelled A B C", OPTIONS === 3 && LABELS.join("") === "ABC");
  ok("shape", "the pass mark is 75%", PASS_MARK === 0.75);
  ok("shape", "8 questions needs 6", passAt(8) === 6);
  ok("shape", "and it rounds up rather than down", passAt(5) === 4 && passAt(7) === 6);
  /* THE CLOCK IS A FLAT TWENTY MINUTES (R5), which reverses what this pair
     used to assert — that the allowance WAS the estimate, both 75 seconds a
     question, so the row's "about 10 minutes" and the paper's clock could
     never be two promises about the same eight questions. They are two
     promises now, deliberately: the row answers "how long will this take me"
     and the paper answers "how long have I got", and on a short quiz those
     are different numbers. Owner's decision, 2026-09-20. */
  ok("shape", "the clock is a flat twenty minutes", allowanceFor(8) === 1200 && allowanceFor(1) === 1200);
  ok("shape", "up to forty questions, and only up to forty",
     allowanceFor(40) === 1200 && allowanceFor(41) === 41 * 75);
  ok("shape", "an empty paper still gets the sitting, not a minute", allowanceFor(0) === 1200);
  /* The estimate keeps the per-question figure, because a row reading "about
     20 minutes" for every quiz in the module says nothing at all. */
  ok("shape", "the row's estimate is still per question", /10 minutes/.test(estimate(8)));
}

/* ---- an attempt ---------------------------------------------------------- */
console.log("\nthe attempt");
{
  let a = newAttempt(QUIZ);
  ok("attempt", "starts with nothing answered and nothing flagged",
     a.answers.every((v) => v === null) && a.flagged.every((v) => v === false));
  ok("attempt", "and it is not submitted", a.submittedAt === null);

  a = answer(a, 0, 2);
  ok("attempt", "an answer lands where it was put", a.answers[0] === 2);
  a = answer(a, 0, 2);
  ok("attempt", "and tapping the same one again clears it", a.answers[0] === null);
  a = answer(a, 0, 1);
  a = answer(a, 0, 0);
  ok("attempt", "tapping a different one changes it", a.answers[0] === 0);

  a = flag(a, 1);
  ok("attempt", "a flag is its own thing, not a fourth state",
     a.flagged[1] === true && a.answers[1] === null);
  a = answer(a, 1, 1);
  ok("attempt", "so a question can be answered AND flagged at once",
     a.flagged[1] === true && a.answers[1] === 1);

  ok("attempt", "moving cannot fall off either end",
     goTo(a, -5, 4).at === 0 && goTo(a, 99, 4).at === 3
     && prev({ ...a, at: 0 }, 4).at === 0 && next({ ...a, at: 3 }, 4).at === 3);

  ok("attempt", "counts are what they say", answeredCount(a) === 2
     && JSON.stringify(unanswered(a)) === "[2,3]"
     && JSON.stringify(flagged(a)) === "[1]");

  /* A SUBMITTED PAPER IS CLOSED. Without this, landing on the review screen and
     tabbing back into a question would let somebody edit their way to a pass. */
  const done = submit(a);
  ok("attempt", "handing in stamps a time", typeof done.submittedAt === "string");
  ok("attempt", "handing in twice does not restamp it", submit(done).submittedAt === done.submittedAt);
  ok("attempt", "and a submitted paper refuses another answer",
     answer(done, 3, 1).answers[3] === null);
}

/* ---- nothing is marked before hand-in ------------------------------------ */
console.log("\nnothing is marked until you hand it in");
{
  const exam = read("src/components/module/Exam.jsx");
  const paper = exam.split('{phase === "paper" && (')[1] || "";
  ok("exam", "the question screen exists to be checked", paper.length > 200);

  /* The option markup while sitting the paper carries aria-pressed and nothing
     else. `data-mark` is what quiz.css paints right and wrong with, and it must
     not appear on an option until the paper is in. */
  ok("exam", "an option on the paper carries no mark",
     !/data-mark/.test(paper), "data-mark reached the question screen");
  ok("exam", "the score is not computed while the paper is open",
     !/score\(attempt/.test(paper));

  /* Retention is fed at hand-in, not per question. Feeding it per question
     would mean the app knows the answer while telling the student it does not,
     and the caution pile would fill up mid-paper. */
  ok("exam", "retention is told at hand-in, for every question",
     /onAnswers\?\.\(paper\.map\(\(question, i\) => \[question\.id, s\.marks\[i\]\]\)\)/.test(exam));
  ok("exam", "and never per answer", !/onAnswer\?\.\(q, right\)/.test(exam));

  /* IN ONE CALL, NOT EIGHT. Eight separate calls land in a single tick and
     every one of them reads the same pre-render state, so seven are
     overwritten and one question out of eight reaches the caution pile — while
     the score and the review are both perfectly correct. */
  const app = read("src/App.jsx");
  ok("exam", "the whole paper folds into one retention write",
     /let next = progress\.get\(RETENTION_KEY/.test(app)
     && /for \(const \[questionId, right\] of results\)/.test(app)
     && /progress\.set\(RETENTION_KEY, next\);/.test(app));
  ok("exam", "and the single answer is the special case, not the primitive",
     /const recordAnswer = \(questionId, right, opts = \{\}\) =>\s*\n?\s*recordAnswers\(\[\[questionId, right\]\], opts\)/.test(app));

  /* THE SENTENCE IS GONE FROM THE PAPER, and what replaced it says the same
     thing where it matters more. "Nothing is marked until you hand it in" was
     printed under every question; the approved screen says it once, at the
     moment it is true — in the dialog that ends the exam, where a student is
     about to do the irreversible thing. */
  ok("exam", "the paper says nothing about marking until the moment it marks",
     !/Nothing is marked until you hand it in/.test(exam)
     && /your answers are marked and can&rsquo;t be changed/.test(exam));
}

/* ---- the hand-in screen -------------------------------------------------- */
console.log("\nhand it in");
{
  let a = newAttempt(QUIZ);
  a = answer(a, 0, 0); a = answer(a, 1, 1); a = flag(a, 2);
  const h = handIn(a);
  ok("handin", "it says how many are answered", h.answered === 2 && h.total === 4);
  ok("handin", "which are blank", JSON.stringify(h.blanks) === "[2,3]");
  ok("handin", "and which were flagged", JSON.stringify(h.marks) === "[2]");
  ok("handin", "one blank reads as one, not as '1 questions'",
     handIn(answer(answer(answer(newAttempt(QUIZ), 0, 0), 1, 0), 2, 0)).line
       === "One question has no answer yet.");

  /* R11 of the house voice: no sentence states a zero. A finished paper is
     told in the affirmative. */
  let full = newAttempt(QUIZ);
  for (let i = 0; i < 4; i++) full = answer(full, i, 0);
  const clean = handIn(full);
  ok("handin", "a complete paper is stated in the affirmative, never as a zero",
     clean.line === "Every question has an answer." && clean.clean === true);
  ok("handin", "and no screen in the exam states a zero",
     !/\b0 (questions|answers|blank)\b/.test(read("src/components/module/Exam.jsx")));

  /* "Are you sure?" is a question that carries no information and that
     everybody clicks through. The screen states what is true instead. */
  const exam = read("src/components/module/Exam.jsx");
  ok("handin", "it states what is true rather than asking if you are sure",
     !/Are you sure/i.test(exam) && /End the exam\?/.test(exam));
  /* Three live counts and two buttons. The approved dialog has no third
     button: "Review flagged" was considered and left out, because a student
     who wants a flagged question can press its square. */
  ok("handin", "it counts what is answered, what is not, and what is flagged",
     /Answered <b>\{answered\}<\/b>/.test(exam)
     && /Not answered <b>\{blanks\}<\/b>/.test(exam)
     && /Flagged <b>\{marks\}<\/b>/.test(exam));
  ok("handin", "and it offers two ways out, not three",
     /Back to exam/.test(exam) && /End and mark/.test(exam) && !/Review flagged/.test(exam));
  ok("handin", "it is a real dialog, so Esc and the backdrop close it",
     /<dialog className="exam-dialog"/.test(exam)
     && /showModal\(\)/.test(exam)
     && /if \(e\.target === dialogRef\.current\) dialogRef\.current\.close\(\)/.test(exam));

  ok("handin", "submitWarning still names the gap for anything else that asks",
     submitWarning(a) === "2 questions have no answer.");
}

/* ---- marking and the review --------------------------------------------- */
console.log("\nthe result");
{
  let a = newAttempt(QUIZ);
  a = answer(a, 0, 0);      // right
  a = answer(a, 1, 2);      // wrong
  a = answer(a, 2, 2);      // right
  //                          4 left blank
  a = submit(a);
  const s = score(a, QUIZ);
  ok("result", "the score counts the right ones", s.right === 2 && s.total === 4);
  ok("result", "a blank is wrong, not missing", s.wrong.includes(3));
  ok("result", "and it is a count, never a percentage",
     scoreLine(s) === "2 of 4 — pass mark is 3" && !/%/.test(scoreLine(s)));

  const r = review(a, QUIZ);
  ok("result", "the review is every one you did not get", r.length === 2);
  ok("result", "it says what you said", r[0].chose === "c" && r[0].choseLabel === "C");
  ok("result", "and what was right", r[0].correct === "b" && r[0].correctLabel === "B");
  /* On the approved result screen a missed question reads as a correction:
     their pick struck through, an arrow, the right answer. A question with no
     answer shows a dash rather than a sentence about them. */
  ok("result", "a blank is a dash, not a sentence about the student",
     r[1].chose === null
     && /mine === null\s*\n\s*\? <span className="ans--blank">—<\/span>/.test(read("src/components/module/Exam.jsx")));

  ok("result", "the weakest lesson comes first",
     weakLessons(a, QUIZ)[0].lessonId === "L1" || weakLessons(a, QUIZ)[0].missed >= 1);
  ok("result", "and a retake of the wrong ones is a real quiz",
     retakeWrong(a, QUIZ).quiz.questions.length === 2);

  /* The results screen stays bare. Going through the paper is a door, not a
     drawer hanging off the bottom of the score. */
  const results = read("src/components/module/QuizResults.jsx");
  ok("result", "the review is a second screen, not more of the score",
     /onReview/.test(results) && /Go through the paper/.test(results));
  ok("result", "and the drills, which mark as they go, get no such door",
     /onReview = null/.test(results));

  const nav = navRow({ ...a, at: 0 }, s.marks);
  ok("result", "afterwards the same squares carry the mark",
     nav[0].mark === "right" && nav[1].mark === "wrong");
  ok("result", "and before then they carry none at all",
     navRow({ ...a, at: 0 }).every((n) => n.mark === null));
}

/* ---- the navigator ------------------------------------------------------- */
console.log("\nthe navigator");
{
  let a = newAttempt(QUIZ);
  a = answer(a, 1, 0); a = flag(a, 2); a = goTo(a, 2, 4);
  const rows = navRow(a);
  ok("nav", "current, answered and blank are the three states",
     rows.map((r) => r.state).join(",") === "blank,answered,current,blank");
  ok("nav", "and flagged rides on top of whichever it is",
     rows[2].flagged === true && rows[1].flagged === false);

  const exam = read("src/components/module/Exam.jsx");
  ok("nav", "every square is a way to that question",
     /onClick=\{\(\) => put\(\(a\) => goTo\(a, n\.index, total\)\)\}/.test(exam));
  ok("nav", "and it replaces the progress bar rather than joining it",
     !/className="q-seg"/.test(exam) && !/progress/i.test(exam.split("navigator__grid")[1] || ""));
  /* ANSWERED AND CURRENT AT ONCE. `state` collapses them — the question you
     are on reads 'current' whether or not it has an answer — so a screen that
     painted "answered" from it left the box you just answered looking blank. */
  ok("nav", "the box you are on shows its answer as well as its ring",
     /n\.answered \? " is-answered"/.test(exam) && /n\.current \? " is-current"/.test(exam));
}

/* ---- the clock counts down, and hands the paper in ----------------------- */
console.log("\nthe clock");
{
  ok("clock", "it reads as minutes and seconds", clock(600) === "10:00" && clock(65) === "01:05");
  ok("clock", "zero is zero, not a blank", clock(0) === "00:00");
  ok("clock", "and nonsense does not become NaN", clock(undefined) === "00:00" && clock(-5) === "00:00");

  let a = newAttempt(QUIZ);
  ok("clock", "a new paper starts with its whole allowance", a.left === allowanceFor(4));
  ok("clock", "a second off is a second off", tick(a).left === allowanceFor(4) - 1);
  ok("clock", "it stops at zero rather than going negative", tick({ ...a, left: 0 }).left === 0);
  ok("clock", "a handed-in paper's clock is stopped",
     tick({ ...a, left: 90, submittedAt: "x" }).left === 90);
  /* THE BUG THIS REPLACED. The clock used to be elapsed-since-startedAt, and
     startedAt is persisted with the attempt — so a paper opened on Monday read
     202:29:37 on Wednesday. The time left is part of the attempt, moves only
     while the paper is on screen, and a paper written before it existed gets
     the whole allowance rather than a paper that hands itself in on sight. */
  ok("clock", "a paper from before the clock existed gets its whole allowance",
     timeLeft({ answers: [1, 2, 3, 4] }) === allowanceFor(4));
  ok("clock", "and the time left survives being left and come back to",
     timeLeft({ answers: [1, 2, 3, 4], left: 123 }) === 123);

  const exam = read("src/components/module/Exam.jsx");
  const css = read("src/components/module/exam.css");
  ok("clock", "nothing on screen is computed from startedAt", !/elapsed\(/.test(exam));
  ok("clock", "zero hands the paper in, as if End and mark had been pressed",
     /if \(phase === "paper" && left <= 0\) handOver\(\);/.test(exam));
  ok("clock", "the last minute turns red, and only the last minute",
     SECONDS_LOW === 60 && /left <= SECONDS_LOW \? "is-low"/.test(exam)
     && /\.exam-timer\.is-low \.exam-timer__value \{ color: color-mix\(in oklab, var\(--bad\) 85%, var\(--t1\)\); \}/.test(css));
  ok("clock", "the ticking stops when the paper is not open",
     /if \(phase !== "paper"\) return undefined;\s*\n\s*const t = setInterval/.test(exam));
  ok("clock", "and a marked paper shows no clock at all",
     /\{phase === "paper" && \(\s*\n\s*<div className=\{`exam-timer/.test(exam));
}

/* ---- it survives being left ---------------------------------------------- */
console.log("\nleaving and coming back");
{
  const exam = read("src/components/module/Exam.jsx");
  ok("resume", "every change is written the moment it is made",
     /setAttempt\(\(prev\) => saveAttempt\(fn\(prev\)\)\)/.test(exam));
  /* And derived from the LATEST attempt rather than the render's closure. Two
     changes inside one frame both starting from the same snapshot means the
     second silently overwrites the first — an answer that simply does not
     appear, rarely, and never while somebody is watching. */
  /* Comments first. The paragraph explaining this rule quotes the very shape
     it forbids, and a checker that reads its own prose has caught me twice. */
  const code = exam.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const puts = code.match(/\bput\(/g) || [];
  const functional = code.match(/\bput\(\((?:a\)|\) =>)/g) || [];
  ok("resume", `every one of the ${puts.length} changes takes a function of the previous state`,
     functional.length === puts.length, `${functional.length} of ${puts.length}`);
  ok("resume", "and a held attempt is restored rather than started over",
     /loadAttempt\(id\)/.test(exam) && /held\.answers\?\.length === questions\.length/.test(exam));
  ok("resume", "and the time left comes back with them",
     /left: timeLeft\(held\)/.test(exam));
  ok("resume", "a submitted attempt is not resumed", /!held\.submittedAt/.test(exam));

  /* THE SHUFFLE IS SEEDED FROM THE ATTEMPT, NOT THE CLOCK.

     An answer is stored as "the second option". Reseed on the way back in and
     the second option is a different sentence, so every restored answer is
     quietly wrong — and nothing on screen looks broken. */
  const a = newAttempt(QUIZ);
  const again = JSON.parse(JSON.stringify(a));
  ok("resume", "the seed is the same on the way back in", seedOf(a) === seedOf(again));
  const first = shuffleOptions(QUIZ.questions[0], seedOf(a) + 17);
  const second = shuffleOptions(QUIZ.questions[0], seedOf(again) + 17);
  ok("resume", "so the options come back in the same order",
     JSON.stringify(first) === JSON.stringify(second));
  ok("resume", "and the right answer is still the right answer",
     first.options[first.correct] === QUIZ.questions[0].options[QUIZ.questions[0].correct]);
  ok("resume", "the component seeds from the attempt and never from Date.now()",
     /seedOf\(attempt\)/.test(exam) && !/Date\.now\(\) % /.test(exam));

  /* The tally used to travel with the place and get lost, scoring every
     question before a resume point as wrong — permanently, since only the
     first attempt counts. An exam holds answers, so there is nothing to lose. */
  const page = read("src/components/module/QuizPage.jsx");
  ok("resume", "the place carries no tally to lose",
     !/resumeTally/.test(page) && /onProgress=\{\(at\) => onRun/.test(page));
  ok("resume", "and reporting it does not fire on every render",
     /report\.current\?\.\(at, null\)/.test(exam) && /\}, \[at\]\);/.test(exam));
}

/* ---- the drill and the paper are two exercises --------------------------- */
console.log("\nthe drill and the paper");
{
  const drill = read("src/components/module/Review.jsx");
  const exam = read("src/components/module/Exam.jsx");
  const page = read("src/components/module/QuizPage.jsx");

  ok("split", "the chapter quiz runs the exam", /<Exam/.test(page) && !/<Review/.test(page));
  ok("split", "the drill still marks as you go", /const right = i === shuffled\.correct/.test(drill));
  ok("split", "and both files say why they differ, rather than resolving it silently",
     /THE DRILL\./.test(drill) && /moved to Exam\.jsx/.test(drill)
     && /THIS REVERSES Review\.jsx/.test(exam));

  ok("split", "nothing about an attempt is decided in the component",
     /nothing about an attempt is decided in this file/.test(exam));

  const css = read("src/components/module/quiz.css");
  ok("style", "no hex literal in the quiz stylesheet",
     (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length === 0);
  ok("style", "one filled button on a screen, and it is the one that moves you on",
     (exam.match(/data-primary=""/g) || []).length <= 4);
}

/* ---- the approved screen, and the rules that came with it ---------------- */
console.log("\nthe approved screen");
{
  const exam = read("src/components/module/Exam.jsx");
  const css = read("src/components/module/exam.css");
  const page = read("src/components/module/QuizPage.jsx");

  /* THE KEYBOARD IS GONE. On a paper you cannot unsubmit, a shortcut that
     answers a question is a shortcut that answers it by accident. What is left
     is what the browser gives any form: Tab, Enter, Space, and the arrows
     inside the radio group — which is why the options are real radios. */
  ok("port", "nothing on the paper listens for a key",
     !/addEventListener\("keydown"/.test(exam) && !/quizKey/.test(exam));
  ok("port", "and the options are a radio group, so the arrows still work",
     /<input type="radio"/.test(exam) && /<legend className="sr-only">Choose one answer/.test(exam));

  /* SIX CASES, AND THE WORDS ARE THE DESIGN'S. Two of them turn on the
     student's own bar, which is theirs to set and defaults to the pass mark. */
  for (const line of [
    "So close. Go again", "Not yet. Keep at it", "Every one right",
    "Passed. Keep climbing to your bar", "Passed, right on your bar", "Passed, above your bar",
  ]) ok("port", `the result can say "${line}"`, exam.includes(`"${line}"`));
  ok("port", "one answer short is so close, two is not",
     /result\.shortBy <= 1 \? "So close\. Go again" : "Not yet\. Keep at it"/.test(exam));

  /* THE PASS MARK IS FIXED AND THE BAR IS NOT. 75% is EASA's figure and
     decides pass or not-yet; the bar only changes the wording and adds a
     marker, and when they are the same figure there is one marker, not two. */
  ok("port", "the pass mark on the line is the fixed one",
     /style=\{\{ left: `\$\{PASS_PCT\}%` \}\}/.test(exam));
  ok("port", "the bar is the student's own, and 75 when they have never set one",
     /minimums = PASS_PCT/.test(exam) && /sameBar: minimums === PASS_PCT/.test(exam));
  ok("port", "one marker when the two agree", /\{!result\.sameBar && \(/.test(exam));
  /* No numbers on the markers: the line says all three figures once, where a
     screen reader reads them and a tooltip shows them. */
  ok("port", "the markers carry no numbers",
     /aria-label=\{`\$\{result\.pct\}%\. Pass mark \$\{PASS_PCT\}%\. Your bar \$\{result\.bar\}%\.`\}/.test(exam)
     && /title="Pass mark"/.test(exam) && /title="Your bar"/.test(exam));

  /* What the old result screen said and this one does not — asked of the
     result's own markup, because the screen behind it says several of these
     things on purpose. */
  const resultBlock = exam.split("{result && (")[1]?.split("</section>")[0] || "";
  ok("port", "no stamp, no x of N, no chips and no headings on the result",
     resultBlock.length > 400
     && !/qr-stamp|scoreLine\(|qr-move|qr-note/.test(resultBlock)
     && !/of \{result\.total\}|right of/.test(resultBlock));

  /* GOING THROUGH THE PAPER IS ONE STEP FURTHER IN, not a thing the result
     screen grew. The rows above it correct every miss in a line; the
     explanation, the lesson a miss came from and a paper of only the misses
     are behind a single button, so the score keeps the shape the design gave
     it and the teaching still has somewhere to be. */
  ok("port", "the result offers a way into the paper, and it is not the primary",
     /<button className="btn is-inline" type="button" onClick=\{\(\) => setPhase\("review"\)\}>\s*\n\s*Go through the paper/.test(exam));
  /* The explanation has to be on the MISSED question, which is the one the
     student came back for — the same class also appears under the fold, so a
     looser test passed while the misses had lost theirs. */
  ok("port", "going through it explains what was missed, and joins back to the lesson by id",
     /phase === "review"/.test(exam)
     && /\{r\.explain && <p className="q-rev-explain">\{r\.explain\}<\/p>\}/.test(exam)
     && /onOpenLesson\(r\.lessonId\)/.test(exam) && /weakLessons\(attempt, quiz\)/.test(exam));
  ok("port", "and offers the misses as their own paper",
     /Just the \{wrong\.length\} I missed/.test(exam) && /retakeWrong\(attempt, quiz\)/.test(exam));
  /* A retake of the misses is a drill, not a second sitting of the paper: it
     must not be able to write a score over the one already recorded. */
  ok("port", "which cannot overwrite the score of the paper it came from",
     /quizId=\{`\$\{id\}\.retake`\}/.test(exam)
     && !/onDone=|onAnswers=|onProgress=/.test(exam.split('phase === "retake"')[1] || ""));
  ok("port", "and the quiz opens on the paper rather than on a cover",
     !/questions · pass mark/.test(page) && !/Back to question/.test(page)
     && !/nextAfterQuiz|nextLabel/.test(page));
  /* ONE WAY OUT, AND IT NOW ASKS. This used to read `!/Leave/.test(exam)` —
     the exam itself must offer no exit of its own. It offers exactly one now,
     inside the end-exam dialog, and the arrow raises that same dialog rather
     than leaving on its own (R4, conflict 5). So the rule is unchanged in
     substance: there is one door out of an open paper and everything goes
     through it. What is asserted is that the exam's own markup carries no
     OTHER leave control outside the dialog. */
  /* The CONTROL, not the word — `onLeave` is in the props list, which is
     outside the dialog and always will be. What must not exist is a second
     leave button anywhere on the paper. */
  const leaveControls = [...exam.matchAll(/Leave it for now/g)].length;
  ok("port", "the way out is the module's own back link, and it is the only one",
     /className="up"/.test(page)
     && leaveControls === 1
     && exam.indexOf("Leave it for now") > exam.indexOf("<dialog"));

  /* THE LAYOUT READS THE ROOM IT IS GIVEN, not the window: the same exam is
     narrow in a split pane and wide on a laptop. */
  ok("port", "the breakpoints are container queries, and the container is kept",
     /container-type: inline-size/.test(css)
     && /@container \(max-width: 859px\)/.test(css) && /@container \(max-width: 560px\)/.test(css)
     && /className="exam-frame"/.test(exam));

  /* Every colour on this screen is a token, so it follows the livery, the
     finish and light or dark. The two exceptions are stated: the flag, which
     has to read as the same mark on Beacon red, and the sheen on the score
     line, which is white light rather than a colour. */
  const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  ok("port", "no hex literal anywhere in the exam stylesheet", hexes.length === 0, hexes.join(" "));
  /* `oklch(from …)` is a feature test and a derivation, not a colour choice. */
  const oklch = (css.match(/oklch\([^)]*\)/g) || []).filter((c) => !/var\(|from /.test(c));
  ok("port", "and the only fixed colours are the flag, the backdrop and the sheen",
     oklch.length === 4, oklch.join(" "));
  ok("port", "the flag never follows the livery",
     /--flag: oklch\(\.68 \.2 27\)/.test(css) && /--flag: oklch\(\.58 \.21 27\)/.test(css));

  /* §12's 44px floor, and the one control that opts out of it with its reason
     written down: eight cells across a phone cannot each own 44 pixels. */
  ok("port", "the grid cells opt out of the tap floor deliberately",
     /className=\{`qcell is-inline/.test(exam) && /OPTS OUT OF THE 44px FLOOR/.test(css));

  /* Smooth Air is this app's own reduced-motion switch, and the animations
     this screen runs by hand are not reachable from CSS. */
  ok("port", "reduced motion stops the hand-written animations too",
     /smooth-air/.test(exam) && /prefers-reduced-motion/.test(exam)
     && /@media \(prefers-reduced-motion: reduce\)/.test(css) && /\.app\.smooth-air \.exam-frame/.test(css));
}

/* ---- the matte finish ---------------------------------------------------- */
console.log("\nthe matte finish");
{
  const exam = read("src/components/module/Exam.jsx");
  const matte = read("src/components/module/exam-matte.css");
  const own = read("src/components/module/exam.css");
  const page = read("src/components/module/QuizPage.jsx");

  /* THE FLAG THAT TURNS IT ON. The matte sheet is keyed on the document
     element, because the tokens it overrides are written there inline by the
     theme layer, and a stylesheet !important is what beats an inline style. */
  ok("matte", "the quiz taker flags the screen, and takes the flag off with it",
     /root\.dataset\.screen = "exam";/.test(exam) && /delete root\.dataset\.screen;/.test(exam));
  ok("matte", "and the sheet is loaded after the screen's own",
     exam.indexOf('import "./exam-matte.css"') > exam.indexOf('import "./exam.css"'));

  /* NOTHING BEHIND THE PANELS BUT FLAT GROUND. One element carries every
     scenery layer — Aurora's stars and cloud, Manual's ruled paper, the key
     and fill gradients, the spill and the grain — so one rule takes them all. */
  ok("matte", "the finish's scenery is off on the quiz",
     /:root\[data-screen="exam"\] \.deck-light \{ display: none !important; \}/.test(matte)
     && /--stars: none !important/.test(matte) && /background: var\(--ground\) !important/.test(matte));

  /* THE VALUES ARE THE DESIGN'S. Spot-checked rather than trusted: the two
     grounds, the capped accent, and the fixed flag. */
  for (const line of [
    "--ground:    oklch(from var(--active) .165 .006 h) !important;",
    "--ground:    oklch(from var(--active) .968 .004 h) !important;",
    "--accent:      oklch(from var(--active) .74 min(c, .085) h);",
    "--accent:      oklch(from var(--active) .50 min(c, .10) h);",
    "--flag: oklch(.68 .21 27);",
  ]) ok("matte", `kept as sent: ${line.trim().slice(0, 42)}…`, matte.includes(line));

  /* `.route` IS NOT A FREE NAME HERE. The module screen has `.mscreen .route`
     — a flex row with padding and a rule under it — and the quiz taker's page
     root IS `.mscreen`, so the unscoped rules drew a 41px block across the
     bar. Measured. The three rules take the file's own screen prefix. */
  ok("matte", "the route line is scoped past the module screen's own .route",
     !/^\.exam-frame \.route/m.test(matte)
     && /:root\[data-screen="exam"\] \.exam-frame \.route \{/.test(matte));
  ok("matte", "and the bar carries it, filled as far as the paper is answered",
     /<span className="route" aria-hidden="true">/.test(exam)
     && /width: `\$\{\(answeredCount\(attempt\) \/ total\) \* 100\}%`/.test(exam));

  /* An answered cell is a raised surface with an accent tick, not a block of
     colour: the livery shows on six things and this is one of them. */
  ok("matte", "an answered cell is no longer a solid accent fill",
     !/\.qcell\.is-answered \{ background: var\(--accent-fill\)/.test(own)
     && /\.qcell\.is-answered::before/.test(matte) && /background: var\(--accent\);/.test(matte));
  ok("matte", "and the chosen answer's letter is text, not accent",
     /\.option:has\(input:checked\) \.option__letter \{ color: var\(--t1\); \}/.test(own));

  /* A COMPONENT DECLARED INSIDE A COMPONENT IS A NEW TYPE ON EVERY RENDER, and
     React throws the whole subtree away and rebuilds it each time. The review
     row was written that way: the result screen renders about sixty times
     while the percentage counts up, so every row was destroyed and recreated
     sixty times over, its rise animation restarting with each one — the list
     sat blank for seconds. Found by measuring: the rows the test was holding
     had been detached from the document. */
  const nested = exam.match(/^\s+(?:const|function)\s+[A-Z]\w*\s*[=(]/gm) || [];
  ok("matte", "no component is declared inside another component", nested.length === 0, nested.join(" "));

  /* The result's mark is the aeroplane in a ring, which is the finish's own. */
  ok("matte", "the result wears the plane",
     /const IconPlane/.test(exam) && /<IconPlane \/><\/span>\{headText\}/.test(exam)
     && /\.result__icon \{[\s\S]{0,120}border: 1\.5px solid var\(--accent\)/.test(matte));

  /* Both sheets have to agree about where the navigator moves, or there is a
     band of widths where one says one column and the other says two. */
  /* The paper does not sit in the lesson page's prose wrapper: `.mscreen
     .lbody p` outranks the screen's own type rules by an element. */
  ok("matte", "the paper is not wrapped in the lesson page's prose",
     !/className="lbody"/.test(page) && /className="qwrap"/.test(page)
     && /\.mscreen \.qwrap \{/.test(own));

  ok("matte", "the two stylesheets break at the same width",
     /@container \(min-width: 860px\)/.test(matte) && /@container \(max-width: 859px\)/.test(matte)
     && /@container \(max-width: 859px\)/.test(own) && !/@container \(max-width: 900px\)/.test(own));
}

/* ---- Master Caution lights in one place, Calibration in none ------------- */
console.log("\nthe lamp, and what is gone");
{
  const home = read("src/components/Home.jsx");
  const mins = read("src/lib/minimums.js");
  ok("lamp", "the launcher card is the only thing that lights it",
     /<CautionMark className="modlamp" \/>/.test(home));
  for (const f of ["module/RouteTab.jsx", "module/LibraryTab.jsx", "module/QuizResults.jsx"]) {
    ok("lamp", `and ${f.split("/")[1]} does not`, !/CautionMark/.test(read(`src/components/${f}`)));
  }
  ok("lamp", "it reads the module's average against the bar, not one weak chapter",
     /moduleNeedsYou = \(chapters, quiz, mins\) =>\s*\n\s*isBelow\(averagePct\(takenScores\(chapters, quiz\)\), mins\)/.test(mins));
  ok("lamp", "a module with nothing taken yet does not light",
     moduleNeedsYou([{ id: "c1" }], {}, 75) === false);
  ok("lamp", "a module averaging under the bar does",
     moduleNeedsYou([{ id: "c1" }], { c1: { correct: 5, total: 10 } }, 75) === true);
  ok("lamp", "and one at the bar does not",
     moduleNeedsYou([{ id: "c1" }], { c1: { correct: 6, total: 8 } }, 75) === false);

  /* CALIBRATION IS GONE, not hidden: the row, the route, the set it drew, the
     date it stamped and the styles it wore. */
  const src = [
    "src/components/module/LibraryTab.jsx", "src/components/module/ModuleScreen.jsx",
    "src/App.jsx", "src/lib/routes.js", "src/lib/retention.js",
    "src/components/module/module.css",
  ].map(read).join("\n");
  ok("gone", "no calibration row, sticker or start",
     !/calrow|calsticker|calband|calval|calwhen|onStartCalibration/.test(src));
  ok("gone", "no re-check route, set or stamp",
     !/flow: "recheck"/.test(src) && !/recheckSet\(/.test(src) && !/pw-last-recheck/.test(src));
  ok("gone", "and the piles it drew from are untouched",
     /export function toHolding/.test(read("src/lib/retention.js"))
     && /export function toCaution/.test(read("src/lib/retention.js")));

  /* §8 — a quiz row carries the paper, and its real length. */
  const route = read("src/components/module/RouteTab.jsx");
  /* `.th`, not `.lead`: the module screen was rebuilt on the reference
     build's own markup (2026-09-19) and the 62px slot a row's picture sits in
     is called `.th` there. Same slot, same thumbnail, same rule. */
  ok("thumb", "a quiz row is an answer sheet with the question count on it",
     /className="th quiz-thumb"/.test(route) && /<b>\{count\}<\/b>Qs/.test(route)
     && /<QuizThumb count=\{total\} \/>/.test(route));
  ok("thumb", "and it invents no number when the paper has none",
     /\{count \? <span className="quiz-thumb__count">/.test(route));
}

/* ---- contrast, on the surface actually behind the words ------------------ */
console.log("\ncontrast — the matte finish, six liveries × three finishes × night and day");
{
  /* THE EXAM SCREEN IS NOT PAINTED IN THE APP'S TOKENS ANY MORE, so measuring
     those would prove nothing about it. `exam-matte.css` re-grounds the whole
     document while the quiz is on screen: matte greys carrying a trace of the
     livery's hue, an accent capped so it never shouts, and no scenery behind
     the panels. Every surface below is built the way that file builds it —
     `oklch(from var(--active) L C h)` — off whatever `--active` is under the
     livery AND the finish, because Manual writes its own.

     Method is check:contrast's: linear light, WCAG ratios, 4.5 for text and 3
     for a control's edge or a mark. */
  const toLin = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s2 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2].map((x) => Math.min(1, Math.max(0, x)));
  };
  const lum = (x) => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const oklch = (L, C, H) => { const h = (H * Math.PI) / 180; return toLin([L, C * Math.cos(h), C * Math.sin(h)]); };
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(String(v));
    return m ? { L: +m[1], C: +m[2], H: +m[3] } : null;
  };
  const worst = {};
  const need = (name, r, min) => { if (!worst[name] || r < worst[name].r) worst[name] = { r, min }; };

  for (const variant of ["night", "day"]) {
    for (const L of LIVERIES) {
      for (const finish of FINISHES.map((f) => f.id)) {
        const { vars, C } = deckVars(L.id, variant);
        const v = { ...vars, ...finishVars(L.id, variant, finish, C.active) };
        const active = parse(v["--active"]);
        if (!active) continue;
        const h = active.H;
        const day = variant === "day";
        /* exam-matte.css, rule for rule. */
        const M = day
          ? { ground: [.968, .004], sunk: [.955, .005], panel: [.995, .002], raised: [.950, .006],
              line: [.890, .007], t1: [.220, .008], t2: [.400, .010], t3: [.560, .010],
              opt: [.985, .003], optOn: [.955, .008], lineStrong: [.780, .010],
              accent: [.50, Math.min(active.C, .10)], fill: [.47, Math.min(active.C, .10)], ink: [.99, 0] }
          : { ground: [.165, .006], sunk: [.150, .006], panel: [.205, .008], raised: [.245, .010],
              line: [.290, .010], t1: [.950, .004], t2: [.780, .006], t3: [.600, .008],
              opt: [.180, .007], optOn: [.235, .010], lineStrong: [.400, .012],
              accent: [.74, Math.min(active.C, .085)], fill: [.74, Math.min(active.C, .085)], ink: [.17, .01] };
        const col = (k) => oklch(M[k][0], M[k][1], h);
        const flag = day ? oklch(.57, .22, 27) : oklch(.68, .21, 27);
        const labOf = ([Lv, Cv]) => { const rad = (h * Math.PI) / 180; return [Lv, Cv * Math.cos(rad), Cv * Math.sin(rad)]; };
        const ringLab = labOf(M.lineStrong).map((x, i) => x * 0.3 + labOf(M.t3)[i] * 0.7);
        /* The accent as WORDS on the result screen is still the engine's
           --active-text: the matte caps the fill and the outline, not the ink. */
        const inkWords = toLin([parse(v["--active-text"]).L,
          parse(v["--active-text"]).C * Math.cos((parse(v["--active-text"]).H * Math.PI) / 180),
          parse(v["--active-text"]).C * Math.sin((parse(v["--active-text"]).H * Math.PI) / 180)]);

        need("the question, and an answer, on the card", ratio(col("t1"), col("panel")), 4.5);
        need("an answer on its row", ratio(col("t1"), col("opt")), 4.5);
        need("its letter", ratio(col("t2"), col("opt")), 4.5);
        need("the letter of the answer you picked", ratio(col("t1"), col("optOn")), 4.5);
        need("the clock", ratio(col("t1"), col("panel")), 4.5);
        need("the clock in its last minute", ratio(flag, col("panel")), 4.5);
        need("TIME LEFT, and the module line above the quiz", ratio(col("t3"), col("panel")), 4.5);
        need("a question number in the grid", ratio(col("t3"), col("panel")), 4.5);
        need("an answered question's number", ratio(col("t1"), col("raised")), 4.5);
        need("Next, on the accent", ratio(col("ink"), col("fill")), 4.5);
        /* A radio ring is the whole of what identifies an unchosen answer, so
           it carries the 3:1 a control's edge needs — see the note on
           .option__radio. A grid cell's border does not: the number inside it
           is legible at 4.5 and is what tells you the cell is there, which is
           the distinction WCAG 1.4.11 draws. */
        const ring = [0, 1, 2].map((i) => ringLab[i]);
        need("a radio ring, 3:1 for a control", ratio(toLin(ring), col("opt")), 3);
        need("the tick under an answered question, 3:1 for a mark", ratio(col("accent"), col("raised")), 3);
        need("the outline on the question you are on, 3:1", ratio(col("accent"), col("panel")), 3);
        /* The fill against the bar it runs along, not against the dashed
           track it covers: two decorations measured against each other says
           nothing about whether the line can be seen. */
        need("the route line's fill on the bar, 3:1", ratio(col("accent"), col("panel")), 3);
        need("the score and the line under it", ratio(col("t1"), col("panel")), 4.5);
        need("the plane in its ring, 3:1 for a mark", ratio(col("accent"), col("panel")), 3);
        need("what you should have answered", ratio(inkWords, col("panel")), 4.5);
        need("what you did answer, struck through", ratio(col("t3"), col("panel")), 4.5);
        need("the score line's fill against its track, 3:1", ratio(col("fill"), col("raised")), 3);
        need("the review flag, 3:1 for a mark", ratio(flag, col("panel")), 3);
      }
    }
  }
  for (const [name, { r, min }] of Object.entries(worst)) {
    ok("contrast", `${name} — worst ${r.toFixed(2)} of ${min}`, r >= min);
  }
}

/* ---- R4 · you can only leave an exam by ending it ------------------------ */
console.log("\nR4 — the paper is locked");
{
  const app = read("src/App.jsx");
  const exam = read("src/components/module/Exam.jsx");
  const lock = read("src/lib/examLock.js");

  /* WHY THIS SECTION EXISTS. exam-port.check.js asks its three locked
     questions inside `.exam-page` — no links, no pill, no profile — and this
     app had no `.exam-page`, so all three asked an empty set and all three
     answered PASS. Measured on the live quiz instead: the app bar was fully
     drawn over an open paper with the Ready Room pill and the profile menu
     both clickable, and the browser's own Back walked out of the exam. These
     assertions are what stops that coming back quietly. */

  ok("locked", "the exam page has a scope for the port check to ask in",
     /<div className="exam-page">/.test(exam));

  /* The bar's locked branch renders a wordmark and a sentence. It has to be a
     branch, not a hidden class: a hidden control is still in a page search and
     was still one stray click out of a timed paper. */
  const branch = app.match(/examLocked \? \([\s\S]*?\) : \(/);
  ok("locked", "the app bar has a locked branch", !!branch);
  if (branch) {
    const b = branch[0];
    ok("locked", "and it renders no Ready Room pill and no profile menu",
       !/ReadyRoomPill|ProfileMenu/.test(b));
    ok("locked", "and the wordmark is not a button in it",
       /<span className="brandmark">/.test(b) && !/<button className="brandmark"/.test(b));
    ok("locked", "and it says so, in the pack's own rule rather than a new one",
       /className="locked-note"/.test(b) && /className="topbar examport"/.test(b));
  }

  ok("locked", "browser Back is answered before anything navigates",
     /const lock = examLock\(\);\s*\n\s*if \(lock\.locked\) \{\s*\n\s*window\.history\.pushState\(null, "", pathNow\.current\);\s*\n\s*lock\.askEnd\?\.\(\);\s*\n\s*return;/.test(app));

  /* The half that would be worse than the bug: a lock that never releases. */
  ok("locked", "only the paper locks — the result, the drill and the retake do not",
     /if \(phase !== "paper"\) \{ unlockExam\(\); return undefined; \}/.test(exam));
  ok("locked", "and unmounting releases it",
     /lockExam\([\s\S]{0,120}?\);\s*\n\s*return unlockExam;/.test(exam));
  ok("locked", "it is set in a layout effect, like data-screen above it",
     /useLayoutEffect\(\(\) => \{\s*\n\s*if \(phase !== "paper"\)/.test(exam));

  /* One module holds it, so the bar and the pop handler cannot disagree. */
  const holders = ["src/App.jsx", "src/components/module/Exam.jsx"]
    .filter((f) => /from "[^"]*examLock\.js"/.test(read(f)));
  ok("locked", `the lock has one home and two readers (${holders.length})`,
     holders.length === 2 && /export function lockExam/.test(lock) && /export function unlockExam/.test(lock));

  /* THE ARROW ASKS, RATHER THAN BEING DELETED. R4 says no back arrow; this app
     keeps the attempt and stops the clock when a paper leaves the screen, so
     deleting it would make handing in a blank paper the only way out of a quiz
     opened by mistake. Every exit comes through one dialog instead. */
  const quizPage = read("src/components/module/QuizPage.jsx");
  ok("locked", "the up arrow asks while a paper is open, and goes when it is not",
     /onClick=\{\(\) => \(lock\.locked \? lock\.askEnd\?\.\(\) : onBack\(\)\)\}/.test(quizPage));
  ok("locked", "and the dialog's third choice leaves without marking",
     /onLeave=\{onBack\}/.test(quizPage)
     && /onClick=\{\(\) => \{ dialogRef\.current\?\.close\(\); onLeave\(\); \}\}/.test(exam));
  /* The button's OWN handler, not two hundred characters of whatever follows
     it — which is what the first version of this line measured, and it read
     the props list. */
  const leaveBtn = exam.match(/onClick=\{\(\) => \{ dialogRef\.current\?\.close\(\); onLeave\(\); \}\}/);
  ok("locked", "leaving is not handing in — its handler closes and goes, and marks nothing",
     !!leaveBtn && !/handOver|submit\(/.test(leaveBtn[0]));

  /* CONFLICT 2, DECIDED: the door stays. The pack's check fails a result
     screen carrying this button, and removing it would delete the only way to
     the explanation for every question, the lesson each miss came from, and a
     paper of only the misses — three things, to satisfy a check about one.
     Asserted so that a later tidy-up cannot quietly satisfy that check by
     taking the door out. */
  ok("locked", "\"Go through the paper\" is still the door to the drill",
     /Go through the paper/.test(exam) && /onClick=\{\(\) => setPhase\("review"\)\}/.test(exam));

  /* R1's other half, finally true: the pack's sheet is imported, once. */
  const imports = ["src/components/module/Exam.jsx", "src/App.jsx", "src/components/module/QuizPage.jsx"]
    .filter((f) => /import "\.?[./]*(components\/module\/)?exam-port\.css"/.test(read(f)));
  ok("locked", "the pack's stylesheet is imported exactly once", imports.length === 1,
     imports.join(" "));
}

console.log(`\nexam: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
