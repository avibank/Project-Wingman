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
- **There is no `enrollments` table.** This line used to say there was one in
  Supabase, with self-serve enroll/unenroll. Verified on 2026-09-02 by querying
  the live database: no such table, and no client code reads one. All four
  modules are open and nothing is gated, which is why nothing missed it.
  What a student studies is derived instead, from `chapter_completions` and
  `lesson_threads` — see `my_modules` in migration 0011.

## Content

**There is no real content yet.** This paragraph used to say there was, in
detail, and every specific was wrong. Verified on 2026-08-31 by reading the two
files, not inferred:

`src/data.js` — **four** modules, M1 to M4, **five** chapters each (20 total).
Not five modules of four, and the codes JT, PROP, AERO, NAV and WX appear
nowhere in this repo. **No chapter has `body` prose. No chapter has questions.
All 20 have `clip: null`.** It is a skeleton: codes, titles and structure.

`src/content/test-content.json` — the fixture behind the `content.test` flag,
which is `everyone: true` and therefore what the app actually shows today: four
modules, three chapters each, two lessons per chapter, with Blender's open
movies as clips and general-knowledge quiz questions. `npm run check:ship` is
the gate that stops it reaching a launch, and it currently fails on purpose.

So the two sources disagree about how many chapters a module has — five in
data.js, three in the fixture — and which one a screen shows depends on whether
it reads the fixture. That is worth knowing before trusting any count on screen.

Do not invent YouTube ids, chapter prose or questions to fill any of this.

`chaptersForModule()` and `pdfsForModule()` are in data.js and exported, as the
architecture note above says — that part was accurate.

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

## Migrations

`supabase/migrations/` — 0000 progress table, 0001 social layer, 0002 threaded posts,
0003 reactions and attempts and completions, 0004 progress merge, 0005 squadrons and
safety and comms, 0006 openers and rate limits and moderation, 0007 questions and
squawks and teams, 0008 the lesson surface, 0009 the right seat's boundary,
0010 thread titles and answers, 0011 discovery, 0012 search and suggestions,
0013 retiring the pilot livery, 0014 the annotation layer on papers.

**0014 has been run against the live project.** `paper_annotations`, four
functions, and the `anchor_is_text_only` CHECK that refuses any anchor
carrying a page, rect or bbox — R1 of the annotation brief, enforced where it
cannot be argued with. `npm run check:paper-db` drives 17 assertions against
the real database as two different accounts and deletes every row it makes;
like check:discovery it is NOT in `npm run check`, because that suite must not
need credentials. `npm run check:paper` holds the 61 that need neither.

**0011 has been run against the live project**, verified by connecting rather
than inferred: 9 new squadron columns, 4 new profile columns, 2 new tables and
8 functions all present afterwards where none were before. `npm run
check:discovery` drives 12 assertions against the real database — a stranger is
refused by people_search itself, blocks cut both ways, the opt-out works,
capacity refuses a join by card AND by link — and deletes every row it makes.
All four discovery RPCs answer over the anon REST path. It is deliberately NOT
in `npm run check`, because that suite must not need database credentials.

There is **no `enrollments` table**, despite what the Content section of this
file says. Verified by looking. 0011's `my_modules` is built from
`chapter_completions` and `lesson_threads` instead, which are the two real
signals for what somebody studies.

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
- The reader is its own lazy chunk (~390KB) and `check:bundle` asserts pdf.js
  never reaches the entry chunk.
- The test paper is fetched, not committed: `npm run paper:fetch`. `papersFor()`
  adds it to Module 1 under `import.meta.env.DEV` only.

## Status

`npm run build` succeeds. Nothing in this codebase has been verified against the live
Supabase or on a physical device — all verification to date used a stubbed backend in a
desktop browser. See NOTES.md.
