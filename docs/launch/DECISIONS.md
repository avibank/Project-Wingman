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
