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

## 12 · Every lesson URL answered Vercel's 404 in production

**Found:** 2026-09-19, trying to see item 4 on the live site.
**Lived since:** whenever `vercel.json` was written. Months.

`/m/m1/M1.01/lesson/M1.01.1` returned Vercel's own "This page doesn't
exist", not the app. So did `/m/m1/M1.01` and `/library/M1.DEV`.

The SPA rewrite excluded `.*\.[a-zA-Z0-9]+$` from the fallback — "any last
segment with a dot in it", meaning it. Chapter ids are `M1.01`, lesson ids
`M1.01.1` and papers `M1.DEV`, so the exclusion caught the app's own
addresses and handed them to the static file server, which had no such file.

A student who refreshed on a lesson, opened a saved bookmark, or followed a
link somebody sent them got a 404 page with a Vercel logo on it. Clicking
through from inside the app always worked, which is why nobody saw it: the
router never asks the server.

Neither the dev server nor the harness could show it — both serve index.html
for everything, which is the whole point of them.

**Fixed:** the exclusion is a list of real extensions now.
`npm run check:rewrites` builds every address `routes.js` can produce from
the real content ids and asserts the rewrite serves all 80 of them, that real
files are still served as themselves, and that no redirect lands on an
address the rewrite would refuse. Proven by reverting the config: 36 dotted
addresses fail.

## 13 · Initials were unreadable on six of the thirty-six inks

**Found:** 2026-09-19, by measuring rather than looking.

The licence card's initials circle takes the cover's ink, and the reference
chooses white or near-black by `l > .7`. Khaki sits at exactly .70, so it got
white: **2.67:1**. Lavender 2.77, Nardo 3.36, Mauve 3.48, Emerald 3.87,
Barbie 4.00 — all under the 4.5 prose floor, two of them under the 3:1 that
large text answers to.

A threshold is a guess at where the crossover is. It now picks whichever of
the two reference colours has more contrast on that ink, which is the same
answer on thirty of the thirty-six and a readable one on the other six. Worst
case is now 4.38:1 on Mocha, and every ink clears the large-text floor.

`npm run check:licence` measures all thirty-six and fails if a fixed threshold
comes back.

## 14 · The correct answer in the chapter quiz was styled with tokens that do not exist

**Found:** 2026-09-19, by widening `check:tokens`.

`.exam-opt--correct` in `ChapterQuiz.jsx` lit the right answer with
`--mono-700`, `--mono-500`, `--mono-0` and `--mono-400`, and its letter with
`--mono-0` and `--mono-900`. None of the five has been declared anywhere for a
long time — they were a monochrome ramp from an earlier vocabulary — and none
of the six uses carried a fallback. So the correct answer had no background,
no border and no glow: it looked exactly like an option nobody had touched.

`check:tokens` could not see it because it walked `.css` files, and about a
third of this app's CSS lives in `<style>{`…`}</style>` blocks inside JSX. It
reads those now, and found exactly these eight uses and nothing else.

Lit means `--ok` here, which is this app's one colour for right.

## 15 · Twenty-five mono surfaces fell through to a fallback

`var(--mono, 'Geist Mono', ui-monospace, monospace)` appeared 25 times across
six stylesheets, and `--mono` is declared nowhere. It rendered correctly, by
accident, because the fallback names the face — which is the thing CLAUDE.md
says not to do: "the brand faces are reached through tokens, never named
directly."

All 25 are `var(--font-mono)` now, and four more in `module.css`, two in
`Deck.jsx` and one in `PaperStrip.jsx` that named `"Geist Mono"` outright.
Measured after: `.ptime`, `.sdnow` and the logbook's stamps all compute to
exactly the token's value, the same face as before.

`reader.css` is the exception and stays as shipped — `check:paper` holds it to
being byte-identical. Its two uses get `--mono` declared in `additions.css`
instead, which is where that pack's adaptations live, and they were genuinely
falling through to the platform mono rather than to Geist.

## 16 · Chat attachments have never uploaded, and neither could a cover

**Found:** 2026-09-19, building the licence card's cover upload.
**Lived since:** 0026 shipped.

A brand-new bucket with a correct INSERT policy answered every upload with

```
403  new row violates row-level security policy
```

The policy was right. The expression evaluated true against the exact row.
Inserting the identical row as `anon` in SQL succeeded. Only the REST path
refused, and only for two buckets — `covers` and `chat-attachments`. `papers`
worked.

The difference is a SELECT policy. Supabase's storage API uploads with
`x-upsert: true`, which makes it **look first** to see whether the object is
already there. With no select policy that look is refused, and the API reports
the whole request as an INSERT failure — an error that names the wrong
statement.

0026 left the select policy out of `chat-attachments` deliberately: "No SELECT
policy on purpose: nothing may list this bucket." Sound reasoning, unforeseen
consequence — every attachment in the Ready Room has failed to upload since.

Fixed in 0030 (covers) and 0031 (chat attachments), both with the trade written
down: a select policy permits listing to anybody holding the publishable key,
it cannot be narrowed to the viewer because `auth.uid()` is NULL on every
request here, and what it gives away is a list of paths in a bucket that is
already public.

Verified afterwards over the anon REST path: covers 200 for
`<user>/cover.webp` and 403 for `a/b/c.webp`, chat attachments 200 for a real
`{squadron}/{member}/` path. Every probe object deleted.

## 17 · The licence rendered in edit mode for somebody with no account

Same shape as the blank `/bookmarks` (number 9): a page that renders for a
signed-out visitor with controls that write against an id that is not there.
A cover picker, a phrase picker and a stamp creator, all of which did nothing.

One of them did worse than nothing. `uploadCover(undefined, blob)` put an
object at **`undefined/cover.webp`** — one slot in the bucket, shared by every
signed-out visitor, stored against nobody. It happened on the live site inside
a minute of the feature existing, and was found by looking at the bucket rather
than at the screen: the screen showed no error at all.

The card is read-only when Clerk has decided and there is nobody, with a line
saying what to do about it; `uploadCover` refuses without an id before it
builds a path. `check:licence` holds both.

## 18 · Fly solo did not hide you from search, or from a second device

**Found:** 2026-09-19, writing the walk §6 asks for by name.

"Nobody sees you and you see nobody." Most of it held — presence gated at the
write and the row deleted, Crew filtering `invisible`, the roster asking the
server for visible rows, `licence_card` refusing a solo pilot. Three did not:

**1 · Search.** `people_search` filters on `discoverable`, which is 0011's
separate opt-out of being *suggested*. A student who had never touched that
setting stayed findable by callsign while flying solo — type their name into
Discover and there they were. The two settings are not the same thing:
`discoverable` is "don't put me forward", Fly solo is "I am not here", and the
second has to imply the first. Fixed in 0032, and proven against the live
database with two accounts in each other's orbit: visible → one result,
Fly solo on → none.

**2 · A second device.** The heartbeat gates on the localStorage mirror, which
is per device; `pilot_profiles.invisible` is the account. Turn Fly solo on on a
phone and a laptop still open on a module carries on writing presence rows
every forty-five seconds. Nobody sees you, except everybody. The same gap
strands a row when the switch goes on with the tab already closed. 0032 adds
`presence_visible` — presence minus anybody whose ACCOUNT says invisible — and
the three readers use it. The writes still go to the table; only the reads
moved.

**3 · Formations.** `fetchFormations` was the one ungated reader in the Ready
Room: it lists open study sessions across a module *and* fetches the members of
each, so flying solo still showed other people's sessions and who was in them.

**And one that was only slow:** turning the switch on did not clear presence,
it waited for the next beat — up to 45 seconds during which everybody could
still see where you were standing. "Nobody sees you" cannot start a minute
late.

`npm run check:solo` holds every reader to the gate and names every function in
the seven libraries as either gated or not-about-people, so a new one fails the
build until somebody decides which. `npm run test:solo` drives it with three
students: one turns it on, one walks every surface and must not find them, and
a third stays visible throughout — because "they are not on the wall" is also
what a broken query returns.

## 19 · A wall of 120 stamps drew 132 filters, not 12

**Found:** 2026-09-19, by driving the crowded state for the first time.

§8: "Crew walls with 100+ stamps stay smooth. Cache the rendered SVG per user
stamp and **share the filter defs**." `<StampFilters/>` shares them, one per
seed — and every individual `<Stamp>` ALSO emitted its own, because the seed
was registered in an **effect**. On the first commit `seeds.has(seed)` was
false for all 120, each one wrote a `<filter>` into its own markup, and none of
them ever re-rendered to drop it.

Measured on a 120-person wall from 12 distinct accounts: **132 filter
definitions**. Each is two `feTurbulence` passes, a displacement map, a blur
and three composites.

The seed is claimed during render now — a module-level `Set.add`, idempotent,
touching no React state, so StrictMode's double render changes nothing. The
notification stays in the effect, because that one does set state. Exactly one
stamp per seed carries its own filter for the frame before the shared defs
arrive: **12 for 120**, measured again afterwards.

## 20 · The third tab did not fit on a phone

The module screen's tab strip is Lessons · Library · Crew plus a search field.
At 375px the tabs ran to x=333, the collapsed search magnifier started at 363
and ended at **394 — nineteen pixels past the screen**, and 31px wide.

It is the same arithmetic as the live bug in BUGS 10 ("a third tab needs
room"), one width further down: three tabs at 15px of padding a side is 318px
of a 345px row, and the magnifier needs 39.

Two changes, both needed. The padding comes down to 11 below 560px, which fits.
And the bar scrolls, so a longer word, a bigger text size or a fourth tab
shortens the strip rather than pushing something off the screen — a tab you can
scroll to is a tab; a tab past the right edge is not. Measured after:
`document.scrollWidth` 375 in a 375px viewport, search ending at 370.

## 21 · "0 have finished it"

Crew's summary line on a module nobody has finished. A number whose only job is
to say nothing happened, which is the thing CLAUDE.md's Voice rule exists to
stop. The clause is absent now rather than nought. A check for the general case
was attempted and is written up in BACKLOG.md — it needs an hour, not five
minutes, and a half-reliable rule in the gate is worse than none.
