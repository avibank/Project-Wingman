# Report · Bookmarks, Study cards and the Flight bag

The port, what each rule measured, and what was changed from the brief and why.
Written after the work, from the runs — every number below came out of a
command, and the command is named beside it.

---

## 1 · The survey

`claude/bookmarks-survey.md`, written before any code changed. Five of its
twelve answers contradicted the brief, and each one is carried below:

| # | What the brief assumed | What this repo is |
|---|---|---|
| 1 | a react-router route table, `<Link>`, `useParams` | **`src/lib/routes.js` is a pure parser** and `App.jsx` switches on the name. No `<Route>` anywhere, and every navigation goes through `go()` |
| 2 | questions have stable ids | **none did.** `contentLoader.js` synthesised a positional one, which is what R2 forbids |
| 6 | an authenticated Supabase client, `auth.jwt()->>'sub'` | **a bare anonymous PostgrestClient.** That claim is NULL on every request |
| 9 | "Settings is removed. It was an empty page." | **it was not empty** — the callsign field, the blocked list and three settings with no other door |
| 12 | Vitest | **no Vitest**, and a strong two-part house pattern instead |

---

## 2 · Every rule, with its check

### R1 · One saves list, private to each student — **done, with a stated cost**

`supabase/migrations/0028_saves.sql`, run against the live project and verified
by connecting: nine columns, three CHECKs, `saves_one_per_thing` (NULLS NOT
DISTINCT; the project runs **PostgreSQL 17.6**) and four policies.

Driven over the real anon REST path:

```
insert:              201
duplicate:           409  rejected by saves_one_per_thing
select own:          200  1 row
select another's:    200  0 rows
upsert, same thing:  200  one row, at_seconds 30 -> 90 -> 150
```

**The brief's second check cannot pass here, and that is not a bug in this
work.** "With B's token, a direct select on A's rows returns nothing" needs a
token; this client sends the publishable key as its own bearer, so `auth.jwt()`
is NULL and a policy naming a user would deny *every* row rather than fail —
0009's header is about exactly this. 0028 mirrors the comments pattern (open
RLS, `.eq('user_id', …)` in the app), states the cost in its own header, and it
is **backlog item 10**. Anyone holding the publishable key can read `saves`, as
they can every other table in this database.

The app-level half IS checked, in a browser: `test:bm` signs in as
`student_two` and asserts an empty Bookmarks.

### R2 · Questions have stable ids — **done**

96 ids minted into `src/content/test-content.json` (the fixture the app
actually shows), `id` first on every question, nothing else touched: the diff is
96 added lines and no others. `scripts/check-question-ids.mjs` reads the
**document**, not the loader — the loader is the thing that papers over a
missing id — and is in **`prebuild`**, so it fails the build rather than a
review.

Proved by planting all three of its failures:

```
strip one id      -> no stable id — M2 M2.01 #3: "How many continents are there?"
share an id       -> id "q_hg5xjh" is used twice — M1 M1.02 #1 … and M1 M1.01 #1
answer out of range -> no valid answer — M3 M3.03 #2: "How many inches are in a foot?"
restored          -> 96 questions, 96 ids, all stable and unique.
```

### R3 · Saving is instant and honest — **done**

`npm run check:saves`: **16 assertions, 0 failed**, the pack's nine plus seven
more. It runs in plain node — no Vitest, no jsdom — which took splitting the
toast **bus** out of `Toast.jsx` so the store has no `.jsx` in its import graph
and nothing has to be mocked.

Proved by planting four bugs in the store:

```
drop the revert              -> FAIL refused · a refused save goes back off the screen
put a failed removal on top  -> FAIL refused · a refused removal puts the row back where it was — bca
stop de-duplicating          -> FAIL once · saving the same thing twice never makes two
                                FAIL video · saving a lesson again moves its second
keep rows on sign-out        -> FAIL signout · signing out forgets every save
```

Offline is checked in the browser (`test:bm`, the launch sweep) with the context
taken offline for real:

```
You're offline, so that didn't save.   [Retry]
and the bookmark goes back to unsaved
```

### R4 · Every folder has a real way to fill it — **done, all four**

| Folder | Where | Note |
|---|---|---|
| Questions | `Exam.jsx`, beside the flag | The flag dies with the attempt; the bookmark outlives the paper. Nothing is marked before hand-in and a bookmark does not mark |
| Questions, in bulk | the result screen, **"Save the ones I missed"** | One `addMany`, one toast, hidden when nothing was missed |
| Study cards | `StudyPad` in `mode="set"` | Already in the pack |
| Videos | `PlayerLayer`, beside the note button | Reads `el.currentTime` off the live element, not React state |
| Videos, again | the lesson title row | The **same** `SaveButton`, not a second control — the old `pw-bookmarks` pill there is gone |
| Pages | the reader island's existing "Bookmark this page" | **Wired, not added.** v6 has drawn it since the rebuild; it wrote only to this device |

Each one was filled from the live UI in a browser.

### R5 · Every saved thing opens at the exact spot — **done, minus one link**

`?t=` and `?page=` land exactly (`test:bm`):

```
a saved video opens at its second        /m/m1/M1.02/lesson/M1.02.2?t=12
a saved page opens at that page          /m/m1/paper/M1.DEV?page=11
```

**"Open in its quiz" is removed, under R5's own instruction.** `Exam.jsx`
latches its sitting at mount and starts a clock at 75 seconds a question, so the
link would have started a timed paper to show one question. The answer is
already in the row. Backlog item 7.

### R6 · Profile menu and the end of Settings — **done, differently**

The menu now reads: the account row (which is the Licence link), Preferences,
Appearance, **Bookmarks** with a live count. `/settings`, `/settings/:page` and
`/saved` all resolve to `/bookmarks`, through the same `LEGACY` map every other
renamed path here uses.

**The page was not empty.** Deleting it as written would have deleted the only
way to unblock anybody. So:

- the **callsign field** went nowhere — the Licence tab already has it, with the
  server-side uniqueness check this one never had;
- the **blocked list** is in Preferences, inside "How social", which is where
  blocking belonged;
- **`PilotSettings`** (when you study — `matching.js` ranks squadron
  suggestions by it — notifications, and the study glow) is below it;
- `PilotSheet`'s "You can undo it in Settings" now says Preferences.

`grep -rn "settings" src/` returns only route handling and these comments.

### R7 · Flight bag instrument — **done**

`FlightBag` replaces the number ladder and the "A bookmark fills the bag."
caption. Empty: grey, latches shut, no text. Filled: lit in the livery, latches
sprung, three sheets standing proud and riffling, the number underneath. A save
made while the deck is on screen plays the drop. It opens Bookmarks on the
hero's module (`?m=M1`, checked in the walk).

The **Manual finish's drawn strip reads the same count from the same store** —
`useSavesCount`, checked separately in the walk because Manual draws the bag
rather than lighting it.

### R8 · Library: Study cards — **done**

`LibraryStudyCards` sits between Quizzes and Papers. Copy exactly as §4:
"Study cards" · "One set per quiz" · "Chapter 1 cards" · "8 cards". A chapter
with no quiz draws no row, and a module with no quizzes draws no section. A bad
chapter shows "Card set not found" with a way back — checked at
`/m/m1/library/cards/99`.

### R9 · Content goes through the adapter only — **done, with one change to the contract**

Every `ADAPT` implemented. `grep -rn "ADAPT" src/features/bookmarks` returns one
line: the word ADAPTER in a header.

**The contract gained a third answer, and it is the most important change in
this port.** `useSaves.resolve()` treats a save it cannot resolve as dead, and
`pruneMissing()` DELETES it from the server. Wingman loads its content as a lazy
chunk, so there is a real window in which the app is mounted and knows no
questions — and the pack's two-state lookup would have answered "gone" for all
of them and emptied a student's bookmarks on a slow connection, permanently,
with nothing on screen to say so. So a lookup answers with the thing, with
`null` when the author deleted it, or with `undefined` while nothing is known.
**Only `null` prunes.** Papers are the same: they are listed one module at a
time from the database, so a paper in a module nobody has opened is unknown
rather than gone.

Both halves are checked in the browser: a save pointing at a deleted question is
pruned quietly, and the folder still renders.

### R10 · No dead buttons, no dead ends — **done, the whole list**

`npm run test:bm`, on a desktop **and** a phone, every item ticked. The phone
runs with `hasTouch`, because the folder's play button keys off
`@media (hover:hover)` and testing a phone width with a mouse checks a state no
student is ever in.

### R11 · Looks right on every surface, measured — **done**

**672 states**: 6 liveries × night/day × 3 finishes × 4 widths (1440 / 1180 /
820 / 390), five screens each.

```
ok    every skin lays out and measures cleanly (672 states)
      contrast · worst body text  4.70:1 of 4.5   (day beacon standard 1440 home)
      contrast · worst large text 5.77:1 of 3     (night runway manual 1440 cards)
```

Measured off the **painted** colour — the computed value resolved through a
canvas, composited down through every translucent ancestor to the page ground —
so `color-mix()` and a panel at 0.8 alpha are measured as they land rather than
as they are written. Labels sitting on artwork (the video tile's gradient) are
counted and excluded rather than measured wrongly.

Five failures were found this way and fixed by moving a token, never by adding
a colour:

| What | Was | Now |
|---|---|---|
| the module picker's own name | `--active`, **3.96:1** day | `--active-text` |
| the letter of a right answer | `--active`, **3.76:1** day | `--active-text` |
| a card's answer line | `--active`, **4.48:1** day | `--active-text` |
| a card's chapter label | `--t3`, **4.37:1** night | `--t2` |
| the primary button's label | `--ground`, **4.40:1** Manual day | `--on-mark`, and the fill takes `--active-text` on paper |

That last one is worth reading twice. `finishEngine.js` sets
`--active-fill: accent` on the Manual finish — no darker step — and immediately
darkens `--active-text` by .13 for Day, with the reason written out: *"Paper is
not the deck: the same accent that reads on a lit ground is too pale on cream."*
A filled control wants the same treatment and was not getting it. `--on-fill`
was tried and measured **worse** (4.32:1): its
`clamp(0, (0.56 - l) * 1000, 1)` lands exactly on the knife edge, because the
Manual accent sits at .560, and picks black where white is the better side of it.

**Aurora has no Day.** `App.jsx:788` forces night on that finish, so there are
**30 real skins, not 36** — the walk expects what the app does rather than
failing it for obeying its own rule.

Also held at every state: no sideways scroll, nothing off the side, no text
under 13px, and every control at least 44px on its shortest side. Two §12
failures were found and fixed: `.bm-link` was `display:inline` (min-height does
nothing to an inline box — **19px**), and the module picker's button was 36px.

### R12 · Motion respects Smooth Air — **done**

With Smooth Air on, nothing in `.bm` animates, every root carries `is-calm`, and
the covers rest on their newest item rather than freezing mid-slide. Checked on
three screens.

### R15 · It must match the demo, measured side by side — **done**

`node tests/r15-compare.mjs`, at 1440 / 820 / 390, in Sky / Dark / Standard and
again in Caution amber / Light / Aurora. **27 of 36 measurements agree exactly
— 0px, not "within 2".** Three differ, and each is stated with its arithmetic
rather than chased.

```
  1440px
     ok  folder grid · columns        demo        4   build        4   0
     ok  folder grid · gap            demo       22   build       22   0
     ok  folder grid · left edge      demo       40   build       40   0
     ok  folder grid · width          demo     1360   build     1360   0
     ok  one cover · width            demo    323.5   build    323.5   0
    said one cover · height           demo    535.3   build    522.8   -12.5
     ok  page title · size            demo       44   build       44   0
    said title to folders             demo       60   build       72   +12
     ok  page · gap under the bar     demo       12   build       12   0
     ok  card pad · width             demo      620   build      620   0
     ok  a card · aspect              demo      1.5   build      1.5   0
    said the bag · drawn width        demo       78   build       84   +6
```

820 and 390 are the same shape: grid, cover width, title size, gap under the
bar and the card pad all exactly equal; the same three named differences.

**`bookmarks.css` is byte-for-byte the pack's**, verified with `diff`. Every
adaptation moved into **`src/features/bookmarks/bm-app.css`**, which is the same
shape as `rr-app.css` — the design's stylesheet stays as sent, and the app is
what gets fixed around it.

### What was wrong, and it was all the app

Before this pass the build and the demo disagreed on nearly every number. Three
app-side causes, each measured:

| Was | Cause | Now |
|---|---|---|
| folder grid **1056** wide against the demo's **1360** | `.content` is the app's reading column — `max-width: 780/1100`, `margin: 28px auto 0`, `padding: 0 22px` — and `.deck-inner` caps at 1240. R15: "the component is the page" | **1360**, equal |
| the grid started at **x=80**, the demo's at **40** | the deck insets every screen by 40 and `.bm-page` brings its own `clamp(16px,4vw,40px)`; **both were being paid** | **x=40**, equal, at all three widths |
| an empty Bookmarks floated in the **middle of the screen** | `.deck` centres a short page vertically | top-aligned, **12px under the bar** — the demo's own gap, matched rather than its absolute y, because this app's bar is 70px where the demo's is 72 |

One measurement artefact was worth the time it cost: `.bm-page` arrives on a
380ms slide from 6px down and the folders on a 420ms grow from `scale(.94)`.
Measured a frame into either, the page sits 6px low and every cover is 6%
small. Both sides now wait for their own animations to finish before anything
is read — the same fix the R11 sweep needed.

### The three that differ

- **title to folders, +12 = 4 + 8.** The pack's `bookmarks.css` sets
  `.bm-head { margin-bottom: 22px }`; the demo's own stylesheet says 18. The
  two disagree, and this brief's header settles it: *"Where the demo and the
  code disagree, the code wins."* The other 8px is §12 — `App.jsx` floors every
  `button:not(.is-inline)` at 44px, so the module picker's own 36px button is
  44 here. An app accessibility rule beating a design one, deliberately.
- **one cover · height, −12.5.** The bottom chrome differs and the folders fill
  whatever room is left, which §1 requires. The demo reserves 84px for its
  **DEMO bar** — a demo-only control that does not ship. The app reserves
  `max(chin, report pill)`, which measures 56, and 40 more on a phone where the
  pill is wider than that reservation is tall. Sized without paying it, the grid
  ran down into the pill's corner and the pill sat on the first folder's cover —
  a control you can mis-tap, which `test:bm` caught. Everything above the fold
  matches exactly.
- **the bag, 84 vs 78.** The reference draws it twice: a 230px close-up and one
  in a mock hero strip headed REAL SIZE. Measuring the close-up said the build
  was 146px small; the real-size one is 78. But that mock's cell is
  **187×358** and the app's strip cell is **244×164** — a different shape
  entirely. The pack's CSS says 84px, and 84 fills the app's shorter cell as 78
  fills the mock's taller one.

A **fourth** difference would fail: the three are named in the comparison script,
so it exits non-zero on anything else.

### R13 · The harness never ships — **done, by removal**

The pack's `__harness__/` is gone. It existed to develop the components before
they met the app; this repo has `npm run harness`, which drives the real screens
against a real store, so mounting a second one would have been a dev-only route
to a worse fixture. The test double (`fakeSupabase.js`) stays, and
`check:saves` asserts that **nothing in `src/` imports it** — which is stronger
than searching the bundle, because it fails before the build.

### R14 · Analytics — **done, and the union was widened deliberately**

`src/lib/analytics.js` said "Four events. Not five, and not a free-text name",
and `check:analytics` asserted the count. All six Bookmarks events are in the
union now, with their required props, and the check **names all ten** instead of
counting them — proved by renaming one and watching it fail where the count
would have passed.

Nothing receives them: `installSink` has never been called. Backlog item 5.

---

## 3 · The launch sweep

```
ok    the launch sweep
```

- `npm run build` clean, `check:question-ids` in prebuild, `npm run check` green.
- No console errors on any Bookmarks screen, the Library tab or the Flight Deck
  — asserted across all 672 states, not sampled.
- 390 / 820 / 1180 / 1440: folders fill the screen (four across at 1024 and up,
  2×2 below), the pad fits, nothing scrolls sideways.
- Offline: refused with the right words, and the control goes back.
- Two tabs: a save in one is in the other after a refresh.
- A second student sees none of the first one's saves.
- A question deleted from the data: its save vanishes quietly and the rest work.
- Keyboard only: every control reachable, every focused one outlined, Esc closes
  every overlay.

---

## 4 · Bugs found in the pack, and fixed

1. **A crash, two taps from the Study cards folder.** `StudyPad` declared
   `useRef` *after* `if (!cur) return null`, so the render after the last card
   was unsaved — n drops, k still points past the end — ran one hook fewer than
   the one before it and React threw. Both refs are above the return now.
2. **`<Link>` with no import** in `FolderPage`, which threw the moment the
   Questions folder rendered. `npm run check:jsx` catches it; the link is gone
   under R5 anyway.
3. **Wrong answers were marked in Master Caution amber.** The pack said "map to
   the live Master Caution colour if it has a token". There is one, and it is
   the wrong one twice over: CLAUDE.md says Master Caution lights in exactly one
   place, and that a wrong answer is never red or alarming. `--bm-miss` is
   `--bad`, which inside `.app` is the same blue-grey the quiz already uses.
4. **`.bm` collides with the reader's own `.bm`** — the ribbon on a page cell in
   v6's grid. Caught by `check:paper`, quarantined and undone in
   `additions.css`, like the seven before it.
5. **The lesson had two save controls that could disagree** — the pack's player
   bookmark and the app's existing title-row pill, which wrote a separate
   `pw-bookmarks` list. One control now, in two places, reading one store.

---

## 5 · Changed from the brief

| Brief | What shipped | Why |
|---|---|---|
| a react-router route table in `index.js` | routes in `parseRoute`; `BmLink` and `useGo` in `nav.jsx` | There is no route table. A control calling `navigate()` skips the transition entirely — CLAUDE.md names two that did |
| `20260918120000_saves.sql`, `auth.jwt()` policies | `0028_saves.sql`, open RLS + app scoping | That claim is NULL on every request here. The brief said to mirror the comments pattern if it differed |
| "Settings is removed. It was an empty page." | the page is gone; its contents moved to Preferences and the Licence tab | It was not empty, and one of the things on it was the only way to unblock somebody |
| `chapter` is a number | it is, for the label — and a save points at `ref_id` | Chapters here are `M1.01`. The number is its place in the module, which is what "Chapter 3" means; nothing is saved against it |
| Vitest + jsdom for `savesStore.test.js` | `scripts/check-saves.mjs`, in `npm run check` | Neither was needed once the toast bus came out of the .jsx, and a second runner would have put the one rule that can silently lose a bookmark outside the suite anybody runs |
| the pack's `__harness__` at `/__bookmarks-harness` | removed | This repo has a harness that drives the real screens |
| `--bm-miss` = Master Caution | `--bm-miss` = `--bad` | Two of this project's own rules |
| 36 skin combinations | 30 | Aurora has no Day |

---

## 6 · What is not done

Everything in `claude/backlog-bookmarks.md`, and three worth naming here:

- **Item 10 — `saves` is readable by anyone with the publishable key**, like
  every other table here. Stated in 0028's header rather than buried. Fixing it
  is a Clerk JWT template and an authenticated client across 65 call sites.
- **Item 5 — the analytics events go nowhere.** They fire; nothing is listening.
- **Item 14 — signed out, the bookmark controls render and do nothing.** The
  store needs a Clerk id and there is no sign-in prompt on them.

---

## 7 · The dead-end sweep

Asked for after the port, and run across the whole app rather than the feature.
It is `npm run check:doors`, in `npm run check`, so it fails a build rather than
a reading — **9 assertions, 0 failed**, each proved by planting its own failure:

```
plant a button with no handler   -> FAIL buttons · src/components/module/Review.jsx:131
plant "undo it in Settings"      -> FAIL copy   · "Blocking is symmetric: … " names Settings
plant a redirect to a redirect   -> FAIL paths  · /saved -> /settings -> redirects again
plant "Nobody yet." on its own   -> FAIL copy   · every empty line names its next action
```

It holds nine things:

1. **No control is bound to nothing** — every `<button>` has a handler, is
   disabled, or is delegated (the reader's island binds by `id`/`data-act`, and
   that is checked by `check:paper`'s own assertions rather than called dead
   here); no `<a href="#">`; no `onClick={() => {}}` on a host element.
2. **Every path the app can build resolves** — all 30 of `path.*`'s outputs
   through `parseRoute`.
3. **Every renamed path lands in one hop** — 11 of them, and none redirects to a
   redirect.
4. **Every path written by hand resolves** — the ones no builder is holding.
5. **Every route name is answered in App** — the failure the `paper` route hit
   once, where a correct URL rendered the Flight Deck.
6. **No screen copy names a screen this app no longer has.** Reading prose
   across newlines *and* across `{interpolations}` is what made this work —
   cut at either and half of every sentence in the app goes unread, which is
   exactly how "you can undo it in Settings" outlived Settings.
7. **Every empty line names its next action**, §10 of the voice.
8. **Every flag gates something, or says why not.**
9. **Every progress key has a reader and a writer, or says why not.**

### What it found, and what was done

| Found | Done |
|---|---|
| `PdfPanel`'s **"Open" button was bound to nothing** — the old hub's Library, behind `module.screen` being off. It never fired only because `pdfsForModule()` returns an empty array, so the list can only draw its empty state | Wired to the same opener the live Library uses, through `ModuleHub` |
| **`page.bookmarks` gated nothing** after the old Saved screen went | Removed, with the reason in its place |
| The Logbook's **"saved" tile counted `pw-bookmarks`**, which nothing writes any more — it read 0 for every student and showed its invitation instead | Reads `useSavesCount("all")`. Its invitation said "Star a question during a quiz"; the control is a bookmark, on four surfaces |
| **Five flags gate nothing** — `home.v2`, `profile.v2`, `tokens.global`, `chrome.patoast`, `reader.v2` | Left alone: two are `locked`, and `reader.v2`'s own note says to delete it after a quiet week. All five are now **named** in `check:doors`, so a sixth fails |
| **Six progress keys have only one side** — `pw-last-tab` and `pw-room-return` are written and never read; `pw-room-seen`, `pw-streak`, `pw-longest-streak` and `pw-font-size` are read and never written | Named the same way. The one with a visible consequence is the **streak tile on the Logbook page, which can only ever read 0** — nothing counts days. It is behind `page.logbook`, which is off |
| `test:bm` **left the student pinned to Manual in Day**, and every suite drives the same harness store — `test:exam` then failed on a ground it never set | The walk puts the skin and the saves back in a `finally` |

### Still open, and named rather than fixed

- **Nothing counts study days**, so `pw-streak` has no writer and the Logbook's
  streak tile is a number that cannot move. Behind `page.logbook`, off.
- **`ProgressPage` reads the global `CHAPTERS` array directly**, which CLAUDE.md
  calls "a bug waiting to surface" — it counts every chapter in the app rather
  than the ones in a module. Same screen, same flag, same reason it has not bitten.
- The **five dead flags** and the **two write-only keys**, above.
