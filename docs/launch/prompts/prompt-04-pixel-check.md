# Prompt 4: make it match the demo exactly

Wingman repo. The screens work but I want them to match the reference builds exactly.

For each ported screen:
1. Open docs/launch/reference/ in a browser at 1280px wide and screenshot it.
2. Screenshot the same screen on the live site at the same width.
3. Put them side by side and list every difference: padding, gaps, font sizes, line
   heights, radii, icon sizes, colours, copy.
4. Fix the live side to match the reference, not the other way round.
5. Repeat at 390px.
Report what you changed. If a difference is deliberate because of a live system
constraint, write it in docs/launch/DECISIONS.md instead of hiding it.
