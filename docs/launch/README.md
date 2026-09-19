# docs/launch

Everything for the design port, unzipped straight into the repo.

| Path | What it is |
|---|---|
| `/WINGMAN-LAUNCH-HANDOFF.md` (repo root) | The full spec, with both reference builds' complete source in its appendices |
| `reference/01-module-lesson-crew.html` | Working demo: module screen (Lessons / Library / Crew), lesson page, note bar, logbook |
| `reference/02-licence-stamp-creator.html` | Working demo: licence card, covers, phrase, stats, stamp creator, preferences |
| `prompts/prompt-01-kickoff.md` | Paste into Claude Code to start the port |
| `prompts/prompt-02-resume.md` | Paste when a session stops or runs out of context |
| `prompts/prompt-03-verify.md` | Full launch check once everything is ported |
| `prompts/prompt-04-pixel-check.md` | Make the live screens match the demos exactly |
| `STATUS.md` | Progress. Nothing is "done" until it's live on wingman.institute |
| `BACKLOG.md` | Deliberately deferred, with reasons |
| `DECISIONS.md` | Any departure from the reference, and why |
| `BUGS.md` | Found, fixed, and still open |
| `QA-CHECKLIST.md` | The launch checklist |
| `screens/` | Screenshots of every screen, for reference |

**Start with `START-HERE.md` at the repo root.** It is the current instruction: the live site is a partial port that was rebuilt from the description instead of copied from the reference builds. It lists, screen by screen, exactly what is wrong on live right now and what to copy from where. `BUGS.md` has the same list as tracked rows, and `code/` has the CSS and JS extracted from the reference builds, split by screen and ready to paste.

The reference builds are the frozen design spec. Don't edit them.
