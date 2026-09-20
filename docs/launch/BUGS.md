# Bugs

| # | Severity | Screen | What happens | Status | Fix commit |
|---|---|---|---|---|---|
| 1 | high | Licence | "Use your initials" calls Clerk `setProfileImage({file:null})` and throws; avatar then falls back to Clerk's generated default from `img.clerk.com`. Fix: drop `user.imageUrl` and `setProfileImage` entirely, store photos in Supabase, render one Avatar component (photo, else initials on `avatar_colour`). | open | |
| 2 | high | Licence / Preferences / Appearance | Red "Something's snagged. Try again." banner renders above the content on every profile tab, on a normal load with all network calls returning 200. | open | |
| 3 | high | Module | Crew tab does nothing — clicking it leaves you on Lessons. Needs wiring plus the explained empty state. | open | |
| 4 | high | DB | `pilot_profiles` has no `photo_url`, `photo_zoom/x/y`, `avatar_colour`, `cover_key`, `cover_colour`, `phrase` or `bio` columns, so nothing the licence card edits can be saved. | open | |
| 5 | medium | Licence | Card is wider than its column and overflows the right edge instead of sitting centred under the tab strip. | open | |
| 6 | medium | Licence | "Create your stamp" button overlaps the stamp artwork. | open | |
| 7 | medium | Licence | Separate "YOUR CODE / TST" box still present; the code belongs inside the stamp creator and "TST" should not exist in the codebase. | open | |
| 8 | medium | Licence | "YOUR LICENCE / See it as others do" header missing from the top of the card; "See it as others do" stranded at the bottom. | open | |
| 9 | medium | Licence | Cover button floats mid-card on the right instead of top-right of the banner. | open | |
| 10 | medium | Preferences | "Go by callsign" and the "Your pilot / What you'll hear about" notifications block are still present; both were cut. | open | |
| 11 | medium | Preferences | "Who greets you" renders name, description, name again — wrong order versus the reference. | open | |
| 12 | medium | Module | Library Study cards rows use the quiz doc icon, read "8 cards · 1 saved" and offer "Open" instead of the stacked-card thumbnail, kept-count line, done/total and "Test yourself". | open | |
| 13 | low | Module | Search field is narrow and its placeholder is clipped; it should fill the row beside the tabs. | open | |
| 14 | low | Module | "6 lessons and 3 quizzes" subtitle missing under the module title; Crew tab has no count badge. | open | |
| 15 | low | Module | Lesson thumbnails render as empty grey boxes. | open | |
| 16 | low | Licence | The three stats cluster to the left instead of spreading end to end. | open | |

Severity: high = blocks use or loses data; medium = wrong behaviour with a workaround;
low = cosmetic.
