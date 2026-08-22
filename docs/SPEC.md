# Project Wingman — Redesign Specification

Complete brief for rebuilding wingman.institute. This is the source of truth.

> **Working note for agents:** do not paste this document into a prompt. Reference it
> by path and read only the sections the current build step needs. Build in the order
> in §17, one step per session, committing each. See `docs/SPEC-PROGRESS.md` for state.

## 0. How to use this document

You are redesigning Project Wingman, an aviation study app for student pilots. This
document is decisive on purpose: where it states a value, use that value; where it
states a rule, the rule has no exceptions unless the document names one.

Read all of it before writing code. Build in the order in §17. Ship against the
checklist in §18.

Three sentences govern anything this document leaves open:

- Studying is quiet. The app is never quiet. You are never the first one to speak.

The third is the hard one. A social product that waits for its users to start is a
social product that dies. Wingman goes first, in every empty room, every time.

## 1. Thesis

The name promises a person beside you. The current product is a course player with a
social tab bolted on. Everything below closes that gap.

Wingman is a learning app first and a social app a close second — but the social layer
is not a feature area, it is the atmosphere the learning happens inside. A user should
never be able to point at "the social part." They should just never feel alone.

The emotional target moves from **cockpit at night** — precise, technical, lonely — to
**cockpit at dawn**: same instruments, same discipline, light coming up under the panel,
somebody on the radio.

### Non-negotiables

1. The chapter body is a social-free zone at every breakpoint. No avatars, no counters,
   no rails, no badges. Presence there is expressed as light only. §7.6 defines the
   exact boundary.
2. No empty state may show a zero without also showing a face and an action.
3. Never fabricate users, activity, or presence. Not one synthetic avatar, not one
   seeded "3 people studying." The moment a user notices, every warm thing in the app
   reads retroactively as manipulation and the trust does not come back. §7.1 specifies
   how to fill squadrons honestly at low volume.
4. Never shame. No broken-streak guilt, no loss aversion, no red. A returning user is
   met with "welcome back," full stop.
5. Warm is people. Cold is the machine. §2.2 states this precisely; it is the spine of
   the whole visual system.

## 2. The Livery System

This replaces accent colors entirely. **There are no accent colors in Wingman.**

### 2.1 What a livery is

An airline livery is a complete paint scheme — fuselage, cheatline, tail, cowling,
titles. You recognize a carrier from its tail at a mile out, and yet every livery is
unmistakably an airliner. Different, but the same.

A Livery in Wingman is a complete theme, chosen by the user, that becomes their identity
across the app and is visible to other people. It is not a settings preference. It is
what they fly.

### 2.2 The structural law

Every livery ships exactly two channels.

| Channel | Means | Appears as |
|---|---|---|
| Cold | The machine | Progress, navigation, instruments, structure, chrome, selected states, focus rings |
| Warm | People | Two forms only — see below |

Warm has exactly two forms, and this distinction resolves the whole system:

- **Individual warmth — tails.** A specific person: avatar ring, presence dot, message
  leading edge. Drawn from that person's livery.
- **Collective warmth — ambient light.** The presence of company in general, or of a
  group: the cheatline, the study glow, Formation chrome. Drawn from the room.

Nothing else in the app may use the warm channel. Not warnings, not CTAs, not
decoration, not empty-state illustrations.

The hues rotate per livery. The relationship never does.

### 2.3 The generative rule

Work in oklch. Fix everything except hue.

```
cold      = oklch(0.78  0.125  Hc)      where  Hc = (Hw + 160) mod 360
warm      = oklch(0.80  0.135  Hw)
cold-day  = oklch(0.52  0.145  Hc)
warm-day  = oklch(0.55  0.155  Hw)
```

Lightness and chroma are constants across the entire system. Only hue moves, and the
cold hue is always derived.

- Same L → contrast can never break.
- Same C → no livery is louder than another.
- Same 160° separation → every pair carries identical harmonic tension.

One degree of freedom. Never hand-pick a livery color. Derive it.

Warm hues are restricted to the arc 345° → 90° (105° wide). Cold therefore lands in
145° → 250°. Nothing outside those arcs is a livery, because "warm means people" must be
perceptually true, not merely declared.

### 2.4 The six liveries

| Livery | Mood | Hw | Hc |
|---|---|---|---|
| Aurora | Rose over jade. The strange one — proves the system isn't blue-and-orange. | 350 | 150 |
| Sunset Approach | Coral over teal. Warmest social feel. | 20 | 180 |
| Carrier Deck | High-vis orange over steel. Industrial, serious, equipment. | 40 | 200 |
| Dawn Patrol ★ | Amber over sky. The default. First light, engines up. | 55 | 215 |
| Contrail | Pale gold over high blue. Thin air, clean lines. | 70 | 230 |
| Night Ops | Instrument gold over deep indigo. For 1am. The quietest livery. | 88 | 248 |

Resolved values are reference only — see §2.14. Compute at runtime from §2.3.

| Livery | warm night | cold night | warm day | cold day |
|---|---|---|---|---|
| Aurora | #FE98CA | #79CE8C | #B0437E | #007F37 |
| Sunset Approach | #FF9899 | #41D1BA | #BB424A | #00826C |
| Carrier Deck | #FF9E79 | #2CCFD7 | #B9491C | #007F8A |
| Dawn Patrol | #FFA564 | #39CBE9 | #B35200 | #007B9C |
| Contrail | #F5AD53 | #52C6F8 | #A95C00 | #0075AB |
| Night Ops | #E2B849 | #73BEFF | #976900 | #006CB7 |

### 2.5 Surfaces and text

Surfaces carry a faint cast of the livery's cold hue — the fuselage.

```
                NIGHT                        DAY
surface-0       oklch(0.15  0.020  Hc)       oklch(0.980  0.008  Hc)   app background
surface-1       oklch(0.19  0.018  Hc)       oklch(0.950  0.008  Hc)   cards, rows
surface-2       oklch(0.24  0.016  Hc)       oklch(0.995  0.004  Hc)   sheets, menus, popovers
hairline        white @ 6%                   black @ 8%
text-1          oklch(0.95  0.010  Hc)       oklch(0.220  0.014  Hc)
text-2          oklch(0.70  0.012  Hc)       oklch(0.450  0.014  Hc)
text-3          oklch(0.52  0.012  Hc)       oklch(0.600  0.012  Hc)
```

In Day, surface-2 is lighter than surface-1. In Night the ramp runs the other way. Both
are intentional.

Night fuselages: Aurora #060E07 · Sunset #030E0B · Carrier #020E0E · Dawn #030D10 ·
Contrail #030D12 · Night Ops #050C13

Pure black is banned — it kills the sense of atmosphere. Pure white is banned for the
same reason; Day surface-2 carries a 0.004 cast.

### 2.6 The cheatline

Every primary surface carries one warm gradient rising from the bottom edge: the
livery's warm channel at 5–7% alpha, feathered over ~40% of viewport height. This is the
horizon, and it is collective warmth under §2.2.

On screens that split solo content from social content, the cheatline moves to the seam
and becomes the transition device — never a border, never a divider rule.

The cheatline does not appear on the chapter body (§7.6), where the study glow takes its
place.

### 2.7 Livery anatomy

| Part | UI role |
|---|---|
| Fuselage | Base surfaces and their hue cast |
| Cheatline | The horizon gradient |
| Tail | Personal identity mark: avatar ring, presence dot, message edge |
| Cowling | Instrument accents: arcs, gauges, the altimeter tape |
| Titles | Nameplate and heading treatment |
| Registration | Callsign, always set in mono |

### 2.8 Whose livery shows where

Your livery paints the app. Other people appear only as their tail, or as light.

Chrome, surfaces, cheatline, instruments, and every cold-channel element are always
yours. Your cockpit never repaints because someone walked past.

Other people's liveries may touch your screen in exactly four places:

1. Avatar ring — their warm channel, their tail marking.
2. Presence dot — chapter rows, radar, presence strip.
3. Message leading edge — a 2px bar in Comms.
4. The study glow — blended, per §7.6. Collective warmth, not a tail.

Squadron chrome (§2.12) is a fifth case and is a group's livery, not a person's.

### 2.9 Tail identity

A user's tail hue is their own livery's warm hue. Always.

Collisions are resolved with markings, never by changing someone's hue:

```
markings:  solid ring  |  double ring  |  dashed ring  |  notched ring
```

When two members of the same squadron have warm hues within 13°, the member who joined
later is assigned the next unused marking. 6 hues × 4 markings covers any squadron.

Every tail carries hue + marking + the member's initial, always, at every size down to
the 8px presence dot (where the initial drops and the marking remains). Colour is never
the sole channel for identity anywhere in this app.

### 2.10 Day and Night

Every livery ships both. Auto-switch on local time, tied to the existing time-aware
greeting. Users can pin to Day or Night in settings; the pin wins.

### 2.11 Earning liveries

Two are unlocked at signup: Dawn Patrol and Night Ops.

The remaining four unlock in a fixed global order — Contrail, Carrier Deck, Sunset
Approach, Aurora — one per completed module.

Never gate a livery behind payment. Never show a locked livery with a price.

### 2.12 Squadron liveries

A squadron carries a livery of its own, seeded from the module it formed around and
changeable by group vote. It paints shared surfaces only: the Comms header, the squadron
card, Formation chrome.

Entering your squadron's Comms should feel like entering their room, not yours. The
palette shifts under you for the duration and returns when you leave. This is the only
place another party's livery touches your chrome.

### 2.13 Contrast (verified)

| Check | Worst case | Requirement | Result |
|---|---|---|---|
| Channel colours on any surface | 4.12 (Carrier Deck / Day / cold on surface-1) | ≥3.0 for UI components | Pass |
| text-1 and text-2 on any surface | 6.16 (Sunset Approach / Night / text-2 on surface-2) | ≥4.5 for body text | Pass |

Channel colours are never used for text of any size. Icons, arcs, rings, dots, chips,
borders, and focus indicators only. All text comes from the text ramp.

### 2.14 Implementation

Emit tokens as CSS custom properties on a `[data-livery][data-variant]` root. Compute
from the §2.3 formulas at build time; do not paste the §2.4 hex tables into the codebase.

```css
:root[data-livery="dawn-patrol"][data-variant="night"] {
  --warm: #FFA564;                 /* fallback, generated */
  --warm: oklch(0.80 0.135 55);
  --cold: #39CBE9;
  --cold: oklch(0.78 0.125 215);
}
```

§18 requires zero hardcoded colour in components. Generated token files are the one
permitted location.

## 3. Type

| Face | Role | Notes |
|---|---|---|
| Instrument Sans | All UI | Technical, slightly narrow, aviation-appropriate |
| Geist Mono | Instruments | Codes, callsigns, chapter numbers, timers, streak digits, percentages. Tabular figures always. |
| Newsreader | Study Material | A serif — see below |

All three are SIL Open Font License and self-hostable. Self-host as woff2 with
`font-display: swap`.

```
--font-ui:     "Instrument Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono:   "Geist Mono", ui-monospace, "SF Mono", monospace;
--font-serif:  "Newsreader", ui-serif, Georgia, serif;
```

**Why the serif.** When a user enters a chapter, the cockpit gives way to a book. It
signals you are reading now, not operating; it holds up across three paragraphs of
turbine theory; it makes the study screen the calmest place in the app.

Do not use Inter, Roboto, Arial, or Fraunces anywhere.

**Scale:** 12 · 13 · 15 · 17 · 20 · 24 · 32 · 44

Study Material body 17 / 1.7, measure capped at 66 characters. UI body 15 / 1.5.
Labels 13. Mono instruments 13 and 20.

## 4. Space, depth, motion

Spacing on a 4 base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
Radii: cards 16 · sheets 24 · inputs 12 · chips 999 · avatars 999.

Depth comes from light, never borders. Elevated surfaces get a lighter fill and a soft
ambient shadow. Nothing gets a 1px outline except hairline dividers. Backdrop blur
appears on exactly one element — the collapsed Flight Deck status strip.

Motion: one orchestrated moment per screen.

```
enter            240ms   cubic-bezier(0.2, 0.8, 0.2, 1)
exit             160ms   cubic-bezier(0.4, 0.0, 1.0, 1.0)
presence pulse     8s    ease-in-out, infinite alternate
livery wash      600ms   the one indulgence in the entire app
page transition  280ms   shared-element
```

Shared-element transitions between a feed card and its detail: the avatar and chapter
chip persist across navigation.

**Fallbacks.** The Flight Deck collapse (§7.2) uses `animation-timeline: scroll()` where
supported. Where it is not, fall back to a passive IntersectionObserver toggling a single
class with a 240ms transition — never a per-frame scroll handler. Where View Transitions
is unsupported, shared-element transitions degrade to a crossfade.

`prefers-reduced-motion`: presence pulse becomes static at its midpoint, livery wash
becomes a 160ms crossfade, page transitions become instant, everything else caps at
120ms.

Haptics: light tick on selection; soft double-tap when a wingman replies. Nothing else.
Sound: none, except one optional quiet tone on a reply. Off by default.
Icons: inline SVG, stroke-based, 20px grid, 1.5px stroke, one family. Never emoji.

## 5. Instrument doctrine

An **instrument** is a bespoke, animated, metaphor-carrying visualisation. An
**indicator** is a plain progress arc, dot, or bar.

**One instrument per view, maximum. Indicators are unlimited.**

- Keep the altimeter tape for streak — the most distinctive thing in the product.
  Vertically stacked digits, current value in the cold channel, neighbours at 30%
  opacity, rolls on change.
- Delete the speed-dial gauge with needle and tick marks. Replace with a thin
  cold-channel arc, 2px, no ticks, no needle.
- Convert the radar from decoration to function: dots are real squadron members, radial
  distance is how far ahead or behind they are in the current module, angular position is
  arbitrary but stable per member. Tap a dot → that person.

Every instrument carries a plain numeric readout beside it.

## 6. Information architecture

Four tabs.

```
Deck  ·  Social  ·  Modules  ·  You
```

Deck and Social are the thumb poles on phone. Modules is the library. You is the logbook.

Delete the "Team & Partner" module sub-tab — social is a root surface. Module tabs
become: **Overview · Chapters · Comms**

## 7. Screens

### 7.1 First Flight (onboarding)

Three screens. Not a course picker first.

1. **"Meet your squadron."** Real faces animating in, with names and what they're studying.
2. **Pick your module.**
3. **"When do you usually study?"** One question, four chips: Early / Day / Evening / Late.

Then the livery picker (§7.11), then the Deck.

**The squadron fill ladder.** Target squadron: 10–20 members. Fill by descending this
ladder and stop at the first rung that reaches 10:

1. Same module, same study-time, comparable pace
2. Same module, any study-time
3. Any module, same study-time
4. Any active user

If rung 4 still yields fewer than 10, the squadron is **Forming**, and the app says so:

> "Your squadron is forming — 6 of 12 seats filled. We'll add pilots as they arrive, and
> tell you when someone lands."

A Forming squadron shows its real members at full size rather than padding the grid.
Empty seats render as outlined tail silhouettes labelled "open".

Wingman staff and instructors may hold real seats in early squadrons only if badged as
staff. Synthetic accounts of any kind are prohibited, including for QA in production.

At launch, prefer cohort intake — open signups in weekly batches.

### 7.2 Flight Deck — the horizon

**Above the cheatline — your flight.** Compact. Exactly four elements:

- Time-aware greeting in flight-ops voice ("Evening ops, h.alrefaei")
- METAR-style status line ("VFR · JT module · 4 chapters logged")
- One instrument — the streak tape
- One primary card — next chapter, large tap target, chapter code in mono

Resist a fifth.

**The cheatline** — the warm gradient, and the only place cold and warm meet.

**Below the cheatline — Traffic.** The activity feed, scrolling.

As the user scrolls into the feed, the academic layer condenses — the card collapses
upward into a slim sticky status strip carrying only next-chapter and streak. The
metaphor and the interaction are the same gesture. Implement per §4's scroll-linked
animation rule. It must be frame-perfect.

### 7.3 Social — the focal point

Opens into content. Never a menu.

**Top: the presence strip.** Horizontal rail of faces — who is flying right now. Each
avatar wears its owner's tail, with a mono chapter code beneath. Tap → what they're on.
Long-press → **Fly together**, which opens a Formation (§7.9) on that chapter and sends
them an invite. If they're already in a Formation, it requests to join theirs instead.

**Below: Traffic.** Exactly three item types. Do not add a fourth.

- **Ask** — a question with a chapter chip. Stacked faces of who replied, plus a count.
  Faces before numbers, always.
- **Formation** — someone opened a live session. Join button, avatars of who's in.
- **Logged** — someone finished something. The ambient warmth layer. One-tap reaction.

Composer copy is warm and specific, never "What's on your mind." Rotate:

- "Stuck on something? Ask your squadron."
- "Looking for someone to fly JT.03 with?"
- "Just finished a chapter — leave a tip for whoever's next?"

**Below the feed: "On your wing"** — suggested people matched by position in the
material, not by profile.

### 7.4 Modules (library)

Clean grid. Each card: 2-letter callsign badge, squadron code in mono, title, progress
arc (indicator), and — if squadron members are inside — a row of tails.

Keep the three distinct verbs: **Begin / Enroll / Leave**. Do not flatten to one button.

Filter placeholder: "Filter modules".

### 7.5 Module page

Tabs: **Overview · Chapters · Comms**.

- **Overview** — callsign badge, squadron code, description, the radar (the one
  instrument on this view), and a compact who's here row.
- **Chapters** — clean list. Each row: chapter code (mono), title, question count,
  runtime, and — if anyone from the squadron is on it — a single presence dot in their
  tail. That dot is the entire social layer of the chapter list, and it is enough.

Recently-viewed rail stays. Search placeholder: "Search chapters…".

### 7.6 Chapter — the calm

Two distinct surfaces live under this route:

| Surface | Social? |
|---|---|
| Chapter body — the reading and video surface | **Social-free.** No avatars, counters, badges, rails, cheatline. |
| Completion screen — after the last question | Social returns here. |

**The body.** Full-bleed. Single column. No tab bar. A 2px cold-channel progress hairline
at the top edge. Study Material in the serif, 17/1.7, 66-character measure, bolded
subheadings. Briefing video inline. Keep "Trouble loading? Open on YouTube directly".

**The ambient glow.** The body's one social element, and it is not an element — it is the
lighting.

```
n     = count of OTHER visible squadron members on this chapter, last 5 min
hue   = circular mean of their warm hues, capped at the 4 most recent
        (n = 0 → the user's own warm hue)
alpha = clamp(0.03 + 0.022 * n, 0.03, 0.12)
```

Alpha curve: alone 0.030 · one other 0.052 · two 0.074 · three 0.096 · four or more 0.120.

Circular mean, not arithmetic — hues near 350 and 20 must blend to ~5, not ~185.
Transition hue and alpha over 2s when n changes.

Users in invisible mode (§8.3) are excluded from n entirely.

No counter. No faces. No notification. The room is simply warmer, and it is warm in a
colour you know.

Tapping the glow opens a sheet with their faces and a "say hi." This is user-initiated,
so it does not violate the social-free rule.

The glow has a settings toggle. The chapter body must remain fully usable at 0% glow.

**The completion screen.** Exactly one social prompt:

> "Someone in your squadron is on this chapter now. Leave them a tip?"

Shown only when at least one visible squadron member is currently on the chapter.
Otherwise the completion screen is quiet.

### 7.7 Quiz

Keep: lettered A/B/C/D pill cards, cold-channel selected state, "Question 1 of 3" label,
the bookmark toggle.

Move: the "Was this chapter helpful?" thumbs to after the last question only.

Add: **"Call a wingman."** Not "Mayday". Sends a soft, non-urgent signal to the squadron
with the question attached. The aviation flavour lives in the motion — a warm sweep going
outward — not in an emergency word.

**The backstop.** A call must never go dark. If a call has no reply after 2 hours:

1. Select up to 3 squadron members who have completed this chapter, ordered by
   most-recently-active, excluding anyone who has muted the caller or been muted.
2. Send each a single notification (§11).
3. If still unanswered at 12 hours, widen to any user who has completed the chapter,
   same ordering, up to 3.
4. If still unanswered at 24 hours, tell the caller plainly that nobody has picked it up
   yet and offer to post it to Comms. Never let it silently expire.

Each member is nudged at most once per call, and at most twice per day across all calls.

### 7.8 Comms — group chat, properly

Not a forum. No threads, no upvotes, no accepted answers, no karma, no reputation.

A continuous channel per module: avatars left, consecutive messages grouped by sender,
day dividers, typing indicators, inline emoji reactions, pasteable images. Every bubble
carries its sender's tail on its leading edge.

Header wears the squadron livery (§2.12).

The one aviation-native addition:

- Any message can carry a **chapter chip**.
- Good answers can be **pinned to a chapter**.
- Comms can be **filtered to the chapter you are on**.

### 7.9 Formation (live study session)

Temporary shared session on one chapter, 2–6 people. Chrome wears the squadron livery.

A slim rail shows each participant's tail and their position in the chapter — "Ahmed is
2 questions ahead." Never a leaderboard, never a timer, never a score. Nobody loses a
Formation.

Ends when the last person leaves; leaves behind an optional pinned note in Comms.

The chapter body inside a Formation keeps the social-free rule.

### 7.10 You — the Logbook

History, bookmarks, saved answers from others, and your wing.

| Tier | Size | How | Feel |
|---|---|---|---|
| Squadron | 10–20 | Automatic at signup | Your cohort. Always there. |
| Wing | 1–3 | Chosen | Close. Their presence surfaces first. |
| Formation | 2–6 | Live, temporary | This session only. |

Logbook cover painted in the user's livery, callsign in mono.

### 7.11 The Livery picker

Not a settings row.

A gallery of tail fins — each livery rendered as a vertical stabiliser with its
cheatline. Behind them, a live Flight Deck preview that repaints as you scroll. Locked
liveries render as unpainted tails with the unlock condition ("Complete any module").

Selecting one runs the **livery wash**: the new palette sweeps across the app from the
cheatline upward over 600ms. Implement as a full-viewport fixed overlay painted in the
incoming surface-0, revealed by a `clip-path` inset animating from `inset(100% 0 0 0)` to
`inset(0)`, with tokens swapped at 50% and the overlay removed on completion.

### 7.12 Settings, billing, errors, legal

Plain English. Jargon-free zone. Keep the palette, drop the lexicon.

Settings must include: livery and Day/Night pin · glow toggle · invisible mode ·
notification controls · blocked users · data export and account deletion.

## 8. The social system

### 8.1 Cold start

Solved structurally, not with copy:

1. Auto-squadron at signup, per the fill ladder in §7.1.
2. **The app speaks first.** In a channel with no messages in 48 hours, Wingman posts one
   opener. Rules: authored by a human editor and stored per chapter, not generated at
   runtime; attributed to a distinct Wingman identity with a system badge and a
   cold-channel avatar (never a tail, because it is not a person); at most one per channel
   per 48 hours; suppressed entirely once the channel has ≥20 human messages in a week.
3. The completion tip prompt (§7.6) manufactures the first act of helping.

Never solve cold start by faking users or activity. §1, non-negotiable 3.

### 8.2 Matching

Rank suggested wingmen by, in order:

1. Same chapter, active now
2. Same chapter, active in the last 24h
3. One chapter ahead (they can help)
4. Same study-time answer from onboarding
5. Same module

Do not use profile similarity, demographics, or a follow graph.

### 8.3 Presence

Presence is a first-class data type.

- **Model.** `{userId, chapterId, lastSeen}`. Nothing else. No history, no dwell time.
- **Transport.** Server-Sent Events per squadron channel. Client heartbeats every 30s
  while a chapter is foregrounded; leave beacon on blur or unload.
- **Store.** In-memory or Redis with a 5-minute TTL. Presence is never written to the
  primary database and never retained. A user's presence history must not be
  reconstructable.
- **Scale.** Fan-out is per-squadron (≤20 members). Do not build a global presence bus.

**Invisible mode** is mandatory, exposed in settings, and:

- Invisible users still see everyone else. No penalty, no badge, no reduced matching.
- Invisible users are excluded from `n` in the glow, from the presence strip, and from
  chapter dots.
- The setting is per-account, persists, and never resets silently.

Presence data is never used for ranking, scoring, streaks, or comparison.

## 9. Safety and moderation

Not optional, and not deferrable — Comms accepts pasted images.

Every user can: block another user · mute a user in Comms · report a message, an image,
or a user · leave a squadron and be reassigned by the fill ladder.

Blocking is symmetric and total: blocked users do not appear in each other's presence,
feed, Comms, radar, glow count, matching, or backstop routing.

Images are stripped of EXIF on upload, scanned before display, and rendered behind a
tap-to-reveal for any first-time sender in a channel.

Reports route to a human queue with the message, the chapter context, and the channel.
Target first response within 24 hours.

Rate limits: composer posts, Calls, and Formation invites are all limited per user per
hour.

**Minors.** Student pilots may be under 18. Do not collect date of birth beyond what
compliance requires; do not build public profiles; default new accounts to squadron-only
visibility with no cross-squadron discovery.

## 10. Empty state doctrine

**No empty state may contain a zero without also containing a face and an action.**

| Never | Instead |
|---|---|
| "No contacts" | Squadron grid, each with a wave button |
| "No quizzes yet" | "Nothing to fly yet — three people are on JT.01. Catch up?" |
| Blank feed | The presence strip alone fills the screen |
| "—" for bookmarks | "Star a question and it lands here" + the chapter you're on |
| "No messages" | The app's opening line, badged as Wingman |
| Forming squadron | Real members at full size + outlined "open" seats |

## 11. Notifications

Warm, rare, never manufactured.

**Send:** someone answered your Call · a backstop nudge (§7.7) · someone joined your
Formation · someone left you a tip on a chapter you're about to start · a wing member
started studying (opt-in only) · a new pilot joined your Forming squadron.

**Never send:** streak-risk warnings · "you haven't studied in N days" · anything with a
countdown · anything red · re-engagement nags of any kind.

Caps: at most 2 backstop nudges per user per day, at most 5 notifications total per user
per day, none between the user's stated study-time window and 8 hours prior.

## 12. Responsive law

At every breakpoint a human is visible on screen — except in the chapter body.

| Breakpoint | Layout |
|---|---|
| ≤ 640 phone | Bottom tab bar. Deck and Social are the thumb poles. Chapter body full-bleed, hides the bar. |
| 641–1023 tablet | Two panes: content + persistent presence rail. |
| ≥ 1024 desktop | Three columns: slim nav rail · content · persistent right column, squadron presence above and Comms below. |

At desktop width, "never fly alone" stops being a tagline and becomes the layout.

The chapter body drops the rail at every size. Minimum hit target 44px everywhere.

## 13. Accessibility

- Every instrument carries a numeric readout.
- Every tail carries hue + marking + initial (§2.9).
- Contrast verified at §2.13. Channel colours never used for text.
- `prefers-reduced-motion` handled per §4.
- The study glow has a settings toggle and the body is fully usable at 0%.
- Full keyboard navigation on desktop, Comms included. Presence strip is an arrow-key
  roving tabindex.
- Focus rings in the cold channel, 2px, 2px offset, never removed.
- Presence and glow changes are not announced by screen readers — they are ambience.
  The tap-the-glow sheet is a normal, announced dialog.

## 14. Voice

Flight-ops chatter, warm rather than clipped. The voice of a good instructor who is glad
you showed up.

| Generic | Wingman |
|---|---|
| Dashboard / Home | Flight Deck |
| Course | Module |
| Lesson | Chapter |
| Lesson video | Briefing |
| Notes / Reading | Study Material |
| Community | Squadron |
| Group chat | Comms |
| Activity feed | Traffic |
| Study session | Formation |
| Close partners | Wing |
| Pass a note to someone | Handoff |
| History | Logbook |
| Completed | logged |
| Theme | Livery |
| User handle | Callsign |

Keep the time-aware greeting and the METAR-style status line.

**Rules.** Never shame, never urgency, never fake scarcity, never a countdown. Never
extend the lexicon into settings, billing, errors, or legal. Empty states are terse and
in-world but always carry a next action. The app's own posts are always visibly the app.

## 15. Delete list

- The speed-dial gauge with needle and ticks → thin arc
- The "Team & Partner" module sub-tab → Social becomes a root tab
- Decorative radar → functional radar or nothing
- Any accent colour not derived from a livery
- Any "N/A", any bare "—", any blank empty state
- Any red anywhere, except genuine destructive confirmation
- The header flag/counter pill

## 16. Ethical guardrails

- No fabricated users, activity, presence, or social proof. Ever. Including in QA builds
  that reach production.
- No shame mechanics, guilt, or loss aversion.
- No dark patterns in the livery unlock path; never gate a livery behind payment.
- Real invisible mode, no penalty for using it.
- Notifications only for genuine human events.
- Presence never used for ranking, scoring, or comparison between users.
- Presence never persisted or reconstructable.

## 17. Build order

Each step is shippable.

1. **Livery tokens + the cheatline.** Changes the entire emotional register first.
2. **Auto-squadrons + the fill ladder**, including Forming-squadron states.
3. **Presence as a data type** — §8.3, including invisible mode.
4. **Safety primitives** — block, mute, report. Before any UGC ships.
5. **Flight Deck horizon** with the condensing header.
6. **Social tab** — presence strip, the three Traffic types, "On your wing".
7. **The ambient glow.** Do not rush the blend and alpha curves.
8. **Completion tip prompt and Call a wingman** with the backstop.
9. **Comms as chat**, with chapter chips and pin-to-chapter.
10. **Livery picker** with the tail-fin gallery and the wash.
11. **Instrument cleanup, Formation, desktop three-column.**

## 18. Definition of done

- [ ] Every colour in every component derives from a livery token. Zero hardcoded colour
      outside the generated token file.
- [ ] Switching livery repaints the entire app with no visual regression, in Day and Night.
- [ ] A brand-new account sees real faces within seconds of signup, or an honest
      Forming-squadron state. No synthetic users exist in production.
- [ ] No screen can show a zero without a face and an action beside it.
- [ ] The chapter body contains no avatar, counter, badge, or rail at any width.
- [ ] The study glow visibly changes when a second person enters, and its hue reflects
      that person's livery. Invisible users do not affect it.
- [ ] Every instrument has a numeric readout; every tail has a marking and initial.
- [ ] A grayscale screenshot of every screen remains fully legible and usable.
- [ ] Block, mute, and report work end to end before any UGC surface ships.
- [ ] A Call never expires unanswered without telling the caller.
- [ ] Nothing in the app shames a returning user.
