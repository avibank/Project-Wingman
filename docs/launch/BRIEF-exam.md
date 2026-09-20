# Exam, result and leaderboard — exact port

Base build: the live site as it stands. Nothing outside the quiz taker, the
result screen and the new leaderboard changes. If a step here needs a change
somewhere else, stop and say so rather than making it.

**The files in this folder are the deliverable, not an illustration of it.**
Copy them in. Don't retype them, don't reformat them, don't "improve" them
while copying. Past ports drifted because the screen was rebuilt from a
description; this one is a copy with a check that fails when it isn't.

| File | What it is |
|---|---|
| `wingman-exam.css` | The whole stylesheet for these three screens. Copy verbatim, import once. |
| `exam-markup.jsx` | The exact element tree and class names. Wire data to it; change nothing else. |
| `stamp.js` | The stamp — one implementation, used everywhere a stamp appears. |
| `exam-port.check.js` | Paste in the console on the live screens. Prints PASS/FAIL per rule. |
| `reference-demo.html` | The reference. Open it beside the live site and compare. |

---

## R1 · The styling is a copy, not a rewrite

- **Rule:** These screens take all their appearance from `wingman-exam.css`.
  No new CSS for them anywhere else, no inline styles beyond the three the
  markup already sets (`--i`, `--n`, and the meter/route widths).
- **Mechanism:** `wingman-exam.css` is committed as delivered and imported
  once, after the base styles. `reference-demo.html` is committed to
  `reference/exam-flow.html` so later changes can be diffed against it.
- **Check:** `git diff` on the stylesheet shows the file added, not edited.
  Searching the repo for `.exam-bar`, `.qcell`, `.lb-row` or `.stamp` finds
  rules in exactly one file.

## R2 · The exam owns the screen

- **Rule:** While a quiz is open, `<html>` carries `data-screen="exam"`, and
  it is removed when the student leaves. That flag is what turns off the
  finish scenery and switches the surfaces to matte.
- **Mechanism:** `useExamScreen()` in `exam-markup.jsx`, mounted by the quiz
  route. If a separate element paints the Aurora or Manual backdrop, hide it
  in the marked spot at the top of `wingman-exam.css`.
- **Check:** On the quiz, `document.documentElement.dataset.screen` is
  `"exam"`; leaving the quiz clears it. Aurora and Manual show no stars, bands
  or ruled lines behind the exam.

## R3 · Appearance comes from the livery and the stamp ink, nothing else

- **Rule:** Every colour on these screens derives from the live `--active`
  token, except: the flag red, and each student's stamp ink. No hard-coded
  colours.
- **Mechanism:** The token block at the top of `wingman-exam.css`; inks come
  from `STAMP_INKS` in `stamp.js`.
- **Check:** All six liveries × light and dark, plus Aurora and Manual, with
  nothing that shifts hue independently. The check script's "panels use
  --panel" and "stamps use personal ink" lines pass.

## R4 · You can only leave an exam by ending it

- **Rule:** Once started, the exam screen has no way out but **End exam**,
  which asks first and says what is unanswered and what is flagged. No back
  arrow, no Ready Room, no profile, no links of any kind on the page.
- **Mechanism:** `ExamTopbar locked` renders the wordmark and "Exam in
  progress" only. The route blocks in-app navigation while `phase !== 'result'`
  and routes browser back to the end-exam sheet instead of leaving.
- **Check:** The check script's "locked" lines pass. Pressing browser back
  during an exam shows the end sheet and stays on the page.

## R5 · Ranking is score, then real time, worked out on the server

- **Rule:** Rows rank by score descending, then by time ascending. Time is
  `submittedAt − startedAt` in real seconds, decided server-side, never from
  the countdown in the browser.
- **Mechanism:** One ranking function, server-side, fed by the attempt's
  `startedAt` and `submittedAt`. The client only formats. The fixed exam clock
  is 20 minutes for any quiz up to 40 questions.
- **Check:** A unit test on the ranking function covering: equal scores split
  by time; a faster but lower score ranking below; an unfinished attempt never
  appearing. In the browser, the check script's "sorted by score desc then time
  asc" line passes.

## R6 · Every run is a row; every row is a stamp and a name

- **Rule:** The board lists runs, not people. One account can appear several
  times under different callsigns, each ranked normally. Every row reads
  `[account] callsign`, with that run's stamp beside the rank. Board scope is
  everyone on the module.
- **Mechanism:** `Leaderboard` in `exam-markup.jsx`, fed a sorted array of
  runs. Callsigns are per run, stored with the attempt.
- **Check:** Two runs from one account appear as two ranked rows with the same
  account name. The check script's row-shape lines pass.

## R7 · The stamp is identity and behaves like it

- **Rule:** One mark per student, built from their callsign initials, their
  ink and their shape. Large and pressed on the result, small and still on
  every board row. Same component everywhere — including the lesson sign-off
  when that lands.
- **Mechanism:** `stamp.js`. Nothing else may draw a stamp.
- **Check:** Searching the repo for `feTurbulence` or `stampSvg` finds one
  file. Changing a student's ink changes the mark in both places at once.

---

## Verify before calling it done

1. Open `reference-demo.html` beside the live site at the same width and
   compare the exam, the end sheet, the result and the board.
2. Run `exam-port.check.js` on the exam screen and on the result screen. Every
   line must read PASS.
3. Repeat at three widths — about 1200px, 800px and 400px.
4. Repeat in all six liveries, light and dark.
5. Anything that can't match, list it and stop. Don't approximate it.
