# Prompt 1: kickoff (paste into Claude Code on the Wingman repo)

Wingman repo. You previously built the Bookmarks screen — keep it, it's fine.
None of the newer design work got built, so the live site still shows the old lesson
rows with "TST", no Crew tab, and the old licence form. That's what this session is for.

THE SPEC
WINGMAN-LAUNCH-HANDOFF.md in the repo root is the only source of truth. It contains
the full spec plus the complete source of two reference builds in its appendices.
First: save both appendices to docs/launch/reference/ and open them in a browser so you
can see the target. Match them exactly — layout, spacing, copy, the stamp drawing code,
the animations. Copy their CSS and markup; don't rebuild from scratch. Everything runs
inside the live systems: design tokens, the 6 liveries, the 3 finishes, light/dark/auto,
text size, Smooth Air.

SCOPE, in this order. Do not start the next one until the previous is live and verified.
1. The stamp renderer (inspStamp and everything it uses) as one shared component, plus
   the data model and migration for a user's stamp. Until a student makes their own,
   sign-offs use the default seal.
2. Module screen: replace every "TST" with the student's stamp; Library split into
   Quizzes and Papers; the search bar stretched across; chapter rows as specified.
3. Crew tab on the module screen, third tab after Lessons and Library.
4. Lesson page: Logbook replacing the notes carousel, the floating note bar, markers on
   the progress bar, the sign-off stamp on the title row.
5. Licence page /account/licence: the editable licence card, covers, phrase, stats and
   the stamp creator. The same card is the profile viewer others see.
6. Preferences: move Fly solo and Your bar in (with the new wording), make notifications
   a fixed list instead of a choice, and delete "When you usually study", Study glow and
   Turbulence completely. Fly solo must really hide the student from Crew, the route
   strip and presence.

AFTER EACH ONE
  - build, run the tests
  - push to main
  - wait for the Vercel production deploy
  - open the page on wingman.institute and confirm with your own eyes that it changed
  - then record it in docs/launch/STATUS.md with the commit hash and deploy URL
If a deploy fails, fix it before moving on.

RULES
Small commits. No dead buttons, no placeholder toasts, no "coming soon" when you're done.
If something in the spec doesn't fit the codebase, stop and ask me rather than guessing
or skipping it. If you're running low on context, finish the item you're on, push it,
write down exactly where you got to in docs/launch/STATUS.md, and tell me — don't start
something new.
