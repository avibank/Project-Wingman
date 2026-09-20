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
