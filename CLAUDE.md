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

**TWO CHAPTERS, BOTH NEW TODAY** (owner, 2026-10-03). All three of the
previous ones came out in the morning at his word — "delete all quizzes and
sets and all traces of them" — and these went in the same day, under chapter
ids that had never existed:

- **M1.B1 · "Theory of Flight · Rotary Wing"** — a quiz `M1.B1.QZ` of **40**
  questions, **170** study cards `M1.B1.C001`–`C170`, and the Full Set on the
  Papers shelf at 26 pages. PDF pages 1–68 of the manual.
- **M1.B6 · "Instruments (ATA 31)"** — a quiz `M1.B6.QZ` of **40**, **416**
  study cards `M1.B6.C001`–`C416`, and the Full Set at 65 pages. PDF pages
  352–491.

**THE IDS HAVE NEVER EXISTED BEFORE, AND THAT IS THE POINT.** The deleted
chapters were `M1.01`–`M1.03` and ids are positional inside a chapter, so
reusing one would silently inherit whatever any device still remembered about
it. Nothing in the app parses a chapter id for a number — `chapterNo` comes
from the chapter's POSITION and `chaptersForModule` only splits on the first
`.` — so `M1.B1` is as valid as `M1.01` and cannot collide. **No reset was
needed for this import**, which is the first time that has been true.

**THE DOCUMENTS CHANGED SHAPE, so there are two readers and not one edited
one.** The September documents carried a single answer-key TABLE at the end
(columns No./Ans/Level/Marked/PDF page/Why). The October ones carry an
"Answers — <topic>" block after every topic, written as prose:
`12. b <explanation> (L3, PDF p. 352)`. A single parser trying to be both
would have had to guess which it was reading, and a wrong guess there puts a
wrong answer in front of a student. Both live in the session scratchpad
rather than the repo: each is a one-off for one document shape, and a third
shape should be read and checked rather than trusted to either.

**BOTH READ A LAID-OUT PDF BY GEOMETRY, never by prose.** The repo's own
pinned pdf.js gives every line its x and its first run's height, and these
documents are exact — in the October shape, stems at x≈60 h=10.5, their wraps
at x≈78, options at x≈82, every continuation at x≈91 or beyond, key rows at
x≈60 h=9, headings at h=15/11/10/8.5, and the page number and running header
past x=200. That is what lets a converter tell a section heading from a
wrapped stem without reading a word of either. **Anything it cannot place is
REPORTED, never assumed**: all four documents came out with zero warnings.
The level and the manual page are lifted out of the explanation rather than
shown to a student inside it, because in the old documents they were separate
columns.

**Spot-check the answer spread**: a correct join lands near a third each
across a/b/c. These came out 14/13/13, 57/57/56, 14/13/13 and 139/139/138.

**The names are the documents' own titles, PLUS THE PAGE RANGE** (owner,
2026-10-04: "the quizzes and sets should have the page numbers stated
clearly"). `quiz.name` is "M13 Batch 1 — Quiz · pages 1–68" and the chapter's
`cardsName` is "M13 Batch 1 — Full Set · pages 1–68"; the paper on the shelf
takes the same string. The range is the one fact these documents are named by
— it is in every filename and in every document's own subtitle — and it was
the only part of the title the October layout dropped. The chapter NAME stays
the subject ("Theory of Flight · Rotary Wing"), not the batch.

**A quiz document is the quiz and nothing else; a Full Set is the study cards
AND the paper** (owner, 2026-09-28, held to ever since). The practice quiz
never reaches the Papers shelf: the app's own quiz is where a student sits it.

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

**What went this morning**, if it is ever wanted back
(`git log -- src/content/test-content.json`): M1.01 Rotary Wing Aerodynamics
(40 + 170), M1.02 Instruments (40 + 272, replaced twice, which is what
`STORAGE_EPOCH` 2 and 3 were for) and M1.03 Pitot-Static Systems (40 + 81,
including two questions rewritten in the app on 2026-09-30 and never in the
source .docx). `supabase/reset-module-13d-progress.sql` took 11 board runs,
11 saves and 2 progress documents with them; `STORAGE_EPOCH` is 4. Hours
flown deliberately stayed.

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
- **IT IS LAID OUT AT 760 AND DISPLAYED BIGGER** (owner, 2026-10-07, after
  five rounds of this: "why does it feel streched and akward", then "complete
  creative control ... neat proportions like the demo").

  **THE TILE WAS THE WHOLE STORY.** In the build it is 215x145. Stretched into
  a wide row it became 360x145, then 420x145 — the width doubled and the
  height never moved, so every tile turned into a letterbox with a drawing
  floating in it. Scaling the drawing alone only made the letterbox more
  obvious, because the box itself was the wrong shape. The rail went the same
  way (ten 28px dots 140px apart against the build's 75), and the row header
  too (a title with 900px of nothing before its chevron). **Only one axis was
  scaling, and a design has two.**

  So the screen is laid out at the width it was DRAWN for and displayed
  larger: `width:100%; max-width:760px; zoom: clamp(.8, tan(atan2(100cqw,
  760px)), 1.4)`. `zoom` scales LAYOUT, so the block still occupies the room
  it is given. `tan(atan2())` is how CSS divides one length by another and
  gets a number. Every value moves by the same factor — tiles, gaps, rail
  spacing, badges, type, row heights — so the proportions are the build's by
  construction rather than by adjustment.
  - **Measured against the build at 2000/1680/1440/1100/820**: tile aspect
    **1.49** and drawing share **0.596** at every one of them, against the
    build's own 1.49 and 0.596. Column 1064 where the design is 760.
  - **The cap is the judgement.** Uncapped, a 2000px window scales it 2.6x and
    a 40px title lands at 105px. At 1.4 the page title is 59px and the row
    titles 23px — large, and in proportion with everything beside them.
  - **It scales DOWN the same way**, to a floor of 0.8, which is where the row
    titles reach 13px. A design laid out at its own width and shown smaller
    keeps every proportion; one reflowed into a narrower column does not.
  - **Under 620px of container the tiles stack, AND A STACKED TILE IS A ROW.**
    Three side by side are cards and the build draws them as cards: a drawing
    over its name, centred, about 3:2. Stacked, that same box is the width of
    the screen and 88px tall, and a centred drawing in it is a letterbox —
    the exact fault this screen had at the other end of the scale. A box that
    wide IS a row, so the drawing goes left and the name sits beside it.
  - **A CONTAINER query, never a viewport one**, and the rules go at the END
    of the sheet. The screen is zoomed, so a viewport media query measures a
    different number from the one this layout is in and the two shrink the
    same tile twice; and `.lib2 .lb-tile` is declared earlier at the same
    specificity, which a container query does not raise, so a block written
    beside the grid loses on source order — the tile became a row and its name
    stayed centred in the space left over. The drawing's own scale steps fell
    into the same trap before they were deleted.
  - The quiz thumbnail also came out 75px against the design's 72, because
    `aspect-ratio` is only a suggestion once min-content is taller and that
    stack measures 3px more on this app's faces; one row of `minmax(0,1fr)`
    lets the ratio decide.
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
  that file went with the tour rebuild on 2026-10-06. The approved tour's
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
prose. `supabase/SETUP.sql` is still the guarded one-paste bundle of 0005-0007 if a
second environment ever needs building.

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
  2026-09-23), not a room to stand in: `InviteSheet.jsx`, opened from Crew's
  empty state. It used to open the module's question board, which is a
  reasonable place to be and not an invitation — nothing about it could be
  sent to somebody who does not have an account yet. **The link is the
  MODULE'S** (`/m/<code>`), because there is no class to join: every module is
  open, a visitor who taps it is shown round by the walkthrough before
  deciding anything, and when they sign up they appear on that module's Crew
  wall. Sending it is `lib/outside.js`'s job — the share sheet on a phone, the
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
  **TWENTY-ONE steps behind a BETA NOTE**, and the files are
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
  - **Walked, measured and held**: `npm run test:tour` is **258 assertions**.
    It walks all twenty-one steps at 1440 and at 390 and asserts that every
    step naming a target lights one, that what is lit is fully on screen,
    that the card covers none of it (except a `whole` step, where the light
    IS the window), that a step asking for a pane or a tab gets it, and that
    each step stops moving. It checks every `data-tour` name in the script
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
  question and a keyboard-only pass. **Aurora has no Day**: `App.jsx` forces
  night on it, so there are 30 real skins, not 36.

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
