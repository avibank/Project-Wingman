# Brief — quiz stamps

Stamps appear in two more places: the board you see after finishing a quiz, and
the quiz rows in the Library. Reference build: `reference/03-quiz-stamps.html`
(artifact "Quiz Stamps" — open it, the toggles in the bar show the rejected
version as well as the agreed one). Code: `code/18-quiz-stamps.js` and
`code/19-quiz-stamps.css`.

**Both screens are built on the module sheet's own stylesheet** — the one behind
Lessons, Library and Crew. Full-bleed rows on hairlines, one gutter, no card
around the board, no shadow, type carrying the hierarchy. `19-quiz-stamps.css`
adds to that sheet and introduces no new token. If you find yourself wrapping
the board in a panel with a radius, you are on the wrong base.

---

## Rule 1 — a stamp belongs to the person, not the run

**Rule.** A stamp is looked up by account. The same person taking a quiz three
times has one stamp, not three.

**Mechanism.** `stampFor(account, size, rot)` in `18-quiz-stamps.js` is the only
way a stamp is drawn on either screen, and it takes an *account*. It calls
`inspStamp()` from `05-stamp-engine.js`. Nothing on these screens draws SVG by
hand or caches a stamp against an attempt row.

**Check.** Grep both screens for `inspStamp(` — every hit must be inside
`stampFor`. A second call site means someone has bypassed the rule.

---

## Rule 2 — your stamp leads the result, at the weight of the headline

**Rule.** The circled plane glyph is gone. The person's own stamp sits at the
head of the result at **132px**, rotated -6°, in the column beside the headline
— not a small icon above it. It is the first thing on the screen and it holds
its own against the heading; the two share the optical weight.

**Mechanism.** `resultIcon(me)` with `RESULT_STAMP_PX = 132`, inside `.res`,
a two-column grid (`auto minmax(0,1fr)`) that collapses to one column under
620px. No ring, no border, no plate behind it — the stamp carries its own
outline.

**Check.** No `<path d="M21 16v-2l-8-5V3.5` anywhere. At 1100px the stamp's
height is within about 10% of the headline block's height; if the stamp reads as
an icon rather than as the subject, it is too small. A user who has not issued a
stamp yet gets an empty slot, not a fallback plane — see the open question.

---

## Rule 3 — on the leaderboard, one stamp per person, on their best run

**Rule.** Every run keeps its row, its rank, its score and its time. The stamp is
drawn at 42px in a column between the rank and the name, only on an account's
first row in board order — which, because the board is
sorted on score then time, is that person's best run. Later rows by the same
person keep an empty 38px slot and take the word "again" after the callsign.

**Why.** Twelve runs on the reference board come from nine people. Stamping every
row makes it look like twelve people finished. Removing the repeat rows would
lose real runs. Keeping the row and dropping the stamp says both things at once.

**Mechanism.** `boardRows()` walks the sorted list once with a `Set` of seen
account ids. The de-duplication is at render time. The query still returns one
row per attempt — do not `DISTINCT` it in SQL, the board needs every run.

**Check.** Board with a repeat: the repeated row has `.br__st.rep`, an
empty slot, and `.br__ag`. Count of rendered stamps on the board must equal the
count of distinct account ids, not the row count.

---

## Rule 4 — in the Library, up to eleven finishers, most recent first

**Rule.** Each quiz row carries a line of finisher stamps underneath: one per
person, ordered by their most recent finish, at most eleven. Anyone beyond eleven
becomes `+n`. Then the count in words — "14 finished". A quiz nobody has taken
says "Nobody has taken this one yet" — never an empty strip.

**Mechanism.** `finishers()` sorts by `finishedAt` descending and keeps the first
attempt per account; `finisherLine()` slices to `STAMP_CAP` and renders the
remainder. `STAMP_CAP = 11` is declared once at the top of the file.

**Check.** A quiz with fourteen finishers shows eleven stamps, `+3`, and
"14 finished". A quiz where one person finished twice shows them once. An
untouched quiz shows the sentence.

---

## What this assumes about the data

Two shapes, named to match whatever the real models are called:

- `account { id, name, stamp }` — `stamp` is the record the licence editor issues
- `attempt { accountId, callsign, score, seconds, finishedAt }` — one row per run

`finishedAt` is the only new field the board does not already need. If attempts
are not timestamped, Rule 4 cannot be implemented as written — say so rather than
substituting insertion order, because insertion order is not recency once rows
are backfilled or re-imported.

---

## Still open — decide before building

1. **A person with no stamp yet.** During the beta most accounts will not have
   issued one. The reference build does not cover this. Options: an empty slot,
   the un-inked default outline (`inspStamp(false, …, DEFAULT_STAMP)`), or their
   initials. Ask before picking.
2. **Your own place in the Library line.** It currently sorts purely by recency,
   so your stamp moves as other people finish. Pinning yours first is a one-line
   change to `finishers()`.
3. **Rim text at this size.** At 34–38px the rim lettering is a blur; the shape,
   the colour and the three-character code carry it. That is the same bet the
   chapter wall already makes, so it is consistent — but it is a bet.
