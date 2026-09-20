<!-- stamp-changelog-20sep -->

> **20 Sep 2026 — the stamp changed.** The rim text is now derived from each
> shape's own outline and sits on a fitted true arc; `lace` is gone; Matcha was
> re-matched to the reference photograph; the example code is WNG. Read
> `docs/launch/CHANGELOG-STAMP.md` and take `docs/launch/code/05-stamp-engine.js`,
> `15-stamp-creator.js` and `03-stamp-creator.css` as they now stand — the code
> quoted further down this document predates that work.

# Wingman: launch handoff for Claude Code

You have the wingman.institute repo. **This single file is the complete handoff.** It holds the full spec (sections 1–9) and, in the appendices, the complete source of both signed-off reference builds. Save each appendix code block to the path shown and open it in a browser to see the exact target. Your job:

1. Port every screen below into the live codebase, **exactly as built** in the reference files: layout, spacing, copy, drawings, animation and behaviour.
2. Do it inside Wingman's own systems: live design tokens, liveries, finishes (Standard / Aurora / Manual), light / dark / auto, text-size scale, Smooth Air (reduced motion), Plain Language font, and the Mission Control transition preset.
3. Wire everything to real data. When you're done there must be **no dead buttons, no dead ends and no placeholder toasts**.
4. Test, find bugs, fix them, and get it launch-ready.

If the reference and the live code disagree on something structural, follow the reference and log the decision in `docs/launch/DECISIONS.md` (see section 9).

## Reference files (full source in Appendix A and B)

| File | What it covers |
|---|---|
| Appendix A → `reference/01-module-lesson-crew.html` | Module screen (Lessons / Library / Crew tabs), lesson page (player, logbook, note bar, up next) |
| Appendix B → `reference/02-licence-stamp-creator.html` | `/account/licence`: editable licence card, cover picker, phrase picker, stamp creator; Preferences with Fly solo moved in |

Both are single self-contained HTML files. Read their JS: the render functions are the spec. Where a toast says "Opens…", that's where a real route or action must go.

**Demo-only parts. Do not port these:** the floating bottom demo bar (Module / Lesson / Licence, Light / Dark, Reset stamp) and all sample data (names, callsigns, counts, lesson titles, the video-frame equation, "Blue Tail").

---

## 1. Global rules

- **Tokens:** use the live oklch tokens (ground / panel / raised / line / t1–t3, accent, violet). Keep the 13px card radius, `cubic-bezier(.3,.7,.3,1)` easing, and Instrument Sans with Geist Mono for micro-labels. The reference files copy these values. Swap them for the real token names; don't hard-code.
- **Liveries and themes:** anything drawn in "accent" follows the active livery. Check every screen in all 6 liveries × 3 finishes × light/dark.
- **Motion:** respect Smooth Air and `prefers-reduced-motion`. The stamp press/slam animations and the chapter chevrons must switch off there.
- **Layout:** desktop and tablet first, phone second. Every screen is checked at **1280 (desktop), 834 (tablet) and 390 (phone)**, with no sideways scroll. On phone, long descriptions must wrap cleanly inside their box and segmented controls wrap to two rows rather than overflowing. The reference build has Tablet and Phone buttons that open it at those widths.
- **No dead ends, and no dead controls.** Every tab, button and link does something visible when pressed. Every screen that can be empty has a real empty state saying what the thing is, why it's useful and what to do next — never a blank panel, never a tab that does nothing. This holds for everything built from now on, not only the screens here.
- **Accessibility:** every control has a label and a visible focus state, and is keyboard reachable. Dialogs trap focus and close on Esc.

## 2. Module screen `/m/:module`

- **Top of the page:** back link in the top corner ("Flight Deck"), a big title, and "N lessons and N quizzes" underneath in muted text.
- **Card and tabs:** one card holds the **Lessons · Library · Crew** tabs.
  - The search field stretches from the end of the tabs to the far edge of the card.
  - The search placeholder changes per tab.
  - Search filters the active tab.
- **Lessons tab:**
  - Chapters are collapsible. Each shows its status: Done / You are here / Not started.
  - Lesson rows show a thumbnail (with a thin progress line when part-watched), the title and a status line.
  - The right side of a lesson row shows the student's **stamp** when signed off, **Resume** when in progress, and nothing when not started.
  - Quiz rows use the live `quiz-thumb` markup, unchanged. They show "4 of 8" plus **Re-check** below the 75% pass mark.
- **Library tab:**
  - **Quizzes:** score plus Re-check, or Take it.
  - **Papers:** chapter filter chips, **Add a paper**, a reading-progress bar and Resume. Paper rows use the doc-icon box.
- **Crew tab (about the module, not your friends):**
  - **Summary:** how many people are on the module, how many are studying now and how many have finished it, plus the faces of people studying now.
  - **One block per chapter:** who is on it now, and a "Signed off" area filled with the stamps of everyone who finished it, the student's own included.
  - **"Answering questions":** the top answerers in this module's threads, with a button that opens those threads in the Ready Room.
  - **Squadron mates:** get a thin teal ring around their face. They are not grouped separately.
  - **Privacy:** chapter-level position only, never a lesson or a score.
  - **The tab must actually open.** Clicking Crew switches the card's content, the same way Lessons and Library do. A tab that changes nothing is a bug, not a placeholder.
  - **Empty state, which is never blank.** With nobody else on the module yet, Crew shows: a heading ("Nobody else on Module 1 yet"); two or three lines saying what Crew is and why it helps — the class for this module, who's on which chapter, whose stamp is on each chapter, how to find someone at the same point when you're stuck; a faint outline of what it will look like, one row per chapter reading "who has signed it off / who is on it right now / who is ahead of you" with placeholder faces; two buttons, **Find a squadron** and **Invite your class**; and a closing line saying that the moment someone else opens the module they appear here, and your own stamp shows on every chapter you sign off regardless. Press "Crew: empty" in the reference build's demo bar to see it.
  - **A search with no match** shows a line plus a Clear search button, never a blank panel.
  - **No DMs anywhere.** Tapping a face or stamp opens the profile viewer (section 5). Talking only happens in squadron chat or a right-seat session.

## 3. Lesson page `/m/:module/:chapter/lesson/:lesson`

- **Layout:** desktop is two columns: player, title row and Logbook on the left, the chapter's Up next list on the right. Below 860px it stacks, and Up next becomes collapsible and sits above the Logbook.
- **Player bar:** play, time and the progress bar, then Stamp-a-moment (rectangle icon), Ask (diamond icon) and fullscreen. There is no CC and no ⋯ menu. The player's height is capped.
- **Title row:** the title, Save (bookmark → Bookmarks), and the sign-off stamp. Tapping the stamp signs off with a press animation; tapping again voids it. Store a random rotation (±6°) per sign-off.
- **Note bar:**
  - Stamp or Ask pauses the video and opens a floating bar.
  - The whole bar is draggable and grows as the student types.
  - A round tick saves; a round X discards. The Ask version is violet.
  - Ask posts to the module's Ready Room threads.
- **Progress-bar markers:** a rectangle for a note, a violet diamond for a question, teal for the right-seat partner. Hovering shows the note.
- **Logbook tab:**
  - Replaces the notes carousel.
  - Filters: All / Mine / right-seat partner.
  - Tapping a stamp seeks the video to that moment. The student can delete their own entries.
  - Export must work: produce a real download of the student's notes.
- **Comments:** unchanged from live.

## 4. Stamps, one renderer everywhere

Use `inspStamp()` from `reference/02-…` as **the** stamp renderer across the whole app: lesson rows, the sign-off button, Up next, Crew walls, profiles and the licence. The older renderer in `01-…` is superseded. Treat the 02 version as the source of truth.

**Parts of the stamp:**
- **Shapes (6):** Seal, Roundel, Window, Gauge, Postage, Bag tag. Each has its own `layout()` entry (frame, text paths, stars, pattern ring, clip). Keep them exactly as drawn. Each one is its own design, not a scaled copy of the others.
- **Centre:** a code of 1–3 characters, A–Z or 0–9, required. There are no symbols. The font size depends on code length and shape (`sq` table).
- **Rim text toggle:**
  - **On:** the student's text runs along the top (max 10 characters, defaults to **WINGMAN**). The motto **NEVER FLY ALONE** runs along the bottom. Two five-point stars split them. The top text shrinks to fit long entries.
  - **Off:** the pattern fills the whole ring, edge to edge, clipped to the shape.
- **Patterns (6):** None, Rays, Waves, Checks, Swirl, Guilloche. They are drawn per shape and flow around the code with a clear halo around every glyph.
  - **Placement is a choice: Both · Centre · Rim.** Both fills the whole stamp; Centre stays inside the inner frame; Rim stays in the band between the inner frame and the outer edge. It works the same whether the rim text is on or off, and the pattern is slightly softer when the text is on.
  - **Roundel:** the banner bar is not filled. The pattern runs on through it, and only the bar's own lines and the code are held clear.
  - **Postage and Bag tag:** the pattern runs from the middle out to the perforated edge, passing behind the centre frame rather than stopping at it.
- **Ink (36):** Midnight, Lapiz, Miami, Baby, Powder, Glacier, Teal, Seafoam, Emerald, Racing, Sage, Matcha, Olive, Khaki, Sand, Butter, Honey, Papaya, Clementine, Coral, Ruby, Cherry, Peach, Latte, Mocha, Espresso, Nardo, Gunmetal, Chalk, Mauve, Blush, Bubblegum, Barbie, Lilac, Lavender, Plum. The exact oklch values are in `PALETTE`.
- **Ink texture:** `inkFilter(seed)` gives the stamp its uneven pressure, rough edges and grain. Every account gets its own permanent seed. Make sure the filter ids are unique on the page.
- **Default stamp:** until a student issues their own, sign-offs use the generic seal (tick, livery ink).

**Data model** (add a migration). Store on the user:
`stamp { shape, code, rim:boolean, ring, pattern, ink:<palette name>, seed, issued_at }`

**Rules:**
- Issuing is **one time only**. The server rejects changes once `issued_at` is set.
- Validate the code, rim text, shape, pattern and ink on the server as well as in the UI.

## 5. Licence tab `/account/licence`, also the profile viewer

The first box on the Licence tab **is** the licence card. It's the same component other people see when they tap your face; the owner just sees it in edit mode.

- **Card header row:** above the card, "YOUR LICENCE" on the left and a "See it as others do" button on the right.
- **Cover:**
  - Contours (default), Panels, Runway, Flight path, Chart, or Your image, in a 3×2 grid.
  - The **Cover** button sits in the **top-left corner of the cover**, not the right.
  - **Every colour swatch shows its name underneath** — Midnight, Lapiz, Miami, Baby and so on, all 36. A grid of unlabelled circles is wrong.
  - The set designs are tinted with any of the 36 colours. The cover is that colour as a soft diagonal gradient, from the colour itself down to about 0.26 darker — the look we had before the flat version.
  - Image upload needs size and type limits, storage, and a crop that fills 640×128.
- **Photo and profile colour:**
  - Initials by default, or an uploaded photo.
  - The colour picked for the cover is the student's **profile colour**, used for their initials circle everywhere in the app — Crew, the Ready Room, the route strip, comments — unless they've uploaded a photo, in which case the photo is used.
  - The initials circle is **exactly the colour picked** — same hue, same lightness as the swatch, no shading and no shift. The letters switch between near-black and white for contrast.
  - This is the student's face everywhere: the Flight Deck, Crew, the Ready Room, the route strip, comments and the avatar in the top-right corner. Photo if they have one, initials in their colour if they don't. One component, used everywhere.
  - **The corner avatar must stop showing the Google account picture.** Wherever a sign-in provider's image is being used today, replace it with this component. A student's face in Wingman is what they set in Wingman, nothing else.
  - Uploading: on a phone the picker offers Photos and Camera the way the phone normally does; tablet and desktop get the standard file picker. Cancelling leaves everything as it was, with no empty state and no stuck dialog.
  - **Positioning, like any social app:** after choosing a photo, a dialog shows it inside a round crop with a zoom slider, and the photo can be dragged to reposition. Panning is clamped so no empty edge can show. Save the zoom and offset with the photo and apply them everywhere the avatar appears, so it's framed the same in every place. Cancel goes back to the photo choice, not out of the flow.
- **Everything on the card is centred** in one column: photo, callsign, name, bio, phrase, stats and stamp all share the same centre line. Nothing is left-aligned or offset.
- **Callsign:** always the big line and the only editable name, with uniqueness checked on the server. The full name sits small underneath and isn't editable here.
- **Bio:** one line, max 80 characters.
- **Phrase:** plain italic text with **no border or pill**. It is picked from exactly **three** options:
  1. Torqued to spec. Emotionally too.
  2. It's not a leak, it's a seep.
  3. Could not duplicate.
- **Stats:** three that everyone fills just by using the app: **Hours flown · Lessons signed off · Days flown**. They come from real data.
  - **Hours flown is a normal clock: `13h 54m`.** Drop the tenths-of-an-hour HOBBS drum everywhere it appears, including the Flight Deck instrument. Under an hour it reads `47m`.
- **Stamp:** the focal point at the bottom, centred on a dashed line. Before a stamp is issued, this spot shows a ghost seal and **Create your stamp**.
- **Stamp creator dialog:**
  - A large preview, with a dice (shuffle) button on it.
  - The code input sits directly under the preview.
  - Tabs: Shape · Rim · Pattern · Ink.
  - **Issue my stamp** leads to a confirm step ("It can't be changed after this"), then issues.
- **See it as others do:** shows the card read-only. The card keeps the owner's colours, not the viewer's livery. The only action is **Invite to squadron** (full width).
- **Account box:** email, password, sign out and delete account stay as live.
- **Profile viewer:** tapping any face or stamp anywhere (Crew, Ready Room, Flight Deck route strip) opens this card for that person in a dialog. Its actions:
  - **Invite to squadron** when not squadron mates.
  - **Invite to right seat** plus **Squadron chat** when they are squadron mates.

## 6. Preferences `/account/preferences` and Appearance

**This is the finished page, in this order, and nothing else is on it:**

1. **Who greets you** — the Wingman / The Hermit choice first, then the description of whoever is selected, then the field labelled after the choice ("What Wingman calls you" / "What the Hermit calls you"). Placeholders: Wingman "Skip it. I'll talk anyway.", The Hermit "Skip it, you may. Talk anyway, I will." Nothing under the field.
2. **How social** — the description line, the three levels (Quiet skies / My flight / Open frequency), then **Fly solo** with its switch. Fly solo must really hide the student from Crew, the route strip, the radar and presence, and hide others from them.
3. **Your bar** — "The score you're aiming for" with the value large beside it, the explanation, and a slider from **75 to 100** marked "75% · pass mark" and "100%". 75 is the floor. Accounts below 75 are raised by the migration.
4. **Blocked and muted** — as live.

**Delete from this page and from the code. None of these may appear anywhere on it:**
- **"Go by callsign".** The callsign is the only name the student sets, and it always shows first.
- **Notifications** — every control, every list and every explanation. The page never mentions notifications. What gets sent is fixed (replies, answers, squadron messages, right seat) and is not discussed in the UI.
- **"Your pilot"**, and **"When you usually study"** with its Early / Day / Evening / Late choice and any matching by study time.
- **Study glow.** Chapters render plain.
- **Turbulence**, in Appearance → Accessibility & Motion.

**Appearance stays exactly as it is on the live site**, minus two removals: Your bar (moved here) and Turbulence (deleted). Don't redesign or restyle anything else on that tab.

## 7. Out of scope: don't touch

- **Appearance tab:** only the two removals in section 6. Nothing else on that tab changes.
- **Flight Deck:** stays as it is, except that faces and stamps open the profile viewer.
- **Other items:** the Ready Room chat internals, the quiz taker and the papers reader, beyond wiring the links into them.

## 8. Launch checklist (all must pass)

- [ ] Every button in both reference files maps to a working route or action. Grep for toasts that say "Opens" or "Demo" and make sure none survive.
- [ ] Empty states for:
  - [ ] no squadron
  - [ ] nobody on the module
  - [ ] no papers
  - [ ] no notes
  - [ ] no stamp yet
  - [ ] a brand-new account with zero stats
- [ ] Loading and error states for every fetch, with retries where sensible.
- [ ] Auth guards on `/account/*` and on writes. Users can only edit their own card and stamp.
- [ ] Rate limits and moderation hooks on the bio, callsign and rim text (profanity filter). Report and block reach the profile viewer.
- [ ] Uploads: type and size checks, image resizing, and storage cleanup when an image is replaced.
- [ ] Every screen checked in all 6 liveries × 3 finishes × light/dark, at 390 / 768 / 1280 / 1600px.
- [ ] Keyboard and screen-reader pass on the creator, the note bar and dialogs.
- [ ] Performance:
  - [ ] Crew walls with 100+ stamps stay smooth. Cache the rendered SVG per user stamp and share the filter defs.
  - [ ] Nothing blocks first paint.
- [ ] The console is clean: no errors, and no warnings from our code.
- [ ] Automated tests:
  - [ ] Unit tests for `inspStamp` (every shape × pattern × rim on/off renders with no NaN or overflow) and for code/callsign validation.
  - [ ] E2E tests for: sign off a lesson → the stamp appears on the module list and in Crew; create and issue a stamp → it can't be changed afterwards; take a note → a marker appears and Logbook seek works.

## 9. Files to create in the repo

Create these under `docs/launch/`. Keep them updated as you work.

- `STATUS.md`: every item in this handoff with a status (done / in progress / blocked) and a link to the commit.
- `BACKLOG.md`: anything deferred, with the reason. Pre-seed it with:
  - Mark anchoring for the papers reader.
  - Stamp dots per finished module.
  - The competition / XP segment.
  - Native papers.
  - The final motto copy (currently "Never fly alone").
- `DECISIONS.md`: any place you departed from the reference, and why.
- `BUGS.md`: bugs found and fixed during the port, and any known issues left open, each with severity.
- `QA-CHECKLIST.md`: the section 8 list, ticked off with notes.

Work in small commits per section, run the full test suite before each push, and don't mark the port complete until everything in section 8 is ticked or explicitly listed in `BACKLOG.md` with a reason.


---

## First step

Before touching the app, recreate the two reference files from the appendices below and commit them to `docs/launch/reference/`. Everything above refers to them. Don't edit them: they are the frozen design spec.

Both files are wrapped in a page skeleton when opened as artifacts. Locally, add `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` at the top if your browser needs it.

---

## Appendix A: `docs/launch/reference/01-module-lesson-crew.html`

Module screen (Lessons / Library / Crew), lesson page, note bar, logbook, Crew walls. **Stamp drawing in this file is superseded by Appendix B's `inspStamp()`.**

````html
<title>Wingman Stamps and Crew</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Stardos+Stencil:wght@400;700&family=Instrument+Serif&display=swap">
<style>
:root{
  --ground:oklch(.975 .006 255);--panel:oklch(1 0 0 / .9);--raised:oklch(.955 .01 255);
  --line:oklch(.86 .02 258);--hair:oklch(.9 .015 258);
  --t1:oklch(.2 .02 255);--t2:oklch(.42 .03 255);--t3:oklch(.56 .03 260);
  --accent:oklch(.56 .15 254);--accent-soft:oklch(.56 .15 254 / .12);
  --violet:oklch(.52 .19 295);--copilot:oklch(.58 .13 190);--ok:oklch(.6 .15 148);
  --ink:var(--accent);--video:oklch(.16 .02 255);
  --sans:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,monospace;
  --ink-cobalt:oklch(.5 .16 262);--ink-crimson:oklch(.54 .19 25);--ink-forest:oklch(.52 .12 155);--ink-copper:oklch(.58 .13 50);--ink-graphite:oklch(.38 .02 260);
  --r:13px;--ease:cubic-bezier(.3,.7,.3,1);--wrap:1010px;
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.85 .05 240 / .5), transparent 60%);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:oklch(.14 .0178 255);--panel:oklch(.2075 .0263 256.13 / .78);--raised:oklch(.2763 .0442 258.88 / .87);
  --line:oklch(.3452 .0672 262.18 / .94);--hair:oklch(.3452 .0672 262.18 / .55);
  --t1:oklch(.95 .0052 235);--t2:oklch(.7475 .0341 247.31);--t3:oklch(.625 .0425 264.39);
  --accent:oklch(.68 .1303 253.95);--accent-soft:oklch(.68 .1303 253.95 / .14);
  --violet:oklch(.7 .15 295);--copilot:oklch(.78 .11 190);--ok:oklch(.66 .155 148);
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.35 .08 230 / .55), transparent 60%);
  --ink-cobalt:oklch(.7 .14 262);--ink-crimson:oklch(.7 .16 22);--ink-forest:oklch(.72 .13 155);--ink-copper:oklch(.75 .12 55);--ink-graphite:oklch(.84 .015 250);
}}
:root[data-theme="dark"]{
  --ground:oklch(.14 .0178 255);--panel:oklch(.2075 .0263 256.13 / .78);--raised:oklch(.2763 .0442 258.88 / .87);
  --line:oklch(.3452 .0672 262.18 / .94);--hair:oklch(.3452 .0672 262.18 / .55);
  --t1:oklch(.95 .0052 235);--t2:oklch(.7475 .0341 247.31);--t3:oklch(.625 .0425 264.39);
  --accent:oklch(.68 .1303 253.95);--accent-soft:oklch(.68 .1303 253.95 / .14);
  --violet:oklch(.7 .15 295);--copilot:oklch(.78 .11 190);--ok:oklch(.66 .155 148);
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.35 .08 230 / .55), transparent 60%);
  --ink-cobalt:oklch(.7 .14 262);--ink-crimson:oklch(.7 .16 22);--ink-forest:oklch(.72 .13 155);--ink-copper:oklch(.75 .12 55);--ink-graphite:oklch(.84 .015 250);
}
*{box-sizing:border-box}
html,body{min-height:100%}
body{margin:0;background:var(--glow),var(--ground);background-attachment:fixed;color:var(--t1);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.mono{font-family:var(--mono)}
.wrap{max-width:calc(var(--wrap) + 40px);margin:0 auto;padding-inline:20px}

/* top bar */
.top{display:flex;align-items:center;justify-content:space-between;padding-block:16px;gap:12px}
.brand{font-weight:700;letter-spacing:-.01em}
.top-r{display:flex;gap:10px;align-items:center}
.rr{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:99px;padding:8px 14px;font-size:14px}
.rr b{background:var(--accent);color:var(--ground);font:600 11px var(--mono);border-radius:99px;padding:1px 7px}
.me{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:600;color:#fff;background:oklch(.55 .07 45)}

/* demo switcher */
.demo{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;display:flex;gap:4px;padding:4px;border-radius:99px;background:oklch(.2 .02 255 / .92);color:oklch(.95 0 0);box-shadow:0 10px 30px oklch(0 0 0 / .3);font-size:13px;backdrop-filter:blur(10px)}
.demo button{padding:7px 14px;border-radius:99px;white-space:nowrap}
.demo button[aria-pressed="true"]{background:oklch(.95 0 0);color:oklch(.2 .02 255);font-weight:600}
.demo .sep{width:1px;background:oklch(1 0 0 / .18);margin:6px 2px}

.back{display:inline-flex;align-items:center;gap:6px;color:var(--t2);font-size:14px;padding-block:2px 14px}
.back:hover{color:var(--t1)}

/* ---------- LESSON ---------- */
.lesson{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start;padding-bottom:110px}
.col{display:flex;flex-direction:column;gap:14px;min-width:0}

.player{position:relative;border-radius:var(--r);overflow:hidden;background:var(--video);aspect-ratio:16/9;max-height:62vh;width:100%;user-select:none}
.frame{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(80% 90% at 30% 20%,oklch(.28 .05 250),oklch(.13 .02 255));color:oklch(.92 .01 240)}
.board{text-align:center}
.board .eq{font:500 clamp(28px,6vw,54px)/1.1 var(--mono);letter-spacing:-.02em}
.board .cap{font:12px var(--mono);letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-top:10px}
.bigplay{position:absolute;inset:0;display:grid;place-items:center;transition:opacity .2s}
.bigplay span{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:oklch(1 0 0 / .14);backdrop-filter:blur(6px)}
.player.playing .bigplay{opacity:0;pointer-events:none}
.ctrl{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 10px;background:linear-gradient(transparent,oklch(0 0 0 / .72));color:#fff;transition:opacity .25s}
.player.playing:not(:hover):not(.noting) .ctrl{opacity:.0}
.scrub{position:relative;height:22px;display:flex;align-items:center;cursor:pointer}
.rail{position:absolute;left:0;right:0;height:4px;border-radius:4px;background:oklch(1 0 0 / .25)}
.fill{position:absolute;left:0;height:4px;border-radius:4px;background:oklch(.72 .13 254)}
.knob{position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;transform:translateX(-50%);box-shadow:0 1px 4px oklch(0 0 0 / .5)}
.mk{position:absolute;top:50%;transform:translate(-50%,-50%);z-index:2;display:grid;place-items:center;width:16px;height:22px}
.mk i{display:block;width:8px;height:6px;border:1.5px solid #fff;border-radius:1px;background:oklch(.72 .13 254)}
.mk.q i{width:7px;height:7px;transform:rotate(45deg);background:oklch(.72 .15 295)}
.mk.cp i{background:oklch(.82 .11 190)}
.mk.new i{animation:press .5s var(--ease)}
.mk .tip{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);background:oklch(.16 .02 255 / .96);border:1px solid oklch(1 0 0 / .12);border-radius:10px;padding:8px 10px;width:max-content;max-width:220px;font-size:12.5px;line-height:1.35;opacity:0;pointer-events:none;transition:opacity .15s;text-align:left}
.mk .tip small{display:block;font:10.5px var(--mono);opacity:.65;margin-bottom:2px;letter-spacing:.04em}
.mk:hover .tip{opacity:1}
.bar{display:flex;align-items:center;gap:6px;margin-top:4px}
.cb{width:34px;height:34px;display:grid;place-items:center;border-radius:8px}
.cb:hover{background:oklch(1 0 0 / .12)}
.time{font:12.5px var(--mono);opacity:.9;margin-left:4px;font-variant-numeric:tabular-nums}
.grow{flex:1}

.title-row{display:flex;align-items:center;gap:12px}
.title-row h1{font-size:21px;font-weight:600;margin:0;letter-spacing:-.01em;flex:1;min-width:0}
.icon-btn{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--t2);border:1px solid var(--line);background:var(--panel)}
.icon-btn:hover{color:var(--t1)}
.icon-btn[aria-pressed="true"]{color:var(--accent)}
.icon-btn[aria-pressed="true"] svg path{fill:currentColor}
.seal{width:40px;height:40px;display:grid;place-items:center;color:var(--t3)}
.seal[data-on="true"]{color:var(--accent)}
.seal[data-on="true"] svg{animation:press .5s var(--ease)}
@keyframes press{0%{transform:scale(1.6);opacity:0}55%{transform:scale(.9);opacity:1}100%{transform:scale(1)}}

.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);backdrop-filter:blur(8px)}
.tabs{display:flex;align-items:center;gap:20px;padding:0 18px;border-bottom:1px solid var(--hair)}
.tab{padding:14px 0 12px;color:var(--t3);font-size:15.5px;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;gap:6px;align-items:baseline}
.tab small{font:12px var(--mono);color:var(--t3)}
.tab[aria-selected="true"]{color:var(--t1);border-color:var(--accent)}
.tabs .link{margin-left:auto;font-size:13px;color:var(--t2)}
.chips{display:flex;gap:6px;padding:12px 18px 4px;flex-wrap:wrap}
.chip{font-size:12.5px;padding:5px 11px;border-radius:99px;border:1px solid var(--line);color:var(--t2)}
.chip[aria-pressed="true"]{background:var(--accent-soft);border-color:transparent;color:var(--t1)}
.chip .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--copilot);margin-right:6px;vertical-align:1px}

.log{list-style:none;margin:0;padding:6px 8px 10px}
.entry{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:10px;border-radius:10px}
.entry:hover{background:var(--raised)}
.entry .st{display:block;line-height:0}
.entry .st:hover{transform:rotate(0) scale(1.04)}
.entry p{margin:0;font-size:14.5px;line-height:1.45;text-wrap:pretty}
.entry .who{font-size:12px;color:var(--t3);margin-top:2px}
.entry .who.cp{color:var(--copilot)}
.entry .del{opacity:0;color:var(--t3);width:32px;height:32px;display:grid;place-items:center;border-radius:8px}
.entry:hover .del,.entry .del:focus-visible{opacity:1}
.entry .del:hover{color:var(--t1);background:var(--line)}
.entry.fresh .st svg{animation:press .55s var(--ease)}
.empty{padding:26px 18px 30px;color:var(--t3);font-size:14px;text-align:center}
.cmt{display:flex;gap:12px;padding:12px 10px}
.cmt p{margin:2px 0 0;font-size:14.5px}
.cmt .n{font-size:13px;font-weight:600}
.cmt .n span{font-weight:400;color:var(--t3);margin-left:6px}

/* up next */
.next-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px}
.next-h b{font-size:14px;font-weight:600}
.next-h span{font:12px var(--mono);color:var(--t3)}
.next-h .tog{display:none}
.next ol{list-style:none;margin:0;padding:0 8px 10px}
.nx{display:grid;grid-template-columns:92px 1fr auto;gap:10px;align-items:center;padding:7px;border-radius:10px;width:100%;text-align:left}
.nx:hover{background:var(--raised)}
.nx[aria-current="true"]{background:var(--accent-soft)}
.thumb{aspect-ratio:16/9;border-radius:7px;background:radial-gradient(90% 90% at 30% 20%,oklch(.3 .05 250),oklch(.15 .02 255));display:grid;place-items:end;padding:4px;font:10.5px var(--mono);color:oklch(.92 0 0)}
.nx .t{font-size:13.5px;line-height:1.3}
.nx .d{font-size:11.5px;color:var(--t3)}
.nx .now{font:11px var(--mono);color:var(--accent)}
.nx .sm{color:var(--accent);line-height:0}

/* note bar */
.nb{position:fixed;z-index:30;width:min(520px,calc(100vw - 32px));display:flex;gap:8px;align-items:flex-end;touch-action:none;cursor:grab}
.nb.drag{cursor:grabbing}
.nb .field{flex:1;display:flex;gap:10px;align-items:flex-start;background:oklch(.17 .02 255 / .96);color:oklch(.95 0 0);border:1px solid oklch(.68 .13 254 / .5);border-radius:20px;padding:11px 14px;box-shadow:0 18px 50px oklch(0 0 0 / .45);backdrop-filter:blur(12px)}
.nb.ask .field{border-color:oklch(.7 .15 295 / .6)}
.nb .at{font:12px var(--mono);color:oklch(.75 .12 254);padding-top:3px;white-space:nowrap}
.nb.ask .at{color:oklch(.78 .13 295)}
.nb textarea{flex:1;background:none;border:0;color:inherit;font:15px/1.4 var(--sans);resize:none;outline:none;min-height:22px;max-height:160px;cursor:text}
.nb textarea::placeholder{color:oklch(.7 .02 255)}
.nb .round{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;box-shadow:0 10px 30px oklch(0 0 0 / .4)}
.nb .ok{background:oklch(.68 .13 254);color:oklch(.14 .02 255)}
.nb.ask .ok{background:oklch(.7 .15 295)}
.nb .no{background:oklch(.25 .02 255);color:oklch(.9 0 0)}

/* ---------- CREW / MODULE ---------- */
.mod{padding-bottom:110px}
.mod h1{font-size:clamp(34px,5vw,42px);line-height:1.1;margin:0;letter-spacing:-.02em}
.mod .sub{color:var(--t3);margin:6px 0 22px}
.mtabs{display:flex;align-items:center;gap:22px;padding:0 18px;border-bottom:1px solid var(--hair)}
.search{margin-left:6px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:99px;padding:7px 14px;color:var(--t3);min-width:0;flex:1 1 auto;margin-block:8px}
.search input{border:0;background:none;color:var(--t1);font:inherit;font-size:14px;outline:none;min-width:0;width:100%}
.grp{padding:14px 18px 4px;display:flex;align-items:center;gap:10px}
.grp h3{margin:0;font-size:13.5px;font-weight:600}
.grp span{font:11.5px var(--mono);color:var(--t3);letter-spacing:.04em}
.grp .here{color:var(--accent)}
.grp::after{content:"";flex:1;height:1px;background:var(--hair)}
.people{list-style:none;margin:0;padding:2px 8px 8px}
.person{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:9px 10px;border-radius:12px;cursor:pointer}
.person:hover{background:var(--raised)}
.av{position:relative;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-weight:600;color:#fff;flex:none}
.av.on::after{content:"";position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:var(--ok);border:2.5px solid var(--ground)}
.av .rs{position:absolute;left:-3px;top:-3px;width:18px;height:18px;border-radius:50%;background:var(--copilot);border:2px solid var(--ground);display:grid;place-items:center}
.pn{min-width:0}
.pn .nm{font-weight:600;font-size:15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pn .cs{font:11px var(--mono);letter-spacing:.08em;color:var(--t3)}
.pn .meta{font-size:12.5px;color:var(--t3);display:flex;gap:10px;align-items:center;margin-top:1px}
.acts{display:flex;gap:6px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 12px;border-radius:99px;border:1px solid var(--line);color:var(--t2);background:var(--panel);white-space:nowrap}
.pill:hover{color:var(--t1);border-color:var(--t3)}
.pill.pri{background:var(--accent);border-color:transparent;color:var(--ground);font-weight:600}
.pill.pri:hover{color:var(--ground);filter:brightness(1.08)}
.mini-stamp{font:600 10px var(--mono);letter-spacing:.06em;color:var(--accent);border:1.3px solid currentColor;border-radius:2px;padding:0 4px;line-height:15px;opacity:.9;transform:rotate(-2deg);display:inline-block}

/* module lessons list */
.chap{border-bottom:1px solid var(--hair)}
.chap:last-child{border-bottom:0}
.ch-h{width:100%;display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;padding:18px 20px;text-align:left}
.ch-h h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.015em;line-height:1.2}
.ch-h .cm{font-size:13px;color:var(--t3);margin-top:2px}
.ch-h .cs2{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--t3)}
.ch-h .cs2.here{color:var(--accent);font-weight:600}
.ch-h .chev{transition:transform .25s var(--ease);color:var(--t3)}
.chap.open .chev{transform:rotate(90deg)}
.ch-body{display:none;padding:0 14px 14px}
.chap.open .ch-body{display:block}
.lrow{width:100%;display:grid;grid-template-columns:62px 1fr auto;gap:14px;align-items:center;padding:8px 12px;border-radius:12px;text-align:left;border:1px solid transparent}
.lrow:hover{background:var(--raised)}
.lrow.cur{background:var(--accent-soft);border-color:color-mix(in oklab,var(--accent) 45%,transparent)}
.lrow .th{aspect-ratio:16/9;border-radius:7px;background:radial-gradient(90% 90% at 30% 20%,oklch(.3 .05 250),oklch(.15 .02 255));border:1px solid var(--hair);position:relative;overflow:hidden}
.lrow .th:not(.quiz-thumb) b{position:absolute;left:0;bottom:0;height:2px;background:var(--accent)}
.quiz-thumb{display:grid;grid-template-columns:auto 1fr;gap:5px;align-items:center;padding:5px 6px;background:var(--raised)!important}
.quiz-thumb__sheet{display:grid;gap:2px}
.quiz-thumb__sheet span{display:flex;gap:2px}
.quiz-thumb__sheet i{width:5px;height:5px;border-radius:50%;border:1px solid var(--t3)}
.quiz-thumb__sheet i.on{background:var(--accent);border-color:var(--accent)}
.quiz-thumb__count{font-family:var(--mono);font-size:9px;line-height:1.1;color:var(--t2);text-align:right}
.quiz-thumb__count b{display:block;font-size:13px;color:var(--t1);font-weight:600}
.lrow .lt{font-size:14.5px;font-weight:500}
.lrow .ls{font-size:12.5px;color:var(--t3)}
.lrow .ls.warn{color:var(--t2)}
.lrow .rt{justify-self:end;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t3)}
.lrow .rt .sc{font:600 13px var(--mono);color:var(--t1)}
.resume{background:var(--accent);color:var(--ground);font-weight:600;font-size:13.5px;padding:6px 14px;border-radius:8px}
.imp{display:block;line-height:0}
.imp.fresh svg{animation:press .55s var(--ease)}
.papers{list-style:none;margin:0;padding:0 14px 8px}
.lsec{padding:18px 20px 6px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.lsec h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.015em;line-height:1.2}
.lsec p{margin:2px 0 0;font-size:13px;color:var(--t3)}
.libsplit{border-bottom:1px solid var(--hair)}
.lchips{display:flex;gap:6px;padding:4px 20px 8px;flex-wrap:wrap}
.paper .prog{height:3px;border-radius:3px;background:var(--hair);margin-top:6px;max-width:420px;overflow:hidden}
.paper .prog b{display:block;height:100%;background:var(--accent)}
.act-o{font-size:13px;font-weight:600;padding:6px 14px;border-radius:8px;border:1px solid color-mix(in oklab,var(--accent) 55%,transparent);color:var(--accent)}
.paper{display:grid;grid-template-columns:62px 1fr auto;gap:14px;align-items:center;padding:10px 12px;border-radius:12px}
.paper:hover{background:var(--raised)}
.paper .pg{aspect-ratio:16/9;border-radius:7px;border:1px solid var(--line);background:var(--ground);display:grid;place-items:center;color:var(--t2)}

/* crew empty state */
.cempty{padding:22px 20px 24px}
.ce-h h3{margin:0 0 6px;font-size:19px;font-weight:700;letter-spacing:-.01em}
.ce-h p{margin:0;color:var(--t2);font-size:14.5px;max-width:52ch;line-height:1.55}
.ce-ghost{margin:18px 0;border:1px dashed var(--line);border-radius:14px;padding:6px 12px;opacity:.75}
.ce-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 2px;border-top:1px solid var(--hair)}
.ce-row:first-child{border-top:0}
.ce-row b{display:block;font-size:14.5px;font-weight:600}
.ce-row span{font-size:12.5px;color:var(--t3)}
.ce-faces{display:flex}
.ce-face{width:26px;height:26px;border-radius:50%;background:var(--raised);border:2px solid var(--ground);margin-left:-8px;animation:cepulse 2.4s var(--ease) infinite}
@keyframes cepulse{0%,100%{opacity:.5}50%{opacity:1}}
.ce-do{display:flex;gap:8px;flex-wrap:wrap}
.ce-note{margin:16px 0 0;font-size:13px;color:var(--t3);max-width:56ch}

/* profile sheet */
.scrim{position:fixed;inset:0;z-index:50;background:oklch(0 0 0 / .45);display:grid;place-items:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s var(--ease)}
.scrim.open{opacity:1;pointer-events:auto}
.sheet{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--ground);border:1px solid var(--line);border-radius:20px;box-shadow:0 30px 80px oklch(0 0 0 / .5);transform:translateY(16px) scale(.98);transition:transform .35s var(--ease)}
.scrim.open .sheet{transform:none}
.cover{height:96px;position:relative;background:linear-gradient(120deg,oklch(.45 .12 254),oklch(.35 .08 230));overflow:hidden}
.cover svg{position:absolute;inset:0;width:100%;height:100%}
.x{position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:50%;background:oklch(0 0 0 / .3);color:#fff;display:grid;place-items:center}
.pbody{padding:0 20px 20px;margin-top:-34px;position:relative}
.pbody .av{width:76px;height:76px;font-size:28px;border:4px solid var(--ground)}
.pbody .av.on::after{width:16px;height:16px;border-width:3px}
.pname{margin:10px 0 0;font-size:21px;font-weight:600;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.pname span{font:12px var(--mono);letter-spacing:.1em;color:var(--t3);font-weight:400}
.bio{color:var(--t2);margin:6px 0 14px;font-size:14.5px}
.where{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.where span{font-size:12.5px;padding:4px 10px;border-radius:99px;background:var(--raised);color:var(--t2)}
.lic{border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;background:linear-gradient(135deg,var(--raised),transparent);position:relative;overflow:hidden}
.lic .k{font:10.5px var(--mono);letter-spacing:.12em;color:var(--t3);text-transform:uppercase}
.lic .v{font-weight:600;font-size:14.5px;margin-bottom:6px}
.lic .row{display:grid;grid-template-columns:auto auto;gap:4px 18px;justify-content:start}
.pbtns{display:flex;gap:8px;margin-top:16px}
.pbtns .pill{flex:1;justify-content:center;padding:10px 12px;font-size:14px}

/* crew = the module's people */
.csum{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px 20px 14px;border-bottom:1px solid var(--hair)}
.csum b{font-size:22px;font-weight:700;letter-spacing:-.015em}
.csum p{margin:2px 0 0;font-size:13px;color:var(--t3)}
.stack{display:flex;align-items:center}
.stack .av{width:32px;height:32px;font-size:12px;border:2.5px solid var(--ground);margin-left:-8px;cursor:pointer}
.stack .av:first-child{margin-left:0}
.stack .av.on::after{width:9px;height:9px;border-width:2px}
.stack .more{font:600 11.5px var(--mono);color:var(--t2);margin-left:8px}
.cch{padding:16px 20px 18px;border-bottom:1px solid var(--hair)}
.cch-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.cch-h h3{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em}
.cch-h .cm{font-size:12.5px;color:var(--t3)}
.cch-h .cm .here{color:var(--accent);font-weight:600}
.onit{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--t3)}
.wall{margin-top:12px;min-height:56px;border:1px dashed var(--line);border-radius:12px;padding:26px 10px 8px;display:flex;flex-wrap:wrap;align-items:center;gap:2px;position:relative;color:var(--accent)}
.wall .wl{position:absolute;left:12px;top:8px;font:10px var(--mono);letter-spacing:.12em;color:var(--t3)}
.wall button{line-height:0;margin:-3px -2px;transition:transform .2s var(--ease);border-radius:50%}
.wall button:hover{transform:scale(1.15) rotate(0deg);z-index:1}
.wall button.mine{color:var(--t1)}
.wall .none{font-size:13px;color:var(--t3);padding:10px 4px}
.helpers{padding:16px 20px 18px}
.helpers h3{margin:0 0 2px;font-size:18px;font-weight:700}
.helpers p.cm{margin:0 0 10px;font-size:12.5px;color:var(--t3)}
.hrow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.hp{display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px;border:1px solid var(--line);border-radius:99px;background:var(--panel)}
.hp .av{width:32px;height:32px;font-size:12px}
.hp .av.on::after{width:9px;height:9px;border-width:2px}
.hp span{font-size:13.5px}
.hp small{display:block;font:11px var(--mono);color:var(--t3)}
.sqring{box-shadow:0 0 0 2px var(--copilot)}

/* licence + stamp creator */
.me{cursor:pointer}
.menu{position:absolute;right:20px;top:62px;z-index:45;background:var(--ground);border:1px solid var(--line);border-radius:14px;padding:6px;min-width:190px;box-shadow:0 20px 50px oklch(0 0 0 / .35)}
.menu button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:9px;font-size:14px;text-align:left}
.menu button:hover{background:var(--raised)}
.phead{display:flex;align-items:center;gap:16px;margin-bottom:22px}
.phead .av{width:64px;height:64px;font-size:26px;background:oklch(.55 .07 45)}
.phead h1{font-size:30px;margin:0;letter-spacing:-.02em;line-height:1.1}
.phead p{margin:3px 0 0;color:var(--t3);font-size:14px}
.licdoc{margin:18px 20px;border:1px solid var(--line);border-radius:16px;padding:22px;display:grid;grid-template-columns:1fr 176px;gap:22px;position:relative;overflow:hidden;
  background:repeating-radial-gradient(circle at 110% -20%,transparent 0 11px,color-mix(in oklab,var(--accent) 7%,transparent) 11px 12px),linear-gradient(135deg,var(--raised),transparent 70%)}
.licdoc .k{font:10.5px var(--mono);letter-spacing:.12em;color:var(--t3);text-transform:uppercase}
.licdoc .ttl{font:600 11px var(--mono);letter-spacing:.16em;color:var(--accent)}
.licdoc h2{margin:4px 0 18px;font-size:22px;letter-spacing:-.01em}
.lf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px}
.lf .v{font-size:15px;font-weight:500;margin-top:2px}
.lf .v.mono{font-family:var(--mono);font-size:14px}
.slot{border:1.5px dashed var(--line);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:30px 14px 14px;text-align:center;min-height:176px;position:relative}
.slot.issued{border-style:solid;border-color:var(--hair);background:color-mix(in oklab,var(--ground) 40%,transparent)}
.slot .k{position:absolute;top:10px;left:0;right:0}
.slot .gen{color:var(--t3);line-height:0;opacity:.8}
.slot .when{font:11px var(--mono);color:var(--t3)}
.slot .got{line-height:0}
.slot .got.slam svg{animation:slam .7s var(--ease)}
@keyframes slam{0%{transform:translateY(-30px) scale(1.7);opacity:0}45%{transform:translateY(0) scale(.92);opacity:1}62%{transform:scale(1.04)}100%{transform:scale(1)}}
.maker{border-top:1px solid var(--hair);display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:26px;padding:22px 20px}
.maker[hidden]{display:none}
.stpaper{border-radius:14px;background:var(--raised);display:grid;place-items:center;aspect-ratio:1;position:relative;overflow:hidden;align-self:start}
.stpaper::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 27px,var(--hair) 27px 28px);opacity:.55}
.stpaper .big{position:relative;line-height:0}
.stpaper .big.go svg{animation:press .45s var(--ease)}
.stpaper .cap{position:absolute;bottom:10px;left:0;right:0;text-align:center;font:10.5px var(--mono);color:var(--t3);letter-spacing:.06em}
.ctl{display:flex;flex-direction:column;gap:16px;min-width:0}
.ctl .lab{font:10.5px var(--mono);letter-spacing:.12em;color:var(--t3);text-transform:uppercase;margin:0 0 7px}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{width:46px;height:46px;border-radius:11px;border:1px solid var(--line);display:grid;place-items:center;color:var(--t2);line-height:0}
.opt[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.opt.txt{width:auto;padding:0 14px;font-size:13px;line-height:1}
.opt.fnt{width:auto;padding:0 14px;line-height:1;font-size:17px;font-weight:700}
.sw{width:34px;height:34px;border-radius:50%;border:3px solid var(--ground);box-shadow:0 0 0 1px var(--line)}
.sw[aria-pressed="true"]{box-shadow:0 0 0 2px var(--t1)}
.fields{display:grid;grid-template-columns:120px 1fr;gap:10px}
.fields label{display:flex;flex-direction:column;gap:6px;min-width:0}
.fields input{font:600 15px var(--mono);letter-spacing:.08em;text-transform:uppercase;background:var(--raised);border:1px solid var(--line);border-radius:10px;padding:9px 12px;color:var(--t1);width:100%;min-width:0}
.fields input:disabled{opacity:.4}
.issue{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:4px}
.issue .pill{padding:10px 18px;font-size:14px}
.confirm{border:1px solid color-mix(in oklab,var(--accent) 45%,transparent);background:var(--accent-soft);border-radius:12px;padding:12px 14px;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:100%}
.confirm b{flex:1 1 220px;font-weight:500}
@media (max-width:760px){.licdoc{grid-template-columns:1fr}.slot{min-height:150px}.maker{grid-template-columns:1fr}.stpaper{max-width:280px;width:100%;justify-self:center}}

/* toast */
.toast{position:fixed;left:50%;top:18px;transform:translate(-50%,-20px);opacity:0;z-index:60;background:var(--t1);color:var(--ground);padding:9px 16px;border-radius:99px;font-size:13.5px;transition:all .3s var(--ease);pointer-events:none;white-space:nowrap}
.toast.show{opacity:1;transform:translate(-50%,0)}

@media (max-width:860px){
  .lesson{grid-template-columns:1fr}
  .next{order:2}.logcard{order:3}
  .next-h .tog{display:grid;width:30px;height:30px;place-items:center;border-radius:8px;color:var(--t2)}
  .next.shut ol{display:none}
  .next.shut .tog svg{transform:rotate(-90deg)}
}
@media (max-width:560px){
  .acts .pill .lbl{display:none}
  .acts .pill{padding:8px}
  .search{padding:6px 10px}
  .mtabs{gap:16px;padding:0 12px}
  .tabs{padding:0 12px}
  .rr .lbl{display:none}
  .demo{font-size:12px}.demo button{padding:7px 10px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale=".8" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="1" seed="11" result="s"/>
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.8 1.9" result="m"/>
      <feComposite in="d" in2="m" operator="in"/>
    </filter>
  </defs>
</svg>

<div class="wrap">
  <header class="top">
    <span class="brand">Wingman</span>
    <div class="top-r">
      <button class="rr" data-rr><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg><span class="lbl">Ready Room</span><b>1</b></button>
      <button class="me" id="meBtn" aria-label="Your menu">h</button>
    </div>
  </header>

  <!-- LESSON -->
  <section id="v-lesson">
    <button class="back" data-go="mod"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>Chapter 2</button>
    <div class="lesson">
      <div class="col">
        <div class="player" id="player">
          <div class="frame"><div class="board"><div class="eq">4 500 = 4.5 × 10³</div><div class="cap">Standard form · M1.02.2</div></div></div>
          <button class="bigplay" id="bigplay" aria-label="Play"><span><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span></button>
          <div class="ctrl">
            <div class="scrub" id="scrub"><div class="rail"></div><div class="fill" id="fill"></div><div class="knob" id="knob"></div></div>
            <div class="bar">
              <button class="cb" id="pp" aria-label="Play"></button>
              <span class="time" id="time">0:00 / 8:24</span>
              <span class="grow"></span>
              <button class="cb" id="stampBtn" aria-label="Stamp this moment" title="Stamp this moment">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="1.5"/><rect x="5.8" y="8.8" width="12.4" height="6.4" rx=".5" stroke-width="1"/></svg>
              </button>
              <button class="cb" id="askBtn" aria-label="Ask about this moment" title="Ask about this moment">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M10 10a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 15.6v.1" stroke-linecap="round"/></svg>
              </button>
              <button class="cb" aria-label="Full screen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
            </div>
          </div>
        </div>

        <div class="title-row">
          <h1 id="lTitle">Lesson 2 · Standard form</h1>
          <button class="icon-btn" id="save" aria-pressed="false" aria-label="Save lesson" title="Save"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>
          <button class="seal" id="seal" data-on="false" aria-label="Sign off lesson" title="Sign off"></button>
        </div>

        <div class="card logcard">
          <div class="tabs" role="tablist">
            <button class="tab" role="tab" aria-selected="true" data-tab="log">Logbook <small id="logCount">3</small></button>
            <button class="tab" role="tab" aria-selected="false" data-tab="cmt">Comments <small>2</small></button>
            <button class="link">Export</button>
          </div>
          <div id="tab-log">
            <div class="chips" id="filters">
              <button class="chip" aria-pressed="true" data-f="all">All</button>
              <button class="chip" aria-pressed="false" data-f="me">Mine</button>
              <button class="chip" aria-pressed="false" data-f="cp"><span class="dot"></span>Sara · right seat</button>
            </div>
            <ul class="log" id="log"></ul>
          </div>
          <div id="tab-cmt" hidden>
            <div style="padding:6px 8px 10px">
              <div class="cmt"><span class="av" style="width:34px;height:34px;background:oklch(.55 .1 20)">Y</span><div><div class="n">Yousef<span>2h</span></div><p>Is 10⁰ always 1 even for negative bases? The slide at 4:10 skips it.</p></div></div>
              <div class="cmt"><span class="av" style="width:34px;height:34px;background:oklch(.55 .09 160)">N</span><div><div class="n">Noor<span>1h</span></div><p>Yes, anything non-zero to the power 0 is 1. Asked the same in the Ready Room thread.</p></div></div>
            </div>
          </div>
        </div>
      </div>

      <aside class="card next" id="next">
        <div class="next-h"><b>Chapter 2</b><span>2 of 3 <button class="tog" id="tog" aria-label="Collapse up next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button></span></div>
        <ol id="nextList"></ol>
      </aside>
    </div>
  </section>

  <!-- MODULE / CREW -->
  <section id="v-lic" hidden>
    <button class="back" data-go="mod"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>Module 1</button>
    <div class="mod">
      <div class="phead"><span class="av">h</span><div><h1>Claire</h1><p>B2 · AU University</p></div></div>
      <div class="card">
        <div class="mtabs" role="tablist">
          <button class="tab" role="tab" aria-selected="false" id="ptProfile">Profile</button>
          <button class="tab" role="tab" aria-selected="true">Licence</button>
        </div>
        <div class="licdoc">
          <div>
            <div class="ttl">PART-66 · STUDENT LICENCE</div>
            <h2>Claire</h2>
            <div class="lf">
              <div><div class="k">Category</div><div class="v">B2 · Avionics</div></div>
              <div><div class="k">Licence no.</div><div class="v mono">WM-26-04117</div></div>
              <div><div class="k">Institute</div><div class="v">AU University</div></div>
              <div><div class="k">Modules</div><div class="v">M1 in progress</div></div>
            </div>
          </div>
          <div class="slot" id="slot"></div>
        </div>
        <div class="maker" id="maker" hidden></div>
      </div>
    </div>
  </section>
  <section id="v-mod" hidden>
    <button class="back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>Flight Deck</button>
    <div class="mod">
      <h1>Module 1</h1>
      <p class="sub">6 lessons and 3 quizzes</p>
      <div class="card">
        <div class="mtabs" role="tablist">
          <button class="tab" role="tab" aria-selected="true" data-mt="lessons">Lessons</button>
          <button class="tab" role="tab" aria-selected="false" data-mt="library">Library</button>
          <button class="tab" role="tab" aria-selected="false" data-mt="crew">Crew <small>15</small></button>
          <label class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" placeholder="Search lessons"></label>
        </div>
        <div id="mt-lessons"></div>
        <div id="mt-library" hidden></div>
        <div id="crew" hidden></div>
      </div>
    </div>
  </section>
</div>

<div class="scrim" id="scrim"><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<div class="toast" id="toast"></div>

<nav class="demo" aria-label="Demo views">
  <button data-go="mod" aria-pressed="true">Module</button>
  <button data-go="lesson" aria-pressed="false">Lesson</button>
  <button data-go="lic" aria-pressed="false">Licence</button>
  <span class="sep"></span>
  <button id="theme" aria-label="Switch light or dark">Light / Dark</button>
  <button id="crewEmpty" title="Demo only">Crew: empty</button>
  <button id="resetStamp" title="Demo only">Reset stamp</button>
</nav>

<script>
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DUR=504; let t=204, playing=false, timer=null;
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const fmt2=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
const ME={id:'NOTE',name:'You'}, CP={id:'SARA',name:'Sara'};

/* ---- stamp drawings ---- */
function noteStamp(time,id,color,rot){
  return `<svg width="86" height="46" viewBox="0 0 86 46" style="color:${color};transform:rotate(${rot}deg)" aria-label="Stamp ${time}">
  <g filter="url(#ink)" fill="none" stroke="currentColor">
   <rect x="2" y="2" width="82" height="42" rx="3" stroke-width="1.8"/>
   <rect x="5.5" y="5.5" width="75" height="35" rx="1.5" stroke-width=".8"/>
   <line x1="5.5" y1="15" x2="80.5" y2="15" stroke-width=".8"/>
   <g fill="currentColor" stroke="none" font-family="Geist Mono,monospace" text-anchor="middle">
    <text x="43" y="12.6" font-size="7.5" font-weight="600" letter-spacing=".8">${id}</text>
    <text x="43" y="34" font-size="15" font-weight="600" letter-spacing=".5">${time}</text>
   </g></g></svg>`;
}
function askStamp(time,color,rot){
  return `<svg width="86" height="46" viewBox="0 0 86 46" style="color:${color};transform:rotate(${rot}deg)" aria-label="Question ${time}">
  <g filter="url(#ink)" fill="none" stroke="currentColor">
   <path d="M23 2 44 23 23 44 2 23Z" stroke-width="1.8"/>
   <path d="M23 7 39 23 23 39 7 23Z" stroke-width=".8"/>
   <g fill="currentColor" stroke="none" font-family="Geist Mono,monospace">
    <text x="23" y="28" font-size="14" font-weight="600" text-anchor="middle">?</text>
    <text x="48" y="20" font-size="7.5" font-weight="600" letter-spacing=".8">ASK</text>
    <text x="48" y="32" font-size="11.5" font-weight="600">${time}</text>
   </g></g></svg>`;
}
const INKS=[{k:'livery',v:'var(--accent)',n:'Livery'},{k:'cobalt',v:'var(--ink-cobalt)',n:'Cobalt'},{k:'crimson',v:'var(--ink-crimson)',n:'Crimson'},{k:'forest',v:'var(--ink-forest)',n:'Forest'},{k:'copper',v:'var(--ink-copper)',n:'Copper'},{k:'graphite',v:'var(--ink-graphite)',n:'Graphite'}];
const FONTS={plain:'Geist Mono,ui-monospace,monospace',stencil:'Stardos Stencil,Impact,sans-serif',serif:'Instrument Serif,Georgia,serif'};
const DEFAULT_STAMP={shape:'seal',mark:'tick',text:'',ring:'',font:'plain',ink:'livery',seed:1,stars:0,generic:true};
let MYSTAMP={...DEFAULT_STAMP}, ISSUED=null;
const SHAPES={
 seal:{o:()=>{let d='';const n=30;for(let i=0;i<n*2;i++){const r=i%2?16.4:18.4;const a=i/(n*2)*Math.PI*2-Math.PI/2;d+=(i?'L':'M')+(20+r*Math.cos(a)).toFixed(2)+','+(20+r*Math.sin(a)).toFixed(2)}return `<path d="${d}Z" stroke-width="1.3"/>`},i:'<circle cx="20" cy="20" r="13.2" stroke-width=".9"/>'},
 circle:{o:()=>'<circle cx="20" cy="20" r="18" stroke-width="1.8"/>',i:'<circle cx="20" cy="20" r="14.6" stroke-width=".8"/>'},
 oval:{o:()=>'<ellipse cx="20" cy="20" rx="19" ry="14" stroke-width="1.8"/>',i:'<ellipse cx="20" cy="20" rx="15.8" ry="11" stroke-width=".8"/>',noRing:true},
 hex:{o:()=>'<path d="M20 1.8 35.8 10.9V29.1L20 38.2 4.2 29.1V10.9Z" stroke-width="1.8" stroke-linejoin="round"/>',i:'<path d="M20 5.6 32.5 12.8V27.2L20 34.4 7.5 27.2V12.8Z" stroke-width=".8" stroke-linejoin="round"/>'},
 square:{o:()=>'<rect x="2.5" y="2.5" width="35" height="35" rx="4" stroke-width="1.8"/>',i:'<rect x="6" y="6" width="28" height="28" rx="2" stroke-width=".8"/>'},
 shield:{o:()=>'<path d="M20 2 36 7.5V19c0 9.5-7 16-16 19C11 35 4 28.5 4 19V7.5Z" stroke-width="1.8" stroke-linejoin="round"/>',i:'<path d="M20 5.8 32.5 10.2V19c0 7.4-5.4 12.6-12.5 15.2C12.9 31.6 7.5 26.4 7.5 19v-8.8Z" stroke-width=".8" stroke-linejoin="round"/>'},
};
const MARKS={
 tick:'<path d="M14.5 20.5 18.5 24.5 26 16" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
 plane:'<path d="M20 11.5c.9 0 1.3.9 1.3 1.9v4.3l6.4 3.9v1.9l-6.4-2v3.8l2 1.6v1.5L20 27.5l-3.3.9v-1.5l2-1.6v-3.8l-6.4 2v-1.9l6.4-3.9v-4.3c0-1 .4-1.9 1.3-1.9Z" stroke="none"/>',
 rotor:'<circle cx="20" cy="20" r="2.3" stroke="none"/><path d="M19.2 18.5 18.6 11a1.4 1.4 0 0 1 2.8 0l-.6 7.5ZM21.4 20.4l6.8 3.2a1.4 1.4 0 0 1-1.4 2.4l-6.2-4.3ZM18.6 20.4l-6.8 3.2a1.4 1.4 0 0 0 1.4 2.4l6.2-4.3Z" stroke="none"/>',
 compass:'<path d="M20 10.5l1.9 7.6 7.6 1.9-7.6 1.9-1.9 7.6-1.9-7.6-7.6-1.9 7.6-1.9Z" stroke="none"/>',
 wrench:'<path d="M24.8 12.2a4.6 4.6 0 0 0-5.9 5.8l-6.3 6.3a1.6 1.6 0 0 0 2.3 2.3l6.3-6.3a4.6 4.6 0 0 0 5.8-5.9l-2.7 2.7-2.3-.6-.6-2.3Z" stroke="none"/>',
 star:'<path d="m20 12 2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L20 24.2 15 27l1.2-5.5-4.2-3.8 5.6-.6Z" stroke="none"/>',
};
const inkVal=k=>(INKS.find(i=>i.k===k)||INKS[0]).v;
function inkFilter(seed){const id='ink'+seed;if(!document.getElementById(id)){const base=document.getElementById('ink');const c=base.cloneNode(true);c.id=id;const t=c.querySelectorAll('feTurbulence');t[0].setAttribute('seed',3+seed*7);t[1].setAttribute('seed',11+seed*13);t[1].setAttribute('baseFrequency',(.5+(seed%5)*.07).toFixed(2));base.parentNode.appendChild(c)}return id}
let RID=0;
function inspStamp(on,size=40,rot=0,st=MYSTAMP){
  const sh=SHAPES[st.shape]||SHAPES.seal, font=FONTS[st.font]||FONTS.plain;
  const ring=sh.noRing?'':(st.ring||'').toUpperCase();
  const txt=(st.text||'').toUpperCase();
  const k=ring?.72:1, fs=(txt.length>3?7.6:txt.length>2?9.4:11.5)*k*(st.font==='serif'?1.25:1);
  let inner=st.mark==='text'?`<text x="20" y="${20+fs*.36}" font-size="${fs.toFixed(2)}" text-anchor="middle" font-weight="700" stroke="none" fill="currentColor" font-family="${font}">${txt}</text>`
    :`<g transform="translate(20 20) scale(${k}) translate(-20 -20)" fill="currentColor" stroke="currentColor">${MARKS[st.mark]}</g>`;
  let ringEl='';
  if(ring){const id='rp'+(++RID);const r=13.6;
    ringEl=`<path id="${id}" d="M${20-r} 20A${r} ${r} 0 0 1 ${20+r} 20" stroke="none"/><text font-size="${ring.length>10?3.9:4.6}" letter-spacing="${ring.length>10?.4:.9}" font-weight="700" stroke="none" fill="currentColor" font-family="${font}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${ring}</textPath></text>
      <circle cx="20" cy="20" r="10.6" stroke-width=".8"/>`;
    const n=st.stars||0;for(let i=0;i<n;i++){const a=Math.PI/2+(i-(n-1)/2)*.32;ringEl+=`<circle cx="${(20+13.9*Math.cos(a)).toFixed(2)}" cy="${(20+13.9*Math.sin(a)).toFixed(2)}" r="1.1" fill="currentColor" stroke="none"/>`}
  }
  const style=on&&st.ink?`style="color:${inkVal(st.ink)}"`:'';
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" ${style}><g transform="rotate(${rot} 20 20)" ${on?`filter="url(#${inkFilter(st.seed||1)})"`:''} fill="none" stroke="currentColor" ${on?'':'opacity=".45"'}>${sh.o()}${ring?'':sh.i}${inner}${ringEl}</g></svg>`;
}
function sealSVG(on){
  let d='';const n=28;for(let i=0;i<n*2;i++){const r=i%2?15.2:17;const a=i/(n*2)*Math.PI*2-Math.PI/2;d+=(i?'L':'M')+(20+r*Math.cos(a)).toFixed(2)+','+(20+r*Math.sin(a)).toFixed(2)}
  return `<svg width="40" height="40" viewBox="0 0 40 40"><g ${on?'filter="url(#ink)"':''} fill="none" stroke="currentColor"><path d="${d}Z" stroke-width="1.4"/><circle cx="20" cy="20" r="11.5" stroke-width=".9"/><path d="m14.8 20.3 3.6 3.5 7-7.4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${on?'':'opacity=".35"'}/></g></svg>`;
}

/* ---- data ---- */
let entries=[
  {t:96,kind:'note',by:'me',text:'Moving the decimal point = multiplying by 10. Write this on the revision card.'},
  {t:192,kind:'note',by:'cp',text:'This is the one they asked in the mock. Remember the sign on negative powers.'},
  {t:310,kind:'ask',by:'me',text:'Why is 10⁻³ written as 0.001 and not 0.0001?'},
];
const rot=()=>+(Math.random()*5-2.5).toFixed(1);
entries.forEach(e=>e.r=rot());
let filter='all';

function stampFor(e){
  const col=e.kind==='ask'?'var(--violet)':e.by==='cp'?'var(--copilot)':'var(--accent)';
  return e.kind==='ask'?askStamp(fmt2(e.t),col,e.r):noteStamp(fmt2(e.t),e.by==='cp'?CP.id:ME.id,col,e.r);
}
function renderLog(freshIdx){
  const list=entries.map((e,i)=>({...e,i})).sort((a,b)=>a.t-b.t).filter(e=>filter==='all'||e.by===filter);
  $('#logCount').textContent=entries.length;
  $('#log').innerHTML=list.length?list.map(e=>`
   <li class="entry ${e.i===freshIdx?'fresh':''}">
     <button class="st" data-jump="${e.t}" title="Jump to ${fmt(e.t)}">${stampFor(e)}</button>
     <div><p>${e.text}</p><div class="who ${e.by==='cp'?'cp':''}">${e.by==='cp'?'Sara · right seat':e.kind==='ask'?'You · posted to the module threads':'You · only you see this'}</div></div>
     ${e.by==='me'?`<button class="del" data-del="${e.i}" aria-label="Remove stamp"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>`:'<span></span>'}
   </li>`).join(''):`<div class="empty">No stamps here yet. Press the stamp in the player to log a moment.</div>`;
  renderMarkers(freshIdx);
}
function renderMarkers(freshIdx){
  $$('#scrub .mk').forEach(m=>m.remove());
  entries.forEach((e,i)=>{
    const m=document.createElement('button');
    m.className='mk'+(e.kind==='ask'?' q':'')+(e.by==='cp'?' cp':'')+(i===freshIdx?' new':'');
    m.style.left=(e.t/DUR*100)+'%';m.dataset.jump=e.t;m.setAttribute('aria-label','Jump to '+fmt(e.t));
    m.innerHTML=`<i></i><span class="tip"><small>${fmt2(e.t)} · ${e.by==='cp'?'SARA':'YOU'}${e.kind==='ask'?' · ASK':''}</small>${e.text}</span>`;
    $('#scrub').appendChild(m);
  });
}

/* ---- player ---- */
const PLAY='<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE='<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
function paint(){const p=t/DUR*100;$('#fill').style.width=p+'%';$('#knob').style.left=p+'%';$('#time').textContent=fmt(t)+' / '+fmt(DUR);$('#pp').innerHTML=playing?PAUSE:PLAY;$('#player').classList.toggle('playing',playing)}
function setPlay(v){playing=v;clearInterval(timer);if(v)timer=setInterval(()=>{t=Math.min(DUR,t+1);if(t>=DUR)setPlay(false);paint()},1000);paint()}
$('#pp').onclick=()=>setPlay(!playing);$('#bigplay').onclick=()=>setPlay(true);
$('#scrub').addEventListener('click',e=>{if(e.target.closest('.mk'))return;const r=$('#scrub').getBoundingClientRect();t=Math.max(0,Math.min(DUR,(e.clientX-r.left)/r.width*DUR));paint()});
document.addEventListener('click',e=>{const j=e.target.closest('[data-jump]');if(j){t=+j.dataset.jump;paint();if(j.classList.contains('st'))$('#player').scrollIntoView({behavior:'smooth',block:'center'})}
  const d=e.target.closest('[data-del]');if(d){entries.splice(+d.dataset.del,1);renderLog();toast('Stamp removed')}});

/* ---- note bar ---- */
let nb=null;
function openBar(kind){
  closeBar();setPlay(false);$('#player').classList.add('noting');
  nb=document.createElement('div');nb.className='nb'+(kind==='ask'?' ask':'');
  nb.innerHTML=`<div class="field"><span class="at">${kind==='ask'?'◆ ':''}${fmt2(t)}</span><textarea rows="1" id="nbt" placeholder="${kind==='ask'?'What don’t you get here?':'What’s worth remembering?'}"></textarea></div>
  <button class="round ok" aria-label="Save"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
  <button class="round no" aria-label="Discard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  document.body.appendChild(nb);
  const pr=$('#player').getBoundingClientRect(), w=nb.offsetWidth;
  nb.style.left=Math.max(16,pr.left+pr.width/2-w/2)+'px';nb.style.top=Math.max(16,Math.min(innerHeight-90,pr.bottom-120))+'px';
  const ta=nb.querySelector('textarea');ta.focus();
  ta.oninput=()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px'};
  ta.onkeydown=e=>{if(e.key==='Escape')closeBar()};
  const at=t;
  nb.querySelector('.ok').onclick=()=>{const v=ta.value.trim()||(kind==='ask'?'Question at this moment':'Stamped moment');entries.push({t:Math.round(at),kind,by:'me',text:v,r:rot()});closeBar();filter='all';syncChips();renderLog(entries.length-1);toast(kind==='ask'?'Asked · posted to Module 1 threads':'Stamped at '+fmt(at))};
  nb.querySelector('.no').onclick=closeBar;
  // drag whole bar
  let sx,sy,ox,oy,moving=false;
  nb.addEventListener('pointerdown',e=>{if(e.target.closest('textarea,button'))return;moving=true;nb.classList.add('drag');sx=e.clientX;sy=e.clientY;ox=nb.offsetLeft;oy=nb.offsetTop;nb.setPointerCapture(e.pointerId)});
  nb.addEventListener('pointermove',e=>{if(!moving)return;nb.style.left=Math.max(8,Math.min(innerWidth-nb.offsetWidth-8,ox+e.clientX-sx))+'px';nb.style.top=Math.max(8,Math.min(innerHeight-nb.offsetHeight-8,oy+e.clientY-sy))+'px'});
  nb.addEventListener('pointerup',()=>{moving=false;nb.classList.remove('drag')});
}
function closeBar(){if(nb){nb.remove();nb=null}$('#player').classList.remove('noting')}
$('#stampBtn').onclick=()=>openBar('note');$('#askBtn').onclick=()=>openBar('ask');

/* ---- title row ---- */
const seal=$('#seal');
function paintSeal(anim){const on=CUR.state==='done';seal.dataset.on=on;seal.innerHTML=inspStamp(on,40,on?-6:0);seal.setAttribute('aria-label',on?'Signed off. Press to void.':'Sign off lesson');if(!anim)seal.querySelector('svg').style.animation='none'}
seal.onclick=()=>{const on=CUR.state!=='done';CUR.state=on?'done':'progress';if(on){CUR.fresh=true;CUR.rot=rot()}paintSeal(true);renderNext();renderLessons();toast(on?'Lesson signed off':'Sign-off voided')};
$('#save').onclick=e=>{const b=e.currentTarget,on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);toast(on?'Saved to Bookmarks':'Removed from Bookmarks')};

/* ---- tabs & filters ---- */
$$('.logcard .tab').forEach(b=>b.onclick=()=>{$$('.logcard .tab').forEach(x=>x.setAttribute('aria-selected',x===b));$('#tab-log').hidden=b.dataset.tab!=='log';$('#tab-cmt').hidden=b.dataset.tab!=='cmt'});
function syncChips(){$$('#filters .chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.f===filter))}
$$('#filters .chip').forEach(c=>c.onclick=()=>{filter=c.dataset.f;syncChips();renderLog()});

/* ---- up next ---- */
function renderNext(){
  const ch=MOD[1];
  $('#nextList').innerHTML=ch.items.map(it=>{const cur=it===CUR;
    const right=cur&&it.state!=='done'?'<span class="now">Playing</span>':it.state==='done'?`<span class="sm" style="color:var(--accent)">${inspStamp(true,30,it.rot)}</span>`:'<span></span>';
    return `<li><button class="nx" ${cur?'aria-current="true"':''}><span class="thumb">${it.quiz?it.q+' q':it.dur}</span><span><span class="t">${it.t}</span><br><span class="d">${it.quiz?'Quiz':'Video'}</span></span>${right}</button></li>`}).join('');
}
$('#tog').onclick=()=>$('#next').classList.toggle('shut');

/* ---- module data ---- */
const MOD=[
 {n:1,items:[{t:'Lesson 1',dur:'9:12',state:'done',rot:-5},{t:'Lesson 2',dur:'11:40',state:'done',rot:4},{t:'Chapter 1 quiz',quiz:true,q:8,score:4}]},
 {n:2,items:[{t:'Lesson 1',dur:'8:24',state:'done',rot:-3},{t:'Lesson 2',dur:'10:05',state:'progress',left:'7 minutes left'},{t:'Chapter 2 quiz',quiz:true,q:8}]},
 {n:3,items:[{t:'Lesson 1',dur:'11 min',state:'new'},{t:'Lesson 2',dur:'15 min',state:'new'},{t:'Chapter 3 quiz',quiz:true,q:8}]},
];
const CUR=MOD[1].items[1];
const openCh=new Set([2]);
function chStatus(c){const vids=c.items.filter(i=>!i.quiz);const done=vids.filter(i=>i.state==='done').length;const started=vids.some(i=>i.state!=='new');
  if(done===vids.length&&c.items.find(i=>i.quiz).score!=null)return['Done',''];if(c.items.includes(CUR)||started)return['You are here','here'];return['Not started','']}
function renderLessons(){
  const q=$('#q').value.trim().toLowerCase();
  $('#mt-lessons').innerHTML=MOD.map(c=>{
    const items=c.items.filter(it=>!q||('chapter '+c.n+' '+it.t).toLowerCase().includes(q));if(!items.length)return'';
    const [st,cls]=chStatus(c);const open=openCh.has(c.n)||!!q;
    return `<div class="chap ${open?'open':''}"><button class="ch-h" data-ch="${c.n}" aria-expanded="${open}">
      <span><h2>Chapter ${c.n}</h2><div class="cm">${c.items.filter(i=>!i.quiz).length} lessons · 1 quiz</div></span>
      <span class="cs2 ${cls}">${st}<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></span></button>
      <div class="ch-body">${items.map(it=>lrow(it)).join('')}</div></div>`}).join('')||'<div class="empty">No lessons match that.</div>';
  MOD.forEach(c=>c.items.forEach(i=>i.fresh=false));
}
function lrow(it){
  if(it.quiz){const has=it.score!=null;
    return `<button class="lrow"><span class="th quiz-thumb"><span class="quiz-thumb__sheet"><span><i class="on"></i><i></i><i></i></span><span><i></i><i></i><i class="on"></i></span><span><i></i><i class="on"></i><i></i></span></span><span class="quiz-thumb__count"><b>${it.q}</b>Qs</span></span>
     <span><div class="lt">${it.t}</div><div class="ls ${has&&it.score/it.q<.75?'warn':''}">${it.q} questions${has&&it.score/it.q<.75?' · below the pass mark':''}</div></span>
     <span class="rt">${has?`<span class="sc">${it.score} of ${it.q}</span>${it.score/it.q<.75?`<span class="pill" style="padding:4px 10px;font-size:12px">Re-check</span>`:``}`:'Not taken'}</span></button>`}
  const cur=it===CUR&&it.state!=='done';
  const sub=it.state==='done'?'Watched in full':it.state==='progress'?it.left:it.dur;
  const right=it.state==='done'?`<span class="imp ${it.fresh?'fresh':''}" style="color:var(--accent)" title="Your stamp" data-golic>${inspStamp(true,46,it.rot)}</span>`
    :it.state==='progress'?'<span class="resume">Resume</span>':'';
  return `<button class="lrow ${cur?'cur':''}" data-open="${it===CUR?1:0}"><span class="th">${it.state==='progress'?'<b style="width:30%"></b>':''}</span>
    <span><div class="lt">${it.t}</div><div class="ls">${sub}</div></span><span class="rt">${right}</span></button>`;
}
$('#mt-lessons').addEventListener('click',e=>{
  const h=e.target.closest('.ch-h');if(h){const n=+h.dataset.ch;openCh.has(n)?openCh.delete(n):openCh.add(n);renderLessons();return}
  const r=e.target.closest('.lrow');if(r){if(r.dataset.open==='1')go('lesson');else toast('Demo: only Chapter 2 · Lesson 2 opens')}
});
const PAPERS=[{t:'B2 13d Instruments, Rotary Wing Aerodynamics, Autoflight and Equipment & Furnishings LTT (2)',ch:0,pages:1012,at:11},{t:'Numbers and arithmetic · class handout',ch:1,pages:42,at:42},{t:'Standard form worked examples',ch:2,pages:18,at:0}];
let pch=0;
function renderLibrary(){
  const q=$('#q').value.trim().toLowerCase();
  const quizzes=MOD.map(c=>({c:c.n,...c.items.find(i=>i.quiz)})).filter(z=>!q||('chapter '+z.c+' quiz').includes(q));
  const ps=PAPERS.filter(p=>(!pch||p.ch===pch)&&(!q||p.t.toLowerCase().includes(q)));
  $('#mt-library').innerHTML=`<div class="libsplit"><div class="lsec"><div><h2>Quizzes</h2><p>3 quizzes, one per chapter</p></div></div>
   <div class="papers">${quizzes.map(z=>{const it=z;return `<button class="lrow">${`<span class="th quiz-thumb"><span class="quiz-thumb__sheet"><span><i class="on"></i><i></i><i></i></span><span><i></i><i></i><i class="on"></i></span><span><i></i><i class="on"></i><i></i></span></span><span class="quiz-thumb__count"><b>${it.q}</b>Qs</span></span>`}
     <span><div class="lt">Chapter ${z.c} quiz</div><div class="ls">${z.q} questions</div></span>
     <span class="rt">${z.score!=null?`<span class="sc">${z.score} of ${z.q}</span><span class="act-o">Re-check</span>`:'<span class="act-o">Take it</span>'}</span></button>`}).join('')||'<div class="empty">No quizzes match.</div>'}</div></div>
   <div class="lsec"><div><h2>Papers</h2><p>${PAPERS.length} documents for this module</p></div><button class="pill" data-addp>Add a paper</button></div>
   <div class="lchips">${[0,1,2,3].map(n=>`<button class="chip" data-pch="${n}" aria-pressed="${pch===n}">${n?'Chapter '+n:'All'}</button>`).join('')}</div>
   <ul class="papers">${ps.map(p=>`<li class="paper"><span class="pg"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg></span><span><div class="lt" style="font-weight:500">${p.t}</div><div style="font-size:12.5px;color:var(--t3)">PDF · ${p.pages} pages${p.at&&p.at<p.pages?' · you are on page '+p.at:p.at>=p.pages?' · read':''}</div>${p.at&&p.at<p.pages?`<div class="prog"><b style="width:${Math.max(2,p.at/p.pages*100)}%"></b></div>`:''}</span>${p.at&&p.at<p.pages?'<span class="resume">Resume</span>':'<span class="act-o">Open</span>'}</li>`).join('')||'<div class="empty">No papers here yet.</div>'}</ul>`;
}
$('#mt-library').addEventListener('click',e=>{const c=e.target.closest('[data-pch]');if(c){pch=+c.dataset.pch;renderLibrary();return}if(e.target.closest('[data-addp]'))toast('Add a paper opens the file picker')});
let MT='lessons';
$$('.mtabs .tab').forEach(b=>b.onclick=()=>{MT=b.dataset.mt;$$('.mtabs .tab').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('#mt-lessons').hidden=MT!=='lessons';$('#mt-library').hidden=MT!=='library';$('#crew').hidden=MT!=='crew';
  $('#q').placeholder=MT==='crew'?'Find someone':MT==='library'?'Search papers':'Search lessons';$('#q').value='';renderLessons();renderLibrary();renderCrew()});

/* ---- crew ---- */
const hues=[20,160,300,75,220,120,340,40,190,260,100,55,280,5];
const people=[
 {n:'Sara Al-Mutairi',cs:'SPARROW',id:'SM·042',ch:2,on:true,sq:true,rs:true,bio:'B2 track. Avionics nerd, bad at maths, working on it.'},
 {n:'Fahad Al-Enezi',cs:'RIVET',id:'FE·208',ch:2,on:false,sq:true,last:'2h ago',bio:'Ex-line mechanic going for the licence.'},
 {n:'Yousef Karam',cs:'TORQUE',id:'YK·011',ch:1,on:true,sq:true,bio:''},
 {n:'Noor Hassan',cs:'',id:'NH·390',ch:3,on:false,sq:true,last:'yesterday',bio:'Here for the flashcards.'},
 {n:'Mariam Al-Sabah',cs:'HALO',id:'MS·155',ch:1,on:true,bio:'First year, AU aviation.'},
 {n:'Abdullah Faraj',cs:'',id:'AF·073',ch:1,on:false,last:'3d ago',bio:''},
 {n:'Dana Qasem',cs:'VECTOR',id:'DQ·260',ch:2,on:true,bio:'Studying between shifts.'},
 {n:'Hamad Rashed',cs:'',id:'HR·512',ch:2,on:false,last:'5h ago',bio:''},
 {n:'Lulwa Behbehani',cs:'MACH',id:'LB·301',ch:3,on:false,last:'1d ago',bio:'Finished Module 1 once. Back for the quiz.'},
 {n:'Omar Saleh',cs:'',id:'OS·144',ch:3,on:true,bio:''},
 {n:'Reem Al-Ali',cs:'KITE',id:'RA·087',ch:1,on:false,last:'4d ago',bio:''},
 {n:'Bader Al-Shatti',cs:'GIMBAL',ch:4,on:false,last:'2d ago',bio:'Done with M1, hanging around to help.'},
 {n:'Haya Dashti',cs:'',ch:4,on:true,bio:'Maths tutor on the side.'},
 {n:'Khaled Marafi',cs:'FLAP',ch:3,on:false,last:'6h ago',bio:''},
];
const ANS=[3,0,1,5,0,0,2,0,9,0,0,14,11,0];
const PST=[{shape:'shield',mark:'plane',text:'',sub:'SPRW'},{shape:'hex',mark:'text',text:'208',sub:''},{shape:'circle',mark:'wrench',text:'',sub:'TRQ'},{shape:'square',mark:'star',text:'',sub:''},{shape:'oval',mark:'text',text:'HALO',sub:''},{shape:'seal',mark:'tick',text:'',sub:'AF'},{shape:'hex',mark:'plane',text:'',sub:''},{shape:'circle',mark:'text',text:'HR',sub:'512'},{shape:'shield',mark:'text',text:'M',sub:'MACH'},{shape:'square',mark:'text',text:'OS',sub:''},{shape:'oval',mark:'star',text:'',sub:'KITE'}];
PST.push({shape:'seal',mark:'text',text:'BS',sub:''},{shape:'circle',mark:'star',text:'',sub:'HAYA'},{shape:'hex',mark:'wrench',text:'',sub:'KM'});
people.forEach((p,i)=>{p.h=hues[i];p.ans=ANS[i];const b=PST[i];p.stamp={shape:b.shape,mark:b.mark,text:b.text||b.sub||'',ring:p.cs&&!['oval'].includes(b.shape)?p.cs+' · B2':'',font:['stencil','plain','serif'][i%3],ink:INKS[(i*5)%6].k,seed:i+2,stars:p.ch===4?1:0};if(b.mark!=='text'&&!p.stamp.ring)p.stamp.text=''});
const YOU_CH=2;
const initials=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('');
const av=(p,cls='')=>`<span class="av ${p.on?'on':''} ${cls}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}${p.rs?'<span class="rs" title="Your right seat"><svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M12 2 4 20h16z"/></svg></span>':''}</span>`;
const MSG='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const SEAT='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v9a2 2 0 0 0 2 2h7l2 5M7 15l-2 5"/></svg>';
const PLUS='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const face=p=>`<span class="av ${p.on?'on':''} ${p.sq?'sqring':''}" data-p="${people.indexOf(p)}" title="${p.n}${p.sq?' · your squadron':''}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}</span>`;
function crewEmpty(){
  const ghost=[['Chapter 1','who has signed it off'],['Chapter 2','who is on it right now'],['Chapter 3','who is ahead of you']];
  return `<div class="cempty">
    <div class="ce-h"><h3>Nobody else on Module 1 yet</h3>
      <p>Crew is the class for this module: who's studying it, which chapter they're on, and whose stamp is on each chapter. It's how you find someone at the same point as you when you're stuck.</p></div>
    <div class="ce-ghost" aria-hidden="true">${ghost.map(([c,t])=>`<div class="ce-row"><div><b>${c}</b><span>${t}</span></div><div class="ce-faces">${[0,1,2].map(i=>`<span class="ce-face" style="animation-delay:${i*.12}s"></span>`).join('')}</div></div>`).join('')}</div>
    <div class="ce-do"><button class="pill pri" data-find="squad">Find a squadron</button><button class="pill" data-find="invite">Invite your class</button></div>
    <p class="ce-note">The moment somebody else opens Module 1, they appear here. Your own stamp shows on every chapter you sign off, whether anyone else is here or not.</p>
  </div>`;
}
function renderCrew(){
  if(!people.length)return $('#crew').innerHTML=crewEmpty(),bindEmpty();
  const q=$('#q').value.trim().toLowerCase();
  const match=p=>!q||(p.n+' '+p.cs).toLowerCase().includes(q);
  const all=people.filter(match), now=all.filter(p=>p.on);
  let h=`<div class="csum"><div><b>${all.length+1} on Module 1</b><p>${now.length} studying right now · ${people.filter(p=>p.ch===4).length} have finished it</p></div>
    <div class="stack">${now.slice(0,6).map(face).join('')}${now.length>6?`<span class="more">+${now.length-6}</span>`:''}</div></div>`;
  [1,2,3].forEach(c=>{
    const on=all.filter(p=>p.ch===c), done=all.filter(p=>p.ch>c);
    const mineDone=MOD[c-1].items.filter(i=>!i.quiz).every(i=>i.state==='done');
    h+=`<div class="cch"><div class="cch-h"><div><h3>Chapter ${c}</h3><div class="cm">${done.length+(mineDone?1:0)} signed off${c===YOU_CH?' · <span class="here">you are here</span>':''}</div></div>
      <div class="onit">${on.length?`<span>On it now</span><span class="stack">${on.map(face).join('')}</span>`:'<span>Nobody on it right now</span>'}</div></div>
      <div class="wall"><span class="wl">SIGNED OFF</span>${done.length||mineDone?
        (mineDone?`<button class="mine" data-golic title="Your stamp">${inspStamp(true,44,rot(),MYSTAMP)}</button>`:'')+done.map(p=>`<button data-p="${people.indexOf(p)}" title="${p.n}">${inspStamp(true,44,rot(),p.stamp)}</button>`).join('')
        :'<span class="none">No stamps yet. The first one here could be yours.</span>'}</div></div>`;
  });
  const helpers=all.filter(p=>p.ans>0).sort((a,b)=>b.ans-a.ans).slice(0,4);
  if(helpers.length)h+=`<div class="helpers"><h3>Answering questions</h3><p class="cm">Most answers in Module 1 threads this month</p>
    <div class="hrow">${helpers.map(p=>`<button class="hp" data-p="${people.indexOf(p)}">${face(p)}<span>${p.n.split(' ')[0]}<small>${p.ans} answers</small></span></button>`).join('')}
    <button class="pill" data-threads>Open Module 1 threads</button></div></div>`;
  $('#crew').innerHTML=all.length?h:`<div class="empty">Nobody by that name on Module 1.<br><button class="pill" style="margin-top:12px" onclick="document.getElementById('q').value='';renderCrew()">Clear search</button></div>`;
}
$('#q').oninput=()=>MT==='crew'?renderCrew():MT==='library'?renderLibrary():renderLessons();
function bindEmpty(){$$('[data-find]').forEach(b=>b.onclick=()=>toast(b.dataset.find==='squad'?'Opens Find a squadron in the Ready Room':'Opens your invite link'))}
$('#crew').addEventListener('click',e=>{
  if(e.target.closest('[data-threads]')){toast('Opening Module 1 threads in the Ready Room');return}
  const r=e.target.closest('[data-p]');if(r)openProfile(people[+r.dataset.p]);
});
function act(k,p){
  const first=p.n.split(' ')[0];
  if(k==='gc')toast('Opening Blue Tail squadron chat in the Ready Room');
  if(k==='seat'){if(p.rs){toast(first+' is already in your right seat');return}people.forEach(x=>x.rs=false);p.rs=true;toast('Right seat request sent to '+first);renderCrew();if($('#scrim').classList.contains('open'))openProfile(p)}
  if(k==='squad')toast('Squadron invite sent to '+first);
}
function openProfile(p){
  const i=people.indexOf(p),first=p.n.split(' ')[0];
  $('#sheet').innerHTML=`
   <div class="cover"><svg viewBox="0 0 440 96" preserveAspectRatio="none" fill="none"><path d="M0 84 C60 84 80 30 150 26 L300 26 C360 30 380 84 440 84" stroke="oklch(1 0 0 / .35)" stroke-width="1.5" stroke-dasharray="3 6"/>
     ${[150,225,300].map((x,k)=>`<circle cx="${x}" cy="26" r="${k+1===p.ch?6:4}" fill="${k+1===p.ch?'#fff':'none'}" stroke="#fff" stroke-opacity=".7"/>`).join('')}</svg>
     <button class="x" id="closeP" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div class="pbody">${av(p)}
     <h2 class="pname">${p.n}${p.cs?`<span>${p.cs}</span>`:''}</h2>
     ${p.bio?`<p class="bio">${p.bio}</p>`:'<div style="height:10px"></div>'}
     <div class="where"><span>${p.on?'● Studying now':'Last here '+p.last}</span><span>${p.ch===4?'Finished Module 1':'Module 1 · Chapter '+p.ch}</span>${p.sq?'<span>Blue Tail squadron</span>':''}</div>
     <div class="lic">
       <div><div class="k">Part-66 student licence</div><div class="v">Category B2 · Avionics</div>
         <div class="row"><span class="k">Institute</span><span class="k">On</span><span style="font-size:13.5px">AU University</span><span style="font-size:13.5px">${p.ans?p.ans+' answers in M1':'Module 1'}</span></div></div>
       <div style="color:var(--accent);line-height:0" title="${first}'s stamp">${inspStamp(true,68,-8,p.stamp)}</div>
     </div>
     <div class="pbtns">
       ${p.sq?`<button class="pill" data-pact="gc">${MSG}Squadron chat</button>`:''}
       ${p.sq?`<button class="pill pri" data-pact="seat">${SEAT}${p.rs?'In your right seat':'Invite to right seat'}</button>`:`<button class="pill pri" data-pact="squad">${PLUS}Invite to squadron</button>`}
     </div>
   </div>`;
  $('#scrim').classList.add('open');
  $('#closeP').onclick=closeProfile;
  $$('[data-pact]').forEach(b=>b.onclick=()=>act(b.dataset.pact,p));
}
function closeProfile(){$('#scrim').classList.remove('open')}
$('#scrim').onclick=e=>{if(e.target.id==='scrim')closeProfile()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProfile()});

/* ---- menu ---- */
function openMenu(){closeMenu();const m=document.createElement('div');m.className='menu';m.id='menu';
  m.innerHTML=`<button id="mLic">Your licence</button><button>Bookmarks</button><button>Sign out</button>`;
  document.querySelector('.wrap').style.position='relative';document.querySelector('.wrap').appendChild(m);
  $('#mLic').onclick=()=>{closeMenu();go('lic')};setTimeout(()=>document.addEventListener('click',outside),0)}
function outside(e){if(!e.target.closest('#menu'))closeMenu()}
function closeMenu(){$('#menu')?.remove();document.removeEventListener('click',outside)}
$('#meBtn').onclick=e=>{e.stopPropagation();$('#menu')?closeMenu():openMenu()};
document.addEventListener('click',e=>{if(e.target.closest('[data-golic]')){e.stopPropagation();go('lic')}},true);
$('#ptProfile').onclick=()=>toast('Demo: the Licence tab is the one built here');

/* ---- licence: one-time stamp creator ---- */
let draft=null, confirming=false;
function paintSlot(slam){
  if(ISSUED){$('#slot').className='slot issued';$('#slot').innerHTML=`<span class="k">Stamp</span><span class="got ${slam?'slam':''}">${inspStamp(true,116,-6,MYSTAMP)}</span><span class="when">Issued ${ISSUED}</span>`;$('#maker').hidden=true;return}
  $('#slot').className='slot';
  $('#slot').innerHTML=`<span class="k">Stamp</span><span class="gen">${inspStamp(false,64,0,DEFAULT_STAMP)}</span><button class="pill pri" id="mk">Create your stamp</button>`;
  $('#mk').onclick=()=>{draft={shape:'seal',mark:'text',text:'C',ring:'',font:'stencil',ink:'livery',seed:7,stars:0};confirming=false;$('#maker').hidden=false;paintMaker(true);$('#maker').scrollIntoView({behavior:'smooth',block:'nearest'})};
}
function paintMaker(anim){
  const d=draft, sh=SHAPES[d.shape];
  const markBtn=k=>`<button class="opt" data-mark="${k}" aria-pressed="${d.mark===k}" aria-label="${k}"><svg width="24" height="24" viewBox="9 9 22 22" fill="currentColor" stroke="currentColor">${MARKS[k]}</svg></button>`;
  $('#maker').innerHTML=`
   <div class="stpaper"><span class="big ${anim?'go':''}">${inspStamp(true,200,-5,d)}</span><span class="cap">Your ink pattern is yours alone</span></div>
   <div class="ctl">
    <div><p class="lab">Outline</p><div class="opts">${Object.keys(SHAPES).map(k=>`<button class="opt" data-shape="${k}" aria-pressed="${d.shape===k}" aria-label="${k}">${inspStamp(false,32,0,{shape:k,mark:'text',text:''})}</button>`).join('')}</div></div>
    <div><p class="lab">Middle</p><div class="opts"><button class="opt txt" data-mark="text" aria-pressed="${d.mark==='text'}">Letters</button>${Object.keys(MARKS).map(markBtn).join('')}</div></div>
    <div class="fields">
      <label><span class="lab" style="margin:0">Letters</span><input id="fText" maxlength="4" value="${d.text}" ${d.mark==='text'?'':'disabled'} placeholder="ABC"></label>
      <label><span class="lab" style="margin:0">Around the rim${sh.noRing?' · not on oval':''}</span><input id="fRing" maxlength="16" value="${d.ring}" ${sh.noRing?'disabled':''} placeholder="Callsign or motto"></label>
    </div>
    <div><p class="lab">Lettering</p><div class="opts">${Object.entries({plain:'Plain',stencil:'Stencil',serif:'Serif'}).map(([k,n])=>`<button class="opt fnt" data-font="${k}" aria-pressed="${d.font===k}" style="font-family:${FONTS[k]}">${n}</button>`).join('')}</div></div>
    <div><p class="lab">Ink</p><div class="opts">${INKS.map(i=>`<button class="sw" data-ink="${i.k}" aria-pressed="${d.ink===i.k}" aria-label="${i.n}" title="${i.n}" style="background:${i.v}"></button>`).join('')}</div></div>
    <div class="issue">${confirming
      ?`<div class="confirm"><b>Your stamp can't be changed once it's issued.</b><button class="pill" id="back">Keep editing</button><button class="pill pri" id="doIssue">Issue it</button></div>`
      :`<button class="pill pri" id="issue">Issue my stamp</button><button class="pill" id="cancelMk">Not now</button>`}</div>
   </div>`;
  const set=(k,v)=>{draft[k]=v;confirming=false;paintMaker(true)};
  $$('[data-shape]').forEach(b=>b.onclick=()=>set('shape',b.dataset.shape));
  $$('[data-mark]').forEach(b=>b.onclick=()=>{if(b.dataset.mark==='text'&&!draft.text)draft.text='C';set('mark',b.dataset.mark)});
  $$('[data-font]').forEach(b=>b.onclick=()=>set('font',b.dataset.font));
  $$('[data-ink]').forEach(b=>b.onclick=()=>set('ink',b.dataset.ink));
  const live=()=>{draft.text=$('#fText').value.replace(/[^\w]/g,'');draft.ring=$('#fRing').value.replace(/[^\w ·\-]/g,'');$('.stpaper .big').className='big';$('.stpaper .big').innerHTML=inspStamp(true,200,-5,draft)};
  $('#fText').oninput=live;$('#fRing').oninput=live;
  if(confirming){$('#back').onclick=()=>{confirming=false;paintMaker(false)};
    $('#doIssue').onclick=()=>{if(draft.mark==='text'&&!draft.text)draft.text='C';MYSTAMP={...draft};ISSUED='18 Sep 2026';paintSlot(true);renderLessons();renderCrew();toast('Stamp issued · it’s on every sign-off now');$('#slot').scrollIntoView({behavior:'smooth',block:'center'})}}
  else{$('#issue').onclick=()=>{confirming=true;paintMaker(false)};$('#cancelMk').onclick=()=>{$('#maker').hidden=true}}
}

/* ---- views, theme, toast ---- */
function go(v){$('#v-lesson').hidden=v!=='lesson';$('#v-mod').hidden=v!=='mod';$('#v-lic').hidden=v!=='lic';if(v==='lic')paintSlot(false);if(v==='mod')renderLessons();else{paintSeal(false);renderNext()}$$('.demo [data-go]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.go===v));closeBar();setPlay(false);scrollTo(0,0)}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('[data-rr]').onclick=()=>toast('Ready Room opens here');
$('#theme').onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark'};
let tt;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2200)}

let PEOPLE_BACKUP=null;$('#crewEmpty').onclick=()=>{if(PEOPLE_BACKUP){people.push(...PEOPLE_BACKUP);PEOPLE_BACKUP=null;$('#crewEmpty').textContent='Crew: empty'}else{PEOPLE_BACKUP=people.splice(0,people.length);$('#crewEmpty').textContent='Crew: people'}MT='crew';$$('.mtabs .tab').forEach(x=>x.setAttribute('aria-selected',x.dataset.mt==='crew'));$('#mt-lessons').hidden=true;$('#mt-library').hidden=true;$('#crew').hidden=false;renderCrew()};
$('#resetStamp').onclick=()=>{MYSTAMP={...DEFAULT_STAMP};ISSUED=null;renderLessons();renderCrew();if(!$('#v-lic').hidden)paintSlot(false);toast('Demo reset: no stamp issued')};
renderLog();renderLessons();renderCrew();paint();go('mod');
</script>
````

---

## Appendix B: `docs/launch/reference/02-licence-stamp-creator.html`

Licence tab / profile viewer, cover picker, phrase picker, stats, stamp creator (the source of truth for `inspStamp`, `layout`, `SHAPES`, `PATTERNS`, `ringPattern`, `PALETTE`, `inkFilter`), Preferences with Fly solo.

````html
<meta charset="utf-8">
<title>Wingman Licence Editor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --ground:oklch(.975 .006 255);--panel:oklch(1 0 0 / .9);--raised:oklch(.955 .01 255);
  --line:oklch(.86 .02 258);--hair:oklch(.9 .015 258);
  --t1:oklch(.2 .02 255);--t2:oklch(.42 .03 255);--t3:oklch(.56 .03 260);
  --accent:oklch(.56 .15 254);--accent-soft:oklch(.56 .15 254 / .12);
  --violet:oklch(.52 .19 295);--copilot:oklch(.58 .13 190);--ok:oklch(.6 .15 148);
  --ink:var(--accent);--video:oklch(.16 .02 255);
  --sans:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,monospace;
  --ink-cobalt:oklch(.5 .16 262);--ink-crimson:oklch(.54 .19 25);--ink-forest:oklch(.52 .12 155);--ink-copper:oklch(.58 .13 50);--ink-graphite:oklch(.38 .02 260);
  --r:13px;--ease:cubic-bezier(.3,.7,.3,1);--wrap:1010px;
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.85 .05 240 / .5), transparent 60%);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:oklch(.14 .0178 255);--panel:oklch(.2075 .0263 256.13 / .78);--raised:oklch(.2763 .0442 258.88 / .87);
  --line:oklch(.3452 .0672 262.18 / .94);--hair:oklch(.3452 .0672 262.18 / .55);
  --t1:oklch(.95 .0052 235);--t2:oklch(.7475 .0341 247.31);--t3:oklch(.625 .0425 264.39);
  --accent:oklch(.68 .1303 253.95);--accent-soft:oklch(.68 .1303 253.95 / .14);
  --violet:oklch(.7 .15 295);--copilot:oklch(.78 .11 190);--ok:oklch(.66 .155 148);
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.35 .08 230 / .55), transparent 60%);
  --ink-cobalt:oklch(.7 .14 262);--ink-crimson:oklch(.7 .16 22);--ink-forest:oklch(.72 .13 155);--ink-copper:oklch(.75 .12 55);--ink-graphite:oklch(.84 .015 250);
}}
:root[data-theme="dark"]{
  --ground:oklch(.14 .0178 255);--panel:oklch(.2075 .0263 256.13 / .78);--raised:oklch(.2763 .0442 258.88 / .87);
  --line:oklch(.3452 .0672 262.18 / .94);--hair:oklch(.3452 .0672 262.18 / .55);
  --t1:oklch(.95 .0052 235);--t2:oklch(.7475 .0341 247.31);--t3:oklch(.625 .0425 264.39);
  --accent:oklch(.68 .1303 253.95);--accent-soft:oklch(.68 .1303 253.95 / .14);
  --violet:oklch(.7 .15 295);--copilot:oklch(.78 .11 190);--ok:oklch(.66 .155 148);
  --glow:radial-gradient(1200px 500px at 70% -10%, oklch(.35 .08 230 / .55), transparent 60%);
  --ink-cobalt:oklch(.7 .14 262);--ink-crimson:oklch(.7 .16 22);--ink-forest:oklch(.72 .13 155);--ink-copper:oklch(.75 .12 55);--ink-graphite:oklch(.84 .015 250);
}

*{box-sizing:border-box}
html,body{min-height:100%}
body{margin:0;background:var(--glow),var(--ground);background-attachment:fixed;color:var(--t1);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:calc(1010px + 40px);margin:0 auto;padding-inline:20px}
.top{display:flex;align-items:center;justify-content:space-between;padding-block:16px;gap:12px}
.brand{font-weight:700;letter-spacing:-.01em}
.top-r{display:flex;gap:10px;align-items:center}
.rr{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:99px;padding:8px 14px;font-size:14px}
.rr b{background:var(--accent);color:var(--ground);font:600 11px var(--mono);border-radius:99px;padding:1px 7px}
.me{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font:600 14px var(--sans);letter-spacing:.02em;color:#fff;overflow:hidden;position:relative}
.me.av{width:38px!important;height:38px!important;font-size:14px!important;border:0!important;border-radius:50%}
.me.av img{position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%,-50%) translate(var(--x,0),var(--y,0)) scale(var(--z,1))}

.col{max-width:680px;margin:0 auto;padding-bottom:120px}
.back{display:inline-flex;align-items:center;gap:4px;color:var(--t2);font-size:14px;padding-block:18px 10px}
.col h1{font-size:34px;letter-spacing:-.02em;margin:0 0 16px;line-height:1.1}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:5px;border:1px solid var(--line);border-radius:14px;background:var(--panel);margin-bottom:18px}
.seg button{padding:10px;border-radius:10px;color:var(--t2);font-size:14.5px;font-weight:500}
.seg button[aria-selected="true"]{background:var(--raised);color:var(--t1);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--accent) 55%,transparent)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:22px;margin-bottom:16px;backdrop-filter:blur(8px)}
.lab{font:10.5px var(--mono);letter-spacing:.14em;color:var(--t3);text-transform:uppercase;margin:0 0 12px}
.boxh{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.boxh .lab{margin:0}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:13.5px;padding:8px 14px;border-radius:99px;border:1px solid var(--line);color:var(--t2);background:var(--panel);white-space:nowrap}
.pill:hover{color:var(--t1);border-color:var(--t3)}
.pill.pri{background:var(--accent);border-color:transparent;color:var(--ground);font-weight:600}
.pill.pri:hover{color:var(--ground);filter:brightness(1.08)}
.pill:disabled{opacity:.6;cursor:default}

/* the licence card (same component others see) */
.lic{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--ground);position:relative}
.cover{height:92px;position:relative;background:linear-gradient(120deg,oklch(.45 .12 254),oklch(.33 .08 230));overflow:hidden}
.cover > svg{position:absolute;inset:0;width:100%;height:100%}
.adm{position:absolute;right:12px;top:12px;display:inline-flex;align-items:center;gap:5px;font:600 10.5px var(--mono);letter-spacing:.12em;color:#fff;border:1px solid oklch(1 0 0 / .5);border-radius:99px;padding:3px 9px;background:oklch(0 0 0 / .18)}
.lbody{padding:0 20px 20px;margin-top:-38px;position:relative}
.avw{position:relative;width:84px;height:84px}
.av{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;font-size:34px;font-weight:600;color:#fff;background:oklch(.55 .07 45);border:4px solid var(--ground)}
.cam{position:absolute;right:-2px;bottom:2px;width:30px;height:30px;border-radius:50%;background:var(--accent);color:var(--ground);display:grid;place-items:center;border:3px solid var(--ground)}
.names{margin-top:10px;display:flex;flex-direction:column;gap:2px}
.nrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ed{font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px dashed transparent;border-radius:0;padding:1px 0;outline:none;min-width:0;width:auto}
.editing .ed{border-bottom-color:var(--line)}
.editing .ed:hover{border-bottom-color:var(--t3)}
.ed:focus{border-bottom:1px solid var(--accent)}
.ed::placeholder{color:var(--t3)}
.hn{font-size:23px;font-weight:600;letter-spacing:-.01em}
.sn{font:13px var(--mono);letter-spacing:.08em;color:var(--t3);text-transform:none}
.swap{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--t3);border:1px solid var(--line)}
.swap:hover{color:var(--accent);border-color:var(--accent)}
.bio{margin-top:8px;font-size:14.5px;color:var(--t2);width:100%}
.where{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 16px}
.where span{font-size:12.5px;padding:4px 10px;border-radius:99px;background:var(--raised);color:var(--t2)}
.doc{border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:stretch;
  background:repeating-radial-gradient(circle at 110% -20%,transparent 0 11px,color-mix(in oklab,var(--accent) 7%,transparent) 11px 12px),linear-gradient(135deg,var(--raised),transparent 70%)}
.doc .ttl{font:600 10.5px var(--mono);letter-spacing:.16em;color:var(--accent);margin-bottom:12px}
.lf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
.lf .k{font:10px var(--mono);letter-spacing:.12em;color:var(--t3);text-transform:uppercase}
.lf .v{font-size:14.5px;font-weight:500;margin-top:1px}
.slot{border:1.5px dashed var(--line);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:26px 10px 12px;text-align:center;position:relative;min-height:150px}
.slot .k{position:absolute;top:8px;left:0;right:0;font:10px var(--mono);letter-spacing:.12em;color:var(--t3)}
.slot.issued{border-style:solid;border-color:var(--hair)}
.slot .gen{color:var(--t3);line-height:0}
.slot .when{font:10.5px var(--mono);color:var(--t3)}
.slot .got{line-height:0}
.slot .got.slam svg{animation:slam .7s var(--ease)}
.slot .pill{font-size:12.5px;padding:7px 12px}
.acts{display:flex;gap:8px;margin-top:16px}
.acts .pill{flex:1;justify-content:center;padding:10px 12px;font-size:14px}
@keyframes slam{0%{transform:translateY(-30px) scale(1.7);opacity:0}45%{transform:translateY(0) scale(.92);opacity:1}62%{transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes press{0%{transform:scale(1.6);opacity:0}55%{transform:scale(.9);opacity:1}100%{transform:scale(1)}}

.cover{height:110px;position:relative;background:linear-gradient(120deg,color-mix(in oklab,var(--accent) 62%,oklch(.18 .03 255)),color-mix(in oklab,var(--accent) 30%,oklch(.14 .02 255)));overflow:hidden}
.cvbtn{position:absolute;left:12px;top:12px;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#fff;background:oklch(0 0 0 / .32);border-radius:99px;padding:5px 11px;backdrop-filter:blur(6px)}
.livtag{position:absolute;right:10px;bottom:9px;display:inline-flex;align-items:center;gap:6px;font:600 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#fff;background:oklch(0 0 0 / .32);border-radius:99px;padding:4px 10px 4px 7px;backdrop-filter:blur(6px)}
.livtag i{width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 1.5px oklch(1 0 0 / .6)}
.copt.row{flex-direction:row;justify-content:center;gap:10px;padding:12px}
.copt.row .cthumb{width:64px;aspect-ratio:16/9}
.catb{font:600 9.5px var(--mono);font-style:normal;letter-spacing:.08em;color:var(--accent);border:1px solid color-mix(in oklab,var(--accent) 50%,transparent);border-radius:99px;padding:0 6px;margin-left:4px;vertical-align:1px}
.copt small{display:block;font-size:11.5px;color:var(--t3);margin-top:2px}
.cvbtn:hover{background:oklch(0 0 0 / .45)}
.av{letter-spacing:.02em;font-size:30px!important}
.av.sm{width:64px;height:64px;font-size:22px!important;border:0}
.av.up{background:var(--raised)!important;color:var(--t2);overflow:hidden}
.av.up img{width:100%;height:100%;object-fit:cover}
.hn{font-size:24px;font-weight:600;letter-spacing:-.01em}
.sn{font:13px var(--mono);letter-spacing:.04em;color:var(--t3)}
.stage{margin-top:18px;border-top:1px solid var(--hair);padding-top:22px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.stage .got,.stage .gen{line-height:0}
.stage .gen{color:var(--t3)}
.stage .got.slam svg{animation:slam .7s var(--ease)}
.sline{font:600 10.5px var(--mono);letter-spacing:.16em;color:var(--t2);margin-top:4px}
.sline.dim{color:var(--t3);font-weight:400;margin-top:0}
.ghost{display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--t3)}
.ghost span{line-height:0;border-radius:50%;transition:transform .25s var(--ease)}
.ghost:hover span{transform:scale(1.04);color:var(--accent)}
.ghost b{font-size:13.5px;font-weight:600;color:var(--ground);background:var(--accent);padding:8px 16px;border-radius:99px}
.pick{background:var(--ground);border:1px solid var(--line);border-radius:20px;padding:20px;position:relative}
.pick h3{margin:0 0 14px;font-size:18px}
.x2{position:absolute;right:12px;top:12px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--t2)}
.x2:hover{background:var(--raised)}
.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.popt,.copt{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 10px;border:1px solid var(--line);border-radius:14px;font-size:13.5px;color:var(--t2)}
.popt.on,.copt.on{border-color:var(--accent);background:var(--accent-soft);color:var(--t1)}
.cgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.copt{padding:8px;gap:6px}
.cthumb{width:100%;aspect-ratio:520/110;border-radius:8px;overflow:hidden;background:linear-gradient(120deg,color-mix(in oklab,var(--accent) 62%,oklch(.18 .03 255)),color-mix(in oklab,var(--accent) 30%,oklch(.14 .02 255)));display:grid;place-items:center}
.cthumb svg{width:100%;height:100%}
.cthumb.up{background:var(--raised);color:var(--t2)}
@media (max-width:600px){.cgrid{grid-template-columns:1fr 1fr}}

/* v3 card layout */
.cover{height:128px}
.lbody{padding:0 24px 24px;margin-top:-44px}
.idrow{display:flex;align-items:flex-end;gap:16px}
.idrow .names{margin:0 0 6px;padding-top:48px;min-width:0;flex:1}
.idrow .ed.hn{max-width:100%}
.bio{display:block;margin:14px 0 0;font-size:15px;color:var(--t2);width:100%}
p.bio{margin:14px 0 0}
.tag{display:inline-flex;align-items:center;gap:10px;margin-top:14px;padding:7px 14px 7px 8px;border-radius:6px;background:color-mix(in oklab,var(--accent) 16%,transparent);color:var(--t1);font-size:14px;font-weight:500;max-width:100%;text-align:left}
.tag i{width:6px;align-self:stretch;border-radius:2px;background:repeating-linear-gradient(135deg,var(--accent) 0 4px,transparent 4px 7px);flex:none}
button.tag:hover{background:color-mix(in oklab,var(--accent) 24%,transparent)}
.tag svg{color:var(--t3);flex:none}
.stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:20px;border-block:1px solid var(--hair)}
.stats div{padding:14px 6px;text-align:center;display:flex;flex-direction:column;gap:2px}
.stats div+div{border-left:1px solid var(--hair)}
.stats b{font:600 20px var(--mono);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.stats span{font-size:12px;color:var(--t3);line-height:1.25}
.sblock{display:flex;align-items:center;gap:26px;padding:22px 4px 2px}
.sblock .got,.sblock .gen{line-height:0;flex:none}
.sblock .gen{color:var(--t3)}
.sblock .got.slam svg{animation:slam .7s var(--ease)}
.sfacts{min-width:0}
.sk{font:10.5px var(--mono);letter-spacing:.14em;color:var(--t3);text-transform:uppercase}
.sv{font-size:16px;font-weight:600;margin-top:2px}
.sv.sub{font-size:14px;font-weight:400;color:var(--t2);margin-top:0}
.ghost{position:relative;line-height:0;color:var(--t3);flex:none;display:block}
.ghost svg{transition:transform .25s var(--ease)}
.ghost:hover svg{transform:scale(1.04)}
.ghost b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);line-height:1;font-size:13px;font-weight:600;color:var(--ground);background:var(--accent);padding:8px 14px;border-radius:99px}
.acts{margin-top:22px}
.plist{display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow:auto}
.pp{text-align:left;padding:11px 14px;border-radius:10px;border:1px solid var(--line);font-size:14.5px}
.pp:hover{background:var(--raised)}
.pp.on{border-color:var(--accent);background:var(--accent-soft)}
@media (max-width:560px){
  .stats{grid-template-columns:repeat(2,1fr)}
  .stats div:nth-child(3){border-left:0}
  .stats div:nth-child(n+3){border-top:1px solid var(--hair)}
  .sblock{gap:16px}
  .sblock .got svg,.sblock .gen svg,.ghost svg{width:104px;height:104px}
  .demo{bottom:10px}
  .lbody{padding:0 18px 20px}
}

/* v4: centred, calmer */
.lbody{padding:0 28px 28px;margin-top:-52px;display:flex;flex-direction:column;align-items:center;text-align:center}
.avw{width:104px;height:104px}
.av{width:104px;height:104px;font-size:34px!important;border-width:5px}
.cam{right:0;bottom:4px}
.hn{margin-top:14px;font-size:26px;font-weight:650;letter-spacing:-.015em;text-align:center;line-height:1.15}
input.hn{max-width:100%}
.sn{margin-top:4px;font:12.5px var(--mono);letter-spacing:.06em;color:var(--t3)}
.bio{margin:12px 0 0!important;max-width:40ch;text-align:center;font-size:15px;color:var(--t2)}
input.bio{width:min(100%,40ch)}
.tag{margin-top:18px;display:inline-flex;align-items:stretch;gap:12px;padding:0;border-radius:4px;background:color-mix(in oklab,var(--accent) 14%,transparent);font-size:14.5px;font-weight:500;color:var(--t1);overflow:hidden}
.tag span{padding:8px 0}
.tag i{width:10px;background:repeating-linear-gradient(135deg,var(--accent) 0 4px,transparent 4px 8px);flex:none;border-radius:0;align-self:stretch}
button.tag:hover{background:color-mix(in oklab,var(--accent) 22%,transparent)}
.stats{margin-top:24px;width:100%;max-width:420px;display:grid;grid-template-columns:repeat(3,1fr);border:0}
.stats div{padding:4px 6px;border:0!important}
.stats div+div{border-left:1px solid var(--hair)!important}
.stats b{font:600 20px var(--mono);letter-spacing:-.03em;white-space:nowrap}
.stats span{font-size:12px;color:var(--t3)}
.sblock{margin-top:26px;padding:0;width:100%;display:grid;place-items:center;position:relative}
.sblock::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--hair)}
.sblock>*{position:relative;background:var(--ground);border-radius:50%;padding:6px}
.ghost b{font-size:13px;white-space:nowrap}
.inv:disabled{opacity:1;cursor:default}
.demo{flex-wrap:nowrap!important}
.inv{margin-top:22px;width:100%;justify-content:center;padding:11px 16px;font-size:14.5px}
.pp{text-align:center}
@media (max-width:560px){
  .stats{grid-template-columns:repeat(3,1fr)}
  .stats div:nth-child(3){border-left:1px solid var(--hair)!important}
  .stats div:nth-child(n+3){border-top:0!important}
  .lbody{padding:0 18px 22px}
  .sblock .got svg,.sblock .gen svg,.ghost svg{width:124px;height:124px}
}

/* v5: phrase + stats + studio */
.tag{width:100%;max-width:440px;justify-content:space-between}
.tag span{flex:1;text-align:center;padding:10px 4px}
.stats{max-width:440px}
.stats div+div,.stats div:nth-child(3){border-left:0!important}
.sheet:has(.studio){width:min(520px,100%)}
.studio{background:var(--ground);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.shead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 6px}
.shead h3{margin:0;font-size:17px}
.studio .x2{position:static}
.spaper{margin:8px 18px 0;border-radius:16px;height:250px;display:grid;place-items:center;position:relative;overflow:hidden;
  background:radial-gradient(120% 90% at 50% 40%,color-mix(in oklab,var(--raised) 100%,transparent),color-mix(in oklab,var(--raised) 55%,var(--ground)));box-shadow:inset 0 0 0 1px var(--hair)}
.spaper::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 27px,var(--hair) 27px 28px);opacity:.45}
.spaper .big{position:relative;line-height:0;filter:drop-shadow(0 1px 0 color-mix(in oklab,var(--ground) 60%,transparent))}
.spaper .big.go svg{animation:press .45s var(--ease)}
.stabs{display:flex;gap:2px;margin:14px 18px 0;padding:4px;border-radius:12px;background:var(--raised)}
.stabs button{flex:1;padding:8px 4px;border-radius:9px;font-size:13.5px;color:var(--t2)}
.stabs button[aria-selected="true"]{background:var(--ground);color:var(--t1);font-weight:600;box-shadow:0 1px 2px oklch(0 0 0 / .15)}
.sbody{min-height:104px;padding:16px 18px 4px;justify-content:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.srow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.srow.tight{gap:6px}
.stile{width:60px;height:60px;border-radius:14px;border:1px solid var(--line);display:grid;place-items:center;color:var(--t2);line-height:0;transition:transform .15s var(--ease),border-color .15s}
.stile:hover{transform:translateY(-1px);border-color:var(--t3)}
.stile.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.stile.txt{font-size:20px;font-weight:700;line-height:1}
.stile.wide{width:92px;height:70px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;line-height:1}
.stile.wide small{font-size:12px;color:var(--t3);font-weight:500}
.sdot{display:flex;flex-direction:column;align-items:center;gap:6px;width:62px}
.sdot i{width:36px;height:36px;border-radius:50%;box-shadow:0 0 0 3px var(--ground),0 0 0 4px var(--line);transition:box-shadow .15s}
.sdot.on i{box-shadow:0 0 0 3px var(--ground),0 0 0 5px var(--t1)}
.sdot small{font-size:11.5px;color:var(--t3)}
.sdot.on small{color:var(--t1);font-weight:600}
.sin{width:min(100%,300px);text-align:center;font:600 18px var(--mono);letter-spacing:.14em;text-transform:uppercase;background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:10px 14px;color:var(--t1)}
.sin::placeholder{font:400 14px var(--sans);letter-spacing:0;text-transform:none;color:var(--t3)}
.schip{font-size:13px;padding:6px 12px;border-radius:99px;border:1px solid var(--line);color:var(--t2)}
.schip:hover{color:var(--t1);border-color:var(--t3)}
.snote{margin:10px 0 0;color:var(--t3);font-size:14px}
.sfoot{padding:14px 18px 18px;border-top:1px solid var(--hair);margin-top:10px;text-align:center}
.sfoot p{margin:0 0 10px;font-size:14px;color:var(--t2)}
.sbtns{display:flex;gap:8px}
.sbtns .pill,.issueb{flex:1;justify-content:center;padding:11px 16px;font-size:14.5px;width:100%}
@media (max-width:560px){.spaper{height:210px}.stile{width:52px;height:52px}.stabs button{font-size:12.5px}}

/* v6 */
.tag{background:radial-gradient(60% 140% at 50% 50%,color-mix(in oklab,var(--accent) 16%,transparent),transparent 75%)!important;border-radius:99px}
.tag i{display:none}
.tag span{font-style:italic;font-size:15px;color:var(--t1);padding:10px 16px}
button.tag:hover{background:radial-gradient(60% 140% at 50% 50%,color-mix(in oklab,var(--accent) 26%,transparent),transparent 75%)!important}
.stile{border:0!important;background:color-mix(in oklab,var(--raised) 70%,transparent)}
.stile:hover{background:var(--raised)}
.stile.on{background:var(--accent-soft)!important;box-shadow:inset 0 0 0 1.5px var(--accent)}
.cgrid .copt{border:0;background:color-mix(in oklab,var(--raised) 60%,transparent)}
.cgrid .copt.on{background:var(--accent-soft);box-shadow:inset 0 0 0 1.5px var(--accent)}
.cols{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.cols button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border-radius:12px;font-size:11.5px;color:var(--t3);background:color-mix(in oklab,var(--raised) 60%,transparent)}
.cols button i{width:30px;height:30px;border-radius:50%}
.cols button.on{background:var(--accent-soft);color:var(--t1);box-shadow:inset 0 0 0 1.5px var(--accent)}
@media (max-width:560px){.cols{grid-template-columns:repeat(3,1fr)}}

/* v7 colour grid */
.cgridc{display:grid;grid-template-columns:repeat(13,1fr);gap:5px;width:100%}
.cc{aspect-ratio:1;border-radius:50%;transition:transform .15s var(--ease)}
.cc:hover{transform:scale(1.15)}
.cc.on{box-shadow:0 0 0 2px var(--ground),0 0 0 4px var(--t1)}
.useliv{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);padding:6px 12px;border-radius:99px;background:color-mix(in oklab,var(--raised) 60%,transparent);align-self:center}
.useliv i{width:14px;height:14px;border-radius:50%;background:var(--accent)}
.useliv.on{color:var(--t1);box-shadow:inset 0 0 0 1.5px var(--accent)}
.stile.txt small{font-size:12px;color:var(--t3)}

/* v8 palette + seg */
.pal{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;width:100%}
.pal button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 2px;border-radius:12px;font-size:11px;color:var(--t3);line-height:1.2}
.pal button:hover{background:color-mix(in oklab,var(--raised) 70%,transparent)}
.pal button i{width:30px;height:30px;border-radius:50%;box-shadow:inset 0 -3px 6px oklch(0 0 0 / .18),inset 0 2px 4px oklch(1 0 0 / .25)}
.pal button.on{background:var(--accent-soft);color:var(--t1)}
.pal button.on i{box-shadow:0 0 0 2px var(--ground),0 0 0 3.5px var(--t1)}
.seg2{display:flex;gap:4px;padding:3px;border-radius:99px;background:var(--raised)}
.seg2 button{padding:6px 16px;border-radius:99px;font-size:13px;color:var(--t2)}
.seg2 button.on{background:var(--ground);color:var(--t1);font-weight:600}
.stile.wide{width:84px}
.stile.wide.pt{width:66px;height:74px;gap:3px}
.tgl{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600}
.srow:has(.pt){gap:5px;flex-wrap:nowrap}
@media (max-width:560px){.srow:has(.pt){flex-wrap:wrap}}

/* v9 streamlined studio */
.dice{position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--t2);background:color-mix(in oklab,var(--ground) 70%,transparent);transition:transform .2s var(--ease)}
.dice:hover{color:var(--t1);transform:rotate(-14deg)}
.crow{display:flex;gap:8px;justify-content:center;align-items:center;margin:14px 18px 0}
.cin{width:120px;text-align:center;font:700 20px var(--sans);letter-spacing:.18em;text-transform:uppercase;background:var(--raised);border:0;border-radius:12px;padding:10px 8px;color:var(--t1)}
.cin.on{box-shadow:inset 0 0 0 1.5px var(--accent)}
.cin::placeholder{color:var(--t3);opacity:.6}
.csym{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;color:var(--t2);background:color-mix(in oklab,var(--raised) 70%,transparent)}
.csym.on{color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1.5px var(--accent)}

/* v10 phrase: plain text */
.tag{background:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;max-width:440px}
.tag span{font-style:italic;font-size:15.5px;color:var(--t2);padding:4px 0}
button.tag:hover span{color:var(--t1)}

/* v11 preferences: bar + notifications */
.barv{font:700 20px var(--mono);color:var(--accent);margin-left:auto}
.barr{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;margin:16px 0 8px;background:linear-gradient(90deg,var(--accent) var(--p,72%),var(--raised) var(--p,72%))}
.barr::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--accent);border:3px solid var(--ground);box-shadow:0 2px 6px oklch(0 0 0 / .35);cursor:pointer}
.barr::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--accent);border:3px solid var(--ground);cursor:pointer}
.barl{display:flex;justify-content:space-between;gap:12px;font:11px var(--mono);color:var(--t3)}
.nlist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.nlist li{display:flex;align-items:center;gap:10px;font-size:14.5px}
.nlist li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none}

/* v12 appearance + device preview */
.livs{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.livs button{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:color-mix(in oklab,var(--raised) 60%,transparent)}
.livs button i{width:26px;height:26px;border-radius:50%}
.livs button.on{box-shadow:inset 0 0 0 1.6px var(--accent);background:var(--accent-soft)}
#devwrap{position:fixed;inset:0;z-index:80;background:oklch(0 0 0 / .62);display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px;backdrop-filter:blur(3px)}
#devwrap iframe{flex:1;border:0;border-radius:22px;background:var(--ground);box-shadow:0 30px 80px oklch(0 0 0 / .5);max-width:100%}
.devbar{display:flex;align-items:center;gap:14px;color:#fff;font:600 12px var(--mono);letter-spacing:.1em}
.devbar button{font:inherit;letter-spacing:.06em;border:1px solid oklch(1 0 0 / .35);border-radius:99px;padding:5px 12px;color:#fff}
@media (max-width:560px){
  .col h1{font-size:28px}
  .box{padding:16px}
  .sega{flex-wrap:wrap}
  .sega button{flex:1 1 auto;text-align:center}
  .pd{font-size:13.5px}
  .seg button{font-size:13px;padding:9px 4px}
  .stats b{font-size:18px}
  .stats span{font-size:11px}
}

/* v13 photo crop + profile colour */
.av.ph{overflow:hidden;position:relative;background:var(--raised)}
.av.ph img{position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%,-50%) translate(var(--x,0),var(--y,0)) scale(var(--z,1))}
.crop{position:relative;width:min(300px,78vw);aspect-ratio:1;margin:0 auto;border-radius:16px;overflow:hidden;background:var(--raised);touch-action:none;cursor:grab}
.crop.grab{cursor:grabbing}
.crop img{position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%,-50%) translate(var(--x,0),var(--y,0)) scale(var(--z,1));user-select:none;-webkit-user-drag:none}
.cmask{position:absolute;inset:0;pointer-events:none;box-shadow:0 0 0 999px oklch(0 0 0 / .55) inset;border-radius:50%;outline:2px solid oklch(1 0 0 / .55);outline-offset:-2px}
.crow2{display:flex;align-items:center;gap:12px;margin:16px auto 0;width:min(300px,78vw);color:var(--t3)}
.crow2 .barr{flex:1;margin:0}

/* creator */
.maker{margin-top:16px;border-top:1px solid var(--hair);padding-top:18px;display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:22px}
.maker[hidden]{display:none}
.stpaper{border-radius:14px;background:var(--raised);display:grid;place-items:center;aspect-ratio:1;position:relative;overflow:hidden;align-self:start}
.stpaper::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 23px,var(--hair) 23px 24px);opacity:.55}
.stpaper .big{position:relative;line-height:0}
.stpaper .big.go svg{animation:press .45s var(--ease)}
.ctl{display:flex;flex-direction:column;gap:14px;min-width:0}
.ctl .lab{margin:0 0 7px}
.opts{display:flex;gap:6px;flex-wrap:wrap}
.opt{width:42px;height:42px;border-radius:10px;border:1px solid var(--line);display:grid;place-items:center;color:var(--t2);line-height:0}
.opt[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.opt.txt{width:auto;padding:0 12px;font-size:13px;line-height:1}
.opt.fnt{width:auto;padding:0 12px;line-height:1;font-size:16px;font-weight:700}
.sw{width:30px;height:30px;border-radius:50%;border:3px solid var(--ground);box-shadow:0 0 0 1px var(--line)}
.sw[aria-pressed="true"]{box-shadow:0 0 0 2px var(--t1)}
.fields{display:grid;grid-template-columns:110px 1fr;gap:10px}
.fields label{display:flex;flex-direction:column;gap:6px;min-width:0}
.fields input{font:600 14px var(--mono);letter-spacing:.08em;text-transform:uppercase;background:var(--raised);border:1px solid var(--line);border-radius:10px;padding:8px 11px;color:var(--t1);width:100%;min-width:0}
.fields input:disabled{opacity:.4}
.confirm{border:1px solid color-mix(in oklab,var(--accent) 45%,transparent);background:var(--accent-soft);border-radius:12px;padding:12px 14px;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.confirm b{flex:1 1 200px;font-weight:500}
.issue{display:flex;gap:10px;flex-wrap:wrap}

/* account rows (as live) */
.row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-top:1px solid var(--hair)}
.row:first-of-type{border-top:0;padding-top:4px}
.row b{display:block;font-weight:600;font-size:16px}
.row span{color:var(--t3);font-size:14px}
.del{color:var(--t3);font-size:14px;margin:6px 2px}
.del u{color:var(--t2);text-underline-offset:4px}

/* preferences (as live) */
.sega{display:flex;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--raised);margin:12px 0 4px;flex-wrap:wrap}
.sega button{padding:8px 14px;border-radius:9px;font-size:14px;color:var(--t2)}
.sega button[aria-pressed="true"]{background:var(--ground);color:var(--t1);box-shadow:inset 0 0 0 1px var(--line)}
.ph{font-size:16px;font-weight:600;margin:0}
.pd{color:var(--t2);font-size:14px;margin:4px 0 0}
.inp{width:100%;background:var(--raised);border:1px solid var(--line);border-radius:10px;padding:11px 14px;color:var(--t1);font:inherit;font-size:14.5px;margin-top:6px}
.tog{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-top:16px;margin-top:16px;border-top:1px solid var(--hair)}
.sw2{width:48px;height:28px;border-radius:99px;background:var(--raised);border:1px solid var(--line);position:relative;flex:none;transition:background .2s}
.sw2::after{content:"";position:absolute;left:4px;top:4px;width:18px;height:18px;border-radius:50%;background:var(--t3);transition:transform .25s var(--ease),background .2s}
.sw2[aria-checked="true"]{background:var(--accent)}
.sw2[aria-checked="true"]::after{transform:translateX(20px);background:var(--ground)}
.new{font:600 10px var(--mono);letter-spacing:.1em;color:var(--accent);border:1px solid color-mix(in oklab,var(--accent) 50%,transparent);border-radius:99px;padding:1px 7px;margin-left:8px;vertical-align:2px}

/* viewer modal */
.scrim{position:fixed;inset:0;z-index:50;background:oklch(0 0 0 / .5);display:grid;place-items:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .25s var(--ease)}
.scrim.open{opacity:1;pointer-events:auto}
.sheet{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:20px;box-shadow:0 30px 80px oklch(0 0 0 / .5);transform:translateY(14px) scale(.98);transition:transform .35s var(--ease);position:relative}
.scrim.open .sheet{transform:none}
.sheet .adm{right:52px;top:14px}
.x{position:absolute;right:10px;top:10px;z-index:2;width:32px;height:32px;border-radius:50%;background:oklch(0 0 0 / .32);color:#fff;display:grid;place-items:center}
.vtag{position:absolute;left:12px;top:12px;z-index:2;font:600 10.5px var(--mono);letter-spacing:.1em;color:#fff;background:oklch(0 0 0 / .32);padding:4px 10px;border-radius:99px}

.toast{position:fixed;left:50%;top:18px;transform:translate(-50%,-20px);opacity:0;z-index:60;background:var(--t1);color:var(--ground);padding:9px 16px;border-radius:99px;font-size:13.5px;transition:all .3s var(--ease);pointer-events:none;white-space:nowrap}
.toast.show{opacity:1;transform:translate(-50%,0)}
.demo{flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;display:flex;gap:4px;padding:4px;border-radius:99px;background:oklch(.2 .02 255 / .92);color:oklch(.95 0 0);box-shadow:0 10px 30px oklch(0 0 0 / .3);font-size:13px}
.demo button{padding:7px 14px;border-radius:99px;white-space:nowrap}

@media (max-width:600px){
  .doc{grid-template-columns:1fr}
  .maker{grid-template-columns:1fr}.stpaper{max-width:240px;width:100%;justify-self:center}
  .rr .lbl{display:none}
  .box{padding:18px}
  .lbody{padding:0 16px 16px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale=".8" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="1" seed="11" result="s"/>
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.8 1.9" result="m"/>
      <feComposite in="d" in2="m" operator="in"/>
    </filter>
  </defs>
</svg>

<div class="wrap">
  <header class="top">
    <span class="brand">Wingman</span>
    <div class="top-r">
      <span class="rr"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg><span class="lbl">Ready Room</span><b>1</b></span>
      <span class="me" id="meAv"></span>
    </div>
  </header>

  <div class="col">
    <button class="back">‹ Flight Deck</button>
    <h1 id="pageTitle">Licence</h1>
    <div class="seg" role="tablist">
      <button role="tab" aria-selected="true" data-t="lic">Licence</button>
      <button role="tab" aria-selected="false" data-t="pref">Preferences</button>
      <button role="tab" aria-selected="false" data-t="app">Appearance</button>
    </div>

    <!-- LICENCE TAB -->
    <section id="t-lic">
      <div class="box">
        <div class="boxh"><p class="lab">Your licence</p><button class="pill" id="asOthers"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>See it as others do</button></div>
        <div id="myCard"></div>
        <div class="maker" id="maker" hidden></div>
      </div>

      <div class="box">
        <p class="lab">Account</p>
        <div class="row"><div><b>Email</b><span>hello@wingman.institute</span></div><button class="pill">Change</button></div>
        <div class="row"><div><b>Password</b><span>Managed by your sign-in provider</span></div><button class="pill">Update</button></div>
        <div class="row"><div><b>Sign out</b><span>On this device only</span></div><button class="pill">Sign out</button></div>
      </div>
      <p class="del"><u>Delete account</u> — removes your logbook, your crew and everything you've flown. It can't be undone.</p>
    </section>

    <!-- PREFERENCES TAB -->
    <section id="t-pref" hidden>
      <div class="box">
        <p class="lab">Who greets you</p>
        <div class="sega" id="greet"><button aria-pressed="true" data-g="0">Wingman</button><button aria-pressed="false" data-g="1">The Hermit</button></div>
        <p class="pd" id="gDesc" style="margin-top:12px">A coworker on the same shift. Notices you're here, never what you scored.</p>
        <p class="pd" id="gLab" style="margin-top:16px;color:var(--t2)">What Wingman calls you</p>
        <input class="inp" id="callMe" placeholder="Skip it. I'll talk anyway.">
      </div>
      <div class="box">
        <p class="lab">How social</p>
        <p class="pd" id="socDesc" style="margin:0">Everything, including the module chat.</p>
        <div class="sega" id="social"><button aria-pressed="false" data-s="0">Quiet skies</button><button aria-pressed="false" data-s="1">My flight</button><button aria-pressed="true" data-s="2">Open frequency</button></div>
        <div class="tog">
          <div><p class="ph">Fly solo<span class="new">MOVED HERE</span></p><p class="pd">Nobody sees you and you see nobody. For the nights you'd rather just get on with it.</p></div>
          <button class="sw2" id="solo" role="switch" aria-checked="false" aria-label="Fly solo"></button>
        </div>
      </div>
      <div class="box">
        <p class="lab">Your bar<span class="new">MOVED HERE</span></p>
        <p class="ph" style="display:flex;align-items:baseline;gap:10px">The score you're aiming for <b class="barv" id="barV">86%</b></p>
        <p class="pd">If your average on a module falls below this, Master Caution lights up on that module's card, and nowhere else. It starts at the 75% pass mark and can only go up from there. Nobody else can see it.</p>
        <input type="range" class="barr" id="bar" min="75" max="100" step="1" value="86" aria-label="Your bar">
        <div class="barl"><span>75% · pass mark</span><span>100%</span></div>
      </div>
      <div class="box">
        <p class="lab">Blocked and muted</p>
        <p class="pd" style="margin:0">Nobody yet. Block or mute anyone from their tail, and they'll be listed here to undo.</p>
      </div>
    </section>

  </div>
</div>

<div class="scrim" id="scrim"><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
<div class="toast" id="toast"></div>
<nav class="demo" aria-label="Demo controls">
  <button id="dTab">Tablet</button>
  <button id="dPhone">Phone</button>
  <button id="theme">Light / Dark</button>
  <button id="resetStamp">Reset stamp</button>
</nav>

<script>
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const FONTS={normal:'Instrument Sans,ui-sans-serif,system-ui,sans-serif',cursive:'Pacifico,Brush Script MT,cursive'};
const MOTTO='Never fly alone';
const DEFAULT_STAMP={shape:'seal',code:'',sym:'tick',ring:'',pattern:'stars',font:'normal',ink:null,seed:1};
const PALETTE=[
 {n:'Midnight',l:.34,c:.09,h:268},{n:'Lapiz',l:.48,c:.22,h:264},{n:'Miami',l:.74,c:.13,h:210},{n:'Baby',l:.84,c:.075,h:228},{n:'Powder',l:.76,c:.045,h:255},{n:'Glacier',l:.92,c:.03,h:205},
 {n:'Teal',l:.58,c:.1,h:200},{n:'Seafoam',l:.82,c:.09,h:172},{n:'Emerald',l:.58,c:.16,h:158},{n:'Racing',l:.38,c:.08,h:162},{n:'Sage',l:.72,c:.05,h:150},{n:'Matcha',l:.74,c:.095,h:122},
 {n:'Olive',l:.52,c:.09,h:120},{n:'Khaki',l:.7,c:.07,h:90},{n:'Sand',l:.86,c:.045,h:85},{n:'Butter',l:.92,c:.1,h:100},{n:'Honey',l:.78,c:.15,h:75},{n:'Papaya',l:.78,c:.15,h:62},
 {n:'Clementine',l:.72,c:.19,h:48},{n:'Coral',l:.72,c:.16,h:28},{n:'Ruby',l:.56,c:.22,h:22},{n:'Cherry',l:.46,c:.17,h:15},{n:'Peach',l:.84,c:.08,h:55},{n:'Latte',l:.78,c:.05,h:65},
 {n:'Mocha',l:.58,c:.06,h:45},{n:'Espresso',l:.38,c:.05,h:40},{n:'Nardo',l:.64,c:.008,h:240},{n:'Gunmetal',l:.46,c:.02,h:250},{n:'Chalk',l:.94,c:.008,h:90},{n:'Mauve',l:.64,c:.07,h:340},
 {n:'Blush',l:.84,c:.065,h:10},{n:'Bubblegum',l:.78,c:.15,h:355},{n:'Barbie',l:.63,c:.25,h:355},{n:'Lilac',l:.8,c:.08,h:312},{n:'Lavender',l:.7,c:.12,h:292},{n:'Plum',l:.42,c:.12,h:330}];
let MYSTAMP={...DEFAULT_STAMP}, ISSUED=null;
const col=(c,l)=>`oklch(${l??c.l??.64} ${c.c} ${c.h})`;
const SHAPES={
 seal:{o:()=>{let d='';const n=30;for(let i=0;i<n*2;i++){const r=i%2?16.4:18.4;const a=i/(n*2)*Math.PI*2-Math.PI/2;d+=(i?'L':'M')+(20+r*Math.cos(a)).toFixed(2)+','+(20+r*Math.sin(a)).toFixed(2)}return `<path d="${d}Z" stroke-width="1.2"/>`}},
 roundel:{o:()=>'<circle cx="20" cy="20" r="17.6" stroke-width="1.5"/><circle cx="20" cy="20" r="16.4" stroke-width=".4"/>'},
 window:{o:()=>'<rect x="6.5" y="1.8" width="27" height="36.4" rx="13.5" stroke-width="1.5"/><rect x="7.8" y="3.1" width="24.4" height="33.8" rx="12.2" stroke-width=".4"/>'},
 gauge:{o:()=>`<rect x="2.4" y="2.4" width="35.2" height="35.2" rx="6" stroke-width="1.4"/><circle cx="20" cy="20" r="15.6" stroke-width="1"/><circle cx="20" cy="20" r="14.8" stroke-width=".3"/>${[[6.6,6.6],[33.4,6.6],[6.6,33.4],[33.4,33.4]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="1.5" stroke-width=".6"/><path d="M${x-1} ${y+(i%2?-.5:.5)}L${x+1} ${y+(i%2?.5:-.5)}" stroke-width=".5"/>`).join('')}`},
 postage:{o:()=>`<path d="${postageP()}" stroke-width="1.2"/><rect x="6.2" y="6.2" width="27.6" height="27.6" stroke-width=".4"/>`},
 tag:{o:()=>`<path d="M9 6.5H36a1.6 1.6 0 0 1 1.6 1.6V31.9a1.6 1.6 0 0 1-1.6 1.6H9L2.4 26.4V13.6Z" stroke-width="1.3"/><circle cx="7.6" cy="20" r="1.9" stroke-width=".7"/><circle cx="7.6" cy="20" r="3" stroke-width=".35"/><path d="M11.8 8.6V31.4" stroke-width=".35" stroke-dasharray=".9 .9"/>`},
};
const MARKS={
 tick:'<path d="M14.5 20.5 18.5 24.5 26 16" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
 plane:'<path d="M20 11.5c.9 0 1.3.9 1.3 1.9v4.3l6.4 3.9v1.9l-6.4-2v3.8l2 1.6v1.5L20 27.5l-3.3.9v-1.5l2-1.6v-3.8l-6.4 2v-1.9l6.4-3.9v-4.3c0-1 .4-1.9 1.3-1.9Z" stroke="none"/>',
 wrench:'<path d="M24.8 12.2a4.6 4.6 0 0 0-5.9 5.8l-6.3 6.3a1.6 1.6 0 0 0 2.3 2.3l6.3-6.3a4.6 4.6 0 0 0 5.8-5.9l-2.7 2.7-2.3-.6-.6-2.3Z" stroke="none"/>',
 prop:'<g stroke="none"><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6"/><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6" transform="rotate(120 20 20)"/><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6" transform="rotate(240 20 20)"/></g><circle cx="20" cy="20" r="2.2" stroke="none" fill="currentColor"/><circle cx="20" cy="20" r=".9" stroke="none" fill="var(--bgc,#0b1220)"/>',
 wings:'<path d="M20 17.5c-1.6 0-2.6 1-2.6 2.5s1 2.5 2.6 2.5 2.6-1 2.6-2.5-1-2.5-2.6-2.5ZM16.4 19.2c-3-1.6-6.8-2.2-10.4-1.4 1.6 1 3.6 1.4 5.4 1.5-1.4.3-2.7.8-3.8 1.6 2.2.3 4.8.1 7-.5-1 .4-1.9 1-2.6 1.7 1.8 0 3.4-.5 4.6-1.3ZM23.6 19.2c3-1.6 6.8-2.2 10.4-1.4-1.6 1-3.6 1.4-5.4 1.5 1.4.3 2.7.8 3.8 1.6-2.2.3-4.8.1-7-.5 1 .4 1.9 1 2.6 1.7-1.8 0-3.4-.5-4.6-1.3Z" stroke="none"/>',
 wheart:'<path d="M20 26.5c-4.2-3-6.4-5.3-6.4-8 0-1.9 1.4-3.2 3.1-3.2 1.4 0 2.6.8 3.3 2 .7-1.2 1.9-2 3.3-2 1.7 0 3.1 1.3 3.1 3.2 0 2.7-2.2 5-6.4 8Z" stroke="none"/><path d="M12.9 18.4c-2.4-.9-5-1-7.4-.2 1.3.8 2.8 1 4.2 1-1 .3-1.8.8-2.5 1.4 1.7.2 3.5 0 5.2-.5M27.1 18.4c2.4-.9 5-1 7.4-.2-1.3.8-2.8 1-4.2 1 1 .3 1.8.8 2.5 1.4-1.7.2-3.5 0-5.2-.5" stroke-width="1.1" stroke-linecap="round" fill="none"/>',
 bolt:'<path d="M21.6 10.5 14 21.6h5.1L18 29.5l7.9-11.3h-5.2Z" stroke="none"/>',
 sparkle:'<path d="M20 10.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5Z" stroke="none"/><path d="M27.5 24.5c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z" stroke="none"/>',
 star:'<path d="m20 12 2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L20 24.2 15 27l1.2-5.5-4.2-3.8 5.6-.6Z" stroke="none"/>',
};
const SYMS=['plane','wrench','prop'];
const inkVal=k=>!k?'var(--accent)':(typeof k==='string'?k:col(k,Math.max(k.l??.64,.58)));
function inkFilter(seed){const id='ink2_'+seed;if(!document.getElementById(id)){const d=document.querySelector('svg defs');
  const f=document.createElementNS('http://www.w3.org/2000/svg','filter');f.id=id;f.setAttribute('x','-6%');f.setAttribute('y','-6%');f.setAttribute('width','112%');f.setAttribute('height','112%');f.setAttribute('color-interpolation-filters','sRGB');
  const px=(seed*37%100)/100;
  f.innerHTML=`<feTurbulence type="fractalNoise" baseFrequency="2.1" numOctaves="2" seed="${seed*17+3}" result="fine"/>
   <feDisplacementMap in="SourceGraphic" in2="fine" scale=".42" xChannelSelector="R" yChannelSelector="G" result="rough"/>
   <feGaussianBlur in="rough" stdDeviation=".12" result="soft"/>
   <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.9 1.78" result="grain"/>
   <feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="1" seed="${seed*29+11}" result="coarse"/>
   <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.9 ${(.05+px*.1).toFixed(2)}" result="press"/>
   <feComposite in="grain" in2="press" operator="arithmetic" k1="1" result="m"/>
   <feComposite in="soft" in2="m" operator="in"/>`;d.appendChild(f)}return id}
let RID=0;
const star4=(x,y,r)=>`<path d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z" fill="currentColor" stroke="none"/>`;
const PATTERNS={none:'None',rays:'Rays',waves:'Waves',checks:'Checks',swirl:'Swirl',guilloche:'Guilloche'};
const star5=(x,y,r)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;d+=(i?'L':'M')+(x+rr*Math.cos(a)).toFixed(2)+' '+(y+rr*Math.sin(a)).toFixed(2)}return `<path d="${d}Z" fill="currentColor" stroke="none"/>`};
function patternArt(p,a,b){let o='';
  if(p==='stars'){for(let y=a,row=0;y<=b;y+=3.6,row++)for(let x=a+(row%2?1.8:0);x<=b;x+=3.6)o+=star5(x,y,.85)}
  if(p==='polka'){for(let y=a,row=0;y<=b;y+=2.6,row++)for(let x=a+(row%2?1.3:0);x<=b;x+=2.6)o+=`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r=".62" fill="currentColor" stroke="none"/>`}
  if(p==='waves'){for(let y=a;y<=b;y+=2.2){let d='';for(let x=a;x<=b;x+=.8)d+=(x>a?'L':'M')+x.toFixed(1)+' '+(y+Math.sin(x*1.1)*.55).toFixed(2);o+=`<path d="${d}" stroke-width=".32"/>`}}
  if(p==='rays'){for(let t=0;t<360;t+=10){const q=t*Math.PI/180;o+=`<path d="M${(20+2*Math.cos(q)).toFixed(2)} ${(20+2*Math.sin(q)).toFixed(2)}L${(20+20*Math.cos(q)).toFixed(2)} ${(20+20*Math.sin(q)).toFixed(2)}" stroke-width="${t%20?.22:.42}"/>`}}
  if(p==='checks'){const z=1.8;for(let y=a,i=0;y<b;y+=z,i++)for(let x=a,j=0;x<b;x+=z,j++)if((i+j)%2===0)o+=`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${z}" height="${z}" fill="currentColor" stroke="none"/>`}
  return o}
const shade=ink=>{if(!ink)return 'color-mix(in oklab,var(--accent) 55%,var(--ground))';const l=ink.l??.64;return `oklch(${(l>.66?l-.2:l+.18).toFixed(2)} ${Math.max(.02,ink.c*.8).toFixed(3)} ${ink.h+(ink.c>.05?12:0)})`};
function rosetteP(R,n){const pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2;pts.push([20+R*Math.cos(a),20+R*Math.sin(a)])}const rb=(R*Math.sin(Math.PI/n)*1.12).toFixed(2);
  let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;for(let i=1;i<=n;i++){const p=pts[i%n];d+=`A${rb} ${rb} 0 0 1 ${p[0].toFixed(2)} ${p[1].toFixed(2)}`}return d+'Z'}
function postageP(){const a=3,b=37,r=.95,st=3.4;let d=`M${a} ${a}`;const n=Math.floor((b-a)/st),off=(b-a-(n-1)*st)/2;
  for(let i=0;i<n;i++){const x=a+off+i*st;d+=`L${(x-r).toFixed(2)} ${a}A${r} ${r} 0 0 0 ${(x+r).toFixed(2)} ${a}`}d+=`L${b} ${a}`;
  for(let i=0;i<n;i++){const y=a+off+i*st;d+=`L${b} ${(y-r).toFixed(2)}A${r} ${r} 0 0 0 ${b} ${(y+r).toFixed(2)}`}d+=`L${b} ${b}`;
  for(let i=0;i<n;i++){const x=b-off-i*st;d+=`L${(x+r).toFixed(2)} ${b}A${r} ${r} 0 0 0 ${(x-r).toFixed(2)} ${b}`}d+=`L${a} ${b}`;
  for(let i=0;i<n;i++){const y=b-off-i*st;d+=`L${a} ${(y+r).toFixed(2)}A${r} ${r} 0 0 0 ${a} ${(y-r).toFixed(2)}`}return d+'Z'}
function wingP(side){const x0=20+side*12.3,f=[[15.2,7.2,1.7],[17.9,6.6,1.6],[20.6,5.6,1.5],[23.2,4.3,1.3],[25.6,2.9,1.1]];
  return f.map(([y,len,w])=>{const x1=x0+side*len,ty=y-len*.42,mx=(x0+x1)/2;
    return `<path d="M${x0.toFixed(2)} ${(y-w/2).toFixed(2)}Q${mx.toFixed(2)} ${(y-w*.55-len*.14).toFixed(2)} ${x1.toFixed(2)} ${ty.toFixed(2)}Q${(mx+side*.6).toFixed(2)} ${(y+w*.1-len*.12).toFixed(2)} ${x0.toFixed(2)} ${(y+w/2).toFixed(2)}Z"/>`}).join('')}
const sc=k=>`translate(20 20) scale(${k}) translate(-20 -20)`;
const circ=r=>`M${20-r} 20a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
const hexP=R=>{const p=[0,60,120,180,240,300].map(d=>{const a=d*Math.PI/180;return `${(20+R*Math.cos(a)).toFixed(2)} ${(20+R*Math.sin(a)).toFixed(2)}`});return 'M'+p.join('L')+'Z'};
const SHIELD='M20 1.5 36.5 7V19c0 10-7.4 16.6-16.5 19.6C10.9 35.6 3.5 29 3.5 19V7Z';
function polyTrim(pts,t){const seg=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);tot+=d}
  const at=dist=>{let acc=0;for(let i=0;i<seg.length;i++){if(acc+seg[i]>=dist){const f=(dist-acc)/seg[i];return [pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f,i]}acc+=seg[i]}return [...pts[pts.length-1],seg.length-1]};
  const [x0,y0,i0]=at(t),[x1,y1,i1]=at(tot-t);let d=`M${x0.toFixed(2)} ${y0.toFixed(2)}`;for(let i=i0+1;i<=i1;i++)d+=`L${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;d+=`L${x1.toFixed(2)} ${y1.toFixed(2)}`;return [d,(tot-2*t).toFixed(2)]}
function bezLen(p){let L=0,px=p[0],py=p[1];for(let k=1;k<=40;k++){const t=k/40,u=1-t,x=u*u*u*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t*t*t*p[6],y=u*u*u*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t*t*t*p[7];L+=Math.hypot(x-px,y-py);px=x;py=y}return L}
function layout(shape){
  if(shape==='postage')return {fill:'M3 3H37V37H3Z',frame:'<rect x="12.2" y="13" width="15.6" height="14" rx="1.6" stroke-width=".8"/>',inner:'M12.6 13.4H27.4V26.6H12.6Z',band:'M6.6 6.6H33.4V33.4H6.6Z',
    top:'M9.4 9.9H30.6',tl:'21.2',bot:'M9.4 30.1H30.6',bl:'21.2',stars:[[9.3,20],[30.7,20]],fz:[2.9,2.25],ring:{type:'rect',a:[12.2,13,27.8,27],b:[6.3,6.3,33.7,33.7]},clip:'M6.6 6.6H33.4V33.4H6.6Z'};
  if(shape==='tag')return {fill:'M9 6.5H37.6V33.5H9L2.4 26.4V13.6Z',frame:'<rect x="16.6" y="14.4" width="16.8" height="11.2" rx="1.4" stroke-width=".8"/>',inner:'M17 14.8H33V25.2H17Z',band:'M13 8.6H36V31.4H13Z',
    top:'M14.6 11H35.4',tl:'20.8',bot:'M14.6 29H35.4',bl:'20.8',stars:[[14.4,20],[35.6,20]],fz:[2.8,2.15],star:1.05,cx:25,ring:{type:'rect',a:[16.6,14.4,33.4,25.6],b:[12.2,6.7,37.4,33.3]},clip:'M12.4 7.2H35.9a1.2 1.2 0 0 1 1.2 1.2V31.6a1.2 1.2 0 0 1-1.2 1.2H12.4Z'};
  if(shape==='window'){const r=10.15,g=22*Math.PI/180,pa=(cy,a)=>`${(20+r*Math.cos(a)).toFixed(2)} ${(cy+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:'M6.5 15.3a13.5 13.5 0 0 1 27 0V24.7a13.5 13.5 0 0 1-27 0Z',frame:'<rect x="12.9" y="13.6" width="14.2" height="12.8" rx="3.2" stroke-width=".85"/><rect x="13.7" y="14.4" width="12.6" height="11.2" rx="2.6" stroke-width=".3"/>',inner:'M13.3 14H26.7V26H13.3Z',band:'M8.9 15.3a11.1 11.1 0 0 1 22.2 0V24.7a11.1 11.1 0 0 1-22.2 0Z',
      top:`M${pa(15.3,Math.PI+g)}A${r} ${r} 0 0 1 ${pa(15.3,-g)}`,tl:L,bot:`M${pa(24.7,Math.PI-g)}A${r} ${r} 0 0 0 ${pa(24.7,g)}`,bl:L,stars:[[10.4,20],[29.6,20]],fz:[2.7,2.25],star:1,ring:{type:'rect',a:[12.9,13.6,27.1,26.4],b:[7.6,2.9,32.4,37.1]},clip:'M8.3 15.3a11.7 11.7 0 0 1 23.4 0V24.7a11.7 11.7 0 0 1-23.4 0Z'}}
  if(shape==='roundel'){const r=12.5,g=33*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:circ(16.2),frame:'<rect x="1.2" y="14.8" width="37.6" height="10.4" rx="1.2" stroke-width="1.3"/><rect x="2.3" y="15.9" width="35.4" height="8.2" rx=".6" stroke-width=".35"/>',inner:'M2.6 16.2H37.4V23.8H2.6Z',band:circ(15.8),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[],fz:[3.1,2.3],ring:{type:'circle',ri:5.4,ro:16.6},bar:true,clip:circ(16.1)}}
  if(shape==='gauge'){const r=11.9,g=17*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:circ(14.6),frame:'<circle cx="20" cy="20" r="8.7" stroke-width=".85"/><circle cx="20" cy="20" r="7.9" stroke-width=".3"/>',inner:circ(9),band:circ(14.2),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:[3.2,2.8],star:1.2,ring:{type:'circle',ri:8.7,ro:15},clip:circ(14.5)}}
  const r=shape==='compass'?12:12.8,g=16*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
  const cp=shape==='compass',ri=cp?8.8:9.4;
  return {fill:circ(cp?15.2:16.2),frame:`<circle cx="20" cy="20" r="${ri}" stroke-width=".9"/><circle cx="20" cy="20" r="${ri-.8}" stroke-width=".3"/>`,inner:circ(ri+.3),band:circ(cp?14.2:15.3),
    top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:cp?[3.3,2.9]:[3.5,3.1],star:cp?1.2:1.35,ring:{type:'circle',ri:ri,ro:16.8},clip:circ(16)};
}
function ringPt(R,t,d){if(R.type==='circle'){const a=t*Math.PI*2-Math.PI/2,r=R.ri+(R.ro-R.ri)*d;return [20+r*Math.cos(a),20+r*Math.sin(a)]}
  const per=(q,t)=>{const [x0,y0,x1,y1]=q,w=x1-x0,h=y1-y0,P=2*(w+h);let u=((t%1)+1)%1*P;if(u<w)return [x0+u,y0];u-=w;if(u<h)return [x1,y0+u];u-=h;if(u<w)return [x1-u,y1];u-=w;return [x0,y1-u]};
  const A=per(R.a,t),B=per(R.b,t);return [A[0]+(B[0]-A[0])*d,A[1]+(B[1]-A[1])*d]}
function ringPattern(p,R){const f=v=>v.toFixed(2);let o='';
  if(p==='rays'){const N=R.type==='circle'?48:56;for(let i=0;i<N;i++){const t=i/N,[x1,y1]=ringPt(R,t,R.ri<2?.18:.1),[x2,y2]=ringPt(R,t,i%2?.72:1.02);o+=`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke-width="${i%2?.35:.55}" stroke-linecap="round"/>`}}
  if(p==='waves'){(R.ri<2?[.2,.34,.48,.62,.76,.9]:[.16,.38,.6,.82,1.02]).forEach((d0,k)=>{let d='';const S=240;for(let i=0;i<=S;i++){const t=i/S,[x,y]=ringPt(R,t,d0+(R.ri<2?.035:.1)*Math.sin(t*Math.PI*2*(R.type==='circle'?14:16)+k*1.4));d+=(i?'L':'M')+f(x)+' '+f(y)}o+=`<path d="${d}Z" stroke-width=".4"/>`})}
  if(p==='checks'){const N=R.type==='circle'?32:36,rows=R.ri<2?4:3;for(let row=0;row<rows;row++)for(let i=0;i<N;i++){if((i+row)%2)continue;const hh=(R.ri<2?.8:.96)/rows,d0=(R.ri<2?.1:.04)+row*hh,d1=d0+hh,t0=i/N,t1=(i+1)/N,S=3;let pts=[];
    for(let k=0;k<=S;k++)pts.push(ringPt(R,t0+(t1-t0)*k/S,d0));for(let k=S;k>=0;k--)pts.push(ringPt(R,t0+(t1-t0)*k/S,d1));
    o+=`<path d="M${pts.map(([x,y])=>f(x)+' '+f(y)).join('L')}Z" fill="currentColor" stroke="none"/>`}}
  if(p==='swirl'){const N=R.type==='circle'?30:34,tw=R.ri<2?.22:.12;for(let i=0;i<N;i++){let d='';for(let k=0;k<=24;k++){const dd=(R.ri<2?.12:.06)+k/24*(R.ri<2?.84:1),[x,y]=ringPt(R,i/N+dd*tw,dd);d+=(k?'L':'M')+f(x)+' '+f(y)}o+=`<path d="${d}" stroke-width="${i%2?.3:.45}" stroke-linecap="round"/>`}}
  if(p==='guilloche'){const n=R.type==='circle'?(R.ri<2?9:12):14,S=360;for(let k=0;k<6;k++){let d='';for(let i=0;i<=S;i++){const t=i/S,[x,y]=ringPt(R,t,.52+.46*Math.sin(t*Math.PI*2*n+k*Math.PI/3));d+=(i?'L':'M')+f(x)+' '+f(y)}o+=`<path d="${d}Z" stroke-width=".28"/>`}}
  return o}
function inspStamp(on,size=40,rot=0,st=MYSTAMP){
  const sh=SHAPES[st.shape]||SHAPES.seal, rim=st.rim!==false, id=++RID, Ly=layout(st.shape||'seal');
  const code=(st.code||'').toUpperCase().slice(0,3), sym=st.sym&&MARKS[st.sym]?st.sym:null;
  let o='',txt='',barPat='';
  const top=((st.ring||'').trim()||'WINGMAN').toUpperCase().slice(0,10),bot=MOTTO.toUpperCase();
  const big=1, cy=20, ccx=Ly.cx||20, sq=({seal:.98,window:.66,roundel:1.02,gauge:.86,tag:.64,postage:.76}[st.shape]||1);
  const T=(extra)=>{let t='';
    if(rim){t+=`<text font-size="${(Ly.fz[0]*(top.length>7?Math.max(.8,7.5/top.length):1)).toFixed(2)}" font-weight="700" font-family="${FONTS.normal}" dominant-baseline="middle" ${extra}><textPath href="#rt${id}" textLength="${Ly.tl}" lengthAdjust="spacing">${top}</textPath></text>`;
      t+=`<text font-size="${Ly.fz[1]}" font-weight="700" font-family="${FONTS.normal}" dominant-baseline="middle" ${extra}><textPath href="#rb${id}" textLength="${Ly.bl}" lengthAdjust="spacing">${bot}</textPath></text>`;
      t+=Ly.stars.map(([x,y])=>star5(x,y,Ly.star||1.35)).join('')}
    if(!sym&&code){const fs=({1:9.6,2:8,3:6.6}[code.length])*big*sq;t+=`<text x="${ccx}" y="${(cy+fs*.355).toFixed(2)}" font-size="${fs.toFixed(2)}" text-anchor="middle" font-weight="700" letter-spacing="${(.35*big).toFixed(2)}" font-family="${FONTS.normal}" ${extra}>${code}</text>`}
    return t};
  if(rim)o+=`<path id="rt${id}" d="${Ly.top}" stroke="none"/><path id="rb${id}" d="${Ly.bot}" stroke="none"/>`;
  const p=st.pattern||'none';
  if(p!=='none'){
    const R0=Ly.ring,cx0=ccx,sco=st.pscope||'both';
    const R=R0.type==='circle'
      ?(sco==='centre'?{type:'circle',ri:1.1,ro:R0.ri-.5}:sco==='rim'?{type:'circle',ri:R0.ri+.4,ro:R0.ro}:{type:'circle',ri:1.2,ro:R0.ro})
      :(sco==='centre'?{type:'rect',a:[cx0-1,19,cx0+1,21],b:[R0.a[0]-.4,R0.a[1]-.4,R0.a[2]+.4,R0.a[3]+.4]}
        :sco==='rim'?{type:'rect',a:[R0.a[0]+.5,R0.a[1]+.5,R0.a[2]-.5,R0.a[3]-.5],b:R0.b}
        :{type:'rect',a:[cx0-1,19,cx0+1,21],b:R0.b});
    const halo=`<g fill="#000" stroke="#000" stroke-width="${rim?1.6:2.2}" stroke-linejoin="round">${T('')}${sym?`<g transform="translate(${ccx} ${cy}) scale(${(.62*big*sq).toFixed(2)}) translate(-20 -20)" stroke-width="3">${MARKS[sym]}</g>`:''}</g><g fill="none" stroke="#000" stroke-width="1.8">${Ly.frame}</g>`;
    const pat=`<mask id="pm${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40"><rect width="40" height="40" fill="#fff"/>${halo}</mask><clipPath id="pk${id}"><path d="${Ly.clip||Ly.fill}"/></clipPath><g clip-path="url(#pk${id})"><g mask="url(#pm${id})" opacity="${(p==='checks'?.5:.7)*(rim?.75:1)}">${ringPattern(p,R)}</g></g>`;o+=pat}
  o+=sh.o();
  o+=Ly.frame;
  o+=`<g fill="currentColor" stroke="none">${T('')}</g>`;
  if(sym)o+=`<g transform="translate(${ccx} ${cy}) scale(${(.62*big*sq).toFixed(2)}) translate(-20 -20)" fill="currentColor" stroke="currentColor">${MARKS[sym]}</g>`;
  const style=on&&st.ink!==undefined?`style="color:${inkVal(st.ink)}"`:'';
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" ${style}><g transform="rotate(${rot} 20 20)" ${on?`filter="url(#${inkFilter(st.seed||1)})"`:''} fill="none" stroke="currentColor" ${on?'':'opacity=".45"'} stroke-linejoin="round">${o}</g></svg>`;
}
/* colour palette */
function colourGrid(sel,attr){return `<div class="pal">${PALETTE.map((p,i)=>`<button class="${sel&&sel.n===p.n?'on':''}" ${attr}="${i}" aria-label="${p.n}"><i style="background:${col(p)}"></i><span>${p.n}</span></button>`).join('')}</div>`}



let draft=null, confirming=false;

const LIVERIES={sky:{n:'Sky blue',h:254,c:.13,d:'The forty minutes between the climb and the descent.'},amber:{n:'Gauge amber',h:75,c:.13,d:'The glow of a panel at night.'},tarmac:{n:'Tarmac grey',h:255,c:.02,d:'Quiet, like the ramp at first light.'},beacon:{n:'Beacon red',h:25,c:.15,d:'The rotating light on the belly.'},runway:{n:'Runway green',h:150,c:.12,d:'Centreline lights on a wet night.'},skydrol:{n:'Skydrol violet',h:300,c:.13,d:'The colour of hydraulic fluid, and nothing else.'}};
const lc=(L,l,cm=1,a=1)=>`oklch(${l} ${(L.c*cm).toFixed(3)} ${L.h}${a<1?' / '+a:''})`;
const SETS={
 contour:{n:'Contours',svg:()=>{let o='';for(let i=0;i<10;i++){let d='';for(let x=0;x<=640;x+=16){const y=4+i*13+Math.sin(x/62+i*.7)*9+Math.cos(x/31+i)*3;d+=(x?'L':'M')+x+' '+y.toFixed(1)}o+=`<path d="${d}" stroke="oklch(1 0 0 / ${i%3?.15:.32})"/>`}return o}},
 panels:{n:'Panels',svg:()=>{let o='';[0,110,250,390,520,640].forEach(x=>{o+=`<path d="M${x} 0V128" stroke="oklch(1 0 0 / .22)"/>`;for(let y=8;y<128;y+=11)o+=`<circle cx="${x+5}" cy="${y}" r="1.3" fill="#fff" fill-opacity=".38"/>`});o+='<path d="M0 66H640" stroke="oklch(1 0 0 / .18)"/>';for(let x=14;x<640;x+=13)o+=`<circle cx="${x}" cy="71" r="1.2" fill="#fff" fill-opacity=".3"/>`;return o+'<rect x="286" y="20" width="70" height="30" rx="4" stroke="oklch(1 0 0 / .3)"/>'}},
 runway:{n:'Runway',svg:()=>{let o='';
   for(let y=12;y<=116;y+=10){if(Math.abs(y-64)<14)continue;o+=`<path d="M22 ${y}H104" stroke="oklch(1 0 0 / .4)" stroke-width="5"/>`}
   o+='<text x="142" y="64" font-family="Geist Mono,monospace" font-size="28" font-weight="600" letter-spacing="4" fill="oklch(1 0 0 / .5)" transform="rotate(90 142 64)" text-anchor="middle" dominant-baseline="middle">26</text>';
   for(let x=190;x<640;x+=46)o+=`<path d="M${x} 64H${x+26}" stroke="oklch(1 0 0 / .45)" stroke-width="2"/>`;
   o+='<path d="M300 30H372M300 98H372" stroke="oklch(1 0 0 / .36)" stroke-width="9"/>';
   [[214,3],[430,2],[540,1]].forEach(([x,n])=>{for(let k=0;k<n;k++)o+=`<path d="M${x} ${42-k*8}H${x+32}M${x} ${86+k*8}H${x+32}" stroke="oklch(1 0 0 / .26)" stroke-width="4"/>`});
   o+='<path d="M0 1.5H640M0 126.5H640" stroke="oklch(1 0 0 / .5)" stroke-width="3"/>';
   for(let x=10;x<640;x+=24)o+=`<circle cx="${x}" cy="6" r="1.8" fill="#fff" fill-opacity=".7"/><circle cx="${x}" cy="122" r="1.8" fill="#fff" fill-opacity=".7"/>`;
   return o}},
 flight:{n:'Flight path',svg:()=>{const G=112,C=34;
   const d=`M0 ${G}H70C120 ${G} 150 ${C} 230 ${C}H430C500 ${C} 530 ${G} 580 ${G}H640`;
   let o=`<path d="M0 ${G+4}H640" stroke="oklch(1 0 0 / .14)"/><path d="${d}" stroke="oklch(1 0 0 / .22)" stroke-width="1.6" stroke-dasharray="4 6"/>`;
   o+=`<path d="M0 ${G}H70C120 ${G} 150 ${C} 230 ${C}H330" stroke="oklch(1 0 0 / .7)" stroke-width="2"/>`;
   [[70,G],[150,72],[230,C],[330,C],[430,C],[505,72],[580,G]].forEach(([x,y],i)=>o+=i===4?'':`<circle cx="${x}" cy="${y}" r="${i===3?6:4}" fill="${i<3?'#fff':i===3?'#fff':'none'}" fill-opacity="${i<3?.7:1}" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`);
   o+=`<circle cx="430" cy="${C}" r="4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/>`;
   return o+`<circle cx="330" cy="${C}" r="12" stroke="#fff" stroke-opacity=".25"/>`}},
 chart:{n:'Chart',svg:()=>{const M='Geist Mono,monospace';let o='';
   for(let x=0;x<=640;x+=80)o+=`<path d="M${x} 0V128" stroke="oklch(1 0 0 / .07)"/>`;for(let y=0;y<=128;y+=42)o+=`<path d="M0 ${y}H640" stroke="oklch(1 0 0 / .07)"/>`;
   o+=`<text x="6" y="38" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .3)">N29°30'</text><text x="84" y="124" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .3)">E047°</text>`;
   let cl='';for(let x=0;x<=640;x+=10){const y=118-Math.sin(x/70)*10-Math.cos(x/23)*4-(x>420?(x-420)*.12:0);cl+=(x?'L':'M')+x+' '+y.toFixed(1)}o+=`<path d="${cl}" stroke="oklch(1 0 0 / .22)" stroke-width="1.2"/>`;
   const W={TOKOS:[40,92],ALVAN:[140,36],DESNA:[230,96],KUWAIT:[360,56],RAGAS:[470,98],BUNDU:[610,76],SIDAD:[470,16],LOVEN:[250,10]};
   const air=[['TOKOS','ALVAN','UL602'],['ALVAN','KUWAIT','UL602'],['KUWAIT','BUNDU','UL602'],['DESNA','KUWAIT','M677'],['KUWAIT','RAGAS','M677'],['LOVEN','KUWAIT','G663'],['KUWAIT','SIDAD','T12'],['TOKOS','DESNA','W4']];
   air.forEach(([p,q,n])=>{const [x1,y1]=W[p],[x2,y2]=W[q];o+=`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="oklch(1 0 0 / .38)" stroke-width="1.2" stroke-dasharray="${n==='UL602'?'':'5 4'}"/>`;
     if(n==='T12')return;const mx=(x1+x2)/2,my=(y1+y2)/2;o+=`<rect x="${mx-15}" y="${my-6}" width="30" height="11" rx="2" fill="oklch(.2 .03 255 / .55)"/><text x="${mx}" y="${my+2.5}" text-anchor="middle" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .55)">${n}</text>`});
   const [vx,vy]=W.KUWAIT;
   o+=`<path d="M${vx-5} ${vy-3}L${vx} ${vy-6}L${vx+5} ${vy-3}V${vy+3}L${vx} ${vy+6}L${vx-5} ${vy+3}Z" stroke="#fff" stroke-opacity=".7" fill="oklch(1 0 0 / .15)"/>`;
   Object.entries(W).forEach(([n,[x,y]])=>{if(n==='KUWAIT'){o+=`<text x="${x+30}" y="${y-18}" font-family="${M}" font-size="8.5" letter-spacing="1" fill="oklch(1 0 0 / .6)">KUWAIT 115.9</text>`;return}
     o+=`<path d="M${x} ${y-4.5}L${x+4.5} ${y+3.5}H${x-4.5}Z" stroke="oklch(1 0 0 / .65)" fill="oklch(1 0 0 / .12)"/><text x="${x+(x>600?-7:7)}" text-anchor="${x>600?'end':'start'}" y="${y+(y<30?12:-6)}" font-family="${M}" font-size="7.5" letter-spacing="1" fill="oklch(1 0 0 / .5)">${n}</text>`});
   return o}},
};
const PHRASES=["Torqued to spec. Emotionally too.","It's not a leak, it's a seep.","Could not duplicate."];
const ME={name:'Hassan Alrefaei',callsign:'h.alrefaei',bio:'',phrase:PHRASES[0],cat:'B2 · Avionics',inst:'AU University',admin:true,photo:null,photoZ:1,photoX:0,photoY:0,cover:'contour',coverColor:null,coverImg:null,livery:'sky',
  stats:[['13h 54m','Hours flown'],['7','Lessons signed off'],['12','Days flown']]};
const initials=n=>n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
function setBg(c){c=c||PALETTE[1];const l=c.l??.6;return `linear-gradient(135deg,${col(c,l)} 0%,${col(c,Math.max(.16,l-.26))} 100%)`}
function avaBg(c){c=c||PALETTE[1];return col(c)}
function avaFg(c){c=c||PALETTE[1];return (c.l??.6)>.7?'oklch(.2 .02 265)':'#fff'}
function coverHTML(e){
  const img=ME.cover==='image'&&ME.coverImg;
  const bg=img?`background-image:url('${ME.coverImg}');background-size:cover;background-position:center`:`background:${setBg(ME.coverColor)}`;
  return `<div class="cover" style="${bg}">${img?'':`<svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none">${SETS[ME.cover].svg()}</svg>`}
   ${e?`<button class="cvbtn" id="cvBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>Cover</button>`:''}</div>`;
}
function avatarHTML(){return ME.photo?`<span class="av ph"><img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%"></span>`:`<span class="av" style="background:${avaBg(ME.coverColor)};color:${avaFg(ME.coverColor)}">${initials(ME.name)}</span>`}
function stampBlock(e,slam){
  if(ISSUED)return `<div class="sblock"><span class="got ${slam?'slam':''}">${inspStamp(true,150,-6,MYSTAMP)}</span></div>`;
  if(e)return `<div class="sblock"><button class="ghost" id="mk" aria-label="Create your stamp">${inspStamp(false,150,0,DEFAULT_STAMP)}<b>Create your stamp</b></button></div>`;
  return `<div class="sblock"><span class="gen">${inspStamp(false,150,0,DEFAULT_STAMP)}</span></div>`;
}
function card(e,slam){
  const L=LIVERIES[ME.livery];
  return `<div class="lic ${e?'editing':''}" style="--accent:${lc(L,.68,1.1)};--accent-soft:${lc(L,.68,1.1,.14)}">${coverHTML(e)}${ME.admin?'<span class="adm"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/></svg>ADMIN</span>':''}
   <div class="lbody">
    <div class="avw">${avatarHTML()}${e?'<button class="cam" id="photo" aria-label="Profile picture"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>':''}</div>
    ${e?`<input class="ed hn" id="fCs" value="${ME.callsign}" aria-label="Callsign" maxlength="20" size="${Math.max(6,ME.callsign.length+1)}">`:`<div class="hn">${ME.callsign}</div>`}
    <div class="sn">${ME.name}</div>
    ${e?`<input class="ed bio" id="fBio" value="${ME.bio}" maxlength="80" placeholder="Add a line about you">`:(ME.bio?`<p class="bio">${ME.bio}</p>`:'')}
    ${e?`<button class="tag" id="phr" title="Pick a phrase"><i></i><span>${ME.phrase}</span><i></i></button>`:`<span class="tag"><i></i><span>${ME.phrase}</span><i></i></span>`}
    <div class="stats">${ME.stats.map(([v,k])=>`<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
    ${stampBlock(e,slam)}
    ${e?'':`<button class="pill pri inv" disabled>Invite to squadron</button>`}
   </div></div>`;
}
function paintTop(){const el=$('#meAv');if(!el)return;el.innerHTML=ME.photo?`<img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%">`:initials(ME.name);el.className='me av ph'+(ME.photo?'':' ini');el.style.background=ME.photo?'':avaBg(ME.coverColor);el.style.color=avaFg(ME.coverColor)}
function paintCard(slam){
  $('#myCard').innerHTML=card(true,slam);
  $('#fCs').onchange=e=>{const v=e.target.value.trim();if(!v){e.target.value=ME.callsign;return}ME.callsign=v;toast('Callsign saved')};
  $('#fCs').oninput=e=>e.target.size=Math.max(6,e.target.value.length+1);
  $('#fBio').onchange=e=>{ME.bio=e.target.value.trim();toast('Saved')};
  $('#photo').onclick=pickPhoto;$('#cvBtn').onclick=pickCover;paintTop();$('#phr').onclick=pickPhrase;
  if($('#mk'))$('#mk').onclick=openMaker;
}
function pickPhrase(){
  openSheet(`<h3>Your phrase</h3><div class="plist">${PHRASES.map((p,i)=>`<button class="pp ${ME.phrase===p?'on':''}" data-ph="${i}">${p}</button>`).join('')}</div>`);
  $$('[data-ph]').forEach(b=>b.onclick=()=>{ME.phrase=PHRASES[+b.dataset.ph];closeV();paintCard();toast('Phrase set')});
}
function readFile(cb){const i=document.createElement('input');i.type='file';i.accept='image/png,image/jpeg,image/webp,image/heic';i.onchange=()=>{const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(f)};i.click()}
function openSheet(html){$('#sheet').innerHTML=`<div class="pick"><button class="x2" id="closeP" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>${html}</div>`;$('#scrim').classList.add('open');$('#closeP').onclick=closeV}
function pickPhoto(){
  openSheet(`<h3>Profile picture</h3><div class="pgrid">
    <button class="popt ${!ME.photo?'on':''}" id="useIni"><span class="av sm" style="background:${avaBg(ME.coverColor)};color:${avaFg(ME.coverColor)}">${initials(ME.name)}</span><span>Your initials</span></button>
    <button class="popt ${ME.photo?'on':''}" id="upPh"><span class="av sm up ph">${ME.photo?`<img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%">`:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>'}</span><span>${ME.photo?'Change photo':'Upload a photo'}</span></button></div>`);
  $('#useIni').onclick=()=>{ME.photo=null;closeV();paintCard();toast('Using your initials')};
  $('#upPh').onclick=()=>readFile(d=>openCrop(d));
}
function openCrop(src){
  let z=1.2,x=0,y=0;
  openSheet(`<h3>Position your photo</h3>
   <div class="crop" id="crop"><img id="cimg" src="${src}" alt=""><span class="cmask"></span></div>
   <div class="crow2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>
     <input type="range" class="barr" id="czoom" min="100" max="300" value="120" aria-label="Zoom">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/></svg></div>
   <p class="snote" style="text-align:center;margin:10px 0 0">Drag the photo to move it</p>
   <div class="pbtns" style="margin-top:16px"><button class="pill" id="cCancel">Cancel</button><button class="pill pri" id="cUse">Use photo</button></div>`);
  const img=$('#cimg'),paint=()=>{img.style.setProperty('--z',z);img.style.setProperty('--x',x+'%');img.style.setProperty('--y',y+'%')};paint();
  $('#czoom').oninput=e=>{z=+e.target.value/100;e.target.style.setProperty('--p',((e.target.value-100)/200*100)+'%');paint()};
  $('#czoom').style.setProperty('--p','10%');
  let drag=false,sx,sy,ox,oy;const st=$('#crop');
  st.addEventListener('pointerdown',e=>{drag=true;sx=e.clientX;sy=e.clientY;ox=x;oy=y;st.setPointerCapture(e.pointerId);st.classList.add('grab')});
  st.addEventListener('pointermove',e=>{if(!drag)return;const r=st.getBoundingClientRect();const lim=(z-1)*50;
    x=Math.max(-lim,Math.min(lim,ox+(e.clientX-sx)/r.width*100));y=Math.max(-lim,Math.min(lim,oy+(e.clientY-sy)/r.height*100));paint()});
  st.addEventListener('pointerup',()=>{drag=false;st.classList.remove('grab')});
  $('#cCancel').onclick=()=>{closeV();pickPhoto()};
  $('#cUse').onclick=()=>{ME.photo=src;ME.photoZ=z;ME.photoX=x;ME.photoY=y;closeV();paintCard();toast('Photo updated')};
}
function pickCover(){
  const thumb=k=>`<span class="cthumb" style="background:${setBg(ME.coverColor)}"><svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none">${SETS[k].svg()}</svg></span>`;
  openSheet(`<h3>Cover</h3><div class="cgrid">${Object.entries(SETS).map(([k,c])=>`<button class="copt ${ME.cover===k?'on':''}" data-cv="${k}">${thumb(k)}<span>${c.n}</span></button>`).join('')}
   <button class="copt ${ME.cover==='image'?'on':''}" id="upCv"><span class="cthumb up" ${ME.coverImg?`style="background-image:url('${ME.coverImg}');background-size:cover"`:''}>${ME.coverImg?'':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>'}</span><span>Your image</span></button></div>
   <p class="lab" style="margin:18px 0 8px">Colour</p>${colourGrid(ME.coverColor,'data-cc')}`);
  $$('[data-cv]').forEach(b=>b.onclick=()=>{ME.cover=b.dataset.cv;paintCard();pickCover()});
  $$('[data-cc]').forEach(b=>b.onclick=()=>{ME.coverColor=PALETTE[+b.dataset.cc];if(ME.cover==='image')ME.cover='contour';paintCard();pickCover()});
  $('#upCv').onclick=()=>{if(ME.coverImg&&ME.cover!=='image'){ME.cover='image';paintCard();pickCover();return}readFile(d=>{ME.coverImg=d;ME.cover='image';paintCard();pickCover()})};
}
let tab='shape';
function openMaker(){draft={shape:'seal',code:'',sym:null,ring:'',rim:true,pattern:'none',pscope:'both',ink:PALETTE[1],seed:7,cmode:'code'};confirming=false;tab='shape';paintStudio(true);$('#scrim').classList.add('open')}
const SYMN={plane:'Plane',wrench:'Spanner',prop:'Propeller'};
function paintStudio(anim){
  const d=draft,L=LIVERIES[ME.livery];
  const TABS={shape:'Shape',ring:'Rim',pat:'Pattern',ink:'Ink'};if(tab==='mark')tab='shape';
  let body='';
  if(tab==='shape')body=`<div class="srow">${Object.keys(SHAPES).map(k=>`<button class="stile ${d.shape===k?'on':''}" data-shape="${k}" aria-label="${k}">${inspStamp(false,46,0,{shape:k,code:'',sym:null,ring:'',pattern:'dots'})}</button>`).join('')}</div>`;
  if(tab==='mark')body=`<div class="seg2"><button class="${d.cmode==='code'?'on':''}" data-cmode="code">Code</button><button class="${d.cmode==='sym'?'on':''}" data-cmode="sym">Symbol</button></div>
     ${d.cmode==='code'?`<input class="sin" id="sCode" maxlength="3" value="${d.code}" placeholder="Up to 3 letters or numbers" autocomplete="off">`
       :`<div class="srow">${SYMS.map(k=>`<button class="stile ${d.sym===k?'on':''}" data-sym="${k}" aria-label="${SYMN[k]}" title="${SYMN[k]}"><svg width="30" height="30" viewBox="9 9 22 22" fill="currentColor" stroke="currentColor">${MARKS[k]}</svg></button>`).join('')}</div>`}`;
  if(tab==='ring')body=`<div class="tgl"><span>Rim text</span><button class="sw2" id="rimT" role="switch" aria-checked="${d.rim!==false}" aria-label="Rim text"></button></div>
     ${d.rim!==false?`<input class="sin" id="sRing" maxlength="10" value="${d.ring}" placeholder="WINGMAN" autocomplete="off"><p class="snote" style="margin:0">Motto runs along the bottom</p>`:`<p class="snote" style="margin:0">Your pattern fills the ring</p>`}`;
  if(tab==='pat')body=`<div class="srow">${Object.entries(PATTERNS).map(([k,n])=>`<button class="stile wide pt ${d.pattern===k?'on':''}" data-pat="${k}"><svg width="40" height="40" viewBox="3 3 34 34" fill="none" stroke="currentColor">${k==='none'?'':ringPattern(k,{type:'circle',ri:8,ro:15.5})}<circle cx="20" cy="20" r="7.6" stroke-width=".7"/><circle cx="20" cy="20" r="16" stroke-width=".9"/></svg><small>${n}</small></button>`).join('')}</div>
     ${d.pattern!=='none'?`<div class="seg2"><button class="${(d.pscope||'both')==='both'?'on':''}" data-scope="both">Both</button><button class="${d.pscope==='centre'?'on':''}" data-scope="centre">Centre</button><button class="${d.pscope==='rim'?'on':''}" data-scope="rim">Rim</button></div>`:''}`;
  if(tab==='ink')body=colourGrid(d.ink,'data-ink');
  $('#sheet').innerHTML=`<div class="studio" style="--accent:${lc(L,.68,1.1)};--accent-soft:${lc(L,.68,1.1,.14)}">
   <div class="shead"><h3>Your stamp</h3><button class="x2" id="closeS" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div class="spaper"><span class="big ${anim?'go':''}">${inspStamp(true,196,-5,d)}</span><button class="dice" id="shuffle" title="Surprise me" aria-label="Shuffle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg></button></div>
   <div class="crow"><input class="cin ${d.sym?'':'on'}" id="sCode" maxlength="3" value="${d.sym?'':d.code}" placeholder="H7A" autocomplete="off" aria-label="Your 3-character code"></div>
   <div class="stabs" role="tablist">${Object.entries(TABS).map(([k,n])=>`<button role="tab" aria-selected="${tab===k}" data-tab="${k}">${n}</button>`).join('')}</div>
   <div class="sbody">${body}</div>
   <div class="sfoot">${confirming?`<p>It can't be changed after this.</p><div class="sbtns"><button class="pill" id="back2">Keep editing</button><button class="pill pri" id="doIssue">Issue it</button></div>`
     :`<button class="pill pri issueb" id="issue">Issue my stamp</button>`}</div></div>`;
  const set=(k,v)=>{draft[k]=v;confirming=false;paintStudio(true)};
  $$('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;paintStudio(false)});
  $$('[data-shape]').forEach(b=>b.onclick=()=>set('shape',b.dataset.shape));
  $$('[data-sym]').forEach(b=>b.onclick=()=>{const v=draft.sym===b.dataset.sym?null:b.dataset.sym;draft.cmode=v?'sym':'code';set('sym',v)});
  $$('[data-cmode]').forEach(b=>b.onclick=()=>{draft.cmode=b.dataset.cmode;if(draft.cmode==='code')draft.sym=null;else if(!draft.sym)draft.sym='plane';set('cmode',draft.cmode)});
  $$('[data-pat]').forEach(b=>b.onclick=()=>set('pattern',b.dataset.pat));
  $$('[data-scope]').forEach(b=>b.onclick=()=>set('pscope',b.dataset.scope));
  $$('[data-band]').forEach(b=>b.onclick=()=>set('band',b.dataset.band));
  if($('#rimT'))$('#rimT').onclick=()=>set('rim',draft.rim===false);
  $$('[data-font]').forEach(b=>b.onclick=()=>set('font',b.dataset.font));
  $$('[data-ink]').forEach(b=>b.onclick=()=>set('ink',PALETTE[+b.dataset.ink]));
  const redraw=()=>{$('.spaper .big').className='big';$('.spaper .big').innerHTML=inspStamp(true,196,-5,draft)};
  if($('#sCode')){$('#sCode').onfocus=()=>{if(draft.sym){draft.sym=null;draft.cmode='code';$$('.csym').forEach(b=>b.classList.remove('on'));$('#sCode').classList.add('on');redraw()}};$('#sCode').oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');draft.code=e.target.value;draft.sym=null;draft.cmode='code';redraw()}}
  $('#shuffle').onclick=()=>{const pick=a=>a[Math.floor(Math.random()*a.length)];draft.shape=pick(Object.keys(SHAPES));draft.pattern=pick(Object.keys(PATTERNS));draft.pscope=pick(['both','centre','rim']);draft.ink=pick(PALETTE);draft.rim=Math.random()>.35;draft.seed=1+Math.floor(Math.random()*40);confirming=false;paintStudio(true)};
  if($('#sRing')){$('#sRing').oninput=e=>{e.target.value=e.target.value.replace(/[^A-Za-z0-9 ]/g,'');draft.ring=e.target.value;redraw()}}
  $('#closeS').onclick=closeV;
  if(confirming){$('#back2').onclick=()=>{confirming=false;paintStudio(false)};
    $('#doIssue').onclick=()=>{MYSTAMP={...draft};ISSUED='18 Sep 2026';closeV();setTimeout(()=>{paintCard(true);toast('Stamp issued')},250)}}
  else $('#issue').onclick=()=>{const c=draft.code;if(!draft.sym&&!/^[A-Z0-9]{1,3}$/.test(c)){$('#sCode').focus();toast('Add your code: up to 3 letters or numbers');return}confirming=true;paintStudio(false)};
}
/* others' view */
$('#asOthers').onclick=()=>{$('#sheet').innerHTML=`<span class="vtag">HOW OTHERS SEE YOU</span><button class="x" id="closeV" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`+card(false);$('#scrim').classList.add('open');$('#closeV').onclick=closeV};
function closeV(){$('#scrim').classList.remove('open')}
$('#scrim').onclick=e=>{if(e.target.id==='scrim')closeV()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeV()});

/* tabs */
$$('.seg button').forEach(b=>b.onclick=()=>{const t=b.dataset.t;if(t==='app'){toast('Appearance stays as it is');return}
  $$('.seg button').forEach(x=>x.setAttribute('aria-selected',x===b));$('#t-lic').hidden=t!=='lic';$('#t-pref').hidden=t!=='pref';
  $('#pageTitle').textContent=t==='lic'?'Licence':'Preferences'});

/* preferences */
const GREET=[{n:'Wingman',d:"A coworker on the same shift. Notices you're here, never what you scored.",ph:"Skip it. I'll talk anyway."},
 {n:'The Hermit',d:'Says as little as possible. Still notices you showed up.',ph:"Skip it, you may. Talk anyway, I will."}];
let greeter=0;
function paintGreet(){const g=GREET[greeter];$('#gDesc').textContent=g.d;$('#gLab').textContent=`What ${g.n} calls you`;$('#callMe').placeholder=g.ph}
$$('#greet button').forEach(b=>b.onclick=()=>{greeter=+b.dataset.g;$$('#greet button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintGreet()});
$('#callMe').oninput=paintGreet;paintGreet();
const SOC=['Nobody in your way. Study only.','Your squadron and right seat, nothing else.','Everything, including the module chat.'];
$$('#social button').forEach(b=>b.onclick=()=>{$$('#social button').forEach(x=>x.setAttribute('aria-pressed',x===b))});
$('#bar').oninput=e=>{const v=e.target.value;$('#barV').textContent=v+'%';e.target.style.setProperty('--p',((v-75)/25*100)+'%')};$('#bar').style.setProperty('--p','44%');
$('#solo').onclick=e=>{const on=e.currentTarget.getAttribute('aria-checked')!=='true';e.currentTarget.setAttribute('aria-checked',on);toast(on?'Flying solo · nobody sees you':'Back on the radar')};

/* device preview */
if(location.hash==='#frame')document.querySelector('.demo').style.display='none';
function device(w){document.getElementById('devwrap')?.remove();if(!w)return;
  const d=document.createElement('div');d.id='devwrap';d.innerHTML=`<div class="devbar"><b>${w===390?'Phone · 390':'Tablet · 834'}</b><button id="devx">Close</button></div><iframe src="${location.pathname}#frame" style="width:${w}px"></iframe>`;
  document.body.appendChild(d);d.querySelector('#devx').onclick=()=>device(0)}
$('#dTab').onclick=()=>device(834);$('#dPhone').onclick=()=>device(390);
$('#theme').onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark'};
$('#resetStamp').onclick=()=>{MYSTAMP={...DEFAULT_STAMP};ISSUED=null;$('#maker').hidden=true;paintCard();toast('Demo reset: no stamp issued')};
let tt;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2000)}
paintTop();paintCard();
</script>
````
