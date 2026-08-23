# Build progress against docs/SPEC-V2.md

v1 progress is in `docs/SPEC-PROGRESS.md` and is now history. `docs/SPEC-MIGRATION.md`
lists what v1 shipped that v2 reverses.

## Status

| Phase | Step | State |
|---|---|---|
| 1 | Routing (§2.2) | **done** |
| 1 | Primitive + semantic token layers (§3) | **done** |
| 1 | Type scale, weights, tracking (§5) | **done** |
| 1 | Bugs 2, 3, 6, 8, 10 | **done** |
| 2 | Home rebuild (§9.1) | **done** |
| 2 | Chapter: one rendering, three tabs (§9.3) | partial — one rendering done in v1 |
| 2 | Quiz (§9.3.2, §4.5) | **partial** — illumination done; explanations and Ask-about-this pending |
| 2 | Debrief (§9.3.3) | **done** |
| 2 | Naming + placards (§8) | **partial** — settings placards done |
| 2 | Delete list (§6.6) | **done** |
| 3 | Mono ramp + liveries (§3.4) | not started |
| 3 | Presence light & motion (§4) | not started |
| 3 | Surfaces, panelling, glow (§6) | not started |
| 4 | Comments, squawk, Ready Room, teams, verified | not started — blocked on §10 cold start |

## Phase 1 · Routing — done

`src/lib/routes.js` is the URL contract: a pure `parseRoute()` and a `path` builder set,
free of any React or router import, so the whole thing is checkable without mounting
anything and the app never constructs a path by hand.

Verified against 19 parses and 13 builder round-trips: case folding (`/m/JT` → `JT`),
trailing slashes, query and hash stripped, unknown chapter tabs falling back to brief,
`/m/:module/:chapter/q/:n` resolving to the quiz with a question number, and `/nope`
resolving to a named `notfound` rather than throwing.

`App.jsx` derives `view`, `settingsPage`, `tab` and the pending chapter id from the URL
instead of storing each in state. `activeModuleCode` split in two: `preferredModuleCode`
is the persisted "which module is the hero on Home" preference, and the URL wins inside a
module.

`vercel.json` adds the SPA rewrite. Without it every deep link 404s in production, which
would have made the whole feature invisible.

### Verified

Clicking a module goes to `/m/jt`; browser back returns to `/`; forward returns to
`/m/jt`. Loading `/`, `/m/jt`, `/m/jt/library`, `/m/jt/ch2`, `/logbook`, `/saved`,
`/settings`, `/ready` and `/nope` cold all render without crashing, with different node
counts per route.

### Found while testing

The boarding overlay is a full-screen blocking element whose only exit was
`onAnimationEnd`. A backgrounded tab never runs animations, so opening the app in a tab
that is not in front left the boarding pass covering everything, permanently. It has a
timeout now.

## The verification gap that let a crash ship

Every harness route rendered an individual component against stubs. `App` was never
mounted, so its hydration effect never ran — which is where `setAccentColor` was. Every
route swept clean while the live site was down.

Two guards now:

- `?p=app` in the harness mounts the shipped `App` inside the `ErrorBoundary`.
- `npm run lint` — ESLint with `no-undef`, `rules-of-hooks`, `no-const-assign`,
  `no-dupe-keys`, `no-unreachable`. It reports 0 errors, which is how we know
  `setAccentColor` was the only reference of its kind.

**Run both before every push.**

## Phase 1 · Token layers — done

`scripts/build-tokens.mjs` generates `src/styles/tokens.css`: the mono ramp per livery
(13 steps, §3.2 lightness × §3.3 chroma curve), the beacon ramp, and the §3.6 semantic
mapping per variant. `src/styles/liveries.css` and the v1 generator are deleted.

Components reference semantics only. The old names survive as aliases in App's `.app`
block and are retired screen by screen rather than in one sweep — but every one of them
now resolves to a §3.6 semantic and to nothing else, which is what makes v1's bug #2
structurally impossible.

### Three things the generator's own checks caught

**§3.6's day `text-secondary` fails AA.** Mapped to `mono-600` it measures **4.08:1** on
`bg-ground` for Night Ops — under the floor §12 requires for exactly this token.
`mono-700` clears at **5.97** across all six liveries. The generator asserts this and
exits non-zero, so it cannot regress.

**§4.1's presence shift is signed wrong for day.** "lightness → +0.03" assumes a dark
ground. On a light one it walks toward white, which reads as *less* present — and
`bg-ground` at L .97 plus the lit step landed at **L 1.06**, outside the range entirely.
Day subtracts. The emitter now throws on any lightness outside 0..1.

**The harness reproduced bug #2 itself.** Its `index.html` hardcoded
`background:#0B1526`, so every livery switch left the page behind the app dark blue —
the same failure, in the tool built to catch it.

### Monochrome forces one v1 decision

Module identity hues (`#7FB2E8` and four more) are gone. v1 left them deliberately;
under §3 they are out of system, and in day they measured **1.76:1** — pastels on a
light ground. `--id-hue` now resolves to `--accent-interactive`.

### Contrast, both variants, all six liveries

Night is clean on every route. Day started at 25+ failures and is down to a residue of
genuine metadata: a timestamp, a day divider, "1 of 4 logged", "Pinned to JT.01", item
kind labels. All are `text-tertiary` at **2.84–3.01**, which §12 exempts as
"non-essential metadata only".

What was moved *off* tertiary, because it is not metadata: a person's name, a toggle's
state readout, an instrument's numeric readout, control labels, explanatory copy, chapter
titles, and the chapter code under a presence avatar — which is the "where" half of the
rail's entire job.

**The number is worth keeping visible: 2.84:1.** At that contrast tertiary is genuinely
unreadable for anything that matters, and v1 shipped seat names in the equivalent token.
The generator prints it on every run.

## Phase 1 · Type — done

Audited before touching anything, and the numbers matched §5's diagnosis exactly:
**22 distinct font sizes**, **4 weights** including 22 uses of 700, **10 tracking values**
up to 0.16em, and **67 mono call sites** across 20 files.

After:

| | Before | After |
|---|---|---|
| Sizes | 22 (17 of them under 22px) | 6 + the 17px reading size |
| Weights | 400 · 500 · 600 · 700 | 500 · 600 |
| Tracking | 10 values, worst 0.16em | capped at 0.06em |
| Mono call sites | 67 | 39, and only codes and numerals |

Mono kept for chapter codes, identifiers and numerals — and for the boarding pass, where
it is the literal referent. Everything else became sentence-case sans in `text-secondary`,
with `text-transform: uppercase` and its tracking removed at the same time, since a
retired label should stop shouting as well as stop being mono.

### The Arial bug §5.1 names

`<button>`, `<input>`, `<textarea>` and `<select>` **do not inherit `font-family`**. Every
control that did not set one explicitly fell out of the type system into the browser
default — Arial at 13.33px here, `-apple-system` elsewhere. Comms was rendering **43 of
its 90 text nodes in Arial**.

The whole fix is one line: `button, input, textarea, select { font: inherit; letter-spacing: inherit; }`

After it: **zero Arial on every route**, and every computed size on the six-step scale
except `.sr-only`, which is visually hidden anyway.

### Found by the contrast sweep, unrelated to type

`timeAgo()` rendered **"NaNmo ago"** for a missing timestamp. The obvious guard was not
enough: `new Date(null)` is the epoch, not `NaN`, so a null timestamp read as **"689mo
ago"** — a plausible-looking lie rather than an obvious break. It needs both the falsy
check and the finite check, and the test that caught it asserts both.

## Phase 1 · Bugs — done

**#2 theme desync — worse than a desync.** `theme` ("dark"/"light", stored at `pw-theme`)
and `variant` ("day"/"night", from `variantPin || autoVariant`) were two states for one
concept, and **only `variant` painted anything**. `toggleTheme` set `theme`, which the
`data-variant` attribute never reads — so the Dark mode control changed a stored string
and zero pixels. Separately, `pw-variant-pin` was *read* at hydration and never written,
so pinning never survived a reload either.

Collapsed to one: `variantPin` is the choice, `variant` is the result, `theme` is gone.
Verified — clicking the row flips `data-variant` day → night and repaints the body from
L .97 to L .15.

**#3 greeting ignored the name preference.** `firstName` preferred `user.username`
unconditionally, so someone with "show real name" on was greeted by their handle on
their own home screen. It follows `identity_display` now, like every other name.

**#6 hover was identical to selected.** Both used the same accent chip and border, so you
could not see what you had picked. Hover is a value lift to `bg-raised`; the answer
states are a full fill.

**#8 and #12** were already fixed — the NEXT UP band went when the Flight Deck was
rebuilt, and `pw-accent-color` went with the accent system.

### #10 → §4.5 illumination

Correct and wrong were both teal. They are now light and its absence, measured:

| | background | vs idle | marker |
|---|---|---|---|
| Correct | mono-700, L .48 | **3 ramp steps up**, plus edge emission | filled solid |
| Idle | mono-900, L .28 | — | hollow |
| Hover | mono-800, L .38 | 1 step up | hollow |
| Wrong | mono-1000, L .15 | **2 steps down**, at the ground | hollow, dashed, struck |

Four distinct values, **one hue**. Nothing here depends on colour vision, which matters
on a licence where it is tested at every medical. The check icons went from `--good` and
`--calm` to ramp values for the same reason.

### A note on the harness

The computed background read as mid-transition on every state until transitions were
disabled in the test. A hidden tab never advances them, so the computed value sits at the
start — the declared values were correct all along. Worth remembering before chasing a
CSS bug that is really a compositing artefact.

## Phase 2 · Settings placards (§8.3) — done

Night Ops/Day Ops → **Dark mode** · Instrument Scale → **Text size** · Smooth Air →
**Reduce motion** · Plain Language → **Dyslexia-friendly font** · Turbulence →
**Haptics** · Point of No Return → **Delete account**.

**Lights Out is deleted**, not renamed: it suppressed "the pulsing red/green buttons in
Discussion", and after §4.5 there is no red or green left anywhere to suppress. Its state,
its persistence and its three props went with it.

## Found by the regression sweep: writes during render

`ChaptersPanel` called `progress.set()` **inside six `setState` updater functions**.
React runs updaters during render and runs them **twice** under StrictMode, so every one
of those was a state update on `UserProgressProvider` during another component's render,
executed twice. That is what the "Cannot update a component while rendering a different
component" warning was pointing at, and it means bookmarks, completions, quiz scores,
feedback, recents and chapter progress were each written twice per change.

All six now compute the next value, set it, and persist outside the updater. Zero console
errors on every route.

## Phase 2 · Delete list (§6.6) — done

- **Grain texture** — a `feTurbulence` overlay at 3.5% across the whole app. On OLED it
  reads as compression artefacts, not paper.
- **The fixed flight-progress dot strip** on the bottom of every screen, and the
  scroll-percentage tracking that was its only consumer.
- **Radar sweeps as card wallpaper** — `ModuleMotif` was exactly what §6.6 names:
  concentric circles with radial lines, `preserveAspectRatio="slice"` and positioned
  `right: -60px` so it clipped out of the card edge by design. §6.5 reserves decoration
  for the cheatline alone.
- **Card drop shadows** — `--shadow-1` is `none`. §6.1 puts elevation in lightness: dark
  UIs that drop-shadow look muddy, ones that step lightness look machined. `--shadow-2`
  survives for true overlays, which §6.1 allows above the two surface levels. Verified:
  zero non-inset drop shadows on any route.
- **Surface levels 3 and 4** never existed as tokens; `--elev-0/1/2` map to the three
  §3.6 surfaces.

### And the red/green I claimed was already gone

Deleting "Lights Out" was justified on the grounds that no red or green remained to
suppress. **That was wrong.** `DiscussPanel` still held the pulsing send buttons it
existed for — `rgba(229,72,77)` and `rgba(52,199,123)`, animating on a 1s cycle, which
§4.6 also rules out as reading like an alert rather than like life.

It was dead code: imported into App and never rendered, since the "discuss" tab is not in
NAV and no route resolves to it. §8.2 collapses the concept to Comments and channel
anyway, so the file is deleted and the claim is now true. `grep` for either colour
returns nothing.

## Phase 2 · Home (§9.1) — done

`Home.jsx` replaces `HubPage` on `/`. Four bands, and the hero's priority order is the
point: **the next action is the largest text on the page at 28px**, with the greeting at
14px above it. The old Deck had that ladder upside down — greeting largest, action a small
pill — which is exactly what §1.2's test catches.

`progressModel.js` holds the fill rules, pure and tested: completed → full, viewed or
answered → half, otherwise the hairline outline; completed wins over viewed; a missing
state object returns empty rather than throwing. `progressCaption` never renders a zero —
with nothing started it reads "4 chapters ahead of you" (§8.4).

**The segmented bar** (`SegmentedBar.jsx`) is the centrepiece. One segment per chapter, so
the count is read without a label, and it doubles as the chapter selector. Two
part-finished chapters at once is the normal state of studying and a single percentage
cannot express it — which is why the 25% radial was wrong for the model, not just plain.

**One dial** (`ScoreDial.jsx`), for score, with the pass mark as a literal redline —
§9.1.2's distinction is that a round dial answers "how close to a limit" and a bar answers
"where along a range". It is also the door to the Logbook, which is how the Logbook gets
out of the avatar menu.

### Verified

Greeting 14px · next action 28px · caption 14px, all sharing one left edge at 36px. Four
segments reading `full · half+current · empty · empty` against 1 of 4 complete. Caption
"1 of 4 chapters · 1 in progress". Touch targets: segment 44, parked row 56, door 60,
dial 48 — all at or above the §12 minimum. Contrast clean in night; day needed the
segment labels moved off `text-tertiary`.

The door renders `Ready Room · 3 on frequency` and warms to `--presence-panel` only when
someone is there. With nobody on frequency it is `bg-panel` and carries no count — §9.1
requires that it never advertise an empty room.

### The harness caught what the build could not, again

Deleting `DiscussPanel` broke the harness bundle, because its `main.jsx` still imported
it — root rendered empty with **no console output at all**, since a module-load failure
never reaches the console. `npm run build` passed throughout: the app never imported that
file, only the harness did. The answer was in `preview_logs`, not the console.

## Phase 2 · Debrief (§9.3.3) — done

The end of a quiz was `Light turbulence · Retake set` — a status word instead of a score,
and no way onward at all.

Now:

```
Debrief — JT.02
0 of 2 correct. The first one you missed trips most people — 140 others have too.
  [ Review the 2 you missed ]  [ Next: JT.03 → ]
Leave a note for the next pilot: ____
1 debrief note from other pilots ▾
```

The score is a number (§8.3). "Trips most people" is a real aggregate from
`question_miss_stats` over the question you actually missed, and it is true whether or not
anybody is online — §9.3.2's point about anonymous numbers. Review jumps back to that
question rather than restarting the set. The note posts to the chapter and the strip below
shows what other people left, which is the permanent artefact §9.3.3 is after.

v1's `CompletionTip` is deleted — the debrief note is the same idea, in the place the spec
puts it.

Copy fix caught by testing: with two misses it read "The one you missed trips most
people". It counts now.
