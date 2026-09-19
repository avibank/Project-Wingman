# Bugs

Found during the port, and what happened to each. Severity is what it did to a
student, not how hard it was to find.

## Fixed

| # | What | Severity | Where it came from | Fixed in |
|---|---|---|---|---|
| 1 | **`/bookmarks` was blank for anyone not signed in** — `aria-busy="true"` for ever, no console error. Every Bookmarks screen waits on the saves store being ready, and `ready` only became true when `initSaves` finished; signed out it never ran. | high — a whole screen, dead, on the live site | The store could not tell "we have not asked yet" from "there is nobody". | `8fd7083` — `noStudent()` settles it; `check:saves` and `test:bm` both cover it, plant-proved |
| 2 | **Cards in a stack were see-through.** `--panel` is `oklch(… / .78)` and `--raised` is `.87`; anything painted straight from them showed what was behind it. A card in a stack of eight showed the card under it, and the flight bag's front wall showed its own sheets. | medium — it read as a rendering fault | The pack's design assumed opaque surface tokens. | `122de82` — the R16 solid-surfaces block, plus a ground-coloured copy under the bag's front wall |
| 3 | **The back of a card stayed see-through** after that fix. R16's own block is `.bm .bm-face, …` at specificity (0,2,0); the earlier `.bm .bm-face.is-back` sets `background` as a SHORTHAND at (0,3,0) and wins on `background-color`. | medium | A specificity gap in the pack's own fix. | `122de82` — one rule in `bm-app.css`; `test:bm` now measures every covering surface and fails under 0.999 |
| 4 | **`StudyPad` crashed two taps into the Study cards folder.** `useRef` was declared *after* `if (!cur) return null`, so the render after the last card was unsaved ran one hook fewer than the one before it and React threw. | high — a crash on a documented path | The handed-over component. | `117958f` |
| 5 | **`FolderPage` used `<Link>` with no import**, throwing the moment the Questions folder rendered. | high — a crash | The handed-over component. | `117958f`; `check:jsx` is what catches this class |
| 6 | **A wrong answer was marked in Master Caution amber.** CLAUDE.md: Master Caution lights in exactly one place, and a wrong answer is never alarming. | low — a rule, not a fault | The pack said "map to the live Master Caution colour if it has a token". There is one, and it was the wrong one twice over. | `117958f` — `--bm-miss` is `--bad` |
| 7 | **A dead "Open" button** in the old hub's Library (`PdfPanel`), bound to nothing. | low — behind a flag that is on for everyone in the other direction | Pre-existing. | `117958f` — wired to the same opener the live Library uses |
| 8 | **The Logbook's "saved" tile counted a key nothing writes** (`pw-bookmarks`), so it read 0 for every student. Its invitation also said "Star a question", and the control is a bookmark. | low — behind `page.logbook`, which is off | Made stale by the Bookmarks port. | `117958f` |
| 9 | **`test:bm` left the student pinned to Manual in Day**, and every suite drives the same harness store — `test:exam` then failed on a ground it never set. | none for students; it wasted an afternoon | The walk changed skins and did not put them back. | `117958f` — restored in a `finally` |

| 10 | **A third tab pushed the third tab under the search field.** `.mscreen .tabs` was `flex: 0 1 auto`; the search beside it is `flex: 1 1 auto` with a 120px floor, so the two together asked for more than the bar had and the tabs gave. Measured live: Crew ran to x=377 in a container ending at 350, search starting at 364. | medium — a tab you could see but not fully press | Adding Crew. Two tabs never asked for enough room to hit it. | `8786b00` + follow-up — the tabs are content, the search is the slack |
| 11 | **"The first one crew-here could be yours."** A class rename ran over a word of copy, and it shipped. | low — one word, on a live screen | A regex rename that could not tell a class name from prose. | follow-up to `8786b00` |

## Open

| # | What | Severity | Why it is still open |
|---|---|---|---|
| A | **Nothing counts study days**, so `pw-streak` has no writer and the Logbook's streak tile can only ever read 0. | low | Behind `page.logbook`, which is off. Needs a day-counting rule nobody has written. |
| B | **`ProgressPage` reads the global `CHAPTERS` array** directly, which CLAUDE.md calls "a bug waiting to surface" — it counts every chapter in the app rather than the ones in a module. | low | Same screen, same flag. |
| C | **`saves` is readable by anyone holding the publishable key**, like every other table here. | medium, and architectural | `auth.jwt()` is NULL on every request; fixing it means a Clerk JWT template and an authenticated client across 65 call sites. `claude/backlog-bookmarks.md` item 10. |
