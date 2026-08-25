# Wingman — Build 01

Everything designed so far, and the instruction to remove what isn't here.

Implementation brief for Claude Code.

---

## 0 · References

Three files ship with this document. **They are the specification.** Where this prose and the
reference code disagree, the code wins. Port the CSS and JS out of them **verbatim** — do not
re-derive anything from the descriptions, do not round numbers, do not "improve" values.

| File | What it is |
|---|---|
| `wingman-poc.html` | **Primary.** The app shell, the finished home page, and the three-tab profile. A working proof of concept: when this build is done the site should render identically to it. |
| `livery-engine.html` | The colour and lighting bench. The place to check a livery renders correctly. |
| `wingman-voices.md` | The greeting copy and its rotation spec. |

`wingman-poc.html` carries the **full greeting sets and the real rotation engine** — port the
engine verbatim. `wingman-voices.md` remains the source of truth for the **copy**: where a line
in the POC array and a line in the `.md` disagree, the `.md` wins.

Every other HTML file from this project — `profile.html`, `social-dial.html`, `crew-strip.html`,
`rail-options.html`, `module-rail.html`, `module-cards.html`, `flight-deck.html`,
`progress-marks.html` — is **superseded** and is deliberately not shipped. `wingman-poc.html`
replaces `profile.html` entirely. If this document refers to a file that was not sent, it is
this document that is out of date — ask, do not substitute the prose.

Where a reference file includes a bench — a sticky control bar, livery chips, preset switchers,
explanatory note cards — **delete all of it.** It exists so a human can flip between states. In
the app, livery and preset come from user settings.

---

## 1 · The rule

Two halves, and the second one has rails on it.

**Build exactly what is described here.** Verbatim. If it looks different from the reference
files side by side, it's wrong.

**Anything not described here comes out of the UI.** The live site has surfaces and features
that are not part of this design. They should not appear.

### The rails on removal

Never delete, in this step or any other:

- authentication, sessions, accounts, permissions
- the database, migrations, or any user data
- course content — modules, chapters, videos, questions, uploads
- the admin backend, billing, or anything that costs money to rebuild
- anything whose loss cannot be undone by a deploy

**Removal is hiding, not deleting, unless we say otherwise.** Take the entry point out of the
UI and leave the route and the code in place behind a flag. That way an accidental removal is
one config change to reverse.

### Inventory first

Before removing anything, produce `REMOVAL-INVENTORY.md`: every UI surface, nav item, button,
setting and page currently in the live app, each marked **keep / reskin / hide / delete**, with
a one-line reason. **Do not act on it until it's signed off.**

That document is the deliverable for this step's first pass. The code changes come after.

---

## 2 · Order of work

**A. Kill pass** — the inventory above, then hide what's agreed.

**B. Token layer, globally.** Ship the colour and lighting system to *every* page on the site
at once, including pages whose layouts are untouched. It's CSS variables; it's cheap. The whole
site becomes Wingman-coloured on day one, and every later page revamp becomes a layout change
inside a consistent world rather than a page from a different product.

Global from the start: fonts, colour tokens, radii, button and pill shapes, focus rings, and
day/night handling.

**C. Home page** — section 5.

**D. Profile** — section 6.

Do not begin the chapter view, the Ready Room or anything in section 11.

---

## 3 · Colour system

Everything is OKLCH. Every surface, text colour and accent derives from **one livery** through
these functions. No hex values in the app except the two neutral fallbacks.

### 3.1 Three anchors

A livery is a hue that bends through a *core* in the middle of its ramp rather than running
straight from shadow to highlight. This is what stops a ramp looking painted.

```js
const wrap   = h => (((h % 360) + 360) % 360);
const smooth = u => u*u*(3-2*u);

const hueAt = (c, t) => {
  const m = c.midAt;
  return t <= m
    ? wrap(c.hue + c.dDark  * (1 - smooth(t/m)))
    : wrap(c.hue + c.dLight * smooth((t - m)/(1 - m)));
};

const chromaAt = (c, t, scale) => {
  const curve = 0.15 + 0.85*Math.sin(Math.PI*Math.pow(t, 1.4));
  const bump  = Math.exp(-Math.pow((t - c.midAt)/0.34, 2));
  return Math.max(0, c.chroma * scale * curve * (1 + (c.midC - 1)*bump));
};

const at = (c, t, scale) =>
  `oklch(${(c.ground + (c.light - c.ground)*t).toFixed(4)} ` +
  `${chromaAt(c, t, scale).toFixed(4)} ${hueAt(c, t).toFixed(2)})`;

const ramp = (c, scale) => Array.from({length: 13}, (_, i) => at(c, i/12, scale));
```

Two ramps per livery: `surf = ramp(L, 1)` for surfaces, `ink = ramp(L, 0.34)` for text.

### 3.2 Semantic map — night

```js
const pT = L.panelT ?? 1/12;
const gl = L.glass  ?? LIGHT.glass;

ground : surf[0]
panel  : at(L, pT,        1)
raised : at(L, pT + .085, 1)
line   : at(L, pT + .17,  1)
t3     : ink[6]     t2 : ink[9]     t1 : ink[12]
active : surf[8]    on : surf[9]    lit: surf[11]
```

**Brightness is state.** No second colour anywhere — nothing green for good, nothing red for
bad. Something is *on* when it rises up the ramp and *off* when it sinks toward the ground.
Larger areas take a lower rung than small marks, or a lit lamp burns a hole in the panel.

### 3.3 Glass

Panels are glass so light passes *through* them:

```js
panel  → alpha gl                      // default .78
raised → alpha min(1, gl + .09)
line   → alpha min(1, gl + .16)
```

### 3.4 Day mode

**Day is always cream, whatever the livery.** Only the light and the accents carry it. A fully
red or violet light mode is unreadable; a cream page lit by one is not.

```js
const CREAM = {
  ground:"oklch(.966 .010 85)", panel:"oklch(.992 .005 85)",
  raised:"oklch(.936 .013 85)", line:"oklch(.876 .014 85)",
  t1:"oklch(.250 .012 85)", t2:"oklch(.462 .010 85)", t3:"oklch(.618 .009 85)"
};
// H = hueAt(L, .55), C = L.chroma * L.midC
active : `oklch(.560 ${C*1.55} ${H})`
on     : `oklch(.630 ${C*1.45} ${H})`
lit    : `oklch(.470 ${C*1.70} ${H})`
```

Key and fill intensity in day: `ambInt * .34` and `fillInt * .30`. Spill `* .35`.

Mode is three-state: **Day / Night / Auto**, Auto following the device.

---

## 4 · The liveries and the light

Seven. Six core plus Aurora, which is the one special. **Afterburner is cut.**

```js
const LIVERIES = [
  {id:"sky",     hue:266, dDark:-11, dLight:-31, midAt:.42, midC:1.35,
   chroma:.100, ground:.140, light:.950, fillAbs:84,  fillC:.22},
  {id:"amber",   hue:78,  dDark:-14, dLight:14,  midAt:.45, midC:1.18,
   chroma:.126, ground:.158, light:.944, fillAbs:70,  fillC:.15},
  {id:"tarmac",  hue:255, dDark:6,   dLight:-12, midAt:.50, midC:1.00,
   chroma:.022, ground:.145, light:.955, keyAbs:58, keyC:.105, fillAbs:256, fillC:.30},
  {id:"beacon",  hue:22,  dDark:-14, dLight:6,   midAt:.44, midC:1.14,
   chroma:.128, ground:.148, light:.936, fillAbs:16,  fillC:.14, panelT:.048, glass:.93},
  {id:"runway",  hue:142, dDark:-14, dLight:9,   midAt:.46, midC:1.16,
   chroma:.095, ground:.120, light:.905, fillAbs:118, fillC:.16},
  {id:"skydrol", hue:300, dDark:-18, dLight:10,  midAt:.45, midC:1.18,
   chroma:.105, ground:.152, light:.945, fillAbs:252, fillC:.16},
  {id:"aurora",  hue:248, dDark:10,  dLight:-22, midAt:.44, midC:1.10,
   chroma:.078, ground:.190, light:.955, fillAbs:64, fillC:.34, aurora:true}
];

const LIGHT = { ambC:.305, soft:82, ambInt:.76, ambSize:96, ambX:76, ambY:-18,
                fillInt:.34, fillSize:74, fillX:16, fillY:112, glass:.78, spill:.22 };
```

Names, anchors and settings copy:

| Livery | Anchors | Description |
|---|---|---|
| Sky blue | navy → lapiz → sky blue | Above the weather, where nothing is anyone's problem yet. |
| Amber | bronze → amber → caution yellow | Master caution. Nothing is actually wrong. Probably. |
| Tarmac grey | gunmetal → graphite → grey | Concrete and a copper floodlight. Everything you can see is borrowed. |
| Beacon red | maroon → university red → signal red | Night vision. Deep, close, and slightly up to something. |
| Runway green | olive → grass → spring green | Grass past the threshold. Knows its place, stays in it. |
| Skydrol violet | indigo → violet → lavender | Hydraulic purple. If you've had it on your hands, you know. |
| Aurora | night → fjord → ice | Polar route, no traffic, nothing to do but look up. |

### 4.1 The rig

Three layers, all `mix-blend-mode: screen`, all `pointer-events: none`:

- `.deck::before` — **key**, from just past the top-right edge
- `.deck::after` — **fill**, a small accent lifting the bottom-left corner
- `.spill` — the key again *above* the content, so light lands on panels as well as passing
  through them

Plus `.grain` at `mix-blend-mode: overlay`, opacity `.05`.

### 4.2 Five rules that took longest to get right

**Light adds; it does not veil.** `screen`, never a translucent overlay. An overlay dims the
darks and reads as fog.

**Never fade a gradient to `transparent`.** It interpolates through transparent *black* and
leaves a dirty grey collar around every light. Fade to the same hue at alpha 0.

**Bright in hue, not in brightness.** The gradient core sits at lightness `.84`, not `.90`. A
core near white holds no hue and reads flat.

**The alpha lives in the body stops, not the core.** The core is a few pixels; the mid-falloff
is what you actually see.

**Layer coordinates are not deck coordinates.** The light layers sit at `inset:-55%`, so they
are 210% of the deck. Map before positioning:

```js
const K = 100/210, O = 55*K;
const LX = v => (O + K*v).toFixed(1);   // position
const LS = v => (K*v).toFixed(1);       // size
```

The key is authored in layer space already. The **fill** is authored in deck space and must be
mapped through `LX`/`LS`. This bug cost two rounds — a small light placed without the mapping
lands entirely outside the frame and appears to do nothing.

### 4.3 The two lamps

Key hue = `L.keyAbs ?? hueAt(L, 1)`, chroma `L.keyC ?? LIGHT.ambC`.
Fill hue = `L.fillAbs`, chroma `LIGHT.ambC * .85 * L.fillC`.

**The fill is an accent, not a second key.** It lifts one corner and gives the room a second
temperature. Key to fill runs about 3:1 in perceived output. Do not enlarge it.

Both lamps drift on **unrelated cycles — 26s and 41s** — so they never line up and never read
as a blink. Reverse the fill.

Filters: `blur(var(--soft)) saturate(1.28)` on the key, `blur(soft*1.35) saturate(1.2)` on the
fill, `blur(soft*1.2) saturate(1.22)` on the spill. `saturate()` runs after the blur and
recovers exactly what the blur takes.

### 4.4 Aurora

Replaces the key image with a curtain stack — seven tall ellipses hung off the top edge over
one continuous band, plus three violet fringe ellipses beneath. Copy `CURTAINS` and
`auroraImg()` verbatim.

Aurora also runs `feTurbulence` + `feDisplacementMap` (`#aurWarp`) on the key layer so no ray
stays a straight column, and it is the **only** livery with the starfield — two dot fields on
13s and 8.5s twinkle cycles from a seeded LCG, sitting behind the panels but above the light.

### 4.5 Depth treatments — fixed, no user control

| | State |
|---|---|
| Lamps on anchors | **on** |
| Chromatic edges — lit edge on top, unlit underneath | **on** |
| Hued shadows — `oklch(ground*.42, chroma*.6, shadowHue / .58)`, never `rgba(0,0,0,…)` | **on** |
| Grain | **on**, 5%, user-toggleable in Appearance |
| Starfield | **Aurora only** |
| Hot bloom, aerial perspective, state-by-hue | **off** |

---

## 5 · The home page

```
[ Wingman ]                            [ windsock · 1 ]  [ avatar ]

Flight Deck
{greeting}
Last flown two days ago

┌─ hero card ────────────────────────────────────────────┐
│ [thumb 124×72]  Intake & Compressor Basics             │
│                 JT.01 · Jet Turbine Fundamentals       │
│                 Pick up 6:12 into the briefing.        │
│                 ( Resume at 6:12 › )                   │
├─ instrument strip · 5 cells, 1px hairlines ────────────┤
│  attitude    flight bag    checklist   hobbs   radar   │
└────────────────────────────────────────────────────────┘

Modules                                        4 active
[ module rail — horizontal, scroll-snap ]

Back on the ground                        Ready Room ›
[ crew strip — 0, 2 or 3 cells by preset ]
```

**The hero card is never touched by social.** No presence line, no handover note, no squawk
button. Those belong to the chapter view, later.

**The module cards are never touched by social.** No crew marks on their profiles.

Social's only foothold in the academic half is **the radar**, which was already an instrument.
It reports how busy it is and it is the door to the Ready Room. It's a real `<button>`.

Deck padding `0 40px 46px`, inner `max-width: 1240px`, `0 16px 36px` below 640px.

### 5.1 The flight profile

Every module card carries one. A climb-cruise-descent, not a bar.

```js
const Y = t => {
  if (t <= .08) return base;                                   // ground roll
  if (t <  .30) return base - (base-top)*smooth((t-.08)/.22);  // climb
  if (t <  .70) return top;                                    // cruise
  if (t <  .92) return top + (base-top)*smooth((t-.70)/.22);   // descent
  return base;                                                 // landed
};
```

Chapters sit at `t = .08 + .84*(i/(n-1))` as four-point stars. The aircraft rotates to the
local slope. Notches hide when `(x1-x0)/chapters <= 20`.

**Draw at true pixel size.** Measure `clientWidth`/`clientHeight`, set the `viewBox` to match,
`preserveAspectRatio="none"`. Never scale a fixed viewBox — stroke weights distort. Repaint on
resize and on every token change.

At rest: code, name, dashed route, travelled portion in `t2`, card at `opacity:.84`.
On hover: lifts 3px, reveals notches, aircraft, and the travelled line in `active`.

Phase vocabulary: `at the gate · takeoff roll · climbing · cruise · on descent · short final ·
chocks in`.

### 5.2 Module rail

**Option A — scale.** Cards flex with no maximum; everything inside scales with them.

```css
.rail { display:flex; gap:13px; overflow-x:auto; scroll-snap-type:x proximity; }
.mod  { container-type:inline-size; flex:1 1 0; min-width:180px; }
@container (min-width:250px){ .modin{padding:17px} .mname{font-size:16px} .prof{height:58px} }
@container (min-width:330px){ .modin{padding:20px} .mname{font-size:18.5px;-webkit-line-clamp:2}
                              .prof{height:76px} }
```

Ceiling is seven modules. Hide the scrollbar, keep the right-edge fade on overflow.

### 5.3 Social presets

One setting, three values, no individual switches.

| Preset | Radar | Band below the modules |
|---|---|---|
| Quiet skies | yes | none |
| My flight | yes | Formation · Wingman |
| Open frequency | yes | Formation · Wingman · Frequency |

The band uses the instrument strip's grammar — one panel, hairline-divided cells.

**Formation** — the active module's route drawn wide, your aircraft on it, crewmates ticked
along it with initials above leader lines. Cruise altitude drops to make headroom. Shows
**position, never pace**: "JT.06" is information, "three chapters ahead of you" is a
leaderboard, and a leaderboard makes the people behind stop opening the app.

**Wingman** — one person, the reason in plain sentence case, history in mono, **Fly together ›**.
One chapter, not a friend request.

**Frequency** — three recent messages, a `3 NEW · QUIET SINCE 21:40` tick, and a compose line
that opens the real thread. **A preview, never a live chat** — motion on a home page beats
everything else on it, and the hero card is meant to win.

Empty states never say "0 online". A silent frequency reads **Quiet frequency**.

**If a feature behind a preset doesn't exist in the backend yet, don't offer that preset** and
don't render the `Ready Room ›` link. Never ship a door to an empty room — no greyed-out links,
no "coming soon", no placeholder pages.

### 5.4 The greeting

One line under "Flight Deck", from `wingman-voices.md`. Character from user settings, default
**Wingman**. Bands are device-local with no gaps:
`04–07 · 07–12 · 12–17 · 17–19 · 19–24 · 00–04`.

**Shuffle-bag per band, never random.** Random clumps, and the same line twice in three views
reads as a bug. Deal from a shuffled bag, reshuffle only when it empties, and on reshuffle swap
the first card if it matches the previous bag's last.

**Two-minute dwell.** Home → chapter → home inside the dwell shows the same line; that was
navigation, not an arrival.

**Band change punches through the dwell.** 23:58 → 00:03 deals immediately.

**Adjacency:** never two tool lines back to back, never two `{name}` lines back to back.

**Arrival vs continuation:** away 8h+ → arrival pool; under 2h → continuation; otherwise either.

**`{name}`** comes from *What Wingman calls you*. Lines carrying the token are excluded from
the pool when it's empty — never substitute a fallback word.

### 5.5 Runway lights

The horizontal strip of lamps across the bottom of the viewport already exists on the live
site. **Keep it.** It indicates how far down the page you are.

In this step it only inherits the new tokens — dim lamps at `line`, the lit one at `on`. Its
behaviour and geometry are being redesigned separately; **do not change them, and do not
invent a new version.**

---

## 6 · The profile

Reached from the avatar in the top bar, which opens a **menu**, not the page directly.

Menu: the account row with the ADMIN chip → Licence · separator · Preferences · Appearance ·
separator · Sign out. Escape closes, click-outside closes, arrow keys walk it, focus moves into
the first item on open. Progress and Bookmarks are **not** in the menu.

Three tabs: **Licence · Preferences · Appearance**. Proper `role="tablist"` with arrow-key,
Home and End navigation and roving `tabindex`.

### 6.1 Licence

Holder block: avatar with **Choose a photo** (real file picker, updates both the licence avatar
and the one in the top bar, with *Use initials* to undo), name, email, ADMIN chip.

Three name fields, each labelled with who sees it:

| Field | Hint |
|---|---|
| Name on the licence | Private. Nobody sees this but you. |
| Username | How you show up to everyone else. |
| What Wingman calls you | Used in greetings, and only by whoever's greeting you. |

Then a switch, **on by default** — *Go by your username*, with a live preview reading
"Everyone else sees @hassan.a". Off reads "Everyone else sees Hassan Alrefaei — most people
don't."

**No rating field, no school field.**

Account block: email, password, sign out.

**Delete account is a sentence, not a button** — small, at the very bottom, under everything
else, with the consequence in the same line: *"removes your logbook, your crew and everything
you've flown. It can't be undone."* Findable if you're looking, invisible if you're not.

### 6.2 Preferences

**Who greets you** — Wingman / The Hermit / Control, with a name, a description and a live
sample line that changes the greeting on the home page immediately.

> **Wingman** — A coworker on the same shift. Notices you're here, never what you scored.
> **The Hermit** — Small. Green. Far too interested in you. Speaks backwards and knows things he has no business knowing.
> **Control** — The tower. You're on the field, they're a hundred feet up, watching.

Control's copy exists but **its line set is not finished.** If it isn't in `wingman-voices.md`,
don't offer it.

**How social** — the three presets from 5.3.

**Notices** — three switches, each stating exactly what triggers it: answers to your questions,
your wingman starting a chapter, and one inactivity nudge. *"One nudge. Never more."*

### 6.3 Appearance

**Night Ops** — Day / Night / Auto.

**Livery** — seven **circles**, 34px, each carrying its own three shades at 145° sampled
through the real `at()` function. Aurora gets its own split. Selection is a ring in the
livery's accent. **Click selects. Nothing happens on hover.** Name and description above,
anchors below.

**A specimen sits under the picker** — a miniature hero card and one module card with both
lamps behind them, so you see what the light does to a panel rather than to a settings page.

**Instrument scale** — Small / Medium / Large, driving a `--scale` multiplier.

**Accessibility & motion**, all of which must actually work:

| Switch | Behaviour |
|---|---|
| Smooth Air | Stops every animation and transition |
| Plain Language | Swaps to Atkinson Hyperlegible |
| Turbulence | The small nudge on view and tab change |
| Grain | The film grain over the light |

`prefers-reduced-motion` is honoured **independently** of Smooth Air.

**"Lights Out" from the current site is not carried forward.** Its description says it replaces
pulsing red/green buttons in Discussion — the new system has no red/green anywhere. Check what
it actually does in the live app before deciding whether it's obsolete or has become the
default, and report back rather than guessing.

---

## 7 · The top bar

Brand mark left. A **windsock** pill with the streak count, then the avatar button. Both 40px
tall, same border, same glass fill, so they read as a set.

The avatar shows the user's photo when set, initials otherwise, and its ring lights only when
the menu is open.

The windsock in `wingman-poc.html` is the **old** version — it deforms as well as rotating. The
agreed design is a rigid three-band cartoon sock swaying four or five degrees about a visible
collar, resting slightly below horizontal. **That change is not built. Port what's in the file
and leave it; do not invent the new one.**

---

## 8 · Feature flags

One per surface, not one big switch:

`home.v2` · `profile.v2` · `tokens.global` · `social.crew` · `social.frequency` ·
`voice.characters` · `livery.aurora`

Default **on for admin, off for everyone else**, so the redesign lives in production from day
one and the gap between review and shipping is never more than a deploy.

**A flag is deleted within a few weeks of reaching everyone.** Put the deletion in the same
ticket as the rollout, or you accumulate a second codebase by stealth.

---

## 9 · Accessibility

- Everything animated is decorative. `prefers-reduced-motion` stops the drift, the twinkle, the
  radar sweep, the windsock and the card lift.
- Visible `:focus-visible` ring at `2px` offset `2px` on every interactive element.
- `role="switch"` with `aria-checked` on every toggle; `role="tablist"` on the tabs;
  `aria-haspopup`/`aria-expanded` on the menu.
- The attitude indicator and the radar need accessible names.
- Body text `t2`, headings `t1`, faint `t3`. Check contrast on every livery in both modes,
  especially **Runway green**, which has the lowest light anchor at `.905`.

---

## 10 · Acceptance

Put the built pages and the reference files side by side at the same width and step through all
seven liveries in both modes. It should be difficult to tell which is which.

- [ ] Sky blue's fill is a pale warm grey bottom-left — **not green**
- [ ] Tarmac grey is lit copper above, gunmetal below
- [ ] Beacon red's panels are visibly deeper and more opaque than the others'
- [ ] Aurora's curtains are folded, not straight columns, and stars show through them
- [ ] Aurora is the only livery with stars
- [ ] Card borders are warmer on top than underneath
- [ ] No `rgba(0,0,0,…)` shadow anywhere
- [ ] No gradient anywhere fades to `transparent`
- [ ] Module profiles redraw on resize and never stretch
- [ ] Day mode is cream on every livery
- [ ] The hero card contains nothing social
- [ ] The livery picker previews only on click, never on hover
- [ ] Every accessibility switch does what its description says
- [ ] Nothing links to a page that doesn't exist

---

## 11 · Not designed yet — do not invent

If it's on this list, it has no approved design. Hide the entry point and stop.

- Chapter view — video, quiz, comments as three tabs
- Ready Room
- The `Fly together` flow
- Progress and Bookmarks
- Notification delivery
- The Control voice line set
- The windsock retune (section 7)
- The runway lights retune (section 5.5)

Ask before starting any of them.
