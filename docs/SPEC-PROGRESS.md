# Build progress against docs/SPEC.md

One §17 step per session. Update this file at the end of every session, before the
context runs out — it is the handoff between sessions.

## How to run a session

Do **not** paste the spec into a prompt. Say:

> Read docs/SPEC.md §<sections> and docs/SPEC-PROGRESS.md. Build step N. Stop when it
> is shippable, then commit and update SPEC-PROGRESS.md.

Read only the sections that step needs. §17 lists which.

## Status

| # | Step | Spec sections | State |
|---|---|---|---|
| 1 | Livery tokens + cheatline | §2 (all), §2.14 | **done** — see below |
| 2 | Auto-squadrons + fill ladder | §7.1, §10 | **done** — needs migration 0005 to place anyone |
| 3 | Presence as a data type | §8.3 | not started |
| 4 | Safety primitives | §9 | **data layer done** — UI pending |
| 5 | Flight Deck horizon | §7.2, §4 | **done** — see below |
| 6 | Social tab | §7.3, §8.2 | **partial** — rail + vocabulary done, Formation and On-your-wing pending |
| 7 | Ambient glow | §7.6, §2.8 | **maths done + verified** — wiring pending |
| 8 | Completion tip + Call a wingman | §7.6, §7.7, §11 | not started |
| 9 | Comms as chat | §7.8, §2.12 | not started |
| 10 | Livery picker + wash | §7.11, §2.11 | **done** |
| 11 | Instruments, Formation, desktop | §5, §7.9, §12 | not started |

## Step 1 — done

- `scripts/build-liveries.mjs` generates `src/styles/liveries.css` from the §2.3
  formulas. Hue is the only input. Run `node scripts/build-liveries.mjs` after any
  change; never edit the CSS by hand.
- The generator's sRGB fallbacks were cross-checked against the §2.4 published table:
  **0/255 maximum deviation across all 24 channel values**, which verifies the oklch
  implementation rather than assuming it.
- Root carries `data-livery` / `data-variant`. Day/Night auto-switches on local time
  with a settings pin overriding (§2.10).
- The cheatline ships as `.app::before` — warm channel, 40vh, 6% alpha (§2.6).
- Existing component token names (`--accent`, `--panel`, `--text` …) are now **aliases**
  onto livery tokens in one block in App.jsx: cold for machine, warm for people (§2.2).
  This repaints every screen without rewriting each component. The old ACCENT_COLORS
  livery lookup is removed.

### Still owed on step 1

- The alias block is a bridge, not the destination. §18 wants components referencing
  livery tokens directly; each later step should replace aliases in the screens it
  touches rather than leaving the shim permanently.
- The cheatline must be suppressed on the chapter body (§7.6) — not yet done, because
  the chapter body is restructured in a later step.
- `--r-sm/md/lg` were folded to spec radii (12/16/16); sheets at 24 arrive with §7.6.

## Carried over from the previous product

See `NOTES.md` for decisions, reversals, and known gaps predating this spec. The spec
supersedes NOTES.md wherever they disagree — in particular it replaces the entire accent
system, the font pairing, and the tab structure.

## Blocked on inputs, not effort

These cannot be built without something arriving from outside the repo:

- ~~Font files~~ **resolved.** All three self-hosted as woff2 in `public/fonts` (297KB
  total, latin subsets), declared in `src/styles/fonts.css`. Fraunces, Inter, JetBrains
  and Space Grotesk are purged from the codebase per §3.
- **Presence infrastructure.** §8.3 mandates SSE + in-memory/Redis with a 5-minute TTL
  and forbids writing presence to the primary database. The current implementation is a
  Postgres `presence` table, which the spec disallows. Needs a Redis instance and an SSE
  endpoint — Supabase alone does not satisfy this.
- **Image scanning + moderation queue.** §9 requires scanning before display and a human
  review queue with a 24h first-response target. That is a service dependency and an
  operational commitment, not just code.
- **Cohort intake.** §7.1's weekly-batch signup is an ops decision.

## Spec discrepancy found

§7.6 gives the glow alpha as `clamp(0.03 + 0.022n, 0.03, 0.12)` and then lists the
worked example "four or more 0.120". The formula yields **0.118** at n=4; the clamp only
bites at n=5. The implementation follows the formula, since it is the normative rule and
the difference is imperceptible, but the worked example in the spec is off by 0.002.

## Conflicts to resolve before starting

- §8.3 forbids persisting presence; migration 0001 created a `presence` table. Step 3
  must migrate off it and drop the table.
- §3 bans Fraunces; it is currently the display face from the previous pass.
- §6 specifies four root tabs (Deck · Social · Modules · You); the app currently has no
  root tab bar at all, having removed it in a prior pass.

## Step 5 — done

`src/components/FlightDeck.jsx` is the horizon. Above the cheatline: greeting, status
line, the altimeter tape, one card. Below it, Traffic. Descending compresses your own
flight into a single line.

Wired into `HubPage.jsx`, replacing the old header + METAR + hero block. Three things
that used to ride the hero moved rather than vanished, because deleting them would have
stranded the routes they own:

- The smart suggestion and the squawked-bookmarks count are now rows in
  `.deck-shortcuts`, below the cheatline. §7.2 allows one instrument above it; these
  were the fourth and fifth.
- The N1 quiz-accuracy dial and the checklist tile are gone. Accuracy has no home yet —
  it belongs to step 11's instrument pass, not here.

Fixed while wiring: `startFirstFlight` read `CHAPTERS[0]` from the global array while
naming the JT module separately, so a reordered `data.js` would have opened another
module's chapter under JT's name. It now reads `chaptersForModule()`, per CLAUDE.md.

### Verified

- The condensed strip is `position: fixed`, not sticky. As sticky it stayed in flow at
  `opacity: 0` and reserved a 68px band that pushed the seam down.
- Strip button 44px tall, primary card 114px — both clear the §12 target minimum.
- `backdrop-filter: blur(12px)` present; §4 permits it on this element only.
- Tape label sits inside its column (9px of slack) instead of overflowing it.

### Not verified

The scroll-linked condense itself. The verification harness runs in a hidden tab
(`document.hidden === true`, 0 rAF frames in 800ms), and a hidden page never runs the
"update the rendering" step, so IntersectionObserver never delivers and CSS transitions
never advance. The class-driven half was verified by toggling `is-condensed` by hand:
`pointer-events` swaps on both the strip and the flight panel. The IO trigger and the
240ms transitions have not been seen running.

## Harness

`.claude/launch.json` (gitignored) starts the stubbed preview on :5199. Its `vars.css`
is generated from App.jsx's own `.app` block by the snippet in this step's history —
regenerate it after changing tokens, or the harness silently drifts. `index.html` must
carry `data-livery` and `data-variant="night"` (**not** `"dark"` — the generator emits
`day`/`night`), otherwise every livery token resolves unset and the page renders black
on black.

## Step 2 — roster done

`Tail.jsx` is the identity mark from §2.9: hue + marking + initial, one component
used at every size. Below 16px the initial drops and the marking remains, so an 8px
presence dot still carries identity without relying on colour.

`Squadron.jsx` renders the roster. Real members at full size; open seats as outlined
silhouettes labelled "open"; the Forming line when the count is under ten. It never
pads the grid with anyone who does not exist.

### Fixed while building

The tail first painted itself with `hsl(var(--tail-h) 78% 62%)`. The liveries are
authored in **oklch**, and the same hue number read as an HSL hue is a different
colour: Dawn Patrol came out yellow-green instead of `#FFA564` amber. The generator
now emits a root-scoped `--tail-<livery>` / `--tail-<livery>-bg` palette per variant,
and the tail reads those. One source of colour, and a roster can show six liveries at
once under one root. The generator's own check still reports 0/255 deviation.

### Verified in the harness

Four pilots sharing Dawn Patrol's hue took **solid, double, dashed, notched** in join
order. Contrail (15° away, outside the 13° threshold) correctly stayed solid rather
than consuming a marking. All six liveries resolve to their own oklch tokens.

### Onboarding

`FirstFlight.jsx` is §7.1's three screens, then the livery picker, then the Deck.
Placement happens after screen 3, because the fill ladder needs both module and
study-time. Both writes are best-effort — a failed placement drops you on the Deck
rather than stranding you in onboarding, and the next entry retries.

Screen 1 reads real pilots through `fetchRecentPilots`. With none yet it says
"You're early. Pick your module and we'll put the next pilots who arrive on your
wing." — a next action, no zero, and nobody invented (§8.1, §10).

Verified by walking the whole flow in the harness: five modules each showing **4**
chapters (`chaptersForModule`, not the global 20), Continue disabled until each
question is answered, step dots tracking, and the picker repainting the root on
select. Locked liveries are `disabled` and carry their unlock condition as their
label instead of a bare padlock.

Fixed while wiring: `LiveryPicker` calls `onSelect(id)` unconditionally, so the
first render — `<LiveryPicker />` with no props — would have thrown on any click.

## Step 6 — partial

`PresenceStrip.jsx` is §7.3's rail: each face wears its owner's tail, with a mono
chapter code beneath. It replaces the comma-joined sentence Social used to open with
("A, B and C studying this module now"), which put names before faces and could not
show position at all.

Liveries come from `pilot_profiles` via a new `fetchProfiles`. Until migration 0005
runs, every profile is missing and every tail falls back to Dawn Patrol — the markings
still separate them, which is the point of §2.9 not relying on colour.

Traffic now uses the spec's vocabulary: `Completed` and `Debrief` both became
**Logged**, and `Thread` became **Ask**. Composer copy rotates through §7.3's three
lines, fixed at mount so it cannot change under someone mid-sentence; the middle line
names a chapter someone is genuinely on and is dropped when nobody is flying.

Hardened while building: the rail resolved chapter codes against the global `CHAPTERS`
array. The harness surfaced it immediately — a pilot on AERO.01 printed that code
inside JT's rail. It now resolves through `chaptersForModule()` when given a module,
and falls back to global only for a cross-module rail. Same bug class as the chapter
list and the Library, per CLAUDE.md.

### Still owed

- **Formation** as the third Traffic type — needs the `formations` table from 0005.
- **"On your wing"** (§8.2) — the five-rung ranking is written down but nothing
  computes it yet.
- Long-press → Fly together on a rail face.
