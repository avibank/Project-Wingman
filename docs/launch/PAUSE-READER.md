# Pausing the papers reader — the survey

Step 1 of `pause-papers-reader.md`, written down before anything was edited.
Searched the whole repo for `paper papers reader pdf annotat highlight mark
marks island sheetpg textLayer pdfjs pdf.js quad anchor /m/*/paper readerv6
ReaderV6 papers-reader`, including config, tests, docs, scripts and public.

Two words in that list are false friends here and are NOT the reader:

* **`paper` the finish.** `PaperStrip.jsx`, `data-paper="1"`, `.app[data-paper]`
  in `Deck.jsx` — the Manual finish's instrument strip. Untouched.
* **`anchor` the popover.** `Menu({ anchor })` in `room/bits.jsx`,
  `SeenPanel({ anchor })` — the element a popover hangs off. Untouched.

---

## 1 · Routes and pages that render the reader

| Where | What |
|---|---|
| `src/lib/routes.js:94` | `/m/:module/paper/:id` → `{ name: "paper" }` |
| `src/lib/routes.js:155` | `routePath.paper()` builds that address |
| `src/App.jsx:1796-1860` | the `route.name === "paper"` arm: four states (finding, pending, not-in-this-module, the reader) |
| `src/App.jsx:74` | `CHUNK.paper` → `components/paper/v6/ReaderV6.jsx` |
| `src/App.jsx:100` | `ROUTE_CHUNKS.paper` |
| `src/App.jsx:322` | `MODULE_ROUTES` — the hour meter counts time on a paper |
| `src/App.jsx:2110` | the Add-a-paper sheet (`AddPaper`, its own chunk) |

The reader's own source is `src/components/paper/v6/` (13 files) and
`src/lib/{papers,paperText,paperMarks,paperInk,paperTray,paperView,paperIngest,annotations,anchor}.js`.
**Nothing outside `src/components/paper/v6/` imports any of it except App.jsx's
one lazy `import()`** — which is why pausing is a guard rather than a surgery.

## 2 · Server-side things that exist only for the reader

There is no server. Everything is an anon PostgREST call from the client:

`papers_for`, `add_paper`, `delete_paper`, `paper_status`, `paper_marks_for`,
`paper_corrections_for`, `paper_annotation_status`, `agree_with_mark`,
`paper_ink_for`, `my_marks_in_module`, and direct reads of `paper_annotations`.
Tables: `papers`, `paper_annotations`, `paper_ink`. **All stay. Not dropped, not
migrated, not emptied.** They stop being called because nothing calls them.

## 3 · Links into it

1. **Library → Papers** — `LibraryTab.jsx:134-240`: the section, its count line,
   the chapter chips, one row per paper, Resume/Open, the progress hairline,
   **Add a paper** (twice), and two empty states that both name the reader.
2. **The Library's search placeholder** — `moduleSearch.js:60`, "Search quizzes,
   cards and papers", and `hits()` searches paper titles.
3. **Bookmarks → Pages** — the fourth folder: `useSaves.js` `KINDS`/`FOLDERS`,
   the folder card, `FolderPage`, `routes.readerAt()`, "Open".
4. **The Flight Deck's Resume** — `lastPlace.js`: a stored place of kind
   `paper` gives "Reopen the paper" and "<title>, still open."
5. **Warm-on-intent** — `App.jsx:124`, a pointer resting on a paper row fetches
   the reader chunk; and `App.jsx:1109`, which fetches it on the Library too.
6. **The Ready Room's paper passages** — the composer's **Paper passage**
   option (`rr/Chat.jsx:346`), the picker fed by `fetchMyMarks`, the passage
   bubble in the transcript (`Chat.jsx:65`), and tapping it → `onOpenPaper`.
7. `openPaper()` itself falls back to `window.open(file)` when
   `library.reader` is off — so turning **that** flag off does not pause papers,
   it changes how they open. This is why the pause needs its own switch.

## 4 · Reader data shown elsewhere

* `saves` rows of kind `page` — the Pages folder, and they are counted by
  `useSavesCount`, which is **the Flight Deck's flight-bag number**.
* `pw-last-place` entries of kind `paper` — the Flight Deck's Resume.
* `pw-paper-place` — "you are on page N" and the hairline on a Library row.
* `pw-paper-opened`, `pw-papers:<module>` — written, read only by the Library.
* `comms_attachments` rows of kind `passage` — quote, paper title, page, anchor,
  in squadron chat.
* **Not** Ready Room threads: `sourceOf` in `ReadyRoom.jsx:433` only ever
  returns `kind: "lesson"`. The `kind === "paper"` branches in `rr/Detail.jsx`
  and `rr/Threads.jsx` are already unreachable. Left alone — see the report.

## 5 · Background work

The outbox (`paper/v6/outbox.js`) — a durable queue with a 20-second timer and
a `visibilitychange` listener — is started from `ReaderV6` and nowhere else.
`ReaderV6.jsx:658` polls `paper_status` while a paper is being ingested. Both
stop by never mounting. There are no crons, queues, webhooks or digests.

## 6 · Build and assets

* `pdfjs-dist@4.10.38`, pinned exactly; the worker is imported `?url` by
  `src/lib/paperText.js` and lands in the reader's chunk.
* `public/papers/tracemonkey.pdf` — fetched by `npm run paper:fetch`, added to
  Module 1 by `papersFor()` **under `import.meta.env.DEV` only**. Stays.
* `public/sitemap.xml` has one URL, the home page. No paper URLs to remove.
* `check:bundle` already asserts pdf.js never reaches the entry chunk.
* Checks that are the reader's alone: `check:anchor`, `check:paper`,
  `check:paper-db`, `test:reader`.

---

# The report

Everything below is what was done to each item above, measured rather than
assumed. The switch is **`papersOn` in `src/lib/flags.js`**, from
`VITE_PAPERS_READER`, default off.

## 1 · Routes and pages — ✅

| Item | What was done |
|---|---|
| `/m/:module/paper/:id` | 404s through App's **own** `notFound` list, above the title and before anything is fetched or imported. Both a real id and a made-up one give "Wrong bay." |
| `routes.js` | Untouched. It is pure and imported by three Node checks, so it cannot read the switch — the guard is App's. |
| the `paper` route arm | Left in place, unreachable. |
| `CHUNK.paper` / `CHUNK.addPaper` | `papersOn ? chunk(…) : null`. Rollup folds it: **no ReaderV6 chunk, no pdf.js chunk, no worker** in the build. |
| `ROUTE_CHUNKS.paper` | Spread in only when on. |
| `MODULE_ROUTES` | Untouched. The hour meter can no longer see a paper route because there is no paper route. |
| the reader's 22 source files | **Untouched**, as §8 requires. |

## 2 · Server-side — ✅ nothing to do

There is no server. Every reader RPC is an anon PostgREST call made from the
reader's own modules, and those modules are never imported. Measured in the
browser: **no request goes out for a reader asset or a reader RPC.** The
tables, functions and rows are all still there.

## 3 · Links into it — ✅

| Item | What was done |
|---|---|
| Library → Papers | The whole `<section>` is not rendered — no empty state, no disabled row, no explanation. |
| "Add a paper" (×2) | Inside that section; gone with it. The sheet is guarded too. |
| Search placeholder | "Search quizzes and cards". `placeholderFor(tab, papers)` takes the switch as an argument because `moduleSearch.js` is pure and `check:shapes` imports it in Node. |
| Bookmarks → Pages | Not one of `KINDS`, so the folder card, the grouping and the totals never see it. |
| `/bookmarks/pages` | Lands on Bookmarks, which is where every unrecognised folder lands. |
| Flight Deck Resume | `placeList` filters a `paper` place out **on read**. Resume falls through to the lesson or quiz underneath. |
| Warm-on-intent | The Library effect returns early; the `.item` selector matches nothing. |
| Ready Room "Paper passage" | The composer is handed `null`, and the button is not rendered. |
| `openPaper`'s `window.open` fallback | Unreachable: there are no rows to click. |

## 4 · Reader data elsewhere — ✅

| Item | What was done |
|---|---|
| `saves` rows of kind `page` | **Skipped before they are resolved.** This is the assertion worth the whole check: `content.paper()` answers `null` once a module's papers have been listed without one, and `null` PRUNES, which DELETES from the server. `providePapers` is therefore not called at all — "not known", never "none". |
| the flight bag's number | Counts what the bag can open; page saves are not in it. |
| `pw-last-place` | Filtered on read, written unfiltered. The record survives the pause. |
| `pw-paper-place`, `pw-paper-opened`, `pw-papers:<module>` | Written by code that no longer runs; the stored values are untouched. |
| `comms_attachments` of kind `passage` | Filtered at the single read path (`roomData.js` → `visibleAttachments`). The rows stay. |
| Ready Room threads from a paper | **Left working. See "What was left alone" below.** |

## 5 · Background work — ✅

The outbox's 20-second timer and its `visibilitychange` listener, and the
`paper_status` poll, all start inside `ReaderV6` and nowhere else. It never
mounts. There are no crons, queues, webhooks, digests or emails. No analytics
event is named after a reader action.

## 6 · Build and assets — ✅ measured

With the switch **off**, a clean `npm run build`:

* no `ReaderV6-*.js`, no `paperText-*.js` (pdf.js), no `pdf.worker.min-*.mjs`
* the entry chunk does not contain the string `ReaderV6`, `paperText` or
  `pdf.worker` anywhere, including its preload manifest
* `index.html` references one script and one stylesheet, neither of them these

The worker was the one thing that survived the shaking, because Vite emits
`?url` assets when a module is **transformed** and the tree-shaking that drops
its importer happens afterwards — 1.3MB of pdf.js deployed and unreachable.
`vite.config.js` now removes it, and only when nothing else in the build asks
for it, so the switch being on leaves it alone.

With the switch **on**, all four come back and the reader mounts.

`public/papers/tracemonkey.pdf`, `pdfjs-dist`, and every check and test named
after the reader are all still in the repo.

---

## Every place the flag is read

| File | What it decides |
|---|---|
| `src/lib/flags.js` | **Declares it.** The only read of `VITE_PAPERS_READER` in the repo. Also forces `library.reader` and `reader.v2` off and refuses an admin override of either. |
| `src/App.jsx` | The 404, the two chunk-map entries, the route-chunk table, the prefetch, the `listPapers` query, `modulePapers`, `providePapers`, the Add-a-paper sheet, the room's paper link. |
| `src/components/module/LibraryTab.jsx` | The Papers section. |
| `src/components/module/ModuleScreen.jsx` | The search placeholder. |
| `src/features/bookmarks/useSaves.js` | The Pages folder, the prune guard, the bag's count. |
| `src/lib/lastPlace.js` | Whether the Flight Deck may offer a paper. |
| `src/lib/attachments.js` | Whether a passage is drawn, and whether the marks query is made. |
| `src/components/room/ReadyRoom.jsx` | Whether the composer offers a paper passage. |

## What was left alone, and why

* **A Ready Room question asked from a paper.** `askOnPassage` writes an
  ordinary `lesson_threads` row with `lesson_id: null` and a title — there is
  no column saying it came from a paper, and `lesson_id IS NULL` is also every
  ordinary module question, which §5 says must keep working. The only signal is
  the title, and matching on a title is matching on resemblance, which this
  codebase refuses elsewhere by name. It is also arguably not reader data: the
  question and the class's answers are the room's, and the only reader artefact
  is the quoted passage in the opening post. **Left working**, per the brief's
  own rule about ambiguity.
* **`rr/Detail.jsx` and `rr/Threads.jsx`'s `src.kind === "paper"` branches.**
  Already unreachable before this change — `sourceOf` only ever returns
  `kind: "lesson"`. Untouched.
* **`ModuleHub`'s `onOpenPaper`.** The old hub's `PdfPanel` reads
  `pdfsForModule()`, which returns `[]` and always has. Its path would 404.
* **`check:anchor`, `check:paper`, `check:paper-db`, `test:reader`.** Kept in
  the suite rather than skipped: they test pure modules that this change does
  not touch, and they still pass. One assertion in `check:paper` was updated,
  because it regexes the CHUNK map line that now carries the switch.
* **Signed-out.** The harness stubs Clerk, so §9.1's "logged in and logged out"
  was only exercised as the harness's signed-in student. The guard is above
  auth in App's render, so signing out cannot reach it, but that is reasoning
  rather than a measurement.

## What was surprising

1. **A paper passage can be attached to a squadron chat message**, with its
   quote, page and anchor, and tapping it opens the reader. That is a door into
   the reader from the Ready Room, and it was not on anybody's list.
2. **`useSavesCount` — the Flight Deck's flight-bag number — counted page
   saves.** With the reader gone the bag would have counted bookmarks nobody
   could open.
3. **`pw-last-place` can say "Reopen the paper"** on the Flight Deck's hero
   card, from a record written before the pause.
4. **Turning `library.reader` off does NOT pause papers** — it changes how one
   opens, from the reader to a browser tab. Anyone reaching for that flag
   thinking it was the switch would have shipped a Library still full of PDFs.
5. **`providePapers(code, [])` would have deleted bookmarks.** Three lines of
   the obvious implementation and every page anybody had saved would have been
   pruned off the server on the first load after the deploy.
6. **The pdf.js worker outlives its own chunk.** Tree-shaking removed the
   reader and pdf.js and left 1.3MB of worker in `dist`.
