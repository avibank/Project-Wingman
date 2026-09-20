# Session report — porting the reference builds

2026-09-19 into 2026-09-20. Worked alone, from START-HERE's order: Crew's empty
state, the licence card, Preferences, the module screen, the lesson page.

Four of the five screens are ported, measured and deployed. The fifth is not,
and this file says exactly what it needs.

---

## What is live

Every commit below is on `main` and deployed. Each was checked on
wingman.institute afterwards, not only in the harness.

| # | Commit | Screen |
|---|---|---|
| 1 | `7e1bf74` | Crew's empty state, and the measuring harness |
| 2 | `fa6fdfe` | The licence card |
| 3 | `0af27d9` | Preferences |
| 4 | `4087c0f` | The module screen — Lessons, Library and Crew |

Verified live after deployment, signed out:

* `/m/m1` — the subtitle reads "6 lessons and 3 quizzes", the tab strip carries
  the search field full width, chapters draw with lesson thumbnails and quiz
  answer sheets.
* `/account/licence` — "YOUR LICENCE" header above the card, no YOUR CODE box,
  the Account box in the reference's shape.
* `/account/preferences` — choice row, one description line, then the field.
  No "Go by callsign". No "Your pilot / What you'll hear about".

---

## The numbers

`npm run ref:diff <screen>` photographs the reference page and the live screen
at 1280, 768 and 390 and diffs them with pixelmatch. The bar is 1%.

| Screen | 1280 | 768 | 390 | |
|---|---|---|---|---|
| licence | **0.23%** | **0.28%** | **0.28%** | passed |
| preferences | **0.47%** | **0.48%** | **0.73%** | passes |
| module | 3.42% | 4.41% | 8.64% | |
| library | 5.41% | 6.74% | 5.56% | |
| crew | 3.95% | 6.50% | 15.34% | |
| lesson | 27.01% | 32.40% | 37.28% | ported after this was written |

**Re-measured 2026-09-20**, after the lesson page was ported, the owner's two
changes to the licence card, and the papers reader being paused:

| Screen | 1280 | 768 | 390 | |
|---|---|---|---|---|
| preferences | **0.47%** | **0.48%** | **0.73%** | passes |
| module | 3.33% | 4.26% | 8.22% | |
| crew | 3.86% | 6.38% | 15.23% | |
| lesson | 14.19% | 23.76% | 25.54% | ported; roughly halved |
| licence | 8.05% | 8.11% | 9.47% | **two owner-requested divergences** |
| library | 34.44% | 36.61% | 44.08% | **papers are paused** |

The two that moved are not drift, and the number no longer means what it did
on either:

* **Licence.** The whole 82px is `.sblock`: 162px in the reference, 203px
  live. The reference draws "Create your stamp" ON TOP of the seal and the
  owner asked twice for stamp above, button below, clear of it. The Cover
  button is the same story the other way — the reference puts it top-left and
  the owner asked for top-right. Both are commented where they are made, in
  `licence.css`. **The reference is no longer the target for those two
  details**, so the bar does not apply to this screen without subtracting them.
* **Library.** The papers reader is paused (`docs/launch/PAUSE-READER.md`), so
  the live Library has two sections where the reference has three. That number
  means nothing until `VITE_PAPERS_READER=true`.

Where a screen is over the bar, the cause is named rather than rounded off —
§"What is left" below, and `docs/launch/DECISIONS.md` for the argument behind
each one.

For scale: crew measured **25.60% / 37.56% / 41.36%** when the harness first
ran, with the panel a different size on every width.

---

## Authenticated diffs are unverified

`tools/ref-diff.mjs --login` opens a window and waits for a sign-in. The owner
was away, so it was never run and `tools/.auth.json` does not exist.

Everything above was measured against the harness — the real bundle with
identity and the database replaced by fixtures — and against signed-out live
pages. **No screen has been diffed while signed in to the real Clerk and the
real Supabase.** What that could hide: anything whose layout depends on real
account data — a long real callsign, a real photo, a stamp that has actually
been issued, a Crew of real people, a Library with real papers.

The fixture (`?fixture=demo`, dev only) exists to make the diffs mean something
and now supplies the reference build's own sample data: its profile, its
fourteen people with their answer counts, its three papers, its social preset
and its bar. That is what makes a diff measure layout rather than content. It
is not a substitute for one signed-in pass.

---

## What each screen actually needed

### Crew's empty state

The tab reached Lessons until `9f753a8`; with nobody else on the module it then
drew a blank panel. `CrewEmpty.jsx` is `crewEmpty()` from the pack, element for
element — heading, what Crew is and why it helps, three ghosted chapter rows,
**Find a squadron** / **Invite your class**, and the line that says what happens
when somebody else arrives. Both buttons reach the Ready Room.

### The licence card

Six bugs, and what each turned out to be:

* **5** the card overflowed its column — it was a 1240px page holding a 520px
  tab strip and a 760px panel, all flush left. One 680px column now.
* **6** "Create your stamp" sat on the artwork — the reference's own `.sblock`.
* **7** the YOUR CODE box is deleted, and the creator opens on the code the
  account already holds rather than asking for it again.
* **8** the header is the reference's `.boxh` above the card.
* **9** the Cover button is top-LEFT of the banner, which is where the
  reference puts it. ADMIN is the top-right badge.
* **16** the stats spread end to end.

The cover picker draws all **36 named colours** with their names under them,
and the photo crop is the reference's `openCrop`. Both were reachable before;
neither named a colour.

### Preferences

* **10** "Go by callsign" and the whole "Your pilot / What you'll hear about"
  block are deleted, and `PilotSettings.jsx` with them. Not moved.
* **11** the greeter is the reference's order: choice row, one description
  line, then the field with that greeter's placeholder.

### The module screen

* **13** the search field fills the row.
* **14** the subtitle under the title, and the Crew tab's count.
* **15** lesson thumbnails are the reference's lit panel, not grey boxes.
* **12** Study cards rows are the stacked thumbnail, the kept line and **Test
  yourself**, not a doc icon and an "Open" button.

---

## Ten things that were found by measuring

None of these was on the bug list. Each was invisible from the screen.

1. **A stray backtick closes a CSS template literal, and the build does not
   care.** `const PROFILE_CSS = ` … a backtick inside a comment … ` parses as a
   property access followed by a tagged template, so the module throws at
   evaluation: every profile tab rendered nothing at all, for ever, with no
   console error. It happened four times in one day. `check:collisions` holds
   it now, in both shapes this repo writes CSS in, plant-proved.
2. **`.lbody` was two components.** `lesson.css` claimed it bare — a logbook
   row's body — and the reference calls the licence card's body the same
   thing. The card came out 4px tall.
3. **`.mscreen .mod`** styled a Flight Deck tile inside a container that has
   not drawn one in months. It gave the rebuilt module screen a 176px minimum
   height and a housing border.
4. **`.mscreen .hrow`** — the hidden People tab's grid — reached Crew's helper
   row. One pill measured 38px wide, the next 790, the row three lines tall.
5. **`.mscreen .chap+.chap`** drew a second hairline on every chapter seam.
6. **The launch pack was missing a stylesheet.** `01-tokens-and-base.css` is
   from reference 02; `11-module-screen.css` is lines 161-313 of reference 01.
   Everything reference 01 declares above line 161 — `.card`, `.tabs`, `.tab`,
   `.chip` — was in neither, which is the card the module screen IS.
7. **§12's 44px hit floor named an exception for inline controls and only
   implemented it for `button`.** It covers `input`, `select` and `textarea`
   now, which is what the sentence beside it always said. Worth 43px of the
   licence card's height.
8. **The blocked list returned `null` while it loaded**, leaving its box as a
   label over nothing — a panel that names itself and then stops.
9. **The stamp creator could not be left with Escape.**
10. **The snap in `make-ref-pages.mjs` worked at one width in three.** It
    corrected a fractional position with a padding, and where the correction
    was negative the browser dropped the declaration in silence.

---

## The lesson page, and why it is not ported

`docs/launch/BUGS.md` row 17. It measures 27.01% / 32.40% / 37.28%.

**What it needs.** The reference's `.lesson` is
`grid-template-columns: minmax(0,1fr) 300px; gap: 22px`, filling a 1056px page
column, with `.col` stacking three things 14px apart — `.player`,
`.title-row`, `.card.logcard` — and an `aside.card.next` beside them. The app's
`.watch` is a named-area grid at `6px 24px` inside a **full-width** `main`: the
lesson route deliberately opts out of the 1100px content column so the player
can be bigger, and `.watch`'s own §3.2 caps it at 58vh so the notes stay above
the fold. So the container alone is 1200px against 1056, and the two columns
are 878+300 against 734+300.

**Why it was left rather than half-done.** Three of those numbers are three
declarations, and changing them without the page width leaves the player
touching the edge of the screen — which was tried and reverted. Changing the
page width is a design decision about this app's video page, argued at length
in `lesson.css`, and it shrinks the player. Past the container, the port is a
rebuild of a component that carries live behaviour: a real `<video>` node moved
between slots by ref, watch tracking that writes the sign-off flag, a Save
button wired to the saves store, and a sticky logbook with filters. The
reference's player is a mock with a drawn board where the video goes.

**What it does NOT need.** Nothing on it is broken. Every control works, the
route walk passes, and `12-lesson-page.css` is already scoped and generated at
`src/components/module/ref-lesson.css`, ready for the markup to meet it.

---

## Decisions taken alone

All of them are in `docs/launch/DECISIONS.md` with their measurements. The ones
that change what a student sees:

* **The 44px hit floor gives way in seven places** — the licence card's
  callsign, bio and phrase (genuinely inline text), its Cover pill and avatar
  camera (the floor made the camera an *oval*), Preferences' two segmented
  strips and the module strip's search field. All still clear WCAG 2.2 AA's
  24px minimum; §12's 44 is the stricter house rule. `DECISIONS.md` says how to
  reverse each in one line.
* **The profile page is one 680px column**, centred. Appearance narrows with
  it; its contents are untouched and it was checked at 1280 and 390.
* **The module card has no 560px minimum any more.** Switching to a shorter
  tab now changes its height, as it does in the design.
* **The greeter placeholders are the reference's**, which are shorter than the
  app's. The app's are kept in `DECISIONS.md`.
* **`done/total` is not drawn on a study-card row.** Nothing counts flipped
  cards; inventing a number a student reads as progress is worse than a row
  that does not claim one.
* **The licence card carries no `--accent` of its own.** The reference tints
  each card from the pilot's livery; that system was deleted in migration 0013
  and setting it here would be re-adding it.

---

## What is left

Under the bar, in the order it would be sensible to do it:

1. ~~**The lesson page**~~ — ported (`a8b9b6c`), 27/32/37% → 14/24/26%. Still
   over the bar; the remainder is the container width argued below.
2. **Crew at 390** (15.23%) carries the most of the four ported screens,
   because a long stacked column accumulates a few pixels a row.
3. **§12 against the reference** on the remaining pills — the reference's
   `.pill` is 36.1px and the app's floor makes it 44. One decision, applied in
   one place, would close a point or two on three screens.
4. **One signed-in diff pass**, which is the only thing in this report that
   needs the owner rather than a keyboard.

## Running it yourself

```bash
npm run harness                     # the app, port 5190
node tools/make-ref-pages.mjs       # regenerate public/__ref from the references
BASE_URL=http://127.0.0.1:5190 node tools/ref-diff.mjs licence
node tools/boxes.mjs licence 768    # the same element, both sides, every child
node tools/rules.mjs /m/m1 .lbody font-size   # which rule is setting this
```

`npm run ref:css` regenerates the scoped stylesheets from the reference builds.
Nothing under `src/components/**/ref-*.css` is hand-edited.
