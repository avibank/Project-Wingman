# Wingman — read this file and do what it says

You are porting finished, approved designs onto wingman.institute. Everything you
need is in this repo already. Do not ask what the screens should look like, do not
design anything, and do not rebuild from a description. Work through this file.

---

## What happened before

Two earlier passes rebuilt these screens from a written description instead of
copying the reference builds. The result is content that is roughly right and
layout that is wrong everywhere, plus a dead Crew tab and a broken avatar. The
owner has seen this twice. Do not do it a third time.

**The reference builds are the specification.** Not a mood board, not an
inspiration. The DOM structure, class names, element order, spacing, font sizes
and copy all come from them:

| File | Covers |
|---|---|
| `docs/launch/reference/01-module-lesson-crew.html` | Module screen (Lessons / Library / Crew), lesson page |
| `docs/launch/reference/02-licence-stamp-creator.html` | Licence card, cover and photo pickers, stamp creator, Preferences |

Open them in a browser and click through them. They run standalone, no build step.
Each has a demo bar at the bottom to switch screens, toggle light/dark, and flip
Crew between populated and empty.

## The code is already extracted for you

`docs/launch/code/` holds the CSS and JS lifted verbatim out of those two files,
split by screen so you can paste it rather than dig for it:

| File | What it is |
|---|---|
| `01-tokens-and-base.css` | Design tokens, light/dark, buttons, pills — everything else assumes these |
| `02-licence-card.css` | The licence card: cover, avatar, callsign, bio, phrase, stats, stamp block |
| `03-stamp-creator.css` | The creator |
| `04-account-and-preferences.css` | Account rows and Preferences |
| `05-stamp-engine.js` | The whole stamp system — `inspStamp()` is the only way a stamp is ever drawn |
| `06-covers.js` | Liveries and cover artwork, all on a `0 0 640 128` viewBox |
| `07-card-and-avatar.js` | `setBg` / `avaBg` / `avaFg`, `coverHTML`, `avatarHTML`, `card()` |
| `08-photo-and-cover-pickers.js` | Photo picker, crop with zoom and drag, cover picker |
| `09-preferences.html` | The Preferences panel markup, exactly as it should be |
| `10-preferences.js` | Greeter logic and Your bar |
| `11-module-screen.css` | Tab strip, full-width search, chapter list, Crew walls, Crew empty state, card thumbnails |
| `12-lesson-page.css` | Player, up next, note bar |
| `13-module-tabs-and-library.js` | Lessons and Library — Quizzes, Study cards, Papers |
| `14-crew-and-empty-state.js` | Crew and its empty state |
| `15-stamp-creator.js` | The one-time creator |
| `16-crew-profile-sheet.js` | The sheet that opens when you tap somebody in Crew |

Use these. If you are writing a layout rule that is not in one of them, stop —
you are reinventing something that is already decided.

Screenshots of every screen, for comparison, are in `docs/launch/screens/`.

---

## Work in this order. One screen at a time. Verify before moving on.

### 1. The avatar bug — fix this first, it is a real defect

The live site renders Clerk's avatar. In `Profile-*.js`:

```
ie = !Le && (t != null && t.imageUrl) ? t.imageUrl : null
```

`t.imageUrl` is Clerk's `user.imageUrl`, which is **never null** — with no photo
set, Clerk returns a generated default avatar from `img.clerk.com`
(`{"type":"default", ..., "initials":"HA"}`). So the grey glyph always wins and
the initials component never renders.

"Use your initials" makes it worse:

```
onInitials: () => { C(null), t?.setProfileImage({file: null}).then(() => P("Using your initials.")) ... }
```

`setProfileImage({file: null})` is a Clerk call that throws — that is the error
the owner sees — and even when it does not throw, Clerk goes straight back to
serving its default avatar.

Fix:

1. **Delete every read of `user.imageUrl`.** Clerk is the sign-in provider, not
   the avatar store.
2. **Delete every `setProfileImage` call.** Photos go in Supabase storage.
3. Migration on `pilot_profiles`, adding: `photo_url`, `photo_zoom`, `photo_x`,
   `photo_y`, `avatar_colour`, `cover_key`, `cover_colour`, `phrase`, `bio`.
   None of these exist today, which is why the colour picker has nothing to save to.
4. One `<Avatar>` component from `07-card-and-avatar.js`, used by the licence card,
   the topbar, Crew, the Ready Room and every roster: photo if `photo_url` is set,
   positioned by `photo_zoom/x/y`; otherwise initials in `avatar_colour` via
   `avaBg` / `avaFg`, which is what makes the initials the exact colour picked.
5. "Use your initials" sets `photo_url = null`. One write, no Clerk call, nothing
   to throw. See `pickPhoto()` in `08-photo-and-cover-pickers.js`.
6. Guard: treat any stored URL pointing at `img.clerk.com` as no photo.

**Check:** set a colour, reload. Initials show in that exact colour in the card and
the topbar. `document.querySelectorAll('img')` on the licence page returns nothing
from `img.clerk.com`. Pressing "use your initials" after uploading a photo shows
initials with no error toast.

### 2. Licence card

Copy from `02-licence-card.css` and `07-card-and-avatar.js`. Currently wrong on live:

- The card is wider than its column and runs off the right edge. It should be the
  width of the tab strip above it, centred under it.
- The **Cover** button floats halfway down the right edge. It belongs top-right
  inside the banner.
- **Create your stamp** sits on top of the stamp artwork. Stamp above, button below, clear of it.
- The **YOUR CODE / TST** box is still a separate card. Delete it. The code is
  chosen inside the creator. Grep the codebase for `TST` and remove every hit.
- The card header **YOUR LICENCE · See it as others do** is missing, and
  "See it as others do" is stranded at the bottom. Put it at the top, as in the reference.
- The three stats cluster to the left. They spread end to end.
- A red **"Something's snagged. Try again."** banner renders above the content on
  every profile tab, on a clean load where every request returns 200. Find what
  throws and fix it. That banner should never be the normal state of the page.

### 3. Preferences

Copy from `09-preferences.html` and `10-preferences.js`.

- **Delete "Go by callsign"** entirely.
- **Delete the whole "Your pilot / What you'll hear about" block.** Replies, answers,
  squadron messages and right-seat are on by default and are not a setting.
- **Who greets you** currently renders the greeter name, the description, then the
  name again. Correct order: the choice row, one description line for the selected
  greeter, then the "What Wingman calls you" field carrying that greeter's own placeholder.
- **Fly solo** and **Your bar** are already in the right place. Leave them.
- **Appearance is untouched.** Do not edit it.

### 4. Module screen

Copy from `11-module-screen.css`, `13-module-tabs-and-library.js`, `14-crew-and-empty-state.js`.

- **The Crew tab is dead.** Clicking it leaves you on Lessons. Wire it, and ship the
  empty state from `crewEmpty()` — heading, what Crew is and why it helps, the ghosted
  chapter rows, **Find a squadron** / **Invite your class**, and the closing line.
  An empty Crew tab would be bad; a dead one is worse.
- The **search field** is a narrow box with its placeholder clipped
  ("Search lessons and chapt"). It fills the row beside the tabs. Placeholder per tab:
  "Search lessons" / "Search quizzes, cards and papers" / "Find someone".
- The subtitle **"6 lessons and 3 quizzes"** under the module title is missing.
- The **Crew tab needs its count badge**.
- **Study cards rows are wrong.** They use the quiz doc icon and read "8 cards · 1 saved"
  with an "Open" button. The correct row: the stacked three-card thumbnail with the count
  on the front card, "Chapter N cards", the status line ("N kept for another look", or
  "N cards · not started"), `done/total`, and a **Test yourself** button. Keeping a card
  sends it to Bookmarks → Study cards.
- Lesson thumbnails render as empty grey boxes.

### 5. Lesson page

Copy from `12-lesson-page.css` and the lesson section of reference file 01: player,
note bar, logbook, up next, and the sign-off stamp inside the player.

---

## The check before you call a screen done

1. Open the reference file at 1280px wide. Screenshot it.
2. Open the live screen at 1280px wide. Screenshot it.
3. Put them side by side. Not "does it have the same parts" — does it *look the same*:
   same widths, same gaps, same alignment, same type sizes, same copy.
4. Repeat at 768px and 390px.
5. Click every control on the screen. If one does nothing, the screen is not done.
6. Update `docs/launch/STATUS.md` with what you verified, and tick the matching rows
   in `docs/launch/BUGS.md`.

## Standing rules

- **No dead controls.** Every button reaches a real screen, a real action, or a real
  empty state that says what the thing is, why it helps, and how to start.
- **No dead ends.** No blank panel anywhere.
- **Deploy and report per screen.** Say which screen is live after each one. Do not
  run for hours and report at the end — that has already happened twice.

## Reference

- `WINGMAN-LAUNCH-HANDOFF.md` — the full written spec, including the complete source
  of both reference builds in Appendix A and B
- `docs/launch/BUGS.md` — the live defects above as tracked rows
- `docs/launch/QA-CHECKLIST.md` — the pre-launch checklist
- `docs/launch/BACKLOG.md` — what is deliberately out of scope
