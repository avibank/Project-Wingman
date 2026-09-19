# Port status

Update after every item goes live. "Done" means: pushed, deployed, and seen working on
wingman.institute.

| # | Item | Status | Commit | Deploy | Notes |
|---|---|---|---|---|---|
| 0 | Bookmarks screen | **done** | `117958f` `122de82` `8fd7083` | live | Ported, plus the second drop's empty-state redesign and R16 solid surfaces. Two live bugs found and fixed after deploy: see-through cards and a blank /bookmarks signed out. |
| 1 | Stamp renderer + data model | **done** | `28d7331` | migration live | `src/lib/stamp.js` + `Stamp.jsx` + 0029. `check:stamp` 27 (in `npm run check`), `check:stamp-db` 15 against the live database. Nothing imports it yet so it is tree-shaken out of the bundle — its first visible appearance is item 2. |
| 2 | Module screen (stamps, Library split, search) | **done** | | | The "TST" badge is the drawn stamp at 46px, tilted per sign-off, house seal as fallback. Library was already split into Quizzes and Papers. The search already stretches to the card's content edge (measured: tabs end 289, search 303→536, content edge 536). Chapter rows already read Done / You are here / Not started; quiz rows already show "4 of 8" and Re-check below the pass mark. |
| 3 | Crew tab | next | | | `PeopleTab` exists but sits in `HIDDEN_TABS`, so it is built and unreachable. |
| 4 | Lesson page (Logbook, note bar, markers, sign-off) | not started | | | |
| 5 | Licence page + stamp creator + profile viewer | not started | | | |
| 6 | Preferences rebuild: Fly solo + Your bar moved in, fixed notifications, study time / study glow / Turbulence removed | not started | | | |

## Where I got to
_Last session ended at:_ item 1 done — renderer, data model, migration, both
checks. The migration is live against the production database and driven over
the anon REST path. The renderer is committed but not yet imported anywhere, so
it is correctly absent from the deployed bundle; item 2 is what puts it on a
screen.

## Next step
Item 2: the module screen. Replace every "TST" with the student's stamp, split
the Library into Quizzes and Papers, stretch the search bar across, and take
the chapter rows to the reference's shape.
