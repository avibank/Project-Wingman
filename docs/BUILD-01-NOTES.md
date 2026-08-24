# Build 01 — what was built, and what it assumed

Companion to `WINGMAN-BUILD-01.md`. Reference files live in `docs/reference/`.

## Order of work, per §2

| | Status |
|---|---|
| **A · Kill pass** | `REMOVAL-INVENTORY.md` written. **Nothing acted on** — §2A says not to until it's signed off. |
| **B · Token layer, globally** | Done. Every page on the site, including untouched layouts. |
| **C · Home page** | Done. |
| **D · Profile** | Built, but from §6's prose — `profile.html` was not supplied. See below. |

Nothing in §11 was started.

## Where the code lives

| File | What |
|---|---|
| `src/lib/liveryEngine.js` | §3–§4. The seven liveries, the three-anchor ramp, the two lamps, the aurora curtains, the seeded starfield, cream day mode, `deckVars()`. Pure. |
| `src/styles/app.css` | §2B's static half: the bridge from the v2 semantic names onto the engine, fonts, radii, pill and button shapes, focus rings, Smooth Air, Plain Language. |
| `src/lib/flightProfile.js` | §5.1. Pure. |
| `src/lib/voices.js` | `wingman-voices.md`, transcribed. 65 Wingman + 54 Hermit, tagged. |
| `src/lib/greeting.js` | §5.4 rotation. Pure. |
| `src/lib/flags.js` | §8. |
| `src/components/Home.jsx` | §5. |
| `src/components/Profile.jsx` | §6. |
| `src/components/ProfileMenu.jsx` | §6's menu, §7's avatar. |

## §2B — how the token layer ships globally

The ramp is a computation, not a table, so `deckVars()` writes the base tokens
(`--ground --panel --raised --line --t1/2/3 --active --on --lit --active-fill`
plus the lighting vars) onto `:root` whenever livery or variant changes.
`app.css` then bridges every v2 semantic name onto them, so screens that were
never touched repaint without a rewrite and get retired one at a time.

The generated `src/styles/tokens.css` and its `scripts/build-tokens.mjs` are
deleted: two token systems in one app is the "second codebase by stealth" §8
warns about, and §2B is explicit that the new one goes everywhere at once.

Nine black shadows and scrims across the app were repointed at `--shadow-c` and
at `color-mix(… var(--ground) …)`, per §4.5 and §10. A grep for `rgba(0,0,0`
now returns nothing.

## §5.4 — the greeting

The rotation spec is implemented in full and checked over 204,800 simulated
draws across both characters, every band, every away-window and with and
without a name: **zero adjacent duplicates, zero adjacent same-tag pairs.**

Getting there took three attempts, and the reason is worth recording. The spec
says "after shuffling, one pass: swap any adjacent pair sharing a tag". A single
forward pass cannot fix a clash sitting on the last two cards — there is nothing
ahead of it to swap with — so it survives to the seam between bags and shows up
as two tool lines back to back. The three constraints (no repeat across the
seam, no same tag across the seam, no same tag inside the bag) also fight each
other when applied in sequence: each fix reintroduces one of the others. They
are now one objective that a repair loop minimises, which is why it converges.

Control is not offered: §6.2 says not to unless its lines are in the file.

## §6 — the profile, and the missing reference

`profile.html` is named in §0 as the **primary** reference and was not among the
files supplied. §0 also says not to re-derive anything from the descriptions.

Those two instructions cannot both be followed here, so the profile is built
from §6's prose — which is unusually specific about fields, hints, defaults,
copy and sizes — and this is the flag: **it has not been checked side by side
against `profile.html`, and §0 says the code wins.** Re-verify before it reaches
anyone but admin. `profile.v2` is admin-only, so it currently does not.

Everything §6 asks for is present and working: the menu with its keyboard
handling, the three tabs with roving `tabindex`, the three name fields and their
hints, "Go by your username" on by default with the live preview, the account
block, delete-as-a-sentence, the two voices with a live sample dealt off the
real engine, the three presets, the three notices, Night Ops as Day/Night/Auto,
the seven 34px circles sampled through `at()`, the specimen with both lamps, the
instrument scale, and four accessibility switches that each measurably do what
their description says.

## §10 acceptance

All fourteen pass. The four that are new since the home page:

- The livery picker fires on click only — there is no `:hover` rule on it.
- Smooth Air drives computed `transition-duration` to `0s`; Plain Language
  changes the computed font stack; Grain moves `--grain` between `.05` and `0`;
  Turbulence toggles its own state. Verified in the browser, not by reading.
- `prefers-reduced-motion` is a separate rule and is honoured whatever Smooth
  Air says.
- Nothing links to a page that does not exist: `/licence`, `/preferences` and
  `/appearance` are real routes, and deleting an account confirms in place
  rather than pointing at a flow that has no design.

## Deviations, each deliberate

1. **`--active-fill`.** §9 asks for a contrast check "especially Runway green".
   It fails: §3.4's day accent at L .560 puts a cream label at 3.94:1 on Runway
   and under 4.5 on five of seven. `--active` is left exactly as specced, since
   it is also the hairline, the rim, the travelled line and the radar sweep;
   only filled controls take the darkened token. Largest walk is .032 in
   lightness. All fourteen livery/mode pairs now clear AA.
2. **`home.v2` and `tokens.global` are on for everyone.** §8 wants a flag per
   surface, but neither of these has an "off" left to fall back to — the old
   token layer is deleted and the v2 home page was replaced rather than kept.
   They stay in the list so they get deleted with the others. The five that
   have a real off state are admin-only, as §8 says.
3. **The 44px touch floor.** §7 says the windsock pill and the avatar are both
   40px. The app enforces a global 44px minimum on buttons; both now use its
   documented `.is-inline` opt-out.
4. **Identity default.** §6.1 makes "Go by your username" on by default, so a
   preferences row that does not exist yet now starts at `username` rather than
   `real`. That is also the less identifying of the two.
