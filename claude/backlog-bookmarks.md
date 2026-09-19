# Backlog · Bookmarks

Things deliberately left out of the launch build, with what each is waiting on.
Add to this list; don't quietly build from it.

The first nine came with the pack. Everything from 10 down was found while
porting it into this app, and each one says what was measured or read rather
than what was assumed.

| # | What | Why it matters | Blocked by | Size |
|---|---|---|---|---|
| 1 | **Real video thumbnails** on Videos covers and the Videos folder | Covers currently use a livery-tinted tile when a lesson has no `thumbnailUrl`. It works, but frames read faster | A thumbnail per lesson (upload or generate once at publish). `contentLoader.js` already carries a `thumb` slot, null for every lesson | S once images exist |
| 2 | **Explanations on the back of study cards** | The card back already shows `question.explanation` when present, and the fixture's `explain` field is wired to it | Authoring explanations for each question | Content work only |
| 3 | **Live sync between tabs and devices** | Today a save made on the phone shows on the laptop after a refresh | Supabase Realtime on `saves` (0015 publishes three tables already), or a refetch on window focus (smaller) | S |
| 4 | **Keep saves made while offline** | Offline taps are refused with a clear message, not queued | Local queue + replay on reconnect. The reader's `outbox.js` is the pattern | M |
| 5 | **Analytics has no destination** | The six events fire through `src/lib/analytics.js` and its union now names all ten — but `installSink` has never been called, so nothing receives them | Picking the analytics tool (launch priority list) | S |
| 6 | **Tilt with the device** for any motion that follows the pointer | Not used in the final bag; noted in case the gyro-style tilt is wanted later | Decision | S |
| 7 | **"Open in its quiz" for a saved question** | Removed under R5 rather than left pointing at the wrong place. `Exam.jsx` latches its sitting at mount and starts a 75-second-a-question clock, so opening one saved question would have started a timed paper. The answer is in the row already | A taker that can show one question without sitting the paper | S–M |
| 8 | **Page bookmarks on any reader but v6** | v6 is the only reader with a page bookmark, and it is behind `library.reader` | Nothing — v6 is live. Closed | — |
| 9 | **Bulk tidy** ("clear all saved in this module") | Students with long lists may want a reset | Decision; needs a confirm step | S |
| 10 | **A student can read another student's saves over the REST path** | `saves` has open RLS and app-side scoping, like every other table here — `auth.jwt()` is NULL on every request (0009's header), so a policy naming a user would deny every row. Anyone holding the publishable key can read the table. This is the architecture's standing trade, not a hole opened by 0028, and bookmarks are the least sensitive thing already inside it | A Clerk JWT template and an authenticated Supabase client, applied to all 65 call sites | L, and it is a project |
| 11 | **Question ids are minted, not authored** | `check:question-ids` is in `prebuild` and holds them unique and stable, but the 96 ids in `src/content/test-content.json` were generated in one pass. Real content should arrive carrying its own | Authoring | none — the check already fails the build without them |
| 12 | **A chapter's number is its position** | A save is labelled "Chapter 3" from the chapter's place in the module, and the card-set route is `/library/cards/3`. Renumbering a module relabels a bookmark. It never re-points one — the save holds the question's own id — but the label would be wrong until the page reloads | Only matters if chapters ever get reordered | S |
| 13 | **Two writers for a reader page bookmark** | The reader keeps its own `Set` in localStorage (what the island paints from, synchronously) and writes a `saves` row beside it. They are unioned at mount, so an offline mark survives; but a bookmark REMOVED on another device stays on this one until its localStorage is cleared | Item 3, or a reconcile on mount that can tell "removed elsewhere" from "made offline" | S |
| 14 | **Nothing is saved while signed out** | The store needs a Clerk id. Signed out, the bookmark controls render and do nothing — there is no sign-in prompt on them | A decision: hide them, or prompt | S |
