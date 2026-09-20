# The exam pack — four things that cannot be copied, and why

`docs/launch/BRIEF-exam.md` ends: "Anything that can't match, list it and
stop. Don't approximate it." This is that list. Everything else in the pack is
in and scoped (`npm run ref:css` → `src/components/module/exam-port.css`).

Each of these reverses a decision already recorded in this repo.

**All five are settled (2026-09-20.)** The owner took conflicts 1 and 3 and
handed the rest back to be decided here. What each decision is, and what it
cost, is under the heading it belongs to.

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

## 2 · "Go through the paper" — KEPT (decided here)

**The brief:** `exam-port.check.js` fails if the result screen has a "Go
through the paper" button.

**What it reverses.** CLAUDE.md, The quiz: that screen was dropped by the
first port "because the approved result screen lists no such control; **it is
back on request**, as a screen of its own so the score keeps the shape the
design gave it." It is where the explanation for every question, the lesson
each miss came from, and a paper of only the misses live.

Removing the button removes the only door to all three — three things deleted
to satisfy a check about one. **Kept**, and now asserted, so that a later
tidy-up cannot quietly satisfy the port check by taking the door out. That one
line of `exam-port.check.js` is knowingly not satisfied and will keep printing
FAIL; it is the only one.

## 3 · The clock: 20 minutes flat — TAKEN (owner)

**The brief:** "The fixed exam clock is 20 minutes for any quiz up to 40
questions."

**What it reverses.** `src/lib/quiz.js` §1 and CLAUDE.md: "The allowance is
this file's own nominal figure, 75 seconds a question." A chapter quiz here is
eight questions, so the allowance is 10 minutes; the brief would make it 20.

**Taken.** `allowanceFor` is a flat twenty minutes for any quiz up to forty
questions; past forty the per-question figure comes back so a long paper does
not silently get a short one's allowance. `estimate` keeps the 75 seconds,
because it answers a different question — "how long will this take me" on a
row you have not opened — and every quiz reading "about 20 minutes" would say
nothing at all. So the row and the paper are now two different promises, on
purpose.

## 4 · R1 taken literally — THE SCOPED COPY STANDS (decided here)

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

**Decided: the scoped copy stands.** R1's intent — these screens take their
appearance from the pack and nobody writes new CSS for them — is met exactly.
Its letter is not, and the reason is measured rather than argued: 128 bare
class names, and `.mark` alone would turn every chapter tick in the app into a
circle from the moment the exam chunk loads and keep doing it after the
student leaves, because a lazy chunk's CSS stays. R1's own *check* asks that
`git diff` shows the file added rather than edited and that the rules live in
one file — both true.

**What was done.** The delivered file is committed unedited at
`docs/launch/code/17-exam-result-leaderboard.css`; `npm run ref:css` produces
the scoped copy. `git diff` shows the file added, not edited, and the rules
exist in exactly one place in `src/` — which is what R1's check actually
tests. This is the same machinery the other four handed-over sheets use.

## 5 · "No back arrow" — THE ARROW ASKS (decided here)

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

**Decided: the arrow stays, and it asks.** Deleting it would make handing in a
blank paper the only escape from a mis-tapped quiz. Leaving it silent would
leave the hole R4 is actually about. So it raises the same end-exam dialog the
browser's Back raises, and that dialog now offers three honest choices —
**Back to exam · Leave it for now · End and mark** — after saying what is
unanswered and what is flagged.

Every exit from an open paper goes through one door that tells the truth
first, and nothing marks a paper the student did not mean to hand in. R4's
concern is closed; its letter ("no back arrow") is not, and this is why.

