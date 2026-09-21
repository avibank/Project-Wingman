# Port status

Update after every item goes live. "Done" means: pushed, deployed, and seen working on
wingman.institute.

| # | Item | Status | Commit | Deploy | Notes |
|---|---|---|---|---|---|
| 0 | Bookmarks screen | done (earlier session) | | | |
| 1 | Stamp renderer + data model | not started | | | |
| 2 | Module screen (stamps, Library split into Quizzes/Study cards/Papers, search, Crew empty state) | not started | | | |
| 3 | Crew tab | not started | | | |
| 4 | Lesson page (Logbook, note bar, markers, sign-off) | not started | | | |
| 5 | Licence page + stamp creator + profile viewer | not started | | | |
| 6 | Preferences rebuild: Fly solo + Your bar moved in, fixed notifications, study time / study glow / Turbulence removed | not started | | | |

## Where I got to
_Last session ended at:_

## Next step

---

## 2026-09-21 — the beta brief, parts 1 to 8, and the tour

| Part | Status |
|---|---|
| 1 · the beta fixes | **live** — patch applied as sent; `check:ship` CLEAN for the first time |
| 2 · the wipe | **live** — database wiped and verified by connecting; a storage epoch sweeps each tester's browser |
| 3 · no lessons | **live** — a chapter is a quiz and a card set; the walk and the route graphic both worked on it |
| 5 · share, pickers, downloads | **live** — two helpers, HEIC accepted, chat attachments actually download, the two dead Account buttons reach Clerk |
| 4 · the paper viewer | **live** — island-only chrome, scroll, bookmark, download; imports nothing from the paused reader |
| 6 · the stamp engine | **live** — rim derived from the shape, eight shapes, six patterns, Matcha, `WNG` |
| 8 · the self-check | **done** — `npm run qa`, four sweeps, written up in SESSION-REPORT.md |
| — · the tour | **live** — twelve steps, offered once, re-openable from the profile menu |

**Two things need the owner**, and neither can be done from here:

1. **A phone.** Nothing in this repo has ever been opened on one.
2. **Three Clerk sign-ins.** Their database side is gone (the owner asked for
   every trace, 2026-09-21: 24 rows across 8 tables, their id off one paper, then all 100 tables in
   every schema searched for the three ids and none found). The sign-ins
   need the Clerk dashboard, because this machine has no Clerk secret key.
   LAUNCH-MORNING.md §2 has the ids and the order.

**Carried over, low:** "Add a paper" is withheld until the ingest comes back
with the reader; the Ready Room's Previous/Next stay live at the ends of the
list; and the request waterfall beyond `blocks`/`mutes` is untouched. One 68-byte
PNG from a check account (`chk_upload_A`) is still in `chat-attachments`.
Supabase refuses to delete storage rows over SQL, and the anon key has no
delete policy there. Nothing links to it.

