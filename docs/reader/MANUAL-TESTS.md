# Manual tests — twenty minutes, two people

**One on a laptop, one on an iPad with an Apple Pencil.** Do them in order. Pen
and save integrity are first because they are the two that would ruin a study
session, and because they are the two nothing automated can prove.

Open the paper: **Module 1 → Library → Papers → open the paper**.
Reader rebuild can be turned off at any point: **Profile → Preferences →
Reader rebuild**. That puts the previous reader back with one click and no
deploy.

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

## Anything that goes wrong

Note the step number and what happened. If the reader misbehaves badly, turn off
**Profile → Preferences → Reader rebuild** and carry on with the old one — the
marks are the same rows either way.
