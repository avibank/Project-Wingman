# v1 → v2: what changes, and what v1 shipped that v2 reverses

`docs/SPEC.md` (v1) was built to over several sessions; `docs/SPEC-V2.md` supersedes it.
This file exists so nobody has to diff two long documents to find out which of the
shipped code is now wrong.

## Reversed outright

| v1 shipped | v2 says | Where |
|---|---|---|
| Two-channel colour: a warm and a cold hue per livery, six hue pairs | **Monochrome.** One lightness ramp, tinted. Colour carries no semantic meaning — value, emission and motion do. | §3 |
| Six liveries each with their own warm/cold pair | Six liveries are **tints of the same ramp** plus a presence temperature. A livery may never change lightness or semantics. | §3.4 |
| Squadron roster of 12 seats with outlined "open" seats | Squadron is a **cohort, not seats** — `6 pilots · ATPL-24`. The empty-seat grid is named "the most demoralising surface in the product". | §9.4.3 |
| Formation as a persistent rail on the chapter body | Formation is **ephemeral and scheduled**, 2–4 pilots, dies when the session ends. Never rendered when nobody is in it. And it may not sit on the chapter body at all. | §9.3.5, §9.4.3 |
| Mono labels throughout (RECENTLY VIEWED, STUDY MATERIAL, LOGGED) | **Retire mono from labels.** Sentence-case sans in text-secondary. Mono is for chapter codes and numerals only. | §5.1 |
| `--text-3` raised to L .64 / .515 for contrast | Replaced entirely by the mono ramp's `text-tertiary` = mono-500 in both modes. The contrast work still applies — the ramp must clear AA. | §3.6, §12 |
| Comms as a module tab | Module tabs are **Chapters · Library** only. All people-social moves to the Ready Room. | §9.2 |
| Social as a module tab | Same — Ready Room. | §2.1 |
| Presence rail + On-your-wing on a module Social tab | Ready Room: Now / Open squawks / Your crew / Module channels. | §9.4 |
| Wrong answers in `--calm` | **Illumination, not colour.** Correct is lit (+3–4 ramp steps, emission, solid marker); the user's wrong answer is extinguished (−2 steps, hollow struck marker). | §4.5 |

## Kept and promoted

- **oklch throughout** — v2 keeps it explicitly.
- **The study glow** — v2 promotes it from a toggle to the whole presence system, and
  extends it to the Ready Room door, tail rings and the Comments tab. The 4000ms breath
  and the asymmetric 600ms-in / 2000ms-out are new and specific.
- **Newsreader at 17/1.7** — "already correct; do not touch". v2 widens the measure to
  ~74ch (v1 said 66).
- **Livery unlock by completing a module** — kept, "a better reward than badges".
- **Never render a zero** — same rule, same reasoning.
- **No hue-only meaning** — v1's markings-not-colour rule survives as §12, and §4.5 is
  the same argument applied to answers.
- **Squawk** — v1 used it loosely for bookmarks; v2 gives it real semantics (7600 / 7700)
  as the help-request mechanic, and renames saved questions to **Saved**.

## Still true and still owed

Everything v1 left blocked is still blocked and still needed: presence transport
(§4 needs a live channel), image upload with scanning, notification delivery, and the
Call/squawk backstop scheduler.

## The largest single addition

**Routing (§2.2).** v1 never mentioned URLs. v2 calls it "the highest-leverage structural
fix in the document" because sharing a chapter link is the entire growth loop.
