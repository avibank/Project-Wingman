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
  /* The allowance IS the estimate, made real. Both are 75 seconds a question,
     so the cover's old "about 10 minutes" and the clock on the paper can never
     be two different promises about the same eight questions. */
  ok("shape", "the allowance is the estimate made real",
     allowanceFor(8) === 600 && /10 minutes/.test(estimate(8)));
  ok("shape", "and a paper is never given less than a minute", allowanceFor(0) === 60);
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
     /<button className="btn" type="button" onClick=\{\(\) => setPhase\("review"\)\}>\s*\n\s*Go through the paper/.test(exam));
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
  ok("port", "the way out is the module's own back link, and it is the only one",
     /className="up"/.test(page) && !/Leave/.test(exam));

  /* THE LAYOUT READS THE ROOM IT IS GIVEN, not the window: the same exam is
     narrow in a split pane and wide on a laptop. */
  ok("port", "the breakpoints are container queries, and the container is kept",
     /container-type: inline-size/.test(css)
     && /@container \(max-width: 900px\)/.test(css) && /@container \(max-width: 560px\)/.test(css)
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
  ok("thumb", "a quiz row is an answer sheet with the question count on it",
     /className="lead quiz-thumb"/.test(route) && /<b>\{count\}<\/b>Qs/.test(route)
     && /<QuizThumb count=\{total\} \/>/.test(route));
  ok("thumb", "and it invents no number when the paper has none",
     /\{count \? <span className="quiz-thumb__count">/.test(route));
}

/* ---- contrast, on the surface actually behind the words ------------------ */
console.log("\ncontrast — six liveries, night and day");
{
  /* The same method as check:contrast and check:rr: linear light, every
     surface composited over its own ground, color-mix in OKLab premultiplied
     exactly as CSS mixes it. The exam screen is the app's most text-dense
     surface and it is the one a student sits under time pressure, so every
     pair here is measured rather than eyeballed. */
  const toLin = ([L, a, b]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => Math.min(1, Math.max(0, x)));
  };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const col = (L, C, H, A = 1) => { const h = (H * Math.PI) / 180; return { lab: [L, C * Math.cos(h), C * Math.sin(h)], a: A }; };
  const CLEAR = { lab: [0, 0, 0], a: 0 };
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/.exec(String(v));
    return m ? col(+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]) : null;
  };
  const mix = (x, p, y) => {
    const a = x.a * p + y.a * (1 - p);
    return a ? { lab: [0, 1, 2].map((i) => (x.lab[i] * x.a * p + y.lab[i] * y.a * (1 - p)) / a), a } : CLEAR;
  };
  const over = (fg, bg) => toLin(fg.lab).map((v, i) => bg[i] + (v - bg[i]) * fg.a);
  const worst = {};
  const need = (name, r, min) => { if (!worst[name] || r < worst[name].r) worst[name] = { r, min }; };

  /* AND EVERY FINISH, because a finish is not only lighting. Manual rewrites
     --ground, --panel, --raised, --line and all three accent tokens, so the
     pairs below are a different measurement under it — checking the stock
     livery alone would have proved a third of the screen. */
  for (const variant of ["night", "day"]) {
    for (const L of LIVERIES) {
      for (const finish of FINISHES.map((f) => f.id)) {
      const { vars, C } = deckVars(L.id, variant);
      const v = { ...vars, ...finishVars(L.id, variant, finish, C.active) };
      const t = (k) => parse(v[k]);
      const day = variant === "day";
      const ground = toLin(t("--ground").lab);
      const panel = over(t("--panel"), ground);
      const raised = over(t("--raised"), ground);
      const c = (x) => toLin(x.lab);
      /* An option row is `--ground` inside the card, and the selected one is
         the accent at 12% (day) or 16% (night) over that. */
      const soft = over(mix(t("--active"), day ? 0.12 : 0.16, CLEAR), ground);
      /* The ring on an unanswered radio and the border of an empty grid cell. */
      const lineStrong = over(mix(t("--line"), 0.25, t("--t3")), ground);
      const flag = parse(day ? "oklch(.58 .21 27)" : "oklch(.68 .2 27)");
      const at = (what) => `${what}`;

      need(at("the question, and an answer, on the card"), ratio(c(t("--t1")), panel), 4.5);
      need(at("an answer on its row"), ratio(c(t("--t1")), ground), 4.5);
      need(at("its letter"), ratio(c(t("--t2")), ground), 4.5);
      need(at("the letter of the answer you picked"), ratio(c(day ? t("--active-text") : t("--lit")), soft), 4.5);
      need(at("and the answer you picked"), ratio(c(t("--t1")), soft), 4.5);
      need(at("the clock"), ratio(c(t("--t1")), panel), 4.5);
      need(at("the clock in its last minute"), ratio(c(mix(t("--bad"), 0.85, t("--t1"))), panel), 4.5);
      need(at("TIME LEFT, and the module line above the quiz"), ratio(c(t("--t3")), panel), 4.5);
      need(at("a question number in the grid"), ratio(c(t("--t2")), panel), 4.5);
      /* The fill takes a step off dead centre and the ink is black or white,
         chosen from the stepped fill — see the note on --accent-fill. */
      const fill = mix(t("--active-fill"), 0.9, t("--t1"));
      const ink = fill.lab[0] >= 0.56 ? col(0, 0, 0) : col(1, 0, 0);
      need(at("an answered question's number, on the accent"), ratio(c(ink), c(fill)), 4.5);
      need(at("Next, on the accent"), ratio(c(ink), c(fill)), 4.5);
      need(at("an empty cell's edge and a radio ring, 3:1 for a control"), ratio(lineStrong, ground), 3);
      need(at("the score and the line under it"), ratio(c(t("--t1")), panel), 4.5);
      need(at("the pass icon beside it, 3:1 for a mark"), ratio(c(t("--active-text")), panel), 3);
      need(at("the not-yet icon, 3:1 for a mark"), ratio(c(t("--t2")), panel), 3);
      need(at("what you should have answered"), ratio(c(t("--active-text")), panel), 4.5);
      need(at("what you did answer, struck through"), ratio(c(t("--t3")), panel), 4.5);
      need(at("the score line's fill against its track, 3:1"), ratio(c(t("--active-fill")), raised), 3);
      need(at("a not-yet fill against its track, 3:1"), ratio(c(t("--t3")), raised), 3);
      /* THE FLAG IS FIXED, so it is measured on every livery rather than on
         one: it has to read as a mark on Beacon red and on Gauge amber. */
      need(at("the review flag, 3:1 for a mark"), ratio(c(flag), panel), 3);
      }
    }
  }
  for (const [name, { r, min }] of Object.entries(worst)) {
    ok("contrast", `${name} — worst ${r.toFixed(2)} of ${min}`, r >= min);
  }
}

console.log(`\nexam: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
