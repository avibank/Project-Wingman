# Project Wingman — Design & Architecture Spec (v2)

**Status:** direction agreed, not yet implemented.
**Supersedes** `docs/SPEC.md` (v1). Where the two disagree, this document wins.
See `docs/SPEC-MIGRATION.md` for what v1 shipped that v2 reverses.

## 0. How to use this document

This is a specification, not a suggestion list. Sections 1–8 are the system; every
screen spec in §9 derives from them. If a screen decision conflicts with §1–8, the
system wins.

Do not implement all of this at once. See §15 for phasing.
Before changing anything, read §14 (known bugs) — several are cheap fixes that unblock
the rest.

### Current stack observations

- SPA, no routing — every screen renders at `/`
- Auth via Clerk
- Theming via `data-livery` + `data-variant` attributes on `<html>`, ~192 CSS custom
  properties in `:root`
- Colour in `oklch()` (keep this)
- State in localStorage under `pw-*` keys
- Fonts: Instrument Sans (UI), Newsreader (reading serif), Geist Mono (labels — to be
  reduced)

## 1. The design principle

### 1.1 Governing rule

**Stop borrowing aviation's appearance. Borrow its doctrine.**

A cockpit is not a busy interface — it is the most ruthlessly edited interface ever
built. It looks dense because the information is irreducible. The current product
borrowed the visual density (mono caps, gauges, radar sweeps, HUD glow) without the
discipline that earns it.

### 1.2 Aviate · Navigate · Communicate

A strict priority ladder. The lower rung always yields to the higher one.

| Rung | Meaning | Gets |
|---|---|---|
| **AVIATE** | The material — reading, video, the question | Centre of screen, best type, most space, never interrupted |
| **NAVIGATE** | Where am I, what's next | Answerable in <1s, never larger or louder than content |
| **COMMUNICATE** | People | Reachable in one gesture, never occupying the primary field |

**The test** — apply to any element:
> Which rung is this on, and is anything from a lower rung above it or louder than it?

### 1.3 Corollaries

**Sterile cockpit.** During the quiz, nothing non-essential exists on screen. No streak,
no presence, no breadcrumb, no chrome, no social. Question, options, explanation.

**One attitude indicator per screen.** Exactly one element you return to, unmistakable.
Home = the next action. Chapter = the content. Module = the chapter list.

**Everything is placarded, nothing is decorated.** Real cockpit labels are plain:
LANDING GEAR, MASTER CAUTION. There is no such thing as a clever placard.

- Controls get plain labels: Dark mode, Text size, Reduce motion, Delete account
- Flavour lives in moments: the greeting, the debrief, empty states, completion
- Exception: destinations may carry proper nouns (Ready Room, Logbook) because they are
  places, not controls
- Exception: internal token names may be evocative (`beacon-red`) because users never
  see them

### 1.4 Restraint = a budget, not subtraction

Go quiet everywhere so you can afford to be loud in three places. Per screen:

- One accent in use
- One moment of motion
- One voice moment (a line of flavour)
- One attitude indicator
- One social door per scope

Anything outside the allowance drops to neutral. If a screen exceeds an allowance, it is
overdrawn — cut, don't balance.

## 2. Information architecture

Two sections with deliberately opposite registers.

```
ACADEMIC (cold, quiet, focused)
  Home
   └─ Module (active) ──┐
   └─ Modules (parked)  │
                        └─ Chapter
                            ├─ Brief
                            ├─ Quiz
                            └─ Comments

READY ROOM (warm, dense, live)
  reached by one door on Home
   ├─ Now (presence)
   ├─ Open squawks
   ├─ Your crew (teams + partners)
   └─ Module channels
```

### 2.1 The split rule

Split by intent, not by feature type:

- **Social content about the material** (explanations, debriefs, "41 got this wrong",
  notes on a paragraph) → stays academic. It is study material that happens to be
  written by students.
- **Social about people** (presence, squadron, teams, partners, formations, module chat)
  → Ready Room.

### 2.2 Routing (required)

Implement real URLs. **This is the highest-leverage structural fix in the document.**

```
/                      home
/m/:module             module
/m/:module/:chapter    chapter (defaults to brief)
/m/:module/:chapter/quiz
/m/:module/:chapter/comments
/m/:module/:chapter/q/:n     a single question (permanent, shareable)
/ready                 ready room
/ready/:module         ready room, filtered
/logbook
/settings
```

Browser back must work. Deep links must work. Sharing a chapter link with a classmate is
the entire growth loop and currently does not exist.

### 2.3 Navigation

Four destinations, persistent: **Study · Modules · Logbook · Ready Room**

Avatar menu holds only: profile, settings, sign out.

Currently Progress and Bookmarks are buried in the avatar menu. Move them out. Delete the
Features panel from shipping builds.

## 3. Colour system

### 3.1 The model

**Monochrome.** One lightness ramp, tinted. Colour does not carry semantic meaning —
value, emission, and motion do.

Two layers, strictly separated:

```
PRIMITIVES  →  SEMANTICS  →  COMPONENTS
```

Components must never reference a primitive. This is not bureaucracy: the current
light-mode bug (`--surface-0` correctly switched to `oklch(.98 …)` while body stayed
painted `rgb(11,21,38)`) is exactly what a missing semantic layer causes. With this
layer, mode bugs are structurally impossible.

### 3.2 The lightness ladder

Every colour family uses identical lightness values. Only hue and chroma vary.

| Step | L |
|---|---|
| 0 | .99 |
| 50 | .97 |
| 100 | .94 |
| 200 | .89 |
| 300 | .82 |
| 400 | .74 |
| 500 | .66 |
| 600 | .57 |
| 700 | .48 |
| 800 | .38 |
| 900 | .28 |
| 950 | .20 |
| 1000 | .15 |

Rule: `-500` means L .66 in every family, always.

### 3.3 Chroma curve

Chroma peaks mid-ramp and tapers at both ends — pure hue is impossible at .99 or .15.

| Step | Chroma multiplier |
|---|---|
| 0 / 50 | 0.15 |
| 100 / 200 | 0.4 |
| 300 | 0.7 |
| 400–600 | 1.0 (peak) |
| 700 | 0.8 |
| 800 | 0.6 |
| 900 | 0.4 |
| 950 / 1000 | 0.25 |

Base chroma for the monochrome ramp: **0.014 at peak**. This is very low by design — it
should read as tinted grey, never as a colour.

### 3.4 Liveries

A livery is a tint of the single monochrome ramp, plus a presence temperature. It does
not repaint anything semantic.

| Livery | Base hue | Chroma mult | Presence hue | Character |
|---|---|---|---|---|
| Contrail | 240 | 0.15 | 70 | Near-colourless. Presence is the only warmth ever seen — most dramatic delta. |
| Night Ops | 225 | 1.0 | 60 | Cool steel. High contrast delta, cinematic. |
| Carrier Deck | 255 | 0.9 | 40 | Slate → bronze. |
| Altimeter | 260 | 0.4 | 65 | Near-neutral graphite → lamp-glow. |
| Aurora | 300 | 0.9 | 20 | Violet-cool → rose-neutral. |
| Dawn Patrol | 60 | 0.9 | 45 | Already warm; presence deepens it. Subtle, cosy. **Default.** |

The gap between base and presence temperature is the **soul delta** — it is what makes
six monochrome themes feel genuinely different.

**Livery rules (hard)**

A livery MAY change: the ramp tint · presence temperature · the cheatline · the tail ring.
A livery MAY NEVER change: lightness values · semantic mappings · type · the reserved
red · anything with state meaning.

Consequences: every livery is legible by construction, contrast is tuned once, and adding
a seventh livery is one row of values and zero risk.

**Livery location & unlock**

- Move to Settings → Appearance. (Features is a placeholder and should not ship.)
- Keep unlock-by-completing-a-module. It is a better reward than badges.
- Render each swatch as a thin strip of its full ramp, dark→light. A single dot cannot
  honestly show the difference between two monochromes.
- The payoff must be socially visible — a livery colours your tail ring in the Ready
  Room, where other people see it. A livery only visible in settings is wallpaper.
- Rename storage key to `pw-livery`. Delete `pw-accent-color`.

### 3.5 The one reserved colour

`beacon-red` — used in exactly one place: **irreversible destruction** (delete account
confirmation).

Not for errors. Not for wrong answers. Not for warnings. A monochrome product with one
red thing in it makes that red genuinely alarming, which is the point.

### 3.6 Semantic tokens

| Semantic | Night | Day |
|---|---|---|
| bg-ground | mono-1000 | mono-50 |
| bg-panel | mono-900 | mono-0 |
| bg-raised | mono-800 | mono-0 + hairline |
| hairline | white / .07 | mono-200 |
| hairline-bevel | white / .10 | mono-100 |
| text-primary | mono-50 | mono-900 |
| text-secondary | mono-300 | mono-600 |
| text-tertiary | mono-500 | mono-500 |
| accent-interactive | mono-100 | mono-800 |
| state-correct | illumination, see §4 | |
| state-wrong | extinction, see §4 | |
| presence | warmth, see §4 | |
| danger | beacon-500 | beacon-600 |

Notes:

- `text-tertiary` is the same step in both modes — mid-greys work against light and dark
  alike.
- Surfaces step **lighter** than the ground in both modes (dark: panels lift; light:
  white cards on grey page). A naive inversion gets this backwards.
- In a monochrome system `accent-interactive` is value, not hue — the brightest thing on
  a dark page, the darkest on a light one.

### 3.7 Text ramp — widen it

Current text-2 (.70) and text-3 (.64) are nearly identical, so there are effectively two
tiers and a wasted token. The spread above gives a real third tier — which means
hierarchy can be expressed with value instead of size, which is how the type scale gets
down to six steps.

**Never pure white on dark.** mono-50 (.97) is the ceiling.

## 4. Light & motion — the presence system

### 4.1 The idea

**Warmth is the colour temperature of the light, not an accent colour.**

A room at 6500K feels clinical; the same room at 2700K feels inhabited. Nobody says "the
room turned orange" — they say it feels warmer. That is the mechanism.

Implementation of a presence warm shift:

- hue → the livery's presence hue
- chroma → .03
- lightness → +0.03

Technically colour. Perceptually light.

### 4.2 States

| State | Expression |
|---|---|
| Empty | base temperature, perfectly still |
| Someone here | ambient warms, steady, no motion |
| Someone active (typing / answering) | warmth breathes — 4000ms cycle, ±2% lightness |
| Someone arrives | 600ms warm-in, one gentle swell, settle |
| Someone leaves | 2000ms cool-out |

### 4.3 Two timings that do all the work

**Breathe at 4000ms, not 1000ms.** Human resting breath is ~4s. A 4s cycle reads as
alive; a 1s pulse reads as an alert. This single number is the difference between a soul
and a notification.

**Arrivals are faster than departures.** Warmth arrives in 600ms and fades over 2000ms.
Rooms cool slower than they light. The asymmetry is what makes it feel physical rather
than programmed.

### 4.4 Where presence applies

- The Ready Room door on Home — warms when people are in there
- The chapter you're reading — warms when others are on it
- A tail ring — breathes when that person is active
- The Comments tab — breathes when a conversation is live

Study glow already implements the core of this. Promote it from a testing toggle to the
system, and extend it everywhere presence exists.

### 4.5 Correct / incorrect — illumination, not colour

**Correct is lit. Wrong is extinguished.**

**Correct answer illuminates** — steps up 3–4 rungs on the ramp, gains a soft emission at
its edge, marker fills solid. It looks switched on. Shown always, including when the user
was wrong.

**The user's wrong answer extinguishes** — drops 2 rungs, recedes toward the ground,
marker goes hollow and struck.

Everything else stays neutral.

Why this beats red/green:

- One focal point, not two. The eye goes straight to the truth instead of ping-ponging.
- Not punitive. Red scolds; an unlit lamp doesn't. Serves the welcoming brief.
- It's the annunciator. Lit means active — your users read this fluently already.
- Zero hue dependency. Value + fill + shape. Colour vision is tested on every aviation
  medical; some users hold restrictions and all are aware of it.

**Calibration warning:** be subtle with ambience and unsubtle with answers. These pull in
opposite directions. Presence whispers (2–4% shifts). Correct/wrong must survive a cheap
panel at 30% brightness (3–4 full ramp steps + shape change).

### 4.6 Motion budget

| Purpose | Duration | Easing |
|---|---|---|
| Standard transition | 180ms | ease-out |
| Answer illuminate | 240ms | ease-out |
| Presence arrive | 600ms | ease-out |
| Presence depart | 2000ms | ease-in |
| Breath cycle | 4000ms | sine, infinite |

Nothing else animates. Not tab switches, not page transitions, not hovers beyond a value
change. Turbulence (haptic nudge on every tab/module switch) should default off and be
scoped to meaningful events only.

Respect `prefers-reduced-motion` and the in-app Reduce motion setting: replace breath with
a static warm state, keep arrival/departure as instant value changes.

## 5. Typography

### 5.1 Families and roles

| Family | Role |
|---|---|
| Instrument Sans | All UI |
| Newsreader | Reading only — 17px / 1.7 / ~74ch. Already correct; do not touch. |
| Geist Mono | Chapter codes (JT.01) and numerals only |

**Retire mono from labels.** RECENTLY VIEWED, STUDY MATERIAL, BRIEFING VIDEO, Question 1
of 3, LOGGED, IN THIS MODULE — all become sentence-case sans in text-secondary. This is
the single largest visual improvement available and removes the busy-HUD texture.

Fix stray Arial and -apple-system fallbacks on elements that bypass the token layer.

### 5.2 Scale — six steps

**12 · 14 · 16 · 20 · 28 · 40** + the 17px reading size.

Currently ~10 sizes below 22px, which is why nothing has an obvious rank.

### 5.3 Weight

Two weights: **500 and 600.** Drop 700.

Text appears optically bolder on dark backgrounds — 500 on dark reads like 600 on light.
On a dark-first UI you go down a weight. Current 700 headings are shouting.

### 5.4 Tracking

Cap at **0.06em**, uppercase only. Current worst case is 1.8px on 9.5px mono (~0.19em),
which reads as scattered debris rather than text.

## 6. Surfaces, panelling, glow

### 6.1 Elevation

Two levels plus overlays. `bg-ground` → `bg-panel` → `bg-raised` (drawers/modals only).

Currently four levels are in play; every card appears to float at a slightly different
altitude.

**Elevation comes from lightness, not shadow.** Dark UIs that use drop shadows look
muddy; dark UIs that step lightness look machined.

### 6.2 Panels

**A panel is an edge plus a step** — not four effects at once. Cards currently carry
border + background + shadow + glow simultaneously. Pick two: hairline + lightness step.

**Bevel from one direction.** Top edge hairline at .10, all other edges .06. Reads as a
real bevel catching light from above. Never add a bottom highlight.

**Matte, never glossy.** No gradient fills on panels.

**Hairlines over borders.** A 1px divider does more work than a bordered box and lets you
delete containers. Fewer boxes, more air.

### 6.3 Radius

panel 12 · control 8 · chip 6 · avatar full

**Nested radius must be calculated:** inner = outer − padding. A 12px panel with 8px
padding contains 4px controls. Getting this wrong is the most common thing that makes an
interface look slightly amateur.

### 6.4 Glow rules

**Glow is emitted, never applied.** Only things that would plausibly emit light glow — an
illuminated answer, a presence warmth, the cheatline. Panels and cards do not glow.

**One ambient source per screen, off-canvas.** A single very large, very low-opacity
radial anchored in a corner or behind the hero. Never centred behind content, never two.

**Never glow behind text.** The NEXT UP band currently does this and it is why it reads
blurry and misaligned.

The Ready Room gets more ambient light than the academic side. Same technique, higher
value.

### 6.5 The cheatline

The `--cheatline` token is the fuselage stripe — the one line that says which airline this
is. Make it the only decorative element in the product. One thin gradient rule,
livery-coloured, at the top of the app or down the edge of the active module hero.

### 6.6 Delete

Noise/grain texture (reads as compression artefacts on OLED) · radar sweeps as card
wallpaper (currently clipping out of card edges) · card drop shadows · the fixed
flight-progress dot strip at the bottom of every screen · the glow behind NEXT UP ·
surface levels 3 and 4.

## 7. The two registers

Same design system, opposite ends. Same aircraft, different lighting. Do not differentiate
by hue — differentiate by lightness, warmth, and how much light is in the room.

| | Academic | Ready Room |
|---|---|---|
| Ground | mono-1000 | mono-950 — lights on |
| Ground temperature | base | shifted toward presence hue |
| Ambient light | one faint source | one brighter source |
| Type | Newsreader + Instrument Sans | Instrument Sans only |
| Density | airy, one column, wide margins | tight, chat rhythm |
| Faces | none, except Comments | everywhere |
| Time | absolute, quiet (JT.01) | relative, loud (2m ago) |
| Motion | almost none | arrivals, typing, joins |
| Haptics | off | on |
| Copy | plain placards | conversational |
| Corners | restrained, hairlines | softer, bubbles |

Crossing the door should register as a change in temperature, not a change in identity.

### 7.1 Let people be the only colour

If the interface is monochrome and avatars are real photographs, the only colour in the
entire Ready Room is human faces. That is "a soul walked in", made literal — and it means
the academic side (no faces) stays still and quiet by construction, with no extra design.

## 8. Copy & naming

### 8.1 Glossary — one word per concept, never broken

Module · Chapter · Brief · Quiz · Comments · Logbook · Saved · Streak · Squawk · Squadron
· Formation · Ready Room

### 8.2 Collisions to fix

| Concept | Current names | Fix |
|---|---|---|
| Progress page | Progress (menu) / Logbook (title) | **Logbook** |
| Bio field | also Logbook | **Bio** |
| Saved questions | Bookmarks / My Bookmarks / "flight bag" / "stow" | **Saved** |
| Talking to people | Discussion / Comments / Comms / "community notes" | **Comments** (chapter) / **channel** (module) |
| Progress counting | 0/4 chapters, 1 of 4 logged, 25%, 1/4 complete | **1 of 4 chapters** everywhere |
| Module CTAs | Begin / Continue / Enroll / Resume / Leave | **Continue / Make active / Add** |

### 8.3 Settings relabelling (placard rule)

| Current | New |
|---|---|
| Night Ops / Day Ops | Dark mode |
| Instrument Scale | Text size |
| Smooth Air | Reduce motion |
| Lights Out | delete — no red/green remains to suppress |
| Plain Language | Dyslexia-friendly font |
| Turbulence | Haptics (default off) |
| Point of No Return | Delete account |
| Light turbulence (quiz result) | 2 of 3 correct |

Aviation flavour is retained in moments: the greeting (Cleared for departure, Hassan), the
debrief, empty states, unlock moments.

### 8.4 Empty states

**Never render a zero.** No `0 threads`, no `0 notes`, no eleven dashed empty seats. Show
floor content or show nothing.

Rewrite every empty state as an invitation, not a failure report.

## 9. Screen specs

### 9.1 Home

Home is a launchpad, not a dashboard. It answers one question: **what do I do right now.**

Three numbers maximum: progress, average score, streak. Everything else (accuracy by
module, weakest topic, questions answered, time studied) belongs in the Logbook. Guard
this line — "and so on" is how home becomes an instrument panel.

Four bands:

**1 · Greeting** — one line, small, caption weight. The one voice moment. Streak lives in
the header pill only (delete the windsock ladder — it is a second copy of the same
number).

**2 · Hero** — the active module. Only one module is active at a time.

Priority order, largest to smallest:

1. **The next action** — `Continue → JT.02 · Combustion Chamber Basics`. Largest text on
   the page. This is the attitude indicator. (Currently the greeting is largest and the
   action is a small pill — inverted.)
2. **Module identity** — `JT · Jet Turbine Fundamentals`, small, above
3. **The segmented bar** (see 9.1.1)
4. **One caption** — `1 of 4 complete · 2 in progress`
5. **The score dial** — 68% with a 75% pass marker

The existing NEXT UP band is absorbed into this and deleted.

**3 · Parked modules** — rows, not cards. `PROP · Propulsion Systems ···· 0/4 ···· Make
active`. Thin bar, code chip, name, count, one action. Four rows fit a phone without
scrolling.

**4 · The door** — `Ready Room · 4 on frequency`. Full width, bottom of the academic
block. The only warm element on the screen. Neutral when nobody is there — it must never
advertise an empty room.

#### 9.1.1 The segmented progress bar

The centrepiece. Answers chapter count, per-chapter progress, and overall progress in one
object.

- One segment per chapter. The number of segments **is** the chapter count — read without
  a label.
- Each segment fills in two halves: hairline outline = not started · half = brief watched
  · full = quiz passed. Comments is not progress and fills nothing.
- Multiple partial segments express simultaneous study — which a single percentage cannot.
  This is why the current 25% radial is wrong for the model.
- The current chapter carries the accent. Everything else neutral.
- The bar is also the chapter selector — tap a segment, go there. One object, two jobs.
- Labels JT.01–JT.04 beneath on desktop; on tap on mobile.
- Same treatment, thinner and unlabelled, on parked module rows.

#### 9.1.2 Dials

Real glass cockpits distinguish these, and the distinction is correct here:

- **Round dials** answer "how close to a limit?" — there is a redline.
- **Bars/tapes** answer "where along a range?"

So: progress → segmented bar. Score → one dial, with the pass mark as a redline. **One
dial on screen, ever.** Four dials is a dashboard; one dial next to plain type is an
instrument.

Make the dial the door to the Logbook (tap → Logbook). Second job for one object, and it
finally surfaces Logbook out of the avatar menu.

#### 9.1.3 Mobile

```
Greeting                     one line, small
──────────────────────────────────────────
Module code + name           small
Continue → JT.02             largest text on screen
[▓▓▓▓|▓▓░░|▓░░░|░░░░]        full width, 4 segments
1 of 4 complete · 2 going    caption           ⌾ 68%
──────────────────────────────────────────
PROP   Propulsion      0/4   ▸
AERO   Aerodynamics    0/4   ▸
NAV    Navigation      0/4   ▸
WX     Weather         0/4   ▸
──────────────────────────────────────────
Ready Room · 4 on frequency
```

Proportions:

- Hero ≈ one third of the first screen — dominant, but not requiring a scroll to see
  anything else
- Everything shares one left edge (the NEXT UP glow currently breaks this)
- Bar is 8–10px visually with a 44px touch target
- Dial ~48px, on the same row as the caption — never its own band
- Parked rows 56px, whole row tappable
- Three type sizes on this page

Desktop is the same layout, not a different one. Do not re-grid parked modules into cards
— the horizontal card rail is the problem being removed.

#### 9.1.4 Active module switching

Make active must be one tap, instant, reversible, and must never ask "are you sure."
Focus comes from the screen showing one thing, not from the system preventing change. Any
friction here reads as a cage.

### 9.2 Module page

Two tabs: **Chapters · Library**. (Social and Comms move to the Ready Room, scoped by
module.)

Keep the radial completion gauge in the hero — it is the one earned dial and the most
premium element currently in the app.

One search field, scoped to the active tab. (Currently two: "Search chapters" and "Search
the library".)

### 9.3 Chapter — three tabs

**Brief · Quiz · Comments**

These are a sequence, not a menu: learn → test → ask. The tab bar should read as a
progression and the app should walk the user along it:

- Finish the video → Quiz lights
- Finish the quiz with a miss → Comments lights, with the missed question ready to ask

Brief is correct terminology: a pre-flight briefing is literally "here's what you need to
know before you go."

**Critical fix:** the chapter currently renders two different ways — serif single-column
via Resume, sans two-column via All chapters, with different fonts, widths, and footers
(Notebook · Discussion vs Quiz · Comments). Collapse to one.

#### 9.3.1 Brief

One scroll, in order:

1. **Video** with timestamps so users can jump to the bit they missed
2. **"What you'll know after this"** — 4–6 lines written as flat statements of fact, not
   vague objectives. "Why the inlet is divergent and what ram recovery gives you for
   free." These double as revision material.
3. **Key terms** — a short strip
4. **Notes** — the existing prose, below

Skimmers stop at the bullets; deep readers continue. Keeps the good Newsreader typography.

Remove: "Trouble loading? Open on YouTube directly" shown before any trouble occurs · "Tap
a chapter below to begin ↓" · Recently Viewed chips above content · the Formation card
above the video.

**Nothing may sit above the first line of content.**

#### 9.3.2 Quiz

Sterile cockpit. Question, options, explanation. Nothing else.

Required additions:

- **An explanation on every option**, not just correct/incorrect. This is the single
  biggest study gap in the product.
- **"41 pilots got this wrong first time"** — comforting, social, requires nobody online.
- **Ask about this →** on a miss: drops into Comments with the question already quoted. No
  retyping, no context loss. This link is what will make the chat busy — the moment of
  confusion is the moment people will type.

Fix: hover state currently looks identical to selected state (same accent chip + border) —
hover gets a faint value lift, selected gets the fill.

Keyboard: 1–4 / A–D to answer, Enter to continue. Currently documented only in a footnote
at the bottom of Preferences — surface it in the quiz.

#### 9.3.3 Debrief (end of quiz)

Replace `Light turbulence · Retake set` — currently a dead end with no score and no exit.

```
Debrief — JT.01
2 of 3 correct. The compressor stage question trips most people.

  [ Review the one you missed ]
  [ Next: JT.02 → ]

Leave a note for the next pilot:  ____________
12 debrief notes from other pilots  ▾
```

This is the moment of maximum reflection and it produces a permanent artefact. It is the
highest-value social surface in the academic section.

#### 9.3.4 Comments

Live, familiar, WhatsApp-shaped. Copy the conventions people already have in muscle memory
and invent nothing:

- Bottom-anchored input, newest at bottom
- Avatar left, own messages tinted
- Tap/hover to react or reply-quote
- `typing…`
- Day dividers and an unread line (`14 new`) so returning has a landing point
- Relative timestamps: 2m, 09:42, Yesterday

**The one novel affordance** — and the reason this works long-term:

A pure linear chat is worthless a week later. The answer to "why is B wrong" is your most
valuable object and in a chat log it scrolls away. Three failures: it doesn't accumulate,
unanswered questions drown, and an empty chat looks deader than an empty list.

So: **the atom is a question, not a message.**

- Any message can be marked a question
- A reply can be marked as answering it
- Answered questions pin to the top of the tab as a short collapsed strip: "Answered here:
  why blades get smaller · what surge sounds like · stall vs surge"
- Chatter flows past and is allowed to disappear

Live chat at the bottom, settled knowledge at the top. This is how a good study group
already works.

Unanswered questions older than a few hours surface in the Ready Room as **open squawks**
so nothing dies in a scrollback.

**Register:** Ready Room mechanics, academic manners. Chat-shaped and live, but calmer —
no haptics, no arrival animation, muted rather than warm. A conversation happening in a
library.

#### 9.3.5 Academic social allowance — hard limit

On the academic side the entire social budget is:

- The Comments tab, with a small live count (`Comments · 3 here`)
- Anonymous aggregate numbers in the quiz

That's it. No formation cards, no squadron seats, no wingman prompts, no "waiting for one
more", no avatars in the reading, no activity feed.

### 9.4 Ready Room

A room, not a feed. Present tense only. Feeds are graveyards at low density.

One scroll, four bands:

**1 · Now** — who's on frequency, which module, what's starting. Top of the room because
it's the reason the door was opened.

**2 · Open squawks** — unanswered questions pulled from every chapter, with context
attached. This is the room's purpose: a permanent supply of ways to be useful, and the
reason it is never empty. Answering one deposits the answer back into the chapter where it
belongs.

**3 · Your crew**

- **Teams** — self-formed, 3–6 people, persistent, own chat. Strongest retention mechanic
  in the plan: people return for their group, not for the app.
- **Study partners** — matching for anyone without a team. Match on **complementary**
  strengths, not similar ones ("You're ahead on JT, they're ahead on NAV"). Similar
  matching produces two people stuck on the same thing; complementary matching produces a
  reason to help.

**4 · Module channels** — one per module. Broader than a chapter: exam strategy,
resources, "how was the JT test", morale.

#### 9.4.1 The boundary rule

Two discussion surfaces need a crisp line, enforced in input placeholders (where people
actually read instructions):

- Chapter Comments → "Ask about this chapter…" — specific, technical, tied to what's on
  screen
- Module channel → "Anything about Jet Turbine…" — subject and exam, everything broader

Safety valve: a message can be moved to the right chapter.

#### 9.4.2 Squawk

The help-request mechanic, using real aviation semantics:

- **7600** (radio failure) — "I've read this three times and I don't get it"
- **7700** (emergency) — "checkride Thursday and I'm lost"

One gesture out from a question, one gesture back with the answer. Resolved squawks become
permanent content attached to the question.

#### 9.4.3 Squadron & formation

**Squadron = cohort, not seats.** Replace the 12 slots (11 visibly empty — the most
demoralising surface in the product) with `6 pilots · ATPL-24`. Six feels deliberate. Six
of twelve feels like failure. Same six people.

**Formation = ephemeral and scheduled**, not a permanent room advertising emptiness:

- 2–4 pilots, one chapter, one session
- Either "now" or scheduled ("tonight 20:00")
- Simultaneous quiz run; answers reveal after everyone locks in
- The room dies when the formation ends
- Never render a formation nobody is in

#### 9.4.4 Welcoming — the cost of the first message

An empty text box is not an invitation, it's a blank exam paper. Asking a question in
public means admitting you don't know something in front of people you'll fly with.

- **Risk-free first actions:** react to a message · answer an open squawk (safe — it has a
  right answer and you're being useful) · "+1, I had this too" on someone else's question.
  This is what a newcomer does before they ever type.
- **Normalise not knowing:** `12 others asked this too` · `41 got this wrong first time`
- **Pseudonymous by default** — username, not real name, everywhere social. Being visibly
  bad at something in front of classmates is the most common reason study-social features
  go unused.
- **Set the norm in one line:** "Nobody here has it figured out yet. Ask the dumb
  question."
- **Mark newcomers gently** — a small "new this week" so veterans can be kind
- **Count helping, not grinding** — `You've helped 4 pilots`, never `You've studied 12
  chapters`. Never rank people by knowledge; rank nothing, or rank helping.

#### 9.4.5 Notifications

Live chat means pings, and a muted chat is a dead chat. Default to: replies to you, your
teams, and answers to your questions. Nothing else. Let users opt into a whole chapter.

### 9.5 Logbook

Currently a four-tile strip mixing real stats (20 chapters ahead, 2 day streak) with
instructions (Take a quiz to set your accuracy, Flag a question to squawk it). Tiles are
one thing. Move prompts out.

A 14-cell "last two weeks" strip with 2 filled cells is a weak payoff for the most
motivating page in a study app. It should hold: accuracy over time, weakest module,
questions missed twice, chapters due for another pass.

Home answers **what do I do now.** Logbook answers **how am I doing.** Hold that line.

### 9.6 Settings

- **APPEARANCE** — Livery (six ramp strips) · Dark mode · Text size
- **PRESENCE** — Study glow (off / subtle / clear) · Fly invisible · Haptics
- **READING** — Reduce motion · Dyslexia-friendly font
- **ACCOUNT** — Name · Bio · Email · Username · Course/class · Reset progress
- **DANGER** — Delete account (the one beacon-red in the product)

Fixes:

- **One Save button**, sticky, enabled on change. Currently five (Save name, Save bio,
  Change, Save, Save).
- **Resolve the privacy contradiction.** The page currently says "Progress is saved
  locally on this device only — nothing is sent anywhere" while also offering an account,
  email change, a username "shown in Comments and Discussion", and class-based partner
  matching. These cannot both be true. Write one clear sentence about what is shared, what
  is pseudonymous, and what is private. Ambiguity here suppresses participation more than
  bad UI does.
- Delete the Features panel from shipping builds.
- Move Progress (→ Logbook) and Bookmarks (→ Saved) out of the avatar menu into the main
  nav.

## 10. Cold start

None of the social layer works against an empty database.

- **Seed it.** Write one good explanation for every question before launch. A thread with
  one solid answer invites a second; an empty thread invites nothing. This is stocking a
  library, not cheating.
- **The invite is a chapter link.** Requires §2.2 routing. A student sending a classmate
  "look at question 3 on this page" is the entire growth loop.
- **Launch into one cohort, not to the public.** One class, one course code, one module.
  Thirty people in JT feels like a real place; thirty people across five modules feels like
  nobody.
- **Don't ship a social surface where it's empty.** Turn it on per-module once there's
  content. A module with no social surface is fine; a module with a visibly abandoned one
  is not.
- **Rituals beat feeds at low density.** Concentrating 30 users into one hour feels like
  300; spreading them across a week feels like zero. A weekly "Ground school, Tuesdays
  20:00" will do more than any UI.

## 11. Safety & moderation

**Wrong answers are a safety problem.** This is aviation. A confident, upvoted, incorrect
explanation of compressor stall recovery is worse than no explanation.

- Ship a visually distinct **verified** tier from day one — content checked by the
  maintainer or a real instructor
- The status ladder (Student → Private → Instrument → Commercial → CFI) is the moderation
  model, not a gamification nicety. CFI status unlocks the ability to mark an explanation
  verified.
- Standing is earned by helping, never by grinding chapters

## 12. Accessibility

- **No meaning carried by hue alone.** Correct/wrong use value + fill + shape (§4.5).
  Colour vision is tested on every aviation medical; some users hold restrictions and all
  are aware of it.
- **Contrast:** text-primary and text-secondary must clear WCAG AA against bg-ground and
  bg-panel in both modes. text-tertiary is for non-essential metadata only.
- Focus rings exist today and work — keep them, and ensure they survive the monochrome
  change (they must be a value step, not a hue).
- **Tab order:** destructive actions must not sit adjacent to primary ones. Leave is
  currently the 6th tab stop, immediately after Continue — move to an overflow menu.
- Section headers on Settings (Appearance, Accessibility & Motion) are currently `div`s —
  make them real headings. Tabs should be a real tablist.
- Add a `<nav>` landmark once §2.3 navigation exists.
- Test presence glow at 30% brightness with a blue-light filter on. If it's invisible, the
  fallback (count, name, face) must carry the information.

## 13. Token budget

| | Count |
|---|---|
| Primitives | 1 mono ramp × 13 steps + beacon ≈ 20 |
| Semantics | ≈ 25 |
| Livery variables | 3 (base hue, chroma mult, presence hue) |

Down from ~192 loose custom properties, with every remaining token having a nameable job.

## 14. Known bugs

| # | Bug | Notes |
|---|---|---|
| 1 | No routing — every screen at `/` | No back, no deep links, no sharing. Blocks the growth loop. |
| 2 | Theme attribute/storage desync | `pw-theme: "dark"` while `data-variant="day"`. Body previously painted a hardcoded `rgb(11,21,38)` while tokens had switched — caused by components bypassing the token layer. §3.1 prevents recurrence. |
| 3 | "Show real name instead" is ON but home greets `h.alrefaei` | Setting not applied to the hero. |
| 4 | Score mismatch — squadron feed logged `JT.01 — 2/6 correct` for a 3-question set | |
| 5 | Begin on an already-enrolled module shows `Joining…` ~2s then reverts, no navigation | |
| 6 | Hover state identical to selected state in the quiz | |
| 7 | Module card body not clickable — 290×200 card with a ~90px hit target | |
| 8 | NEXT UP decorative glow wider than its content column | Visible misalignment on every load. |
| 9 | Two chapter renderings for the same content | Different font, width, and footer labels. |
| 10 | Correct and incorrect both rendered in the same teal | Resolved by §4.5. |
| 11 | Theme toast reads `CABIN CREW, DOORS TO MANUAL` — says nothing about what happened | |
| 12 | Three naming layers for one concept: `data-livery`, `pw-accent-color`, `tail` | Collapse to `pw-livery`. |

## 15. Implementation order

**Phase 1 — Foundation (nothing visible ships)**

1. Routing (§2.2)
2. Primitive + semantic token layers (§3) — components must stop referencing raw values
3. Type scale, weights, tracking (§5)
4. Fix bugs 2, 3, 6, 8, 10

**Phase 2 — Academic**

5. Home rebuild: four bands, segmented bar, one dial (§9.1)
6. Chapter collapse to one rendering, three tabs (§9.3)
7. Quiz: sterile cockpit, explanations on every option, illumination system (§4.5, §9.3.2)
8. Debrief screen (§9.3.3)
9. Naming glossary + placard relabelling (§8)
10. Delete list (§6.6)

**Phase 3 — Presence & theme**

11. Monochrome ramp + six liveries, moved to Settings (§3.4)
12. Presence light & motion system; promote Study glow (§4)
13. Surfaces, panelling, glow rules (§6)

**Phase 4 — Social**

14. Comments with question-as-atom + pinned answered strip (§9.3.4)
15. Squawk bridge (§9.4.2)
16. Ready Room: Now / Squawks / Crew / Channels (§9.4)
17. Teams and complementary partner matching
18. Verified tier + notification defaults (§11, §9.4.5)

**Do not start Phase 4 without §10 (cold start).** An empty Ready Room is worse than no
Ready Room.

## 16. The one-question test

For any element on any screen:

> Which rung is this on — and is anything from a lower rung sitting above it, or louder
> than it?

That resolves layout, type, colour, motion, and navigation. If it doesn't resolve a
decision, the decision probably doesn't matter.
