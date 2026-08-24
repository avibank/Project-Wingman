# Wingman — Step 1: the Flight Deck (home page)

Implementation brief. **This step changes the home page and nothing else.**

---

## 0 · How to use this brief

Two reference files ship alongside this document. **They are the specification.** Where this
prose and the reference code disagree, the code wins.

- `livery-engine.html` — the colour and lighting rig
- `reference/social-dial.html` — the finished home-page layout with the social band

Do **not** re-derive any of this from the descriptions. Port the CSS and the JS out of the
reference files verbatim, then delete the bench chrome (the sticky control bar at the top,
the livery chips, the preset switcher, the explanatory note cards at the bottom). What's left
*is* the home page.

The bench exists so a human can flip between states. In the app, livery comes from user
settings and the social preset comes from user settings — nothing else changes.

---

## 1 · Scope

**In scope**

- The home page / Flight Deck only
- The full colour + lighting system, since everything else will inherit it later
- Light and dark mode for the home page

**Out of scope — do not touch in this step**

- Chapter pages, quiz, comments, module detail, settings, Ready Room, auth, nav shell
- Any route other than home
- Any data model change. Wire to whatever the home page already reads; use the placeholder
  content in the reference file where real data isn't available yet.

If something on the home page needs a field the API doesn't return, hardcode the placeholder
and leave a `TODO(step-N)` comment. Do not extend the backend in this step.

---

## 2 · Colour system

Everything is OKLCH. Every surface, every text colour and every accent on the page derives
from **one livery** through the functions below.

### 2.1 Three anchors

A livery is a hue that bends through a *core* somewhere in the middle of its ramp, rather
than running straight from shadow to highlight. This is what stops a ramp looking painted.

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

Two ramps per livery: `surf = ramp(L, 1)` for surfaces and `ink = ramp(L, 0.34)` for text.

### 2.2 Semantic map — night

```js
const pT = L.panelT ?? 1/12;
const gl = L.glass  ?? LIGHT.glass;

ground : surf[0]
panel  : at(L, pT,        1)
raised : at(L, pT + .085, 1)
line   : at(L, pT + .17,  1)
t3     : ink[6]        // faint text
t2     : ink[9]        // body text
t1     : ink[12]       // headings
active : surf[8]       // interactive
on     : surf[9]       // lit, large area
lit    : surf[11]      // lit, small mark
```

**Brightness is state.** There is no second colour anywhere. Something is *on* when it rises
up the ramp and *off* when it sinks toward the ground. Larger areas take a lower rung than
small marks, or a lit lamp burns a hole in the panel.

### 2.3 Glass

```js
panel  → alpha  gl
raised → alpha  min(1, gl + .09)
line   → alpha  min(1, gl + .16)
```

Default `glass` is `.78`. Beacon red overrides to `.93`.

### 2.4 Day mode

**Day is always cream, whatever the livery.** Only the light and the accents carry the livery.

```js
const CREAM = {
  ground:"oklch(.966 .010 85)", panel:"oklch(.992 .005 85)", idle:"oklch(.936 .013 85)",
  line:"oklch(.876 .014 85)",  t1:"oklch(.250 .012 85)",
  t2:"oklch(.462 .010 85)",    t3:"oklch(.618 .009 85)"
};
// accents in day, where H = hueAt(L, .55) and C = L.chroma * L.midC
active : `oklch(.560 ${(C*1.55)} ${H})`
on     : `oklch(.630 ${(C*1.45)} ${H})`
lit    : `oklch(.470 ${(C*1.70)} ${H})`
```

Key and fill intensity in day: `ambInt * 0.34` and `fillInt * 0.30`.

---

## 3 · The liveries

Seven. Six core plus Aurora, which is the one special.

```js
const LIVERIES = [
  {id:"sky",     name:"Sky blue",       hue:266, dDark:-11, dLight:-31, midAt:.42, midC:1.35,
   chroma:.100, ground:.140, light:.950, fillAbs:84,  fillC:.22},
  {id:"amber",   name:"Amber",          hue:78,  dDark:-14, dLight:14,  midAt:.45, midC:1.18,
   chroma:.126, ground:.158, light:.944, fillAbs:70,  fillC:.15},
  {id:"tarmac",  name:"Tarmac grey",    hue:255, dDark:6,   dLight:-12, midAt:.50, midC:1.00,
   chroma:.022, ground:.145, light:.955, keyAbs:58, keyC:.105, fillAbs:256, fillC:.30},
  {id:"beacon",  name:"Beacon red",     hue:22,  dDark:-14, dLight:6,   midAt:.44, midC:1.14,
   chroma:.128, ground:.148, light:.936, fillAbs:16,  fillC:.14,
   panelT:.048, glass:.93},
  {id:"runway",  name:"Runway green",   hue:142, dDark:-14, dLight:9,   midAt:.46, midC:1.16,
   chroma:.095, ground:.120, light:.905, fillAbs:118, fillC:.16},
  {id:"skydrol", name:"Skydrol violet", hue:300, dDark:-18, dLight:10,  midAt:.45, midC:1.18,
   chroma:.105, ground:.152, light:.945, fillAbs:252, fillC:.16},
  {id:"aurora",  name:"Aurora",         hue:248, dDark:10,  dLight:-22, midAt:.44, midC:1.10,
   chroma:.078, ground:.190, light:.955, fillAbs:64, fillC:.34, aurora:true}
];
```

**Do not round, retune or "improve" any of these numbers.** Every one was set by eye against
the rendered result.

| Livery | shadow → core → highlight |
|---|---|
| Sky blue | navy → lapiz → sky blue |
| Amber | bronze → amber → caution yellow |
| Tarmac grey | gunmetal → graphite → grey |
| Beacon red | maroon → university red → signal red |
| Runway green | olive → grass → spring green |
| Skydrol violet | indigo → violet → lavender |
| Aurora | night → fjord → ice |

---

## 4 · The lighting rig

```js
const LIGHT = { ambC:.305, soft:82, ambInt:.76, ambSize:96, ambX:76, ambY:-18,
                fillInt:.34, fillSize:74, fillX:16, fillY:112, glass:.78, spill:.22 };
```

Three layers, all `mix-blend-mode: screen`, all `pointer-events:none`:

- `.deck::before` — **key**, from just past the top-right edge
- `.deck::after` — **fill**, a small accent lifting the bottom-left corner
- `.spill` — the key again, *above* the content, so light lands *on* panels as well as
  passing through them

Plus `.grain` at `mix-blend-mode: overlay`.

### 4.1 Critical rules

**Light adds; it does not veil.** `screen`, never a translucent overlay.

**Never fade a gradient to `transparent`.** That interpolates through transparent *black* and
leaves a dirty grey collar around every light. Always fade to the same hue at alpha 0.

**Bright in hue, not in brightness.** The gradient core sits at lightness `.84`, not `.90`.

**The alpha lives in the body stops, not the core.**

**Layer coordinates are not deck coordinates.** The light layers sit at `inset:-55%`, so they
are 210% of the deck. Map first:

```js
const K = 100/210, O = 55*K;
const LX = v => (O + K*v).toFixed(1);   // position
const LS = v => (K*v).toFixed(1);       // size
```

The key light is authored in layer space already. The **fill** is authored in deck space and
must be mapped through `LX`/`LS`.

### 4.2 The two lamps

```js
const col = (l,c,h,a) => `oklch(${l} ${c.toFixed(3)} ${h.toFixed(1)} / ${a})`;

const keyImg = (h,c,x,y,s) => {
  const A = a => col(.84, c*1.12, h, a);   // core — lower and hotter in hue
  const B = a => col(.74, c*1.10, h, a);   // body
  return `radial-gradient(${s}% ${(s*.86).toFixed(0)}% at ${x}% ${y}%,
    ${A(.90)} 0%, ${B(.60)} 26%, ${B(.30)} 48%, ${B(.10)} 66%, ${col(.74,c*1.10,h,0)} 84%)`;
};

const fillImg = (h,c,x,y,s) => {
  const B = a => col(.72, c*1.08, h, a);
  return `radial-gradient(${s}% ${(s*.86).toFixed(0)}% at ${x}% ${y}%,
    ${B(.92)} 0%, ${B(.50)} 26%, ${col(.70,c*.96,h,.20)} 50%, ${col(.70,c*.96,h,0)} 76%)`;
};
```

**Key hue** = `L.keyAbs ?? hueAt(L, 1)`. Chroma `L.keyC ?? LIGHT.ambC`.
**Fill hue** = `L.fillAbs`. Chroma `LIGHT.ambC * 0.85 * L.fillC`.

**The fill is an accent, not a second key.** Key to fill runs about 3:1. Do not enlarge it.

### 4.3 Filters and motion

```css
.deck::before, .deck::after { filter: blur(var(--soft)) saturate(1.28); }
.deck::after                { filter: blur(calc(var(--soft)*1.35)) saturate(1.20); }
.spill                      { filter: blur(calc(var(--soft)*1.20)) saturate(1.22); }
```

`saturate()` runs *after* the blur and recovers exactly what the blur takes. Both lamps drift
on **unrelated cycles — 26s and 41s** — so they never line up. Reverse the fill.

### 4.4 Grain

An feTurbulence tile at `mix-blend-mode: overlay`, default opacity `.05`.

### 4.5 Aurora

Aurora replaces the key image with a curtain stack — seven tall narrow ellipses hung off the
top edge over one continuous band, plus three violet fringe ellipses beneath. Aurora also runs
an `feTurbulence` + `feDisplacementMap` filter (`#aurWarp`) on the key layer so no ray stays a
straight column, and it is the **only** livery that shows the starfield.

Stars: two dot fields on 13s and 8.5s twinkle cycles, generated by a seeded LCG so they never
redraw differently. Behind the panels but **above** the light layers.

---

## 5 · Depth treatments

Fixed state. No user control.

| Treatment | State | What it does |
|---|---|---|
| Lamps on anchors | **on** | key = highlight anchor, fill = the livery's completing colour |
| Chromatic edges | **on** | lit edge on top, unlit edge underneath |
| Hued shadows | **on** | shadow tinted with the shadow anchor, never `rgba(0,0,0,…)` |
| Grain | **on** | 5% |
| Starfield | **Aurora only** | |
| Hot bloom | off | |
| Aerial perspective | off | |
| State by hue | off | |

Use `oklch(ground*0.42, chroma*0.6, shadowHue / .58)` for shadows.

---

## 6 · Page layout, top to bottom

```
Flight Deck                      ← 32px / 700 / -.7px tracking
{greeting}                       ← 20px / 600, from the voice system
Last flown two days ago          ← 13px, t2

┌─ hero card ────────────────────────────────────────────┐
│ [thumb 124×72]  Intake & Compressor Basics             │
│                 JT.01 · Jet Turbine Fundamentals       │
│                 Pick up 6:12 into the briefing.        │
│                 ( Resume at 6:12 › )                   │
├─ instrument strip · 5 cells, 1px hairlines ────────────┤
│  attitude    flight bag    checklist   hobbs   radar   │
└────────────────────────────────────────────────────────┘

Modules                                    4 active
[ module rail — horizontal, scroll-snap ]

Back on the ground                      Ready Room ›
[ crew strip — 0, 2 or 3 cells by preset ]
```

**The hero card is never touched by social.** **The module cards are never touched by social.**
Social's only foothold in the academic half is **the radar**, which was already an instrument.
Make the radar cell a real `<button>`.

Deck padding `34px 40px 46px`, inner `max-width: 1240px`. Below 640px, `24px 16px 36px`.

---

## 7 · The flight profile

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
local slope. Notches are hidden when `(x1-x0)/chapters <= 20`.

**Draw at true pixel size.** Measure `clientWidth`/`clientHeight`, set the `viewBox` to match,
`preserveAspectRatio="none"`. Never scale a fixed viewBox.

On hover a card lifts 3px and reveals the notches, the aircraft, and the travelled line in
`active`. Cards sit at `opacity:.84` at rest.

Phase vocabulary: `at the gate · takeoff roll · climbing · cruise · on descent · short final ·
chocks in`

---

## 8 · Module rail

**Option A — scale.** Cards flex with no maximum, and everything inside scales with them.

```css
.rail { display:flex; gap:13px; overflow-x:auto; scroll-snap-type:x proximity; }
.mod  { container-type:inline-size; flex:1 1 0; min-width:180px; }
@container (min-width:250px){ .modin{padding:17px} .mname{font-size:16px} .prof{height:58px} }
@container (min-width:330px){ .modin{padding:20px} .mname{font-size:18.5px;-webkit-line-clamp:2}
                              .prof{height:76px} }
```

Ceiling is seven modules. Hide the scrollbar, keep the right-edge fade when the rail overflows.

---

## 9 · Social presets

| Preset | Radar | Band below the modules |
|---|---|---|
| **Quiet skies** | yes | none |
| **My flight** | yes | Formation · Wingman |
| **Open frequency** | yes | Formation · Wingman · Frequency |

**Formation** — your active module's route drawn wide, your aircraft on it, and each crewmate
ticked along it with their initials above a leader line. Shows **position, never pace**.

**Wingman** — one person, the reason they're suggested in plain sentence case, the history in
mono beneath, and **Fly together ›**. One chapter, not a friend request.

**Frequency** — recent messages, a quiet-since tick, and a compose line that opens the real
thread. **A preview, never a live chat.**

Empty states never say "0 online". When a frequency is silent it reads **Quiet frequency**.

---

## 10 · The greeting

One line under "Flight Deck". Character comes from user settings; default is **Wingman**.

Bands are device-local, no gaps: `04–07 · 07–12 · 12–17 · 17–19 · 19–24 · 00–04`.

**Shuffle-bag per band, never random.** Deal from a shuffled bag, reshuffle only when it
empties, and on reshuffle swap the first card if it matches the previous bag's last.

**Two-minute dwell.** **Band change punches through the dwell.**

**Adjacency:** never two tool lines back to back, never two `{name}` lines back to back.

**Arrival vs continuation:** away 8h+ → arrival pool; under 2h → continuation; otherwise
either. Lines carrying `{name}` are excluded when no name is set — never substitute a fallback.

---

## 11 · Motion and accessibility

- Everything animated is decorative. `prefers-reduced-motion: reduce` stops the drift, the
  twinkle, the radar sweep and the card lift.
- Every interactive element keeps a visible `:focus-visible` ring at `2px` offset `2px`.
- Body text is `t2`, headings `t1`, faint `t3`.
- The radar cell is a button and needs an accessible name.

---

## 12 · Acceptance

- [x] Sky blue's fill is a pale warm grey in the bottom-left — **not green**
- [x] Tarmac grey is lit copper above and gunmetal below
- [x] Beacon red's panels are visibly deeper and more opaque than the other liveries'
- [x] Aurora's curtains are folded, not straight columns, and stars show through them
- [x] Aurora is the only livery with stars
- [x] Card borders are warmer on top than underneath
- [x] No `rgba(0,0,0,…)` shadow anywhere on the page
- [x] No gradient anywhere fades to `transparent`
- [x] Module profiles redraw on resize and never stretch
- [x] Day mode is cream on every livery
- [x] The hero card contains nothing social

---

## 13 · Next steps — do not start these

1. Chapter view — video, quiz, comments as three tabs
2. Ready Room
3. `Fly together` flow
4. Settings, including livery and voice pickers
5. Module detail

Ask before beginning any of them.
