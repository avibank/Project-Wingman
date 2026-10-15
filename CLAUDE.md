# Wingman — Claude Code Project Brief

## What this is

A subscription-based Part-66 Aircraft Maintenance Engineering (AME) study platform for
aircraft maintenance students, modeled on UULA. Live at wingman.institute, deployed via Vercel,
repo at avibank/Project-Wingman on GitHub.

Aviation-themed naming is a deliberate, consistent design choice throughout — it's for
AME students, not pilots. Vocabulary rules changed in the most recent design pass: see
"Voice" below before adding any themed copy.

## Tech stack

- React 18 + Vite
- Clerk for all authentication (email verification, Google OAuth, admin roles via
  publicMetadata.role="admin") — this is the authoritative auth layer
- Supabase for all shared data. Clerk owns identity; there is no parallel user table.
  `user_id` columns hold the Clerk id as `text`, never a Supabase auth uid.
  RLS is enabled on every table with open `using (true)` policies, because the Supabase
  client is anonymous from Postgres' point of view and access control happens in the app.
- Vercel for deployment; GoDaddy for DNS

## Critical architecture notes

- App.jsx is split into outer App (ClerkProvider + UserProgressProvider) and inner
  AppInner. Never call Clerk hooks outside the ClerkProvider tree — this caused a real
  production crash once.
- Navigation: `view` is "hub" or "module". There is no global tab bar. Home (Flight Deck)
  is the module launcher; selecting a module opens its hub, whose own tabs are
  Chapters / Library / Social. Compete was built then deliberately deleted.
- Progress writes are **patch-only** through the `merge_progress` RPC, and read through a
  single `UserProgressProvider`. Do not reintroduce whole-object upserts of
  `user_progress.data` — see NOTES.md, "The progress clobber", for what that caused.
- Content is partitioned by module code prefix. `chaptersForModule()` and
  `pdfsForModule()` in data.js are the single source of that partition. Anything that
  reads the global `CHAPTERS` or `PDFS` array directly is a bug waiting to surface —
  both the chapter list and the Library have already had exactly this bug.
- **An `enrollments` table exists, and nothing uses it.** This line used to say
  there was no such table, "verified on 2026-09-02 by querying the live
  database". That was wrong. It was found on 2026-09-21 while deleting three
  accounts: `id, user_id, module_code, enrolled_at`, three rows, for modules
  `JT` and `PROP`, which date it to the prototype before M1-M4. It is in no
  migration and no client code reads it. All four modules are open and
  nothing is gated. It is **empty** now, and left standing because migrations
  never drop a table. What a student studies is derived from
  `chapter_completions` and `lesson_threads` instead — see `my_modules` in
  migration 0011.

## Content

**MODULE 13d IS TEN BATCHES, REWORKED** (owner, 2026-10-12: "i will refeed you
the batches i need them updated and wipe all attempts"). All twenty documents
came again — a Quiz and a Full Set for each of ten batches — under ids that
had never existed, `M1.V1` to `M1.V10`. The ten before them were `M1.T1` to
`M1.T10` (2026-10-08), and before that M1.B1/M1.B6 and M1.01-M1.03.

| batch | id | ref | pages | quiz | cards | paper |
|---|---|---|---|---|---|---|
| 1 | M1.V1 | 13.1 | 1–63 | 40 | 105 | 18pp |
| 2 | M1.V2 | 13.3 | 64–155 | 40 | 306 | 47pp |
| 3 | M1.V3 | 13.3 | 156–231 | 40 | 272 | 42pp |
| 4 | M1.V4 | 13.3 | 232–321 | 40 | 293 | 44pp |
| 5 | M1.V5 | 13.6 | 322–448 | 40 | 265 | 43pp |
| 6 | M1.V6 | 13.8 | 449–562 | 40 | 274 | 43pp |
| 7 | M1.V7 | 13.8 | 563–650 | 40 | 232 | 36pp |
| 8 | M1.V8 | 13.8 | 651–767 | 40 | 271 | 39pp |
| 9 | M1.V9 | 13.8 | 768–917 | 40 | 390 | 57pp |
| 10 | M1.V10 | 13.8 | 918–1008 | 40 | 208 | 33pp |

**THE FIVE MOCK DOCUMENTS WERE REPLACED THE SAME DAY** (owner: "the same
files, just updated and corrected… just replace them"). Same five ids, same
forty questions each, same 7pp: **71 of the 200 questions changed — 51 stems,
47 option sets, 5 explanations — and ZERO answers**, spread still 14/13/13 to
the paper. Nobody had attempted them and that was CHECKED rather than taken on
trust — 0 board runs, 0 saves, 0 completions and 0 progress documents
mentioning `M1.M%`, read off the live database.
`supabase/reset-mock-exams-progress.sql` is the server half, scoped to
`M1.M%` and deliberately **not** `M1.%`: the ten V-batches in the same module
carry 3 board runs and 15 saves of real work and none of it was being
replaced. It ran, deleted nothing, and its own verification block confirmed
the mocks clear with the V-batch runs standing.

- **AND THE STORAGE EPOCH WAS NOT RAISED, which breaks the pattern of every
  reset before it.** The epoch is the DEVICE half and it sweeps every `pw-`
  key that is not a preference, for EVERY module, `pw-hobbs` included. There
  was no mock progress anywhere to sweep, and progress writes are patch-only
  and immediate, so a device cannot hold a score the server has never seen.
  Raising it would have swept three students' live V-batch state to guard
  against something that does not exist. The SQL's header carries the rule:
  **if that script ever deletes a row, raise the epoch in the same commit.**
  An in-flight paper is protected either way — `quiz.js` hashes what the
  questions SAID and `paperOf` refuses an attempt that no longer matches.

**AND FIVE MOCK EXAMS WENT ON THE END ON 2026-10-15** (owner: "those are mock
exams that cover the whole subject", "name them in letters from a to e
spanning 1 to 5"). `M13D Mock Exam 1.pdf` is Mock Exam **A**, `… 5.pdf` is
**E**; the module is `batches: 15, mocks: 5`.

| mock | id | batch | quiz | cards | paper |
|---|---|---|---|---|---|
| A | M1.MA | 11 | 40 | the quiz's own | 7pp |
| B | M1.MB | 12 | 40 | the quiz's own | 7pp |
| C | M1.MC | 13 | 40 | the quiz's own | 7pp |
| D | M1.MD | 14 | 40 | the quiz's own | 7pp |
| E | M1.ME | 15 | 40 | the quiz's own | 7pp |

**THE LETTER IS A LABEL; THE BATCH IS STILL A NUMBER.** `batch` orders the
rows, places the waypoint, is what `pw-batch` remembers and is what
`Number.isFinite` admits to the Library at all — a letter in that field would
have to be parsed back into a position by everything that touches it. So
11–15 ARE 11–15 and `batchLabel` in `batchModel.js` is the ONE function every
surface calls, so the row, the waypoint and three aria-labels cannot disagree.
Past the 26th mock it falls back to the figure rather than inventing "AA".

**THE MODULE SAYS HOW MANY ARE MOCKS, NOT THE CHAPTER**, and that is the whole
reason `mocks` is module-level: the strip draws a waypoint for every batch the
module WILL have, so 11–15 have to read A–E before there is any chapter to
ask. `mocks` is the count of TRAILING batches that are mocks.

**THERE ARE TWO IMPORTERS, FOR TWO DOCUMENT SHAPES, and neither is dead.**
`scripts/batches/` reads a Quiz plus a Full Set and is what built the ten;
`scripts/mock/` reads a single file that carries the paper, its questions and
the key, and is what built these five. Both classify by geometry and both
REFUSE rather than guess. `scripts/mock/census.mjs` is the step to run first
on any new shape: it tallies x and height across EVERY file before a line of
parser is written, and on these five that is what found an option-continuation
band at x=93 that one document would not have shown.

**AND THE 8.5pt TRAP WAS PAID FOR ONCE AND NOT TWICE.** The V-batch import's
blanket `near(h, 8.5) continue` ate 92 explanations in silence; `scripts/mock`
was written with the same skip for the key's subheading, so it was changed to
the lesson that note records — **a continuation is known by its INDENT, not by
its height**, and the subheading is skipped only at its own column and only
before a single key row has been read. Checked mechanically afterwards rather
than by reading: 200 explanations, none truncated, none empty, and the output
byte-identical before and after the hardening, so nothing had been eaten here.

**ONE DOCUMENT CARRIES ALL THREE THINGS.** The ten numbered batches came as a
Quiz and a Full Set; a mock is a single file holding the paper, its forty
questions and the key. So the quiz comes out of it, the card set is LEFT to
fall back to those same questions (`content.cardSet` does that for a chapter
with no `cards`) and the file goes on the Papers shelf — which is why Quiz and
Cards both read 40 on a mock row, and why the cards total is 2,816 rather
than 2,616 plus a new set.

**A MOCK'S ROW SAYS ITS NAME AND NOTHING ELSE** (owner: "it should say just
mock exam, nothing else"). "Batch 11" is the one thing it must not read — a
mock is not the eleventh slice of the manual — and the ref and page range that
LOCATE a normal batch have nothing to locate. Both are still printed if a
document ever carries them.

**THE STRIP RESIZES TO THE COUNT, AND TEN IS PIXEL-IDENTICAL AFTERWARDS.**
`1fr` is `minmax(auto,1fr)` and that auto floor is the waypoint's own width,
so fifteen 22px dots ran **36px past the right edge at 390 and 66px at 360**,
dots touching. `minmax(0,1fr)` lets a track shrink; the dot then sizes itself
from `--n` and the strip's own container query, down to a 14px floor, keeping
the demo's 2px of air; and the dashed rule is worked out from the same cell
width instead of the 5% that is half a cell only when there are ten of them.
Measured at 1280/820/620/500/390/360: **ten batches reads 28/28/22/22/22/22 at
11/11/10/10/10/10 with a 2.6px gap at 360 — the demo's own numbers** — and
fifteen shrinks only where there is no room (28/28/22/22/16.4/14.4), never
clipping. Two of my own bugs were caught by those numbers rather than by
reading: `100cqi` is already the content box and I took the padding off twice
(a ten-batch phone dot went 22→20), and the dashed-rule override tied on
specificity and lost on load order, exactly as the `.card .route` note three
rules above already warns.

**NOTHING WAS RESET, and that is the difference from every replacement before
it.** This is purely ADDITIVE: no existing chapter id changed, no existing
question moved, so every attempt's question hash still matches and every
score, save and board run stands. `STORAGE_EPOCH` stays **5**. The reset SQL
was not run and must not be.

**400 quiz questions, 2,616 cards, 10 papers** — the same 400 questions, and
332 fewer cards: every batch came back trimmed. The previous set was 2,948.

**THE IMPORTER IS IN THE REPO NOW** (`scripts/batches/`), where it was a
one-off before. `lines.mjs` pulls every line out with its x and its height
through the repo's own pinned pdf.js; `import.mjs` classifies by that geometry
and refuses rather than guesses; `build.mjs` puts the result into the content
document and the papers on the shelf, reading each paper's page count out of
the file. All twenty came out with **zero warnings**, 3,016 items, every id
unique, and the spread near a third each — quizzes 14/13/13 to the batch,
card sets from 70/69/69 to 130/130/130.

- **A BLANKET "SKIP THIS HEIGHT" RULE ATE 92 EXPLANATIONS IN SILENCE.** A key
  row's tail — "(L3, PDF p. 38)" — breaks onto a continuation line at **x=91
  h=8.5**, not h=9, and the importer's `if (near(h, 8.5)) continue;` for meta
  lines swallowed every one of them. The documents still read, every count
  still tallied, the spread was still a clean third, and 92 explanations
  simply ended at "(L3, PDF p." — with NO warning, because a catch-all skip
  is exactly how "report, never assume" gets defeated. Caught by checking all
  3,016 items mechanically for a surviving `(L…, PDF p.` tail rather than by
  reading any of them. The test is the INDENT, which only a continuation has;
  the height is allowed to be either, and the meta skip is pinned to x=60. The names are the documents'
own — batches 2-4 are all "Autoflight (ATA 22)" and 6-10 all "Instruments (ATA
31)", which is what the syllabus says; a row prints the name, the ref and the
page range, so three batches sharing a subject are still told apart. Batch 5's
name spans two sections because its document's own subtitle does.

**THE IDS HAD NEVER EXISTED, AND THEY WERE CHECKED RATHER THAN ASSUMED.** Every
chapter id this file has ever carried was listed out of git history first —
`M1.01`, `M1.02`, `M1.03`, `M1.B1`, `M1.B6`, `M1.P1`-`M1.P7` — because ids are
positional inside a chapter and a reused one silently inherits whatever any
device still remembers about the old one.

**THE PAGE RANGES TILE THE MANUAL, AND THAT IS WHAT CAUGHT THE EXTRA FILES.**
1–63, 64–155 … 918–1008, no gap and no overlap. Downloads also still held the
SUPERSEDED Batch 1 (pages 1–68) and Batch 6 (pages 352–491), whose ranges
overlap these — taking "every M13 file in the folder" would have built twelve
batches out of ten. The importer names its twenty explicitly and refuses if a
batch's Quiz and Full Set disagree about the name or the range.

**READ BY GEOMETRY, NEVER BY PROSE.** These are the October shape: stems at
x≈60 h=10.5, their wraps at x≈78, options at x≈82, every continuation at x≈91
or beyond, key rows at x≈60 h=9, headings at h=20/15/11/10/8.5, and the running
header and page number past x=200. **Anything the converter cannot place is
REPORTED, never assumed** — all twenty came out with zero warnings. The level
and the manual page are lifted out of "(L3, PDF p. 24)" rather than shown to a
student inside the explanation.

- **THE HEIGHT TOLERANCE HAS TO BE TIGHTER THAN THE GAP BETWEEN TWO MEANINGS.**
  These documents step in halves — 20, 15, 11, 10.5, 10, 9, 8.5 — so a window
  of 0.6 makes every stem (10.5) match the subtitle (11) and the level heading
  (10). It did: 152 warnings out of one file and nothing read at all. 0.2
  cannot reach the next meaning along.
- **THE KEY IS NOT ALWAYS A SECTION AT THE END.** A Quiz carries one "Answers"
  heading (h=15) with the per-topic blocks under it; a Full Set has NO such
  heading and puts an "Answers — <topic>" block after each topic as it goes.
  Assuming the first shape read 160 questions and answered none of them. What
  hands over from questions to a key is the "Answers — …" line itself.
- **The opening blurb and the key share a height.** Both are x≈60 h=9, and only
  WHERE they are tells them apart: the blurb is the prose before the first
  topic heading. The count to trust is the document's own ("160 questions"),
  not a topic's meta line, which gave 9.
- **Spot-check the answer spread**: near a third each across a/b/c. The
  quizzes came out 14/13/13 and the sets from 54/53/53 to 139/139/139.

**THE RESET AND THE PUBLISH BOTH RAN AGAIN ON 2026-10-12**, in the order the
epoch requires: merge, deploy, reset, publish. The deploy has to come FIRST
because `STORAGE_EPOCH` is the device half — an un-swept browser holding
`pw-quiz-scores` for a chapter that no longer exists patches it straight back
on its next load. Confirmed the deploy had landed by fetching a paper off the
live site and matching its length against the new file (203,831 bytes, where
the one it replaced was 282,593) rather than waiting on a status that never
appeared.

Measured rather than asserted: **4 board runs, 14 saves and 2 progress
documents went**, and **hours flown stayed at 6 documents**, which the runner
checks and refuses to let change. `STORAGE_EPOCH` is **6**. The document was
published as **course version 14** (from 11) and read back through
`current_course()`: 10 chapters M1.V1-M1.V10, 400 quiz questions, 2,616 cards,
10 papers, and all ten papers answered `%PDF-` from the live site before the
RPC ran.

`scripts/batches/reset.mjs` is the runner, and it counts BEFORE as well as
after, so the paragraph above is a measurement rather than "it ran".

**SUPABASE PREVIEW NOW FAILS ON MAIN, AND IT IS NOT THIS.** Its branch
database replays the whole series into an empty project and hits `policy
"lesson_notes_no_bulk_read" for table "lesson_notes" already exists` —
0009 creates it unguarded and `ALL.sql` carries it too, so the two together
collide. Production is untouched; it is the preview that cannot rebuild. The
fix is an `if not exists` guard or a drop-first in 0009, and it is NOT done.

**THE RESET AND THE PUBLISH BOTH RAN, and a commit is neither.**
`supabase/reset-module-13d-progress.sql` is scoped to `M1.%` and safe to run
twice, so it took M1.B1 and M1.B6 with it while the new ids, which no row
mentioned yet, were untouched: 2 board runs went, and afterwards 0 rows
anywhere point at an M1 question, card or paper. **Hours flown stayed** — 5
documents still carry `pw-hobbs` for M1, deliberately. `STORAGE_EPOCH` is **5**.
The document was published as **course version 11** and read back through
`current_course()` to confirm: 10 chapters, 400 questions, 2,948 cards, 10
papers. 1.26MB over the wire in 1.3s, well inside the four-second timeout that
would otherwise fall back to the bundled copy.

**`npm run publish-course` IS THE WAY IN NOW** (`scripts/publish-course.mjs`).
It refuses a malformed document before the RPC and **checks every paper is
actually on the other end first, by reading the first five bytes** — this app
answers every unknown path with index.html and a 200, so a status check calls
every missing paper present. Then it reads the document back and compares.

`src/data.js` — **four** modules, M1 to M4, and no chapters. The codes never
change (progress, scores and saves are keyed to them); the NAMES are the
course's: **M1 is Module 13d** (the one the class is on, and the app's default
current module because it is the first `active` one), **M2 is Module 13e**,
**M3 is still "Module 3"** (undecided) and **M4 is Module 10**.

`src/content/test-content.json` — the content document, despite its name. It
is loaded by the `content.test` flag, which is `everyone: true` (label
"Course content"); the id kept its old name so nothing that reads it had to
change. It repeats the four module names, and they must agree with data.js,
which is what the Flight Deck draws before the document arrives. It is 1.89MB
now (1.86 before the five mock exams) and its built chunk is 1.21MB (294KB gzipped), lazy and off first paint.

**What went before this**, if any of it is ever wanted back
(`git log -- src/content/test-content.json`): M1.B1 Theory of Flight · Rotary
Wing (40 + 170, pages 1–68) and M1.B6 Instruments (40 + 416, pages 352–491),
which themselves replaced M1.01-M1.03 on 2026-10-03.

### What the next batch has to carry

`src/data.js` — **four** modules, M1 to M4, and no chapters. The codes never
change (progress, scores and saves are keyed to them); the NAMES are the
course's: **M1 is Module 13d** (the one the class is on, and the app's default
current module because it is the first `active` one), **M2 is Module 13e**,
**M3 is still "Module 3"** (undecided) and **M4 is Module 10**.

`src/content/test-content.json` — the content document, despite its name. It
is loaded by the `content.test` flag, which is `everyone: true` (label
"Course content"); the id kept its old name so nothing that reads it had to
change. It repeats the four module names, and they must agree with data.js,
which is what the Flight Deck draws before the document arrives.

- **GIVE NEW CHAPTERS IDS THAT HAVE NEVER EXISTED.** Ids are positional
  inside a chapter (`M1.02.Q7`, `M1.02.C014`) and a reused id silently
  inherits whatever any device still remembers about the old one. Nothing in
  the app parses a chapter id for a number — `chapterNo` comes from the
  chapter's POSITION and `chaptersForModule` only splits on the first `.` —
  so `M1.B1` is as valid as `M1.01` and cannot collide with anything that
  came before.
- **THE COURSE WAS REPUBLISHED ON 2026-10-06 AS VERSION 10, and that is what
  put the ported Library in front of the owner.** The port added `batch`,
  `ref`, `pages` and `batches` to `src/content/test-content.json` — but
  `course_docs` is what the live app reads, and a commit does not publish, so
  the live document still had none of them. `batchesOf` keeps a chapter only
  when `Number.isFinite(c.batch)`, so the fallback added the same day did
  exactly what it should and drew the old shelves ("WE ARE BACK TO OLD
  SCREEN?"). Nothing about the content changed: same chapter ids, same 40 and
  40 questions, same 170 and 416 cards, same two papers — so no reset, and
  every attempt's question hash still matches.
  - **AND THE CHAPTER NAMES WENT BACK TO THE OWNER'S.** Stage one of the port
    shortened them to "Theory of Flight" and "Instruments", moving the rest
    into `ref` — which is class-facing wording this file protects by name
    ("The chapter NAME stays the subject"). They are "Theory of Flight ·
    Rotary Wing" and "Instruments (ATA 31)" again. Batch 6 has no `ref` now:
    its name already carries ATA 31 and the row prints name and reference on
    consecutive lines.
- **AND THE SAME TREATMENT, SCREEN BY SCREEN** (owner, 2026-10-06: "apply
  the same"). What that turned out to mean, measured rather than assumed —
  heading size and content column at 1440/900/600/390:
  - **The Flight Deck's title was the one page title in the app that never
    moved**, a flat 32px at every width (`.deck .title` in Home.jsx). It takes
    the module's scale now, so the two page titles grow and shrink together:
    40/40/36/32.
  - **Bookmarks already responds** (44 to 32), and its sheet is a signed-off
    pack.
  - **The Ready Room's 32px and the Licence's 30px are left alone, and that
    is deliberate.** `ready-room.css` is the design's stylesheet kept as sent,
    with exactly two marked changes and `check:rr` holding it; the licence's
    `.ptitle` is `calc(30px * var(--scale,1))`, which already scales with the
    student's own font-size preference, just not with the viewport. Both are
    approved designs that state a fixed size; overriding them is a design
    decision rather than a layout fix.
  - **THE LESSON IS A `.mscreen` TOO, and the module's column nearly squeezed
    it.** `LessonPage` renders `<div className="mscreen lessonpage ref-les">`
    and is drawn to a different width — `--wrap: 1010px` in ref-lesson.css —
    with a 16:9 player sized against it. A bare `.mscreen { max-width: 760px }`
    took 300px off that player. The rule is on `mscreen-mod` now, a class
    `ModuleScreen` carries and the lesson does not.
- **THE WAYPOINTS WERE NEVER CIRCLES, and that was the whole thing.** The
  build styles its controls as DRAWINGS — a 28px waypoint, a tile that is a
  thumbnail over a label. This app styles every control as a TARGET: §12,
  enforced globally in App.jsx, `.app button:not(.is-inline){min-height:44px}`.
  **`min-height` beats `height`**, so every waypoint has been **28x44** since
  stage one of the port. They were ovals in every screenshot. That is why the
  rail never read as a track — and it is what SIX rounds of widening, capping,
  scaling and re-shaping this screen were actually chasing. Measured, not
  guessed: `22x44`, with `.app button:not(.is-inline)` named as the winning
  rule.
  - The port carries `wm-port` and the floor is undone inside it, once:
    `.app .wm-port button:not(.is-inline) { min-height: 0 }`. **The app's own
    selector with the port's class in front** — (0,3,1) against (0,2,1) — so
    it wins on specificity rather than on load order.
  - **ONLY THE FLOOR**, not the app's button styling wholesale. Clearing
    padding, border, background and font too is right when the build's own
    rules are re-applied above at higher specificity, and wrong here: this
    port's rules are `.lib2 .lb-*`, (0,2,0), weaker than such a reset — a
    blanket one took the tile's own padding, border and background with it and
    the tile collapsed to 215x47. One property was all that ever reached in.
  - §12 is not weakened anywhere else. A waypoint is a drawing inside a row
    that is itself the target.
  - **Everything I had invented to compensate is deleted**: the tile-as-a-row,
    the 22px waypoints at width, the per-drawing container scale steps, the
    `zoom`, the wide column. The screen is the build's own 760px column again
    and the build's own `@media (max-width:620px)` block is ported for a
    phone. Diffed against the build at 1280/820/390: card 760x520 against
    760x521, waypoint 28x28, number 44x44, tile 215x145 against 215x144,
    stage 128x84, thumbnail over label at every width.
  - **The sequence, so nobody walks it again**: `1fr` tiles (drawing
    marooned) → cap the tile (three stranded left) → cap the screen
    left-aligned (block floating) → cap it centred (half the window empty) →
    scale the block (magnified) → wide and low (not the design) → **fix the
    leak and put every one of them back**.
- **THE SCREEN WAS PORTED AGAIN ON 2026-10-07, FROM A SECOND HANDOFF, and
  almost everything above about HOW is now reversed.** The brief is
  `docs/launch/BRIEF-MODULE-PORT.md` and the demo it points at is
  `docs/launch/reference/06-library-lessons-cards.html`, both committed. What
  it asks for is a copy, not a design: "If live code disagrees with the demo,
  the demo wins."
  - **THE STYLESHEET IS GENERATED, NOT HAND-WRITTEN.** `npm run ref:css` grew
    a `.wm-port` bundle beside the launch pack's four: it lifts the demo's
    whole `<style>` block, cuts the token blocks and the page reset BY NAME
    with a guard on each, maps the demo's token names onto this app's, and
    prefixes every selector. `src/components/module/library/port.css`, 353
    lines, 7 cuts. The sheet and the approved demo cannot drift, and a third
    demo is one more entry. **`batches.css` and `lessons.css` are deleted.**
    - **AND A GENERATED SHEET HAS NO MEMORY, which cost four rules on
      2026-10-11.** `ref-module.css` carried four HAND-EDITS made after it was
      generated — `a.lrow` and `.dl-list a.paper` undoing the browser's link
      blue (both rows really are links, for the middle click), `.ce-blk` which
      is `ModuleWaiting`'s and not the reference's, and the phone block that
      wraps the search field onto its own row (at 360 it was FIVE pixels
      wide). A run of `ref:css` for an unrelated bundle deleted all four
      without a word. Nothing could have caught it: the build passed, and the
      loss only surfaced because one of the four happened to be the thing
      `check:tokens` measures.
      - **All four live in the generator now**, in the module bundle's `tail`,
        beside the argument for each. `exam-port.css`'s lost edit went into
        its `vars` instead: the exam pack reads `--n` and nothing sets it, so
        a `var()` with no fallback made the whole `animation-delay` invalid
        and the student's own row flew in with the others. Declared `--n: 0`.
      - **`npm run check:ref-css` is the gate**, in `npm run check`: it
        regenerates all six bundles in memory and fails if a committed sheet
        differs by a byte, naming the file and the first differing line. A
        correction now has exactly one home. Proved by planting a hand-edit.
  - **AND THE CLASS NAMES ARE THE DEMO'S OWN NOW.** The first port renamed all
    twelve colliding names to `.lb-*` so the sheet could live under
    `.ref-mod`; §4 of the second handoff asks for the opposite — `.row`,
    `.head`, `.num`, `.title`, `.tile`, `.stage`, `.th` — so the markup can be
    read against the demo line for line.
  - **SO THE PORT HAS TO STAND OUTSIDE `.mscreen` AND `.ref-mod`, and that is
    the whole of §4.** Wrapping the body in `.wm-port` is not enough and
    raising its specificity is not enough either: those two scopes style
    twenty-four of the same bare words, including the app's OWN
    `.quiz-thumb__sheet i` and `.cards-thumb i`, and a descendant of either
    inherits every property the demo does not also declare. Measured:
    `.mscreen .route` turned the ten waypoints into a 483px column, and when
    specificity fixed `display` it still kept the app's `gap: 18px`. You
    cannot out-declare that list; you have to leave it. `ModuleScreen` returns
    the demo's own `.wm-port > .wrap` when the flag is on, and the app's
    module screen below it is untouched for everybody else.
  - **THE UNDO OF §12's FLOOR IS ON THE ROOT, NOT PREFIXED WITH IT.** Written
    `.app ROOT …` it expands to `.app .app .wm-port button` — a selector
    needing TWO nested `.app` elements, so it matched nothing and the
    waypoints went straight back to 28x44. Specificity arithmetic has to be
    done on the EXPANDED selector, not on the template.
  - **AND THE DEMO'S `font: 15px/1.5` HAD TO GO BACK** with the cut body rule,
    the same line the launch pack's own bundles needed. Without it every line
    box was three to four pixels short: the card 516 against 527, a tile 140
    against 144, a tab 38 against 41.
  - **THE TILES WERE INDENTED UNDER THE TITLE, and the owner saw it**
    (2026-10-07, "move the tabs to be dead center with just a slither of
    boarder"). The first port's `.lb-tiles` carried
    `padding: 0 10px 14px 68px` — 68px being the number tile plus its gap — so
    the three drawings sat under the title with a sliver on the right. The
    demo is `4px 14px 16px` and §5 says it in words: "They are NOT indented
    under the title." **Measured against the ROW rather than against `.tiles`,
    which is the mistake that let it through the first verification**: 14 left
    and 14 right now, and the tiles are true thirds of the row (230/230/230 at
    1280), not stretched.
  - **CREW ON THE QUIZ REPLACES THE CREW TAB** on the ported strip (§3.2, §5):
    real stamps through the app's one renderer at the demo's 26px on a row and
    44px in the pop-out, ordered by the server (0038) with the student pinned
    first. Eleven then `+N` on the row, six on a phone. **The pop-out asks
    again uncapped**, because §5 says it fans in EVERY stamp while the row
    shows eleven. A quiz nobody has sat draws the demo's dashed circle and
    says "Be the first to take it" — §10 forbids naming an absence, which the
    demo's own title did.
  - **Measured against the demo at 1280, 820 and 390**: every element matches
    to the pixel. Two differences stated rather than hidden — the page gutter
    is the app's (62px a side at 820 against the demo's 16), and the quiz
    thumbnail is 75 against 73 on a font strut, inside a tile that matches.
  - **AND THE STUDY-CARD SESSION IS BUILT** (2026-10-08). `CardSession.jsx` is
    the screen, `cardSession.js` the rules — the house split, so the sets, the
    queue, the two piles and the fan are importable and `check:cards` drives
    them for real. It replaces the old cards page (`CardSetPage`, "Test
    yourself") on `/m/:moduleId/library/cards/:chapter` behind the same flag;
    `screens.jsx` branches and the old page keeps working for everyone else.
    - **NOTHING NEW IS STORED, and §7 needed no migration.** Got it is
      `markGot(id, true)`, Not yet is `markGot(id, false)`, both mark the card
      seen, and the bookmark is a `saves` row of kind "card" — the three stores
      that already existed. So "on close → `seen += got + again`" happens card
      by card as it is sorted, and an abandoned session keeps what it earned.
    - **THE MISSED PILE IS LIVE; THE QUEUE IS NOT.** The demo mutates
      `mem.missed` as each card is sorted and recounts the picker every render,
      so Missed fills up in front of you. Frozen at the door — which is how it
      was written first — the button stayed disabled for the whole session and
      there was no way to drill what had just slipped. `startMode` still runs
      only on an explicit switch, so nothing is renumbered under a student half
      way through a set. Only the counts move.
    - **IT IS PORTALLED INTO `.app`.** The session renders from the cards
      ROUTE, which sits inside the app's own scroller — and that scroller is
      also called `.deck`. A `position: fixed` overlay inside it is trapped in
      that stacking context: the overlay drew perfectly and the scroller took
      every click. The stamp creator solved the same problem the same way.
    - **AND THE DEMO'S `data-*` ATTRIBUTES ARE LOAD-BEARING CSS, not event
      hooks.** `.pk:not([data-dk])` is what collapses the two sets you are not
      studying to `max-width: 0`. Written with `onClick` and no attribute, all
      three matched the collapsed rule and the picker measured 8px wide against
      the demo's 88. Five rules key off it.
    - **THE CARD WAS INVISIBLE AFTER THE FIRST SORT, and the walk did not
      notice.** `sort` hides the real card with an inline `visibility: hidden`
      while the clone flies; the demo then rebuilds `#fc` with `innerHTML` and
      the style goes with the element, while React keeps the same node for the
      whole session. Every card after the first was unseeable — and the
      counter, the text and both decks all read correctly, because
      `textContent` reads a hidden node perfectly well. The walk asserts the
      card is hit-testable now, and that assertion was proved by planting the
      bug back.
    - **THE ACCENT READ AS WORDS TAKES `--active-text` IN DAY**, which is this
      app's own three-token rule. Measured across six liveries x night and day,
      and every failure was in Day: Got it at 3.55:1 on Runway, its count at
      3.96 on Sky — the exact number CLAUDE.md already records for the module
      picker. Only the words move; the ring and the mini cards' borders are
      marks and keep `--active`. Worst pair is 4.75:1 now.
    - **A selector built from the scope token can expand to `.app` twice.**
      `.app.theme-light ROOT` becomes `.app.theme-light .app .wm-port`, which
      needs two nested `.app` elements. The Manual-in-Day line was written that
      way and matched nothing from the day it was added. Spelled out now, and
      the substitution is textual so it reaches comments too.
    - `npm run check:cards` is **38 assertions** (no browser, in `npm run
      check`); `npm run test:cards` is **133**, including the three ways to
      turn a card over, the three ways to sort, the 110px flick either side of
      its threshold, that Not yet never comes round again, Escape peeling one
      layer at a time, the write-backs read back out of the progress document,
      and contrast across six liveries x night and day. It puts the student's
      skin back in a `finally`.
  - **AND IT IS ON FOR EVERYBODY** (owner, 2026-10-10: "turn it on"). The flag
    was admin-only with its own condition beside it — off "until the Library,
    the Lessons player and the study-card session are all in" — and all three
    are in. **Turning it on is what found the last bug in it**: the light on
    the route strip was meant to follow the batch you last opened, falling back
    to the first, and `ModuleScreen` was feeding `hereBatch` the LAST chapter
    as `currentChapterId`. That is a guess dressed as a fact — nothing marks
    which chapter somebody is on — so a student opening Module 13d for the
    first time landed on batch 10 of 10 with its drawer open. It only showed up
    then because every test until then had been run as an admin with a history;
    "a student who has opened nothing" was the case nobody had looked at.
  - **AND CREW IS DELETED** (owner, 2026-10-11: "remove"). `CrewTab.jsx`,
    `CrewEmpty.jsx`, `crew.css` and `lib/crew.js` are gone, with the tab, its
    count badge, its search placeholder, its place in the tab-slide order, and
    the two fetches App ran on every module load to feed it — a squadron roster
    and this student's completions, which nothing read any more.
    `/m/<code>/crew` redirects to the Library in ONE hop, because students have
    it in their history.
    - **`crew` MEANT TWO THINGS and only one of them went.** The Crew TAB is
      deleted; `social.crew`, the "My flight" preset on the Flight Deck and in
      Preferences, is a different feature and is untouched. Deleting by
      grepping the word would have taken the social presets with it.
    - **ITS PRIVACY ASSERTIONS MOVED RATHER THAN LAPSED.** `check:solo` read
      two rules off `crew.js` — an invisible profile is dropped, and it selects
      `invisible` in order to be able to. What replaced the tab is the attempt
      stamps, fed by `quiz_finishers`, and 0038 enforces the same two things in
      SQL. The assertions follow the feature onto the migration. Letting them
      lapse with the file would have cost exactly this: a student on Fly solo,
      or one who has blocked somebody, having their stamp drawn on a row in
      front of them with nothing in the suite to say so.
    - **"Invite your class" IS A LINE AT THE FOOT OF THE LIBRARY** (owner,
      2026-10-11: "put it"). Crew's empty state was its only door and Crew was
      deleted that morning, so it spent a day reached from nothing. The
      Library is where it belongs: the attempt strip on every batch row IS the
      class, so the line that ADDS to it goes under them. Once at the foot,
      not once per row, and hidden while searching like the rest of the foot.
      §10 holds — it names the action and never counts who is here.
      - **The sheet's own copy still said "they appear here on Crew"**, stale
        from the morning Crew went, and nothing caught it because a screen
        with no door is still a screen whose words can be wrong.
        `check:doors` carries `\bCrew\b` in its GONE list now, proved by
        planting the old sentence back.
      - **It is the one control in the port that keeps §12's 44px floor.**
        The port undoes the floor because the demo's controls are DRAWINGS
        inside a row that is itself the target; this one is a lone button in a
        line of prose. Measured as the port left it: 123x34.
      - **And on a phone it has to clear "Something's wrong here."** That pill
        is fixed bottom-LEFT and owns the bottom 56px on that side. Below 620
        the line wraps and the button drops to exactly where the pill is: at
        390x844 scrolled to the end they overlapped by 2952 square pixels and
        `elementFromPoint` at the button's own centre returned the PILL. 72px
        of foot room under 620, measured clear at 360/390/500/620/700/820/1280.
- **THE DEMO SHOWS THE PORTED LIBRARY, and only the demo** (owner,
  2026-10-06: it "showes the previus format ... for the libary").
  `resolveFlags` turns `library.batches` on inside the demo the way it
  already turns on `content.test`, because the approved tour's own words for
  that step — "each chapter's quiz, question bank and study cards are all in
  one place" — are the ported batch row tile for tile, and it was pointing at
  the three shelves instead. Nothing a student opens changes: the flag stays
  admin-only for the real app until the port's third stage is in, and the
  demo's course and database are its own.
  - The demo's course gained what that screen counts: a `batch`, a `ref` and
    a page range on every chapter, `batches` on every module, and **40 study
    cards across Module 1's four chapters** with `cardsName` on each. Without
    `cards` the set falls back to the quiz's own questions, so Quiz and Cards
    read the same number. The spread is 16/12/12 across a/b/c.
  - **The waiting screen is for a module with no video, not for whoever has
    the flag on.** `LessonsWaiting` says "video lessons are on the way",
    which is true of the course as it ships and false of the demo's twelve
    lessons — turning the flag on put that sentence over a class watching
    videos. The Lessons tab asks the module now (`hasLessons`), and the flag
    only decides which of the two screens answers. `check:states` holds it.
  - **A batch with no paper shows an em dash, not "0 pages".** `batchesOf`
    sets `pp` to 0 for a batch whose paper is not on the shelf — its own
    comment says the tile is shown disabled "rather than a made-up number" —
    and `PaperThumb` printed that 0 out loud, which §10 forbids. The hour
    meter settled the same question the same way. The tile is disabled
    either way, so it is not a door that goes nowhere, and its label says
    "not on the shelf yet" rather than naming a count.
- **A SCREEN BEHIND A FLAG FALLS BACK TO THE ONE IT REPLACES.** The ported
  Library draws a row per BATCH and `batchesOf` keeps a chapter only when
  `Number.isFinite(c.batch)` — so a course document written before the port,
  which is what `course_docs` serves until somebody publishes a new one, gave
  it an empty list and it rendered the empty list. An admin on the live site
  got the module header, the tab strip, and blank deck to the bottom of the
  window (owner, 2026-10-06). The header had the fallback all along —
  `batchSubtitle` returns `moduleSubtitle` when there is nothing to count —
  which is why that screenshot carried the OLD sentence ("2 quizzes, 2 card
  sets and 1 paper") over the NEW screen's empty body. `LibraryTab` takes the
  ported branch only `if (asBatches && batches.length)` now, so the two fall
  back together, and `check:states` holds that condition. A flag that turns a
  working Library into an empty one for whoever has it on is worse than the
  flag being off.
- **Chapters with no lessons show in the LIBRARY, not on the Lessons tab**,
  which draws its own "Lessons are filming" state. That is where a quiz and
  a card set live, so content with no video is not invisible.
- **`cards` on a chapter is optional and is the card set when present**;
  without it the card set falls back to the quiz questions as before.
  `content.cardSet()` / `cardChapters()` in `features/bookmarks/content.js`
  make that choice for every screen that builds a set, and
  `content.question(id)` finds card ids too — a saved card that answered
  `null` would be pruned off the server. `check:question-ids` holds quiz and
  card ids in one id space.
- **A quiz document is the quiz and nothing else; a Full Set is the study
  cards AND the paper** (owner, 2026-09-28, restated 2026-09-30). That is the
  rule for every batch: the practice quiz never reaches the Papers shelf,
  because the app's own quiz is where a student sits it.
- **THE NAMES ARE THE DOCUMENTS' OWN** (owner, 2026-09-28: "name them exactly
  as I say"), and where a document carries an internal title that differs
  from its filename, the internal title is what the author typed and is what
  the rows say. `quiz.name` and the chapter's `cardsName` carry them, both
  optional: with neither, the old composed labels ("<chapter> quiz",
  "<chapter> cards") still stand.
- **`downloads` on a module** — `{id, title, file, pages}`, a file under
  `public/` offered as a plain `<a href download>` on the Library's Papers
  shelf (`LibraryDownloads.jsx`), with **no viewer**: papers stay paused.
  `check:paused` allows exactly that anchor and nothing else on the slot.
  `pages` is counted out of the PDF rather than guessed, because the row
  prints it to a student.
- **A .docx becomes a paper without LibreOffice**, which is not on the build
  machine: `textutil -convert html` keeps the words and the answer-key table,
  a small script groups each question with its options so neither is split
  across a page and tags the headings by what they SAY (textutil flattens
  every heading level into one paragraph class), and Chromium prints it to
  A4. **A PDF that is already laid out needs none of that** and can be read
  directly: the repo's own pinned pdf.js extracts each line with its x and
  its height, and these documents are exact — stems at x=55 h=10.5, options
  at x=75, headings h>11, footers h=8 and the answer key h=9 — so a
  converter classifies by GEOMETRY instead of guessing at prose. The
  "Marked" column is present on batches drawn from the owner's highlights
  and absent on the others. Spot-check the answer spread: a correct join
  comes out near a third each across a/b/c.
- **Expect to reset again with every replacement.** Run the SQL, raise the
  epoch, re-make the paper, and publish — a commit alone leaves the class on
  whatever `course_docs` last served.
- **AND RUN THE BROWSER SUITES, because `npm run check` does not.**
  `test:exam`, `test:bm`, `test:rr`, `test:tour`, `test:cards`, `test:lesson`
  and `test:vt` all need the harness, which is why they are out of `check` —
  so a content replacement sails through every gate and breaks them silently.
  `npm run test:exam` was red from 2026-10-03 and nobody knew until
  2026-10-10, across TWO replacements: it had `M1.01` pinned, an eight-question
  paper written down as `1/8`, `Not answered 7`, `cells.nth(7)` for "the last
  question" and nine result cases counted out of eight, and a clock of
  R5's `20:00`. 54 problems across its 108 states and 53 among its controls,
  every one of them on a screen that has not changed since 2026-09-27 — and
  the 54 were a SECOND cause: it asked for Aurora's forced night, and Aurora
  has been unoffered since 2026-10-04, so `offeredFinish` had been quietly
  dressing those 18 states in Standard. It runs the ask through the same
  filter the app does now.
  - **The fix was to ASK THE FIXTURE, not to update the numbers.** The chapter
    is now the first one with a quiz, the paper's length is
    `chapter.questions.length`, the pass mark is `passAt(N)`, the clock is
    `clock(allowanceFor(N))` and every result case is a BRANCH of
    `headline()` with its count derived — so the next replacement cannot do
    this again. At eight questions the derived table is the old hardcoded one
    to the digit, which is how the generalisation was checked.
  - **AND ALL THREE OF THEM WERE FIXED ON 2026-10-13**, each for its own
    reason, which is the point: these go red one at a time and quietly.
    - **`test:bm` NOW ASKS THE COURSE WHAT IT CAN FILL.** Its seed named five
      question ids out of M1's first chapter, two videos, two pages and two
      questions out of M2's THIRD chapter, and asserted fifteen rows; M2 has
      no chapters, so it built thirteen and threw. Raising the number would
      have been wrong twice over — **no module has any lessons** (and a video
      row whose lesson id is unknown is DELETED, not merely unshown: eleven
      seeded, ten survived), **papers are off** so `KINDS` offers three
      folders and the walk asserted four in five places, and
      **`library.batches` went on for everybody** so the module card-set page
      is `CardSession` and `.bm-pad` never arrives on it. The fixture is
      derived now and **what cannot be covered is NAMED in the output** —
      the empty Videos folder, the absent Pages folder, the single module —
      rather than quietly asserted against.
    - **`test:rr` was a launch-gated option, a drag race, and the litter it
      left.** The `+` sheet asserted Paper passage, which ReadyRoom withholds
      while papers are paused. The splitter assertion was FLAKY — a synthetic
      drag is eight pointer moves and under load the last lands after a fixed
      200ms settle — so it waits for the width now. **And that uncovered the
      crash CLAUDE.md had recorded against this suite**: with the drag landing
      reliably the width PERSISTS, a narrowed feed puts the detail column over
      the rows, and a `.rr-fopen` press died on `.rr-dscroll` intercepting it.
      The walk restores the layout, which is the rule this file already states
      for a walk that changes a livery or a finish.
    - **`test:vt` WAS A REAL REGRESSION, and the only one of the three.** See
      "Screen changes and transitions" below: the ported module screen had
      left the motion system entirely.
  - **AND A SIDE EFFECT INSIDE A STATE UPDATER, which is the one of these
    bugs a student could actually have been bitten by.** `StudyPad`'s flip was
    `setFlipped((f) => { if (!f) markSeen(…); return !f; })` — and a state
    updater has to be PURE, because React may call it during the render phase.
    So turning a card over wrote progress from inside another component's
    render: *"Cannot update a component (UserProgressProvider) while rendering
    a different component (StudyPad)"*. Dev-only as a message, but a progress
    write during render is one that can be dropped or doubled, and it fired
    for **every student the first time they turned a card over**. It had gone
    unseen because the walk's pad always had cards already marked seen — it
    surfaced the moment the walk cleared them, which is also the fix to the
    pad's own order-dependence (`firstUnseen` opens where you stopped, so a
    pile that marked cards seen had the pad opening at "4 / 4").
  - **TWO CONTRAST BUGS CAME OUT OF test:bm, both the same mistake**: the
    accent as a MARK used as WORDS. `.bm-eg-cta` ("Find a lesson") at 3.96:1
    in Day — drawn only when a folder is EMPTY, which never happened while the
    course had lessons, which is why it had never been measured. And
    `.bm-btn.is-primary` under **Manual** at 3.92:1 worst: Manual draws a fill
    as a line and a label, so there is no fill left for `bm-app.css`'s
    `--bm-fill` step to darken and the label was left on `--active`. The
    stroke stays a mark; only the words moved. 4.79:1 and 6.11:1 now.
  - **AND TWO STALE ASKS WENT WITH THEM.** `test:bm` asked for Aurora's forced
    night, which `offeredFinish` has been reading back as Standard since
    2026-10-04 — 120 states failing for the app obeying its own rule, the same
    bug `test:exam` carried until 2026-10-10 — and a flight-bag count
    hardcoded to the old seed's 13 while the strip correctly drew 9.

`check:placeholders` / `check:ship` grep the build for the markers of the old
placeholder set; nothing carries them and both pass unchanged.

Do not invent YouTube ids, chapter prose or questions to fill the rest.

`chaptersForModule()` and `pdfsForModule()` are in data.js and exported, as the
architecture note above says.

## Design system

- **Two-layer colour.** Module identity hue (per-module, wayfinding only: badges, rails,
  rings, motifs) and a universal `--presence` amber (presence, active states, the single
  primary action per screen). They answer different questions and must not be merged —
  this was collapsed to one hue once and then explicitly reversed.
- Accent is driven by `--accent-h/s/l` channels; every other accent token derives from
  them via `calc()`. Changing the hue re-tints the app. Five user-selectable liveries.
- **TARMAC IS COPPER, NOT BLUE** (owner, 2026-10-04: "tarmac colours are off,
  less purps more copper"). It sat at hue 255 with chroma .022 — a blue so
  desaturated it read as purple-grey, which is what he was seeing. The design
  always meant otherwise: the POC's own description for this livery is
  "Concrete and a copper floodlight", and the numbers never delivered it. Hue
  48, chroma .034, and the Day stock ground with it. **A livery lives in three
  files and all three had to move together**: `liveryEngine.js`,
  `docs/reference/wingman-poc.html` (which `check:livery` lifts and diffs
  against, token for token) and `design/wingman-day-source.js` (which
  `check:day` does the same with). It passes the signal rule at the new hue:
  caution is a hue-locked amber at 78 and this is 30 away, but at .034 against
  .156 of chroma a warm grey ground cannot be mistaken for a lit annunciator.
- `--accent-dim` is for decorative labels; `--accent-tint` is for text that carries
  meaning (chapter codes). Using dim for the latter makes it unreadable.
- **There is one livery system, and it is the app's.** A second one — a livery a
  pilot picked at signup to tint their own tail, with ids like `dawn-patrol` and
  `night-ops` — existed alongside it for a long time and was removed on
  2026-09-04, along with `src/lib/liveries.js`, `LiveryPicker.jsx`, the signup
  step that asked for it and the two database columns. It had already stopped
  painting anything: all twelve `--tail-<id>` tokens resolved to `var(--active)`.
  If you see the word livery, it means the accent hue, and it means
  `liveryEngine.js`.
- No glow rings. "Active" reads structurally — a filled top edge, a gradient inside a
  progress bar. Glow is reserved for presence and the current leg only.
- The brand faces are Instrument Sans and Geist Mono, and they are reached through
  tokens, never named directly: `--font-ui` (Instrument Sans), `--font-mono` (Geist
  Mono). `--font-display` and `--font-body` are both aliases of `--font-ui` — there is
  no separate display face. Fraunces and Inter are not loaded and must not be added.
  Numerals are tabular everywhere.
- Every ambient motion respects the "Smooth Air" preference and `prefers-reduced-motion`.

## Voice

- Never state absence or a zero count. Every empty state names its next action inside the
  sentence.
- Use vocabulary students already use: logbook, briefing, debrief, checkride,
  squawk. Invented lobby slang ("cabin", "channel open", "first voice") was retired.
- No red on wrong quiz answers — `--calm` instead. Red is for genuine danger states.
- No guilt language on a broken streak; it resets silently.

## The quiz

A chapter quiz is an **exam**: answer everything, hand it in, then go through
it. `src/components/module/Exam.jsx` runs it and `src/lib/quiz.js` holds every
rule about what an attempt is — nothing about one is decided in the component.

`Review.jsx` is the **drill**, and it is a different exercise, not a different
mode. The re-check and put-right flows hand you back something you already got
wrong, so they mark as you go; withholding the answer there withholds the only
thing the student came for. Both files' headers carry the argument. Do not
merge them back together.

- **Nothing is marked before hand-in**, and that is the one rule a tidy-up
  breaks silently. `check:exam` asserts no `data-mark` reaches the question
  screen and no score is computed while the paper is open.
- The option order is shuffled per sitting and **seeded from the attempt**, not
  from the clock. An answer is stored as "the second option"; reseed on the way
  back in and every restored answer is quietly wrong.
- The attempt is written to localStorage on every change and every change is a
  **function of the previous attempt** — two changes in one frame both built on
  the render's closure lose one, silently.
- Retention is fed **once, with the whole paper**, through `recordAnswers`.
  Eight separate `recordAnswer` calls in one tick all read the same pre-render
  state, so seven were overwritten and one question of eight reached the
  caution pile — with the score and the review both perfectly correct.
- **The screen is a port, the model is not.** `Exam.jsx`, `exam.css` and the
  quiz-row thumbnail come from an approved EASA-style design handed over
  outside the repo (2026-09-16). Every size, radius and duration on that screen
  is the design's; the token names it used are aliased onto this app's livery
  engine at the top of `exam.css`, and every selector is scoped to
  `.exam-frame` because the design's names — `.btn`, `.option`, `.mark`,
  `.ans`, `.result` — already paint other surfaces here. The layout switches on
  **container** width, so the wrapper has to stay.
- **The exam is locked while a paper is open, and every exit asks.** The app
  bar drops the Ready Room pill and the profile menu and reads EXAM IN
  PROGRESS; the wordmark stops being a button; the browser's Back and the
  module's back arrow both raise the end-exam dialog rather than leaving.
  That dialog offers three choices — Back to exam · Leave it for now · End and
  mark — so nothing marks a paper the student did not mean to hand in and
  nothing leaves one without being asked. `src/lib/examLock.js` is the one
  place that knows. R4's letter says "no back arrow"; the arrow stays because
  an attempt survives leaving and the clock stops with it, and deleting it
  would make a blank paper the only escape from a mis-tap.
- **The leaderboard is under the result, and it lists RUNS.** Migration 0034,
  `src/lib/board.js` and `Leaderboard.jsx`. The rank, the seconds and the
  place are all the server's — the client only formats, which `check:exam`
  asserts by refusing a `.sort(` or a `Date.parse` in either file. It draws
  nothing until somebody else is on it.
- **Stamps reach the board, the result and the Library** (the quiz-stamps
  pack, 2026-09-23: `docs/launch/BRIEF-QUIZ-STAMPS.md`, `18-quiz-stamps.js`,
  `19-quiz-stamps.css` scoped to `.qstamps` by `npm run ref:css`). A stamp
  belongs to the PERSON, never to the run, and every one on these screens
  comes through the app's one renderer.
  - The result's aeroplane-in-a-ring is **gone**: the student's own stamp
    leads the screen at 132px, level with the headline, in a column that
    collapses at 620px (`result-stamp.css`).
  - On the board **every run keeps its row**, and the stamp is drawn only on
    an account's first row — which, the board arriving sorted, is that
    person's best run. A repeat keeps the empty slot and takes the word
    "again". The de-duplication is at render; the query still returns runs.
  - A Library quiz row carries a line of **finisher stamps**: one per person,
    yours pinned first and then most recent, eleven at most, then "+n", then
    the count in words. The order and the cap are the server's (0038) — a cap
    applied in the client would have dropped the student's own stamp off the
    end. A quiz nobody has sat says "Be the first to take it", because §10
    forbids naming an absence, which is what the brief's own words did.
  - A person with no stamp yet draws the **un-inked outline**, the licence's
    own "not yet" mark (owner, on the brief's open question 1).
  - **ONE ANSWER IS WHAT STAMPS YOU, NOT A HAND-IN** (owner, 2026-10-12;
    migration 0042, run live the same day). A run joins the quiz's stamps once it
    has been ANSWERED or submitted — `quiz_runs.answered_at`, written by
    `mark_quiz_progress` on the first answer of a sitting. Measured in a
    browser: opened with no answer gives 0 stamps, one answer gives 1, and
    leaving by "Leave it for now" keeps it.
    - **OPENING WAS ASKED FOR FIRST AND ARGUED DOWN.** The row already exists
      on open (`start_quiz_run` fires from an effect), so reading it would
      have been a one-line change — it is not the rule because opening is
      free and repeatable, because the screen it sits on marks nothing before
      hand-in, and because "Leave it for now" exists so a mis-tap costs
      nothing. One answer cannot be reached by accident and is reached long
      before a hand-in, which is the liveness that was actually wanted.
    - **THE CONDITION WAS THAT LEAVING KEEPS YOUR PLACE, and it already did** —
      measured before 0042 was written: answer two, step to the third, leave,
      come back to question 3 with 2 of 40 answered and the clock 0 seconds
      further on. **The limit, stated rather than discovered: the attempt is
      localStorage only (`wingman.attempt.<quizId>`), so resume is PER
      DEVICE.** Leave on a phone, open on a laptop, and you get a fresh paper;
      the stamp is then the only trace of the first sitting.
  - **A REPEAT IS A SECOND STAMP NOW**, and the old rule is withdrawn (owner:
    "if I attempt it twice, I get stamped"). It was one stamp per person on
    their best run, with a repeat keeping an empty slot and the word "again".
    `quiz_finishers` returns one row per RUN rather than per person, the
    render-time de-duplication in `Leaderboard.jsx` is gone, and `run_id` is
    returned because `user_id` is no longer unique in that list — React would
    have dropped the duplicate silently, which would have looked exactly like
    the de-duplication being removed. **The cost is stated rather than
    hidden**: twelve runs from nine people now read as twelve stamps, which is
    what the old rule existed to prevent. A better treatment for a repeat is
    wanted later and belongs in `Leaderboard.jsx`.
  - **The pack's row is a `<li>` of spans, so a board row has no door on it**
    any more; the pilot sheet is still reached from Crew, the Ready Room and a
    lesson. One button on a row would put it back.
  - `npm run check:quiz-stamps` is 46 assertions, and the last of them drive
    the demo's emulation of 0038 with a class of fourteen, a repeat, a block
    and somebody flying solo.
- **THE SAME FORTY, IN A NEW ORDER EVERY SITTING** (`quiz.js` §8). The
  owner asked for "a randomizer on the quizzes" and then said what that
  meant: "when I say random I mean just rearranged, and that only goes for
  the 40 quiz questions — they should be shuffled on each attempt." So a
  paper is the chapter's OWN quiz, all of it, rearranged; a retake is
  rearranged again. **It is NOT drawn from the study cards** — the first
  version of this did draw 40 out of the chapter's 315 and shipped that way
  for a few hours; the forty are the forty the author chose to examine on.
  Measured live: two sittings, the same forty ids, a different order.
  - **The order is RECORDED, never reproduced.** The ids go into the attempt
    and a resumed paper is rebuilt from them; recomputing from a seed would
    reshuffle silently the moment anything about the chapter changed, which
    is the same class of bug as reseeding the option order.
  - **And the attempt carries a hash of what the questions SAID** — an id is
    positional inside its chapter, so replacing a chapter's documents leaves
    every id in place and changes what each one says. `paperOf` refuses an
    attempt whose questions no longer hash the same, and refuses one written
    before the hash existed. Without it, the Instruments replacement would
    have marked yesterday's answers against today's questions.
- **The clock is a FLAT FIFTY MINUTES** for any quiz up to forty questions
  (owner, 2026-10-05). It was R5's twenty (2026-09-20), then thirty
  (2026-10-04), and fifty is where it should have been all along: **the
  owner's own question papers say so on their first page** — "40 questions is
  50 minutes at the Part-66 allowance" — so a forty-question paper here is
  now timed exactly as the one these students will sit, which is the whole
  argument for having a clock. Past forty the per-question figure comes back,
  rather than a forty-one-question paper silently getting the same sitting as
  an eight-question one. `estimate` keeps the 75 seconds, because a row
  reading "about 50 minutes" for every quiz would say nothing. **The number
  lives in TWO places now and they have to move together**: `quiz.js` and
  `check:exam`. It was three: `steps.js` said it out loud to a visitor, and
  that file went with the tour rebuild on 2026-10-06. It was briefly FOUR —
  `test:exam` asserted R5's `20:00` and went red unnoticed through both of
  the clock's changes; it asks `clock(allowanceFor(N))` now, so it tracks
  this number rather than restating it. The approved tour's
  script does not state the clock anywhere, so a visitor is no longer told
  the figure before they meet it — which is the handoff's wording and not an
  oversight here. If it should be said again it belongs in `tourSteps.js`,
  and then this is three places again.
- **The clock counts DOWN, and hands the paper in at zero.** This file used
  to say "elapsed time, never a countdown", and `quiz.js` §1 carried the
  argument: a countdown decides when you stop. The approved screen reverses it
  on purpose — the paper these students sit is timed, and a student who has
  never practised against a clock meets one for the first time in an
  examination hall. The allowance is this file's own nominal figure, 75 seconds
  a question. It is **not** elapsed-since-start: that was the live bug it
  replaced, where a paper left open for two days read 202:29:37, because
  `startedAt` is persisted with the attempt. The time left belongs to the
  attempt and only moves while the paper is on screen.
- **No keyboard shortcuts on the paper.** 1/2/3, F and the arrows are gone with
  `quizKey`: on a paper you cannot unsubmit, a shortcut that answers a question
  answers it by accident. Tab, Enter, Space and the radio group's own arrows
  are what is left.
- The result screen carries the correction inside it — the missed questions
  with the pick struck through and the right answer after it, and the ones you
  got right folded away. The pass mark is **fixed at 75%** and decides pass or
  not-yet; the student's own bar only changes the wording and adds a marker.
- **"Going through the paper" has no door on it** (2026-09-21). The screen is
  the drill's rather than the exam's — the explanation for every question, the
  lesson each miss came from (joined on `lessonId`, never on resemblance), and
  a paper of only the misses, whose retake has its own quiz id and is handed no
  `onDone` so it can never write a score over the sitting it came from. All of
  that still works and is reached from nothing: the button stood on the result
  screen and the owner asked for it out, which is also what
  `exam-port.check.js` asks for. Same state as "Put right", and one button
  anywhere puts either back. The cost is that no walk can reach it, so
  `check:exam` holds it at the source instead. The result keeps the correction
  itself — every miss with the pick struck through and the right answer after
  it — which never depended on the door.
- `npm run check:exam` is 145 assertions, including contrast for all six
  liveries × three finishes × night and day. `npm run test:exam` drives the
  screen in a real browser: 108 layouts, every control in the brief's table,
  nine result cases against three different bars, and motion turned off.

## Master Caution, and what happened to Calibration

- **Master Caution lights in exactly one place**: the module card in the Flight
  Deck launcher, and only when that module's **average** is below the student's
  bar. Not chapter rows, not quiz rows, not the Library, not a result screen —
  and nothing at all when the average is at or above the bar or there is no
  data yet, rather than an unlit lamp. It reads the average because "any
  chapter below the bar" lit a module a student was well on top of, and a lamp
  that lights when nothing is wrong is a lamp you learn to look past. It keeps
  its own fixed caution colour. `moduleNeedsYou` in `minimums.js` is the rule.
- **Calibration is gone** (2026-09-16): the Library row, its sticker and date,
  the `recheck` route, `recheckSet`, and the `pw-last-recheck` key. It was the
  answers you already had right, come round again — a second exercise with its
  own vocabulary, for a pile most students never opened. The piles themselves
  are untouched: `caution` is what Put right works from and `holding` is still
  where a right answer goes.
- **"Put right" has no door on it today.** It was reached from the old result
  screen's button and from nothing else, and the approved result screen has no
  such button. The route, the drill and the caution pile all still work; one
  button anywhere would put it back.

## Migrations

`supabase/migrations/` — 0000 progress table, 0001 social layer, 0002 threaded posts,
0003 reactions and attempts and completions, 0004 progress merge, 0005 squadrons and
safety and comms, 0006 openers and rate limits and moderation, 0007 questions and
squawks and teams, 0008 the lesson surface, 0009 the right seat's boundary,
0010 thread titles and answers, 0011 discovery, 0012 search and suggestions,
0013 retiring the pilot livery, 0014 the annotation layer on papers,
0015 live updates, 0016 the three-character code, 0017 ink and the palette.

**0041 AND 0042 HAVE BEEN RUN AGAINST THE LIVE PROJECT** (2026-10-12),
verified by connecting rather than inferred — `npm run check:people-db`, 13
assertions over the anon REST path. Afterwards: `people_search` returns
`(user_id, callsign, real_name, module_code, shares_squadron)` and no
`display_name`, `people_browse` and `mark_quiz_progress` exist where neither
did, `quiz_finishers` returns `run_id`, and `quiz_runs.answered_at` is
present. One letter into search finds people and hands back zero names, which
is the disclosure rule holding on real data.

**THE ORDER WAS MERGE, DEPLOY, THEN MIGRATE, and it had to be.** 0041 DROPS
`display_name`, which the deployed client read; running it first would have
blanked every search result for the class until the bundle caught up. The
other direction has its own gap — the new bundle asks for `callsign` while the
old function still answers `display_name` — so `searchPeople` carries a
`compat` fallback for exactly that window. **Delete `compat` now that 0041 has
run**, which is what its own comment says; `check:people` holds it until then.

**`scripts/apply-migration.mjs` is how they were applied**: one transaction per
file, so a failure leaves nothing behind, and it prints the shape of what it
touches before and after, which is where the paragraph above came from.

What it does: the ORBIT SCOPE IS WITHDRAWN FOR SEARCH. 0011 built
`people_search` so it "cannot return a stranger", through `in_my_orbit` —
shares a squadron, or has posted in one of your modules. The owner searched
for somebody he knew by name and by username and got nothing (2026-10-11:
"disregard anything we decided earlier ... if it is registered on a server, it
will show their name"), and on a class this size that function was mostly
answering "is this person already in a room with me". The matching was never
the problem; 0012 already matched callsign and real name both.
`in_my_orbit` itself stays — `discover_squadrons` still uses it, which is a
different question.

**WHAT 0041 KEEPS IS AS MUCH OF THE POINT AS WHAT IT DROPS.** Fly solo, blocks
both ways, `discoverable`, and 0012's rule that a real name its owner chose not
to show is never matched on — that last one does not hide anybody, because
their callsign still finds them; what it refuses is confirming a hidden name
one substring at a time. You also never find yourself, which orbit used to do
incidentally and is now explicit.

**AND `people_browse`, WHICH RETURNS ROWS AND NO NUMBER.** The owner asked
for "some sort of glossary that shows active users in a way that doesn't
expose if we have small users", and then for where it lives: "if you select
people, it shows every current person". So it is EVERYBODY, alphabetical by
callsign, and there is no count to print — no total, no headcount, and
deliberately **no `count(*)` companion**, because the moment one exists a
screen will use it.

It was `active_students` and a fortnight's activity in the first draft. The
window survives as `p_since`, null by default, for a class big enough to want
one; "every current person" is what was asked for. Activity is still read
across five signals (seen, asked, answered, finished a chapter, sat a paper)
rather than from presence alone, so a window means what it says.

**THE SERIES CAN BE RUN TWICE, AND UNTIL 2026-10-13 IT COULD NOT.** Supabase's
preview CI applies every file in `supabase/migrations/` to a branch database,
and it had been failing on the same line for days:
`policy "lesson_notes_no_bulk_read" for table "lesson_notes" already exists`.
**Two separate causes, and fixing the first did not fix it.** `supabase/ALL.sql`
lived in that directory, so the tooling applied the whole bundle as a migration
and — having no `NNNN_` prefix — applied it FIRST, creating everything twice;
moving it out on 2026-10-12 was right and was not enough, because by then the
branch database was holding 0009's policies from a run that died past them
while the history table never recorded 0009 as applied. **Eight `create policy`
statements across 0008, 0009 and 0010 had no guard at all**, while all three
files' headers said "safe to re-run" — so every later run stopped at the same
statement forever, and nothing in the files said why. They drop first now, which
is the idiom the other 28 already use (the other two being a do-block
swallowing `duplicate_object` and an `if not exists (… pg_policies …)` test);
dropping is the deliberate choice for 0009 because a re-run then converges on
the definitions in the file rather than on whatever a half-finished run left,
and those four ARE the boundary 0009 exists to draw. Nothing else in the series
was ever exposed: tables, indexes, triggers, types and functions were all
already guarded, measured rather than assumed.

**AND THEN IT FAILED FURTHER ALONG, ON A SECOND CAUSE OF THE SAME KIND.** With
the policies fixed the run got as far as 0011 and stopped with
`cannot change return type of existing function (SQLSTATE 42P13)`:
**`create or replace function` cannot change what a function returns**, and
this series widens functions freely — `people_search` goes from four columns in
0011 to sixteen in 0043, `licence_card` from 21 to 28, and `quiz_finishers`,
`squadron_roster`, `paper_marks_for` and `people_browse` all grow too. Replaying
an early file against a database holding the final shape therefore cannot work
unless the function is dropped first. **Seven definitions needed that and did
not have it.** The rule is per OVERLOAD — a different argument list is a
different function, which is why 0014's `paper_annotation_status(uuid, text)`
returning `void` is NOT a problem beside 0023's three-argument one returning
`boolean` — and trigger functions are exempt by construction, since they return
`trigger` everywhere and could not be dropped without cascading through the
trigger that uses them.

**AND A THIRD, THE SAME SHAPE AGAIN.** With the functions fixed the run reached
0015 and stopped on
`relation "lesson_threads" is already member of publication "supabase_realtime"`:
**adding a table to a publication twice is an error, not a no-op.** Its three
statements are wrapped in the `duplicate_object` idiom now. At that point the
remaining classes were audited rather than waited for — `add constraint` (nine,
all already dropped first, one of them by 0017's loop over `pg_constraint`
rather than by name) and `insert into` (five, all carrying `on conflict`) — and
the classes PostgreSQL makes no-ops on repeat are deliberately not asserted,
because a check that flagged `enable row level security`, `replica identity
full`, `grant` or `alter function … set search_path` would be noise. 14
assertions now.

**AND A FOURTH, WHICH WAS NOT A STATEMENT AT ALL BUT A CLAIM GOING STALE.** The
run then reached 0026's own proof block and raised
`0026: something can list chat-attachments, and nothing should`. Several
migrations end in a do-block proving they took; most assert the PRESENCE of
their own objects, which no later file can falsify. **0026's asserted an
ABSENCE** — that nothing may list that bucket — and **0031 reversed exactly
that, deliberately and at length**: Supabase's storage API uploads with
`x-upsert: true`, which LOOKS FIRST, so with no select policy every attachment
upload failed with a 403 naming INSERT. So 0026's flat zero has been false by
design since 2026-09-19, and only a replay ever ran it again. It excludes
0031's policy by name now and still asserts that no OTHER reader appeared —
read 0031's header before touching it. Every other absence-proof in the series
was checked and none is stale.

**AND A FIFTH, WHICH WAS DATA RATHER THAN SCHEMA.** The run then reached 0035
and raised
`check constraint "pilot_code_shape" of relation "pilot_profiles" is violated by some row`.
**Adding a constraint VALIDATES the existing rows**, and 0039 widens this one
from exactly three characters to one-to-three — two accounts hold a shorter
code. A narrowing cannot be replayed over data a later migration widened, so
the superseded add is skipped when that happens and 0039 adds the correct shape
a few files later; on a fresh database there are no rows to violate and nothing
is skipped. Four superseded adds across 0017, 0018, 0035 and 0036 take that
treatment, of which two were genuine hazards (0017's list is narrower than
0020's; 0036's is WIDER than 0037's and so was always safe).

- **THE FIRST DRAFT OF THAT CHECK ACCUSED TWENTY-EIGHT CORRECT STATEMENTS**, and
  that is the part worth remembering. The series guards a constraint four
  different ways — `drop constraint if exists`, a dynamic drop over
  `pg_constraint`, an `if not exists (… pg_constraint … conname)` test, and a
  do-block swallowing `duplicate_object` — and a check that knew only the first
  called the other three broken. Each idiom was added to the check only after
  reading the statements it was accusing. **A check that cries wolf about
  correct code is worse than no check**, because the next person learns to
  override it. The distinction that matters is narrow: a statement SKIPPED
  because the constraint is already there never looks at the rows, so only the
  drop-and-re-add shape can raise 23514 — 11 of the 41 do that.
- **And wrapping a statement in a guard indents it, which hid it from the
  gate.** The add-constraint scan required column 0, so guarding four
  statements took them out of the assertion that had been watching them. It
  scans regardless of indentation now.

- **ALL FIVE WERE FOUND ONE AT A TIME, each only after fixing the one in front
  of it.** Every fix moved the failure further down the series rather than
  clearing it, which is the thing to expect of this kind of work rather than to
  be surprised by. None of the four is visible by reading any single migration:
  the first needs the branch's leftover state, the second needs two files
  compared, the third needs to know that one `alter` is not a no-op, and the
  fourth needs to know that a later file withdrew an earlier file's claim. That
  is why they are assertions now rather than paragraphs — and after the third,
  the remaining statement classes were audited in one pass instead of waiting
  for CI to name a fifth.
- **The limit is stated rather than glossed**: a proof block can assert
  anything, so `check:migrations` only partly reaches that last class. The
  preview run itself is the real test of the series.

- **`npm run check:migrations` is 16 assertions and IS in `npm run check`**,
  because it reads the SQL and needs no credentials. It holds all 36 policies
  and every other DDL statement, every one of the 91 overloads against the
  last definition of its own shape, that only `NNNN_`-prefixed files live in
  the migrations directory, and that **both bundles are byte-for-byte what
  their generators would write** — that bundle sat at 0013 while the series had
  reached 0042, and a stale bundle goes stale silently. Proved by planting all
  three bugs back: each one fails it, restored it passes.

**0040, the course in a table, has been run against the live project**
(2026-09-30), verified by connecting: `course_docs` with one SELECT policy
and no write policies, `course_keys` with none at all, and
`publish_course` / `current_course` / `set_course_key` in `pg_proc`. The
publishing key was set the same day and the document this build ships with
was published as version 1. `npm run check:course-db` is 14 live assertions.
pgcrypto lives in the `extensions` schema on this project, so every function
here sets `search_path = public, extensions` — without the second entry
`digest()` is not found, which is how the first run of this migration
failed.

**ALL OF MODULE 13d's PROGRESS WAS RESET ON 2026-10-03**, live, with
`supabase/reset-module-13d-progress.sql`, when all three chapters came out of
the course at the owner's word. 11 board runs, 11 saves and 2 progress
documents went; completions, paper marks and ink were already empty. Hours
flown stayed, deliberately. The device half is `STORAGE_EPOCH = 4`, and the
emptied document was published as course version 7 — see "Content".

**The Instruments chapter's progress was reset on 2026-09-27**, live, with
`supabase/reset-instruments-progress.sql` (not part of the numbered series:
it is a one-off about content, not schema, and is safe to run twice). Both
source documents were replaced and the ids are positional, so 2 board runs,
16 saved questions and cards, and every M1.02 entry in `pw-quiz-scores`,
`pw-quiz-run`, `pw-cards-seen`, `pw-cards-got` and both retention piles went
with them. Verified after: 0 rows anywhere for M1.02, and M1.01 untouched —
4 board runs, 3 saves and 2 score documents still there. The device half is
`STORAGE_EPOCH = 2`, because a browser holding the old score would have
patched it straight back.

**0039, one to three and one change, has been run against the live project**
(2026-09-23), verified by connecting: `pilot_code_shape` is now
`^[A-Z0-9]{1,3}$`, `pilot_profiles.stamp_redo` exists with its CHECK,
`stamp_is_permanent` allows exactly the update that spends a credit,
`grant_stamp_redo` is granted to `service_role` alone, and both arities of
`issue_licence` take a code of one to three. The backfill gave one change to
each of the two accounts that had issued a stamp. `npm run check:licence-db`
is 29 assertions now, including a live PATCH with the publishable key proving
nobody can hand themselves a change.

**0038, who has finished a quiz, has been run against the live project**
(2026-09-23), verified by connecting: `quiz_finishers(uid, p_quizzes, p_cap)`
is in `pg_proc` and answers over the anon REST path. It groups runs into
people (`max(submitted_at)`), pins the caller first, then orders by recency,
counts the WHOLE quiz rather than the capped page, and carries 0034's
visibility rules — Fly solo, and a block cutting both ways. `quiz_leaderboard`
is untouched and still returns every run, which is what the board draws.

**0036 and 0037, the whole stamp, have been run against the live project**
(2026-09-21), verified by connecting. 0036 found the live checks still on an
older pack — no Crochet, no Knurl, so a student choosing either could not
issue at all — and fixed the pattern list, added `stamp_pscope`,
`stamp_pink` and `stamp_cink` (inks by name, held to the thirty-six), made
them permanent with the rest, widened `licence_card` and `quiz_leaderboard`
to return them, and added a ten-argument `issue_licence` beside 0035's seven
(PostgREST picks by argument names). 0037 narrowed the shapes back to six
the same day, after the owner took the shield and the hex out again.
`npm run check:licence-db` now drives 18 assertions over the anon REST path.

**0035, the code is the stamp, has been run against the live project**
(2026-09-21), verified by connecting: `pilot_code_shape` is now
`^[A-Z0-9]{3}$`, `issue_licence` claims and issues in one statement,
`claim_code` refuses to move an issued code, and the trigger holds `code`.
`npm run check:licence-db` drives 11 assertions over the anon REST path as two
throwaway accounts and deletes both rows.

**0034, quiz runs and the board, has been run against the live project**
(2026-09-20), verified by connecting rather than inferred: `quiz_runs` with its
eleven columns, four CHECK constraints, two indexes and an open policy, and
`start_quiz_run` / `finish_quiz_run` / `quiz_leaderboard` all in `pg_proc`.
Driven over the anon REST path afterwards by `npm run check:board-db`, 20
assertions as six accounts, every row deleted after. It is additive: nothing is
migrated out of `pw-quiz-scores`, which the Library row and the gyro keep
reading. Its header carries the argument for the wall clock and its cost.

**0028, saves, has been run against the live project** (2026-09-18), verified
by connecting rather than inferred: the table with its nine columns, the three
CHECK constraints, `saves_one_per_thing` (NULLS NOT DISTINCT; the project runs
PostgreSQL 17.6) and four open policies. Driven over the anon REST path
afterwards: an insert, a duplicate refused by name with 409, a scoped select,
and an upsert on `(user_id, kind, ref_id, page)` moving a lesson's second
rather than making a second row. Its header carries the argument for why it is
not the SQL that came with the design.

**0027, read receipts, has been run against the live project** (2026-09-15),
verified by connecting rather than inferred: `comms_receipts` with its four
columns, `squadron_members.last_delivered_at`, `mark_squadrons_delivered` and
`message_receipts`, and `mark_squadron_read` now plpgsql with the same
signature and return type, so the bundle deployed before it kept working.
`comms_receipts` is in the realtime publication, and all three functions answer
over the anon REST path. The backfill found two receipts to write.

**0017 has been run against the live project.** It adds `paper_ink`,
`paper_annotations.colour`, two more kinds (`underline`, `strikethrough`) and
`paper_ink_for`. It is deliberately ADDITIVE — nothing is dropped. Widening
`paper_annotations_for` to carry the colour would have meant dropping it first,
because a function's return columns cannot be widened in place, so the new
shape took a new name: **the reader now calls `paper_marks_for`**, and
`paper_annotations_for` is dead but still standing. Drop it when convenient.

**0015 and 0016 have been run against the live project.** 0015 publishes
`lesson_threads`, `lesson_replies` and `comms_messages` to the realtime
publication — presence is deliberately not among them. 0016 adds
`pilot_profiles.code`, a unique index, a CHECK carrying the same alphabet as
`src/lib/code.js`, and `claim_code`/`suggest_code`. Verified atomic: four
simultaneous claims for one code granted exactly one.

**0013 has been run against the live project.** Both `livery` columns are gone
from `pilot_profiles` and `squadrons`, and `squadron_roster` was rebuilt without
one. Verified by counting the columns afterwards, and by re-running
check:backend, check:schema, check:threads and check:discovery, all of which
still pass.

**0014 has been run against the live project.** `paper_annotations`, four
functions, and the `anchor_is_text_only` CHECK that refuses any anchor
carrying a page, rect or bbox — R1 of the annotation brief, enforced where it
cannot be argued with. `npm run check:paper-db` drives 17 assertions against
the real database as two different accounts and deletes every row it makes;
like check:discovery it is NOT in `npm run check`, because that suite must not
need credentials. `npm run check:paper` holds the 170 that need neither.

**0011 has been run against the live project**, verified by connecting rather
than inferred: 9 new squadron columns, 4 new profile columns, 2 new tables and
8 functions all present afterwards where none were before. `npm run
check:discovery` drives 12 assertions against the real database — a stranger is
refused by people_search itself, blocks cut both ways, the opt-out works,
capacity refuses a join by card AND by link — and deletes every row it makes.
All four discovery RPCs answer over the anon REST path. It is deliberately NOT
in `npm run check`, because that suite must not need database credentials.

`enrollments` is a hand-made table from before the series: in no migration,
read by nothing, empty since 2026-09-21 (see the architecture note). 0011's
`my_modules` is built from `chapter_completions` and `lesson_threads` instead,
which are the two real signals for what somebody studies.

**0000-0009 have all been run against the live project.** Verified by connecting
on 2026-08-31, not inferred: all three of 0008's tables exist, both its functions
are in `pg_proc` with matching signatures, and the `lesson_threads_anchor_whole`
CHECK constraint is present. All three tables are empty.

This file previously said 0008 had NOT been run. That was wrong, and it is the
exact failure the paragraph below warns about — `npm run check:backend` is the
source of truth, so connect and look rather than believing this file.

The client IS now pointed at them. Threads and replies live in `lesson_threads`
and `lesson_replies` and are read by everyone; `npm run check:threads` proves it
end to end over the anon REST path, writing as two different accounts and
cleaning up after itself. Notes deliberately stay in `user_progress`: they are
private, they have exactly one reader, and moving them would buy nothing.

0009 states §7's right-seat boundary as a SQL function rather than an RLS
policy. That is not a shortcut — `auth.uid()` is NULL on every request in this
architecture, so a policy referencing it would silently deny every row rather
than fail. Read 0009's header before writing any policy that mentions it.

0000-0007 ran against `rpfgxxcpfrgajlkpoyes`, the project the deployed bundle points
at. Verified directly, not inferred: all 31 tables the code reads answer over REST, and
all 12 functions are in `pg_proc` with signatures matching every call site.

Do not trust the comments in `squadron.js`, `comms.js` and `FirstFlightGate` that say
"until 0005 runs" — they describe the state when they were written and were never
updated. `npm run check:backend` is the source of truth; run it rather than reading
prose. `supabase/SETUP.sql` is the guarded one-paste bundle if a second environment
ever needs building — **0005 to 0043, not 0005-0007**, which is what this line
said until 2026-10-13. It is generated (`npm run build:sql`, which writes it
and `ALL.sql` together) and it had not been regenerated since 0013, so it was
**thirty migrations and 3,593 lines stale** and would have built an
environment missing everything from the reader to the course table.
`check:migrations` runs both generators and compares now, so neither can go
stale again without the gate saying so.

0004 is not optional: without it, progress does not save. 0000 declares the
`user_progress` table it writes to, which predates the series and was created by hand —
the live database already has it, so 0000 is a no-op there, but without it the series
cannot rebuild an empty database. Both bundles take 0005 and up, so 0000 is
deliberately outside them.

## The annotation layer

A layer over a Library paper. The paper is never edited by a reader; every
highlight, note, question and correction is a separate record pointing at a
passage, so filtering is just deciding which records to draw and nothing a
reader does can damage the paper. Module 1 only for now, behind
`library.reader`.

- **An anchor is text, never coordinates.** `src/lib/anchor.js` came with the
  brief, is tested by `npm run check:anchor` (29 cases), and is the one file not
  to rewrite. A mark stores the words plus 32 characters of context either side,
  so it survives the paper being reflowed, re-extracted, or becoming native
  content later. Coordinates are measured at draw time from the rendered text
  layer and never stored.
- **A lost mark is orphaned, never relocated.** `resolveAnchor` returns null
  rather than guessing, and the reader lists what lost its place.
- **pdf.js is pinned exactly**, not caret-ranged. A minor version changes how
  text runs are split, which changes the extracted string, which silently
  orphans every mark ever made. See the header of `src/lib/paperText.js`.
- The reader is its own lazy chunk (~428KB) and `check:bundle` asserts pdf.js
  never reaches the entry chunk. **That check reads the entry's name out of
  `dist/index.html`** rather than looking for a file called `index-*`: on
  2026-09-23 a second `index-*` chunk appeared, readdir handed back the 59KB
  one first, and the gate passed while the real 676KB entry went unmeasured.
  A gate that can pass by accident is worse than no gate.
- **Ink is not an annotation, and that is not a loophole.** A pen stroke is
  coordinates and nothing else — there is no sentence you could store instead
  that would let you draw it again — so it lives in `paper_ink`, which has no
  anchor column to smuggle a position into. R1 is untouched and just as strict.
  Points are fractions of the unrotated page (0..1), never pixels, so a stroke
  drawn at 80% on a phone is the same stroke at 250% on a laptop. The cost is
  stated rather than hidden: a stroke cannot survive a re-extraction the way a
  mark can.
- **The ink palette is a third colour category.** Module hue is wayfinding,
  `--presence` amber is presence and action, and ink is what the reader put on
  the page themselves. It is the only fixed colour in the reader, and it is
  fixed on purpose: a livery change that re-tinted somebody's yellow highlight
  would be the app editing their notes. Eight names, stored as names; what a
  name looks like is a CSS decision. Graphite becomes chalk under the night
  light, because a pencil is defined by being darker than paper.
- **The page's width has one writer.** The island decides a zoom and reports
  it through `ctx.onView`; `ReaderV6` paints `--pw` and works the *opening*
  fit out with the island's own `fitFor`, because the island is not mounted
  until the paper's text sidecar has loaded and the pages are on screen well
  before that. While both wrote it, every paper opened at the stylesheet's
  720px and shrank to its fit 300ms later, with the document getting shorter
  as it went — the spacers standing in for the pages off screen had been sized
  for the width that was going away. The measurement that feeds those spacers
  watches a **page**, not the stage: the stage is the scroll box and does not
  move when a page changes width, so a single fire at the wrong moment used to
  latch a width for good. `check:paper` holds both.
- The rail carries ten tools **two abreast**. Every button in this app is at
  least 44px on its shortest side (§12, enforced globally in App.jsx), so one
  column of ten is 659px of a 720px window. Do not shrink the buttons.
- The test paper is fetched, not committed: `npm run paper:fetch`. `papersFor()`
  adds it to Module 1 under `import.meta.env.DEV` only.

## The Ready Room

### Finding people, and the circuit

- **A NAME OR A CALLSIGN FINDS ANYONE STUDYING HERE** (owner, 2026-10-11;
  migration 0041, which is **not yet run** — see Migrations). The order is the
  server's and is a suggestion list's: exact, then starts-with, then contains,
  then a squadron-mate ahead of a stranger, then alphabetical. The client
  formats and never sorts, the same division as the leaderboard.
  - **The copy moved with the rule.** Discover's last line used to tell a
    student "a name only finds someone you already share a squadron with"; it
    said the orbit rule out loud and would have been a lie the moment 0041
    ran. The rail's second line under a found person had the same problem — it
    fell back to "In your modules", which was a safe guess only while orbit
    guaranteed it, and was labelling strangers as classmates. It says what it
    knows and otherwise says nothing (`personLine` in Rail.jsx).
- **THE DIRECTORY IS A FILTER ON THE SEARCH, not a section of its own**
  (owner, 2026-10-12: "we move it to the search bar ... if you select people,
  it shows every current person"). The rail's search carries All · People ·
  Squadrons · Questions; People replaces the rail with the whole class, A–Z,
  whether or not anything is typed. It was a short list pinned to the foot of
  the rail, capped at eight, whose "see who else" went to the SQUADRON finder
  — a door that did not go where it said.
- **THE LIST IS CALLSIGNS. A NAME IS SOMETHING YOU ASKED FOR.** This is a
  privacy rule, so it lives in the SQL and not in the component: `people_browse`
  has no column for a real name, and `people_search` returns one only on the
  rows whose name matched. A roster of real names cannot be read off the side
  of the screen, and the client cannot leak what it was never sent. The third
  way to a name is opening the profile, which is a deliberate press on one
  person.
  - **DISCLOSURE IS STRICTER THAN MATCHING, and the gap is the whole rule.**
    Matching stays a loose substring so any fragment still FINDS people;
    disclosure needs three characters or more that START a word of the name.
    Written as a plain substring it handed back "Kai Lindqvist" for the two
    letters "KA" — somebody typing the start of a CALLSIGN was given a real
    name — and one letter would have harvested the class. Measured on the
    fixture, not reasoned about.
  - Ordered by callsign, and grouped by its first character; anything not A–Z
    lands under "#", which sorts last. `byLetter` in `roomModel.js` rather
    than in `discovery.js`, because discovery.js imports the Supabase client
    and so cannot be imported by a node check — the same split `quiz.js` and
    `cardSession.js` already make.
- **THEIR FACE AND THEIR MARK** (owner, 2026-10-12: "the stamp is the
  identity so i want that integrated too", then "keep the profile but also add
  the stamp near the name"). The avatar stays — it is what a student
  recognises everywhere else — and the stamp sits beside the callsign at 22px,
  through the app's ONE renderer, so a stamp is drawn here exactly as it is on
  the board and the quiz row. Somebody who has not made one gets the un-inked
  outline, which puts the nudge in the one place students look at each other.
  Migration **0043** widens both functions with the same eleven stamp columns
  `quiz_finishers` already returns; no real name comes with it.
- **AND THE LETTER HEADERS ARE GONE** ("it doesnt have to show it just do it
  quietly theyll understand"). Still A to Z — but **the one thing those
  headers were really carrying moved into the SQL**: a callsign that does not
  start with a letter belongs LAST, and the database collation puts it FIRST.
  `byLetter` in roomModel.js was doing that silently, and dropping the
  grouping without moving the rule would have quietly reordered the screen.
  Measured on the live list before it moved. The client formats and does not
  sort.
- **AND NOTHING IN IT IS COUNTED**, which was the owner's first requirement
  for this screen and still holds. No headcount, no "+4", no "of", and
  deliberately no `count(*)` companion in the SQL, because the moment one
  exists a screen prints it.
- **`pgcore.js` ANSWERS BOTH FOR REAL NOW.** `people_search` was `() => []`
  there — the quiet kind of harness lie, because an empty People section is
  also what a correct no-match looks like, so every walk that typed a name
  passed. The demo had its own copy in `seed.js` to work around it, ignoring
  blocks, Fly solo and the identity rule. One implementation, in pgcore, which
  CLAUDE.md already says is "the PostgREST emulation both use".
  - The harness's room seed had **no `pilot_profiles` at all**, which is why
    nobody noticed: there was nobody to find either way. It seeds a class now,
    including the three who must never be found (Fly solo, blocked, and a
    hidden real name) — and NOT Alex, Dana or Haddad, who `fixture.js` already
    defines. Posting those three again appended a second row each, because
    pgcore does not enforce a primary key, and the directory listed "Dana" and
    "Dana Okafor" as two people. Measured on the way in.
- **`npm run check:people` is 40 assertions and IS in `npm run check`**,
  because it needs no browser and no credentials. That is deliberate: the
  three suites that would otherwise have caught a search returning nothing —
  `test:rr`, `test:bm`, `test:exam` — are all outside the gate and all three
  were found red on 2026-10-10. It drives pgcore's RPCs for real and holds the
  no-count rule by reading the rail's own source. Proved by planting its bugs:
  the orbit rule back, the hidden name made matchable, a count rendered in the
  section, and `more` turned into a number.


Rebuilt on 2026-09-15 from a signed-off design (a port brief and a static
demo, handed over outside the repo). Squadrons are group chats, modules are
question feeds, and the right seat is one person and state that expires.

- **`src/components/room/ready-room.css` is the design's stylesheet, kept as
  sent**, with two changes marked where they are made: the light-mode selector
  is the app's own `.app.theme-light`, and two stray lines left over from the
  demo's keyboard hint are gone. A browser read those lines as the start of a
  rule and swallowed the whole `@media (min-width:1660px)` block, so the
  context column never appeared. `check:rr` holds both.
- **`rr-app.css` fits it to the app**: the full-bleed fill, 44px hit areas for
  the design's small controls (§12), the parts the demo drew with markup React
  cannot use, the bridge to the old sheets, Smooth Air, and **contrast**.
  Measured on the surface behind the words, and counting night and day apart,
  21 text pairs came in under their floor in some livery: "Waiting" in day at 2.33, the time in
  your own bubble at night at 2.82, white on the Runway accent in day at 4.22.
  Each fix is an existing token (`--active-fill`, `--active-text`, `--lit`,
  `--t2`) or a mix of two, and `check:rr` re-measures every one in all six
  liveries and both variants.
- **`rr` is also a class in the paper reader** — the Ready Room row in its
  tray. The room's CSS loads lazily and stays, so its bare root rules turned
  that row into a clipped 220px column once the room had been visited
  (measured). It is quarantined in `check:paper` and undone in
  `paper/v6/additions.css`, and the room's own rules key off `.rr-app`, never
  `:has(.rr)`.
- **Answers are endorse-only.** The design puts an up/down pill on every
  answer, but 0010 made answers endorse-only on purpose ("an answer can be
  endorsed, not buried"), so an answer's pill has no down arrow. Questions vote
  both ways (0022).
- **A feed row is not a `<button>`**: the demo nests Save and Share inside one.
  **The chat's hover actions sit inside the bubble**: against the full-width row
  the design's 66px offset put them at the window's edge and scrolled the
  transcript sideways. Report, block, copy, pin, edit, delete and react are on a
  right click, or a long press on a phone, which has no hover.
- **Ticks tell the truth (0027).** One grey tick until everybody a message went
  to has it, two grey until everybody has opened it, blue after that. A
  recipient is a member who had joined when it was sent, not blocked either way
  and not muting its author. App stamps delivery after each chat fetch;
  `mark_squadron_read` stamps reading.
- The rules are in `src/lib/rrModel.js`, held by `npm run check:rr`. To look at
  it: `npm run harness`, then `node tests/harness/room-seed.mjs`. To test every
  livery × night/day × 1920/1512/1024/430, and every control the brief lists:
  `npm run test:rr`.
- **"Invite your class" is a link to send out of the app** (owner,
  2026-09-23), not a room to stand in: `InviteSheet.jsx`, opened from the foot
  of the Library since 2026-10-11 and from Crew's empty state before that. It
  used to open the module's question board, which is a
  reasonable place to be and not an invitation — nothing about it could be
  sent to somebody who does not have an account yet. **The link is the
  MODULE'S** (`/m/<code>`), because there is no class to join: every module is
  open, a visitor who taps it is shown round by the walkthrough before
  deciding anything, and once they have an account their stamp turns up on the
  quizzes they sit, beside the inviter's. That sentence named the **Crew wall**
  until 2026-10-11 and is the copy `check:doors` now guards by name. Sending it is `lib/outside.js`'s job — the share sheet on a phone, the
  clipboard on a desktop, and the link in a field that can be copied by hand
  where neither works, which is why the field is on screen from the start
  rather than after a failure. Nothing claims a success it did not observe.

## Signing in, the walkthrough, and the licence

Rebuilt on 2026-09-21 at the owner's word, in two passes the same day. The way
in is now: **sign up → the walkthrough → the licence**, and nothing else.

- **The login is one centred column** (`AuthPage.jsx`): the wordmark line,
  Clerk's card, and one line under it to cross between signing in and joining.
  **The title is Clerk's own header**, reworded in `lib/clerkWords.js`, because
  it changes at every step ("Check your email") and a title of ours could not.
- **Clerk's main button is styled through `elements`, never `colorPrimary`.**
  Clerk derives shades from `colorPrimary`, and given `var(--accent)` it painted
  the live Continue button transparent (measured).
- **First Flight has no screen.** `FirstFlightGate` makes a new student's
  profile in the background, with the username Clerk asked for as the
  callsign, and heals the callsign for older accounts. It never holds anybody.
  The squadron of livery tails, the module picker and "When do you usually
  study?" are gone, and so is the study-time placement they fed.
- **The walkthrough is a DEMO of the real app** (`src/demo/`), not slides: a
  tutorial over the real screens with a class already in them.

  **REBUILT 2026-10-06 FROM AN APPROVED TOUR, and it is a different thing
  from what came before.** The old one was twenty-five steps, a four-panel
  dim, a docked card placed by `plan()`, and `steps.js`. The new one is
  **TWENTY steps behind a BETA NOTE** — twenty-one until Crew was killed on
  2026-10-08 and its step went with it — and the files are
  `src/demo/tourSteps.js` (the script, word for word as approved),
  `src/demo/tourEngine.js` (the engine, framework-free), `src/demo/tour.css`
  and `src/lib/tourState.js`. `Guide.jsx` is now the wiring and renders
  `null`. `guide.css` and `steps.js` are DELETED — both sheets used the same
  `dg-*` class names, so they could not stand side by side.

  **WHAT DELIBERATELY DID NOT CHANGE**: how it is opened (`?tour`, Replay at
  the foot of the Licence, the three guards below), that it runs inside the
  `pw-demo` sessionStorage demo mode against a seeded class, and what leaving
  it means. `Guide`'s props are the ones App already passed.

- **IT ADDRESSES THE APP BY NAME, not by CSS selector.** A step names a
  `data-tour` value and the engine looks it up; eleven elements carry one —
  `deck-hero`, `deck-modules`, `deck-ground`, `deck-route`, `deck-rightseat`,
  `deck-squadron`, `deck-thread`, `lesson-logbook`, `rr-rightseat`,
  `rr-squadrons`, `rr-modules`. That removes one class of silent failure (a
  selector that stops matching) and adds another (a name nobody applied), so
  `test:tour` checks every name in the script against the running app.
  - **A card's name goes on EVERY one of its render branches.** The right
    seat, the squadron and the thread card each draw two or three different
    shapes depending on what there is to show, and naming only the first put
    the name on the shape the seeded demo does not use: three steps dimmed
    the screen and pointed at nothing.
  - The rail's three sections are wrapped in `.rr-tourgrp`, which is
    `display: contents`, so the rail's own grid is untouched. `rectOf` in the
    engine unions the children of an element with no box of its own.

- **`pane` AND `panelTab` ARE INSTRUCTIONS TO THE PAGE, NOT ROUTES**, and
  they travel as a CustomEvent **plus a standing request**
  (`src/lib/tourState.js`). The event alone was not enough: the step that
  opens the Ready Room navigates and asks for a pane in the same breath, and
  the room is a lazy chunk — so the ask was dispatched into a window with
  nothing listening yet and all four room steps came up on the module
  threads. A page now reads the standing request when it MOUNTS and listens
  for later ones, so the order of the two stops mattering.
  - The detail is the **bare value**. It was `{ pane }` while every listener
    read `e.detail` as a string, so nothing moved and nothing said why.
  - The Ready Room resolves a squadron by its NAME slugified, never by id:
    the ids are UUIDs and a script carrying one would break with the seed.
  - `apply` returns whether the request could be HONOURED, which is not the
    same as received — a squadron is looked up in a list that is empty on the
    first render, and reporting success there spent the once-per-mount guard
    on a lookup that did nothing.
  - **On a room under 900px the rail becomes the visible column**, because
    that is where every narrow step about the room points. Without it the
    lights for Squadrons and Modules came out 20×2px in the window's corner.
  - The lesson maps the tour's `"logbook"` onto its own `"notes"` tab id
    rather than renaming the id, so every stored tab value keeps working.

- **"UNMOUNT" IS NOT "SKIP", and conflating them is an infinite loop.** React
  runs an effect, its cleanup and the effect again on every mount in
  development, so `Guide`'s cleanup fired before the tour had been on screen
  for a frame. Reading that as the student leaving sent `onLeave("skip")` to
  App, which left the demo and reloaded back onto the `?tour` address it came
  from — which entered the demo again. **44 document loads in five seconds,
  measured, with nothing in the console to say why.** The engine's `close`
  carries its reason and only a real Skip is passed on.

- **THE CARD'S HEIGHT IS AN INPUT, SO A CHANGE IN IT RE-FRAMES.** `free()`
  subtracts the card's height to find the room left for the light, and
  `ringTo` clips the light to `f.bot + 4` so it can never stand more than 4px
  under the card. Both read it at the instant they run, before the browser
  has laid out the new step's text — and the cards are not all the same
  height (245px and 268px on two consecutive steps at 390). The light was
  clipped to the room the PREVIOUS card left and then the card grew into it:
  10px of overlap on the lesson's second step, 56px on the deck's modules.
  One `ResizeObserver` on the card, and the overlap is 0.

- **The demo student is on Open frequency** (`pw-social-preset` in `seed.js`).
  `surfacesFor` in `lib/ground.js` draws none of Back on the ground's three
  cards on Quiet skies and only the right seat on My flight, which is the
  default — so two of the three steps about them pointed at a card that was
  not rendered. The seed carries what the tour needs rather than the tour
  claiming something a student cannot see.

- **The deck keeps 45vh of room at its foot while the tour is up** (55vh on a
  phone), which is the one rule carried over from `guide.css`. The card is
  docked at the foot and a target in the last screenful cannot be scrolled
  above it unless the page can scroll past its own end. `tourEngine` sets
  `data-tour-on` on `.app` and removes it on close, so nothing is padded
  after the tour ends. The Ready Room is excluded: it fills the window.

- **Two small pieces of real UI came with it**, and both are the app's rather
  than the tour's:
  - The Library's last row, **"Shared study material · Highlight and take
    notes together"**, with an **IN THE WORKS** pill. It is a `div`, not a
    button — `check:doors` asks that no control be bound to nothing, and a
    row that answers a press with nothing is exactly that.
  - A lesson comment carries **ALSO IN THE READY ROOM**, linking to that
    thread. A lesson comment and a module thread are ONE record —
    `commentsFor` filters the same `threads` array the room's module pane
    reads — so there is no mirroring step to wait for and nothing can be out
    of date. `BmLink`, so the middle click and the status bar still work and
    the plain click goes through `go()`.
  - **The pill is WORDS, so it takes `--active-text` and not `--active`.**
    The brief says `var(--active)`; that token is the accent as a MARK, and
    at 10px on a panel it is the pair this repo has already measured under
    4.5:1 (the module picker's own name, 3.96:1 in Day).

- **The voice is charm and kindness** (owner's word, 2026-09-23): it never
  tells anybody off, and it says what the app will NOT do to them — no locked
  chapters, no guilt over a broken streak, no score on a card set — as
  plainly as what it will. It opens with the beta note rather than a feature,
  the card's kicker names the section and how far through it you are, and it
  can always be skipped. Every claim in `tourSteps.js` is checked against the
  code that does it; change the feature and the paragraph has to change with
  it.
  - **How it stays smooth**: the dim is one element's box-shadow spread
    rather than four panels, the light eases on a transition the engine owns,
    screens change through `go(to, { still: true })` so the app's own view
    transition does not fight the tour's, and every screen it visits is
    warmed while the beta note is being read.
  - **It opens by itself for every visit by somebody who is NOT signed in**,
    on ANY page but sign-in, an invite link, Clerk's account screens and
    **a quiz**. It once waited for `/`, and a visitor who arrived anywhere
    else never saw it. Skip takes them back to the page they arrived on.
  - **THREE GUARDS, BECAUSE IT ONCE TOOK A SIGNED-IN STUDENT'S PAPER**
    (owner, 2026-09-29: "a one off where I was taken back to the tutorial
    mid quiz then back"). Clerk can report `isLoaded` true and `isSignedIn`
    false for a single render while it revalidates a session, and what
    follows is `enterGuestDemo`, a sessionStorage flag and a FULL RELOAD
    into the demo — the paper gone, and afterwards a saves store belonging
    to a guest, which is why the same morning brought "can't bookmark" and
    "old bookmarks are gone". So: the quiz route is on `NO_TOUR_ON`, an open
    paper is refused outright through `examLock()`, and a signed-out reading
    has to STILL be signed out a second later, read from a ref rather than
    from the effect's own closure. A visitor waits a second nobody can feel.
  - **Seen lasts one visit, and a visit is a tab** (`pw-walkthrough-visit` in
    sessionStorage, which survives the demo's reloads). It is written when
    the walkthrough ENDS, finished or skipped. It used to be remembered on
    the device for good, and twice the owner, on a device that had once
    skipped it, reported that it did not trigger at all. A returning student
    stays signed in and never meets it; a visitor with no account meets it
    each time, one tap from gone. **`?tour` on any address opens it for
    anybody**: a visitor as "You", a signed-in student as themselves. A
    signed-in student only gets it by asking: Replay, at the foot of the
    Licence. A visitor is "You" inside it: every Clerk hook comes through
    `src/lib/clerk.js`, which signs a demo guest in as a student who exists
    only in the demo's database. Clerk's components still come from Clerk.
  - **The last button says what pressing it will do**, and that is the one
    thing about the script that is not fixed: "Create my account" for a
    visitor, "Done" for a student who already has a stamp, and the script's
    own "Create my licence" for everybody else. `Guide` passes a copy of the
    script with that one label changed, and reads `guest`/`hasStamp` through
    a ref so the effect cannot restart the tour when App's account state
    settles.
  - **Finishing it as a visitor goes to `/signin?join=1`** (Join is open), and
    the note to open the licence waits in sessionStorage. **Anyone who signs
    up** lands on the Licence with the stamp creator open: FirstFlightGate
    leaves that note when it makes a new profile, and App listens for it.
  - **It is a separate state.** `enterDemo` sets a sessionStorage flag and
    reloads; the whole app then boots against an in-memory database seeded
    with a class (`seed.js`) and a course (`content.json`). Every request goes
    to `backend.js` through the ONE client (`fetch` option in
    `supabaseClient.js`); `localStorage` is a copy in memory (`boot.js`,
    imported first in `main.jsx`); the live socket stays shut. Nothing in the
    demo can write to the real account, and the app underneath the guide is
    not pressable.
  - **The backend is the harness's**: `src/demo/pgcore.js` is the PostgREST
    emulation both use. The harness serves it over HTTP; the demo runs it in
    the tab. Change it in one place.
  - **The demo lesson has a real video**: `public/demo/simultaneous-equations.mp4`,
    five minutes of worked examples drawn on a canvas and recorded in Chromium
    (no ffmpeg on the build machine; `MediaRecorder` writes H.264 MP4 with a
    proper duration, which WebKit plays). Its moments are the seeded logbook's:
    your note at 1:04, the right seat's comment at 3:08, yours at 3:51 and
    your question at 4:36. Only the demo's `content.json` points at it, and it
    is the lesson the tour's two Lesson steps open.
  - **THE DIM IS FOUR PANELS, NOT A BOX-SHADOW** (owner, 2026-10-06: "as
    smooth and exact as the transitions like the demo"). The ported
    stylesheet carries the dim as a fourth layer of the ring's own shadow —
    `0 0 0 100vmax rgba(6,10,18,.58)` — and a shadow that large is repainted
    across the whole window on every frame the ring's width, height or
    position changes. The walkthrough's previous engine had the same thing
    and the same complaint, and this is the fix it landed on, in its own
    words: "a panel is the whole window, scaled from its top-left corner down
    to the strip it covers. Scaling a flat colour is the compositor's job:
    nothing repaints while the light moves." The colour is the ported sheet's
    to the digit and the ring keeps its accent line and glow, which are small
    and local; appearance is unchanged. **The cost is a new way to be wrong**
    — a panel aimed badly leaves an undimmed strip, or doubles the alpha over
    one — so `test:tour` measures the four panels plus the hole against the
    window on every step, at rest, and allows 400px² of rounding.
  - **THE MOTION IS THE HANDOFF'S, AND IT WAS PUT BACK** (owner, 2026-10-06:
    "rework the demo transitions for the final time, I need it to be like the
    demo"). It had been replaced with an rAF ease on the light's own curve
    over 480ms, and page changes eased rather than snapping. That measured
    better — 1 teleport against 3, no reversals, a 128px worst frame against
    891 — and it made every page change about half a second slower to come to
    rest, which is the thing this owner reads as wrong. **"Like the demo"
    means the demo's code**, so `sc.to` is `behavior: "smooth"` again, a page
    change positions in one frame under a closed light again, and the pin that
    held a new screen at its top is gone. The numbers that buys back are
    stated rather than hidden: 3 single-frame jumps over sixteen steps, the
    worst 494px, which is the instant positioning working as drawn.
  - **TWO FIXES WERE KEPT, because neither changes how anything moves.**
    The dim is four transform-only panels rather than a `0 0 0 100vmax`
    box-shadow (see below), and the card's `ResizeObserver` re-frames the
    light without touching the scroll — that one was the step that went one
    way and came back, and the reversal has stayed gone. The light is also
    re-measured on `scrollend`, which is the handoff's own listener: `plan`
    aims at where a target WILL be, and a screen whose height changes while it
    scrolls invalidates that aim.
  - **NOTHING CROPS TO FOCUS. THE PAGE STAYS STILL AND THE LIGHT MOVES**
    (owner, 2026-10-07: "the lesson demo section should show the whole screen
    and only highlight the comments with the box not crop to focous on it,
    never crop to focus show the whole screen at all times only use the
    highlight box to focus on stuff"). The handoff's `plan` CENTRED its target
    in the room the card leaves, so every step scrolled whether it needed to
    or not — measured, **7 of 20 steps**, two of them by 554px and 778px. On
    the lesson that pushed the video off the top and left a close-up of one
    panel. `plan` maximises **stillness** instead now: each dock is offered the
    scroll it already has and the LEAST that would bring the frame in, and a
    standing option wins outright whenever it shows 44px of the target. It is
    **2 of 20** now, and the lesson's two steps scroll 0px.
    - **A thumb on the scale was not enough, and that is the instructive
      part.** The first attempt kept `vis / th` as the score and subtracted
      0.01 for moving. The lesson's panel is taller than the room, so standing
      still showed 238px of it and scrolling 435px showed all of it — 0.46
      against 0.98, which 0.01 does not touch. Visibility was never the thing
      to maximise.
    - Bringing something genuinely off screen INTO view is not cropping, so it
      is still allowed: the Flight Deck's route strip at 1440, and the ground
      and thread cards on a 390 phone where the deck is one tall column.
      `test:tour` tells the two apart by measuring how much of the target was
      already on screen BEFORE the press rather than by a named list.
  - **AND THE AMBIENT STOPS DRIFTING WHILE THE TOUR IS UP, which is what
    "smooth" actually turned out to be** (owner, 2026-10-07: the transitions
    "arent smooth and seamless"). Measured frame by frame on a production
    build, the engine was not the problem — **the light's own glide drops one
    frame across the whole twenty-step walk**. What dropped the other 219 was
    the app standing still: every screen the tour visits idles **under 60fps**
    because of the three light layers `Deck.jsx` drifts behind it. The module
    screen 48fps and 9 dropped frames in two seconds with NOTHING happening on
    it, the Library 50, the lesson 48. **The Flight Deck alone holds 60**,
    which is why six rounds of looking at the engine never found it. Pausing
    those three layers and nothing else: all three screens to a clean 60fps, 0
    dropped. Across the walk, **220 dropped frames to 10**.
    - Paused only under `[data-tour-on]`, because the dim is 58% black over
      them and a drift nobody can see through is cost for no picture. On the
      six `whole` steps the wash is held still for a few seconds, which is
      what Smooth Air already does to it permanently.
    - **The selector is long on purpose.** `animation-play-state` is reset by
      the `animation` SHORTHAND, and `Deck.jsx` declares each layer with it —
      `.deck-light .lamp.key` at (0,3,0) and `.deck-light.aur .lamp.key` at
      (0,4,0). A tidy `.app[data-tour-on="1"] .lamp` is (0,3,0): it ties the
      first and loses the second, so the first version of this rule paused the
      stars and left all three lamps running. Caught by measuring `playState`,
      not by reading the sheet.
    - **The idle cost is the APP's, not the tour's.** A student is paying it on
      every module screen, Library and lesson right now, with no tour in sight.
      Stopping the app's own ambient is a design decision and is NOT taken
      here; it is stated so it is not lost.
  - **AND THE DEAD TIME BEFORE A PAGE CHANGE IS GONE.** A page change measured
    1130ms from the press to rest, of which about 460 were a dimmed screen with
    no light on it at all. Two causes, both dead time rather than curve:
    `Guide`'s `navigate` awaited `getAnimations()` against a 700ms timeout, and
    the ambient layers are **infinite** animations whose `finished` never
    resolves — so that race was decided by its own timeout EVERY time. It
    filters to animations that can finish. And the fade-in carried a `.1s`
    delay in which the light was already in place and deliberately not drawn.
    Worst step 1466ms to 1069ms; the curves and durations are untouched.
  - **Walked, measured and held**: `npm run test:tour` is **369 assertions**.
    It walks every step at 1440 and at 390 and asserts that every
    step naming a target lights one, that what is lit is fully on screen,
    that the card covers none of it (except a `whole` step, where the light
    IS the window), that a step asking for a pane or a tab gets it, that a
    step whose target was ALREADY on screen does not move the page, that a
    step opening a new screen shows it from the top, that no light layer is
    still drifting, and that each step stops moving. It checks every
    `data-tour` name in the script
    against the running app. And it **measures contrast on the card and the
    beta note across six liveries × night and day** — ten text pairs each,
    floor 4.5:1, worst 4.79:1 — because a token is not a contrast ratio and
    this card floats over a dimmed screen rather than sitting on `--panel`.
    Every colour is resolved through a CANVAS rather than parsed: the tokens
    compute to `oklch(...)`, and reading three numbers out of that string
    gave lightness, chroma and a hue angle where red, green and blue were
    expected, which made every pair on every livery come out at exactly 2:1.
    The card standing clear of its target is asserted **at rest**, not on
    every frame: a page change eases now, so the light is mid-travel for about
    half a second after the rest detector lets go, and reading the overlap
    there found 148509 square pixels on a step whose settled geometry is a
    clean 72px gap.
    It needs the harness, so like `test:bm` and `test:rr` it is not in
    `npm run check`.
    Proved by planting its bugs: a dropped `data-tour` attribute, a dead
    `wm-tour:pane` listener, a tab mapping that always answers "notes", and a
    body colour at 4.34:1. Each one fails it; restored, it passes.
  - **QUIET IS ONLY REST ONCE SOMETHING HAS MOVED.** A step that changes page
    awaits a navigation, a pane and a lazy chunk before it touches the light,
    and nothing on screen changes while it does — so the walk's old detector
    accepted 200ms of quiet straight after the press, returned before the
    step had started, read an unlit light and called three good steps dark.
    It waits for the first change, then for the quiet. Median time to rest is
    **~35ms**, worst 540ms, and one step of twenty needs any wait at all
    after that (under 30ms) for the thing it points at to arrive.
- **It ends at the licence.** Finishing it, or leaving a first run, takes a
  student with no stamp to `/account/licence` with the stamp creator open
  (`lib/licenceAsk.js`, which survives the reload out of the demo).
- **The code is the stamp, and they are issued together** (migration 0035,
  `issue_licence`). The code is chosen in the stamp creator and claimed only
  when the stamp is issued, in the same statement. After that neither changes:
  `claim_code` refuses to move it and 0029's trigger holds `code` too. The
  licence no longer claims a code on sight. **Any letter and any digit can be
  typed.** 0, 1, O, I and L used to be dropped as they were typed, and a
  student saw "A10" lose two characters. Suggestions still avoid those five.
  `npm run check:licence-db` drives it live.
- **A code is ONE TO THREE characters** (owner, 2026-09-23; migration 0039).
  It was exactly three, and two students had already issued a stamp they did
  not want because three was the only length the field would take. Three is
  still the ceiling and still what a suggestion is. The rule is in four
  places and they have to agree: the CHECK `pilot_code_shape`, `claim_code`,
  both arities of `issue_licence`, and `src/lib/code.js` — a client that let
  somebody type a code the database refuses is the worse half of the bug.
- **A STAMP IS OPTIONAL, AND THE APP NOW SAYS SO QUIETLY UNTIL THERE IS ONE**
  (owner, 2026-10-12). A student is taken to the creator once, when
  FirstFlightGate makes their profile, and can close it — so an account can go
  on indefinitely with no stamp, and every surface that would carry their mark
  draws the faint house seal instead. The owner found one that way, on a quiz
  her class had sat: "I can see her profile, it doesn't have a stamp."
  - **NOTHING WAS BROKEN, and the first job was proving that.** `quiz_finishers`
    (0038) and `quiz_leaderboard` (0036) both return `stamp_issued_at` and the
    stamp columns, `stampOf` answers null only when `stamp_issued_at` is
    missing, and CrewStrip and Leaderboard both pass
    `on={Boolean(...stamp_issued_at)}` so a stampless person is drawn faint on
    purpose. **The catch is that a missing stamp and a missing JOIN render
    identically** — same faint seal — so the screen cannot tell you which it
    is, and neither could I without the data. Worth remembering before reading
    the next blank one as a bug.
  - **The reminder is a dot and a row, and nothing else.** `ProfileMenu.jsx`:
    a 9px `--active` dot on the avatar, which is already on every screen, and
    a row inside the menu that says **"Make your stamp"** and stops.

    **IT CARRIED A SUPPORTING LINE TWICE AND LOST IT TWICE.** First "your mark
    on the work you sign", which the owner cut as the wrong half of the truth
    (2026-10-12: "pitch it as your stamp in our community"); then "It's your
    identity here, and how the rest of the class knows you", cut the same day
    ("just have it say make your stamp. That's it. We don't need the extra
    words"). The row is in the account menu, under the student's own name,
    beside a dot on their own avatar — the context already says whose stamp
    and where it lives, and the sentence was the menu arguing with somebody
    who had not asked a question. The TITLE was right from the first draft.

    Both go the moment a stamp is issued and
    there is nothing to dismiss, because a reminder with a Dismiss on it is
    one you have to nag about twice. It gates nothing and counts nothing.
  - **It waits for the profile.** `profile` is null while the row is in
    flight, so the condition is `isSignedIn && !profileLoading &&
    Boolean(profile) && !hasStamp` — without the middle two it flashed on
    every page load for people who already had one, which is exactly the
    bothering it must not do.
  - Measured across six liveries x night and day: the row's second line is
    `--t2` on `--raised`, worst 6.17:1 against the 4.5 floor.
- **A stamp is permanent, and the one exception is a change that was
  GRANTED.** `pilot_profiles.stamp_redo` is a count, not a date: 0039 gave
  exactly one to every account that had already issued a stamp, and
  `issue_licence` spends it in the same UPDATE that changes the stamp — which
  is the only shape of change `stamp_is_permanent` allows. When it is spent
  the account is back under the original rule with nothing to turn off, which
  is what a window would have needed. Because RLS is open here by design, the
  credit is protected too: the trigger refuses any UPDATE that RAISES it
  unless `pw.grant_redo` is set, and only `grant_stamp_redo()` sets that —
  granted to `service_role`, never to anon. On the licence, a stamp with a
  change owed becomes the door back into the creator ("Make it again") and
  the creator opens on the stamp they have rather than a blank one; with
  nothing owed it is the picture it always was. `changesOwed()` reads it from
  your OWN row rather than `licence_card`, because whether you are owed a
  remake is nobody else's business.
- `UsernameGate` is for an account with no Clerk username, in First Flight's
  look, and reveals the app in a transition while holding the gate during its
  save. The app's screens are lazy, and an urgent reveal suspended with no
  boundary above it and took the whole app down (measured with
  `?username=none`).

## The Studio

`/studio`, admin only, behind `admin.studio` — the owner, 2026-09-30: "I want
a way as an admin to add quizzes and study cards and papers natively, like
how I feed you those — add, delete, edit. Build a demo." This is that demo,
and what it demonstrates is the whole loop: drop the same .docx, watch it
become a quiz or a card set, edit any question by hand, attach a paper, take
the result away.

- **It reads a .docx in the browser, with no library.** `src/lib/docxQuestions.js`
  walks the ZIP's central directory, inflates `word/document.xml` with
  `DecompressionStream("deflate-raw")` and scans the XML: a paragraph
  starting `<n>.` is a question, one starting `a.`/`b.`/`c.` is an option,
  and the answer key is the one table whose rows start with a number. Run
  against the owner's three real documents it produces the same counts and
  the same answer spreads as the Python importer that has been doing this by
  hand. `npm run check:studio` drives it against a .docx the check BUILDS —
  a real zip with a real deflate-raw entry — because a check that needs a
  file in somebody's Downloads fails on every other machine.
- **A question the key does not answer is REPORTED, never guessed.** An
  importer that quietly answered "a" would put a wrong answer in front of a
  student with nothing to show for it.
- **It edits the RAW document**, not the normalised one the screens read:
  what has to come out is `src/content/test-content.json` key for key.
- **AND IT PUBLISHES** (migration 0040, the owner's "build it", same day).
  The course document has a home the app reads at runtime: `course_docs`,
  newest row wins, read by `current_course()` and written only by
  `publish_course()`. A draft still lives in the browser until Publish; the
  version line at the top says which version is live, who published it and
  when. Export stays beside it, because a commit is still what the next
  build ships with — the two are not rivals.
- **THE COURSE IS THE ONE TABLE HERE THAT ANON CANNOT WRITE.** 0009's rule —
  open policies, access control in the app — costs a student their own rows
  if it is abused; for the course it would cost the syllabus. So
  `course_docs` has a SELECT policy and NO insert, update or delete policy
  at all, and RLS refuses what no policy allows. The only way in is
  `publish_course`, SECURITY DEFINER, which demands a **publishing key** it
  compares as a SHA-256 digest and never returns. `course_keys` has no
  policies either, so the digest is not readable with the publishable key.
  It is a shared secret rather than an identity, and that is a stated limit:
  there is no trusted identity to check here (a uid is a claim, and every
  user id in this database is readable). The day there is a server of our
  own it becomes a token check and the table does not move. The key is in
  `.env.local` as `COURSE_PUBLISH_KEY`, never in the repo, and rotating it
  is `select set_course_key('…')` as service_role.
- **A PUBLISH CANNOT EMPTY THE LIBRARY.** The SQL refuses a document with no
  modules, a module with no id or name, or a chapter with no id — the three
  things progress, saves and stamps are keyed to. The client refuses more
  than that: `validateContent` runs before the RPC and again on what comes
  back, and a published document that fails it is treated as no document at
  all, so a bad publish costs a version rather than a class's evening.
- **Reading it is allowed to fail.** Four-second timeout, every error
  swallowed, and the answer is then the document the build shipped with —
  an empty table, a paused project or a slow phone must never be a blank
  Library. `content.live` is the switch that takes the table out of the path
  for everybody without a deploy, and the demo never reads it at all.
- **A PUBLISH CHECKS ITS PAPERS ARE ACTUALLY THERE.** Publishing can put a
  `downloads/…` row in front of the class tonight while the FILE only
  arrives with the next commit, so every path is fetched first and the
  publish stops with the file's own name. It reads the first five bytes
  rather than the status: this app answers every unknown path with
  index.html and a 200, on the dev server and on Vercel both, so `r.ok`
  called every missing paper present — measured on the way in, and the
  reason the check greps for `%PDF-`.
- `npm run check:course-db` drives all of that against the live database —
  14 assertions including a publish, a wrong key, three malformed documents
  and an insert, a delete and a patch attempted with the publishable key —
  and deletes every version it makes, which puts the previous one back on
  top. Like the other live checks it is NOT in `npm run check`.
- **The draft key is `wingman.studio.draft`, not `pw-`**, because the storage
  epoch sweeps every `pw-` key when content is replaced — exactly when
  somebody is most likely to be part-way through writing the replacement.
- **A paper's page count is READ from the PDF, by COUNTING PAGE OBJECTS IN
  THE BYTES.** Not with pdf.js: papers are paused and `check:paused` asserts
  that none of the reader's libraries reach the build at all, and one import
  of the app's own put a 357KB chunk back into it (caught on the way in).
  This is a page count, not a render — a scan of a few hundred kilobytes
  answers it, and a PDF whose pages hide inside object streams answers 0,
  which the screen says out loud instead of inventing a number. The row
  prints that number to a student, so it is not typed.
- **Export is refused while a question is unfinished** — no stem, fewer than
  two answers, no right answer chosen, or an id used twice. `check:question-ids`
  is in prebuild and would fail the build anyway; the footer says which.
- **`studioModel.js` holds everything that is not a screen**, the way
  `quiz.js` does for the exam and for the same reason: a rule that lives in
  a component is a rule somebody tidying the markup can change. It is a
  plain module so `check:studio` can IMPORT it and drive the ids, the
  copying, the searching and the faults for real rather than grepping the
  JSX for them.
- **IT SITS ON `--panel`, AND THAT IS THE WHOLE LEGIBILITY FIX** (owner,
  2026-09-30, who photographed it on Aurora: "see how it is, fix it across
  all liveries"). It was laid straight on the deck, so its prose was read
  off whatever the livery paints there — under Aurora a moving teal sky with
  a starfield. No token can be measured against a picture. On a surface the
  palette knows, it can be: `check:studio` composites ground → panel →
  raised in OKLab and measures every text pair on all six liveries × night
  and day × three finishes (Aurora has no day), 180 pairs, floor 4.5:1,
  worst 5.40:1. Two things came out of that measurement rather than out of
  an opinion: **Publish takes `--active-text` under Manual in Day**, which
  is Bookmarks' own rule (the finish leaves `--active-fill` at the accent's
  lightness, so a filled control is pale on cream — 3.94:1 on Runway), and
  **a broken question says "needs a look" in `--t2`, never in `--caution`**,
  which measured 2.24:1 on Beacon in Day. Caution is an annunciator amber
  lit to be read as a lamp on a dark face; it is the row's EDGE here and the
  word beside it carries the meaning.
- **FORTY QUESTION EDITORS AT A TIME.** A chapter here is 345 cards, and
  drawn whole that is about 1700 inputs where typing in any one re-renders
  the lot. Forty, then more on asking — and search is the other way through.
- **Search reads the stem, every answer, the reason and the ID**, and a bare
  number (or `#212`) is a PLACE rather than a word, because those are the
  two ways the owner names a question. What it hands back is each question's
  REAL index: a filtered view that renumbered would delete the wrong one.
- **Choosing several and doing one thing to them**, because the quiz is
  drawn from the set and "these forty are also the quiz" is the commonest
  edit there is. Copy or move to the other exercise, or delete. They are
  chosen BY ID, not by position — moving and deleting change every position
  after them — and nothing stays chosen across a chapter, a tab or a search.
  **A copy re-issues every id in the destination's space**: quiz and cards
  share one id space (`check:question-ids`), so a copy that kept its id
  would be the same id twice and would fail the build.
- **A broken question is marked where it stands, and the footer is the way
  there.** Each fault carries its address — module, chapter, exercise,
  position — so the sentence is a button that opens that chapter, switches
  to that tab and searches for that place. The sentences alone told the
  owner a question three hundred rows down was broken and left him to find
  it.
- `npm run check:studio` is 45 assertions.

## The pill in the corner, and who reads it

**"Something's wrong here" is fixed to the bottom-left of every screen**
(`ReportProblem.jsx`). It always knew WHERE a student was — the route, the
viewport and the user agent go with every report, so nobody has to describe
the page they are looking at. What it never asked was WHAT was wrong (owner,
2026-10-06: "should mean something when pressed"), so three reports had
reached the table saying only that somebody somewhere was unhappy with
`/account/appearance`.

- **It asks now, and the answer is OPTIONAL.** One line, pre-focused, Send.
  Sending nothing still sends: a student who taps the pill and cannot put
  words to it has still told you the page is wrong, and refusing that would
  lose the report the feature was built for. The placeholder says the page
  comes with it, so nobody spends their sentence describing the route.
- **The composer is its own chunk** (`ReportAsk.jsx`). The pill is on every
  screen and the sheet is only ever needed after a press; in the entry it put
  the bundle 4KB over its budget.
- **`/reports`, admin only, behind `admin.reports`** — the same shape the
  Studio uses, including the sentence-and-a-way-back for anyone else rather
  than a 404, because a 404 for some people is a link nobody can send.
  - **The sentence leads.** A report's value is what the student said; the
    route, the viewport and the device are evidence underneath it in the
    quiet tier. A row with no sentence still says where and when.
  - **ONE TABLE, THREE MEANINGS**, sorted out in `reportsStore.js` rather
    than in the screen: `target_type` `route` is somebody pressing the pill,
    `target_id` `stylesheet` or `layout` is **the app reporting itself** from
    `recover.js` and `canary.js`, and anything else is 0005's content
    moderation. A device row carries the caution edge, because nobody pressed
    anything and those come from phones nobody here can hold — one had been
    sitting unread since the styling problem was last chased by hand.
  - **`reason` is parsed defensively.** It is free text in the schema and
    three different writers put things in it; a screen that assumed JSON
    would throw on the first hand-written row and take the list with it.
  - **Mark done / Dismiss write `status`**, which 0005 already declares
    (`open` | `actioned` | `dismissed`), so no migration was needed. The
    screen changes first and the server follows, the way `savesStore` does.
- **The harness was lying about the schema, and that is fixed too.**
  `pgcore.js` defaulted every inserted row's `status` to `"ok"`, which is
  right for a paper annotation and wrong for a report: 0005 declares
  `reports.status` default `'open'`, so the Open filter found nothing in the
  harness while the live table was full of it. A stand-in backend that
  defaults a column differently from the real one is a harness that lies
  quietly, and the demo runs on the same file.

## Off for launch, and Manual

- **Papers are off** (`paper.viewer` is `everyone: false`): nothing in the
  Library, the subtitle, Bookmarks or the paper address. The demo says a
  reader for module-wide shared PDFs is coming.
- **Aurora is OUT again** (owner, 2026-10-04: "remove aurora"). Out on
  2026-09-21, back on 2026-09-29, out again now — three moves of one line, so
  it is written to move cleanly. **It is a filter, never a deletion**: Aurora
  stays in `FINISHES`, every renderer keeps drawing it, and `check:contrast`,
  `check:surfaces` and `test:bm` keep measuring it, so nothing rots while it
  is out and putting it back is that line again. Deleting the renderers to
  tidy up is what would make the next reinstatement a rewrite. `offeredFinish`
  is the other half: an account stored on Aurora reads back as Standard rather
  than painting nothing. The `livery.aurora` FLAG is a different thing and
  stays off — it gates the retired aurora LIVERY (`RETIRED_TO_FINISH`).
- **THERE ARE TWO FINISHES: Standard and Manual** (owner, 2026-10-05: "kill
  tye dye, just have manual and standard"). Two pattern finishes were built
  and killed in two days — **Tribal** (a four-blade rotor tile, 2026-10-04)
  and **Tie-dye** (a jet-turbine fan disc over a dyed spiral, the next day) —
  and both are **DELETED rather than filtered**, along with
  `src/lib/finishPattern.js`, the `?pattern` demo desk and `check:pattern`.
  - **That is the opposite of Aurora's treatment and the difference is
    earned.** Aurora stays standing while unoffered because it has shipped,
    been withdrawn and been reinstated twice, so its renderers will be wanted
    again. A finish nobody ever chose has no such history, and `git show` has
    all of it if either is ever wanted back.
  - **The bundle budget went back to 680KB with them.** It was raised to 684
    for the patterns; a budget raised for something that is gone is a gate
    quietly loosened, which is exactly how `check:bundle`'s own header says
    budgets die. The 4KB it once bought is still available and named in that
    comment: `AUR`'s spec table is in the entry on every first paint for a
    finish that is not offered, and only `finishVars`'s aurora branch holds
    it there.
- **The stamp engine is the launch pack's, byte for byte**:
  `src/lib/stamp-engine.js` is `docs/launch/code/05-stamp-engine.js` between
  two marker lines, with only FONTS, one page-level `<svg><defs>` (first in
  `<body>`, because the engine finds its defs with `querySelector('svg
  defs')` and measures paths there) and an export list around it.
  `check:stamp` fails on one changed byte. `src/lib/stamp.js` is the app's
  layer and draws nothing. The creator is `15-stamp-creator.js`'s markup in
  React, under `03-stamp-creator.css` (scoped into `ref-licence.css` by `npm
  run ref:css`), rendered into `.app` through a portal so its scrim covers
  the window. `?creator` opens it for anybody — a preview when you cannot
  issue — and `npm run test:creator` walks the owner's eight-line list
  against any base, measuring "rim text never touches a border" in pixels.
- **Six stamp shapes**, not eight: shield and hex (the bolt head) are not
  offered (`SHAPE_IDS` leaves them out, 0037 refuses them). The engine still
  draws both.
- **Manual is drawn, not lit, everywhere** (`manual-stencil.css`): a fill
  becomes a 1.5px stroke of the same colour in the top bar, the Ready Room and
  Bookmarks, as it already was on the Flight Deck.
- **The lighting behind every screen is blurred once, not every frame**
  (`Deck.jsx`): each light layer is an outer element that drifts and an inner
  one that carries the blur. With both on one element the browser re-blurred
  three layers sixty times a second; software-composited idle went from about
  4 fps to 20-33 on every route, identical at rest.

## The Flight Deck's instrument strip

Four instruments in one row — gyro, flight bag, hour meter, radar — inside
`.deck .card`, with the gyro on a wider track because it is the widest dial.
At 860px they go equal; at 600px the gyro takes the top row and the other three
sit abreast under it, which is what keeps the Modules grid above the fold on a
390x844 phone. The Manual finish draws the same four in `PaperStrip.jsx`.

- **There is no checklist cell.** It drew one lamp per chapter flown — the same
  fact the module card states in words and the route strip states again — and
  it was the only instrument that could not survive a module with chapters in
  the tens. `.lamps`, `.lamp` and `--legs` went with it (2026-09-18).
- **The flight bag is the briefcase**, built in layers: back wall and handle,
  three sheets inside, front wall with its seam and latches. Empty it is grey
  with the latches shut and says nothing at all; filled it lights in the
  livery, the latches spring, the sheets stand proud and riffle one at a time,
  and the only text is the number. It counts THIS module's saves and opens
  Bookmarks on it. `FlightBag` is the one part of that feature imported
  eagerly, because it is on the first screen.
- **The hour meter reads hours and minutes**: `13h 54m`, the numbers lit and
  the unit letters quiet. `hobbsClock` in `hobbs.js` floors — a meter never
  reads time nobody has flown — shows minutes alone under an hour, and an em
  dash under a minute, because `0m` is a zero count. This REVERSES what this
  file used to say: it read `0013.9` on a tenths drum, "because that is what an
  hour meter reads and what the hours in a logbook are written in", and a clock
  face was the thing it must not be mistaken for. Nobody outside a cockpit
  reads a tenth, and this cell is read by somebody deciding whether they have
  done enough today. `check:gyro` holds the new shape and the one rule that
  survived: always down, never up.
- **It counts time inside that module and nothing else**: the module screen, a
  lesson, a quiz or a paper in it (`MODULE_ROUTES` in App.jsx). Not the Flight
  Deck, not the Ready Room, not another module. Per student per module, in
  seconds, in `pw-hobbs` through `merge_progress`; flushed every 20s, on the
  route change out and on `pagehide`.
- **It stops on a hidden tab**, and that is a decision rather than an
  oversight: a window left open on a module overnight would otherwise add eight
  hours nobody flew. If that should change, it is one listener in `hobbs.js`.

## Bookmarks, study cards and the flight bag

Four folders, locked: **Questions · Study cards · Videos · Pages**, at
`/bookmarks` and `/bookmarks/:folder`. Ported from a signed-off design (a pack
of 31 files handed over outside the repo, 2026-09-18); `claude/brief-bookmarks.md`
is the brief, `claude/bookmarks-survey.md` is what the repo turned out to be,
and `claude/bookmarks-report.md` is what each rule measured.

- **`saves` is one table and `savesStore.js` is its only writer** (migration
  0028). The screen changes first and the server follows; if the server
  refuses, the row goes back and the student is told, with Retry. Nothing is
  ever shown as saved that is not saved. `npm run check:saves` drives the
  store against a stand-in server — 29 assertions, no browser.
- **A PRESS ALWAYS ANSWERS.** `addSave` used to return a bare `{ok: false}`
  when the store had no student, and the button swallowed the press: no
  toast, no error, nothing — which is what a session read as signed out for
  a moment looks like from the outside, and what was reported on 2026-09-29
  as "can't bookmark". It returns `reason: "nobody"` now and the button says
  "Sign in to keep this one" with a way there. Every other failure keeps its
  Retry.
- **The drop's SQL could not work here.** It defaulted `user_id` to
  `auth.jwt() ->> 'sub'` and wrote four policies against the same claim; this
  client sends the anon key as its own bearer, so that claim is NULL on every
  request and every insert and select would have failed silently (0009's
  header). 0028 mirrors the comments pattern instead, and its header states the
  cost: anyone with the publishable key can read `saves`, as they can every
  other table here.
- **A saved question points at the question, never at "question 4 of quiz 1".**
  `contentLoader.js` still falls back to a positional id so a runtime without
  one renders; `npm run check:question-ids` is in **prebuild** and fails the
  build if any question lacks a stable id, two share one, or an answer indexes
  nothing.
- **Three kinds of lookup, and the third is what stops the feature deleting
  somebody's bookmarks.** `content.question/lesson/paper` answer with the thing,
  with `null` when the author deleted it, or with `undefined` while nothing is
  known yet. Only `null` prunes — and pruning DELETES from the server, so
  answering "gone" while the content chunk was still in flight would empty a
  student's list on a slow connection.
- **A question saved from the quiz and the same question saved from its card
  set are two rows**, deliberately: one is practised as a quiz and the other is
  flipped as a card, so `kind` is part of what identifies a save.
- **The reader's page bookmark was already there.** v6 has drawn "Bookmark this
  page" since the rebuild, into a `Set` in localStorage. It now writes a `saves`
  row beside it and the two are unioned at mount — the local list is what the
  island repaints from on the same frame, the row is what survives the device.
- **Settings is gone and Bookmarks has its row in the profile menu.** The page
  was not empty, whatever the brief said: it held the callsign field (already
  on the Licence tab, with the server-side uniqueness check), the blocked list
  (the only way to unblock anybody) and three settings with no other door. The
  blocked list is in Preferences, in its own box; `/settings` and `/saved`
  both resolve to `/bookmarks`. `PilotSettings` sat below it and is **gone**
  (2026-09-20): it held no setting, only a written-out list of the four things
  this app sends, and the launch handoff cuts it — replies, answers, squadron
  messages and the right seat are on by default and are not a choice.
- **The accent is three tokens on this surface, not one**: `--active` for a
  mark, `--active-fill` for a fill, `--active-text` for the accent read as
  words. Measured rather than argued — the module picker's own name came in at
  3.96:1 on `--active` in Day. The Manual finish leaves `--active-fill` at the
  accent's own lightness, so it alone takes `--active-text` as its fill.
- `npm run test:bm` walks it: 6 liveries × 2 lightings × 3 finishes × 4 widths,
  every control on the brief's R10 list on a desktop and a phone, Smooth Air,
  and the launch sweep — offline, two tabs, a second student, a deleted
  question and a keyboard-only pass. **Aurora has no Day while Aurora is
  OFFERED**, and it is not: this said "30 real skins, not 36" because
  `App.jsx` forces night on that finish, but `offeredFinish` has read a stored
  Aurora back as Standard since 2026-10-04, so Day is honoured and all 36 are
  real — twelve of them wearing Standard. The walk runs the ask through the
  app's own filter rather than restating the rule, so it is right either way;
  the day Aurora is offered again those twelve measure a night sky with no
  edit. 672 states in all.

## When a deploy lands under an open tab

**A DEPLOY INVALIDATES THE CHUNK NAMES A LOADED TAB IS HOLDING.** The owner
hit it with the walkthrough open across six deploys in an hour: `Unable to
preload CSS for /assets/LibraryBatches-B3D89J1k.css`, which 404s, because his
`index.js` was two deploys old and named files that no longer exist. A reload
fixes it — the HTML revalidates and names the new ones — and `chunk()` in
App.jsx reloads once so it can never loop. Two things were wrong with that
once:

- **The flag was set and never cleared**, so "once" meant once per TAB for as
  long as it lived. A tab that had recovered from one bad chunk weeks of
  deploys ago could never recover from the next. It is cleared the moment any
  chunk loads, so the budget is one reload per incident.
- **It reloaded on ANY error out of the factory**, including a genuine crash
  inside a screen's module scope — which a reload cannot fix, and which would
  burn the one reload a later stale chunk needed. Only the three messages a
  browser uses for a module or its CSS failing to arrive get the reload
  (`STALE_CHUNK` in App.jsx); everything else is thrown to the boundary,
  which is where a real bug belongs.

## When a tab is a network request

**THE LIBRARY HITCHED ON EVERY SINGLE OPEN** (owner, 2026-10-07: "the libafy
hithes before it loads always"), and it was not the content or the entrance
animation. `LibraryBatches` was a **6KB lazy chunk behind `fallback={null}`**:
press the tab, get a blank, wait for an HTTP round trip, watch it pop in. Every
time, because nothing warmed it. `LessonsWaiting` on the tab beside it was the
same defect twice over — 1.6KB of JS and 2.2KB of CSS as **two** separate
requests.

Both were lazy for a reason that had already gone away. They carry the ported
design's stylesheets and in the ENTRY those put the bundle over budget — but
`batches.css` moved into `LibraryTab.jsx` on 2026-10-06, and that file is part
of the **module** chunk, which has been its own chunk since the static-import
leak was found. So the lazy boundary bought the entry nothing and cost a tab
press a round trip. Both are static imports now, folded into a chunk that is
already downloading when the module screen opens, and the tab paints in the
frame it is pressed.

- **The entry did not move**: 640KB against the 680KB budget, before and after.
  The module chunk went 36KB to 43KB, and 41 split chunks to 39.
- **A lone stylesheet is also a file that can fail on its own**, which is the
  thing the previous day's PR fixed for `batches.css` by hand.
- `check:bundle` still holds the entry, so if either ever reaches it the budget
  fails and names the path.

## What rides first paint

**41KB CAME OUT OF THE ENTRY CHUNK ON 2026-10-06, by deleting one line.**
`App.jsx` carried `import { MODULE_TABS } from "./components/module/ModuleScreen.jsx"`
beside its own `chunk(() => import(...))` of the same file — and never used
the import: the only other mention of `MODULE_TABS` in App.jsx is a comment.
A static import wins, so Rollup put ModuleScreen and everything it reaches
(LibraryTab, CrewTab, LogTab, Instruments) in the ENTRY and left the lazy
chunk as a re-export. A screen nobody has opened was on every first paint.
The entry went **680KB to 639KB** and the module screen got the 36KB chunk it
was always meant to have.

- **Nothing warned.** The build is silent, the chunk still appears in the
  listing at a plausible size, and the size budget could not catch it because
  it was inside the number all along. So `check:bundle` now asserts that **no
  path App.jsx imports dynamically is also imported statically** — it reads
  the source rather than the build, because the pairing is the thing that is
  wrong and the source is where it is legible. Proved by planting the line
  back: the check fails and names the path.
- A screen that really does need to export a constant can — move it to a
  module of its own. `lib/routes.js` already holds `CHAPTER_TABS` and
  `PROFILE_TABS`, which is where `MODULE_TABS` would go.
- **The budget stays at 680KB** rather than dropping to what the build now
  achieves. That is a judgement: this find is the headroom the next screens
  get ported into, and a ceiling re-cut to the day's number every time
  something is saved never buys anything.

## Every door leads somewhere

`npm run check:doors` is nine assertions against the whole app, not a feature:
no control bound to nothing, every path it can build resolving, every renamed
path landing in one hop, every route name answered in App, no copy naming a
screen this app no longer has, every empty line naming its next action, every
flag gating something, and every progress key having both a reader and a
writer. The last two carry a **named** list of the exceptions, so the five
flags and six keys that are already one-sided are stated rather than silent and
a sixth or seventh fails the build.

- **It reads prose across newlines and across `{interpolations}`.** Cut at
  either and half of every sentence in the app goes unread — which is exactly
  how "you can undo it in Settings" outlived Settings by a commit.
- **The reader's chrome binds by delegation**, not by `onClick`: one handler on
  the island reads `id` and `data-act` off whatever was pressed. A button there
  with an id is wired, and `check:paper` is what holds it.
- The suites share one harness store, so a walk that changes a student's livery,
  lighting or finish **puts it back in a `finally`**. `test:bm` did not, and
  `test:exam` then failed on a Manual ground it had never asked for — which
  reads as a bug in the exam rather than as the previous run's litter.

## Screen changes and transitions

Every navigation, tab, pane and popup moves on one motion system — the Mission
Control tokens at the top of the view-transition block in `app.css`
(`--wg-settle`, `--wg-spring`, `--wg-fade-in/out`, `--wg-panel-travel`,
`--wg-pane-travel`). `src/lib/viewTransition.js` decides what kind of move a
navigation is and names the layers that move; `src/lib/tabMotion.js` moves the
things that are not navigations.

- **THE PORTED MODULE SCREEN LEFT THE MOTION SYSTEM, AND NOTHING SAID SO**
  (found 2026-10-13, by running `test:vt` for the first time since it went
  red). The layers that move are named by SELECTOR, and three of them were
  keyed to the app's own module screen — `PANELS` as `.mcard > .pane`, `CARD`
  as `.mscreen .mcard`, `MCARD_HERO` as `.mscreen .mhero`. The ported screen
  is neither a `.mscreen` nor a `.mcard`, so when `library.batches` went on
  for everybody on 2026-10-10 **the most-used screen in the app stopped
  moving**: no morph from the deck card into the heading, no slide between
  Lessons and Library, no height morph on the card. The build was silent and
  the only thing watching was outside `npm run check`.
  - `PortPanel` wraps its body in one `.pane`, because `wg-tabpanel` needs a
    single element and the body was three bare children of `.card`. Safe
    because `.card` is `display: block` and port.css has no child, sibling or
    nth-child selector on it — **measured before adding it**, and the geometry
    after is the same to the pixel.
  - The ported heading carries `mhero`, the app's own name, which nothing in
    port.css styles.
  - **And `CARD` is read as a whole list now.** It was `CARD[0]` and nothing
    else, so adding a selector to it would have been dead weight — the kind of
    fix that looks right in the diff and changes nothing.
  - **The ported tab strip has no sliding pill, and that is the demo's
    decision**: it shows the selected tab through `aria-selected`, the pill
    belongs to the app's own five strips, and putting one here would be a
    change to an approved design rather than a layout fix. The panel and the
    card's height are asserted; the pill is not asked for on that strip.
- **The router is `TransitionRouter`, not `BrowserRouter`, and that is load-
  bearing.** react-router 7 wraps every location change in
  `React.startTransition`, which `flushSync` cannot hurry — so the browser
  photographed the OLD page as the after-frame and the new one popped in once
  the transition had finished. The component also hands Back, Forward and a
  swipe to the same path as a click (`popHandler`), which is why the browser's
  own buttons animate. Put `BrowserRouter` back and both break silently.
- **One path for every navigation**: `go()` and the pop handler both call
  `runNavigation` in `App.jsx`. A control that calls `navigate()` directly skips
  the transition entirely — the quiz row and the chapter tabs both did.
- **Exactly one thing is named per kind.** A screen change names `.deck`
  (`wg-content`, never `.deck-inner`, which Suspense can hide between the name
  and the snapshot) and the app bar (`wg-topbar`, which is what lets it leave
  and return around the full-bleed Ready Room). A tab names only the panel,
  plus the module card's height (`wg-card`) and a lesson's video (`wg-player`).
  The room names its pane or, between questions, its detail column — and on a
  room narrow enough to show one column at a time (≤900px rail/pane, ≤1180px
  list/question), whichever column is on screen carries the name, so the one
  you left crossfades into the one you opened. Naming more than moves lifts a
  part out of its screen onto a clock of its own.
- **plus-lighter only on an undimmed pair on one clock.** Screen changes blend
  normally (both sides carry brightness(), and added they spike). A pane, a
  detail column, a tab panel or the lesson video fades old at 1 − e(t) and new
  at e(t) on the same duration and curve and adds them, which is the only
  crossfade with no dip. `check:transitions` holds both halves of that rule.
- **A tab's pill is NOT a view-transition layer.** Named, it painted over the
  tab labels for the whole slide (measured). It slides in the page instead
  (`useTabPill`), under every label, and shows through the live snapshot.
  At rest it is pixel-identical to the old selected-tab look — diffed on all
  five strips (module, Account, lesson, reader) in two liveries, night and day.
- **The root paints once**, except when the backdrop really changes: the exam
  sets `<html data-screen="exam">`, and a move into or out of it raises
  `data-vt-backdrop` so the ground dissolves instead of cutting. The exam sets
  that flag in a LAYOUT effect: the quiz commits after a Suspense retry, and a
  passive effect from that commit ran after the page had been photographed —
  on a production build only.
- **Kinds are enumerated in the CSS**, never excluded with `:not()` — the
  minifier strips qualifiers in front of a `::view-transition-*` pseudo-element.
- Smooth Air and `prefers-reduced-motion` mean NO motion, not less:
  `canTransition()` and `motionOff()` return early, and every CSS rule sits in
  a `no-preference` block or has a `.smooth-air` override.
- `npm run test:vt` walks the brief's own checklist against the harness and
  fails a step unless each named area animates on both sides, the pill,
  switch, popover, dialog or sheet that should move did, and nothing shifted.
  `VT_VARIANT`, `VT_LIVERY`, `VT_WIDTH` pick the skin and size;
  `VT_MOTION=smooth-air|reduce` inverts it — a step then passes only if
  nothing animated. `VT_BROWSER=webkit` walks it in Safari's engine, which is
  what most of these students' phones run: everything moves there except a
  closing `<dialog>`, which needs `overlay` — Chromium's alone — so the
  end-exam dialog and its backdrop cut on the way out in Safari and the walk
  asks each engine for what it has. Frames are only meaningful on a production
  build on a GPU:
  `npm run harness:prod`, then `VT_BASE=http://127.0.0.1:5191 VT_GPU=1
  VT_CPU=4 VT_FRAMES=1 npm run test:vt`. The headless shell rasterises in
  software and the dev build of React does several times the work, and both
  once made a smooth transition measure at 200ms a frame.

## When a download fails

`src/lib/recover.js`, installed first thing in `main.jsx`. The owner opened
the live site on a phone and got a half-styled Flight Deck — Safari's own grey
buttons, nothing laid out — and the course's "goes in here" placeholder: the
stylesheet and the course document had both failed on that visit, and nothing
could recover without a manual reload. Screens already could: `chunk()` in
App.jsx reloads once when a lazy screen fails.

- **A failed stylesheet is not a null `sheet`.** Chromium and WebKit both hand
  back a sheet whose rules throw SecurityError, as if it were another site's.
  So our own stylesheet with unreadable or no rules is a failed one; it is
  fetched again twice with a cache-busting query, then the page reloads once.
- **A cut-short stylesheet parses, so the entry one ends with a marker**:
  `src/sheet-end.css`, imported LAST in `main.jsx`, whose one rule
  (`#pw-sheet-end`) closes the emitted CSS. Missing marker, fetched again.
  Safari on the owner's phone kept serving a copy that loaded and had rules
  while Chrome on the same phone (same engine) had the whole file. Keep the
  import last, or every visit reads as cut short and re-fetches.
- **Every time it acts it leaves a line in `reports`** (`target_id =
  'stylesheet'`, with the state it found and the user agent), because the
  phones this happens on are not ones anybody here can hold.
- **The course document retries** (`loadTestContent`): three tries, then one
  reload. It used to keep the rejected promise for the whole visit.
- **One reload per 30 seconds per tab**, never a loop.
- **And the page is asked whether it is styled** (`src/lib/canary.js`), three
  seconds in: a token on `:root` and the wordmark's transparent background,
  both the entry stylesheet's. If either is wrong it sends every stylesheet's
  state to `reports` (`target_id = 'layout'`). The owner's Safari stayed
  unstyled after both fetch fixes and sent nothing, so the stylesheet was
  arriving whole and still not in force. **`?diag` on any address** sends the
  same line whatever the result and draws it on screen, with no stylesheet
  needed, for a phone nobody here can hold. Both go through
  `fieldReport.js`, straight to the real database, because inside the demo
  the app's own client is a copy in memory.
- `npm run test:recover` (production harness; `RECOVER_BROWSER=webkit` for
  Safari's engine) fails each download on purpose, and first checks that a
  healthy page fetches once and never reloads — the failure that would cost
  the most if the detection were wrong.

## Status

`npm run build` succeeds. Nothing in this codebase has been verified against the live
Supabase or on a physical device — all verification to date used a stubbed backend in a
desktop browser. See NOTES.md.
