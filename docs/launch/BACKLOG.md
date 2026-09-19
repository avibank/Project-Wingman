# Backlog (deliberately not in the launch port)

| Item | Why it's deferred | Raise again when |
|---|---|---|
| Papers reader: mark anchoring (character offsets + quote/prefix/suffix) | Bigger job, reader isn't in this port | After launch |
| Stamp dots per finished module | Needs module-completion data | After module completion is tracked |
| Competition segment: XP, ranks, prestige, leaderboards | Whole feature area of its own | Post-launch |
| Native in-app papers (replacing PDF) | Large rewrite | Post-launch |
| Final motto wording (currently "Never fly alone") | Placeholder chosen in design | Before launch — owner decision |
| Sixth stamp shape decision (keeping both Roundel and Window) | Owner decision | Before launch |

## "When you usually study" is now set once, at signup, and nowhere else

§6 deletes it from Preferences, which is what the kickoff asks for and which is
right: the chip row invited people to change a value whose only effect —
`assign_squadron` matching them to a squadron — was already behind them.

But the value is still SET (FirstFlight's step 2) and still READ
(`assign_squadron`, `squadron_roster`, the squadron's own `study_time`), so an
account is now matched forever on an answer given once in its first minute,
with no way to change it.

Three honest options, none of them item 6's:
· leave it — a squadron is joined once and re-matching later is not a thing
  this app does anyway;
· stop asking at signup too, and match on presence instead, which is a real
  signal rather than a stated intention;
· put it where changing it would do something, which is the squadron screen.

Nothing is broken today. It is written down because a setting that can be read
and not written is the shape that rots.

## Five library files nothing imports any more

Found in the closing sweep, by resolving every import in `src/` — static and
dynamic — against every file:

| file | what it was |
|---|---|
| `src/lib/readerChrome.js` | Reader **v5**'s chrome. v6 replaced it. |
| `src/lib/readerPlatform.js` | v5's "platform is not a breakpoint" rules. |
| `src/lib/backstop.js` | a timeout helper; `viewTransition.js` grew its own. |
| `src/lib/meanings.js` | the v4/v5 reader's five closed mark meanings. |
| `src/lib/paperView.js` | superseded, **but `check:paper` imports it.** |

Not deleted, and that is the point of writing it down rather than doing it:
`paperView.js`, `paperTray.js` and `routeGeometry.js` all look orphaned by the
same scan and are not — a check imports each one, so they are rules held by
tests rather than dead weight. Telling those apart takes reading each file,
which is worth an hour on a quiet day and is not worth doing at the end of a
long session on the way to a deploy.

None of it ships: nothing imports them, so nothing bundles them.

## A check for "0 have finished it"

CLAUDE.md's Voice rule — "Never state absence or a zero count" — is easy to
keep in an empty STATE and easy to lose in a sentence that is usually true.
Crew's summary read **"31 studying right now · 0 have finished it"** on a
module nobody had finished. Found on a phone, with 120 people on the wall;
fixed by dropping the clause when the count is nought.

A check for it was written and then taken back out, because a half-reliable
rule in the gate is worse than none. What is known, so the next attempt starts
here:

- The naive pattern — any rendered number followed by a word — matches **45**
  JSX props and catches nothing.
- Restricting it to a TEXT node rather than a prop (`(?<![=\w])\{…\}`) brings
  it to **16** and does catch the real bug.
- Of those 16, most are template literals inside `aria-label` or `toast(...)`,
  and one is a comment. The rule needs `strip()`ing of comments and an
  exclusion for backticks before it is trustworthy.
- Three of the remainder are genuine and need a human to say whether the count
  can be nought: `{roster.length} member`, `{names.length} in the squadron`
  (both ≥1 by construction — you are in it), and `{threads.length} open`
  (which can be nought).

An hour, not five minutes. Worth doing: this is the one Voice rule with no
check behind it, and it is the one that shows a student a zero.
