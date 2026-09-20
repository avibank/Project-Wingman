# Port status

Update after every item goes live. "Done" means: pushed, deployed, and seen working on
wingman.institute.

| # | Item | Status | Commit | Deploy | Notes |
|---|---|---|---|---|---|
| 0 | Bookmarks screen | **done** | `117958f` `122de82` `8fd7083` | live | Ported, plus the second drop's empty-state redesign and R16 solid surfaces. Two live bugs found and fixed after deploy: see-through cards and a blank /bookmarks signed out. |
| 1 | Stamp renderer + data model | **done** | `28d7331` | migration live | `src/lib/stamp.js` + `Stamp.jsx` + 0029. `check:stamp` 27 (in `npm run check`), `check:stamp-db` 15 against the live database. Nothing imports it yet so it is tree-shaken out of the bundle — its first visible appearance is item 2. |
| 2 | Module screen (stamps, Library split, search) | **done** | `0e1c2f4` | live, seen | The three-letter code badge is the drawn stamp at 46px, tilted per sign-off, house seal as fallback. Library was already split into Quizzes and Papers. The search already stretches to the card's content edge (measured: tabs end 289, search 303→536, content edge 536). Chapter rows already read Done / You are here / Not started; quiz rows already show "4 of 8" and Re-check below the pass mark. |
| 3 | Crew tab | **done** | `8786b00` `70acc16` | live, seen | New screen: `CrewTab.jsx` + `crew.css` + `lib/crew.js`. `PeopleTab` was the question FEED, not this — it keeps its own hidden route. Reachable at `/m/:module/crew` as the third tab. |
| 4 | Lesson page (Logbook, note bar, markers, sign-off) | **done** | `52d7239` `30f07be` `a45f5bf` | live, seen | Stamp + Ask in the player bar, Save on the title line, the note bar's violet Ask posting to the module threads, three mark shapes with hover tips, the Logbook replacing the notes carousel with filters / seek / delete / a working Export, and the sign-off's angle stored per press. `npm run test:lesson` walks it. Found and fixed a months-old production bug on the way: every lesson URL answered Vercel's 404. |
| 5 | Licence page + stamp creator + profile viewer | **done** | `a2aa106` `bfce41d` `559ea15` | live, seen | The card IS the first box, in edit mode; five drawn covers × 36 inks plus an uploaded one with a 640×128 crop; the studio; the phrase; the three stats; the profile viewer in PilotSheet. 0030 + 0031 run against the live project. |
| 6 | Preferences rebuild: Fly solo + Your bar moved in, fixed notifications, study time / study glow / Turbulence removed | **done** | `52231fc` `c4d7399` | live, seen | All of it, plus the bar's floor moved to the pass mark, which reverses a written argument — see DECISIONS.md. |

## Where I got to
_Last session ended at:_ items 1 to 6 done and live, and the closing sweep with
them.

Verified on www.wingman.institute, not inferred:
  · the lesson bar reads Play · Stamp · Ask · Save · Mute · Speed · Full screen
  · the Logbook, its chips, its stamps and a working Export
  · the Ask bar opens violet and says "Ask the module"
  · the licence card, its cover, its stats from real progress (13m / 1 / —),
    the ghost seal and "Create your stamp"
  · Preferences carries Fly solo, Go by callsign and Your bar at 75–100
  · signed out, the card is read-only and says what to do about it

Ten bugs found and fixed on the way, five of them months old:
  12 · every lesson URL answered Vercel's 404 in production
  13 · initials unreadable on six of the thirty-six inks
  14 · the chapter quiz lit its correct answer with tokens that do not exist
  15 · twenty-five mono surfaces reached the face through a fallback
  16 · chat attachments have NEVER uploaded — a missing SELECT policy
  17 · the licence rendered in edit mode with no account, and put an object
       at `undefined/cover.webp`
  18 · Fly solo did not hide you from search, or from a second device
  19 · a wall of 120 stamps drew 132 ink filters, not 12
  20 · the third tab hung 19px off a 375px screen
  21 · "0 have finished it", and "0 signed off" once per chapter

Three walks were added for the checklist's own boxes: `test:routes` (every
address), `test:solo` (three students) and `test:crowded` (120 people and the
longest name the fields take).

## Next step
Two of the four unticked boxes are closed, and closing them found nine more
bugs (BUGS 18-21). What is left, and what each needs, is at the bottom of
QA-CHECKLIST.md. The largest is a phone: nothing in this project has been
opened on one, and it is the only item on that list nobody can simulate.

---

## The reference-build port (2026-09-19 / 20)

Four of five screens ported, measured and deployed; the fifth is logged rather
than half-done. `docs/launch/SESSION-REPORT.md` is the account of it —
what is live, the diff percentage for each screen at each width, what was
found by measuring rather than by reading, and every decision taken alone.
`docs/launch/DECISIONS.md` carries the arguments; `docs/launch/BUGS.md` rows
1-16 are closed and row 17 is the lesson page.

---

## 2026-09-20 — the pause, R4, and the exam pack settled

| Item | Status |
|---|---|
| **The papers reader, paused** | **live** — one build-time boolean, `VITE_PAPERS_READER`. No file, row, table or column deleted; no migration. `docs/launch/PAUSE-READER.md` is the survey and the report. `check:paused` is 22 assertions in the gate. |
| **R4 — the paper is locked** | **live** — the app bar drops the Ready Room pill and the profile menu over an open paper; the wordmark stops being a button; the browser's Back and the module's arrow both raise the end-exam dialog. `exam-port.check.js` had reported all three as PASS because it asks inside `.exam-page`, which did not exist. |
| **A flat twenty-minute clock** | done, in this branch |
| **No streaks** | done — the tile, the fortnight of dots derived from it, and both keys |
| **The Logbook was counting the wrong app** | fixed — it read data.js's 20 skeleton chapters while the app serves 12, and its Debrief listed nothing at all for anybody |
| **The leaderboard** | done — migration 0034 run and verified against the live project, `check:board-db` 20 assertions over the anon path |

The exam pack's five conflicts are all settled: `BRIEF-exam-conflicts.md` says
which way each went and why. Conflict 2 was reversed by the owner the next day
— "Go through the paper" is out, and `exam-port.check.js` now prints PASS on
that line, verified by running it on a live result screen. **One thing in the
pack is knowingly not copied: R4's letter about the back arrow.**

What `exam-port.check.js` still fails on, and why, measured on a live result:

| Line | Why |
|---|---|
| result carries the stamp, not a plane · stamp presses on arrival | **A real gap.** The result draws `.result__icon` where R7 wants the student's own stamp, pressed. Not done — it is a change to an approved screen, not a fix. |
| leaderboard rows present · exactly one row marked as yours · stamps use personal ink | The board draws nothing until somebody else is on it (§10 — a board of one is a ranking of yourself). All three pass the moment a second person sits the paper. |
| 13px type floor | The sizes it objects to — `.exam-bar__eyebrow` 10.5px, `.board__title` 11px, `.lb-row__acct` 11.5px — are **the pack's own stylesheet's**, and the 3.1px hits are the rim lettering inside a drawn stamp, which is artwork rather than type. |
| no button under 36px tall | 34px is **the pack's own `.btn`**: `padding:9px 18px` on `font:600 14px/1`. |

The reference diffs were re-measured the same day; the numbers, and the two
screens whose numbers no longer mean what they did, are in SESSION-REPORT.md.

