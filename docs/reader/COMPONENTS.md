# Reader components — exact markup

**This file exists so the reader doesn't get reinterpreted.** `reader.css` is written against these exact class names. Produce this DOM and the look is done — no design decisions left to make.

## The porting rule

| Copy verbatim | Rewrite for our stack |
|---|---|
| `reader.css` — every token, every class, every value | State, data fetching, events |
| `reader-icons.js` — paths, tool table, colours | Component structure (JSX/Vue/whatever) |
| The class names and DOM shapes below | Routing, storage, API calls |
| The easing curve, radii, timings | — |

Transliterate the HTML below into whatever the codebase uses — `class` → `className`, attributes → props. Keep the nesting and the class names. Do not rename `.is-on` to `.active`, do not swap `.bar` for a styled-component, do not replace the icons with an icon library. Those substitutions are exactly how the build ends up "in the neighbourhood" instead of matching.

If a class in `reader.css` is unused when you finish, you missed a component. If you needed a class that isn't in it, you invented something — check the demo first.

## Root

Everything lives inside one root element carrying the state as data attributes. CSS reads these; don't duplicate them as classes.

```html
<div class="rdr"
     data-look="night"     <!-- night | paper                        -->
     data-tool="hl"        <!-- active tool id                       -->
     data-mode="read"      <!-- read | rev (marks-only)              -->
     data-mark="1"         <!-- 1 when the active tool marks text    -->
     data-edit="0">        <!-- 1 while editing the tool tray        -->
```

Add `class="is-writing"` to the root on pointer-down with a marking tool, remove on pointer-up. That's what makes the chrome recede.

## Document surface

```html
<div class="rdr-scroll">
  <div class="rdr-stack">

    <!-- a rendered page -->
    <article class="rdr-page" data-page="129" style="--z:1">
      <span class="pg-num">129</span>
      <!-- canvas + text layer go here -->
    </article>

    <!-- a page not yet drawn — NEVER an empty white box -->
    <article class="rdr-page is-placeholder" data-page="130" style="--z:1;height:1130px">
      <span class="pg-num">130</span>
      <span class="pg-label">Page 130</span>
    </article>

  </div>
</div>
```

Placeholder height comes from the manifest's page dimensions, so the scroll height is right before any PDF byte arrives.

## Marks on the text layer

Each markable run in the text layer:

```html
<span class="s" data-mark-id="…">…sentence…</span>
```

States, added by JS:

```html
<span class="s is-marked" style="--mkc:rgba(242,179,61,.42);--mkb:rgba(242,179,61,.85)">
<span class="s is-marked is-open-thread">   <!-- violet, unanswered: hollow -->
<span class="s is-marked is-selected">
```

`--mkc` is the fill (colour at the mark's opacity), `--mkb` the border (colour at 85%). The reveal animation is in the CSS — don't animate it in JS.

## Top bar

```html
<div class="bar bar-top">
  <button class="ib" aria-label="Back to the Library">{icon back}</button>
  <button class="ib" aria-label="Pages">{icon pages}</button>
  <button class="title">
    <span class="mono mod">M13.01</span><b>Rotary Wing Aerodynamics</b>
  </button>
  <span class="sep"></span>
  <button class="ib" aria-label="Check for new marks">
    {icon refresh}<span class="dot" hidden></span>
  </button>
  <button class="ib" aria-label="Find">{icon find}</button>
  <button class="ib" aria-label="Marks only">{icon revision}</button>
  <button class="ib" aria-label="Marks">{icon marks}<span class="dot" hidden></span></button>
  <button class="ib" aria-label="Reading light">{icon light}</button>
  <button class="ib" aria-label="More">{icon more}</button>
</div>
```

## Tool dock

Rendered from the tray array, not from the full tool list. Separators go between groups.

```html
<div class="bar bar-dock">

  <button class="tool is-on is-locked" data-tool="sel" draggable="true" aria-label="Select">
    {icon}
    <span class="x" aria-label="Remove">×</span>
    <span class="tip">Select<kbd>V</kbd><em>Pick a mark back up</em></span>
  </button>

  <div class="dsep"></div>

  <button class="tool" data-tool="hl" draggable="true" aria-label="Highlighter">
    {icon}
    <span class="cnt mono">3</span>                        <!-- preset count   -->
    <span class="swatch" style="background:#F2B33D"></span> <!-- current colour -->
    <span class="x" aria-label="Remove">×</span>
    <span class="tip">Highlighter<kbd>H</kbd><em>Tap a sentence</em></span>
  </button>

  <button class="tool" data-tool="era" draggable="true" aria-label="Eraser">
    {icon}<span class="mode"></span>
    <span class="x">×</span>
    <span class="tip">Eraser<kbd>E</kbd><em>Whole stroke · ink only</em></span>
  </button>

  <div class="dsep"></div>
  <button class="addbtn" aria-label="Add a tool">{icon add}</button>
</div>

<div class="bar pop bar-edit">
  Drag to reorder · tap ✕ to remove <button>Done</button>
</div>
```

Long-press (450ms) anywhere on the dock sets `data-edit="1"`. On iOS this needs `-webkit-touch-callout:none` (already in the CSS) or Safari's own menu fights it.

## Inspector

```html
<div class="bar pop bar-insp is-open">
  <header>
    <h3>Highlighter {icon chevron}</h3>
    <button class="ib" aria-label="Reset tool">{icon reset}</button>
  </header>
  <div class="body">

    <!-- live preview: exactly what the mark will look like -->
    <div class="preview">
      <span class="smp" style="background:rgba(242,179,61,.42);padding:3px 8px">Sample text</span>
    </div>

    <div class="row">
      <div class="rowhead"><span>Size</span><span class="pill">12 pt</span></div>
      <input type="range" min="4" max="32" value="12"
             style="--trk:linear-gradient(90deg,#F2B33D,rgba(242,179,61,.25))">
      <div class="ticks"><b>4</b><b>8</b><b>12</b><b>20</b><b>32</b></div>
    </div>

    <div class="row">
      <div class="recent">
        <span class="lb">Recent</span>
        <button class="sw sm" style="--c:#F2B33D"><i></i></button>
        <button class="sw sm" style="--c:#4FBE92"><i></i></button>
      </div>
      <div class="rowhead"><span>All colours</span></div>
      <div class="colours">
        <button class="sw is-on" style="--c:#F2B33D" aria-label="Exam likely"><i></i></button>
        <button class="sw" style="--c:#5BA4F0" aria-label="Definition"><i></i></button>
        <button class="sw" style="--c:#4FBE92" aria-label="Testable fact"><i></i></button>
        <button class="sw" style="--c:#C77CD0" aria-label="Ask"><i></i></button>
        <button class="sw" style="--c:#EC7059" aria-label="Weak spot"><i></i></button>
        <button class="more" aria-label="More colours">···</button>
      </div>
    </div>

    <div class="row">
      <div class="meaning" style="--c:#F2B33D">
        <i></i>
        <div style="flex:1">
          <b>Exam likely</b>
          <u>Goes into your revision deck, and adds to the class heat on this passage.</u>
        </div>
      </div>
    </div>

    <div class="row" style="margin-bottom:4px">
      <div class="rowhead"><span>Opacity</span><span class="pill">42%</span></div>
      <input type="range" min="10" max="100" value="42"
             style="--trk:linear-gradient(90deg,rgba(242,179,61,.12),#F2B33D)">
      <div class="ticks"><b>25%</b><b>50%</b><b>75%</b><b>100%</b></div>
    </div>

    <!-- ink tools only -->
    <div class="fold is-open">
      <button type="button">Smart inking {icon chevron}</button>
      <div class="inner">
        <div class="tgl">
          <div class="lab"><b>Ink to line</b><span>Snap a stroke to the shape you meant</span></div>
          <button class="switch is-on" role="switch" aria-checked="true" aria-label="Ink to line"></button>
        </div>
        <div class="rowhead"><span>Smoothness</span><span class="pill">100%</span></div>
        <input type="range" min="0" max="100" value="100">
        <div class="ticks"><b>25%</b><b>50%</b><b>75%</b><b>100%</b></div>
      </div>
    </div>

  </div>
</div>
```

The opacity slider's track is painted in the current colour. The preview updates on every slider move. Both details, small, and they're most of why the panel feels considered.

For tools with no colour, the body is a single `.empty` block with a 40px line drawing and one sentence.

## Add-tool sheet

```html
<div class="bar pop bar-add is-open">
  <header><h3>Add a tool</h3></header>
  <div class="satabs">
    <button class="is-on">Mark up</button><button>Ink</button><button>Draw</button>
    <button>Sign off</button><button>Talk</button>
  </div>
  <div class="sagrid">
    <button class="sacell is-have" data-add="hl">
      <span class="ic" style="color:#F2B33D">{icon}</span><span>Highlighter</span>
    </button>
    <button class="sacell" data-add="ul">
      <span class="ic">{icon}</span><span>Underline</span>
    </button>
  </div>
  <div class="safoot">
    <span>6 of 10 on your tray</span>
    <u>Reset to course default</u>
  </div>
</div>
```

## Mark card

One popover does properties, ownership and actions. There is no separate selection toolbar.

**Own mark:**

```html
<div class="bar pop mark-card is-open">
  <div class="mch" style="--c:#F2B33D"><i></i><b>Exam likely</b><em>p.129</em></div>
  <div class="mcd">Goes into your revision deck, and adds to the class heat on this passage.</div>
  <div class="mcw">
    <span class="av">YOU</span>
    <div><b>You</b><span>2 hours ago</span></div>
  </div>
  <div class="mca">
    <button class="sw is-on" style="--c:#F2B33D"><i></i></button>
    <button class="sw" style="--c:#5BA4F0"><i></i></button>
    <button class="sw" style="--c:#4FBE92"><i></i></button>
    <button class="sw" style="--c:#C77CD0"><i></i></button>
    <button class="sw" style="--c:#EC7059"><i></i></button>
    <span class="sep"></span>
    <button class="ib" aria-label="Add a note">{icon note}</button>
    <button class="ib" aria-label="Delete">{icon trash}</button>
  </div>
</div>
```

**Someone else's mark:**

```html
  <div class="mcw">
    <span class="av other">DS</span>
    <div><b>Dana S.</b><span>3 days ago · 61 marks · 27 answers on M13</span></div>
    <button class="btn grow" data-act="agree">{icon agree} 4</button>
  </div>
  <div class="mca">
    <button class="btn primary" data-act="ask">Ask Dana</button>
    <button class="btn grow" data-act="follow">Follow</button>
  </div>
```

**An anonymous question:**

```html
  <div class="mcw">
    <span class="av other">?</span>
    <div><b>Asked anonymously</b><span>yesterday · name hidden on questions</span></div>
  </div>
  <div class="thr">
    <span class="state is-open"></span>
    Open thread · 1 reply
    <u>Open in Ready Room</u>
  </div>
  <div class="mca">
    <button class="btn primary" data-act="ask">Answer this</button>
    <button class="btn grow" data-act="follow">Follow</button>
  </div>
```

Positioning: 286px wide, centred over the mark, 12px above it, flipped below when there isn't room. Hover opens after 240ms; leaving closes after 260ms unless the pointer enters the card. **Tap must open it too** — an iPad has no hover.

## Marks panel

```html
<div class="bar bar-panel is-open">
  <header>
    <div class="segs">
      <button class="is-on">Marks</button><button>Pages</button><button>Queue</button>
    </div>
  </header>
  <div class="chips">
    <button class="chp is-on">Everything</button>
    <button class="chp">Revision</button>
    <button class="chp">Glossary</button>
    <button class="chp">Questions</button>
    <button class="chp">Threads</button>
    <button class="chp">Master Caution</button>
  </div>
  <div class="plist">
    <div class="pgh">Page 129</div>
    <div class="mrow" data-mark-id="…" style="--c:#F2B33D">
      <div class="stripe"></div>
      <div>
        <div class="t"><b>Exam likely</b><em>p.129</em></div>
        <p>If the engine fails, or a drive shaft shears, another force has to keep…</p>
        <div class="w">You · today</div>
      </div>
    </div>
  </div>
</div>
```

Empty state — a drawing and one useful line, never an apology:

```html
<div class="empty">
  <svg width="42" height="42" …>…</svg>
  Nothing matches this filter.<br>Mark a sentence and it lands here with its page and its meaning.
</div>
```

## Tick rail

```html
<div class="rail" title="Your marks across the manual">
  <div class="trk"></div>
  <div class="you" style="top:412px"></div>
  <div class="tk is-mine" style="top:412px;--c:#F2B33D" data-page="129"></div>
  <div class="tk" style="top:180px;--c:#5BA4F0" data-page="34"></div>
</div>
<div class="bar pop railtip is-open" style="--c:#F2B33D;top:412px">
  <b>Exam likely</b><em>p.129</em>
</div>
```

`top` is `(page / totalPages) × railHeight`. Own marks get `.is-mine` (wider, opaque).

## Bottom bar

```html
<div class="bar bar-bot">
  <button class="ib" aria-label="Undo">{icon undo}</button>
  <button class="ib" aria-label="Redo">{icon redo}</button>
  <span class="sep"></span>
  <div class="pgctl">
    <button class="ib" aria-label="Previous page">{icon prev}</button>
    <span class="pgpill" title="Drag to fly through the manual">129</span>
    <span class="tot">/ 1012</span>
    <button class="ib" aria-label="Next page">{icon next}</button>
  </div>
  <span class="sep"></span>
  <button class="ib is-on" aria-label="Class marks">{icon density}</button>
  <span class="sep"></span>
  <div class="zoom">
    <button class="ib" aria-label="Zoom out">{icon zoomOut}</button>
    <span class="v">Fit width</span>
    <button class="ib" aria-label="Zoom in">{icon zoomIn}</button>
  </div>
</div>
```

The zoom readout shows the **mode name**, not a percentage. `.pgpill` is drag-to-scrub — `pointerdown`, capture, ~1.9 pages per pixel of horizontal movement.

## Scrubber, back pill, toast

```html
<div class="bar pop scrub is-open">
  <div class="thumb"><i class="t"></i><i></i><i></i><i class="m"></i><i></i></div>
  <div class="meta"><b>412</b><span>of 1012</span><u>3 marks near here</u></div>
</div>

<div class="bar pop back is-open">
  <b>Back to page 129</b>
  <button class="ib" aria-label="Go back">{icon backTo}</button>
</div>

<div class="bar pop toast is-open">
  <span>Picked up where you left off — page <b class="mono">129</b>, highlighter, exam likely.</span>
  <button>Start fresh</button>
</div>
```

## Marks-only view

Root gets `data-mode="rev"`.

```html
<div class="rev"><div class="revwrap">
  <div class="revhead">
    <div>
      <h2>Marks only</h2>
      <p>28 passages across 14 pages of this manual.</p>
    </div>
    <button class="ib" aria-label="Back to the paper">{icon close}</button>
  </div>
  <div class="revfilters">
    <button class="chp is-on">Everything</button>
    <button class="chp">Exam likely <span style="color:#F2B33D">9</span></button>
  </div>
  <div class="rgroup">
    <div class="rgh" style="--c:#F2B33D">
      <i></i><b>Exam likely</b><em>9 passages · Revision deck</em>
    </div>
    <div class="rcard" data-mark-id="…" style="--c:#F2B33D">
      <div class="st"></div>
      <p>Retreating blade stall is first felt as a low-frequency vibration…</p>
      <span class="pg">p.203</span>
    </div>
  </div>
</div></div>
```

## Motion — do these in CSS, not JS

Already in `reader.css`. Don't reimplement with a JS animation library.

| What | How |
|---|---|
| Panels opening | `scale(.97)` → `1` with opacity, 280ms |
| Highlight applying | `clip-path` left-to-right reveal, 340ms |
| Chrome receding | root `.is-writing` → bars to 20%, 500ms |
| Toggle knob | `translateX(17px)`, 280ms |
| Tray edit | 1.1° alternating rotation |
| Everything | `cubic-bezier(.32,.72,0,1)` |

## Fonts

UI: any clean grotesque already in the app — do not introduce a new one. Numerals anywhere digits change: `"IBM Plex Mono"` with `font-variant-numeric: tabular-nums`, via `.mono`. If Plex Mono isn't already loaded, use the app's existing mono face; a jittering page counter is the thing to avoid, not that specific typeface.

## Checking the match

Open the reference build beside the running app at 1440×900, night theme, and compare surface by surface: dock, inspector, mark card, marks panel, tick rail, bottom bar, marks-only view. Then again in paper theme. Then at 1194×834. Differences in spacing, radius, shadow depth or timing are bugs — the CSS is shared, so any difference means the DOM diverged.
