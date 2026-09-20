# Bookmarks · second pass — report

2026-09-20. What the brief asked for, what was already there, what the
numbers are, and what still cannot match.

---

## The root cause in the brief does not apply to three of the four screens

The brief opens: "None of the reference stylesheets are on any screen…
verified by walking every CSS rule in every loaded sheet on live."

`tools/sheets.mjs` does exactly that walk and prints the counts. Run against
wingman.institute **after** the three screen commits landed
(`fa6fdfe`, `0af27d9`, `4087c0f`):

| page | counts |
|---|---|
| `/account/licence` | `.lic` 5 · `.cover` 6 · `.stats` 20 · `.pal` 6 · `.scrim` 6 · `.sheet` 6 · `.pick` 2 |
| `/m/m1` | `.lrow` 11 · `.chap` 9 · `.mtabs` 8 · `.search` 3 · `.cards-thumb` 8 · `.wall` 6 |
| a lesson | `.notebar` 0 · `.logbook` 0 · `.upnext` 0 |

So the reference stylesheets **are** on the licence, Preferences and the module
screen, and the lesson page is the one screen with none of them — which is what
`docs/launch/BUGS.md` row 17 already says. The licence measurements in the brief
are the same story; measured live, now:

```
.profile 680.0  left=300.0  centre=640.0  max-width=680px  margin 188/188
.tabs    680.0  centre=640.0
.lic     634.0  centre=640.0
.stats   440.0  max-width=440px  labels 135px each, one line
```

Card and tab strip share a centre line, the card sits inside the box, and
"Lessons signed off" does not wrap.

**`tools/sheets.mjs` is the check the brief asks for**, kept in the repo:

```bash
node tools/sheets.mjs https://www.wingman.institute/m/m1 lrow chap mtabs search
```

---

## The diff table

`npm run harness`, then `node tests/harness/bm-seed.mjs`, then
`BASE=http://127.0.0.1:5190 node scripts/visual-diff.mjs`.

| screen | 1280 | 768 | 390 |
|---|---|---|---|
| bookmarks-home | 3.04% | 5.60% | 6.81% |
| bookmarks-empty | 2.66% | 4.28% | 6.16% |
| folder-questions | 3.06% | 4.75% | 8.40% |
| folder-cards | 1.79% | 2.62% | 4.80% |
| folder-videos | 3.73% | 7.04% | 11.29% |
| folder-pages | 1.89% | 2.91% | 5.16% |
| card-set | 1.99% | 2.52% | 4.13% |
| library | 2.84% | 4.37% | 6.91% |

Threshold is 0.4%; none of these passes it. What is in the way is named below
rather than rounded off.

**The first run of the script said 8–22% and none of it meant anything.** Three
faults in the harness, all fixed and all worth knowing:

1. **The demo does not read `location.hash`.** Every `ref` URL in `PAIRS` was a
   hash — `#home`, `#questions`, `#set` — and the demo has no `hashchange`
   handler and never reads `location.hash` at all. All nine landed on its home
   screen, so eight of the nine pairs compared that against a different live
   screen. Each pair now carries a `refPrep` that drives the demo through its
   own `go()`, the way `tools/make-ref-pages.mjs` boots the other four
   reference builds.
2. **Both sides drew different palettes.** The demos follow
   `prefers-color-scheme` and a headless browser reports light. The reference is
   pinned to its own `[data-theme="dark"]` in `tools/vite-ref-routes.js`, and
   the live side is pinned through the student's own preference by the seeder.
   That one change took bookmarks-home from 86.14% to 3.53%.
3. **`?m=m1` matched nothing.** This app's module ids are `M1`; the demo's own
   links and the script's pairs use `m1`. The screen said "nothing saved yet" to
   a student with 23 rows loaded and filtered out one line later.
   `content.moduleId()` resolves it now, case-insensitively, in one place.

The `flight-bag` pair is gone from the script. Its demo draws the briefcase at
149×157 as the subject of its own page; this app draws the same SVG at 85×85
inside one cell of a four-instrument strip. A pixel diff of two different scales
is a number with nothing behind it.

---

## What was changed, and it was markup and data, not CSS

`bookmarks.css` is the drop's file, byte for byte — `diff` says so.

* **`content.moduleId()`**, and `useModuleParam` resolves `?m=` through it.
* **`.bm` carries the design's type scale** (`font: 15px/1.5`), in `bm-app.css`,
  which is the app-fitting layer this repo already had for exactly this. The
  demo sets it on `body` and `.bm`'s rules assume it; this app's base is 16px
  with the browser's own `normal` leading, so every line box inside the
  component came out different. Measured before: a folder's name 23.0px against
  28.9, its cover 524.8 against 536.9. The font SIZES already matched — they are
  clamps — so it was the leading alone.
* **`data-diff-ignore` on the report pill**, which is fixed to the corner of
  every screen and was reported as a difference on every page.
* **The two 3D paint-order fixes from the drop** — `translateZ` on
  `.bm-dc[data-d]` in `bookmarks.css` and the same in `StudyPad`'s inline
  transform. In a 3D context the browser paints by depth, not `z-index`.

Everything else in the drop was **already in the repo, and in four files the
repo is ahead**. `useSaves.js` in particular must not be overwritten: the
drop's version has a two-state lookup where the repo's has three, and the third
is what stops a slow connection deleting a student's bookmarks. `BookmarksPage`
has per-kind landing routes and one navigation path; `FlightBag` and the rest
use `useGo` so a navigation keeps its view transition. The only thing the drop
had that the repo lacked, beyond the two fixes above, was a pair of optional
`content.track?.()` calls.

---

## The four save points, end to end

| where | state |
|---|---|
| a quiz question | **works** — `SaveButton kind="question"` beside the flag on the question screen (`Exam.jsx`). Deliberately not a mark: nothing is marked before hand-in. |
| "Save the ones I missed" | **works** — on the result screen, `addMany` in one press, with a toast that opens the Questions folder. It was already built. |
| the lesson player | **works, and there is one of it now.** There were two — one in the control bar and one beside the title. The design has one, in the bar, on the thing it acts on. The second is gone with `.titlerow-save`. |
| the paper reader | **works, and you can find it now.** It has existed since the rebuild and wrote both the local list and a `saves` row — it was a tap inside the page tray, and nobody opens the page tray. That is why the Pages folder stayed empty while its empty state pointed at a reader with no visible control. It is on the island's face now, beside You. Verified: press it, and `saves` holds `M1.DEV` page 1, the page's corner ribbon shows, and `aria-pressed` follows the page you scroll to. |

**Reopening at the exact place** (R15/R16): a saved video's row links to
`/m/m1/M1.01/lesson/M1.01.1?t=372` — the second it was saved at. A saved page
opens the reader at that page. A saved question opens its own card.

---

## What cannot match, and why

* **The app's top bar is ~10px taller than the demo's.** It is the app's chrome
  on every route, not part of this screen, and every row below it inherits the
  offset. Worth roughly a point at 1280 and more at 390, where the column is
  long and a few pixels a row accumulate.
* **§12's 44px hit floor** on the module switcher: 44px against the demo's 36.
  The repo's `bm-app.css` already records the same decision for two other
  controls, made before this pass. It is this app's accessibility floor,
  enforced globally in App.jsx, and the design has not been asked to know about
  it.
* **Content the fixture cannot pin.** The demo's questions, lesson titles and
  page numbers are its own; the live screens carry the test content's. The
  seeder matches the SHAPE — 5 questions, 6 cards, 4 videos, 4 pages in module 1,
  which is the demo's own `ITEMS` list counted per module, not the summary in
  the brief, which says four cards where the demo draws six.
* **`folder-videos` at 390 (11.29%)** carries the most of any pair: the demo's
  own video covers are drawn art with a gauge in them, and the live ones are
  poster frames pulled out of real video.

## One thing that looked like a bug and was not

Seeding the demo's own page numbers — 212, 57, 388, 402 — against the dev test
paper, which has fourteen pages, deleted all four the first time the Pages
folder resolved them. That is the feature working exactly as written: a page
past the end of a paper is a page that no longer exists. The seeder uses pages
the paper has now, and a guard went into `useSaves` for the neighbouring case
it made worth thinking about — a paper listed WITHOUT a length would otherwise
prune every page in it. Every paper the repo lists today carries one; the guard
is there because the cost of being wrong is a student's bookmarks.

## Running it

```bash
npm run harness                        # port 5190
node tests/harness/bm-seed.mjs         # the demo's fixture, and night lighting
BASE=http://127.0.0.1:5190 node scripts/visual-diff.mjs
BASE=http://127.0.0.1:5190 node scripts/visual-diff.mjs folder-cards
node tools/sheets.mjs <url> lrow chap mtabs     # is the sheet even loaded
```

The demos are served at `/__ref/bookmarks` and `/__ref/flight-bag` in dev only
(`tools/vite-ref-routes.js`, wired into both vite configs). They live in
`docs/launch/reference/` with the other four reference builds rather than in a
second directory of their own.
