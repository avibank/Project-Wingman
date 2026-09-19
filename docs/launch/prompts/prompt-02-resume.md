# Prompt 2: resume (use when a session ended or ran out of context)

Wingman repo. Pick up the design port where the last session stopped.

1. Read docs/launch/STATUS.md and tell me in three lines: what is done and live, what is
   half done, and what is next.
2. Check the ground truth before trusting the notes:
     git log --oneline -20
     git status
     git log origin/main..HEAD --oneline
   Anything committed but not pushed gets pushed now.
3. Open the next unfinished item in WINGMAN-LAUNCH-HANDOFF.md and finish it end to end:
   build, test, push, wait for the Vercel deploy, check the live page, update STATUS.md.
4. Work on one item only. When it's live and verified, stop and tell me.
