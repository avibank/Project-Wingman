# Phase 0 — Discovery

Written before any code changed. Everything below was checked by running it, not
inferred from the source. Where a claim could not be verified it says so.

Branch `reader-rebuild`, off `main` at `0a3f7d1`. Date 2026-09-08.

---

## 0. The headline, before anything else

**The reader on production has a bug that empties the document.** Close the
Pages panel and the page area becomes 0px wide — the paper is simply gone,
painted off to the left of the viewport. Measured:

| Panel | `.pbody` children | `grid-template-columns` | Document width |
|---|---|---|---|
| open | `prail`, `pscroll` | `248px 950px` | 950px |
| **closed** | `pscroll` | `0px 1198px` | **0px** |

The body is a two-column grid and the panel is conditionally rendered, so with
the panel closed its single remaining child auto-places into the *first* column
— the one sized `var(--side-w)`, which is `0px` when the panel is shut.

This is mine, from commit `15898df` earlier today: unifying the sidebar width
into one variable replaced a rule that named panels by hand, and in doing so
made the document's position depend on how many children the grid has. The
stylesheet's own header warns about exactly this class of bug in a different
context ("nothing depends on how many children there are") and I reintroduced
it four rules further down.

It is the first thing fixed in Phase 1. Placement is made explicit rather than
automatic, so it cannot come back.

**Second live bug, same area:** the reported "blank page on scroll" symptom is
partly this. With the panel closed there is no page to blank — it has no width.
With the panel open, pages do render. See §1.

---

## 1. Rendering

- **pdf.js**, `pdfjs-dist@4.10.38`, pinned exactly (not caret-ranged) — see the
  header of `src/lib/paperText.js` for why: a minor version changes how text
  runs are split, which changes the extracted string, which silently orphans
  every existing text-anchored mark.
- Used as a **library**, not the bundled demo viewer: `getDocument`,
  `page.render`, `page.getTextContent`, `pdfjs.TextLayer`. §18's constraint is
  already met.
- **A text layer is produced**, per page, by `pdfjs.TextLayer`, and the spans
  are aligned one-for-one against the extracted runs. Where they disagree the
  page draws no marks at all rather than drawing them in the wrong place.
- Worker is bundled locally (`pdf.worker.min.mjs?url`), no CDN.
- The reader is a lazy chunk — 428KB, and `check:bundle` asserts pdf.js never
  reaches the entry chunk.

**Not a black-box third-party viewer.** §2's stop condition does not apply;
Phase 1 is implementable.

### The blank-page bug, as it actually behaves

Measured on `M1.P6` (14 pages) at 1280×720:

- Panel closed → document 0px wide, nothing visible at all (§0).
- Panel open → page 1 renders. Its canvas is 722×1021 with **zero dark pixels**,
  but that is the *file*: the placeholder PDFs are generated blank pages. Not a
  render failure.
- Only one page is live at a time (`WINDOW = 2`, but `visible(n)` is keyed off
  the scroll-derived current page, and the scroll never advanced because the
  scroller had no width).

So the brief's Phase 1 symptom is real, and its cause is the layout bug plus a
window that cannot advance — not, as the brief guesses, the canvas "giving up".
The thumbnail pipeline works because it never touches that grid.

---

## 2. File sizes and delivery — **verified with real requests**

### Range support: YES

```
$ curl -I https://www.wingman.institute/papers/placeholder-14-pages.pdf
HTTP/2 200
accept-ranges: bytes
content-type: application/pdf
content-length: 16660
x-vercel-cache: HIT

$ curl -H "Range: bytes=0-1023" …
HTTP/2 206
content-range: bytes 0-1023/16660
content-length: 1024      ← 1024 bytes actually returned
```

**Production returns `206 Partial Content` with a correct `Content-Range`, and
`Accept-Ranges: bytes` is advertised.** Vercel's edge cache serves it and
honours the range rather than buffering the whole body. §4.6's second hard
condition is satisfied for files served from `public/`.

**Caveat the brief does not cover:** this was measured on a 16KB file. Papers
today live in `public/papers/` — i.e. **inside the git repo, deployed as static
assets**. That is the wrong home for the 40–200MB file described in §17b:

- it would be committed to git, permanently, in every clone;
- Vercel's deployment bundle would carry it on every build;
- there is a hard cap on Vercel static asset size well below 200MB.

So large papers need object storage, not the repo. See §7.

### Linearization: NO

`qpdf` is not installed on this machine, so `qpdf --check` could not be run.
Checked directly instead, against the actual definition — a linearized PDF
declares `/Linearized` in its first object, inside the first ~1KB:

| File | Size | Linearized |
|---|---|---|
| `tracemonkey.pdf` (the real-content dev paper) | 996 KB | **no** |
| `placeholder-14-pages.pdf` | 20 KB | **no** |

Neither is linearized. Nothing in the repo linearizes anything, because there is
nowhere for it to run — see §7.

**What this costs, honestly.** Without linearization pdf.js cannot jump straight
to page 1's objects; it fetches the trailer, finds `startxref`, and range-fetches
from there. On `tracemonkey.pdf` the xref is a classic table at offset 996213 of
996KB — i.e. at the very end — so the first useful fetch is the tail, then more
ranges. That is still far better than a whole-file GET, and it is not the
pathological case the brief describes. It is worse than linearized and should be
fixed at ingest.

---

## 3. Text layer per paper

- `tracemonkey.pdf` — born-digital, full text layer, no OCR needed. This is the
  paper the annotation layer was built and tested against.
- The six `placeholder-*.pdf` files — generated, essentially blank; they carry a
  trivial text layer and nothing worth anchoring to.
- **No image-only scans are present today**, so §5.2's OCR fallback is not
  needed for launch. It stays a graceful path, not a pipeline, exactly as the
  brief says.
- The Lufthansa PDF arriving after this run is **unknown** until it lands. The
  reader must detect a page with no extractable text and say so rather than
  offering text tools that cannot work. Built as a real state, not assumed away.

---

## 4. Annotation storage

Live schema, as it stands (migrations 0014 and 0017, both run against
production and verified by querying):

`paper_annotations`
: `id, paper_id, module_code, paper_version, author_id, kind, ring, body,
  colour, thread_id, resolved_at, status, anchor jsonb, hint jsonb,
  created_at, updated_at`

  - `kind ∈ highlight | underline | strikethrough | note | question | correction`
  - `colour ∈ yellow green blue pink orange purple red graphite` (nullable)
  - `ring ∈ solo | wingman | formation | module` — this is the existing
    visibility model, and it is *finer* than the brief's
    `private | squadron | module`.
  - **`anchor` is text, never coordinates**, enforced by a CHECK
    (`anchor_is_text_only`) that refuses any anchor carrying `page`, `rect`,
    `rects` or `bbox`. The shape is `{quote, prefix, suffix, …}` — already
    §5.2's `TextAnchor` in all but field names.
  - `hint jsonb` holds cached page/rects for drawing only, explicitly
    disposable, and nothing may read it for identity.

`paper_ink`
: `id, paper_id, module_code, paper_version, author_id, page, tool, colour,
  width, ring, points jsonb, created_at` — points are fractions of the
  unrotated page (0..1), never pixels. This is §5.2's `InkAnchor`, already
  normalised.

Reads go through `paper_marks_for(uid, paper, since)` and
`paper_ink_for(uid, paper)`; the functions enforce Fly-solo symmetry, blocks,
mutes and the ring rule, and strip corrections from everyone but their author
and staff. **The client never selects these tables directly** and `check:paper`
asserts it.

**Row counts in production, at the time of writing:**

| table | rows |
|---|---|
| `paper_annotations` | 5 |
| `paper_ink` | 0 |
| `lesson_threads` | 2 |
| `pilot_profiles` | 3 |
| `user_progress` | 3 |

Five real marks. Small enough that a migration is cheap, large enough that the
brief's "existing student marks must survive" is a real constraint and not a
formality.

**Gaps against §5.1**, all additive:
`kind` has no `ink | shape | text | stamp`; there is no `style {width,opacity}`
on a mark, no `inkColour`, no `anonymous`, no `agreeCount`, no `deletedAt`
tombstone (deletes are hard today, which §7.2 needs to change for sync), and
`colour` carries eight decorative names rather than the five *meanings* of §6.

---

## 5. Auth and membership

- **Clerk** owns identity. `user_id` columns hold the Clerk id as `text`.
  There is no parallel user table and no Supabase auth uid anywhere.
- `auth.uid()` is **always NULL** in this architecture — every request reaches
  Postgres anonymously through PostgREST. RLS is enabled on every table with
  open `using (true)` policies, and access control is done in SQL functions
  that take the caller's id as a parameter. Migration 0009's header states this
  explicitly. **Any policy referencing `auth.uid()` would silently deny every
  row rather than fail loudly.**
- **"Author/instructor" exists**: `pilot_profiles.is_staff`. It already gates
  the corrections queue (`paper_corrections_for` returns nothing at all to a
  non-staff caller rather than raising). §6.2's "instructors see the author" has
  a real role to hang off.
- Module membership is **derived, not enrolled** — there is no `enrollments`
  table. `my_modules` (migration 0011) builds it from `chapter_completions` and
  `lesson_threads`. All four modules are open; nothing is gated.

---

## 6. Design tokens, routing, Ready Room, realtime

**Tokens.** Two engines emit them: `src/lib/liveryEngine.js` (`deckVars`) and
`src/lib/finishEngine.js` (`finishVars`), across five liveries × night/day ×
three finishes. 53 emitted tokens plus 111 declared in CSS. `--ground --panel
--raised --line --t1 --t2 --t3 --active --edge --edge-hi --ok --bad
--on-mark …`. `npm run check:tokens` fails the build on any `var(--x)` nothing
emits. **This is the system §8.3 must fill gaps in, not replace.**

**Routing.** `/m/:module/paper/:paperId` — `routes.js:71`. A paper is already
its own address. There is **no page or mark in the URL today**, so §11.8's deep
links are new.

**Ready Room.** `lesson_threads` + `lesson_replies`, both published to the
realtime publication. A thread carries `{id, module_id, lesson_id, body,
author_id, title, created_at}`. `askOnPassage()` in `src/lib/annotations.js`
already creates a thread from a marked passage, opening with the quote — so
§6.3's `unsure → thread` half exists. **The return leg does not**: a thread has
no `paper_id`/`page`/`anchor`, so it cannot link back to the passage. §14's
"must work in both directions" is genuinely missing.

**Realtime.** `src/lib/live.js` — `@supabase/realtime-js`, imported lazily so
the entry chunk keeps PostgrestClient alone. Tables published: `lesson_threads`,
`lesson_replies`, `comms_messages`. Presence is deliberately not among them.
Noted per §2; **the paper deliberately does not use it** and §7's manual-refresh
decision matches what is already there.

**Flags.** `src/lib/flags.js` — `library.reader` is `everyone: true`. `READER_V2`
is new and goes beside it.

---

## 7. The blocker the brief does not know about: there is no server

Checked: **no `/api` directory, no Supabase Edge Functions, no serverless
functions in `vercel.json`** (rewrites only). The app is a static Vite bundle on
Vercel plus Supabase over PostgREST. **There is no place to run §4.7's ingest
pipeline as written**, and none of its tools — `qpdf`, `gs`, `pdftotext`,
`ocrmypdf`, `tesseract` — is installed on this machine either.

**And there are no storage buckets.** `GET /storage/v1/bucket` returns `[]`. A
200MB PDF has nowhere to live today.

### The adaptation (recorded as a deviation, per rule 4)

§4.7 is split by where each step can actually run:

| Step | Where it runs now | Why |
|---|---|---|
| Manifest (pages, dimensions, outline) | **browser, at upload** | pdf.js already does this |
| Text layer per page | **browser, at upload** | `getTextContent` already does this |
| Thumbnails | **browser, at upload** | render to canvas → JPEG blob |
| `qpdf --linearize` | **local CLI, before upload** | needs a binary; no server to host one |
| Ghostscript optimise | **local CLI, optional** | same |

The valuable half is fully deliverable: with the manifest, text and thumbnails
stored as sidecars, **the reader never opens the PDF to lay out, search, or
anchor a mark.** It opens the PDF only to paint pixels. That is what makes 1012
placeholder pages appear before a single PDF byte arrives, and it does not need
a server.

Linearization is the half that cannot be automated here. Rather than pretend:
a script does it locally when `qpdf` is present, the ingest records whether the
file is linearized, and the reader says so in Document details. An unlinearized
paper still range-loads — just less efficiently.

---

## 8. Deviations from the brief, decided in Phase 0

1. **Ingest moves to the browser** (§4.7). No server exists. Linearization
   becomes a local CLI step. Recorded above.
2. **A storage bucket is required and is not created by this run.** The brief
   says "do not run migrations against production; I will run production
   myself". Creating the bucket is therefore written as
   `supabase/migrations/0018_papers_storage.sql` plus one idempotent command,
   and **left unrun**. Uploading a paper will not work until it is run once.
   This is the single item at the top of `REPORT.md`.
3. **Visibility keeps the existing four rings** rather than §5.1's three. The
   rings are already enforced in SQL, tested, and finer-grained. Mapping:
   `private → solo`, `squadron → formation`, `module → module`.
4. **Mark colours gain the five meanings alongside the eight ink names.** The
   ink palette (§6 of CLAUDE.md) is what a *pen* lays down and carries no
   meaning; §6's five are what a *text mark* means. They are different
   categories and both are needed — see Phase 3.
5. **`prefers-reduced-motion` and Smooth Air.** The app has its own reduced
   motion preference (`.app.smooth-air`) on top of the media query. Every
   animation added must honour both; `check:paper` asserts it.

---

## 9. What Phase 1 starts with

1. The zero-width document (§0) — placement made explicit.
2. Page window that advances, with placeholders at the right aspect ratio.
3. Zoom that keeps the previous raster until the sharp one lands.
4. Range loading turned on with `disableAutoFetch`, verified by watching for
   `206`s in the network log rather than assuming.
