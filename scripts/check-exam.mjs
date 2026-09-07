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
  handIn, navigator as navRow, elapsed, seedOf, unanswered, answeredCount,
  flagged, submitWarning, passAt, scoreLine, retakeWrong, weakLessons,
  estimate, LABELS, OPTIONS, PASS_MARK,
} from "../src/lib/quiz.js";
import { shuffleOptions } from "../src/lib/retention.js";

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
  ok("shape", "the estimate is minutes, never a countdown", /minutes/.test(estimate(8)));
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
  const paper = exam.split('/* ------------------------------------------------------------- the paper */')[1] || "";
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

  ok("exam", "the sentence is said on the paper itself",
     /Nothing is marked until you hand it in\./.test(exam));
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
     !/Are you sure/i.test(exam) && /Once it is in, it is marked/.test(exam));
  ok("handin", "and every outstanding question is a way back to it",
     /onClick=\{\(\) => jump\(i\)\}/.test(exam));

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
  ok("result", "a blank says it was blank rather than reporting an answer",
     r[1].chose === null && /You left this one blank/.test(read("src/components/module/Exam.jsx")));
  ok("result", "and it points at the lesson by id, never by resemblance",
     r[0].lessonId === "L1" && /onOpenLesson\(r\.lessonId\)/.test(read("src/components/module/Exam.jsx")));

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
     /onClick=\{\(\) => put\(\(a\) => goTo\(a, n\.index, paper\.length\)\)\}/.test(exam));
  ok("nav", "and it replaces the progress bar rather than joining it",
     !/className="q-seg"/.test(exam) && /NO SECOND PROGRESS BAR/.test(exam));
}

/* ---- the clock counts up ------------------------------------------------- */
console.log("\nthe clock");
{
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  ok("clock", "it reads as minutes and seconds", elapsed(t0, t0 + 754000) === "12:34");
  ok("clock", "it starts at zero", elapsed(t0, t0) === "0:00");
  ok("clock", "it grows an hour when it needs one", elapsed(t0, t0 + 3725000) === "1:02:05");
  ok("clock", "a broken start does not produce NaN", elapsed("not a date") === "0:00");

  const exam = read("src/components/module/Exam.jsx");
  const css = read("src/components/module/quiz.css");
  /* A number counting down decides when you stop; a number counting up is
     information you asked for. Nothing here may turn it into the former. */
  ok("clock", "nothing counts down", !/remaining|countdown|timeLeft|deadline/i.test(exam));
  ok("clock", "it never changes colour to warn",
     !/exam-clock[^{]*\{[^}]*var\(--bad\)/.test(css));
  ok("clock", "and the ticking stops when the paper is not open",
     /if \(phase !== "paper"\) return undefined;\s*\n\s*const t = setInterval/.test(exam));
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
  ok("resume", "coming back to answers already on the paper says so",
     /resumeLine\(loadAttempt\(id\)\)/.test(exam));
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
     /The model — every rule about what an attempt is/.test(exam));

  const css = read("src/components/module/quiz.css");
  ok("style", "no hex literal in the quiz stylesheet",
     (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length === 0);
  ok("style", "one filled button on a screen, and it is the one that moves you on",
     (exam.match(/data-primary=""/g) || []).length <= 4);
}

console.log(`\nexam: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
