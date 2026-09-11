# Manual tests — twenty minutes, two people

**One on a laptop, one on an iPad with an Apple Pencil.** Do them in order. Pen
and save integrity are first because they are the two that would ruin a study
session, and because they are the two nothing automated can prove.

Open the paper: **Module 1 → Library → Papers → open the paper**.
Reader rebuild can be turned off at any point: **Profile → Preferences →
Reader rebuild**. That puts the previous reader back with one click and no
deploy.

---

## v6 — what is new, and what to try first (12 minutes)

The reader was rebuilt again, to the four files you sent whose HANDOVER says
"the chrome is finished, copy it." The sections below still describe v4 and
v5, and the parts about the pen, the anchoring and save integrity still apply
unchanged — the engine did not move. What is new is the chrome, and these are
the things no automated test in this repo can settle.

Everything in the automated list already passes: the marks land on their
words, and they stay there through a resize, a zoom, a rotation and the panel
opening and shutting. Twelve checks, `node tests/reader/only-v6.mjs`. So do
not spend the twelve minutes on those; spend them on the ones below.

**W1 · The island is one thing in every state.** Press the counter for the
page tray, press your initials for the You tray, press Escape, then make a
highlight so a message fires.
→ The counter must sit on **the same pixel** through all of it. HANDOVER calls
it the fixed point of the island: if it shifts when a message fires, a wing
width is wrong. Nothing here centres the island differently to hide that, so
what you see is what the sheet does.

**W2 · Long-press a tool and move it.** Hold a tool on the bar until it lifts,
drag it somewhere else in the bar. Then drag one onto the chest to remove it,
and drag one out of the chest onto the bar. Then hold the grip at the top of
the bar and move the whole bar to all four edges.
→ The panel should swap to the opposite edge every time the bar moves. The
tray, its order and the bar's edge should all still be there after a reload.

**W3 · The fanned deck.** Press the counter, then hover the fan of cards under
"Where you have been".
→ The cards should spread. Holding one should show the line you marked. The
five cards are **your own most recent marks on this paper**, so if you have
made none, the fan is empty — that is correct, not broken.

**W4 · The livery picker changes the app, not just the reader.** Press your
initials, pick a different livery, then leave the reader.
→ The whole site should be wearing it. There is one livery system and it is
the app's; the reader's `--lv` is fed from it. A reader that changed colour
while the Flight Deck did not would mean a second livery system had grown
back.

**W5 · Warmth is the paper's white point, not a film over it.** Press your
initials and drag the warmth slider all the way up.
→ The **paper** should go warm. The text should stay black and the highlights
should stay their own colours. If the whole page including the marks goes
amber, something is filtering the stack instead of shifting the ground.

**W6 · Ask, and what other people see.** Select a passage and press **Ask**.
→ It should post **anonymously**. Then check on the other device: the question
should be there, and it must not say who wrote it. Anonymity is stripped
server-side, so this is not something the other reader is politely hiding —
confirm it by looking at the card, not at the CSS.

**W7 · Red is private, end to end.** Mark something red on one device.
→ It must not appear on the other, at all, in any filter. Red is written with
the `solo` ring, so it is never sent; the panel's filter is a convenience on
top of that, not the mechanism.

**W8 · The Apple Pencil.** Draw with the pen and with the highlighter. Chisel
should give a straight line, free-form should follow your hand. Erase both.
→ Then **zoom to 220% and rotate the page**. The ink should be exactly where
you left it, because strokes live in fractions of the page. This is the one
that costs nothing to get right and is very obvious when it is wrong.

**W9 · The quiet poll.** Leave the reader open on one device. On the other,
make a few marks. Wait a minute.
→ The dot on the island should light. **Nothing on the page may move** until
you press it. Then it should say what arrived. If marks appear under your eyes
without you asking, the poll is doing more than it is allowed to.

**W11 · The tools that mark words.** Arm **Underline**, then drag across a
sentence. Then **Note**, then **Ask**, then add **Strikethrough** from the
chest and try that.
→ Each should mark straight away in its own kind, with **no pill in between**:
with a text tool in your hand the question is already answered. Select with
the plain cursor instead and the pill should still appear, because there it is
not. Tap the note's card to open it, write in it, and it should still say that
after a reload.

**W12 · The eraser.** Draw a few strokes, highlight a few lines, arm the
**Eraser** and rub across them.
→ Strokes and marks should come off as you touch them, and undo should put
them back. Both variants erase whole things today; "Just where you rub" does
not yet shorten a highlight, and that is written down rather than hidden.

**W13 · Nothing on the bar is dead.** Open the chest and look through every
tab.
→ Shape, Text, Measure, Snapshot and Link are **not there**, because they do
not work yet. Everything you can press does something. If you find a control
that does nothing at all, that is the bug this list exists for.

**W10 · Leaving.** Press the Wingman mark in the top-left corner.
→ Back to the Library, and the rest of the app should behave normally: no dead
clicks, no stuck cursor, nothing swallowing the first tap. Everything the
chrome bound to the window is recorded and undone when the reader closes, and
this is the check that it actually was.

---

## v5 — what is new, and what to try first (10 minutes)

The reader was rebuilt again, to the three files you sent whose first line is
"Supersedes v1–v4". Parts 1–8 below still describe v4 and most of them still
apply — the marks, the pen, the quiz and the save integrity are unchanged. The
list here is what is genuinely new, and each one is a thing no automated test
in this repo can settle.

**V1 · Platform, not width.** Open the reader on the iPad, then open it on the
laptop and drag the window narrow — narrower than the iPad's 1194px.
→ The **iPad** should have big targets, no tooltips, and a panel that opens on
a tap. The **narrow laptop window** should keep its small targets and its
tooltips, because it still has a mouse. If the laptop starts behaving like a
tablet, the pointer test is not working.

**V2 · The selection popover.** With no tool armed at all — the arrow, straight
after opening — select any sentence.
→ Five colours plus **Note**, **Ask** and **Copy** appear over the selection.
This is the single most important thing in v5: it is what a reader who has
never looked at the tool bar can do.

**V3 · Note and Ask carry the passage.** From that popover, tap **Note**.
→ A note opens **on the page**, with the sentence you selected already in it as
a quoted excerpt with its page number. You should not have to paste anything.

**V4 · Drag a mark into a note.** Make a couple of highlights. With the arrow,
press on one and drag it onto the note.
→ A small card follows your finger, the note lights up with a ring as you cross
it, and releasing drops the passage in. This is the question-bank workflow:
read, mark, drag the good ones in, and the note is the draft.

**V5 · Notes collapse to pins.** Tap the chevron on a note.
→ It becomes a coloured pill with its title. Drag it somewhere. Reopen it. On a
phone it should be a **bottom sheet**, not a floating window — a draggable
window on a 390px screen is a fight nobody wins.

**V6 · Move the bar.** Tool chest → **Bar position** → Right.
→ The tool bar moves to the right edge and the marks panel and tick rail move
to the **left**. They are always opposite; there is no way to put them on the
same side. Try Top and Bottom too.

**V7 · Variants.** Arm Shape, then open its properties.
→ Line / Arrow / Box / Ellipse across the top. This is how thirteen tools fit
six slots: the seventh thing you need is inside the tool you already picked.
Check the eraser has **Ink only** on by default — rubbing out a stroke must
never eat a highlight.

**V8 · The chrome gets out of the way.** Sit still for three seconds.
→ Everything fades except the **logo**, which never hides. Move, and it comes
back. Start drawing and it should go at once rather than fading.

**V9 · The first-run coach.** Only on a device that has never opened it, or
after clearing site data.
→ Three quiet hints, staggered, then gone forever. If they come back on the
second open, the flag is not being stored.

**And the two the headless browsers still cannot answer:**

**V10 · The glass.** Open the marks panel over the page. The page behind it
should be a soft wash, not readable. Headless WebKit does not composite the
blur, so the iPad screenshots here are unreliable and I cannot tell from this
side whether Safari does the same.

**V11 · The proportions.** Ten seconds of your eyes on the real device: the
colour circles in a tool's properties are **circles**, the tool icons are
**square**, and the bar is a slim column rather than a row of tall slabs.

---

## Read this first — what could NOT be verified without you

Everything in this section was built correctly by construction and is
**unverified on real hardware**. If one of them is wrong, it will be wrong the
moment you touch it, so they are step 1.

| # | What | Why it could not be checked here |
|---|---|---|
| U1 | Apple Pencil pressure changing stroke width | Synthetic pointer events carry a `pressure` value; a real nib carries a curve. The code scales width by `pressure` and falls back to a fixed width when it reports 0. |
| U2 | Palm rejection with a real hand | Tested with synthetic broad-contact touch events. A real palm is many contacts, arriving in an order no test reproduces. |
| U3 | Pencil hover (recent iPads) | WebKit-under-Playwright reports no hover. The mark card is bound to tap **as well as** hover for exactly this reason — that part is tested. |
| U4 | Real iOS Safari | The harness runs WebKit, which is not Safari. Passes there are necessary and not sufficient. |
| ~~U5~~ | ~~A 40–200MB paper~~ | **Now verified.** The real 44MB / 1012-page manual opens in about 3 seconds locally and 6 on a cold production load, fetching 0.5–1.1MB across 9–19 ranged requests instead of the whole file. What is still unverified is how that feels on an iPad over a phone connection. |
| U6 | `backdrop-filter` performance on an older iPad | The blur drops from 30px to 18px on a coarse pointer. Whether that is enough is a question for the device. |
| U7 | IndexedDB eviction in private browsing | The offline queue degrades rather than throwing, by construction. |

---

## Part 1 — the pen (iPad, 6 minutes)

**1.1 A finger must never draw.**
Tap the **pen** in the dock. Now scroll the paper with one finger, and pinch to
zoom with two.
→ The paper moves and zooms. **No line appears.** If a finger draws, stop and
tell me — everything after this is unusable.

**1.2 The pen draws.**
With the pen still selected, draw a line across a paragraph with the Pencil.
→ A line appears under your nib, following it without lag.

**1.3 Pressure.**
Draw one stroke pressing lightly, then one pressing hard.
→ The second is visibly thicker. *(U1 — unverified here.)*

**1.4 A resting palm.**
Rest your hand on the page and write a short word with the Pencil.
→ Only the word appears. Nothing where your hand was. *(U2)*

**1.5 The eraser takes whole strokes.**
Tap the eraser, touch one of your lines.
→ The whole line goes, not a hole in it. It does **not** remove highlights.

**1.6 Undo has a button.**
With no keyboard attached, tap **undo** at the bottom left. Then **redo**.
→ Your last stroke goes and comes back. Do this five times in a row — it should
reach every one of them, not just the last.

---

## Part 2 — marks are never lost (both, 5 minutes)

**2.1 It saves on creation.**
Highlight a line in amber (**Exam likely**). Count your marks.

**2.2 Kill the tab.**
Close the tab outright — do not use Back. Reopen the paper.
→ Every mark is there, and it opens on the page you were on.

**2.3 Go offline.**
Turn off wifi. Make **five** marks. Reload the page while still offline.
→ The marks are still on screen.

**2.4 Come back.**
Turn wifi on. Wait ten seconds.
→ All five are there, **exactly once**. No duplicates. If any are missing or
doubled, note which and tell me.

**2.5 Two people, one paper.**
Both open the same paper. One marks a line. The other presses **refresh** in the
top bar.
→ The new mark arrives and says so. The reader does **not** scroll.

---

## Part 3 — the document always draws (both, 3 minutes)

**3.1 End to end.** Scroll from the first page to the last at Fit width.
→ **No blank page at any point.** A page not yet drawn shows a page-shaped card
with its number, never an empty white rectangle.

**3.2 At 200%.** Set 200% from the zoom menu and scroll the same way.
→ Same answer.

**3.3 Zoom holds its place.** Put a paragraph under your finger and pinch to
zoom in, ten times.
→ That paragraph stays under your finger.

**3.4 Turn the iPad.** Rotate to portrait and back.
→ The layout changes; no panel ever sits beside the page; the bottom bar clears
the home indicator.

---

## Part 4 — the colours do things (both, 3 minutes)

**4.1** Highlight in each of the five colours in turn. The tray states what each
one does before you use it, and the mark card states it again afterwards.

**4.2 Ask.** Mark a passage in **violet (Ask)** and write a question.
→ A thread opens in the Ready Room, quoting the passage. **Your name is not on
it.** The mark is hollow while the thread is open.

**4.3 The round trip.** Open that thread in the Ready Room and use its link back.
→ It opens the paper at that passage.

**4.4 The other student's view.** The second person refreshes.
→ They see the question. They see **"Asked anonymously"**, not your name.

---

## Part 5 — the tray (both, 2 minutes)

**5.1** Tap **+**. Add **Underline**. It lands next to Highlight.
**5.2** Long-press the dock.
→ The tools jiggle and each removable one gets an ✕. **iOS must not raise its
own copy/paste menu.** If it does, tell me. Select has no ✕.
**5.3** Remove two tools, drag one to reorder, tap **Done**.
**5.4** Tap **+** → **Reset to the course default**. Six tools come back.
**5.5** The laptop's tray and the iPad's tray are **different** and stay that way.

---

## Part 6 — the quiz (laptop, 2 minutes)

**6.1** Module 1 → a chapter → its quiz → **Start**.
**6.2** Answer three, flag one, skip one. Nothing is marked yet — no colour, no
score, no feedback of any kind.
**6.3** Leave the quiz. Come back.
→ Your answers are there, **in the same order they were in**, with the same one
still flagged.
**6.4 Hand it in.** It names what is still blank and what you flagged, and does
not ask if you are sure.
**6.5 Go through the paper.** Every one you missed, with what you said, what was
right, and the way back to the lesson.

---

## Part 7 — uploading the real manual (whoever has the file)

**The setup is already done** — the `papers` table and its storage bucket exist
and are empty, verified by querying them. You can go straight to adding the
paper.

**Ideally, first:**

```
npm run paper:linearize -- ~/path/to/manual.pdf
```

Ten seconds, needs `qpdf` (`brew install qpdf`). It lets the reader jump
straight to page one instead of fetching the end of the file first. If qpdf is
not installed the paper still works — the reader records which state it is in
and shows it under **Document details**.

**Then:** Module 1 → Library → Papers → **Add a paper** → choose the file →
pick who else can see it.

Your manual is **1012 pages and 44MB**, so: the file goes up first with a real
progress bar, and the text layer takes a few minutes after that. It is not
linearized, so run the command above if you can — it is worth the ten seconds on
a file this size.

→ It builds the manifest, the text layer and the thumbnails from your copy
before sending anything. A long manual takes a minute and shows what it is
doing. While it finishes, the paper shows **Preparing…** in the Library rather
than an empty viewer.

**Watch for:** the first page appearing in under a second once it is ready, and
the pages laying out at the right height immediately. If the paper turns out to
be scanned images with no text layer, highlighting will be unavailable on it and
it will say so — that is honest, not broken.

---

## Part 8 — the two things a browser here cannot answer (both, 2 minutes)

Everything else in this script is checked automatically as well. These two are
not, because the headless browsers lie about them.

**8.1 The glass.** Open the marks panel with the paper behind it. Every floating
surface is 82% opaque over a 30px backdrop blur, and the blur is doing most of
the work — without it the panel is a list of sentences printed over another list
of sentences. Headless WebKit does not composite the blur, so the iPad
screenshots show it see-through and I cannot tell from here whether Safari does
the same. → **The page behind the panel should be a soft wash, not readable.**
There is a fallback for browsers that report no support at all; this is about
one that reports support and then does not paint it.

**8.2 The proportions, on the device.** These were all wrong until this pass,
all from one global rule stretching every control in the reader, and all fixed
by measuring rather than looking. Worth ten seconds of your eyes on the real
thing: → the colour swatches in the tool inspector are **circles**, not ovals.
→ the dock's tools are **square**. → the panel's Marks/Pages/Contents strip is a
slim segmented control, not three tall slabs. → on the iPad, the bottom bar is
**one line**: "25 / 1012" and "Fit width" must not wrap.

---

## Anything that goes wrong

Note the step number and what happened. If the reader misbehaves badly, turn off
**Profile → Preferences → Reader rebuild** and carry on with the old one — the
marks are the same rows either way.
