# Wingman — papers reader

Four files. Three are the reader itself and are copied **verbatim**. This one tells you
what to wire behind them.

```
reader.css    the whole stylesheet
reader.html   the DOM
reader.js     WM · island · tool bar · panel
HANDOVER.md   this
```

Dropping the three files into a page gives you the working reader on stand-in paper.
Confirmed: 16 marks seeded onto the text, 17 mark boxes drawn, 16 cards in the panel,
6 tools on the bar, no console errors. Your job is to swap the stand-in paper for the
real PDF and the stand-in data for the real data, and to change nothing else.

---

## The one rule

**The chrome is finished. Copy it.**

Do not restyle it to match the rest of the site, do not substitute the site's existing
button or panel components, do not "tidy" the CSS, do not re-order the DOM, do not
rename a class. Every size, timing and easing in `reader.css` was set against the
others. If something looks wrong after integration, the cause is a style leaking in
from the host page, not a value that needs adjusting — scope the reader's CSS instead
of editing it.

The only value you are meant to change is `--lv`, the livery accent, which should be
fed from whichever livery the student has chosen. Everything else in the reader tints
itself from that one variable.

---

## What replaces what

### 1. The paper

`#stage` currently holds ten `<article class="sheetpg">` elements built by
`STAGE.innerHTML = PAGES.map(...)` in part 3 of `reader.js`. That is the only piece of
fake content. Replace it with PDF.js page rendering.

Every page element you render **must** keep this shape:

```html
<article class="sheetpg" data-pg="126">
  <span class="bmk"></span>                                    <!-- bookmark ribbon -->
  <svg class="ink" viewBox="0 0 1000 1000" preserveAspectRatio="none"></svg>
  <span class="marks"></span>                                  <!-- mark boxes -->
  <canvas>…</canvas>                                           <!-- PDF.js render -->
  <div class="textLayer">…</div>                               <!-- PDF.js text layer -->
  <span class="pgno">0126</span>
</article>
```

- `data-pg` is the **absolute** page number in the document, not the index.
- `.marks` sits at `z-index:1`, the text at `z-index:2`, `.ink` at `z-index:3`.
  The PDF.js text layer takes the place of the `<p>` elements, so give it `z-index:2`.
  Text above marks is what keeps the words crisp under a highlight.
- The page must be a positioning context. `.sheetpg` already is.

Everything else about page delivery — range requests, `disableAutoFetch`, linearized
files, the page window, never-blank placeholders, progressive re-raster — is unchanged
from the earlier brief and is not affected by these files.

### 2. The marks

`SEED[]` in part 3 is a hard-coded list of the class's marks. Replace it with the
module's marks fetched from the server. The shape each mark needs:

```js
{
  id, g,          // g groups the boxes of one mark; use the server id for both
  pg,             // absolute page number
  k,              // 'y' | 'b' | 'g' | 'p' | 'r'   the meaning
  kind,           // 'hl' | 'ul' | 'ask'
  who,            // author id, or 'anon' for questions
  t,              // 'yesterday' — render server-side or format on arrival
  tx,             // the quoted passage
  ask, ans,       // questions only: the question text and its answers
  fresh           // true if it arrived since this student last pulled
}
```

Push each one through `WM.add(mark)` and the island, the panel and the page all update
themselves. `WM.drop(id)` removes one everywhere. `WM.on(fn)` subscribes.

### 3. Anchoring — the part that is not done

`seed()` finds a mark's passage by searching the page's text for the quote, then lays
one box per line of the resulting Range. That is the right rendering approach and it is
what `stamp()` does for new marks too. **It is not a storage format.**

On the live site a mark must be stored as:

```
{ page, startOffset, endOffset, quote, prefix, suffix }
```

— character offsets into the page's extracted text, with the quote and a short
prefix/suffix as the fallback if the offsets miss. **Never store x/y coordinates.**

And the boxes must be **re-laid on every layout change**: window resize, zoom, fit
change, rotation, sidebar open/close, device rotation. Today they are placed once at
load, so any of those leaves them stranded. Write one `relayout()` that walks
`WM.marks`, resolves each anchor to a Range against the current text layer, and rebuilds
its boxes — then call it from a `ResizeObserver` on `#stage` and from the zoom, fit and
rotate handlers in the island's page tray.

Ink strokes are already stored in normalised page coordinates (the `.ink` SVG is a
`0 0 1000 1000` viewBox stretched to the page), so those survive resize for free. Keep
that.

### 4. What has to actually work

Everything the demo mimes needs a real implementation behind it. In rough order of how
much a student will notice it missing:

| In the demo | On the live site |
|---|---|
| Marks vanish on reload | Every mark, note, question and ink stroke persists per student per paper |
| `SEED` is hard-coded | Class marks fetched on open. **Manual refresh is the model — there is no live editing.** A quiet background check runs about once a minute and its only permitted effect is to light the island's dot. The page changes when the student presses the dot, and never on its own |
| Questions have canned answers | A question posts anonymously to the module thread and its answers come back from there. **Anonymity is enforced by stripping the author id server-side, never by hiding it in CSS** |
| The reply box does nothing | Posting an answer writes to the same thread the Ready Room shows |
| Red marks are filtered in JS | Red marks are private end to end — never sent to other students, never counted in class heat |
| The bar's contents reset | The tray, its order, each tool's colour, size, opacity and presets persist per student |
| Bookmarks reset | Bookmarks persist per student per paper |
| Warmth and livery reset | Persist per student, across papers and devices |
| Undo says a word | Real undo/redo stack over marks and ink |
| Nothing is exported | A student can pull their marks out of a paper — at minimum their revision deck |

### 5. Remove before shipping

- The demo strip: `.demoBtn` and `.demo` in the markup, their CSS block, and the
  listener at the end of part 2 of `reader.js`.
- `window.setBarAutoHide` and the auto-hide toggle it serves. Keep the auto-hide
  *behaviour* — the bar retracting on desktop and being permanent on touch — that is
  real. Only the toggle is demo furniture.
- `SEED[]` and `seed()` once real marks are fetched. Keep `findRange()`; the anchoring
  fallback needs it.

---

## Making it feel smooth

These are not optional polish. They are the difference between a reader that feels
like an app and one that feels like a web page. Build them in from the start — each
one is much harder to retrofit.

**Render a window, not a document.** Rasterise the page in view plus two either side.
Every other page is an empty box at exactly the right height so nothing ever jumps
when it fills in. Discard canvases outside the window; on a 2000-page manual, keeping
them is what runs an iPad out of memory.

**Never show a blank page.** When zoom or fit changes, keep the existing raster
stretched to the new size while the sharp one renders behind it, then swap. A student
should never see white where words were.

**Cap and cancel.** At most two PDF.js render tasks in flight. If a page scrolls out
of the window before its render finishes, cancel it. Fast scrolling should not queue
up forty renders that all land at once.

**Fetch marks by page window, never by document.** Ask for the marks on the pages you
are about to show, plus a count per page for the panel and the page selector. One
popular paper will have thousands of marks and you must never load them all.

**Only lay out marks you can see.** Anchoring a mark to its words costs a Range
resolution and a set of boxes. Do it for visible pages only, and redo it on resize
inside a single requestAnimationFrame — never on every resize event.

**Do no work in a scroll handler.** Read the scroll position, store it, and act on the
next animation frame. The counter roll, the page window and the panel's current-page
ring all come off that one frame.

**Ink is already free.** Strokes live in a 0–1000 viewBox stretched to the page, so
they survive resize and zoom with no work at all. Keep it that way and do not move
ink onto a canvas.

**Check for new marks quietly, apply them loudly.** Poll roughly every minute. The
only thing a poll may do is light the island's dot — never touch the page, never
re-sort the panel, never move anything under the student's eyes. When they press the
dot, build the new marks off-screen and put them in on one frame, then say what
arrived. Movement only ever happens because the student asked for it.

**Settings save locally first.** Tray order, colours, sizes, presets, bookmarks,
warmth, livery — write to local storage immediately and sync in the background.
Nothing the student touches should ever wait on the network.

**Prefetch while idle.** When nothing is happening, pull the byte range for the next
page. It costs nothing and removes the pause when they scroll on.

---

## Things that will look like bugs and are not

**The mark boxes are separate `<span>`s, not a wrapper around the text.** One box per
line of the selection. This is deliberate: a wrapping span cannot cross paragraph or
element boundaries, mangles the DOM, and fights the PDF.js text layer. Do not
"simplify" it.

**`.mkq` is `pointer-events:none`.** Taps on a mark are hit-tested by hand in
`markAt()`, because the text has to sit above the marks. Keep it that way.

**A panel card is a `<div role="button">`, not a `<button>`.** It contains the reply
input. Nested buttons get hoisted out by the browser and the Send button escapes the
card.

**The Select tool's icon changes.** Arrow pointer on the Cursor variant, hand on Grab.
That is `paintRail()` choosing the glyph, not a bug.

**Only the Select tool selects text.** Pen, marker and highlighter draw and never touch
the words. `mode()` sets `data-sel` and `data-draw` on the root and the CSS follows.

**The counter is the fixed point of the island.** It sits on the same pixel in every
state. If it shifts when a message fires, a wing width is wrong — do not "centre" the
island differently, fix the wing.

---

## Testing

The reader is used on a laptop and an iPad, so test on both, with touch on. Not three
widths — three platforms. `matchMedia('(pointer:coarse)')` is what decides.

Work through, on each:

1. Every tool: pick it, open its properties, change variant, colour, size, opacity, save
   and load a preset.
2. Draw with pen and highlighter. Chisel gives a straight line, free-form follows your
   hand. Erase both.
3. Select text with the cursor. Highlight, underline, ask. Check the box lands on the
   words and nowhere else.
4. Tap an existing mark. Recolour it, convert it, delete it.
5. Long-press a tool and reorder it. Drag one onto the chest to remove it. Drag one out
   of the chest onto the bar. Hold the grip and move the bar to all four edges.
6. Every island state, the page tray, the fanned deck, the bookmark, the You panel,
   the warmth slider, the livery picker.
7. The panel: search text, search a name, every filter, questions opening, the page
   selector, collapsing to the tab, and the side swapping when the bar moves.
8. **Then resize the window, zoom in and out, rotate a page, and open and close the
   panel — and confirm every mark is still exactly on its words.** This is the test
   that will fail first.
9. Reload. Everything you did is still there.

---

## Content

Empty the papers section of every module except Module 1. Module 1 stays as it is —
it is the testing bed — but empty its papers too, and put the real Lufthansa Technical
Training PDF there when it is supplied. No example papers anywhere.
