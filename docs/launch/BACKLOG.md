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
