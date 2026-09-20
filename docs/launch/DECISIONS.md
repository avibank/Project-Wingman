# Decisions

Where the build departs from the reference, and why. Anything here was a choice,
not an oversight.

---

## The zip's reference is a NEWER build than the first handoff's appendix

Found while porting `inspStamp`. The `WINGMAN-LAUNCH-HANDOFF.md` sent on its own
first carries an Appendix B in which the roundel's rim text runs along a
horizontal **bar** — `layout('roundel')` returns `bar:true` and `inspStamp`
reads `Ly.bar` to route the pattern through a rectangular ring rather than a
circular one. The zip's `docs/launch/reference/02-licence-stamp-creator.html`
has no `Ly.bar` at all: the treatment was taken out, and two variables it used
(`txt`, `barPat`) were left declared and unused.

**The zip wins.** Its own README calls the reference builds "the frozen design
spec", and it is the later delivery. So:

- `src/lib/stamp.js` is ported from the zip's HTML.
- `layout('roundel')` still returns `bar:true`; nothing reads it, exactly as in
  the reference. A roundel's pattern therefore takes the generic circular ring.
- `txt` and `barPat` are **kept**, dead, with an eslint-disable and a comment.
  Tidying them would make the file stop matching the spec it was ported from,
  and `check:stamp` compares the renderer against that file character for
  character — the tidy-up would fail the build, which is the right outcome.

If the bar treatment was meant to survive, it is a two-line restore and this is
the note that says so.

---

## The stamp is eight columns, not a jsonb blob

§4 writes the model as an object, `stamp { shape, code, rim, ring, pattern, ink,
seed, issued_at }`, and it would fit in one `jsonb`. Migration 0029 uses eight
columns for the reason 0016 gave for the pilot code: *"the CHECK below is that
alphabet, written where it cannot be bypassed."*

A blob can hold a shape this app cannot draw, an ink that is not in the palette,
or a code with a bracket in it, and nothing notices until one person's licence
renders wrong. Every constraint in 0029 mirrors `src/lib/stamp.js`, and
`check:stamp-db` drives all of them over the anon REST path.

## "Issued once" is a function and a trigger, not a policy

§4: *"The server rejects changes once issued_at is set."* A policy naming the
caller would deny every row here — `auth.jwt()` is NULL on every request
(0009's header) — so the rule lives in `issue_stamp`, a SECURITY DEFINER
function that refuses a second call, and in a `before update` trigger that
closes the direct PATCH path. Both are checked, and the trigger is the half a
client-side guard could never keep: anyone with the publishable key can PATCH.

The **seed is the server's**. It is what gives an account its own permanent ink
texture, and a client that chose it could choose somebody else's.

## The renderer returns an SVG string, and is set with dangerouslySetInnerHTML

The drawing is ~150 lines of string building. Converting it to JSX would mean
retyping every path by hand, which is exactly how a port stops matching its
reference. It stays a string, and the safety comes from the door rather than
from React: `drawStamp` is the only entry point, and the two student-supplied
parts — the code and the rim text — pass through `cleanCode`/`cleanRim`/
`escapeText` first. `check:stamp` asserts that a code and a rim of pure markup
draw nothing but text.

## The ink filters are shared, the SVGs are cached

§8: *"Crew walls with 100+ stamps stay smooth. Cache the rendered SVG per user
stamp and share the filter defs."* `<StampDefs>` collects the seeds on screen
and renders one `<filter>` each; `Stamp` memoises the built string on everything
that changes the drawing. A stamp still renders without the provider — it
carries its own filter — so it works in a test or a screenshot with no app
around it.

---

## "Nobody on it right now" is allowed to say nobody

CLAUDE.md's voice section: *"Never state absence or a zero count. Every empty
state names its next action inside the sentence."* The Crew tab has one line
that breaks it, and it is the reference's own copy.

It is a **status line**, not an empty state — the live counterpart to
"On it now · [faces]", answering who is on this chapter at this moment. The
block it sits in already names the action directly beneath it, on the wall:
*"No stamps yet. The first one here could be yours."* An invitation in both
places says the same thing twice, two rows apart.

It is named in `check:states` and in `check:doors` rather than matched by a
pattern, so anything *else* that states an absence still fails. Both were
plant-proved.

The search empty state did get the second half this app asks for: the
reference's *"Nobody by that name on Module 1."* plus *"Try a callsign, or
clear the search to see everyone."* — which is how the Library's own search
answers.

## The Crew tab's classes are prefixed, the reference's are not

The reference is a standalone page, so it can call things `.hrow`, `.av`,
`.wall`, `.stack` and `.pill`. This app cannot: the Crew tab renders inside
`.mscreen`, and `module.css` already owns `.mscreen .hrow` — a grid whose first
column is 38px. Same specificity, so source order decided, and every "Answering
questions" pill rendered **38px wide with 78px of content spilling out of it**.

`check:collisions` was happy: both rules are scoped. What catches it now is a
rule in `check:doors` asserting every class `crew.css` draws is prefixed
`crew-`, with three allowed by name. Layout, spacing and copy still match the
reference to the pixel; only the class names differ.

## A face is a button on its own and a span inside one

The "Answering questions" pill is a button, and the face inside it was a button
too — nested interactive content, which a browser fixes by splitting the
nesting and which laid the row out wrong. `Instruments.jsx` carries the same
note about a lamp inside a chapter header. `Face` takes an `inert` prop: the
control in a stack, a span inside a pill. The reference does the same thing —
its `face()` is a span and the stack's click is delegated.

## `--copilot` is a livery-engine token now

§2 wants a teal ring on a squadron mate's face and §3 wants the same teal for
the right-seat partner's marks on the scrubber. Two places that must agree, so
it is emitted from `liveryEngine.js` beside `--ok` and `--bad` rather than
invented in a component. Hue 190 and the day/night pair are the reference's
(`--copilot` in reference/01); only the name is this app's.

## Item 5 · the licence card

**The card is one component and the viewer is the same one.** §5 says so and
it is worth naming the alternative: a read-only copy that looks the same
today and drifts the first time either is touched. `LicenceCard` takes
`edit`, and that is the whole difference between the licence tab, "See it as
others do", and the dialog a stranger opens.

**The photo stays Clerk's.** It is the account's picture, the same one the app
bar draws and the one Fly solo hides. Choosing "Your initials" therefore
clears Clerk's image rather than writing a flag — there is no second place a
picture lives, so there is no second answer to what somebody looks like.

**The three stats are a projection.** The truth is the account's own progress,
which is private and has exactly one reader; the numbers on `pilot_profiles`
are the copy other people are allowed to see, written by their owner when the
licence is opened. Exactly what `callsign` and `real_name` already do. The
worst a drift can do is show a stale number on somebody else's screen; the
owner's own Flight Deck reads the truth.

**Days flown is a count and a date, never a list.** A set of every day somebody
studied is a thousand strings after three years, and nothing ever asks which
days. It is written by the same writer as the hour meter, because it is the
same event.

**Pattern scope is not offered.** The reference's studio has Both / Centre /
Rim, and `drawStamp` honours it. §4's data model is
`{shape, code, rim, ring, pattern, ink, seed, issued_at}` and 0029 stores
exactly those, so the choice would be lost on the next load. One column and
one line would bring it back.

**Symbols are not offered either**, and that is the reference's own decision:
the newer build maps its Mark tab back to Shape on the first line, and §4 says
"There are no symbols."

**The initials' colour is measured, not thresholded.** The reference switches
at `l > .7`, which puts white on Khaki at 2.67:1. It now picks whichever of
the two reference colours actually has more contrast on that ink — the same
two colours, a fact instead of a guess. On thirty of thirty-six it agrees with
the threshold.

**"Go by callsign" moved to Preferences rather than going away.** §5 settles
what the CARD shows — the callsign is its big line and only editable name —
which is a decision about the card, not about how somebody is named in a
thread. `identity_display` is still read by notebook.js and discussion.js, so
it still needed a door.

**Fly solo moved with it**, as §6 asks.

## Item 6 · the bar now starts at the pass mark, and that reverses an argument

§6 asks for Your bar "with the new wording", and the reference's wording is
"It starts at the 75% pass mark and can only go up from there", over a slider
from 75 to 100. The app's was 40 to 95, and `minimums.js` carried a written
argument for the wider range:

> Someone who has set 60 is told at 59 — and the dial still draws the real
> pass mark at its true offset, so lowering your own bar moves the requirement
> visibly off-centre and can never hide it.

Both cannot be true, so this is a reversal rather than a port, and it is
recorded as one.

**Why the handoff wins.** A bar under the pass mark is a lamp that stays dark
while you are failing the thing you are studying for: at 60, a 68% average
lights nothing, and 68% does not pass. Making that visible on a dial is not
the same as making it safe, and the one number a student is most likely to
read as "I am fine" has to mean it.

**What it costs.** `passOffset` is now always ≤ 0, so the dial's pass tick
sits dead centre or to one side only — half of a correct drawing is no longer
reachable. Reverting is two numbers in `minimums.js`.

**And one bug it caught.** The new copy interpolated `MIN_FLOOR` into the
sentence "It starts at the {MIN_FLOOR}% pass mark", which read "the 40% pass
mark" on the live site for about twenty minutes. The pass mark is `PASS_PCT`
and always was; the two are only the same number now by design.

## The avatar: one colour, not two

START-HERE lists `avatar_colour` and `cover_colour` as separate columns. The
reference does not have two — `avatarHTML()` draws the initials with
`avaBg(ME.coverColor)`, the same colour the cover is tinted with, and the
picker that sets it is the cover picker. One pick, two surfaces.

So there is one column, `cover_ink` (0030), and `faceInk()` reads it. Adding
`avatar_colour` with no control to set it would be a dead column, and the
check START-HERE gives — "set a colour, reload, initials show in that exact
colour in the card and the topbar" — is satisfied by the one.

## What is uploaded: the cover bakes its crop, the face does not

Both go through a crop, and they store different things, for a reason that is
about the shapes rather than about consistency.

A **cover** is a 5:1 band and there is nothing to re-decide later, so the
browser renders the crop into a 640×128 canvas and uploads that: ~40KB, no
EXIF, and the column holds a picture that is already the right shape.

A **face** is a circle over a square, and the reference lets somebody
re-centre it afterwards with a zoom and a drag that it *stores* rather than
applies. So the upload is the photo cover-fitted into a 512×512 square, and
`photo_zoom/x/y` are a transform on top of it (0033, avatar.css). Re-centring
costs no upload, and the same three numbers draw the same face at 28px in a
comment and 104px on the licence.

## The hour meter reads hours and minutes

It read `0013.9` on a tenths drum, and `hobbs.js` argued for it: that is what
an hour meter reads, and what the hours in a logbook are written in. A clock
face was the one thing it must not be mistaken for.

The owner reversed it, and the answer is short: nobody outside a cockpit reads
a tenth. `.9` of an hour is a number you have to convert before it means
anything, and this cell is read by somebody deciding whether they have done
enough today.

The old argument is kept in `hobbs.js` where it can be read. The one rule that
survived is the one that mattered — it only ever rounds DOWN, because a meter
that credited time nobody had flown would be worse than one nobody could read.

Two things fell out of the change. Under a minute it shows an em dash rather
than `0m`, which is the same zero-count rule the licence card's Hours flown
already follows. And what a screen reader hears agrees in number: "1 hour",
not "1 hours 0 minutes".

Where it counts is unchanged and is what was asked for: inside a module —
its screen, a chapter, a lesson, a quiz, a card set — and the paper reader.
`MODULE_ROUTES` in App.jsx is that list, and `check:gyro` now holds it.

## "Nobody else on Module 1 yet" — a heading is not the sentence

`check:doors` §5 refuses any line that states an absence without naming the
next action, and the Crew empty state's own title states one. The title is
the reference build's, word for word (`crewEmpty()` in
`docs/launch/code/14-crew-and-empty-state.js`), and START-HERE's first
instruction is that the reference IS the specification — two earlier passes
rebuilt these screens from a description instead and that is the defect being
repaired.

Decided alone, because the owner is away: the heading joins the rule's
**named** exception list rather than the copy being rewritten. The reason the
rule survives it is that the block satisfies §10 one element down — a
paragraph saying what Crew is and why it helps, then **Find a squadron** and
**Invite your class** as the two things to press, then a closing line that
says what happens when somebody else arrives. The rule reads one run of text
at a time and cannot see a button two elements away; that is a limit of the
check, not a licence to write a dead end.

It is narrow and was proved so by planting the bug: `"Nobody here yet."` added
to the same file still fails. Only `Nobody else on <module> yet` passes.

`check:states` needs nothing — its JSX scan stops at `{`, and the title
carries `{moduleName}`.

## Screen 2 — the licence card, and five calls made alone

The card's markup is now the reference's, class for class, and the pasted
sheet paints it. `npm run ref:diff licence` measures **0.23% at 1280, 0.29% at
768, 0.28% at 390**. What follows is every place the two deliberately differ,
and the measurement that decided it.

### 1 · The 44px hit floor gives way on five controls

§12 puts `min-height: 44px` under every button and input in the app, globally,
in App.jsx. On this card it cost 43px of height: the callsign field went 33 to
44, the bio 26 to 44, the phrase 32 to 44. The rule already names its own
exception — "the rare control that genuinely sits inside a line of text" — and
these are the definition of it. The callsign field IS the heading, the bio
field IS the line of prose, the phrase button IS a line of italic text.

The selector only implemented the exception for `button`. It covers `input`,
`select` and `textarea` now, which is what the sentence beside it always said.

Two more take it for a different reason, and this one is a real deviation
rather than a clarification: the **Cover** pill and the **camera** on the
avatar. The floor made the camera 30 wide and 44 tall — an oval where the
design draws a circle — and the Cover pill 44 tall on a 128px banner. They are
the design's 29 and 30 now. Both still clear WCAG 2.2 AA's 24px minimum target
size; §12's 44 is the stricter house rule, and this screen is a later
signed-off design. Everything else on the card keeps the floor.

### 2 · The profile page is one 680px column

Bug 5 says the card "should be the width of the tab strip above it, centred
under it". It was a 1240px page with a 520px tab strip and a 760px panel, all
flush left. Two of those three numbers had to go for the third to be true, so
the page is the reference's `.col`: 680px, centred, no gutter of its own —
`.content` already lays 22px and `.deck` 40 (16 on a phone).

Appearance narrows with it. Its contents are untouched, and it was looked at
at 1280 and 390 afterwards: the livery swatches, the specimen and the finish
tabs all still fit.

### 3 · The card carries no `--accent` of its own

The reference tints each card from the pilot's own livery. This app has ONE
livery system and the pilot one was deleted on 2026-09-04, columns and all
(migration 0013). Setting it here would be re-adding it. The owner's chosen
colour still reaches the card where the reference actually spends it — the
cover gradient and the initials circle, both from `cover_ink`.

### 4 · The code is seeded into the creator rather than asked for twice

Bug 7 says delete the YOUR CODE box; the code is chosen inside the creator.
Deleting it alone would have meant a pilot with a code typing it again from
memory, so the creator opens on the one the account already holds. Verified in
the browser: the field reads K4M on first open. `pilot_profiles.code` is still
claimed on sight and is still unique; the stamp's own code is free-form, as it
is in the reference, and the two can differ. Nothing displays the profile
column any more, so nobody can see them differ.

### 5 · Two things the scoped stylesheet had to put back

`scripts/scope-ref-css.mjs` cuts the reference's global reset, because a
scoped `*` is still every element on the screen. Two lines of it turned out to
belong to the screen rather than the page, and both were found by measuring:

  · **the type scale.** `15px/1.55` — without it these sheets inherit the
    app's 14px/1.62 and every line box is a fraction taller. The bio ran 27px
    against 26, the phrase 33 against 32, and the card finished 4px too tall.
  · **the button reset.** `button{font:inherit;…;border:0;padding:0}` — the
    reference's components set their own border and padding per class and
    assume nothing underneath. Without it the app's button chrome showed
    through: a 2px border round the Cover pill and 1px round the stamp ghost.

Both are emitted scoped to the bundle's root class, so neither can reach
anything that is not the reference's own screen.

### 6 · `.lbody` was two components

`lesson.css` styled `.lbody` from a bare selector — the logbook row's body —
and the reference calls the licence card's body the same thing. So the lesson
page's type scale reached across and set the card's body to 14px/1.62. It is
`.litem .lbody` now. `check:collisions` had passed it as the "shared-base
shape", which is only correct when the two really do share a base; a logbook
row and a licence do not.

### 7 · The reference pages are calibrated twice, and it is written down

`tools/make-ref-pages.mjs` adds two things to the reference build that are not
the design's, both so the diff measures the screen rather than the harness:

  · **the app's page gutter** (62px, 38 at and below 640px). The reference is
    a standalone file with 20px; the app has a chrome on every route. Without
    this the app's column is 644 at 768 where the reference's is 680, and
    ref-diff refuses any pair whose widths differ. Narrowing the app instead
    would move every other screen to fit a demo file's margins.
  · **a whole-pixel snap.** Playwright clips an element screenshot to its
    bounding box; where that box starts on a fraction, every glyph inside
    rasterises half a device pixel off. Measured on this card at 390: every
    child matched the app to within 0.1px while the picture came out 3.69%
    apart, because the reference put the card at y=306.55 and the app at
    y=362.00. The correction is padding on an ancestor — a transform was
    tried and promotes the card to its own layer, which resampled the cover's
    contour drawing across the whole banner.

The one thing this cannot catch is the page gutter itself, which is why it is
stated here rather than folded in silently.

### 8 · What is still not identical, and by how much

  · The callsign field is 178px wide against the reference's 185. `size="11"`
    on both; the app sets tabular numerals everywhere (CLAUDE.md), which
    changes the "0" advance the browser sizes the field by. Seven pixels of a
    dashed underline, against a house rule that applies to every screen.
  · The rest is anti-aliasing. 0.23–0.29% of pixels, and the diff images in
    `tools/ref-diff-out/` are yellow rather than red.

## Screen 3 — Preferences, and what was deleted rather than moved

`npm run ref:diff preferences` measures **0.47% at 1280, 0.48% at 768, 0.73%
at 390**. Every box on the tab is the reference's markup from
`docs/launch/code/09-preferences.html`, and every box's geometry now matches
the design to within a pixel.

### 1 · Two blocks are gone, and they are not somewhere else

The owner's words: both were cut in the design weeks ago and re-added by
mistake. So this is a deletion, not a move, and nothing replaces either.

  · **"Go by callsign"** is deleted. It wrote `identity_display`, which
    notebook.js and discussion.js still read; they read its default, which is
    the callsign — and §5 already settled that the callsign is the card's big
    line and its only editable name. The column and its readers are untouched
    (migrations are additive only); there is simply no longer a control that
    changes it.
  · **"Your pilot / What you'll hear about"** is deleted, and
    `src/components/PilotSettings.jsx` with it. It held no setting — it was a
    fixed list of the four things this app sends, written out as a statement.
    Replies, answers, squadron messages and the right seat are on by default
    and are not a choice, which is what the handoff says and what the list
    itself said in four bullet points.

### 2 · The greeter's order, and its words

The reference's order is the choice row, then ONE description line for the
selected greeter, then the field carrying that greeter's own placeholder.
Live it ran name, description, name again — the greeter's name said twice with
the control between them.

The placeholders are the reference's too (`GREET` in `10-preferences.js`),
which START-HERE §3 names as the source for this panel. The app's own were
longer tellings of the same joke and are kept here in case the owner prefers
them:

  · Wingman — "Skip it. I'll keep talking until you look up, same as always."
  · The Hermit — "Empty, leave it. Know who you are, I already do."

The character blurbs stay this app's, from wingman-voices.md. Wingman's is
word for word the reference's already; the Hermit's is longer here and is the
one the voice pack writes.

### 3 · The segmented strips are 47.7px, not §12's 54

This is a real deviation from the house rule and it is the one that decided
the diff. `.sega button` is 37.7px in the design; §12's global 44px floor made
each strip 54 and pushed everything below it down, twice — 8.8% of the screen
by itself.

A segmented button cannot be given a 44px target without making the strip
taller than the strip: the buttons tile it, so expanding one only overlaps its
neighbour. There is no version of this where both hold.

The reference build is the specification, so the reference wins, and the cost
is stated: 37.7px a button, which clears WCAG 2.2 AA's 24px minimum target and
is under this app's stricter 44. Appearance's identical-looking control is a
different component (`Seg`) and stays at 44, so the two tabs differ by 6px —
which is the price of not touching Appearance.

**To reverse it**, delete `className="is-inline"` from the two `.sega` button
maps in `Profile.jsx`. Nothing else depends on it.

### 4 · The blocked list had no heading to give and no loading state

It rendered `<h2>Blocked and muted</h2>` directly under a box already labelled
BLOCKED AND MUTED. The heading is gone; the box's `.lab` says it once.

It also returned `null` while it loaded, which left that box as a label over
nothing — a panel that names itself and then stops, which reads as a screen
that failed rather than one still asking. It holds the space with one quiet
line now, in the same element the empty state uses, so nothing jumps when the
answer arrives.

The empty line is still this app's — "Block or mute anyone from their tail,
and they'll be listed here to undo." The reference's own opens "Nobody yet",
which CLAUDE.md's Voice rule forbids and `check:states` enforces.

### 5 · Two tabs are not a flex column

`.panel` is a flex column with a 16px gap and the reference's `.box` carries a
16px bottom margin, so together they made every space on these two tabs 32.
Turning the gap off is not enough: a flex item is a block formatting context,
so the last box's margin could not collapse out of the panel either, which
left 16px of screenshot below the last box that the reference does not have.
`.panel.panel-ref` is `display: block`, and the margins are the whole of the
spacing — which is how the reference's own `#t-pref` measures.

### 6 · MOVED HERE is hidden on the reference pages

The reference marks Fly solo and Your bar with a `.new` sticker reading MOVED
HERE. That is the design telling the implementer they have changed tab — a
note to a reader of the demo, not product copy, and putting it on a live
screen would ship a label that means nothing to a student. `make-ref-pages.mjs`
hides it the same way it hides the demo bar, so the two sides measure the same
screen; it was worth 2px on the Your bar heading's line box.

### 7 · The snap only ever worked at one width in three

`snap()` corrected the reference element's fractional position by setting a
padding on its ancestor — and where the correction was negative, the browser
dropped the declaration silently. It rounded DOWN at 390, where the value
happened to be positive, and did nothing at 1280 or 768. It always moves to
the next whole pixel now. This is why Preferences read 1.12% with every
element matching to 0.1px.

## Screen 4 — the module screen, and the collisions it uncovered

Measured with `npm run ref:diff`: **module 3.42% / 4.41% / 8.64%**, **library
5.41% / 6.74% / 5.56%**, **crew 3.95% / 6.50% / 15.34%** at 1280 / 768 / 390.
Not under the 1% bar. Every box that is the design's now measures the design's
— the tab strip is exact, the chapter rows are exact, the Crew summary and all
three chapter walls are exact — and what is left is named at the end of this
entry rather than rounded off.

### 1 · The pack was missing this screen's base stylesheet

`01-tokens-and-base.css` is lifted from reference **02**, the licence file.
`11-module-screen.css` is lines 161–313 of reference **01**, the module file.
Everything reference 01 declares ABOVE line 161 was in neither: `.card`,
`.tabs`, `.tab`, `.chip`, `.log`, `.entry` — the card the module screen IS and
the tab strip along its top edge. Measured before it was noticed: the card had
no border at all and the tabs were 44px of app chrome against the design's 52.

`scope-ref-css.mjs` reads reference 01's whole style block for the module and
lesson bundles now. Still not retyped — read off disk, cut the same way.

### 2 · Four collisions, each of which had been invisible

Taking the reference's class names turned four of this app's own bare rules
into live bugs. `check:collisions` had passed all four as the "shared-base
shape", which is only correct when the two sides really do share a base.

  · **`.mscreen .mod`** — a Flight Deck tile styled inside `.mscreen`, where
    nothing has drawn one in months. It gave the reference's `.mod` a 176px
    minimum height, a housing border and 16px of padding round the screen.
  · **`.mscreen .search`** and the whole `.mcard`/`.tabsbar`/`.tabs`/
    `.tabsearch` strip — the app's own tab bar, now superseded. `.tab` and
    `.search` still matched the new markup and sized it as the old.
  · **`.mscreen .hrow`** — the hidden People tab's two-pane list, a grid. The
    reference calls Crew's helper row `.hrow` too, a flex row of pills:
    measured, one pill came out 38px wide and the next 790, with the row three
    lines tall instead of one. The whole People block is scoped under `.hub`
    now; nothing in it is changed except where it can reach.
  · **`.mscreen .chap+.chap`** — a border-TOP against the reference's
    border-BOTTOM, so every chapter after the first was a pixel taller and two
    hairlines sat on one seam.

### 3 · The tab pill became the underline

The reference marks the selected tab with a 2px accent border along its bottom
edge. This app slides that marker between tabs (CLAUDE.md). Both hold: the
pill IS a 2px bar on the pixels the reference's border occupies, so at rest
they are indistinguishable, and it still travels.

**Absolute, and that part is load-bearing**: `.mtabs` is a flex row with a 6px
gap, and in flow the pill counted as a flex item — every tab measured 6px
wider than the design's ("Lessons" at 63.9 against 57.9).

### 4 · Three things the app had that the design does not

  · **`.pane { min-height: 560px; padding-top: 12px }`** is gone. Both were
    this app's — 560 so switching tabs never made the page jump, 12 so the
    first row cleared the strip — and together they were 128px of card the
    design does not draw. The card sizes to its content now, like every other
    card here. The cost is real and stated: switching from Lessons to a
    shorter tab now changes the card's height, as it does in the reference.
  · **The closing line** ("That is all of Module 1 — 6 lessons and 3 quizzes")
    is gone except when searching. It is word for word the subtitle that bug
    14 just put under the module's name at the top of the same screen.
  · **The Library's per-segment placeholder** ("Search quizzes" or "Search
    papers", depending which half you arrived at) is one placeholder now. That
    was true of a Library with two sections; it has three, the field searches
    all of them, and a placeholder naming one lies about the other two.

### 5 · `done/total` on a study-card row is not drawn

The reference's card-set row shows `done/total` beside **Test yourself**.
Nothing in this app counts how many of a set's cards have been flipped — there
is no key, no writer and no reader — so the row shows the total alone until
something writes that count. Inventing a number a student would read as
progress is worse than a row that does not claim it.

### 6 · The fixture grew, and the Fly solo gate moved inside itself

`?fixture=demo` now also supplies the reference's three papers, its answer
counts (without them the "Answering questions" row does not render at all,
which is correct behaviour and a 146px hole in a diff) and its people's REAL
names rather than their callsigns — the reference draws initials from the real
name and the first word of it on a helper pill.

`fetchCrew`'s Fly solo gate is now `isFlySolo() && !demoOn()`. It was found the
hard way: pressing Fly solo while testing Preferences emptied the Crew tab in
every later measurement and took the count off the tab strip with it. The gate
is still the first thing the function does with a person's data;
`check:solo`'s window widened to 640 characters to read it.

### 7 · What is still not identical

  · **§12's 44px floor** on the "Open Module 1 threads" pill (36.1 in the
    design) and on the tab strip's controls where the reference is shorter.
    The search field and the segmented strips already take `.is-inline`; a
    genuine isolated button keeps the floor.
  · **The Library and Crew at 390** carry the most, because both stack and a
    few pixels per row accumulate down a long column.
  · The rest is content the fixture does not pin — chapter statuses ("Part
    way" against "Done"), which are harness progress rather than layout.

## Screen 5 — the lesson page, and the phone order the design does not have

Ported 2026-09-20. `npm run ref:diff lesson` measures **12.85% at 1280, 23.75%
at 768, 25.55% at 390**, and at 1280 every box matches the design: `.col` 734,
`.player` 412.9, `aside` 300, all to the pixel. What is left is content the
fixture cannot pin — the reference's player is a mock with a drawn equation
where this app has a real `<video>`, its chapter has three lessons to this
one's two, and its logbook holds different notes.

### 1 · The page is in the ordinary column now

The lesson route was `content--full`, out of the 1100px reading column so the
player could be bigger. The reference draws it in the same column as every
other screen, so that is where it is — and the player is what gives.

### 2 · Three of this app's own rules were still reaching it

  · **`.mscreen .lesson`** — an older two-column grid with a 330px rail, a 44px
    gap and `var(--pad)` a side. It took 60px off the column: 674 against the
    design's 734.
  · **`.lesson`** as the page wrapper's own name, which is the grid's name in
    the reference. The wrapper is `.lessonpage`.
  · **`.watch`**'s named-area grid, which the markup no longer renders.

### 3 · On a phone, Up next stays ahead of the thread

This is the one place the port does not follow the design. The reference's
phone rule stacks `.col` — player, title, logbook — and then the aside, which
puts Up next underneath the whole conversation. Its demo has three lessons and
two comments, where that costs nothing; a real chapter under a real thread
buries the page's own navigation, and Up next is how you leave a lesson.

`.col` stops being a box below 860 and its children become grid items in their
own right, so the four can be ordered: player, title, up next, logbook.
Nothing is re-styled, only re-ordered, and above 860 the reference's own
two-column rule is untouched. `tests/lesson-run.mjs` asserts the order at 800
and 390 — it always did; the assertion is why this was caught.

### 4 · Two live defects found with the owner's own browser

Neither showed in the harness, and both were found by pressing controls on
wingman.institute rather than by reading:

  · **The cover picker rendered inline at the foot of the page** — a bare close
    button 1,600px down, with `position: static` on the scrim and the sheet,
    so pressing Cover looked like nothing happening. The reference's picker
    rules are `.ref-lic .scrim`, `.ref-lic .sheet`, `.ref-lic .pick`, and the
    pickers mount beside the licence panel's boxes rather than inside them, so
    every one of them missed. `Sheet.jsx` carries its own `.ref-lic` wrapper
    now — a picker cannot lose its scope wherever it is mounted. (The first
    attempt put both classes on ONE element, which is a descendant selector
    matching nothing.)
  · **The Crew tab was blank while it loaded** — `return <div aria-busy>` with
    nothing in it, for the length of a real round trip. It is the empty state's
    own ghost rows now: the same picture, claiming nothing, so it cannot be
    wrong in the half second before the answer lands.

### 5 · `.exam-page` is taken as a scope, not as a layout

`exam-port.check.js` asks its three R4 questions inside `.exam-page` —
`$$('.exam-page a[href]')`, `!$('.exam-page .pill')`, `!$('.exam-page .avatar')`
— and this app had no such element. An empty set satisfies all three, so all
three answered PASS while the app bar sat fully drawn over an open paper with
the Ready Room pill and the profile menu both clickable. **A check that can
only pass is worse than no check**, so the element now exists.

Its rule in the pack is `max-width:1100px;margin:0 auto;padding:18px 16px 72px`.
That is **not** taken. CLAUDE.md records this screen as an approved port
(2026-09-16) whose every size, radius and duration is that design's, and
`check:exam` holds 108 layouts against it. So the class carries no `.examport`
scope and the pack's page rule does not reach it: the element is the scope R4
needs to be askable, and nothing else.

### 6 · R4 is taken for the accidental exits, not for the deliberate one

R4 says an exam has "no way out but End exam — no back arrow, no Ready Room,
no profile, no links of any kind". Three of those four are now true, measured:
the app bar drops the pill and the profile and says EXAM IN PROGRESS instead,
the wordmark stops being a button, and the browser's own Back opens the
end-exam dialog rather than abandoning the paper.

**The back arrow stays.** `QuizPage` draws `← Module 1` above the paper, and
removing it is not a port — it decides what happens to a student who opens a
quiz to look at it. This app already answers that question differently and on
purpose: an attempt is written to localStorage on every change, the clock
belongs to the attempt and only moves while the paper is on screen, and
`check:exam` has a whole "leaving and coming back" section asserting that you
return to the question you left with the time you had. Remove the arrow and
the only exit from a mis-tapped quiz is handing in a blank paper.

That is a teaching decision, not an approximation, so it goes in
`BRIEF-exam-conflicts.md` with the other four rather than being made here.
What is closed is every exit a student takes *by accident* — which is what was
actually wrong, and what the check was failing to notice.

### 7 · The exam pack's five conflicts, settled

The owner took two and handed three back (2026-09-20).

| # | | |
|---|---|---|
| 1 | Leaderboard | **Build it as drawn** (owner) |
| 2 | "Go through the paper" | **Kept** — it is the only door to the explanation for every question, the lesson each miss came from, and a paper of only the misses. Three things deleted to satisfy a check about one. |
| 3 | 20-minute clock | **Taken** (owner). Flat, up to forty questions. |
| 4 | R1 taken literally | **The scoped copy stands.** Its intent is met exactly; its letter is not, because 128 bare class names would repaint the app — `.mark` alone turns every chapter tick into a circle the moment the exam chunk loads. R1's own check (file added not edited, rules in one file) passes. |
| 5 | No back arrow | **The arrow stays, and it asks.** |

Conflict 5 is the one worth writing down, because both sides of it were right.
R4 exists because you should not be able to slip out of an exam without
noticing. This app's `saveAttempt`/`loadAttempt` and its paused clock exist
because a student who opens a quiz to look at it should not be punished for
it. Delete the arrow and the only exit from a mis-tap is a marked nought;
leave it silent and R4's hole stays open.

So every exit — the arrow, the browser's Back, and End exam — now raises one
dialog that says what is unanswered and what is flagged, and offers three
choices: **Back to exam · Leave it for now · End and mark**. Nothing marks a
paper the student did not mean to hand in, and nothing leaves one without
being asked.

The cost is stated rather than hidden: `exam-port.check.js` will keep printing
FAIL on its "no Go through the paper" line, and R4's letter about the arrow is
not satisfied. Those two are the whole of what this port does not copy.

