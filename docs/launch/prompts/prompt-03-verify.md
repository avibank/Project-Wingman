# Prompt 3: verification pass (run once everything is ported)

Wingman repo. The port is finished. Do a full launch check before we announce anything.

1. Walk every screen in the handoff on the LIVE site, not locally:
   module screen (Lessons, Library, Crew), lesson page, licence page, stamp creator,
   preferences. Click every button. Anything that does nothing, opens a placeholder, or
   throws in the console goes in docs/launch/BUGS.md with a severity.
2. Check each screen at 390 / 768 / 1280 / 1600px wide, in all 6 liveries, all 3 finishes,
   and light and dark. Screenshot anything that breaks.
3. Check the empty states: no squadron, nobody on the module, no papers, no notes, no
   stamp yet, a brand-new account with zero stats.
4. Check the hard cases: a 40-character name, a long lesson title, 100+ stamps on one
   chapter wall, a slow connection, a failed save.
5. Confirm the rules hold: a stamp cannot be changed once issued, the code and callsign
   are validated server-side, a student can only edit their own card, and Fly solo really
   hides them.
6. Fix everything you find that is severity high or medium. List the rest in BUGS.md.
7. Tick off docs/launch/QA-CHECKLIST.md and tell me what is left.
