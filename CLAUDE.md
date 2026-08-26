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
- Module enrollment is real (Supabase `enrollments`, self-serve free enroll/unenroll,
  no payment yet). All five modules are open — nothing is gated.

## Content

Five modules, four chapters each (20 total): JT, PROP, AERO, NAV, WX. Every chapter has
authored `body` prose and quiz questions. Only JT chapters have real video clips; the
other 16 have `clip: null` and render a "not recorded yet" state. Do not invent YouTube
ids to fill these.

## Design system

- **Two-layer colour.** Module identity hue (per-module, wayfinding only: badges, rails,
  rings, motifs) and a universal `--presence` amber (presence, active states, the single
  primary action per screen). They answer different questions and must not be merged —
  this was collapsed to one hue once and then explicitly reversed.
- Accent is driven by `--accent-h/s/l` channels; every other accent token derives from
  them via `calc()`. Changing the hue re-tints the app. Five user-selectable liveries.
- `--accent-dim` is for decorative labels; `--accent-tint` is for text that carries
  meaning (chapter codes). Using dim for the latter makes it unreadable.
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
squawks and teams.

**0001-0004 have been run against the live project. 0005-0007 have not.** Until they
are, several surfaces fail open and silently no-op — `squadron.js`, `comms.js` and
`FirstFlightGate` all carry comments saying so. `supabase/SETUP.sql` bundles 0005-0007
as one guarded paste; it assumes 0001-0004 are applied.

0004 is not optional: without it, progress does not save. 0000 declares the
`user_progress` table it writes to, which predates the series and was created by hand —
the live database already has it, so 0000 is a no-op there, but without it the series
cannot rebuild an empty database. Both bundles take 0005 and up, so 0000 is
deliberately outside them.

## Status

`npm run build` succeeds. Nothing in this codebase has been verified against the live
Supabase or on a physical device — all verification to date used a stubbed backend in a
desktop browser. See NOTES.md.
