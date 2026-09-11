# Reader components — v5

Supersedes v1–v4. **Copy `reader.css` verbatim, copy the `icon()` function from the reference build verbatim, build this DOM.** Rewrite only state, data and events.

## What changed in v5

| | |
|---|---|
| Tool variants | Every tool carries its basic versions in a segmented strip at the top of its properties. One bar entry covers Line / Arrow / Box / Ellipse. |
| Recent colours | **Removed.** Five colours don't need a recents row — it was clutter. |
| Selection popover | Select any text and the five colours plus Note / Ask / Copy appear over it. The single most intuitive thing a reader can do. |
| Drag a mark into a note | Pick up a highlight with Select, drop it on a note, and it lands as a quoted excerpt with its page number. |
| Marks-only view | Back from v1. Every marked passage, grouped by meaning, one tap from any of them back to the page. |
| Scrubber card | Back from v1. Dragging the bottom edge shows a thumbnail and "3 marks near here". |
| Back pill | Back from v1. After any jump, one control returns you to where you were reading. |
| First-run coach | Three quiet hints on first open, gone forever after. |
| Platform | Three real layouts, chosen by pointer capability, not width alone. |

## Platform — the important part

```js
const coarse = matchMedia('(pointer:coarse)').matches || !matchMedia('(hover:hover)').matches;
const plat = w < 680 ? 'phone' : (coarse || w < 1100) ? 'tablet' : 'desktop';
```

A 1024px browser window on a Mac is **desktop**. A 1024px iPad is **tablet**. Width alone gets that wrong, and it's why so many web readers feel wrong on an iPad.

**Desktop** — 32px targets, tooltips on everything, hover opens the panel, hover opens the mark card, bar defaults left.

**Tablet** — 46px targets, **no tooltips at all** (there's no hover to reveal them, so they only ever flash on tap), wider popovers, 30px colour swatches, taller scrubber, wider notes with bigger type. The panel opens on tap or an edge swipe.

**Phone** — a different layout, not a squeezed one:
- The tool bar becomes a **full-width bottom dock**, edge to edge, no radius, respecting the home indicator. It slides down rather than fading when the chrome hides.
- Every popover — properties, tool chest, panel — becomes a **bottom sheet** with a 20px top radius.
- Notes are **fixed bottom sheets**, not floating cards. A draggable window on a 390px screen is a fight nobody wins.
- The mark card and selection popover pin above the dock, full width.
- The logo drops to its glyph; the document name shrinks; the rail, the zoom capsule and the chest are hidden. Pinch does the zooming.

All three come from `data-plat` on the root. No JS branching for layout beyond setting that attribute.

## Tool variants

```js
{id:'shp', n:'Shape',   v:['Line','Arrow','Box','Ellipse']},
{id:'pen', n:'Pen',     v:['Pen','Pencil','Fountain']},
{id:'era', n:'Eraser',  v:['Whole stroke','Area']},
{id:'hl',  n:'Highlight', v:['Text','Free-form']},
{id:'ul',  n:'Underline', v:['Straight','Squiggly']},
{id:'txt', n:'Text',    v:['Text box','Callout']},
{id:'msr', n:'Measure', v:['Distance','Area']},
{id:'note',n:'Note',    v:['Anywhere','On a passage']},
```

Rendered as the first thing in the properties popover:

```html
<div class="segs">
  <button class="on" data-v="0">Line</button>
  <button data-v="1">Arrow</button>
  <button data-v="2">Box</button>
  <button data-v="3">Ellipse</button>
</div>
```

This is what lets the bar stay at six tools while the app has thirteen. A student sees six things, not thirteen — and the seventh thing they need is one tap inside the tool they already picked, which is where they'd look for it.

The eraser also gets an **Ink only** toggle below its variants (`.toggle` + `.sw2`), on by default, so erasing a stroke never eats a highlight.

## Selection popover

```html
<div class="chrome glass pop selpop open">
  <div class="swatches">
    <button class="c" data-k="y" style="--k:#F5C23C"><i></i></button>
    … five …
  </div>
  <span class="div"></span>
  <button data-a="note">{note icon} Note</button>
  <button data-a="ask" class="courseonly">{ask icon} Ask</button>
  <button data-a="copy">Copy</button>
</div>
```

Appears on `mouseup` when a selection sits inside a page and is longer than three characters; hides on `selectionchange` when the selection collapses. Colour marks the sentence. Note and Ask create a widget **with the selected text already in it as an excerpt** — the passage is the reason you're writing the note, so it should already be there.

On phone it pins above the dock, full width.

## Drag a mark into a note

The one that makes people sit up.

1. `pointerdown` on a marked sentence with the Select tool arms it.
2. 8px of movement starts a drag: a `.ghost` follows the pointer showing the quoted text.
3. Any `.note` or `.pin` under the pointer gets `.drop` — a 2.5px accent ring.
4. Release over one and the passage is appended as `{text, page}` to that note's `exc` array, the note opens, and a toast confirms.

```html
<div class="exc">The pilot sets this force with collective pitch.
  <em>p.129</em>
  <button data-xrm="0" aria-label="Remove excerpt">{×}</button>
</div>
```

For someone building question banks this is the whole workflow: read, mark, drag the good ones into a note, and the note is the draft.

## Marks-only view

`data-mode="rev"` on the root hides the stage, rail, tool bar, properties and scrubber, and shows `.rev`.

```html
<div class="rev"><div class="revw">
  <div class="revh">
    <div><h2>Marks only</h2><p>28 passages across 14 pages.</p></div>
    <button class="ic" aria-label="Back to the paper">{×}</button>
  </div>
  <div class="revf">
    <button class="f on" data-k="all">Everything</button>
    <button class="f" data-k="y">Exam likely <span style="color:#F5C23C">9</span></button>
  </div>
  <div class="rgrp">
    <div class="rgh" style="--k:#F5C23C"><i></i><b>Exam likely</b><em>9 passages</em></div>
    <div class="rcard" data-id="…" data-p="203" style="--k:#F5C23C">
      <div class="st"></div><p>Retreating blade stall is first felt as…</p><span class="pg">p.203</span>
    </div>
  </div>
</div></div>
```

Clicking a card leaves the view, jumps to the passage, and raises the back pill.

## Scrubber card and back pill

```html
<div class="glass pop scard open" style="left:40.7%">
  <div class="th2"><i class="h"></i><i></i><i></i><i></i><i class="m"></i>…</div>
  <div class="mt"><b>412</b><span>of 1012</span><u>3 marks near here</u></div>
</div>

<div class="chrome glass pop backp open">
  <b>Back to page 129</b><button class="ic">{arrow}</button>
</div>
```

The card appears while dragging the bottom edge and its thumbnail marks the line where nearby marks sit, in their colour. The back pill appears after **any** jump — from the panel, the rail, or the marks-only view — and returns both scroll position and page.

## First-run coach

Three `.glass.pop.coach` cards, staggered 500ms apart, pointing at the three things that aren't discoverable: the tool chest, the rail that opens the panel, and the bottom edge that scrubs. Dismissed by the button or after fourteen seconds, and `coached` is stored so it never returns.

This is the difference between awe and intimidation. The app is deep; the first thirty seconds must not be.

## Everything else

Logo corner, movable bar, opposite-side panel, filled colour icons, note widgets, mark card, tick rail, colour system and the tool chest are unchanged from v4 — same markup, same classes.

## Checking the match

At each of the three platforms, not just three widths — use a real iPad and a real phone, or at minimum Chrome's device emulation with touch on, because the layout branches on pointer capability.

Desktop: move the bar through all four positions, confirm the panel and rail swap sides. Select text and use the popover. Drag a mark into a note. Open marks-only and jump back.

Tablet: confirm no tooltips appear, every target is comfortable with a thumb, and the panel opens on tap.

Phone: confirm the dock is edge to edge and clears the home indicator, every popover arrives as a bottom sheet, and a note opens as a sheet rather than a floating card.
