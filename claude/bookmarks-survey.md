# Survey · Bookmarks (read-only, before any code changed)

Answers to §2 of `claude/brief-bookmarks.md`, found by reading the repo rather than
assuming. Where an answer contradicts the brief it says so — those are the places the
port had to bend, and each one is carried into the report.

---

## 1 · Router

**`TransitionRouter` (react-router-dom 7.18.2), but there is no route table.**
`src/components/TransitionRouter.jsx` is react-router's `BrowserRouter` with a
synchronous commit and a pop handler; it exists so view transitions photograph the new
page (see CLAUDE.md, "Screen changes and transitions"). Above it, **`src/lib/routes.js`
is the whole router**: a pure `parseRoute(pathname)` and a pure `path` builder, and
`App.jsx` switches on `route.name`. There are no `<Route>` elements anywhere, so
`index.js`'s suggested route table does not apply and the new screens are added to
`parseRoute` + the `App.jsx` switch instead.

| Screen | Real path | Route name |
|---|---|---|
| Flight Deck | `/` | `home` |
| Module | `/m/:module` | `module`, tab `chapters` |
| Module Library | `/m/:module/library` (and `/library/quizzes`) | `module`, tab `pdf` |
| Chapter quiz | `/m/:module/:chapter/quiz` (`/quiz/resume` re-enters a run) | `chapter`, tab `quiz` |
| One question | `/m/:module/:chapter/q/:n` | `chapter`, tab `quiz`, `question` (a **number**, not an id) |
| Lesson | `/m/:module/:chapter/lesson/:lesson` (`/q/:id` opens a question with it) | `lesson` |
| Paper reader | `/m/:module/paper/:paper` | `paper` |
| Old bookmarks | `/saved`, behind flag `page.bookmarks` (off) | `saved` |
| Settings | `/settings`, `/settings/:page` | `settings` |

Module codes are upper-cased on parse and lower-cased on build. Every renamed path
already resolves through a `{ name: "redirect", to }` result plus a 308 in `vercel.json`,
so `/settings` → `/bookmarks` has a pattern to follow exactly.

## 2 · Quiz data — **no stable ids today**

Questions live in `src/content/test-content.json` (the `content.test` flag is
`everyone: true`, so this is what the app actually shows) at
`modules[].chapters[].quiz.questions[]`. `src/data.js` is a skeleton with no questions
at all. The field names are **not** the brief's:

| Brief | Real |
|---|---|
| `stem` | `question` |
| `answerIndex` | `correct` |
| `explanation` | `explain` |
| — | `lessonId` (points at the lesson that taught it) |

**There is no id in the data.** `src/lib/contentLoader.js:57` synthesises one:
`id: q.id || \`${c.id}.Q${i + 1}\`` — which is positional, i.e. exactly the
"question 4 of quiz 1" R2 forbids. Reordering a quiz silently re-points every save.
R2 therefore needs real ids written into the content, and `check-question-ids.mjs`
pointed at the loader.

## 3 · Quiz taker

**Yes, the EASA-style taker is live**: `src/components/module/Exam.jsx`, mounted by
`App.jsx` for `route.name === "chapter" && route.tab === "quiz"`, with every rule in
`src/lib/quiz.js`. The **flag control is `.btn--flag`** in the question footer
(`aria-pressed`, `flag(a, a.at)`), which is where `SaveButton` goes.

**It cannot open at a question without starting a graded attempt.** A sitting is latched
at mount (`const [set] = useState(questions)`), the attempt is restored from
localStorage or created, and the clock starts; `resumeAt` only picks the index *inside*
an attempt that already exists. `goTo` exists in `quiz.js`, so `?q=` is wirable **into a
resumed attempt**, but opening a saved question from Bookmarks on a chapter with no
attempt would start one and put 75 s/question on the clock. R5's escape hatch applies.

## 4 · Lesson player

One player for the whole app: `src/components/module/PlayerLayer.jsx`, mounted above the
router in `App.jsx` and positioned over an empty slot that `LessonPage.jsx` renders.
The control bar is inside it; **the note button is `openNote()`**, which pauses and calls
`openBar(s, { lessonId, seconds: el.currentTime })`. Current time is `el.currentTime` on
the `<video>` ref, and `mmss()` renders it. That is where `SaveButton kind="video"` goes,
and `getAtSeconds` is `() => el.currentTime`.

**The lesson route cannot start at a second today.** It carries a question
(`/q/:id`), not a time. Seeking exists (`seekTo(fraction)`), so `?t=` is wirable.

## 5 · Paper reader

**v6 is live** (`src/components/paper/v6/ReaderV6.jsx` + `part2.js`, behind
`library.reader`). The page counter is inside the island (`paintCounter()`, `part2.js`),
the current page is `ctx.page` / `island.page()`, and `ctx.jump(n)` scrolls to a page —
the reader already re-opens on the page it was left on, from `pw-rdr6-…-page`.

**A page bookmark already exists**: `part2.js:277` draws
`<button data-bmk="1" aria-label="Bookmark this page">`, toggling a `Set` persisted at
`${key}-bm` and reported through `ctx.onBookmark(page, on)`. So the Pages save point is
a control to **wire**, not one to add — which is better than adding a second bookmark
next to it.

## 6 · Supabase + Clerk — **the brief's auth model does not exist here**

`src/lib/supabaseClient.js` is a bare `PostgrestClient`, deliberately: the app calls only
`.from()` and `.rpc()`, and **there is no authenticated Supabase client anywhere**. Clerk
owns identity; the client is anonymous from Postgres' point of view; `user_id` columns
hold the Clerk id as `text`, passed by the app. `auth.jwt() ->> 'sub'` is **NULL on every
request** — migration 0009's header says exactly this about `auth.uid()`, and warns that
a policy referencing it silently denies every row rather than failing.

So `20260918120000_saves.sql` as handed over cannot work: the `user_id` default would be
NULL (not-null violation) and all four policies would deny everything. It has to mirror
the comments pattern — RLS enabled, `using (true)`, scoping in the app — which is what
every other table in this database does. **The consequence is stated plainly in the
report: R1's "with B's token, a direct select on A's rows returns nothing" cannot be true
in this architecture, for saves or for any other table.**

## 7 · Tokens

All eight live, emitted onto `:root` by `src/lib/liveryEngine.js`:
`--ground --panel --raised --line --t1 --t2 --t3 --active` (plus `--on` and `--lit`).

- **On-accent text:** two of them, and they are not interchangeable. `--active-text` is
  the accent *read as words* on a panel; `--on-fill`/`--ground` is the text *on* a filled
  control, with `--active-fill` the darker fill it sits on. `bookmarks.css`'s `--on-active`
  maps to the filled-control pair.
- **Master Caution:** `--caution`, with `--on-caution` and `--caution-glow`.
- **Light lighting selector:** `.app.theme-light` (App.jsx:1287). Not `[data-theme]`.
- **Smooth Air:** the same switch sets `.app.reduce-motion` and `.app.smooth-air`
  together; `motionOff()` in `viewTransition.js` is the one reader, and it also honours
  `prefers-reduced-motion`.
- **Instrument scale:** `--font-scale` / `--scale` on `.app`, applied as
  `zoom: var(--font-scale, 1)` on `.content`. **Not** a root font-size, so `rem` sizing
  inside Bookmarks would ignore the student's text-size setting.
- Finishes are attributes on `.app`: `data-aur` (Aurora), `data-paper`/`data-fiche`
  (Manual), `data-tooth` (Day).

## 8 · Flight Deck

The bag cell is the second `.cel` of `.deck .card`'s instrument strip in
`src/components/Home.jsx` (~line 615) — today a number "ladder" or a briefcase glyph
with the caption "A bookmark fills the bag." The Manual finish draws the same strip in
`PaperStrip.jsx`. Its count is `bookmarks.length` from `progress.get("pw-bookmarks", [])`.

The hero's module is **`activeModuleCode`** in `App.jsx:550` —
`route.moduleCode || preferredModuleCode`, where `preferredModuleCode` starts at the
first module with `status === "active"`. That is the value `content.currentModuleId()`
must return so the bag and Bookmarks agree.

## 9 · Profile menu and Settings

`src/components/ProfileMenu.jsx`. Rows: the account row (which **is** the Licence link),
a separator, Preferences, Appearance, Settings. Sign out is deliberately not here.

**Settings is not an empty page.** `src/components/SettingsPage.jsx` renders
`<PilotSettings/>` (callsign + "when you usually study") and `<BlockedList/>` (the only
way to unblock anybody). The brief's "It was an empty page" is wrong about this repo, and
deleting the page as written would delete the unblock control. The callsign is already
duplicated on the Licence tab (`Profile.jsx`, with server-side uniqueness), so what
actually needs a new home is the blocked list and the study-time preference.

## 10 · Toasts

**There is no toast system.** The nearest things are one-off `role="status"` regions
(`ChaptersPanel`'s `.bump`, `Spooling`, `AddPaper`). Nothing is reusable and nothing
carries an action button, so `BookmarksToastHost` ships as the app's first one.

## 11 · Topbar height

`header.topbar` is `padding: 14px 24px 12px` around a 40 px avatar button → **66 px**,
and the same at ≤640 px (`14px 16px 12px`). Measured rather than computed in the report.

## 12 · Tests

**No Vitest.** The house pattern is two-part and strong: `scripts/check-*.mjs` for static
and measured assertions (30 of them in `npm run check`) and `tests/*-run.mjs` for
Playwright walks (`test:exam`, `test:rr`, `test:vt`, `test:reader`, `test:ground`), with
a dev harness at `npm run harness` (:5190) and `npm run harness:prod` (:5191). Adding a
second runner for nine pure-logic tests would put the saves rules outside `npm run check`,
which is the gate this project actually runs.
