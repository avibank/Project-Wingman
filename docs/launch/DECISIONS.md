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
