# Stamp changes — 20 Sep 2026

Everything below is already in `reference/02-licence-stamp-creator.html`, which is the
source of truth. `code/05-stamp-engine.js`, `code/15-stamp-creator.js` and
`code/03-stamp-creator.css` are verbatim slices of it — paste them over the old ones.

## 1. Rim text is now derived from the shape, not hand-placed

The old code carried a hand-written arc per shape (`top`, `tl`, `bot`, `bl`). Those
arcs are still in `layout()` as a fallback for `postage` and `tag`, whose rim text is a
straight line, but every other shape now has its line worked out at draw time.

Two new fields in `layout()`:

- `rimOut: [path, inset]` — the outline the letters must stay inside, with a radial
  inset for its stroke. For `hex` it is `[hexP(16.9), .19]`, for `shield`
  `[SHIELD, 1.75]`, for `roundel` `[circ(13.9), .14]`, and so on.
- `rimSpan: [top, bottom]` — the furthest the line may travel round, in degrees each
  side of the crown. `hex` is `[48, 56]`, `shield` `[56, 66]`, `window` `[58, 68]`,
  `seal` and `gauge` `[64, 72]`. This is a composition call, not a safety one.
- `rimIn` — optional; the inner boundary when `Ly.inner` is not the right one.
  `roundel` uses the outer edge of its bar, `window` the outer edge of its code frame.

`rimRun()` then does the work:

1. walks the corridor between `rimOut` and the code frame, keeping a constant clearance
   inside the rim and dropping to dead centre when the band is thin;
2. stops early where the band is too thin to hold the letters;
3. fits a **true circle** through those points (`fitArc`, a Kåsa least-squares fit) so
   the letters never kink at a corner — a flat edge simply yields a very large radius;
4. pulls that arc inward until it clears both borders, and falls back to the exact
   corridor if it cannot;
5. sizes the font by whichever is tighter, the arc length or the band thickness.

## 2. Rim text is centred and tracked to its own width

`textLength` used to be the whole path, so `WNG` was stretched across a 100-degree arc.
It is now `min(pathLength, chars * fontSize * 1.06)` with `text-anchor="middle"` and
`startOffset="50%"`. Short rims sit compactly at the crown; long ones still use the arc.

## 3. Patterns

`lace` is gone. Six remain: None, Rays, Checks, Guilloche, Crochet, Knurl — laid out
three up, three down via `.srow.pat3`.

## 4. Matcha

`{n:'Matcha',l:.74,c:.095,h:122}` → `{n:'Matcha',l:.765,c:.152,h:126}`, sampled from
the reference photograph (core colour #9CC44E).

## 5. The example code is WNG

The code input's placeholder, and every screenshot in `screens/`.

## What to check after pasting

- `screens/12-stamp-matrix.png` — all eight shapes, rim text clear of both borders.
- `screens/17-rim-text-stress.png` — `hex` with rims from two to eleven characters.
- `screens/10-stamp-patterns.png` — six patterns, no lace.
- `screens/09-stamp-inks.png` — Matcha reads as matcha.
