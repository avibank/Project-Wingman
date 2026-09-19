# Port status

Update after every item goes live. "Done" means: pushed, deployed, and seen working on
wingman.institute.

| # | Item | Status | Commit | Deploy | Notes |
|---|---|---|---|---|---|
| 0 | Bookmarks screen | **done** | `117958f` `122de82` `8fd7083` | live | Ported, plus the second drop's empty-state redesign and R16 solid surfaces. Two live bugs found and fixed after deploy: see-through cards and a blank /bookmarks signed out. |
| 1 | Stamp renderer + data model | **done** | `28d7331` | migration live | `src/lib/stamp.js` + `Stamp.jsx` + 0029. `check:stamp` 27 (in `npm run check`), `check:stamp-db` 15 against the live database. Nothing imports it yet so it is tree-shaken out of the bundle — its first visible appearance is item 2. |
| 2 | Module screen (stamps, Library split, search) | **done** | `0e1c2f4` | live, seen | The "TST" badge is the drawn stamp at 46px, tilted per sign-off, house seal as fallback. Library was already split into Quizzes and Papers. The search already stretches to the card's content edge (measured: tabs end 289, search 303→536, content edge 536). Chapter rows already read Done / You are here / Not started; quiz rows already show "4 of 8" and Re-check below the pass mark. |
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

Six bugs found and fixed on the way, four of them months old:
  12 · every lesson URL answered Vercel's 404 in production
  13 · initials unreadable on six of the thirty-six inks
  14 · the chapter quiz lit its correct answer with tokens that do not exist
  15 · twenty-five mono surfaces reached the face through a fallback
  16 · chat attachments have NEVER uploaded — a missing SELECT policy
  17 · the licence rendered in edit mode with no account, and put an object
       at `undefined/cover.webp`

## Next step
The launch handoff's six items are done. What is left is on
QA-CHECKLIST.md, and the four unticked boxes are the honest list:

  · Fly solo has no walk that turns it on and asserts the student is on no
    surface at all. §6 asks for exactly that and it is the biggest gap.
  · Nothing has been opened on a physical device.
  · Nothing drives a hundred stamps onto a Crew wall or a long callsign onto
    a licence.
  · Only Bookmarks is measured side by side against its reference build.

(Superseded) Item 3: the Crew tab. `PeopleTab.jsx` already exists and is already built — it
sits in `HIDDEN_TABS` in `ModuleScreen.jsx`, so it is unreachable rather than
missing. The work is to make it the third tab and take it to §2's shape: the
summary line, one block per chapter with a wall of the stamps of everyone who
finished it, "Answering questions", squadron mates ringed in teal, and no DMs
anywhere.
