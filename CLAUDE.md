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

**The first real chapter is in** (owner, 2026-09-21). Before that this section
said "there is no real content yet", which was true until today.

`src/data.js` — **four** modules, M1 to M4, and no chapters. The codes never
change (progress, scores and saves are keyed to them); the NAMES are the
course's: **M1 is Module 13d** (the one the class is on, and the app's default
current module because it is the first `active` one), **M2 is Module 13e**,
**M3 is still "Module 3"** (undecided) and **M4 is Module 10**.

`src/content/test-content.json` — the content document, despite its name. It
is loaded by the `content.test` flag, which is `everyone: true` again (label
"Course content"); the id kept its old name so nothing that reads it had to
change. It repeats the four module names, and they must agree with data.js,
which is what the Flight Deck draws before the document arrives. It holds:

- **Module 13d · M1.01 "Rotary Wing Aerodynamics"**: no lessons, a quiz
  `M1.01.QZ` of exactly **40** questions (no `lessonId`), and **170 study
  cards** `M1.01.C001`–`C170`.
- **`cards` on a chapter is optional and is the card set when present**;
  without it the card set falls back to the quiz questions as before.
  `content.cardSet()` / `cardChapters()` in `features/bookmarks/content.js`
  make that choice for every screen that builds a set, and
  `content.question(id)` finds card ids too — a saved card that answered
  `null` would be pruned off the server. `check:question-ids` holds quiz and
  card ids in one id space.
- **`downloads` on a module** — `{id, title, file, pages}`, a file under
  `public/` offered as a plain `<a href download>` on the Library's Papers
  shelf (`LibraryDownloads.jsx`), with **no viewer**: papers stay paused.
  `public/downloads/M13d-Rotary-Wing-Study-Cards.pdf` is the first.
  `check:paused` allows exactly that anchor and nothing else on the slot.

`check:placeholders` / `check:ship` grep the build for the markers of the old
placeholder set; the real content carries none and both pass unchanged.

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
- **The clock is a FLAT TWENTY MINUTES** for any quiz up to forty questions
  (owner, 2026-09-20), which reverses the 75-seconds-a-question figure below.
  `estimate` keeps the 75 seconds, because a row reading "about 20 minutes"
  for every quiz would say nothing.
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
  never reaches the entry chunk.
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
  tutorial over the real screens with a class already in them. It is
  **twelve steps, and every one of them is a decision this app has made that
  another study app has not** (owner, 2026-09-23: "we are dealing with
  university students who are familiar with study apps — we aren't trying to
  teach them how to operate an OS but to introduce them to our own system,
  our own quirks and ideas, rather than teach them how to use a video
  player"). That is the THIRD length in three days and the direction is
  settled by it: 75 page-by-page steps (2026-09-21) were "way too long", 25
  one-per-idea steps still explained things every student already knows, and
  what is left is the instruments that refuse to flatter you, the pass mark
  you set for yourself and the one lamp that watches it, the right seat, the
  class living inside the module, a logbook pinned to the minute of the video
  that caused it, a quiz sat as an exam with the clock belonging to the
  paper, what comes back afterwards, what the class has already finished, an
  answer that can be endorsed but never buried, and a signature you design
  once. Nothing in it explains Previous and Next, a search box, a tab or how
  to send a message. It still opens with Wingman rather than Part-66, the
  card's kicker names the page and how far through it you are, and it can
  always be skipped. Every claim in `steps.js` is checked against the code
  that does it; change the feature and the paragraph has to change with it.
  - **Nothing lights the player's tools any more, and that is deliberate**:
    `.player-layer` is not mounted on a lesson nobody has touched, so a step
    about it only ever lit when it came straight after a step on the player
    itself — and a step on the player was one of the ones the owner cut. The
    lesson's single step lights the logbook, which is there on arrival.
  - **The text panel does not move.** It used to be placed beside each target
    and glide there, and the owner's word for that was "lags around". It is
    docked at the foot of the window (a sheet on a phone), and `plan()`
    scrolls the target into the room above it. Only when a target cannot be
    scrolled clear (the Ready Room's answer bar and composer are fixed to the
    bottom) does it take the top edge instead, and it fades across rather than
    travelling. The deck gets 45vh (55vh on a phone) of room at its foot while
    the tutorial is up, except in the Ready Room, which fills the window.
  - **The demo lesson has a real video**: `public/demo/simultaneous-equations.mp4`,
    five minutes of worked examples drawn on a canvas and recorded in Chromium
    (no ffmpeg on the build machine; `MediaRecorder` writes H.264 MP4 with a
    proper duration, which WebKit plays). Its moments are the seeded logbook's:
    your note at 1:04, the right seat's comment at 3:08, yours at 3:51 and
    your question at 4:36. Only the demo's `content.json` points at it.
  - **How it stays smooth** (Guide.jsx), measured on a production build:
    the dim is four panels moved only by transform (a box-shadow light
    repainted the screen every frame); one loop eases the light towards its
    target every frame (a CSS transition restarted on every scroll frame);
    panel edges snap to device pixels (fractional edges drew seams); screens
    change only once the light has closed, without the app's own view
    transition (`go(to, { still: true })`), and every screen it visits is
    warmed while the first step is read.
  - **It opens by itself for every visit by somebody who is NOT signed in**,
    on ANY page but sign-in, an invite link and Clerk's account screens. It
    once waited for `/`, and a visitor who arrived anywhere else never saw
    it. Skip takes them back to the page they arrived on.
  - **Seen lasts one visit, and a visit is a tab** (`pw-walkthrough-visit` in
    sessionStorage, which survives the demo's reloads). It is written when
    the walkthrough ENDS, finished or skipped. It used to be remembered on
    the device for good, and twice the owner, on a device that had once
    skipped it, reported that it did not trigger at all. A returning student
    stays signed in and never meets it; a visitor with no account meets it
    each time, one tap from gone. **`?tour` on any address opens it for
    anybody**: a visitor as "You", a signed-in student as themselves. A signed-in student only gets it by asking:
    Replay, at the foot of the Licence. A visitor is "You" inside it: every
    Clerk hook comes through `src/lib/clerk.js`, which signs a demo guest in
    as a student who exists only in the demo's database. Clerk's components
    still come from Clerk.
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
  - **Walked and measured**: all twelve steps light their target at 1440 and
    at 390, every one of them fully on screen, and the card covers none of
    any of them. The card is docked, so what changes between steps is its
    height and never its foot. Bookmarks is given the same room at its foot
    as the deck while the tutorial is up (`.bm-page` in `guide.css`): its
    folder grid could not scroll clear of the card, so the card took the top
    edge and still came down on the first 15px of it. In the harness the
    walkthrough counts as seen unless `?walkthrough=1`, and the identity from
    `?uid=` lasts for the tab, as a real session does.
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

## Off for launch, and Manual

- **Papers are off** (`paper.viewer` is `everyone: false`): nothing in the
  Library, the subtitle, Bookmarks or the paper address. The demo says a
  reader for module-wide shared PDFs is coming.
- **Aurora is off** (`OFFERED_FINISHES` in `finishEngine.js`, and
  `livery.aurora`): not offered, and a stored Aurora reads as Standard. The
  renderers stay.
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
  store against a stand-in server — 16 assertions, no browser.
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
