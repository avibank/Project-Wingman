# The exam pack — four things that cannot be copied, and why

`docs/launch/BRIEF-exam.md` ends: "Anything that can't match, list it and
stop. Don't approximate it." This is that list. Everything else in the pack is
in and scoped (`npm run ref:css` → `src/components/module/exam-port.css`).

Each of these reverses a decision already recorded in this repo. None is a
matter of taste and none should be settled by me.

---

## 1 · The leaderboard (R5, R6)

**The brief:** a board of runs ranked by score then time, everyone on the
module, one account able to appear several times under different callsigns.

**What it reverses.** Two places in this codebase forbid it, independently:

* `src/components/module/quiz.css` §8, "WHAT MUST NOT APPEAR":
  "No points, leaderboard, streak, meme or sound."
* `src/components/room/ProfileSheet.jsx`: "The moment discovery shows
  performance it becomes a leaderboard, weaker students get quietly excluded,
  and the mixed-ability groups are the ones that actually work."

**What it needs besides the screen**, which is why the brief's own rule —
"if a step needs a change somewhere else, stop and say so" — applies:

* a migration adding the run's callsign, `started_at` and `submitted_at` to
  the attempt, and a policy making other students' runs readable;
* a server-side ranking function (R5 is explicit that the client only formats);
* per-run callsigns, which is a new idea — a callsign is currently one per
  account, unique, claimed through `claim_code`.

**Not built.** The stylesheet's `.lb-*` and `.board*` rules are in and unused,
so the day it is wanted the markup has somewhere to land.

## 2 · "Go through the paper" (the check script)

**The brief:** `exam-port.check.js` fails if the result screen has a "Go
through the paper" button.

**What it reverses.** CLAUDE.md, The quiz: that screen was dropped by the
first port "because the approved result screen lists no such control; **it is
back on request**, as a screen of its own so the score keeps the shape the
design gave it." It is where the explanation for every question, the lesson
each miss came from, and a paper of only the misses live.

Removing the button removes the only door to all three. **Not removed.**

## 3 · The clock: 20 minutes flat (R5)

**The brief:** "The fixed exam clock is 20 minutes for any quiz up to 40
questions."

**What it reverses.** `src/lib/quiz.js` §1 and CLAUDE.md: "The allowance is
this file's own nominal figure, 75 seconds a question." A chapter quiz here is
eight questions, so the allowance is 10 minutes; the brief would make it 20.

This one is cheap to change — `allowanceFor` in `quiz.js`, one function, and
`check:exam` asserts against it — but it doubles the time on every chapter
quiz in the app, which is a teaching decision rather than a port. **Not
changed.**

## 4 · R1 taken literally (copy the stylesheet in unedited and import it)

**What it does.** 128 of the sheet's rules are bare class names this app
already renders elsewhere. Counted:

| class | other components rendering it |
|---|---|
| `.btn` | 21 |
| `.sheet` | 9 — including the licence pickers |
| `.who` | 8 |
| `.mark` | 5 — every chapter tick and the player's marks |
| `.stamp` | the lesson sign-off |
| `.route`, `.score`, `.verdict`, `.ans`, `.options` | quiz, Debrief, Review, the route strip |

`.mark{width:36px;height:36px;border-radius:50%}` on its own turns every
chapter tick in the app into a circle — from the moment the exam chunk loads,
and it stays after the student leaves, because a lazy chunk's CSS does.

**What was done instead.** The delivered file is committed unedited at
`docs/launch/code/17-exam-result-leaderboard.css`; `npm run ref:css` produces
the scoped copy. `git diff` shows the file added, not edited, and the rules
exist in exactly one place in `src/` — which is what R1's check actually
tests. This is the same machinery the other four handed-over sheets use.

## 5 · "No back arrow" (R4)

**The brief:** "Once started, the exam screen has no way out but **End exam**
... No back arrow, no Ready Room, no profile, no links of any kind on the
page."

**What is done.** Everything except the arrow, and it was all genuinely
missing: the app bar was fully drawn over an open paper with the Ready Room
pill and the profile menu both clickable, and the browser's own Back walked
out of the exam and abandoned it. Both measured, both closed — the bar is now
a wordmark and EXAM IN PROGRESS, and Back opens the paper's own end-exam
dialog. `exam-port.check.js` had reported all three as PASS, because it asks
them inside `.exam-page` and this app had no `.exam-page`; an empty set
satisfies every one of them.

**What it reverses.** `QuizPage` draws `← Module 1` above the paper. Removing
it makes handing in a blank paper the only way out of a quiz opened by
mistake — and this app already answers that question the other way, on
purpose and under test: `saveAttempt`/`loadAttempt` persist the attempt on
every change, the time left belongs to the attempt and only moves while the
paper is on screen (CLAUDE.md), and `check:exam` holds a "leaving and coming
back" section asserting you return to the question you left with the clock
where it was.

So the arrow is a teaching decision rather than a port. **Not removed.**

