# Step 1 — build notes

What was ported, what is wired to real data, and what is still a placeholder.

## Where the code lives

| File | What it is |
|---|---|
| `src/lib/liveryEngine.js` | The rig. `LIVERIES`, `LIGHT`, `hueAt`/`chromaAt`/`ramp`, `keyImg`/`fillImg`, `auroraImg`, the seeded star tiles, `CREAM`, and `deckVars(livery, variant)` which returns every custom property the deck needs. Pure — no React, no DOM. |
| `src/lib/flightProfile.js` | `profileSVG()` — the climb-cruise-descent, the notches, the formation marks, the aircraft. Pure. |
| `src/lib/greeting.js` | §10 in full: bands, shuffle bag, two-minute dwell, band punch-through, adjacency, arrival/continuation. Pure. |
| `src/components/Home.jsx` | The deck itself, plus the whole stylesheet. |
| `docs/reference/social-dial.html` | The reference the layout was ported from. |

`livery-engine.html` is not checked in — it was not on disk. Drop it in
`docs/reference/` when convenient; the numbers it carries are all reproduced in
`STEP-1-HOME-PAGE.md` §2–§5 and in `src/lib/liveryEngine.js`.

## Where the two reference files disagreed

`social-dial.html` is the **finished home page**, so its livery table wins: it is the one
carrying `beacon.panelT`/`beacon.glass`, `tarmac.keyAbs`/`keyC`, and `fillSize:74 fillX:16`.
It also matches the brief's §3 table exactly. `livery-engine.html` supplied the things
social-dial does not have: the glitter star tile, the `.mmeta` line on module cards, the
`@container (min-width:330px)` step, the notch-crowding rule, the phase vocabulary, and the
chromatic-edge and hued-shadow token formulas.

Two places where the brief's prose and the reference code disagree, and the code won:

- §7 says the dashed route shows at rest. Both reference files put it inside the `reveal`
  group, so at rest a card shows the *travelled* line in `t2` plus the unlit notches, and the
  dashed remainder appears on hover. Ported as written.
- §12 says no gradient fades to `transparent`. The radar sweep's `conic-gradient` uses
  `transparent` as a hard stop, not a falloff, in both reference files. Kept. The rail's
  right-edge fade, which *is* a falloff, was changed to `color-mix(… transparent 100%)` so it
  fades to the ground colour instead.

## Wired to real data

- **Greeting** — §10 engine, device-local bag in `localStorage` under `pw-greeting`.
- **Last flown** — `pw-last-flown`.
- **Hero card** — `nextChapter()` on the active module.
- **Attitude** — mean of `pw-quiz-scores`; the horizon pitches with the score.
- **Flight bag** — `pw-bookmarks` count.
- **Checklist** — one lamp per chapter in the active module, lit on completion.
- **Hobbs** — hours of briefing logged, summed from the `duration` of every chapter opened.
- **Radar** — `fetchAllPresence()`. Blip positions come off a seeded LCG so they hold still.
- **Module rail** — every module, `pr = (full + half/2) / total`.
- **Formation** — `fetchModulePresence()`. A crewmate's mark is the chapter their presence row
  carries, which is position and never pace. Someone in the module but not yet in a chapter
  reads "at the gate".
- **Wingman** — `fetchPartnerSuggestions()`.
- **Frequency** — `fetchMessages()`, last three, read-only; the compose line opens the channel.

## Placeholders, marked in the source

- `TODO(step-2)` — the hero's resume position. There is no stored playback offset, so the card
  says "Pick up where you left off" / "N:NN of briefing ahead of you" instead of "6:12".
- `TODO(step-4)` — the livery picker still writes the v2 ids, so `engineLivery()` maps each
  stored id onto its nearest engine livery: `dawn-patrol→amber`, `night-ops→sky`,
  `contrail→tarmac`, `carrier-deck→beacon`, `altimeter→skydrol`, `aurora→aurora`. Runway green
  is unreachable until the picker is rebuilt.
- `TODO(step-4)` — the greeting pool is the reference rig's lines, tagged conservatively. When
  `wingman-voices.md` lands the pool is replaced wholesale; the machinery does not change.
- The social preset reads `pw-social-preset` and defaults to **My flight**. There is no picker
  for it until step 4.

## Verifying all seven liveries without a picker

The home route accepts `?livery=` and `?variant=` overrides, which is how the §12 acceptance
pass was run:

    http://localhost:5199/?livery=runway&variant=day

Valid liveries: `sky amber tarmac beacon runway skydrol aurora`. Variants: `night day`.

## What the deck does to the shell, and only on this route

- `<main>` gets `content--deck`, which removes `.content`'s max-width, margin and padding so
  the deck can run edge to edge and carry its own light layers.
- `.app:has(.deck)::before/::after` are suppressed. The shell's cheatline and its fixed glow
  are a second ambient rig, and the glow painted over the deck's own light.
- `document.body.style.background` is set to the deck's ground while Home is mounted and
  restored on unmount, so there is no seam under the nav.

Everything reverses when you navigate away — verified on `/modules`.
