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
| 2 | Chapter: one rendering, three tabs (§9.3) | **done** |
| 2 | Quiz (§9.3.2, §4.5) | **done** — all 42 questions have per-option explanations |
| 2 | Debrief (§9.3.3) | **done** |
| 2 | Naming + placards (§8) | **done** |
| 2 | Delete list (§6.6) | **done** |
| 3 | Mono ramp + liveries (§3.4) | **done** |
| 3 | Presence light & motion (§4) | **partial** — motion budget enforced; breath and arrivals need a live channel |
| 3 | Surfaces, panelling, glow (§6) | **done** |
| 2 | Logbook (§9.5) | **done** |
| 4 | Comments as question-as-atom (§9.3.4) | **done** |
| 4 | Squawk bridge (§9.4.2) | **done** |
| 4 | Ready Room (§9.4) | **done** |
| 4 | Teams + complementary matching | **done** |
| 4 | Verified tier + notifications (§11, §9.4.5) | **done** |

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

## Phase 2 · Quiz (§9.3.2) — done

### Explanations on every option

The product had **42 questions and zero explanations of any kind** — §9.3.2 calls this
the single biggest study gap and it was literal.

Authored per-option explanations for all **10 JT questions, 40 in total**, and every one
says *why* an option is wrong, not that it is: A on the combustion-chamber question
explains that liner cooling is real but is a consequence of burning fuel there rather
than the purpose; D explains that the diffuser does slow the air, upstream, and that
slowing it is not the point. Knowing why B is wrong is the study.

They render only after you answer, and they render on options you did not pick.

**The other four modules are deliberately not authored.** §10 says launch into one
cohort and one module, and §11 says a confident, incorrect explanation of engine
behaviour is worse than none — so PROP, AERO, NAV and WX wait for someone who can sign
off on the content. The UI degrades to nothing when `explain` is absent.

### Also done

- **Keyboard**: 1–4 or A–D to answer, Enter to continue, surfaced in the quiz rather than
  footnoted at the bottom of Preferences. Ignores modifier keys and typing in a field.
- **Ask about this →** on a miss, carrying the question into the chapter's Comments.
- **"140 pilots have also missed this one"** kept, but repainted: it was presence-coloured
  text on a presence-coloured panel.

## Phase 2 · The sterile cockpit (§9.3.5, §1.3)

§9.3.5 sets a hard limit: on the academic side the entire social budget is the Comments
tab and anonymous aggregates. Two v1 features broke it and are removed from the chapter:

- **Call a wingman** on the quiz — §1.3's sterile cockpit rules out anything non-essential
  during a question.
- **The Formation rail** around the chapter body — §9.3.5 names formation cards
  explicitly.

Verified on `/m/jt/ch2`: zero formation cards, wingman prompts, squadron seats, presence
rails or avatars. What remains is the glow, which §7.6 sanctions as lighting rather than
an element.

### §9.3.1 removals

"Recently viewed" chips and "Tap a chapter below to begin ↓" both sat **above** the
content, which §9.3.1 forbids outright. And "Trouble loading? Open on YouTube directly"
was shown before any trouble could have occurred; it now appears once the video has
actually been started.

The reader's first three visible things are now the chapter code, the chapter title, and
the video.

## Phase 2 · Chapter tabs (§9.3) — done

**Brief · Quiz · Comments**, exclusive, and the tab lives in the URL — which is the
payoff for Phase 1's routing. `/m/jt/ch2/quiz` and `/m/jt/ch2/comments` are real,
shareable links, which is exactly the growth loop §10 describes: "look at question 3 on
this page".

Verified all three: Brief shows video and material and hides the quiz; Quiz hides the
reading surface; Comments hides both.

## Phase 2 · Naming (§8.2) — done

| Concept | Was | Now |
|---|---|---|
| Progress page | "Progress" in the menu, "Logbook" as the title | **Logbook** |
| Bio field | also labelled "Logbook" | **Bio** |
| Saved questions | Bookmarks · My Bookmarks · "flight bag" · "stow" · "squawked" | **Saved** |
| Counting | `0/4 chapters` · `1 of 4 logged` · `25%` · `1/4 complete` | **1 of 4 chapters** |

"Squawked" was the sharpest collision: §9.4.2 gives **squawk** real semantics as the
help-request mechanic (7600 / 7700), so using the same word for a starred question is
precisely what the glossary exists to prevent.

### HubPage is deleted

`Home` replaced it on `/`, leaving it rendered by nothing. It carried the last of the
Begin / Enroll / Joining… CTAs — which means **§14 bug 5** (Begin on an enrolled module
showing "Joining…" for two seconds then reverting with no navigation) is resolved by the
screen no longer existing. §9.1 has no enrollment concept: a module is active or parked,
and §9.1.4 makes switching one tap with no confirmation.

## Phase 3 · Liveries (§3.4) — done

### A livery that painted nothing

v2 replaces **Sunset Approach** with **Altimeter**, and the picker was never updated. The
token block is selected by `[data-livery="…"]`, so anyone stored on `sunset-approach`
would have resolved **no tokens at all** — not a fallback, not a wrong colour, nothing.

`src/lib/liveries.js` is now the single source, and a test asserts it against
`scripts/build-tokens.mjs` on **ids, base hue, chroma multiplier and presence hue** — not
just the names. A retired or unknown id falls back to Dawn Patrol before it can reach the
DOM, checked at hydration and at every selection point.

### The picker is a ramp gallery

§3.4: "A single dot cannot honestly show the difference between two monochromes." Each
row is seven steps of that livery's own ramp, dark to light, ending in its presence
swatch — the soul delta, visible.

Verified: six rows, four locked at zero modules, Contrail's ramp tinted at hue 240 and
Dawn Patrol's at 60, presence swatches at 70 and 45 respectively.

It lives in Settings now (§3.4), and `PilotSettings` no longer carries its own inline
copy of the list.

### The harness broke the same way twice

Deleting `HubPage` and changing `LiveryPicker`'s exports each took the harness bundle down
— **`npm run build` passed both times**, because the app no longer imported those things
and only the harness did. Both showed as an empty root with no console output; both were
only legible in `preview_logs`.

Worth stating as a rule: **after deleting or re-exporting anything, grep the harness too.**

## §12 accessibility

Audited the concrete items §12 names.

- **Home had zero headings** — no `h1` through `h6` on the whole page, so a screen reader
  had no structure at all. The module identity is the `h1` now. Level is structure, not
  size: §5's scale and §3.7's value ramp are what express visual rank, which is exactly
  why a 14px `h1` is fine.
- **Nothing was a tablist.** The chapter tabs and the module tabs were bare buttons.
  Both are `role="tablist"` with `role="tab"`, `aria-selected`, roving `tabIndex`, and the
  chapter body is the `tabpanel` they control.
- **Settings section headers were `div`s** — §12 says so explicitly. They are `h2` now.
- **Heading levels skipped** from `h1` straight to `h4` in the chapter body. The reader
  has an `h1` for the chapter and the prose sections are `h2`.

### And §9.3's "collapse to one" was still incomplete

`/m/jt` was rendering an accordion body for the restored `pw-last-chapter` — a second
chapter rendering, on the module page, which is the exact bug §14 #9 describes. The body
now exists only inside the reader. `/m/jt` is four chapter rows and one heading.

Focus rings survive the monochrome change: they are `var(--accent)`, which resolves to
`accent-interactive` — a value step, not a hue, as §12 requires.

## §9.6 Settings

**The privacy contradiction is resolved.** The page said *"Progress is saved locally on
this device only — nothing is sent anywhere"* while also offering an account, an email
change, a username shown to other people, and class-based matching. Both could not be
true, and §9.6 is right that ambiguity there suppresses participation more than bad UI
does. It now says three things plainly:

- **Shared with other pilots:** username, livery, and what chapter you are on while
  studying. Nothing else.
- **Private to you:** scores, saved questions, notes, email.
- **Stored on our servers,** not only on this device — that is how progress follows you
  and how anyone can answer your questions. With a pointer to Fly invisible.

**The Features panel does not ship.** §9.6 says delete it; it is a test surface, so it is
behind the same admin check as everything else internal. `/settings` is titled Settings
and opens on the livery gallery and the pilot controls.

## Contrast, current

All routes, both variants, six liveries: **8 failures**, all in Comms in day, all
`text-tertiary` at 3.01 on genuine metadata — a section header, a day divider, message
timestamps. §12 exempts tertiary for exactly this.

## Phase 3 · Motion budget (§4.6)

Audited before changing anything: **12 distinct transition durations** and a dozen
independent animations, including three infinite loops.

§4.6 allows five durations and says "nothing else animates. Not tab switches, not page
transitions." Now, measured across every route: **one transition duration, 180ms**, and
one animation — the chapter opening, also 180ms.

Removed:

- **Page transitions** (`taxiIn` on every `<main>`), which §4.6 names directly.
- **Cloud drift** at 60s / 75s / 90s, infinite — ambient decoration §6.6 also rules out.
- **The propeller spin** and **windsock wave**, both infinite loops. The propeller was
  also `fill: #FFFFFF` with an accent drop-shadow, neither of which survives §3.
- **`legPulse` at 3.4s** on the current chapter marker. §4.2 reserves a breath for
  presence and sets it at 4000ms precisely because that reads as alive rather than as an
  alert — and a chapter marker is not a person.

Still owed from §4: the breath itself, and the 600ms-in / 2000ms-out asymmetry on
arrival and departure. Both need a live presence channel to have anything to react to,
which is Phase 3's remaining dependency.

## Cleanup pass

**Lint is clean: 0 errors, 0 warnings.** The 21 warnings were not cosmetic — several
were half-finished deletions still doing work.

- **`ModuleHub` fired three network requests on every module page load** — module
  presence, threads, and wingmen — and rendered none of the results. `wingmen` existed
  only to build a `wingIds` set that nothing read. Gone, with the four imports and the
  `activityLine` helper that only fed it.
- **`App` fetched enrollments** into state nothing read, and carried `shakeTab` and
  `socialPrefs` that nothing used.
- **`ModuleSocial` fetched threads** into state nothing read.
- Six orphaned modules deleted: `CallWingman`, `Dial`, `FlightDeck`, `Formation`,
  `instrumentIcons`, `lib/enrollments`. Phase 4 rewrites Formation and the squawk to
  §9.4.2/§9.4.3's shapes anyway — the old ones contradict the spec, so keeping them as
  a starting point would have been worse than starting clean.

### §12's hit targets were leaking in eleven places

"Minimum hit target 44px everywhere" was failing on the brand, the streak pill, the
avatar, module tabs, search fields, the bookmark star, chips, the settings back button,
and most of the profile form — between **17px and 42px**. Patching them individually kept
missing more, so it is one global rule with an explicit `.is-inline` opt-out. Verified
across seven routes at phone width: nothing under 44px.

### The crash screen

`ErrorBoundary` hardcodes its colours, which is right — it renders when something has
already failed, possibly the token layer itself, so it must not depend on anything the
app loads. But its heading was `#E08585`. §15 allows red only for a destructive
confirmation, and a crash is not one; the point is to be legible and calm. It is
neutral now, and the reasoning is written next to it so nobody "fixes" it into tokens.

### Contrast, final

All routes, both variants: **8 failures**, all in Comms in day, all `text-tertiary` at
3.01 on a section header, a day divider, and message timestamps. §12 exempts tertiary for
exactly this, and every essential use of it was moved to `text-secondary` earlier.

## §6.4 / §6.5 — the cheatline never rendered

Scanning for CSS variables that are referenced but never defined turned up `--cheatline`:
the v1 generator emitted it and the v2 rewrite dropped it.

But the token was the smaller half of the problem. **There were two `.app::before` rules**,
and the second silently overrode the first — so even when the token existed, the cheatline
never drew. What actually rendered was a 1100px radial glow **centred behind the content**,
which §6.4 rules out twice over: "one ambient source per screen, off-canvas… never centred
behind content", and panels and chrome do not glow at all.

Now:

- **The cheatline** is one 2px rule at the top of the app, in the livery's presence
  temperature. Verified per livery and per variant: Dawn Patrol night hue 45, Contrail
  night hue 70, Aurora day hue 20 at the lighter day lightness.
- **One ambient source**, off-canvas at the top-left corner, tracking the livery and
  inverting for day (L .31 night → .96 day).

Also cleaned out while there: `h1–h4` still carried `font-variation-settings: "opsz" 40,
"SOFT" 40` — Fraunces axes, and Fraunces was purged in v1.

### Two unlabelled inputs

The profile photo file input and the bio textarea had no accessible name. Both labelled.

## §6.3 — the radius scale

Twelve distinct radii were in use. §6.3 allows four: **panel 12 · control 8 · chip 6 ·
avatar full**, with nested corners calculated rather than guessed.

`--r-sm` was doing control duty at **12px**, which is why nested corners never looked
calculated — a 12px control inside a 12px panel reads as a mistake at every size. The
tokens are `--r-panel` / `--r-control` / `--r-chip` now, with the old names kept as
aliases, and 31 raw values snapped to the scale.

Verified: every rendered radius on every route is one of the four, plus 2px on the
segmented bar's fills, which are hairlines rather than corners.

## §9.5 Logbook

§9.5 wants the Logbook to hold what Home is not allowed to: accuracy over time, the
weakest module, questions missed twice, and chapters due for another pass. A 14-cell
strip with two filled cells is, as the spec says, a weak payoff for the most motivating
page in a study app.

`lib/logbook.js` holds all four as pure functions, tested:

- **Missed twice** counts only incorrect attempts, needs two or more, and orders
  most-missed first. A single miss does not qualify and a correct answer never counts.
- **Weakest module** returns `null` when fewer than two modules have been attempted —
  a module you have never opened is not your weakest, it is simply ahead of you.
- **Due for another pass** flags stale *or* shaky, and names which: "17 days ago" versus
  "scraped it at 55%".
- **Accuracy over time** omits days with no attempts rather than recording them as zero.
  A day you did not study is not a day you got everything wrong.

The test caught one thing worth keeping: dropping an unknown chapter can leave a single
module, and a single module has no weakest — so `null` is the right answer, and the
assertion was wrong rather than the function.

## §9.3.2 — all 42 questions now carry explanations

The remaining 32 questions across PROP, AERO, NAV and WX are authored: **128 more
explanations, 168 in total**, one per option, every one saying *why* rather than *that*.

Some are there specifically to catch the misconception the question is built around:

- **AERO.03** — "only at low airspeed" gets told plainly that an accelerated stall in a
  steep turn happens well above cruise speed.
- **AERO.01** — "lift exceeding weight" in a climb is named as the common misconception,
  because lift is in fact slightly *less* than weight on an inclined flight path.
- **NAV.02** — "inbound to the station" is explained as the reciprocal of a radial, which
  is the classic error.
- **PROP.02** — "ignition before the spark" is separated from detonation as pre-ignition,
  a different fault with a different cause.
- **WX.03** — the mature stage is explained as the worst *because* updraft and downdraft
  sit side by side, and noted as looking less dramatic from outside than the cumulus stage
  that preceded it.

### A check, so this cannot drift

`npm run check:content` validates `src/data.js`: every question has an `explain` array,
its length **matches the options array**, the answer index is in range, no explanation is
thin, unpunctuated or duplicated within a question, no question id repeats, and takeaway
counts stay inside §9.3.1's four-to-six.

A length mismatch would silently attach the wrong reasoning to the wrong answer, which
under §11 is a safety problem rather than a formatting one. `npm run check` now runs
lint, content and build together.

### Still wanted before launch

These are written to the standard of someone who knows the material, not signed off by an
instructor. §11 asks for a **visually distinct verified tier from day one**, and that tier
does not exist yet — when it does, this content is what it should be applied to first.

## Phase 4

§15 says do not start Phase 4 without §10. Of §10's five points, the two that are code
were done first: **every question now carries a real explanation** (the seed), and
**a chapter link is a real URL** (the invite). The remaining three — one cohort, one
module, a weekly ritual — are operational, and the per-module switch that guards them is
built.

### §9.3.4 — the atom is a question

`lib/questions.js`, pure and tested. A message can be marked a question; a reply can be
marked as answering it; answered questions collapse into a strip at the top and chatter
flows past below. Verified: a reply *or* a `resolved_at` both count as answered, an
answer is never counted as chatter, and an empty feed stays empty.

`ChapterComments` is rebuilt around it — chat-shaped and live, but in §9.3.4's calmer
register: no haptics, no arrival animation, muted rather than warm. A conversation
happening in a library.

### §9.4.2 — squawk

Real semantics: **7600** for "I've read this three times and I don't get it", **7700** for
"checkride Thursday and I'm lost". A question left unanswered for three hours surfaces in
the Ready Room, and 7700 outranks age in the ordering. Verified: under three hours it
stays in the chapter, and an answered question never becomes a squawk.

### §9.4 — the Ready Room

Four bands in the order the door was opened for: **Now · Open squawks · Your crew ·
Channels**. Present tense only.

Open squawks is the band that matters — §9.4 calls it the room's purpose, "a permanent
supply of ways to be useful, and the reason it is never empty". When there genuinely is
nothing waiting, it says what puts something there rather than reporting a zero.

Matching is **complementary, not similar** (§9.4). Two people stuck on the same thing have
no reason to talk, so a pair with similar strengths is filtered out entirely rather than
ranked low — verified in the test. A mutual trade outranks a one-way favour, and the
reason shown never contains a number: "You're ahead on JT, they're ahead on NAV".

### §10's guard is built

`module_social` turns a channel on per module. With the table absent every channel shows;
with it present only enabled ones do. "A module with no social surface is fine; a module
with a visibly abandoned one is not."

### Found while testing

`fetchMyTeams` returned **one row per membership**, so a team appeared once for every
member it had — a duplicate React key and a duplicated card. Teams, team members and
presence all dedupe explicitly now rather than trusting a query filter, which is the third
time that assumption has bitten in this codebase.

## §2.3 / §9.2 — the IA, finally

This was blocked from the start: §9.2 moves Social and Comms off the module page and
§2.3 wants a Ready Room destination, and neither could happen until the Ready Room
existed. It does now.

- **Module tabs are Chapters · Library.** `ModuleSocial` is deleted — its presence rail,
  traffic feed and on-your-wing are all superseded by the Ready Room's Now, Squawks and
  Your crew bands.
- **Four persistent destinations**: Study · Modules · Logbook · Ready Room, with a `<nav>`
  landmark, verified present on every route with the right one marked current. §12 puts
  it at the bottom on phone with Study and Ready Room as the thumb poles — the §2 split
  made physical.
- **`/ready/:module`** is the room filtered, with that module's channel inline. §9.4 band
  four.
- **A Modules page** at `/modules`, using the same segmented bar Home uses. Rows, not
  cards — §9.1.3 removed the horizontal card rail deliberately.

The Ready Room item warms when people are on frequency and is neutral when nobody is
(§4.4), so the door never advertises an empty room.

### Eight more orphans, and a gap one of them exposed

`OnYourWing`, `PresenceStrip`, `Squadron`, `Thread`, `lib/calls`, `lib/comments`,
`lib/formation`, `lib/formationRail` — all superseded. `Squadron` in particular was the
twelve-seat grid §9.4.3 calls "the most demoralising surface in the product".

Deleting `lib/calls` exposed a real gap: migration 0007 had the squawk code on the
`calls` table, joined into the `open_squawks` view — and **nothing creates a call any
more**, so every code would have been null. The code belongs on the question itself, and
the composer offers 7600 and 7700 with plain language beside them, only while you are
actually asking.

## §11 verified tier · §9.4.5 notifications · §2.3 avatar menu

**Verified.** §11 says a confident, upvoted, incorrect explanation of compressor stall
recovery is worse than no explanation at all. The status ladder is the moderation model:
`canVerify()` gates the control on CFI standing, and a verified answer renders as
different in kind — inverted against the accent, not merely louder.

This is the tier the 168 authored explanations should carry first. They are written to
the standard of someone who knows the material; they are not instructor-signed, and the
mechanism for saying so now exists.

**Notifications.** §9.4.5's default is replies to you, your teams, and answers to your
questions — nothing else, with an opt-in to a whole chapter and an off switch. §11 rules
out streak warnings, countdowns and re-engagement nags, and the setting says so in plain
words rather than leaving it implied.

**The avatar menu** is down to exactly three rows — profile, Settings, Sign out — which
§2.3 asks for. Logbook is a root destination now and Saved is reachable from Settings.

## Phase 4 is complete

Every step in §15 is built. What remains is not implementation:

- **§4's presence breath** — needs the Redis + SSE transport §8.3 specifies. The motion
  budget around it is enforced and the warm/cool tokens are generated.
- **§10's operational half** — one cohort, one module, a weekly ritual. `module_social`
  is the switch; which module to turn on is a decision.
- **Migrations 0005, 0006, 0007** — 0007 is new and everything in Phase 4 is inert
  without it.

## §9.4.3 Formation, rebuilt

v1's Formation was deleted with `ModuleSocial` because it contradicted the spec: it was
persistent, it lived on the chapter body, and it rendered when nobody was in it. §9.4.3
wants the opposite — ephemeral, 2–4 pilots, one chapter, one session, either now or
scheduled, dying when it empties.

`lib/formation.js` makes **"never render a formation nobody is in" a property of the
data**, not a `.filter()` each surface has to remember. `visibleFormations()` drops the
empty, the ended, the abandoned (everyone has a `left_at`), and the stale — one that
started hours ago and never reached two.

Verified: of eight fixtures only four survive, and a scheduled one with a single sign-up
still shows because it has not started yet. The label never renders a zero — one person
waiting reads "Waiting for one more".

It sits under **Starting**, in §9.4's first band, which asks for "who's on frequency,
which module, *what's starting*". Confirmed live: three formations in the fixture, one
rendered, because the other two had no members.

**Not built:** §9.4.3's simultaneous quiz run with answers revealed once everyone locks
in. That needs the same live channel §8.3 is waiting on — there is no way to know when
everyone has locked in without one.
