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
| 4 | Safety primitives | §9 | **done** — image scanning still owed; rate limits in 0006 |
| 5 | Flight Deck horizon | §7.2, §4 | **done** — see below |
| 6 | Social tab | §7.3, §8.2 | **done** |
| 7 | Ambient glow | §7.6, §2.8 | **done** |
| 8 | Completion tip + Call a wingman | §7.6, §7.7, §11 | **partial** — scheduler and notifications pending |
| 9 | Comms as chat | §7.8, §2.12 | **partial** — images and typing indicators pending |
| 10 | Livery picker + wash | §7.11, §2.11 | **done** |
| 11 | Instruments, Formation, desktop | §5, §7.9, §12 | **partial** — instruments and Formation done; desktop pending |

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

### Completed later in the session

Traffic now carries exactly the three types §7.3 names — **Formation, Logged, Ask** —
verified by enumerating the rendered kinds. The Formation item shows the chapter, the
faces of who is in it, then the Join button: faces before numbers.
`fetchOpenFormationsForModule` drops any formation with no members, because a
formation nobody is in is over whether or not anything closed it.

Still owed here: long-press → Fly together on a rail face.

## Step 7 — done

`StudyGlow.jsx` is the lighting. Mounted in the expanded chapter body, polling chapter
presence every 60s, excluding invisible users (§8.3) and anyone blocked in either
direction. No counter, no faces on the body — the count exists only in the screen-reader
label, which §13 requires and §7.6's "no counter" rule is about the visual.

Tapping opens the sheet with faces and "Say hi", which lands in that chapter's
Discussion composer. It had no handler at first, which would have shipped a button
that does nothing; the button now renders only when a handler exists.

### Two fixes the maths needed

**The gradient was not animatable.** `transition: background 2s` on a
`radial-gradient` does nothing. `--glow-h` and `--glow-a` are now registered with
`@property` so they interpolate and the gradient recomputes per frame.

**A hue lerp would have crossed the cold arc.** The circular mean resolves a *set* of
hues correctly, but the 2s transition between two computed hues is a separate lerp:
350 → 20 passes through 185. `unwrapHue()` maps the six liveries onto -10 → 88, one
contiguous arc, so no interpolation can leave it. The engine normalises -10 back to
350 — verified in the browser, the computed gradient reads `oklch(0.8 0.135 350 / 0.12)`.

Also: `computeGlow` sorted nothing before capping at four, so the cap depended on
whatever order the caller happened to pass. It now sorts by `last_seen` itself.

### Verified

- Alpha curve n=0..5: `0.03 0.052 0.074 0.096 0.118 0.12`.
- `circularMean(350, 20) = 5.0`, not 185.
- The fifth-oldest pilot does not move the hue, but `n` still counts them.
- Live in the chapter body: three pilots present rendered
  `oklch(0.8 0.135 55 / 0.096)` — exactly the n=3 row of the curve.
- The lighting layer computes `pointer-events: none`. Its first draft was a fixed
  56px strip across the viewport top, which would have swallowed every click on the
  app chrome behind it.

### Note on the spec's own table

§7.6 lists "four or more 0.120", but its formula gives `0.03 + 0.022×4 = 0.118`. The
formula is normative and is what is implemented; the table appears to round. The
difference is 0.002 of alpha.

### The body is now the §7.6 surface

Built later in the session. Opening a chapter enters a reader rather than expanding a
row: full-bleed, single column, no module header, no tab bar, a 2px cold-channel
hairline at the top edge, and the study material in the serif at 17/1.7.

What the body lost, because §7.6 forbids counters and rails in it:

- The **manifest** — a sidebar listing every chapter in the module.
- The **Quiz / Comments tab bar**. Comments stay reachable through the Discussion chip.
- The **copresence line** ("3 others are also here right now") — deleted outright, not
  moved. The glow says exactly this without a headcount, which is the entire argument
  of §7.6. The `here` state and `fetchChapterPresence` call that fed it went with it.
- The **Notebook and Discussion chips**, which carry counts. They moved to after the
  quiz, a §7.7 surface, rather than being removed — they own routes nothing else reaches.

### Verified by measurement

The prose measures **exactly 66 characters** — measured with a probe span in the
rendered font, not assumed from the CSS. Newsreader at 17px with a 28.9px line box
(1.7). Single column at 1280px wide. The hairline moved 0% → 33% on answering one of
three questions. Zero social elements in the reading surface. Back restores the list,
the tab bar and the module header.

### Two things the measurement caught

- **The prose column was 135px wide.** `.leg` is a two-column grid — rail, then
  chapter — and hiding the rail left the chapter sitting in the 34px rail column.
- **The measure resolved against the wrong font.** `ch` is the width of zero in the
  element's own font, and `max-width: 66ch` sat on a sans container while the prose
  rendered in the serif: 665px, which is 64 serif characters, not 66.

## Step 4 — done

`PilotSheet.jsx` is the one home for block, mute and report, opened from a seat in the
squadron roster and from a face in the glow sheet. The presence rail keeps tap → their
chapter, because §7.3 assigns that gesture and long-press to Fly together.

Block is a two-step with the symmetry stated plainly — "you disappear from each other"
— rather than copy that implies it only hides them from you. Report collects a reason
and says a person reads it. Red appears on exactly one control, the block confirm.

`BlockedList.jsx` sits in Settings. The block confirm tells people they can undo it
there, and until this existed nothing in the app called `unblockUser` or `unmuteUser` —
the sentence was false. Empty state names the action instead of reporting a zero.

Enforcement so far: `squadron_roster` filters blocks in both directions in SQL,
`fetchRecentPilots` filters them, and the study glow excludes them from `n`. The feed
and Comms do not filter yet.

### Verified

Walked the whole flow in the harness — menu → block confirm → confirmation, with the
target removed from the list on success. Rows are 56px. No console errors.

### Still owed from §9

- EXIF stripping, image scanning, and tap-to-reveal for a first-time sender. Needs an
  upload path, which does not exist yet.
- The human moderation queue. `reports` rows are written and nothing reads them.
- Rate limits on composer posts, Calls and Formation invites. These have to be enforced
  in Postgres to mean anything; a client-side guard would be decoration.
- Leaving a squadron and being reassigned by the fill ladder.

## Step 9 — partial

`Comms.jsx` is the channel. Avatars left, consecutive messages from one sender grouped,
day dividers, inline reactions, and every message carrying a 2px leading edge in its
sender's warm channel (§2.8 case 3). No threads, no upvotes, no accepted answers, no
karma — the three aviation-native additions are all that was added: a chapter chip, pin
to chapter, and filter to the chapter you're on.

The squadron livery paints the header via `data-livery` on the Comms container rather
than on the root, so the surface changes without repainting the rest of the cockpit
(§2.12 with §2.8).

`groupMessages` lives in `commsGrouping.js` with no client import so its rules are
testable on their own. Verified: two messages inside the five-minute window group, an
hour-later message from the same sender starts a new group, and a day boundary breaks a
group even when the two messages are two minutes apart. The first version of that test
used UTC midnight and passed for the wrong reason — dividers are local-day.

### Three fixed after seeing it render

- **The log read newest-first.** `fetchMessages` ordered descending and then reversed,
  which is only correct if the driver honours `.order()`. It now sorts by timestamp
  itself. A reversed channel is not subtly wrong, it is unreadable.
- **The pinned strip showed every message**, for the same reason — it now filters
  `pinned_to` in JS as well as in the query.
- **The header was invisible.** 8% of the warm channel over `--surface-1`, against a
  log that also uses `--surface-1`, is no header at all. Now 14% in oklab over
  `--surface-2`: L 0.318 against the log's 0.19.

### The app speaks first (§8.1)

`src/data/openers.js` holds one authored opener per chapter — twenty of them, each a
real question about that chapter's material rather than a template with a code
substituted in. Stored, not generated, so the same sentence is never invented twice
and a person can edit them.

Wingman renders with a system badge and a cold-channel mark, **never a tail**. A tail
would make the app look like a person, which §2.9 reserves for people and §8.1
explicitly rules out. Its message edge is the cold channel for the same reason.

The rule is `shouldSpeak()`, pure and tested: an empty channel speaks; anything inside
48 hours means it is not quiet — including a previous opener, which is what caps this
at one per channel per 48h without a separate counter; twenty human messages in a week
suppresses it and nineteen does not; system messages never count as human; messages
older than a week do not count at all; and a chapter with no authored opener stays
quiet rather than falling back to something generic.

**But the client does not decide.** The quiet check and the insert have to be one
statement — done client-side they race, and two people opening a quiet channel at the
same moment both post. `post_opener_if_quiet()` in migration 0006 does it under a
per-channel advisory lock. Until 0006 runs the call fails soft and no opener appears,
which is right: the feature simply is not live.

### Still owed from §7.8

- Pasteable images. Blocked on §9 — EXIF stripping, scanning, and tap-to-reveal have to
  exist before an upload path does.
- Typing indicators. Needs the realtime channel that step 3 is waiting on.

## Wiring

Everything built above is now reachable, which it was not when each step landed:

- **Comms** is a fourth module tab — Chapters · Library · Social · Comms.
- **Squadron** roster sits at the top of Social, above the presence rail.
- **First Flight** runs behind `FirstFlightGate`, alongside `UsernameGate`.

`FirstFlightGate` fails open in every uncertain case. `fetchProfile` returns null both
for "no row yet" and for "the query failed", and the second is the state until 0005
runs — a gate that could not tell them apart would hold every user in onboarding
waiting for a table that does not exist. `fetchProfileStatus` reports the difference,
and a failed read lets the user straight through.

### The IA is not what §6 asks for

§6 wants four root tabs — Deck · Social · Modules · You — with module tabs reduced to
Overview · Chapters · Comms. What exists is the current navigation with Comms added:
no root tab bar, Social still a module tab, Library still present. CLAUDE.md records
the absence of a global tab bar as a deliberate past decision, so reversing it is a
call to make explicitly rather than as a side effect of shipping Comms.

## Step 8 — partial

**Call a wingman** (`CallWingman.jsx`) sits under a quiz question and appears only once
you have actually answered, so it reads as "I'm stuck on this" rather than as a way past
the question. Never "Mayday" — the aviation flavour is one warm sweep going outward,
suppressed under `prefers-reduced-motion`.

**The completion tip** (`CompletionTip.jsx`) is §7.6's single prompt, shown only when at
least one visible squadron member is genuinely on the chapter, with invisible and blocked
users excluded from that count. With nobody there the completion screen stays quiet.
Verified: exactly one social element on the completion screen.

**The thumbs moved.** "Was this chapter helpful?" rendered next to a quiz you had not
started. §7.7 wants it after the last question, so it is now gated on completion.

### The backstop

`backstop.js` holds the §7.7 stage rules as a pure function, free of any client import.
The scheduler that fires them does not exist, but *who* gets nudged is a rule rather than
a schedule, and it is the part that goes wrong quietly.

Verified against a fixture: the 2h/12h/24h boundaries exactly; stage 1 squadron-only,
most-recently-active first, capped at 3; stage 2 widening so a non-squadron pilot who is
the most recently active of everyone comes first; stage 3 nudging nobody; at most once
per call and twice per day per user; and mutes excluded in both directions, with the
caller never nudged about their own call.

`callState()` derives stage 3 from the call's own age, so **the caller sees the
"nobody's picked this up yet — post it to Comms?" state whether or not a scheduler ever
runs**. A 26-hour-old call renders it today. That was the point of §7.7's "never let it
silently expire", and it should not have depended on cron.

### Still owed

- The scheduler itself, and §11's notification delivery with its caps and quiet window.
- Rate limits on Calls (§9) — Postgres-side, like the others.

## Step 11 — instruments done

**The speed-dial gauge is gone.** `N1Dial` had a needle, a tick ring and a hub. §5
deletes it in favour of a thin cold-channel arc, 2px, no ticks, no needle — so it is
now `ProgressArc`, an *indicator*. That matters: a view may hold one instrument, and
this was never the one worth spending it on. Its numeric readout stayed.

**The radar is real.** It used to hash the user id into an angle *and* a radius, so a
blip's distance from centre meant nothing at all. Now radial distance is how far ahead
or behind that person is in this module, centre is your own position, and the angle is
still hashed — arbitrary but stable, so someone keeps their bearing between visits.
Tapping a dot opens that person. `fetchModuleProgress` supplies real percentages from
`chapter_completions`; anyone with none is genuinely at 0, not missing.

It lives with the squadron roster: the roster says who, the scope says where. That
makes it the Squadron view's one instrument.

### Verified

With a squadron of three and my own progress at 1 of 4 chapters, the scope read
"3 in this module · you at 25%" and placed A. Nakamura (3/4) furthest out at "50%
ahead", M. Iqbal (2/4) halfway at "25% ahead", and K. Osei (1/4) exactly at centre,
"level with you". Each blip paints in its owner's livery. Ahead is a filled dot,
behind is an outlined ring — direction is not carried by colour alone (§13).

### Two bugs found by rendering it

- `<InstrumentStyles />` landed inside the not-ready early return rather than the main
  render, so the radar drew completely unstyled — black blips on no rings.
- A `.radar-blip { fill: var(--presence) }` rule from the decorative version was still
  in the sheet, later in source order, and won. The old sweep wedge and its animation
  went with it.

### Still owed

- **The desktop three-column** (§12). The phone bottom tab bar it depends on is the same
  IA change noted above, so this is blocked on that decision rather than on code.

## Step 11 — Formation done

`Formation.jsx` is the slim rail: each participant's tail and where they are relative
to you, and nothing else. No rank, no timer, no score. The headcount reads "2 flying",
not a position.

The wording lives in `formationRail.js`, free of any client import so it can be checked
directly — including a test asserting the phrasing never contains "behind", "lost",
"score", "rank", "last", or a time unit. Someone below you reads as "1 question back",
which states distance without implying failure. §7.9: nobody loses a Formation.

The cap is enforced in `joinFormation`, which refuses a seventh member rather than
accepting the row and hiding it behind a `slice()` in the rail. Leaving checks whether
anyone is left and ends the formation if not, so an abandoned one never lingers as a
live session nobody is in.

Leaving offers an optional note, which posts to Comms and pins itself to the chapter.

### Placement

The rail sits **around** the chapter body, never inside it — §7.9 keeps the
social-free rule for the body itself. Verified in the browser: zero tails and zero
rails inside the reading surface. The only things in there are the glow layer and its
tap affordance, both sanctioned by §7.6; the quiz and completion screen are §7.7
surfaces with their own rules.

### Verified

With two members present and my own attempt count at 1, the rail read "A. Nakamura —
2 questions ahead" (3 attempts) and "M. Iqbal — 1 question back" (0 attempts), wearing
the squadron's Carrier Deck livery, scoped to the container.

## Regression sweep

All 15 harness routes render clean — hub, chapters, social, comms, squadron, first,
tails, modulehub, settings, profile, progress, bookmarks, livery, pdf, discuss. Zero
console errors and zero uncaught exceptions on every one.

The sweep found one thing worth fixing: Traffic keyed completions as `c-${chapter_id}`,
assuming one completion row per chapter per user. A second row for the same chapter —
a retake, a race, anything not held down by a unique constraint — collided in React.
The log now keeps the most recent per chapter, which is also what it should have been
saying: a chapter is finished once.

## Migration 0006 — not yet run

`supabase/migrations/0006_openers_rate_limits_moderation.sql`. Idempotent, safe to
re-run, and independent of 0005 except that the opener function writes to
`comms_messages`.

- **`post_opener_if_quiet(mod, chap, opener)`** — §8.1's rule, atomic, under a
  per-channel advisory lock.
- **`rate_events` + `rate_limit_take(uid, kind, per_hour)`** — §9's rate limits, in
  Postgres, because a client-side guard is decoration. Comms now asks for a slot before
  sending, at 30 messages an hour; a refusal is shown as a plain line, not an error.
  With the function missing the client is allowed through rather than blocked.
- **`moderation_queue` view** — §9's human queue, joining a reported message to its body,
  author and channel, and carrying `waiting` and `past_target` so nobody has to work out
  whether a report has blown its 24-hour target.

Still owed from §9: EXIF stripping, image scanning, and tap-to-reveal for a first-time
sender — all blocked on there being an upload path at all.
