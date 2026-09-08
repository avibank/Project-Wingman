# Reader rebuild — report

Branch `reader-rebuild`, off `main` at `0a3f7d1`. **Not deployed.**
The migration and the clear-out have been run against production, on your
instruction, and verified — see below.

---

## The real manual — what happened when you uploaded it

Your 44MB, 1012-page manual is up, linearized, and opens. Getting there found
four faults and three of them were mine.

**It opened blank.** The paper route resolved the id against the fixture list
alone, so an uploaded paper was never found and the route returned an empty
`<main>`. A merge that reaches one of three readers is not a merge — the
Library had it, the route and the Flight Deck pin did not. Missing, still
arriving and still processing are now three designed states.

**The file URL was wrong.** A fixture paper is a path; an uploaded one is an
absolute storage URL. The reader prefixed a slash to both, so `https://…`
became `/https://…`.

**Range loading never engaged.** pdf.js decides whether a URL supports ranges
by *reading* `Accept-Ranges` and `Content-Range`, and neither is CORS-safelisted.
Supabase sends a correct `206` and does **not** send
`Access-Control-Expose-Headers`, so from a browser those headers are simply
absent and pdf.js concluded ranges were unsupported. The reader now does the
ranging itself and never asks.

**And the PDF was being opened for things the manifest already answered.** The
reader asked the document for all 1012 viewports — 1012 range requests before
anything drew, 119MB over the wire on a 44MB file, first page never appearing.
§4.6 says exactly this and I had built the manifest at ingest and then not used
it.

Measured on your file at each step:

| | first page | over the wire |
|---|---|---|
| As you found it | 27s | 44MB (the whole file) |
| Custom range transport | never drew | 119MB |
| Layout from the manifest | 10s | 44MB |
| Text layer off the critical path | 3.0s | 0.7MB |
| On production, cold | 6.2s | 0.53MB |

Still above the brief's sub-second target on a cold production load; most of
what is left is app boot rather than the paper. Honest number, not a rounded one.

**I linearized your file for you.** `qpdf` is now installed, the manual was
downloaded, linearized, re-uploaded in place and its row updated. You do not
need to run `paper:linearize` on this one.

---

## Read this first

**Both of the things that were waiting have been run, and verified.**

### Migration 0018 and 0019 are on production

`npm run reader:setup` ran. Verified by querying afterwards rather than
inferred: the `papers` table and its storage bucket exist, `paper_annotations`
carries `anonymous`, `agree_count`, `deleted_at` and `style`, `lesson_threads`
carries the passage back-link, `paper_marks_for` and `agree_with_mark` are in
`pg_proc`, and the dead `paper_annotations_for` is gone.

0019 followed: a paper now records **who it is for**. Adding is open to
everybody; module-wide is instructors only, gated in SQL rather than in the
browser.

**The anonymity rule was then checked against the real database**, which is the
gap this report used to flag. A throwaway anonymous question and a correction,
read back as three different people:

| Reading as | Gets | Author |
|---|---|---|
| another student | the question only — **no correction row at all** | stripped to null |
| an instructor | both | the real id |
| the author | both | their own |

That is §6.2 and R9 proved on the live SQL, not on my harness. The probe rows
were deleted.

### The content clear-out is complete

28 placeholder papers gone from the fixture, 6 generated PDFs gone from
`public/papers/`, and the marks with them. Production now has **0 papers, 0
marks, 0 ink** — a clean bed for the real manual. The backup is still
`backups/content-clearout-2026-09-08T01-25-33/` and still restores everything.

### One thing that was yours

Your 44MB upload had left an **orphaned row** — 1012 pages, status `pending`,
with no file behind it, because the upload threw before it sent anything. It is
deleted, so your retry starts clean. The cause is in the next section.

## The bug that stopped your upload — and it was mine

**"That file would not open as a PDF. Cannot read properties of undefined
(reading 'from')" was not your file.** It was `supabase.storage.from` — and
this app's Supabase client is a bare PostgrestClient with no `.storage` at all,
deliberately, because `createClient` drags auth-js, storage-js, realtime-js and
phoenix into the entry chunk for features with no call site. I wrote the upload
against an API that was never there, and a catch wide enough to swallow
anything reported a storage fault as a parser fault.

Storage now goes over its REST API — four endpoints, no library — on XHR rather
than fetch, so a 44MB transfer has a real progress bar instead of looking like a
hang. And the order changed: open the file and take the manifest (seconds),
reserve the row so the Library says "Preparing…" at once, send the file, **then**
build the slow text layer and thumbnails. The first version did several minutes
of work before moving a byte and threw all of it away on any failure — which is
exactly what happened to you.

Proved end to end against the real backend with a real PDF, then cleaned up.

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
| 8 · Navigation | Mostly — page jump, thumbnails, contents, find, per-paper memory, **tick rail, back pill and page scrubber**. No deep links, bookmarks or snapshot. |
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

## The shipped files, and where they and the codebase disagreed

You then sent four files and a new §0: `reader.css` and `reader-icons.js` to be
copied verbatim, `COMPONENTS.md` as the exact DOM, and the rule that an unused
class means a missing component. The reader was rebuilt to them. Everything
below is a place where following that instruction collided with something this
codebase already had, and what won.

**`reader.css` is scoped, not global — and it is generated, so it cannot
drift.** `npm run reader:css` reads `docs/reader/reader.css`, prefixes `.rdr `
to every selector, and then asserts that the declarations are byte-identical
before and after. If they are not, it refuses and writes nothing. The reason is
seventeen of its class names — `.row`, `.title`, `.pill`, `.sw`, `.pop`, `.av`
— which a dozen other screens here already use. `check:paper` re-runs the same
comparison, so the file in `src/` can never quietly diverge from the one you
sent.

**Scoping stopped the reader painting the app. It did not stop the app painting
the reader,** and eight class names already existed here as bare rules. A bare
`.x` loses to `.rdr .x` on the properties the reader declares; the damage is
everything it does not declare, and every pseudo-element. The one that showed
it: every colour swatch in the inspector had a grey disc inside it, offset up
and left. `app.css`'s `.sw` is a *toggle switch* — 44×25 with a 17px knob drawn
as `::after` — and the knob was landing in the middle of the reader's 27px
colour circle. `instruments.css`'s `.pop` was putting a rotated arrow on every
popover, and it loads whenever the reader does. `lesson.css`'s `.scrub` was
drawing the page-scrubber card as a 4px progress bar. All eight are quarantined
in `reader-additions.css` and listed there; a ninth fails `check:paper`.

**§12's global 44px floor was distorting every control the sheet has.**
`App.jsx` sets `min-height:44px` on `.app button:not(.is-inline)`, and the
reader is a portal inside `.app`. Measured: `.tool` 38×**44** where the sheet
says 38×38, `.sw` 27×**44** where it says 27×27 — which is why the swatches
were ovals — and `.segs button` 93×**44** against ~28. Inside `.rdr` the sheet
owns the box now, and §12 is paid the way the sheet itself pays it: under
`max-width:900px`, which is the touch case the floor exists for. The one
exception is the swatch row, where six 44px targets in a 266px row would
overlap each other — this app had already made that call once, for
`.msg-acts .icon-btn`. They are 36px on a 44px pitch.

**The mono face is Geist Mono, not IBM Plex Mono.** The sheet names IBM Plex
Mono at eighteen places. Nothing loads it here and nothing is going to — the
brand faces are Instrument Sans and Geist Mono, through `--font-ui` and
`--font-mono`, never named. Left alone, all eighteen fell through to whatever
the browser calls `monospace`, which is a different face on every machine and
is not the shipped look either. Each is re-pointed by name, and `check:paper`
fails if the sheet gains a nineteenth.

**Three of R14's rules are overruled by the sheet, and the override is
recorded.** No hex (it is hex from top to bottom), OKLCH (same), and the 13px
type floor (it runs 8.5px to 26px). The reader is now the one surface in this
app that does not re-tint with the livery — which is the same reason the five
mark meanings do not: a livery change that recoloured somebody's yellow
highlight would be the app editing their notes. What survives of R14 is that
the palette must be the *shipped* one and not a second one somebody typed, and
that anything meant to be read rather than glanced at stays at 12px or more.

**Marks are drawn as measured rectangles, not as classes on a text span.**
`COMPONENTS.md` puts `s is-marked` on a sentence span. pdf.js's text layer is
*runs*, not sentences — a mark routinely covers the tail of one run, two whole
ones and the head of a fourth. So the mark is measured and drawn over that
layer. The element carries the shipped classes and takes the shipped rules;
only the two that assume an inline box (a 2px padding bleed with a -2px margin)
are neutralised. Nothing about R1 changes: coordinates are still measured at
draw time and never stored.

**Two places the brief is stricter than the reference build, and the brief
won.** `reader.css` ends `@media (max-width:1240px){ .bar-panel{display:none} }`
— the demo simply has no marks panel on a tablet. §8.6's hard rule is "below
1200px, no panel ever sits BESIDE the page; panels overlay and dismiss", and
§15 checks both iPad orientations, so it comes back as a right-hand overlay
sheet rather than vanishing off every iPad. Second: the reference lets the
panel float over the page's right margin — 65px at 1440, harmless, but 164px at
1241, which is text. Above 1240 the document keeps clear.

**Two things in the reference build that are not in the shipped pair.** Its
filter chips filter by *meaning* (Exam likely, Definition…); §6.3 says the
chips are the destinations (Revision, Glossary, Threads, Master Caution) and
`check:paper` asserts it, so this build keeps the destinations. And its empty
state opens "Nothing matches this filter." — this app never states absence, it
names the next action, so the shape is the sheet's and the sentence is not.

**Marks-only hides the panel.** The sheet hides the document and the tick rail
under `data-mode="rev"` and stops there; the demo happened to be built with the
panel shut. It is not shut here, and it floated over the right third of the
list, cutting off the destination on every group header. A takeover that shows
the same marks twice is not taking over.

**The dock's other two positions are laid out here.** The sheet pins it left
(and moves it to the bottom under 900px). This app's More menu has always
offered left, right and top, so the two the demo had no need for are in
`reader-additions.css`, every metric mirrored from the shipped one. The
inspector and the Add sheet follow the dock, because they open against it.

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

1. **Auto-routing beyond threads.** `unsure → thread` works. The other four
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
