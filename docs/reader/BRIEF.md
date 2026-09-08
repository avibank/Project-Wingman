# Wingman Papers Reader — Rebuild Brief

**For:** an agent working overnight on the live wingman.institute codebase
**Scope:** the papers reader (module Library → paper viewer, e.g. `/m/m1/paper/M1.P1`) and its Ready Room integration
**Reference build:** the interactive demo published alongside this brief. Open it in a browser before you start. Where this brief and the demo disagree on *behaviour*, this brief wins. Where they disagree on *look*, the demo wins.

---

## 0. How to work this

This is a large brief. It is deliberately ordered. **Do not start a phase before the one above it passes its checks** — the later phases are worthless on a broken foundation.

Working rules for the run:

1. Branch: `reader-rebuild`. One branch, commit per phase, descriptive messages.
2. **Phase 0 (discovery) first.** Write `DISCOVERY.md` before changing anything.
3. Do not refactor code outside the reader. If you find unrelated bugs, note them in `REPORT.md` and leave them.
4. If an assumption in this brief is wrong for the actual codebase, **adapt and keep going** — do not stop and wait. Record the deviation in `REPORT.md`.
5. Put the whole rebuild behind a flag (`READER_V2`) if the existing reader is in use, so it can be turned off.
6. Existing student marks must survive. Write a migration, never a wipe.
7. **The run is not finished when the building is finished.** Phase 11 (§15b) — verify, fix, polish, integrate — is part of the work, not an optional extra. Budget for it: if time is short, cut features from the bottom of the list, never testing from the top. Two people are using this for real study the next morning.
8. Finish with `REPORT.md`: what landed, what didn't, test results, known failures with what you tried, decisions taken, and anything that needs a human. Plus `MANUAL-TESTS.md` (§15b.7) for the things hardware is needed to check.

---

## 1. Scope and principles

**Scope is markup only.** The reader marks *on top of* the PDF. It never edits the PDF's own content, never adds or deletes pages, never touches form fields. Do not build page surgery or text editing.

**Primary input is a stylus on a tablet.** Mouse and keyboard second, touch/phone third. When a decision trades desktop polish against pen usability, pen wins.

**Ten rules that settle any ambiguity:**

1. Never show an empty white rectangle where a page belongs.
2. The active tool is always visible, in its own colour, without opening anything.
3. Anything a user made, they can pick back up — restyle, move, delete.
4. Undo is a button, always, and reaches every action.
5. Chrome recedes while the nib is down and returns when it lifts.
6. Zoom holds the point the reader was looking at.
7. One control, one job. No two controls doing the same thing.
8. Labels use the words a student would use ("Fit width", not "176%").
9. Marks live on the page, not only in a sidebar.
10. Every state is designed — empty, loading, offline, failed.

---

## 2. Phase 0 — Discovery (do this first)

Find and write down in `DISCOVERY.md`:

- **Rendering:** what draws the PDF today (pdf.js? react-pdf? an `<iframe>`? a third-party viewer?). Version. Whether a text layer is produced.
- **File sizes and delivery:** the size of the largest paper in production, where paper files are stored, and — checked with a real request, not assumed — whether that storage returns `Accept-Ranges: bytes` and a `206 Partial Content` for a ranged GET. Also whether any proxy or CDN in front of it buffers the response. This decides whether §4.6 is achievable as written.
- **Linearization:** run `qpdf --check` on the largest paper and report whether it is linearized.
- **Text layer:** does every paper have extractable text, or are some image-only scans? List which. This decides whether shared text marks are even possible on them (see §5.2).
- **Annotation storage:** current schema, table/collection names, how a mark is anchored today, how many rows exist in production.
- **Auth and membership:** how a user is identified, how module membership is determined, whether "author/instructor" is a role that exists.
- **Design tokens:** where the liveries and light/dark themes are defined. **Use the existing system.** Everything in §8 is a gap-filler, not a replacement.
- **Routing:** paper URLs, whether deep links to a page/passage are possible today.
- **Ready Room:** the threads data model, how a thread is created, what a thread can be attached to.
- **Realtime:** is there any socket/polling infrastructure already? (We are not using it — see §7 — but note it.)

If discovery reveals the renderer is a black-box third-party viewer with no annotation hooks, **stop and write that up as the first line of `REPORT.md`** — Phase 1 is not implementable and everything downstream changes.

---

## 3. The nine non-negotiables

These are the bar. If any of these fails, the rest doesn't matter.

1. The document always draws — instantly, never blank, at any zoom, on a 1000-page file.
2. Palm rejection and pressure on a pen.
3. Marks are never lost — saved on creation, survive a closed tab or dead battery, tolerate a bad connection.
4. Marks can be picked back up — recolour, move, delete.
5. Undo and redo, from a button, reaching everything.
6. Search that actually finds things.
7. Getting around: jump to page, back/forward inside the document, thumbnails, fit width.
8. Picks up exactly where the student left off — paper, page, zoom, tool, colour.
9. Print and export with marks.

---

## 4. Phase 1 — The renderer (highest priority)

**The bug this fixes:** on the live build today, scrolling into pages 2+ of a 14-page paper leaves the canvas blank white indefinitely. Thumbnails for the same pages render fine, and jumping via a thumbnail renders that page instantly, so the file and the thumbnail pipeline are fine — the main canvas gives up. Changing zoom blanks the current page again.

### 4.1 Page window rendering

- Render a moving window: the current page ±2. Pages outside the window are unmounted but keep their layout box.
- Every page not yet drawn shows a **placeholder**: a page-shaped card at the correct aspect ratio, in the page colour, with a 1px edge and its page number set quietly in the gutter. Never a bare white rectangle, never a spinner over nothing.
- Aspect ratio comes from the PDF page dimensions, fetched up front for all pages, so the scroll height is correct from the first frame and the scrollbar never jumps.

### 4.2 Zoom without flashing

- On a zoom change, keep painting the **previous raster scaled** to the new size until the sharp render is ready, then swap. The transition reads as a sharpening, never a flash of white.
- Debounce re-raster ~120ms so a zoom drag doesn't queue twenty renders.
- Cancel in-flight renders for pages that have left the window.

### 4.3 Page separation

- 24px gutter between pages, 1px edge, soft drop shadow, so each sheet reads as a sheet.
- Page number in the gutter beside each page.

### 4.4 Zoom model

Replace the percentage stepper. The control shows the **mode**, not a number:

| Mode | Behaviour |
|---|---|
| Fit width | Page width fills the reading column (default) |
| Fit page | Whole page visible |
| Actual size | 100% |
| Two up | Two pages side by side |

- Pinch to zoom on touch; ⌘/Ctrl + scroll on desktop; ⌘0 = fit width.
- **Zoom is anchored** to the pointer, then the pinch centre, then the viewport centre — in that order.
- The percentage is a secondary readout inside the menu, not the label.

### 4.5 Performance targets

- First page visible < 800ms on a 1000-page file over a normal connection.
- Scrolling at fit-width holds 60fps; a page entering the window is drawn within 250ms.
- Memory: never more than ~12 rasters retained; evict furthest first.

### 4.6 Large files — assume 40–200 MB and 1000+ pages

Modules are large. A paper may be 40 MB today and 200 MB later. **File size must not affect time to first page.** Build for this from the start; retrofitting it means rewriting the loader.

**Load by range, never whole-file.**

```js
getDocument({
  url,
  disableAutoFetch: true,   // fetch only what is looked at
  disableStream: false,
  rangeChunkSize: 65536,
})
```

Two hard conditions, both of which must be verified in discovery:

- **The PDF must be linearized.** If it isn't, PDF.js has to pull the whole file to find the cross-reference table and range loading gains nothing. Linearize at ingest (§4.7).
- **The storage layer must serve `Accept-Ranges: bytes` and must not be proxied through anything that buffers.** S3, R2 and Cloudflare do this natively; a naive `res.sendFile` in front of them destroys it. Check the actual response headers, don't assume.

**Never touch the PDF for anything the manifest can answer.** Page count, page dimensions and the outline come from a manifest generated at ingest. The reader lays out the full scroll height and paints placeholders for all 1012 pages *before a single PDF byte arrives*.

**Memory ceiling.** iPad Safari has a hard limit on total canvas area across the page, and large pages at high zoom will hit it.

- Call `page.cleanup()` after each render; release page proxies outside the window.
- Retain at most ~10 rasters, evict furthest-first.
- Cap raster scale: never render a canvas above ~4000px on a side, whatever the zoom.
- **Tile above ~200% zoom** — render only the visible tiles of a page rather than one enormous canvas. This is what makes zooming into an A3 schematic possible on a tablet.

**Progressive quality.** Render a fast low-resolution pass first, then the sharp one over it. Combined with placeholders, the page is never blank at any moment.

**Cancel aggressively.** `RenderTask.cancel()` for pages leaving the window; abort in-flight range fetches on a fast scroll. A flung scrollbar must not queue fifty renders.

**Cache what was fetched.** Cache API for PDF byte ranges keyed by paper id + version; IndexedDB for the manifest and text layer. Second open of a paper is instant and offline reading becomes possible for free.

**Budgets, regardless of file size:** first page visible < 1s · scroll holds 60fps at fit-width · under 300 MB memory on a tablet · zoom to 400% on a full-page diagram without a crash.

### 4.7 Ingest pipeline (server side, at upload)

Papers are **processed once at upload**, never parsed from scratch in the browser. All tools here are free.

1. `qpdf --linearize` — mandatory, enables range loading.
2. Optional optimise for oversized image-heavy files: `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook …`, downsampling images to ~150–200 dpi while leaving text vector. Check the smallest text and the busiest schematic before accepting the output.
3. **Manifest** → `manifest.json`: page count, per-page width/height/rotation, outline if present, file version hash.
4. **Text layer** → `text/{page}.json`: extracted text plus character positions, per page. Search and mark anchoring read this and never open the PDF.
5. **Thumbnails** → `thumbs/{page}.jpg`, small, for the Pages panel.
6. Optionally **split by chapter** into separate papers. The Library already filters by chapter; smaller files open faster and marks scope naturally. Module-wide search (§11.4) covers the seam.

Ingest runs async. A paper being processed shows a "Preparing…" state in the Library rather than a broken viewer.

### Phase 1 done means

Open the longest paper. Scroll top to bottom at fit-width, then at 200%, then back. **No blank page appears at any point.** Page edges are visible throughout. Zoom ten times — the paragraph under the cursor stays under the cursor. A 40 MB+ paper shows its first page in under a second on a normal connection, and the network tab shows partial-content responses, not one large download.

---

## 5. Phase 2 — Marks as objects

### 5.1 Data model

```
Mark {
  id                string          // uuid, client-generated so offline creation works
  paperId           string
  moduleId          string
  page              int             // 1-based
  kind              'highlight' | 'underline' | 'strike' | 'ink' | 'shape'
                    | 'text' | 'note' | 'question' | 'correction' | 'stamp'
  colour            'critical' | 'definition' | 'limit' | 'unsure' | 'wrong' | null
  inkColour         string|null     // free hex, ink and shapes only
  anchor            Anchor
  style             { width:int, opacity:int }   // opacity 10–100
  body              string|null     // note text, question text
  authorId          string
  anonymous         bool            // true for questions by default
  visibility        'private' | 'squadron' | 'module'
  threadId          string|null     // set when colour === 'unsure' or kind === 'question'
  agreeCount        int
  createdAt         iso
  updatedAt         iso
  deletedAt         iso|null        // soft delete — never hard-delete, sync needs the tombstone
}
```

### 5.2 Anchoring — the one hard problem

**Do not anchor text marks to x/y coordinates.** If a paper is ever replaced with a corrected file, or the renderer lays out differently, every coordinate-anchored mark in the module lands in the wrong place.

```
TextAnchor  { type:'text', start:int, end:int, quote:string, prefix:string, suffix:string }
RectAnchor  { type:'rect', x,y,w,h }            // 0–1 normalised to page box
InkAnchor   { type:'ink', paths:[[x,y,pressure],…] }  // 0–1 normalised
```

- `start`/`end` are character offsets into the page's extracted text.
- `quote` is the marked text itself; `prefix`/`suffix` are 32 characters either side.
- **Resolution order:** exact offsets → search for `prefix+quote+suffix` → search for `quote` alone → if all fail, mark as orphaned and list it in the Marks panel under "Couldn't be placed" rather than dropping it.
- Ink and shapes use normalised coordinates. Nothing to be done about that; they are personal marks so drift matters less.

**Scanned papers:** an image-only page has no text layer, so text anchoring is impossible and shared highlighting cannot work on it. If discovery found scans, either queue them for OCR at upload (`ocrmypdf` server-side, or `tesseract.js`, both free) or disable text tools on those pages with an honest message. Do not fake it.

Note: the Lufthansa PDFs currently in the app are **internal test material only**. Production papers will be authored in-house and exported as born-digital PDFs, which always carry a text layer. So OCR is a fallback for imported files, not a launch blocker — build the graceful path, don't build the pipeline yet.

**Keep the anchor model source-agnostic.** Papers are PDF today and become native in-app content later. Store the anchor behind an interface (`resolve(anchor) → DOM range or page rect`) with a PDF implementation now and room for an HTML implementation later, so the same marks, threads and colours work over both without a migration.

### 5.3 Selection and editing

- Hit-test marks on click/tap. Tap selects; the mark card (§9) opens.
- Selected mark: 2px accent ring plus a 3px soft halo.
- Restyle in place (colour, width, opacity), move, resize, delete.
- Lasso to multi-select, then restyle or delete as a group.

### 5.4 Undo/redo

- One stack covering create, delete, restyle, move — everything.
- Buttons in the bottom bar, always visible. ⌘Z / ⇧⌘Z. Two-finger tap = undo, three-finger tap = redo on touch.
- Stack survives navigation within the paper; cleared on paper change.

### 5.5 Persistence

- Write locally first (optimistic), queue the network call, reconcile on response.
- Queue survives reload (IndexedDB). On reconnect, flush oldest first.
- A mark is never lost because a request failed. If a write has been failing for >60s, show a quiet "Saving your marks…" state in the bottom bar — not a modal.

### Phase 2 done means

Highlight a line in amber. Reload. Tap it, change it to green, undo it. Lasso four marks and delete them in one action. Go offline, make five marks, come back online — all five are there.

---

## 6. Phase 3 — The colour system

**Colours are verbs.** Each one does something automatically. This is the core of what makes the reader Wingman's rather than a generic annotator.

| Key | Colour | Name | What marking it does |
|---|---|---|---|
| `critical` | `#F2B33D` amber | **Exam likely** | Into the student's revision deck; adds to class heat on that passage |
| `definition` | `#5BA4F0` blue | **Definition** | Term + passage pulled into the module glossary |
| `limit` | `#4FBE92` green | **Testable fact** | Offers to become a question in the question bank |
| `unsure` | `#C77CD0` violet | **Ask** | Opens a thread on the passage in the Ready Room |
| `wrong` | `#EC7059` red | **Weak spot** | Counts toward Master Caution until answered right twice |

Rules:

- **This set is closed for text marks.** Highlight, underline and strike offer these five and nothing else. There is no "plain" highlight — if one exists, everyone picks it and the system dies.
- Free colour choice stays with **pen, marker and shapes**, where it is just ink and carries no meaning.
- The colour picker shows the meaning under each swatch. The mark card always states what the colour does.
- **The Marks panel filter chips are the five destinations**, not invented categories: Revision · Glossary · Questions · Threads · Master Caution. Counts are real.
- "Wrong in the paper" is **not** a colour — that is the Correction tool (snag tag), which is about the document rather than about the student, and routes to the author's Queue.

### 6.1 Violet has a state

- **Open thread:** hollow treatment — coloured outline, transparent fill.
- **Answered:** filled solid.

The colour says "this is a question"; the treatment says "someone has dealt with it". This must be visible at a glance without opening anything.

### 6.2 Questions are anonymous

**Confirmed decision: questions are anonymous by default.** A student will not ask the thing they are actually confused about if their name is on it in front of the whole module.

- `anonymous: true` is the default for `colour === 'unsure'` and `kind === 'question'`.
- The author's identity is stored (moderation needs it) but **never returned to other students' clients** — strip it server-side, do not hide it in the browser.
- The mark card shows "Asked anonymously · name hidden on questions".
- The student's own questions show as theirs to them.
- Instructors see the author. Say so plainly in the UI ("Instructors can see who asked") — do not promise anonymity you don't deliver.
- Answers are **not** anonymous. Credit for helping is the whole incentive.

### 6.3 Auto-routing

Marking should actually do the thing, not just label it:

- `critical` → revision deck row + class heat counter increments
- `definition` → glossary entry created (term = the marked text, definition = surrounding sentence, with page link)
- `limit` → a non-blocking "Make this a question?" affordance in the mark card
- `unsure` → thread created in the Ready Room, attached to `{paperId, page, anchor}`, anonymous
- `wrong` → weak-spot record against the student, feeding Master Caution / calibration

Every one of these is reversible. Removing the mark removes or detaches what it created (a thread with replies is detached, not deleted).

---

## 7. Phase 4 — Manual refresh (not polling)

**Confirmed decision: no background polling and no sockets.** The student asks for new marks and gets them.

### 7.1 The control

- A refresh button in the top bar, beside Marks.
- States: **idle** → **checking** (icon rotates, ~2 turns) → result.
- Results: "3 new marks from the module." / "Up to date. No new marks on this paper."
- A small dot on the button when the last refresh brought something in, cleared when the Marks panel is opened.
- Also refresh automatically on: opening a paper, and returning to a tab after >10 minutes away. Nothing else.

### 7.2 API

```
GET /api/papers/:paperId/marks?since=<cursor>&scope=module
→ { marks: Mark[], deleted: string[], cursor: string, serverTime: iso }
```

- `since` is an opaque cursor (server timestamp or sequence), stored per paper per device.
- Response includes tombstones so deletions propagate.
- Scope respects visibility: module-visible marks, plus the student's own, plus their squadron's.
- Questions come back with `authorId` stripped when `anonymous`.

### 7.3 Merge rules

- Server rows replace local rows by `id`, **except** where a local row has unsynced edits — local wins and stays queued.
- The student's own in-flight marks are never clobbered by a refresh.
- New marks arriving animate in with a brief accent flash so it's obvious what changed. Do not re-scroll the reader.

---

## 8. Phase 5 — Chrome and layout (the premium pass)

The complaint being fixed: the reader currently has three permanent full-width frames (top bar, tool rail, side panel) welded to the window edges. At 1423px the document gets ~63% of the width and the sidebar is displaying a single thumbnail.

### 8.1 The core move: floating islands

Nothing touches an edge. Top bar, dock, inspector and bottom bar are **detached, rounded, blurred panels floating over one continuous surface**. The document is the only thing that reads as the subject.

Every floating surface:

```css
background: var(--glass);
backdrop-filter: blur(30px) saturate(1.7);
border: 1px solid var(--hair);
box-shadow: var(--sh-bar), inset 0 1px 0 var(--lift);
border-radius: 18px;
```

### 8.2 Three depths, no fourth

| Depth | What | Shadow |
|---|---|---|
| 1 | The page | `0 1px 2px rgba(0,0,0,.3), 0 18px 50px rgba(0,0,0,.45)` |
| 2 | Floating bars | `0 24px 70px rgba(0,0,0,.62), 0 3px 10px rgba(0,0,0,.4)` |
| 3 | Popovers above bars | `0 34px 90px rgba(0,0,0,.72), 0 6px 18px rgba(0,0,0,.5)` |

### 8.3 Tokens (dark / "night")

Fill the gaps in the existing livery system with these; do not replace what's there.

```
--bg:#080B0F   --bg-2:#0D1218
--glass:rgba(22,28,36,.82)   --glass-2:rgba(30,37,47,.94)
--hair:rgba(255,255,255,.09) --hair-2:rgba(255,255,255,.055)
--lift:rgba(255,255,255,.06)
--txt:#E8EDF3  --txt-2:#9FB0C0  --txt-3:#61707E
--accent: livery accent   --accent-dim: accent @ 16%
```

Light ("paper") swaps to `--bg:#C9CFD6`, `--glass:rgba(252,253,254,.86)`, `--hair:rgba(10,20,30,.11)`, `--txt:#111820`, `--txt-2:#4C5B69`, `--txt-3:#8494A2`.

Radii: **18px** panels, **11px** tool buttons, **9px** icon buttons, **3px** the page.
Easing: **`cubic-bezier(.32,.72,0,1)`** for everything. One curve.
Numerals: monospace with `font-variant-numeric: tabular-nums` everywhere digits change.

### 8.4 Component specs

**Top bar** — floating, centred, 6px/8px padding. Back · Pages · title (module code in mono + paper name) · divider · Refresh · Find · Marks-only · Marks · Reading light · More. Icon buttons 32px, radius 9.

**Dock** — floating, vertical, left or right by the existing setting, vertically centred. Tool buttons 38px, radius 11, 3px gaps, hairline separators between groups. See §9.

**Inspector** — floating popover anchored beside the dock, 296px wide. See §8.5.

**Marks panel** — floating, right side, top 64px / bottom 76px, 322px, resizable 220–400px. Segmented Marks/Pages/Queue at the top, destination filter chips, then the list.

**Bottom bar** — floating, centred. Undo · Redo · divider · page control · divider · class marks toggle · divider · zoom.

### 8.5 The inspector (the part that reads as premium)

Top to bottom:

1. **Live preview**, 52px tall — a sample of exactly what the mark will look like at the current colour, size and opacity. Text sample for text tools, a drawn stroke for ink. It updates as sliders move. This is the single most important detail; without it the panel is just settings.
2. **Size** — slider with tick labels underneath (`1 2 4 8 16` for ink, `4 8 12 20 32` for text marks) and the value in a mono pill on the right.
3. **Recent colours** — the last three used, above the full set, separated by a dashed rule.
4. **All colours** — the five, selected one ringed.
5. **Meaning card** — the colour's name and a line saying what marking in it does.
6. **Opacity** — slider whose **track is painted in the current colour**, value in a pill.
7. **Smart inking** (ink tools only) — a collapsible section with an "Ink to line" toggle and a smoothness slider.

Sliders: 4px track, 17px white thumb, thumb scales to 1.14 while dragging.

### 8.6 Layout at rest

| Size | At rest | Panels | Document gets |
|---|---|---|---|
| ≥1200px | Page, 48px top bar, 56px dock | Resizable panel beside the page | ≥75% width |
| 768–1199 (**primary**) | Page fills to the margins; top bar auto-hides on scroll down, returns on scroll up | **Overlay sheets only** | ≥90% |
| <768 | Page fit to width, chrome hidden while scrolling | Full-height sheets | 100% |

**Hard rule: below 1200px, no panel ever sits beside the page.** Panels overlay and dismiss.

### 8.7 Motion

- Panels scale in from 0.97 with opacity, not appear.
- A highlight applies with a left-to-right clip reveal (`clip-path: inset(0 100% 0 0)` → `inset(0)`), 340ms.
- A deleted mark shrinks to nothing rather than vanishing.
- Panels animate from the edge they live on.
- **Chrome recedes while working:** on pointer-down with a marking tool, bars drop to 20% opacity over 500ms; on pointer-up they return.
- Respect `prefers-reduced-motion`.

### 8.8 Icons

- One 20px grid, 1.5px stroke, round caps and joins, for every icon in the reader.
- **Draw tools as tilted objects, not flat symbols** — the nib, chisel and marker barrel drawn upright and rotated -45° about the icon centre. Flat symmetrical glyphs read as settings; angled objects read as tools.
- Each colour-carrying tool shows its **current colour** on the icon (a 14×2.5px bar under the glyph).
- Active tool = three cues together: filled pill, 3px accent bar on the rail edge, icon goes full white.
- Wingman-specific glyphs, not generic ones: Correction is a **snag tag** (tag outline with a hole), Question is a **placard** (board on a post), Sign off is a **serrated inspection seal** (dashed circle + inner circle + base).
- Icon hit targets 38px on desktop, 44px minimum on touch, driven by the existing Tool size setting.

### 8.9 Pen and iPad — the primary device

Most of this cannot be verified without hardware. Implement it correctly by construction, because a person will be testing it with an Apple Pencil the morning after this run.

**Distinguish the input.** Everything hangs off `PointerEvent.pointerType`:

- `pen` — draws and marks.
- `touch` — **never draws.** A finger always pans and pinch-zooms, even while an ink tool is active. This is the single most common failure in a web annotator, and it makes the app unusable within seconds.
- `mouse` — draws, plus hover affordances.

**Palm rejection.** While any `pen` pointer has been seen in the last ~800ms, ignore `touch` pointers on the page surface entirely. Also reject touch contacts with a large `width`/`height` (a palm is broad, a nib is not) as a second line of defence. A resting hand must produce nothing at all.

**Pressure and tilt.** Stroke width scales with `pressure` (fall back to a fixed width when it reports 0, as mice do); use `tiltX`/`tiltY` for the marker if cheap, skip it if not.

**Hover.** The Pencil reports hover on recent iPads — show the nib preview dot when it does. But **the mark card must open on tap as well as hover**, or an iPad user can never see one. Verify this specifically.

**iOS gotchas that will bite:**

- `-webkit-touch-callout: none` and `user-select: none` on the dock and all chrome, or long-press to edit the tray fights Safari's own callout menu.
- `touch-action: none` on the page surface while an ink tool is active; `touch-action: pan-x pan-y pinch-zoom` otherwise.
- `env(safe-area-inset-bottom)` on the floating bottom bar, or it sits under the home indicator.
- Use `dvh`, not `vh` — Safari's toolbar resizing will otherwise clip the chrome.
- `backdrop-filter` at blur(30px) across several panels can stutter on older iPads. Measure it; if it drops frames, reduce the blur radius on touch devices rather than removing the effect.
- Safari can evict IndexedDB after periods of disuse and restricts it in private browsing. The offline mark queue must degrade gracefully, never throw.
- Double-tap-to-zoom must be suppressed on the page surface or every tap-to-mark risks becoming a zoom.

**Both iPad orientations are below the 1200px breakpoint** (834pt portrait, 1194pt landscape), so an iPad always gets the tablet layout from §8.6: overlay sheets, never a panel beside the page. Test both orientations.

### 8.10 Themes

Everything above must be checked in **every livery, in both light and dark**. The five mark colours are fixed across liveries — they carry meaning, so they cannot shift with the accent. Everything else derives from the livery accent.

---

## 9. Phase 6 — The tool tray

The dock is **a tray the student builds**, not a toolbar we ship. This is the fix for "busy".

- **Default tray (6):** Select, Highlighter, Pen, Eraser, Note, Question. Nothing else.
- A **+** at the bottom of the dock opens "Add a tool": tabs by group — Select · Mark up · Ink · Draw · Sign off · Talk — with each tool as a coloured object plus a label. Tools already on the tray are shown dimmed.
- **Cap the tray at 10** (8 on tablet, 5 on phone). When full, adding says so rather than silently growing.
- **Long-press the dock to edit:** tools jiggle, an ✕ appears on each removable one, drag to reorder, "Done" to exit. Select cannot be removed.
- **Nothing is unreachable.** The Add sheet always lists the full set, so a student who removed Measure can find it again.
- **Two trays, remembered per device** — desktop and tablet want different tools. Do not sync one tray across both.
- **"Reset to course default"** in the Add sheet. The module can ship a recommended tray set by the author; this restores it.
- Keyboard shortcuts apply only to tools on the tray: `V H U S / P M E / R T K / G / N Q C`.

Full tool set available to add: Select, Highlighter, Underline, Strike, Pen, Marker, Eraser, Shape, Text box, Measure, Sign off, Note, Question, Correction.

---

## 10. Phase 7 — The mark card

One popover does everything: shows what a mark is, who made it, and the right actions. **Replaces the idea of a separate selection toolbar** — two overlapping popovers is exactly the clutter we're removing.

**Trigger:** hover for 240ms on desktop, tap on touch. Dismiss on leave (260ms grace, cancelled if the pointer enters the card), Esc, or clicking away. Positions above the mark, flipping below when there isn't room. 286px wide.

**Contents, top to bottom:**

1. Colour chip · colour name · page number
2. One line saying what the colour does
3. Author row: avatar, name, when. For someone else's mark, also their contribution on this module ("34 marks · 12 answers"). For an anonymous question: "?" avatar, "Asked anonymously · name hidden on questions".
4. Thread strip, for violet marks only: open/answered dot, reply count, "Open in Ready Room".
5. Actions:
   - **Yours:** the five colours as a recolour row, then Add note, then Delete.
   - **Someone else's:** "Ask {first name}" (or "Answer this" on a thread, or "Reply" if anonymous), an Agree/+1 with its count, and Follow.

Applies to **every** kind of mark — highlight, ink, shape, text box, stamp — not just text marks.

---

## 11. Phase 8 — Navigation and convenience

Build these in this order; the first three are the ones students feel every session.

### 11.1 Back and forward inside the document

Jumping to a figure and getting back is the most-missed control in a 1000-page manual. Maintain a within-document history stack; expose it as a "Back to page N" pill that appears after any jump (from the Marks panel, the tick rail, a search result or a cross-reference) and dismisses on use.

### 11.2 Mark ticks on the scrollbar

A 14px rail down the right edge, between the top and bottom bars, showing every mark in the whole paper positioned by page. The student's own marks are wider and fully opaque; the class's are narrower and lighter. Hovering a tick shows colour name + page; clicking jumps. A small accent box shows the current position.

### 11.3 Page scrubber

The page number in the bottom bar is draggable. Dragging flies through the manual and shows a floating card with the target page number, a thumbnail, and "N marks near here". Faster than typing a number and far faster than scrolling.

### 11.4 Search

- Find in paper: hit count, next/previous, **all** hits lit at once.
- Results as a list with the sentence around each hit.
- Hits shown on the tick rail so clustering is visible.
- **Search across the module**, results grouped by paper — a student thinks "where does this come up", not "which of the seven PDFs".
- A toggle for "only in my marks", which searches mark bodies and marked text.
- Recent searches, remembered per paper.
- Requires a text layer — see §5.2 on scans.

### 11.5 Bookmarks

Star a page; bookmarks list in their own strip at the top of the Pages panel. Per student. The module can also ship author-set "key pages".

### 11.6 Snapshot region to image

Drag a box around a figure and get a PNG on the clipboard or into a note. For an author building question banks this is the fastest path from reading to authoring; build it even though it looks minor.

### 11.7 Per-paper memory

Remember and restore, per paper per device: page, zoom mode, active tool, colour, panel open state, scroll position. On reopen show a brief "Picked up where you left off — page 129, highlighter, exam likely" with a "Start fresh" option.

### 11.8 Deep links

`/m/m1/paper/M1.P1?page=129&mark=<id>` opens the paper at that passage with the mark pulsed. This is what makes a Ready Room thread link back to the document.

### 11.9 Other navigation

- Contents from the PDF outline; when there is none, build one from headings and label it auto-built. Never a tab that only apologises.
- Thumbnails with per-page mark count badges.
- Clickable cross-references where the PDF has link annotations.

---

## 12. Phase 9 — Marks-only revision view

A toggle in the top bar collapses the paper to just the marked passages, grouped by meaning, in page order. Each row shows the passage, its colour, its page, and jumps back to it. Filter chips with live counts per meaning.

This is a study feature no PDF app has, and it is the one students will tell each other about.

---

## 13. Phase 10 — Export, print, offline

- **Print** with a real dialog: with marks / mine only / clean; current page, range, or marked pages only.
- **Save a copy** with marks burned in.
- **Export my marks** as a page-ordered study sheet (the marks-only view, exported).
- **Offline copy** of the paper the student is partway through, with their marks.
- Attach a photo to a note.

---

## 14. Ready Room integration

- A thread can originate from a lesson comment, a paper passage, or nothing. Passage threads carry `{paperId, page, anchor, quote}`.
- **The round trip must work in both directions:** the thread shows the quoted passage and links back to it; the passage shows the thread's state and opens it. Without both, it's two features sharing a table.
- Module threads are the Reddit-style feed; squadrons stay WhatsApp-style chat. Passage questions land in the module threads feed.
- Questions default to anonymous (§6.2). Consider defaulting the *audience* to the student's squadron with an escalate-to-module option — a smaller room gets more questions asked.
- Reporting and blocking must exist before the second cohort.

### The cold-start problem

A shared annotation layer with four users is worse than none — a student turns on the class view, sees nothing, and the app feels dead.

**Fix: the author marks up the papers first.** Every student's first open shows the instructor's markup. Ship at least one fully marked-up paper per module before students arrive. This is not a workaround, it's a feature worth advertising.

**And change the default:** show the student's own marks plus the instructor's by default, with class heat as one tap. Thirty students marking one chapter turns a page into soup. Class marks render as **aggregated heat with a threshold**, not thirty individual highlights.

---

## 15. Accessibility and quality bar

- Keyboard reachable throughout; visible focus rings; correct ARIA on toggles, tabs and the tool tray.
- 44px minimum touch targets.
- Respect `prefers-reduced-motion`.
- Text contrast ≥4.5:1 in every livery, light and dark. Check the mark colours against both page and chrome backgrounds.
- Screen-reader labels on every icon button — there are a lot of them and none have visible text.

---

## 15b. Phase 11 — Verify, fix, polish, integrate

**Two people are using this for real study the morning after this run.** One on a laptop, one on an iPad with an Apple Pencil. That is the standard to hold.

**Priority rule under time pressure: less, tested, beats more, untested.** If the run is running out of time, stop building and start verifying. A reader with Phases 1–7 working properly is far more use tomorrow than one with Phases 1–10 half-wired. Drop scope from the bottom of the list, never quality from the top.

Do not report the run complete while any test is failing.

### 15b.1 Build a real test harness

Install and use Playwright (it may already be present — check first). Configure at minimum:

- **Chromium desktop** at 1440×900 — the laptop case.
- **WebKit** at 1194×834 and 834×1194 with touch enabled and `hasTouch: true`, `isMobile: true` — the closest available stand-in for iPad Safari in both orientations. It is *not* Safari, so treat passes here as necessary but not sufficient.
- A dev server started by the harness, seeded with at least one large real paper and a fixture set of marks from two different authors, one of them an anonymous question.

Synthetic pointer input is what makes the pen testable without hardware. Dispatch real `PointerEvent`s with `pointerType: 'pen'`, varying `pressure`, and separately `pointerType: 'touch'` with large `width`/`height` to stand in for a palm. This will not catch everything a real Pencil does, but it catches the failures that matter most: a finger drawing, a palm marking, pressure ignored.

### 15b.2 Test every feature, not a sample

Write a test for every behaviour this brief specifies. Group them and make them named and readable, because a human reads the results in the morning.

**Rendering and large files** — first page under 1s; no blank page anywhere in a full scroll at three zoom levels; placeholders present before content; zoom preserves the anchor point; page separation visible; 206 partial-content responses observed in the network log, not one large GET; tiling above 200%; no unbounded memory growth over a 200-page scroll; render tasks cancelled on fast scroll.

**Marks** — create every mark kind; persist across reload, tab close, and a full navigation away and back; select, restyle, move, delete; lasso multi-select; undo and redo every one of those operations, from the button and from the keyboard; anchor resolution when offsets shift (mutate the fixture text and assert the quote fallback re-finds it); an unresolvable anchor lands in "Couldn't be placed" and is not silently dropped.

**Offline and queue** — go offline, make five marks, reload while still offline, come back online: all five present, exactly once, no duplicates. Kill the tab mid-write and confirm nothing is lost.

**Colours and routing** — each colour creates its downstream record; removing the mark reverses it; a thread with replies is detached rather than deleted; the closed colour set is enforced on text marks and free colour still works on ink.

**Anonymity** — assert on the **network response body**, not the DOM, that another student's client never receives the author id of an anonymous question. Assert an instructor's client does. This is the one test that must not be satisfied by hiding something in CSS.

**Refresh** — brings new marks; reports "up to date" when there are none; never clobbers an unsynced local edit; tombstones remove deleted marks; does not re-scroll the reader.

**Tray** — default set correct; add, remove, reorder, cap at the limit, reset to course default; Select cannot be removed; every tool remains reachable from the Add sheet; keyboard shortcuts only fire for tools on the tray; long-press enters edit mode and does not raise the browser's own menu.

**Mark card** — opens on hover and on tap; correct actions for own versus others' marks; anonymous rendering; thread state open versus answered; positions above and flips below at the top of the viewport; dismisses on Esc, on leave, and on outside click.

**Navigation** — page jump, scrubber drag, tick rail click, back pill returns to the exact prior scroll position, bookmarks, search in paper and across the module, hits on the rail, deep link opens at the passage with the mark pulsed.

**Per-paper memory** — page, zoom, tool, colour and panel state all restored; "Start fresh" clears them.

**Pen and touch** — a `touch` pointer scrolls and pinch-zooms and never draws while an ink tool is active; a `pen` pointer draws; a broad `touch` contact during pen input produces nothing; pressure changes stroke width.

### 15b.3 Visual and state verification

Screenshot every surface — reader at rest, each tool's inspector, the mark card in each variant, the marks panel, the add-tool sheet, the marks-only view, the scrubber, every empty state, every loading state, every error state — across **all three breakpoints × every livery × light and dark**. Review the screenshots. Fix what looks wrong; do not just archive them.

Assert programmatically: no console errors or warnings anywhere; no horizontal page scroll at any breakpoint; no clipped or overflowing text; no element overlapping another unintentionally; every interactive element has a visible focus state; every icon-only button has an accessible name; contrast ≥4.5:1 for text in every theme.

### 15b.4 The loop

Run the suite. Fix everything that fails. Run it again. Repeat until it is green. A failing test that you cannot fix gets written up in `REPORT.md` with what you tried — never deleted, never skipped, never marked pending to make the run look clean.

### 15b.5 Polish pass

"Polish" is not a vibe. Go through the reader and fix each of these specifically:

- One easing curve everywhere; one radius family; one spacing rhythm.
- No layout shift when a panel opens, a mark is added, or a value changes width — reserve space, use tabular numerals.
- Every state designed: empty, loading, offline, failed, permission-denied, still-processing.
- Every error message says what happened and what to do, with no apology and no jargon.
- Every label in student language. No percentages where a mode name will do.
- Loading never shows a spinner over nothing — always a shaped placeholder.
- Nothing flashes, jumps or reflows during first paint.
- Tooltips on every icon-only control, with the shortcut where one exists.

### 15b.6 Integration pass

- **No dead ends.** Every control does something. If a feature did not land, remove its button rather than shipping one that does nothing.
- Every feature reachable from the place a student would look for it, not only by shortcut.
- The reader, the Marks panel, the marks-only view, the tick rail and the Ready Room all read from one source of truth — no divergent copies of mark state.
- Old reader code paths removed or flagged off, not left half-wired alongside the new ones.
- Pre-existing reader bugs found along the way get fixed and listed in `REPORT.md`.

### 15b.7 Leave a manual test script

Some things cannot be tested without hardware: real Apple Pencil pressure and palm behaviour, real iOS Safari, real device performance, real network conditions.

Write `docs/reader/MANUAL-TESTS.md` — an ordered, numbered script for two people to run in twenty minutes, laptop and iPad, **pen and save-integrity tests first**, each step saying what to do and what should happen. Put anything you could not verify yourself at the top of that file, clearly marked as unverified.

## 16. Acceptance checklist

Run in every livery, light and dark, on desktop and on a tablet with a pen.

- [ ] Longest paper scrolled end to end at three zoom levels — no blank pages, ever.
- [ ] A 40 MB+ paper shows page one in under a second, and the network tab shows 206 partial-content responses rather than one large download.
- [ ] Zoom to 400% on a full-page diagram on a tablet without a crash or a blank canvas.
- [ ] Zoom ten times — the paragraph under the cursor stays under the cursor.
- [ ] Every tool shows its colour and size without opening a menu.
- [ ] A mark made a week ago can be selected, restyled, moved and deleted.
- [ ] Undo and redo reach every action, from a button, with no keyboard attached.
- [ ] A resting palm never draws while a pen is in range.
- [ ] A finger scrolls and pinch-zooms while an ink tool is active, and never draws.
- [ ] The mark card opens on tap, not only on hover.
- [ ] Long-pressing the dock on iOS edits the tray and does not raise Safari's own menu.
- [ ] Both iPad orientations get overlay sheets, and the bottom bar clears the home indicator.
- [ ] Marks survive a hard reload, a closed tab, and going offline mid-session.
- [ ] Refresh pulls new module marks and never clobbers unsynced local ones.
- [ ] A question shows no author name to another student — verified in the network response, not just the UI.
- [ ] A violet mark visibly changes state when its thread is answered.
- [ ] Every panel below 1200px overlays the page rather than shrinking it.
- [ ] The tray can be built, trimmed, reordered and reset; no tool is unreachable.
- [ ] Hovering any mark shows its card with the right actions for ownership.
- [ ] Reopening a paper restores page, zoom, tool and colour.
- [ ] No empty state exists only to apologise.
- [ ] No control duplicates another control's job.

---

## 17. Explicitly out of scope

Do not build: page insert/delete/reorder, PDF text editing, form fields, digital signatures, annotation import/export (XFDF), read-aloud, reflow, real-time collaborative cursors, background polling or sockets.

Remove: the floating "Something's wrong here" pill (the Correction tool and the selection popover already cover it), and the duplicate paper row in the Library list (one row per paper; the in-progress one gets the Resume button and a progress hairline, not a second row).

---

## 17b. Content state to leave behind

The reader is being handed to two real users the morning after this run, with real course material. The placeholder content currently in the app gets cleared.

- **Remove every placeholder paper across every module.** None of the generated test documents ("Notes", "Worked examples", "Reference sheet", "Handout", "Summary", "Everything on one sheet", "Practice set", or anything else marked as placeholder) remain anywhere.
- **Modules 2 and above:** empty of placeholder content.
- **Module 1:** keep it exactly as it is — lessons, quizzes, chapters, structure. It stays the testing bed. **Only its Papers section is emptied.**
- Module 1's Papers section must then show a proper empty state and a working way to add a paper. A real Lufthansa Technical Training PDF will be uploaded into it by hand after this run — it is large, so §4.6 and §4.7 apply to it in full. Make sure the ingest path (linearize, manifest, text layer, thumbnails) actually runs on upload and that a paper mid-processing shows "Preparing…" rather than a broken viewer.

Rules for doing this safely:

- **Never delete a student's marks.** Clear papers, not annotation history. If a placeholder paper has marks attached, remove both together and say so in `REPORT.md`.
- Do it with a reversible, re-runnable script committed to the repo (`scripts/clear-placeholder-content.ts` or equivalent), not by hand and not with ad-hoc queries.
- Back up the affected tables first and note where the backup is.
- Do not touch users, modules, lessons, quizzes or Ready Room threads.
- List exactly what was removed, with counts, in `REPORT.md`.

## 18. Stack constraints

**No paid PDF SDK.** Do not introduce Nutrient, Apryse, Foxit or any commercial viewer. Build Phase 1 on **PDF.js** (`pdfjs-dist`, Apache 2.0, free) — use the library directly (`getDocument`, `page.render`, `page.getTextContent`), not the bundled demo viewer, which is heavy and fights custom chrome. It gives rendering, the text layer and text extraction for search, which is everything Phase 1 and Phase 2 need. The annotation model in §5 is ours and sits on top of it.

Everything else in this brief runs on the client or on the existing backend. Nothing here needs a paid service.

**Source material:** the Lufthansa Technical Training PDFs are what the app runs on for study and testing now; in-house papers replace them before the product earns. Build nothing that assumes a particular publisher's layout, header format or page furniture — the reader must work the same on any PDF put into it.
