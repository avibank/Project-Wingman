# Launch checklist

Filled in on 2026-09-19, after items 1–6. A box is ticked only where something
CHECKS it — a script, a walk, or a measurement written down — and the check is
named. Where a box is not ticked, the line says what is missing rather than
being left blank, because an unticked box with no reason reads as "not looked
at" and most of these were.

## Wiring
- [x] Every button reaches a real screen or action — `check:doors` (10) reads
      the source for controls that lead nowhere, `check:licence` names each of
      §5's five pickers and asserts something opens it, and `test:routes` opens
      all fourteen addresses the app can be at and fails one that renders
      nothing, has no heading, or has nothing to press.
- [x] No placeholder toasts left — `check:licence` fails if that screen
      contains "coming", "not yet" or "soon" outside a comment. The one that
      existed ("Uploading your own cover is coming") is gone because the
      upload is built.
- [x] Ready Room, squadron chat, module threads, quiz and paper reader links
      all work — `test:routes`, plus `check:doors` for the doors between them.
      Two real dead ends were found and fixed on the way: every lesson URL
      answered Vercel's 404 in production (BUGS 12), and the licence rendered
      in edit mode with no account (BUGS 17).

## States
- [x] Empty — `check:states` checks loading, error and empty across 221
      components, and the Voice rule with it: no screen states an absence or a
      count of nought. Three were fixed in this pass ("Nobody yet" on the
      blocked list, the logbook's empty line, the licence's three stats, which
      say "—" rather than 0).
- [x] Loading and error states on every fetch, with retry — same check.
- [ ] Long names, long titles, crowded chapter walls (100+ stamps) — NOT
      COVERED. `test:bm` and `test:rr` measure overflow on their own screens
      at four widths; nothing drives a hundred stamps onto a Crew wall or a
      forty-character callsign onto a licence. The stamp cache and shared
      filters exist for that case and have never met it.

## Rules
- [x] Stamp can't be changed once issued (server enforced) — 0029's
      `issue_stamp` refuses a second call and `stamp_is_permanent()` closes the
      direct PATCH path. `check:stamp-db` drives it against the live database.
- [x] Code, callsign, rim text and bio validated server-side — CHECK
      constraints in 0029 and 0030; `check:stamp` and `check:licence` hold each
      list to the one in `src/lib/`, and each is proven by planting a value the
      app allows and the database refuses.
- [x] A student can only edit their own card — writes are scoped by `user_id`
      and issuing is a SECURITY DEFINER function; `licence_card(viewer, user)`
      returns a fixed 21 columns and `check:licence` names the eight it must
      never include.
- [ ] Fly solo actually hides them everywhere — PARTLY. `licence_card` refuses
      a pilot who has it on, `crew.js` enforces it symmetrically, and the photo
      is hidden wherever Clerk's is. There is no single check that walks every
      surface — presence, the route strip, the radar, Crew, the room — with it
      on and asserts the student is on none of them. That walk is the missing
      piece and it is the one §6 asks for by name.
- [x] Crew shows chapter level only — never a lesson or a score — `crew.js`
      selects neither, and `check:doors` asserts the file's shape.

## Look
- [x] 390 / 768 / 1280 / 1600px — `check:responsive`, plus `test:bm` (four
      widths), `test:rr` (four), `test:lesson` (three) and `test:vt`.
- [x] 6 liveries × 3 finishes × light/dark — `check:contrast`,
      `check:lesson-contrast` (now including the logbook, the ask violet and
      the right seat's teal), `check:day`, `check:livery`, `check:surfaces`,
      `check:rr`. Measured off tokens, and off painted pixels in `test:bm`.
- [x] Reduced motion (Smooth Air) turns the stamp animations off —
      `check:transitions` and `test:vt` with `VT_MOTION=smooth-air`, which
      passes a step only if nothing animated.
- [ ] Matches the reference builds side by side — DONE FOR BOOKMARKS ONLY.
      `tests/r15-compare.mjs` measures that pack against its demo at three
      widths; there is no equivalent for the module screen, the lesson page or
      the licence. Those were ported rule by rule with the effective CSS
      written out, which is not the same as measuring.

## Health
- [x] Console clean — `test:routes` fails a route on any console error that is
      not the harness's own missing backend, and `test:lesson` asserts it on
      the lesson.
- [x] Uploads: type and size limits, resizing, old file cleanup — four types
      and 8MB in the browser, the same four and 1MB on the bucket, and what is
      uploaded is a 640×128 WEBP the browser rendered, so there is no original
      to clean up: one object per pilot, overwritten. `check:licence` holds the
      two lists together.
- [x] Stamp SVGs cached per user; filter ids unique — `check:stamp`, and
      `<StampFilters/>` renders one filter per seed on screen.
- [x] Unit tests: every shape × pattern × rim state renders; validation —
      `check:stamp` is 27 assertions over 6 shapes × 6 patterns × 36 inks.
- [ ] E2E: sign off a lesson; create and issue a stamp; take a note and jump
      to it — TWO OF THREE. `test:lesson` takes a note, asks a question, seeks
      from a logbook stamp, filters, deletes and exports. Issuing a stamp is
      driven by hand in a browser and by `check:stamp-db` against the database,
      but no walk does it through the studio. Signing off a lesson is asserted
      as rules (`check:lesson`) and never driven, because it needs a video
      watched to the end and the fixture's clips are remote.

## What is not on this list and should be
- **A physical device.** Nothing in this project has been opened on a phone.
  Every width above is an emulated viewport in a desktop browser.
- **A second account.** Every check that needs two people —
  `check:threads`, `check:discovery`, `check:paper-db` — creates its own and
  cleans up, but no walk has two people on screen at once.
