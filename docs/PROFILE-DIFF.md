# Profile — my build vs `wingman-poc.html` §6

Differences only. **Nothing here has been fixed.**

My profile was built from §6's prose while the POC was unavailable, so these are
what prose-derivation cost. The POC wins on all of them.

## 1 · Account menu

| | POC | Mine |
|---|---|---|
| Licence row | **There isn't one.** The account row *is* the Licence link (`data-go="you"`) | A separate "Licence" row below the account row |
| Icons | An SVG on every row | None |
| Separators | Two `<span class="sep">` after the account row | One |
| Admin chip | `Admin`, sentence case | `ADMIN`, uppercase |
| Features row | Not present | I add one for admin (§8 needs a flag surface) |
| Avatar face | A person glyph SVG | Initials, or the photo when set |
| `aria-controls` | `aria-controls="menu"` on the button | Missing |

## 2 · Profile header

The POC has a **`‹ Flight Deck` back button**, and the `h1` is the *current tab's*
name — "Licence", "Preferences", "Appearance". Mine has no back button and a
static "Your licence".

## 3 · Licence panel

| | POC | Mine |
|---|---|---|
| Eyebrow | `Holder` above the ID row | None |
| Admin chip | Right-hand end of the ID row | Inline after the name |
| Name + Username | **Two columns, side by side** | Single column, stacked |
| "What Wingman calls you" | A separate field, `max-width:340px`, **below** the switch | Third in the stack, **above** the switch |
| Its hint | Ends "Leave it empty and you'll only get the lines that don't need a name." | That sentence is missing |
| Go by your username | One `.row`: bold label, live description, switch | A switch row plus a separate paragraph underneath |
| Account rows | Each has a sub-line **and a `.ghost` button** — Change / Update / Sign out | No buttons, no subs on two of three |
| Password sub | "Last changed four months ago" | "Changed from your account provider." |
| Sign out sub | "On this device only" | None |
| Delete link | `Delete account` | `Delete your account` |

## 4 · Preferences

The shape is different, not just the copy. The POC uses **segmented controls**
for both "Who greets you" and "How social" — a name, a description that changes
with the selection, and the control. I built stacked choice cards.

| | POC | Mine |
|---|---|---|
| Voices | Three: Wingman · The Hermit · **Control** | Two — I excluded Control because the old §6.2 said not to offer it without lines |
| Voice sample | Below the control, in quotes, `.anchors` style | Italic, inside the selected card |
| Notice 1 | "Someone answers your question" / "On the frequency you asked in" | "Answers to your questions" / different sub |
| Notice 2 | "Your wingman starts a chapter" / "Only for the module you're both on" | "Your wingman starting a chapter" / different sub |
| Notice 3 | "Nothing flown for a week" / "One nudge. Never more." — **defaults off** | "One inactivity nudge" — defaults on |

## 5 · Appearance

| | POC | Mine |
|---|---|---|
| Night Ops | Eyebrow `Light`; one row — bold "Night Ops", a description that changes ("Dark. The room is lit by the livery."), segmented control on the same row | Eyebrow "Night Ops", control below, static footnote |
| **Swatch gradient** | `at(l,.08,1)` · `at(l,l.midAt,**1.6**)` · `at(l,.92,1)`, stops **34% / 70%** | `.12` · `midAt` at scale **1** · `.88`, stops 33% / 67% |
| Aurora swatch | shadow `oklch(.24 .05 250)` | `oklch(.30 .06 250)` |
| **Specimen** | A real hero card — "Intake & Compressor Basics", "JT.01 · JET TURBINE", "Resume ›" — and a real module card, "PROP" / "Propulsion Systems", with an **actual flight-profile SVG** | Abstract grey bars and a hand-drawn path. No text at all |
| Specimen light | `.specglow` / `.specglow2`, `inset:-40%` | `::before` / `::after`, `inset:-55%` |
| Instrument scale | A row: "Text size" / "Across chapters, discussion and the library" + segmented | Eyebrow + segmented, no row text |
| **Scale values** | `.92` / `1` / `1.13` | `0.9` / `1` / `1.15` |
| Smooth Air sub | "Stops the lights drifting and the cards lifting" | "Stops every animation and transition." |
| Plain Language sub | "A clearer typeface for reading fatigue and dyslexia" | "Swaps to Atkinson Hyperlegible." |
| Turbulence sub | "A small nudge when you move between pages" | "The small nudge on view and tab change." |
| Grain sub | "Fine noise over the light. Off is flatter but smoother." | "The film grain over the light." |
| Reduced-motion note | None | I added one |

## 6 · Naming

The POC's markup grammar is `.block` / `.eyebrow` / `.row` / `.rowtext` / `.seg`
/ `.sw` / `.ghost` / `.field` / `.hint`. Mine is `.pcard` / `.pcard-head` /
`.prow` / `.pseg` / `.sw` / `.pill` / `.pfield` / `.pfield-hint`. Same idea,
different names — but the POC is the specification, so mine are the wrong ones.

## 7 · Outside §6, found while reading

**The runway lights are in the POC** (`.runway`, and the `runway()` function).
Thirteen lamps fixed to the bottom of the viewport, `.bar` at each end, the
current one scaled 2.2× with an emit glow, the last three ahead lit as `.near`,
and the whole strip hidden when the page doesn't scroll. The comment says it
reads "not where you are, but how much runway is left". This is §5.5's missing
piece — it was never in this repo, it was in the POC.

**The POC carries the rotation engine**, which §0 now says to port verbatim.
Mine implements the `.md`'s rules and passes 204,800 draws clean, but that is
not the same claim as being the same engine. Not yet compared.
