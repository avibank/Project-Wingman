# Brief · Bookmarks, Study cards and the Flight bag

**For:** Claude Code, working in `avibank/Project-Wingman`.
**Status:** Design is signed off. Your job is to port it exactly, wire it to the real app, hunt bugs, and leave it launch-ready.
**Visual truth:** `reference/wingman-bookmarks-demo.html` (whole flow) and `reference/flight-bag.html` (the bag, close up and real size). Open both in a browser before you start.
**Code truth:** everything under `src/features/bookmarks/`. It's been built and run against the harness, and its store tests pass. Copy it in as-is and adapt only where a line says `ADAPT`.

Where the demo and the code disagree, **the code wins**. The demo has example content and demo-only controls (the dashed "Demo" bar, "Save something", "Empty the bag", the Flight Deck stand-in). None of those ship.

---

## 0 · How to work this brief

1. **Survey first, change nothing** (section 2). Write down what you find in `claude/bookmarks-survey.md`.
2. Build in the order of section 3. Each rule has a **Check**. Don't move on until it passes.
3. Run the launch sweep (section 5).
4. Create the backlog file (section 6) and the report (section 7).

If something in this brief can't be done as written, stop and say so in the report. Don't ship a half-version and don't invent a substitute. **A folder, button or link that leads nowhere is a launch blocker.** Remove it or finish it.

---

## 1 · Decisions already made. Don't reopen them.

- **Settings is removed.** It was an empty page. The profile menu reads: profile row, Preferences, Appearance, **Bookmarks**. `/settings` redirects to `/bookmarks`.
- **Bookmarks is its own screen**, reached from the profile menu and from the Flight Deck bag.
- **Four folders, locked:** Questions, Study cards, Videos, Pages. The layout is Instagram-style "Saved" folders. On desktop and landscape tablet they sit four across; on portrait tablet and phone they're 2×2. Either way they **fill the screen**.
- **Folder covers auto-play** through their newest five items like stories, a beat apart, and hovering or focusing pauses them. This is a firm keep.
- **No time filters** anywhere: not on the home screen, not in the lists. Lists are newest first.
- **The module picker is the module name in the subtitle** ("15 saved in **Module 1 ▾**"), and it opens on the hero card's module.
- **Study cards come from quizzes. Nothing else.** Each chapter quiz is also a card set in the Library: question on the front, right answer on the back. There are no definitions, no AI and no text pulled from PDFs. Opening a set lets you flip through it, and the bookmark on a card saves it to Bookmarks → Study cards.
- **Questions and Study cards are kept separate even for the same question.** A save from the quiz goes to Questions (practised as a quiz). A save from a card set goes to Study cards (flipped as cards).
- **Only facts are shown.** Questions show the question and "Chapter N quiz". Pages show the page number and module only. Videos show lesson title, chapter · lesson, and the saved second. Nothing is extracted, summarised or guessed.
- **Study cards look like app cards**, not paper: raised panel, livery-coloured answer. The top card flips up and away like a notepad page. The bookmark sits on the card, the count is at the bottom, and arrows sit either side on desktop (swipe on touch).
- **The Flight bag is the original briefcase, built in layers:** back wall and handle, three sheets inside, front wall with seam and latches.
  - Empty: grey, latches shut, papers hidden, no text.
  - Filled: lit in the livery, latches sprung, sheets standing proud and riffling one at a time, and just the number underneath.
  - A new save drops a sheet in and the case takes the weight.
- **House-style exception, deliberate:** Bookmarks uses rounded cards and shadows (the Instagram look). Don't "fix" it back to hairlines.
- **The end of a practice run or test is encouraging, with no scores or stats.**

---

## 2 · Survey first (read-only)

Answer each of these in `claude/bookmarks-survey.md` before writing code:

1. **Router:** which router, route file, and the real paths for the Flight Deck, a module's Library tab, a chapter quiz, a lesson, and the paper reader.
2. **Quiz data:** where questions live. Does every question have a **stable id** that won't change when the quiz is edited or reordered? What are the field names for question text, options and correct answer? Is there an explanation field?
3. **Quiz taker:** has the redesigned EASA-style quiz taker been applied? Where's the flag control? Can it open at a given question?
4. **Lesson player:** where's the control bar with the note button? How do you read the current playback time? Can the lesson route start at a given second?
5. **Paper reader:** which version is live? Where's the page counter? Can the reader route open at a given page?
6. **Supabase + Clerk:** how do comments get an authenticated Supabase client? Does RLS use `auth.jwt()->>'sub'`?
7. **Tokens:** confirm the live names (`--ground --panel --raised --line --t1 --t2 --t3 --active`). Is there an on-accent text token and a Master Caution colour token? Which selector marks Light lighting? How is Smooth Air exposed? How does Instrument scale work (root font-size or something else)?
8. **Flight Deck:** the hero strip's bag cell component, and where the hero decides which module it shows.
9. **Profile menu** component, and the Settings route and page.
10. **Toasts:** does the app already have a toast system?
11. **Topbar height:** needed for `--bm-topbar`.
12. **Tests:** is Vitest set up?

---

## 3 · Build rules

Format: **Rule** = what must be true. **Mechanism** = the one place it's implemented. **Check** = what proves it, and what fails the build if it stops being true.

### R1 · One saves list, private to each student
- **Rule:** Every bookmark is a row in one `saves` table. A student can only read and change their own rows.
- **Mechanism:** `supabase/migrations/20260918120000_saves.sql`. Mirror the comments auth pattern if it differs from `auth.jwt()->>'sub'`.
- **Check:**
  - Sign in as student A and save things. Sign in as student B and see none of them.
  - With B's token, a direct `select` on A's rows returns nothing.
  - The unique constraint rejects a second identical save.

### R2 · Questions have stable ids
- **Rule:** A saved question points at the question itself, never at "question 4 of quiz 1".
- **Mechanism:** Add ids to the quiz data if any are missing, then point `scripts/check-question-ids.mjs` at the quiz data and add it to `npm run build` (e.g. `"prebuild": "node scripts/check-question-ids.mjs"`).
- **Check:** The build fails if a question has no id, if two questions share one, or if a question has no valid answer. Reorder a quiz locally and confirm saved questions still show the right text.

### R3 · Saving is instant and honest
- **Rule:** Tapping a bookmark changes the screen immediately and the server follows. If the server refuses, the screen goes back and the student sees a plain message with Retry. Nothing is shown as saved that isn't saved.
- **Mechanism:** `savesStore.js` is the only code that creates or removes saves.
  - Call `initSaves({ getSupabase, userId })` once after Clerk sign-in, using the same authed client factory comments use.
  - Call `resetSaves()` on sign-out.
  - Mount `<BookmarksToastHost/>` once near the app root, or point `toast()` at the existing toast system.
- **Check:**
  - `savesStore.test.js` passes. Add Vitest and jsdom as dev dependencies if needed.
  - In the harness, "Fail next save/remove" produces the revert and the Retry message.
  - DevTools offline mode produces "You're offline, so that didn't save."

### R4 · Every folder has a real way to fill it
- **Rule:** All four save points exist and work, and each folder's empty line points at a control that exists.
- **Mechanism:** One component, `SaveButton`, everywhere, with the same icon (outline = not saved, filled = saved).
  - **Quiz taker:** on each question, next to the flag:
    ```jsx
    <SaveButton kind="question" moduleId={q.moduleId} refId={q.id} chapter={q.chapter} />
    ```
    The flag means "come back to this in this attempt"; the bookmark means "keep this".
  - **Quiz results:** one button, "Save the ones I missed", which calls `addMany(missed.map(q => ({ kind:'question', moduleId:q.moduleId, refId:q.id, chapter:q.chapter })))` and then shows `toast('N questions saved', { action:{ label:'View', fn:() => navigate('/bookmarks/questions?m='+moduleId) } })`. Hide the button when nothing was missed.
  - **Lesson player:** in the control bar, next to the note button:
    ```jsx
    <SaveButton kind="video" moduleId={lesson.moduleId} refId={lesson.id} chapter={lesson.chapter} getAtSeconds={() => player.currentTime} />
    ```
    Tapping again at a different second moves the saved second; tapping at the same second removes it.
  - **Paper reader:** one bookmark for the current page, in the reader's top bar or island:
    ```jsx
    <SaveButton kind="page" moduleId={paper.moduleId} refId={paper.id} page={currentPage} />
    ```
    It must show filled when the current page is saved.
  - **Card sets:** already built into `StudyPad` (`mode="set"`).
- **Check:** From a fresh account, fill each of the four folders using only the live UI. If any save point can't ship, **stop and report**. Don't ship a folder nobody can fill.

### R5 · Every saved thing opens at the exact spot
- **Rule:** A saved question opens inside its quiz, a video at its saved second, and a page in the reader at that page.
- **Mechanism:** `routes` in `content.js`, plus reading the parameter on each target screen: `?q=` in the quiz taker, `?t=` in the lesson player, `?page=` in the reader.
- **Check:** Click each kind from Bookmarks and confirm you land on the exact question, second and page. **If the quiz taker can't open at a question** without starting a graded attempt, remove the "Open in its quiz" link from `FolderPage.jsx` (the answer is already shown in the row) rather than leaving a link that lands in the wrong place.

### R6 · Profile menu and the end of Settings
- **Rule:** The menu shows Bookmarks where Settings was, with the bookmark icon and a small count. Settings is gone and old links still work.
- **Mechanism:**
  - Edit the profile menu component.
  - Delete the Settings page and its route.
  - Add a `/settings` → `/bookmarks` redirect.
  - Add the routes listed in `src/features/bookmarks/index.js`.
- **Check:** Nothing in the codebase links to Settings any more (`grep -ri settings src/`). `/settings` lands on Bookmarks.

### R7 · Flight bag instrument
- **Rule:** The hero strip's bag cell is the briefcase from `reference/flight-bag.html`, reading the same module as the hero card.
- **Mechanism:** Replace the bag cell's contents with `<FlightBag moduleId={heroModuleId} />`. It's a button that opens Bookmarks on that module.
- **Check:**
  - At 0 saves: grey case, no text.
  - At 1 or more: lit, papers visible, the number shown.
  - Save something elsewhere and come back: the count is right.
  - While on the deck, a new save plays the drop.

### R8 · Library: the Study cards section and card set pages
- **Rule:** Each module's Library tab shows **Study cards** between Quizzes and Papers, one row per chapter quiz, opening that chapter's cards.
- **Mechanism:** Mount `<LibraryStudyCards moduleId={moduleId} />` inside the Library card between the two sections, and add the route `/m/:moduleId/library/cards/:chapter` → `CardSetPage`.
- **Check:** Each set shows exactly that quiz's questions in quiz order. A chapter with no quiz shows no row. A bad chapter URL shows "Card set not found" with a way back.

### R9 · Content goes through the adapter only
- **Rule:** Screens never reach into app data directly.
- **Mechanism:** Implement every `ADAPT` in `content.js`, and make `content.currentModuleId()` use the same source as the hero card.
- **Check:** `grep -rn "ADAPT" src/features/bookmarks` returns only comments, with no unimplemented functions that throw. A question deleted by the author disappears from Bookmarks and its save is pruned (the harness includes one).

### R10 · No dead buttons, no dead ends
- **Rule:** Every control does something, and every screen has a way back.
- **Mechanism:** Walk this list on the live build and tick each one in the report:
  - Profile menu → Bookmarks.
  - Flight bag → Bookmarks on the hero module.
  - Back link → Flight Deck.
  - Module picker opens, switches, and closes on outside tap and on Esc.
  - Each folder opens its list.
  - Each folder's play button:
    - Questions → practice sheet.
    - Study cards → test pile.
    - Videos → part-watched lesson at its second.
    - Pages → newest page in the reader.
  - Questions list: row expands, "Open in its quiz" (or removed per R5), unsave with Undo.
  - Study cards folder: flip, turn, unsave with Undo, "Browse all card sets in the Library".
  - Videos: thumbnail opens at the second, unsave with Undo.
  - Pages: Open, unsave with Undo.
  - Empty folder lines: each named control exists. The Study cards one links to the Library.
  - Card set page: back to Library, Test yourself, save and unsave each card, keyboard arrows and space.
  - Practice sheet and test pile: answer, Next or Finish, Go again, Done, "Unsave the ones I got", close on ✕ / Esc / backdrop.
  - Toasts: View and Undo go where they say.
  - `/bookmarks/<nonsense>` → Bookmarks. `/settings` → Bookmarks.
- **Check:** Every item is ticked in the report, with a screenshot of each screen.

### R11 · Looks right on every surface, measured
- **Rule:** All 6 liveries × Light/Dark × Standard/Aurora/Manual render correctly with no extra CSS. Body text contrast is at least 4.5:1, large text at least 3:1, nothing is under 13px, and touch targets are at least 44px.
- **Mechanism:** `bookmarks.css` reads only live tokens and is scoped under `.bm`.
  - Map `--on-active` and `--caution` at the top if the live names differ.
  - Add the app's real Light selector to the Light block if it isn't `data-theme="light"`, `.light` or `data-lighting="light"`.
  - Set `--bm-topbar` to the real topbar height.
- **Check:** Measure. Don't eyeball it. Screenshot Bookmarks home, a folder, a card set and the bag in all 36 combinations. Run a contrast check on muted text (`--t3`) on `--panel` and `--raised`, and on text over `--active` buttons. Record the numbers. Fix any failure by adjusting the `bm-` token, never with one-off colours.

### R12 · Motion respects Smooth Air
- **Rule:** With Smooth Air on (or OS reduce-motion), nothing animates: covers stay on the newest item and the bag stays still. Everything still works.
- **Mechanism:** `motion.js` → `content.smoothAir()`. Every `.bm` root gets `is-calm`.
- **Check:** Toggle Smooth Air in the harness and in the real Appearance screen.

### R13 · The harness never ships
- **Rule:** `__harness__/` is dev-only.
- **Mechanism:** Mount `BookmarksHarness` at `/__bookmarks-harness` only inside `if (import.meta.env.DEV)`. Don't import `fixtures.js` or `fakeSupabase.js` from any live file.
- **Check:** `npm run build`, then search the output bundle for `Bookmarks harness`. It must not appear.

### R14 · Analytics
- **Rule:** You can learn from the beta.
- **Mechanism:** `content.track()` forwards to the app's analytics. The events are save_added, save_removed, practise_started, test_started, card_set_opened and bookmarks_opened.
- **Check:** If there's no analytics yet, leave `track` empty and log it in the backlog. Don't block launch on it.

### R15 · It must match the demo, measured side by side
- **Rule:** The built screens look like `reference/wingman-bookmarks-demo.html`. Same layout, same spacing, same type sizes, same motion. This is the acceptance test for the whole job: if a screen doesn't match, it isn't done.
- **Mechanism:** The CSS and components in this pack are the very code that produced the demo. Keep them byte-for-byte. If something looks wrong, the cause is in the app around them, not in these files — fix it there:
  - `--bm-topbar` must equal the real topbar height, or the four folders won't fill the screen.
  - The page that renders `BookmarksPage` must not add its own max-width, padding or centring. The component is the page.
  - Map `--on-active` and `--caution` to the live tokens at the top of `bookmarks.css`.
  - Add the app's real Light-lighting selector to the Light block.
  - Make sure no global rule reaches inside `.bm` (a global `button`, `a`, `h1`, `ul` or `*` reset with higher specificity). If one does, fix the global rule or raise the `.bm` rule; never rewrite the design to fit.
- **Check — do this, don't skip it:** For each screen below, open the demo and the live build side by side at **1440**, **820** and **390** wide, in **Sky blue / Dark / Standard**, and screenshot both.
  - Bookmarks home (full folders, and empty)
  - Each of the four folders
  - A card set page, front and back of a card
  - The practice sheet mid-question and its finish screen
  - The test pile
  - The Flight Deck bag, empty and filled
  Then measure and record these numbers from both, and they must agree within 2px:
  - The folder grid: columns, gap, and the height of one cover
  - The page title size, and the gap from title to folders
  - Card pad width and the card's aspect
  - The bag's drawn width, and the gap to the number under it
  Any difference: state it in the report with the reason. "Close enough" is not a result. Repeat the home screen and one folder in **Caution amber / Light / Aurora** to prove the livery and finish systems carry it.

---

## 4 · Copy that must match

| Where | Exact words |
|---|---|
| Menu item | Bookmarks |
| Home title / empty | Bookmarks · "Nothing yet in Module 1 ▾" · "Tap ☐ on a quiz question, a study card, a lesson or a page, and it lands here." |
| Folder names | Questions · Study cards · Videos · Pages |
| Save toasts | "Saved to Questions" [View] · "Removed from Questions" [Undo] (and the same pattern for each folder) |
| Failure | "That didn't save. Try again in a moment." [Retry] · "You're offline, so that didn't save." |
| Library section | Study cards · "One set per quiz" · "Chapter 1 cards" · "5 cards · 2 saved" |
| Finish | "Clean run." / "Getting there." / "Worth another pass soon." with no numbers |

---

## 5 · Launch sweep (bugs, then polish)

- `npm run build` is clean with no warnings from these files, `check-question-ids` passes and the Vitest suite passes.
- There are no console errors or React key warnings on any Bookmarks screen, on the Library tab or on the Flight Deck.
- Check phone (390 wide), portrait tablet (820), landscape tablet (1180) and desktop (1440):
  - Folders fill the screen.
  - The card pad fits.
  - The practice sheet scrolls if needed.
  - No sideways page scroll.
- Slow 3G: saves still feel instant, and nothing is shown twice when the server catches up.
- Two tabs open: a save in one appears in the other after a refresh. Live sync isn't needed; log it in the backlog if wanted.
- Sign out, then sign in as someone else: none of the first student's saves are visible.
- Keyboard only: every control is reachable, focus is visible, and Esc closes overlays.
- Delete a question from the data (locally): its saves vanish quietly and the rest still work.

---

## 6 · Create `claude/backlog-bookmarks.md`

Copy it from this pack (`claude/backlog-bookmarks.md`) and add anything the survey or sweep turns up that's out of scope. Each entry needs: what, why it matters, what it's blocked by, and a size.

---

## 7 · Report back (`claude/bookmarks-report.md`)

1. The survey answers.
2. Each rule R1–R15 with its Check result. Paste measurements, not "looks fine".
3. The R10 walk-through, ticked, with screenshots.
4. The R15 side-by-side shots and the measured numbers.
5. Anything you changed from this brief and why.
6. Anything you couldn't do. Say it plainly.
