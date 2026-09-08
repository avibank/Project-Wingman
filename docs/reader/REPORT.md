# Reader rebuild — report

Branch `reader-rebuild`, off `main` at `0a3f7d1`. **Not deployed.**
The migration and the clear-out have been run against production, on your
instruction, and verified — see below.

---

## Read this first

**Both of the things that needed you are done.** You asked me to run them, so I
did, and verified each one.

### 1. The migration is in

`npm run reader:setup` ran against production on 2026-09-08. Verified by
querying afterwards rather than by trusting the exit code:

| | |
|---|---|
| `papers` table | created |
| `papers` storage bucket | created, public, 256MB limit |
| `paper_annotations.anonymous / agree_count / deleted_at / style` | all four added |
| `lesson_threads.paper_id / page / anchor` | added — §14's return leg |
| `paper_marks_for` | recreated with the wider shape |
| `agree_with_mark` | created |
| `paper_annotations_for` | dropped — dead since 0017 |
| existing marks | **5, untouched by the migration** |

**The colour constraint proved itself on the way in.** A test row with an
invalid colour was refused by `colour_is_a_name` rather than stored.

**And the rule the brief cares most about is now verified against the real SQL,
not against my harness.** A throwaway anonymous question and correction were
written, read back as three different people, and deleted:

| Reading as | question | correction |
|---|---|---|
| another student | `author_id` **null**, name "Anonymous" | **absent from the payload entirely** |
| an instructor | `author_id` present | present |
| the author | present, "You" | present |

`npm run check:paper-db` — **20 assertions against production, all green**, 4
rows written and 0 left behind. That was the outstanding item in the first draft
of this report; it is closed.

### 2. The placeholder marks are gone, and restorable

The five marks on `M1.P1` are deleted. They were all mine from testing — the
anchors read *"Placeholder paper TEST CONTENT ONLY — NOT COURSE MATERIAL"*.

Backup: `backups/content-clearout-2026-09-08T06-26-24/rows.sql` — five INSERT
statements that restore them with their original ids.

```
node scripts/clear-placeholder-content.mjs --restore content-clearout-2026-09-08T06-26-24
```

**Production now:** 0 marks, 0 ink, 0 papers, `papers` bucket ready.
3 profiles, 3 progress rows, 2 threads — all untouched.

**A gap the run found in the clear-out script itself.** Its two halves can run
on different days, but the second half derived the paper ids it was allowed to
delete from the first half's input — so once the fixture was emptied, a later
`--rows` would find nothing and silently succeed. It now takes `--from <backup>`
and reads the ids out of the backup, which keeps the deletion scoped to exactly
the papers this clear-out removed instead of letting it become a loose query.

## The bug that was live while I worked

**Closing the Pages panel emptied the document.** The reader's body was a
two-column grid and the panel was conditionally rendered, so with the panel shut
its one remaining child auto-placed into the *first* column — sized `0px` when
the panel is closed — and the paper was painted off the left edge at zero width.

It was mine, from commit `15898df` yesterday morning, and it is on
wingman.institute now. It is fixed on this branch and it is the first reason to
merge.

A second one of the same shape was underneath it: **the scroller was not a
scroller.** The original `.pscroll` rule still sat further down the stylesheet
and won by source order, so it stayed a `position: relative` block that grew to
22,000px. The paper could not be scrolled on any device. Both were stale rules
surviving a rewrite, in the same file.

---

## What landed

| Phase | State |
|---|---|
| 0 · Discovery | Done — `DISCOVERY.md` |
| 1 · The renderer | Done |
| 2 · Marks as objects | Mostly — select, restyle, delete, undo/redo. No lasso, no move/resize. |
| 3 · The colour system | Done, except auto-routing beyond threads (below) |
| 4 · Manual refresh | Already existed; kept |
| 5 · Chrome and layout | Done |
| 6 · The tool tray | Done |
| 7 · The mark card | Done |
| 8 · Navigation | Partial — page jump, thumbnails, contents, find, per-paper memory. **No** tick rail, scrubber, back-pill, deep links, bookmarks, snapshot. |
| 9 · Marks-only view | **Not built** |
| 10 · Export, print, offline | Partial — print and download exist. **No** burn-in, no export, no offline copy, no photo notes. |
| 11 · Verify, fix, polish | Done — 44 browser assertions, 54 screenshots reviewed |
| 17b · Content | Done |

Cut from the bottom, as instructed, so the testing at the top could be finished.

### Phase 1 — the renderer
Page-shaped placeholders at the right aspect ratio from the first frame, so the
scroll height is correct before a PDF byte arrives. A fast third-resolution pass
then a sharp one, rendered off-screen and copied in as one synchronous run so no
frame is ever painted between the clear and the copy. Range loading on. A raster
budget that caps canvases at 4000px a side and evicts the page furthest from
where you are looking. Zoom anchored to the pointer, then the pinch centre, then
the viewport; the control names the mode, not a percentage.

### Phase 3 — colours are verbs
Five meanings, closed for text marks: **Exam likely · Definition · Testable
fact · Ask · Weak spot**. No plain highlight, deliberately — a plain highlight is
the one everybody picks and it means nothing. Free colour stays with the pen and
the marker. The tray states what the colour in your hand will do before you use
it; the mark card states it again afterwards. Violet is hollow while its thread
is open and filled once answered.

### Phase 5 — the chrome
Three full-width frames welded to the window are gone. Top bar, dock, inspector,
panel and a new bottom bar are floating islands over one surface, at three
depths and no fourth. Undo and redo are **buttons**, because the primary device
is a tablet with a pen and no keyboard.

### Phase 6 — the tray
Six tools by default; the other eight one tap away in a sheet that always lists
the full set, so nothing you remove becomes unreachable. Capped per device and
it says so. Two trays, remembered per device class. Select cannot be removed.
Shortcuts fire only for tools on the tray.

### Phase 7 — the mark card
One popover: what the mark is, what its colour does, who made it, and the right
actions for whose it is. Opens on hover **and on tap**. Marks are hit-tested in
document offsets rather than pixels, so a pen, a finger and a mouse all find the
same mark.

---

## Test results

**Reader: 44 assertions, 0 failing.** `npm run test:reader`
Chromium at 1440×900, WebKit at 1194×834 and 834×1194 with touch.

**Repo suite: green.** `npm run check` — including `check:paper` at 176
(was 170) and `check:exam` at 76.

54 screenshots across three breakpoints × two lights × every surface, in
`tests/screens/`. They were reviewed, not archived — four layout bugs came out
of looking at them and are listed below.

### The assertion the brief singles out
> "assert on the network response body, not the DOM, that another student's
> client never receives the author id of an anonymous question"

Done, on the bytes. A second student's payload carries `author_id: null` on the
anonymous question and contains no correction row at all; an instructor's
carries both. The fixture backend is a real HTTP endpoint precisely so this
could be asserted on a response rather than on a stub's return value.

**Its limit, stated plainly:** the harness re-implements the SQL rule rather
than running it. The rule itself lives in `0018`, and `npm run check:paper-db`
drives it against the real database — but that needs credentials and did not run
here. Worth running once after `reader:setup`.

### Bugs the tests found that reading did not
1. **A finger drew.** With an ink tool armed, a touch pointer laid down a
   stroke — the failure the brief names by name. Touch now pans and pinches and
   never draws; a palm is refused twice over.
2. **`setPointerCapture` threw** for a pointer the browser did not recognise,
   and the throw aborted the handler before drawing began.
3. **The ink layer answered hit-testing while idle.** `pointer-events: none` on
   an SVG does not reliably exclude its own paths in WebKit, so a tap over an
   inked passage opened nothing.
4. **The scroller was not a scroller** (above).

### Bugs looking at screenshots found
5. A stale `position: relative` turned the floating dock into a full-width block.
6. The inspector still cleared a panel width from when the panel was a column,
   so it sat half off the left edge.
7. Fit-width measured the padding box, so the page ran 322px under the panel.
8. The panel's glass at 82% over a white page left the thumbnails and the paper
   legible through each other.

### Bugs the repo's own checkers found
9. `.libempty` collided with a lesson class.
10. A static import of the ingest pulled **all of pdf.js into the entry chunk** —
    428KB on first paint for everyone who never adds a paper.

### One test I could not make pass, and what I tried
None are failing now. One took six attempts and is worth recording because the
failures were all mine, not the product's:

**"the mark card opens on tap"** failed for a long time. In order: the tap
landed under the floating bottom bar; scrolling first held a stale element
reference across a re-render, so it reported a rectangle that no longer existed;
`new Touch()` is not constructible in WebKit; and underneath all of it the
scroller could not scroll at all (#4). The test now scrolls, re-queries, and
expresses the gesture as the PointerEvent iOS raises. **The card opening on a
real Pencil tap is still unverified** — see MANUAL-TESTS U3.

---

## Deviations from the brief

1. **§4.7's ingest moved into the browser.** There is no server: no `/api`, no
   edge functions, and none of `qpdf`/`gs`/`ocrmypdf` installed. Manifest, text
   layer and thumbnails are built at upload from your copy of the file. That is
   the half that matters — the reader never opens the PDF to lay out, search or
   anchor a mark. Linearization cannot be done in a browser; `npm run
   paper:linearize` does it locally with qpdf, and the paper records which state
   it is in either way.

2. **Playwright's test runner hangs in this environment.** No output, for
   minutes, on browsers that launch fine. The suite drives the Playwright
   *library* directly and brings a small runner (`tests/harness/run.mjs`). Real
   Chromium, real WebKit, real viewports, real pointer events, real network
   interception. Lost: the HTML report, retries, trace viewer.

3. **Visibility keeps the existing four rings** (`solo · wingman · formation ·
   module`) rather than §5.1's three. They are already enforced in SQL and
   tested. Mapping: private→solo, squadron→formation, module→module.

4. **The five meanings sit alongside the eight ink colours**, not instead of
   them. They are different categories: one is what a *mark means*, the other is
   what a *nib is loaded with*.

5. **R14 reversed for the page.** The house rule was a hairline and no shadow;
   the brief puts the page at depth 1 of three and its reference build floats
   it. With floating chrome above, a page with no depth flattens the stack. The
   assertion was inverted rather than deleted.

6. **The bucket and the table are not created.** Deliberate — see the top.

7. **The report pill is hidden in the reader, not removed.** §17 says remove it;
   it belongs to the rest of the app, so it is hidden while a paper is open,
   which is where the Correction tool covers its job.

---

## The content clear-out

`node --env-file=.env.local scripts/clear-placeholder-content.mjs [--apply] [--rows]`
Dry by default, re-runnable, reversible.

| Removed | Count |
|---|---|
| Placeholder papers from the fixture | **28** (7 each across M1–M4) |
| Generated PDFs deleted from `public/papers/` | **6** |
| Marks/ink deleted | **0** — deliberately left, see the top |
| Marks/ink backed up as restorable INSERTs | **5** |

Module 1 keeps everything else: lessons, chapters, quizzes, structure. Only its
Papers section is empty, and it shows an empty state that names the next action
with a working **Add a paper**.

Untouched: users, profiles, modules, lessons, quizzes, Ready Room threads and
replies, progress.

---

## Things I would fix next, in order

1. **Phase 8's navigation.** The tick rail and the back-pill are the two a
   student feels every session in a 1000-page manual, and neither is built.
2. **Auto-routing beyond threads.** `unsure → thread` works. The other four
   colours are labelled correctly and say what they will do, but the revision
   deck, the glossary and the question-bank records are not written yet — the
   Weak spot colour does not yet feed Master Caution.
3. **The offline queue.** Marks are optimistic and survive a reload, but there
   is no IndexedDB queue: a write that fails while offline is retried on the next
   action, not flushed on reconnect.
4. ~~`check:paper-db` against the real database~~ — done, 20 green.
5. ~~Drop `paper_annotations_for`~~ — done, 0018 dropped it.

---

## Pre-existing things I noticed and left

- `Review.jsx`'s drill and the retention flows are untouched and still work.
- The Ready Room thread created from a passage now carries `paper_id`/`page`/
  `anchor` columns (0018) but the Ready Room UI does not yet render the link
  back. The passage → thread leg works; thread → passage needs the other half.
- `papersFor()` adds the dev paper under `import.meta.env.DEV` only, so the
  cleared modules are genuinely empty in a production build.
