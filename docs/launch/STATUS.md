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
| 5 | Licence page + stamp creator + profile viewer | next | | | |
| 6 | Preferences rebuild: Fly solo + Your bar moved in, fixed notifications, study time / study glow / Turbulence removed | not started | | | |

## Where I got to
_Last session ended at:_ items 1, 2, 3 and 4 done and live.

Verified on www.wingman.institute, not inferred:
  · the player bar reads Play · Stamp this moment · Ask about this moment ·
    Save to Videos · Mute · Speed · Full screen — no CC, no overflow menu
  · the title row is the name, Save, and the sign-off stamp, on one line
  · the tabs are "Logbook 3" and "Comments"; the chips are All and Mine, with
    no right-seat chip because nobody is in the seat
  · three note marks on the scrubber, 8x6, in the livery accent
  · the Ask bar opens violet: "◆ 9:56", "What don't you get here?", and a
    violet tick labelled "Ask the module"
  · --ask and --copilot-text are both emitted by the deployed livery engine

**The deep-link 404.** /m/m1/M1.01/lesson/M1.01.1 had never reached the app
in production — Vercel's rewrite excluded any last segment with a dot in it,
and every chapter, lesson and paper id in this app has one. Number 12 in
BUGS.md, fixed and verified: all five deep links now answer 200 and the
bundles are still served as files. Neither the dev server nor the harness
could have shown it.

## Next step
Item 5: the licence tab and the profile viewer. The first box on
`/account/licence` IS the licence card — the same component other people see
when they tap your face, with the owner in edit mode. Cover picker, phrase
picker, the stamp creator (six shapes, six patterns, thirty-six inks, rim text
on or off), and issuing once and for all. `src/lib/stamp.js` and `Stamp.jsx`
already draw every one of those — item 1 built the renderer and 0029 the
columns and `issue_stamp()` — so item 5 is the screens around them, not the
drawing.

(Superseded) Item 3: the Crew tab. `PeopleTab.jsx` already exists and is already built — it
sits in `HIDDEN_TABS` in `ModuleScreen.jsx`, so it is unreachable rather than
missing. The work is to make it the third tab and take it to §2's shape: the
summary line, one block per chapter with a wall of the stamps of everyone who
finished it, "Answering questions", squadron mates ringed in teal, and no DMs
anywhere.
