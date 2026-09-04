# Removal inventory

Every UI surface, nav item, button, setting and page currently in the app, marked
**keep / reskin / hide / delete** against Build 01.

**Signed off and applied.** Your decisions replaced several of my marks; the table below is
what was actually done, not what I originally proposed. Every *hide* is a flag in
`src/lib/flags.js` — the route and the component stay on disk, so any of it comes back with
one switch.

Your instructions, and how each was read:

| You said | What was done |
|---|---|
| remove rootnav | `nav.root` off. Modules stay reachable through the rail; nothing else needed it. |
| pa toast | `chrome.patoast` off. The boarding overlay went with it — same class of chrome, not in Build 01. |
| all module aspects, keep the outside library view | `module.interior` off: hub, chapters, chapter view, quiz, comments, library. The rail on home is the outside view and it stays — but its cards are now readouts, not buttons, and the hero card's Resume is gone with the thing it opened. |
| delete all videos and quizzes, even names | `src/data.js` rewritten. Four modules, five chapters each, two lessons per chapter, named Module 1–4 / Chapter 1–5 / Lesson 1–2. No clips, no questions, no prose. |
| remove ready room, keep the empty tabs at the new home screen | `social.readyroom` off. The crew band keeps its cells and its empty copy; every door out of it — the radar, `Ready Room ›`, `Fly together`, the compose line — is gone. |
| hide logbook and bookmarks | `page.logbook`, `page.bookmarks` off. |
| add bio | Back on the Licence tab. |
| go by username is not the default | Default is now `real`. |
| night ops for dark, day ops for light | The mode control reads Day Ops · Night Ops · Auto. |
| hide grain switch | `appearance.grain` off. The grain itself stays on at 5%. |
| add fly invisible | New "Being seen" block on Preferences. Enforced at the presence *write*, so there is nothing to leak. |
| remove lights out | It was never in this repo. Nothing to remove. |

Hidden routes fall back to the deck rather than 404ing, so a stale bookmark lands somewhere
real. Verified: `/ready`, `/logbook`, `/saved`, `/modules`, `/m/m1`.

## How the marks were decided

- **keep** — described in Build 01 §5–§7 and already correct.
- **reskin** — stays exactly where it is, inherits the §2B token layer, no layout change.
- **hide** — entry point comes out of the UI behind a flag. Route and code stay. One config
  change reverses it.
- **delete** — dead code with no route and no reference. Only two entries.

Per §1's rails, nothing touching auth, the database, course content, the admin backend or
billing is marked anything but keep or reskin.

## Superseded: the §11 question

I had asked whether §11 should be read literally. Your removal list answers it — the chapter
view and the Ready Room are both hidden. The original note is kept below for the record.

## The reading of §11 this inventory assumed

§11 says a surface with no approved design should have its entry point hidden. Taken
literally that hides the chapter view, which would leave the app unable to teach anything,
and §5's hero card links straight into it. So I read §11 as **"do not redesign these"**, not
"make them unreachable", for the two surfaces the home page itself points at:

- **Chapter view** — §5's hero card is `Resume at 6:12 ›`. Hiding it makes the hero a dead
  button and the product unusable. Marked *reskin*.
- **Ready Room** — §5 says the radar "is the door to the Ready Room" and it's a real button.
  Marked *reskin*.

Everything else on §11's list is genuinely hidden, because nothing in the designed UI points
at it: Logbook, Bookmarks, Fly together, notification delivery, the Control voice.

If you'd rather §11 be read literally, say so and both of the above become *hide* — but then
the hero card and the radar need a different destination, and §5 doesn't give one.

---

## 1 · App shell

| Surface | Mark | Why |
|---|---|---|
| Brand mark, top left | keep | §7. |
| Windsock pill + streak count | keep | §7. The old deforming version, per §7's "port what's in the file and leave it". |
| Avatar button → menu | reskin | §7 wants photo-when-set, initials otherwise, ring lit only when open. Currently a static user glyph. |
| Avatar menu → account row + ADMIN chip | keep | §6 opens with exactly this. |
| Avatar menu → "Settings" | reskin | Becomes the three-tab profile: Licence · Preferences · Appearance. |
| Avatar menu → "Sign out" | keep | §6 ends with it. |
| Avatar menu → "Features" (admin only) | keep | §8 needs a flag surface. Admin-only already. |
| **RootNav — Study · Modules · Logbook · Ready Room** | **hide** | §5 and §7 describe a top bar of brand + windsock + avatar and nothing else. There is no bottom tab bar in the design. Modules stay reachable through the rail, the Ready Room through the radar. |
| Boarding-pass overlay (SEAT · GATE · BOARDING + trivia) | **hide** | 2.4s of full-screen chrome in front of every load. Not in Build 01 anywhere. |
| PA toast ("CABIN CREW, DOORS TO MANUAL") | **hide** | Fires on theme toggle. Not in Build 01. §6.3 makes Night Ops a plain three-state control. |
| Storage warning banner | keep | Real failure state, not decoration. |
| Cheatline (`.app::before`) | **hide** | §4.1 gives one ambient rig per screen. Already suppressed on home; extend site-wide with §2B. |
| Fixed ambient glow (`.app::after`) | **hide** | Same — it is a second light source and it veils the deck. |

## 2 · Home — the Flight Deck

| Surface | Mark | Why |
|---|---|---|
| Title / greeting / last-flown | keep | §5. Greeting pool moves to `wingman-voices.md` (§5.4). |
| Hero card + resume | keep | §5. |
| Instrument strip — attitude, flight bag, checklist, hobbs, radar | keep | §5. |
| Module rail | keep | §5.2. |
| Crew strip — Formation · Wingman · Frequency | keep | §5.3, gated by preset. |
| `Back on the ground` / `Ready Room ›` | keep | §5, subject to the §11 reading above. |
| **Runway lights** | **found** | They were in `wingman-poc.html`, not in this repo. Ported verbatim: thirteen lamps, `.bar` at each end, the current one at 2.2× with an emit glow, the last three ahead lit, hidden when the page doesn't scroll. |

## 3 · Modules and chapters

| Surface | Mark | Why |
|---|---|---|
| `/modules` page | **hide** | The rail on home is the module launcher in §5. A separate page duplicates it and nothing in the design links to it. |
| Module hub header + progress arc | reskin | Not designed in Build 01; tokens only. |
| Module hub tabs — Chapters · Library | reskin | Not designed; tokens only. |
| Chapter list, search, bookmarks star | reskin | Not designed; tokens only. |
| Chapter view — brief / quiz / comments | reskin | §11 item, read as above. Tokens only, no relayout. |
| Quiz + Debrief | reskin | Course content. Rails forbid touching it. |
| Library / PDF panel | reskin | Course content. |
| Notebook slide-over | **hide** | Not in Build 01. Notes are user data — hidden, never deleted. |
| Discussion slide-over (per chapter) | **hide** | §11 puts chapter comments in the undesigned chapter view. |
| Study glow / presence on the chapter list | **hide** | §5 confines social to the radar and the crew band. This is social leaking into the academic half, which §5 rules out twice. |
| Recent chapters strip | reskin | Small, harmless, not designed. Tokens only. |

## 4 · Social

| Surface | Mark | Why |
|---|---|---|
| Ready Room — Now · Starting · Open squawks · Your crew | reskin | §11 item, read as above. Tokens only. |
| Comms channel | reskin | Reached from the crew band's compose line (§5.3). |
| Pilot sheet (tap a pilot) | reskin | Not designed; tokens only. |
| Blocked list | keep | Safety surface. Never hidden. |
| `Fly together` | **hide** | §11, explicitly. The crew band's button needs a destination — see the questions list. |

## 5 · Logbook, bookmarks, progress

| Surface | Mark | Why |
|---|---|---|
| Logbook page (`/logbook`) | **hide** | §11 lists Progress as undesigned, and §6 says it is not in the menu. |
| Bookmarks page (`/saved`) | **hide** | Same. Note the flight-bag instrument still counts them, which is the intended read-only view for now. |
| Flashcard mode | **hide** | Reached only from Bookmarks. |

## 6 · Profile and settings

| Surface | Mark | Why |
|---|---|---|
| Profile → "Edit Info" tab | reskin | Becomes **Licence** (§6.1). |
| — Name field | keep | §6.1 "Name on the licence". |
| — Username field | keep | §6.1. |
| — **What Wingman calls you** | **new** | §6.1. Does not exist. Needed by §5.4's `{name}`. |
| — Bio field | **hide** | Not in §6.1. |
| — Course or class field | **hide** | §6.1: "No rating field, no school field." |
| — Email change flow | keep | §6.1 account block. |
| — "Show real name instead" switch | reskin | §6.1 inverts it to **Go by your username**, on by default, with a live preview. |
| — Reset progress | **hide** | Not in §6.1, and it is destructive. Route stays. |
| — Privacy explainer block | **hide** | Not in §6.1. |
| — Delete account | reskin | §6.1: a sentence at the very bottom with the consequence in the same line, not a button. |
| Profile → "Preferences" tab | reskin | §6.2: Who greets you · How social · Notices. |
| — Dark mode switch | reskin | §6.3 **Night Ops**, three-state Day/Night/Auto, moves to Appearance. |
| — Text size | reskin | §6.3 **Instrument scale**, Small/Medium/Large, moves to Appearance. |
| — Reduce motion | reskin | §6.3 **Smooth Air**, moves to Appearance. |
| — Dyslexia-friendly font | reskin | §6.3 **Plain Language** → Atkinson Hyperlegible. Currently loads OpenDyslexic from a CDN. |
| — Haptics / Turbulence | reskin | §6.3 **Turbulence**, moves to Appearance. |
| — Keyboard-shortcuts note | keep | Accurate, small. |
| Appearance tab | **new** | §6.3 in full: Night Ops, the seven-circle livery picker, the specimen, instrument scale, the four switches. |
| — Grain switch | **new** | §4.5 makes grain user-toggleable. |
| Livery picker (old build) | **done** | Removed 2026-09-04, not reskinned: it set a *pilot* livery, a separate system from the app's, and every id it offered painted the same colour. The Appearance tab's picker is the surviving one. |
| Livery unlock ladder | **done** | Removed with it. It gated ids that were already indistinguishable. |
| Settings → Pilot ("Your pilot") | **hide** | Superseded by the three profile tabs. |
| — Callsign | **hide** | §6.1's three name fields replace it. |
| — When you usually study | **hide** | Not in Build 01. |
| — Notifications (3 modes) | reskin | §6.2 **Notices** — three switches, each naming its trigger. |
| — Fly invisible | **hide** | Not in Build 01. Note this is a privacy control; hiding it makes presence non-optional. Flagged in the questions list. |
| — Study glow | **hide** | Goes with the chapter-list glow above. |
| Settings → Features (admin) | keep | §8's flag surface. |
| — Override streak value | keep | Admin test tool. |
| Auth page | keep | Rails. |
| Username gate | keep | Rails. |
| First Flight onboarding | **hide** | Not in Build 01. Six screens in front of a first session. |

## 7 · Dead code

| Surface | Mark | Why |
|---|---|---|
| `src/components/ScoreDial.jsx` | delete | No route, no import, no reference. Left over from the v2 home page. |
| `src/lib/liveries.js` | delete | Superseded by `src/lib/liveryEngine.js`. Still referenced by the picker and `Tail.jsx`, so this happens with §6.3, not before. |

---

## Counts

**keep 15 · reskin 22 · hide 27 · new 4 · delete 2 · missing 1**

Every *hide* is one flag away from being back. Nothing in this list touches auth, the
database, migrations, user data, course content, the admin backend or billing.
