/* ══════════════════════════════════════════════════════════════════════
   Wingman — Day, as built.  Exact values.

   These were arrived at over many iterations and measured for contrast.
   Copy them verbatim. Do not re-derive, round, "clean up", or
   substitute your own. If a number looks odd, it is deliberate.
   ══════════════════════════════════════════════════════════════════════ */


/* ── 1 · Day text tokens ───────────────────────────────────────────────
   These REPLACE the current shared Day token set.

   t3 was '.618 .009 85'. Against the deep ground that measures 2.99:1,
   which is a real failure on 9.5px uppercase mono (.cap, .hcode) and on
   .since. t3 → .505 clears 4.5:1 everywhere it lands. t2 moves down with
   it so the three levels keep their step; t1 is unchanged.

   Measured (all six liveries, Day, deep ground):
     t3 on ground  4.70 – 4.82      t3 on panel  5.53 – 5.68
     t2 on panel   7.66 – 7.85      t1 on panel  15.08 – 15.46          */

const DAY = {
  g : '.966 .010 85',           /* overridden by the stock, see §2 */
  p : '.992 .005 85/.78',
  rz: '.936 .013 85/.87',
  l : '.876 .014 85/.94',
  t3: '.505 .009 85',           /* was .618 */
  t2: '.430 .010 85',           /* was .462 */
  t1: '.250 .012 85'            /* unchanged */
};


/* ── 2 · Stock — each livery gets its own paper ────────────────────────
   [chroma, hue]. The ground is no longer one shared cream: each livery
   sits on its own stock, which is what stops Day reading as "the light
   theme" and makes it read as this livery, in daylight.

   Beacon is the loud one and it is intentional: a blush pink stock
   under deep signal-red ink. It was '.022', 46 — a warm orange-cream
   that read as apricot. More chroma and a hue swung toward red lands
   it as pink that still belongs to the red family.                   */

const STOCK = {
  sky    : ['.014', 240],
  amber  : ['.024',  80],
  tarmac : ['.008', 250],
  beacon : ['.038',  16],       /* blush */
  runway : ['.015', 122],
  skydrol: ['.015', 296]
};


/* ── 3 · Deep ground ───────────────────────────────────────────────────
   The ground drops from L .966 to L .930, and raised/line follow it.

   Why: Night's ground → panel step is a 48% relative lightness jump.
   At .966 the Day step was 2.7% — which is the whole reason Day looked
   flat. Nothing else in this file fixes that; this does.

   Applied for the selected livery `id`:                              */

function dayGround(id) {
  const [chroma, hue] = STOCK[id];
  return {
    g : `.930 ${chroma} ${hue}`,
    rz: `.944 .013 ${hue}/.92`,
    l : `.842 .016 ${hue}/.94`
  };
}


/* ── 4 · The light rig ─────────────────────────────────────────────────
   Same two layers, same angles, same blur, same drift as Night. The key
   SCREENS a warm bloom into the sun corner; the fill MULTIPLIES a
   livery-tinted shade into the opposite one.

   Screen is additive. On a ground that is already near-white it does
   nothing, which is why lightening the Night gradients never worked.
   The fill has to subtract.                                          */

const dayKey = () =>
  `radial-gradient(84% 72% at 78% -14%, oklch(0.995 0.055 82 / 0.95) 0%, ` +
  `oklch(0.985 0.048 78 / 0.62) 26%, ` +
  `oklch(0.975 0.040 76 / 0.28) 50%, ` +
  `oklch(0.970 0.035 76 / 0) 76%)`;

/* h = the livery's key hue (lv.kh); c = lv.kc * 0.42 */
const dayFill = (h, c) =>
  `radial-gradient(104% 84% at 14% 114%, oklch(0.610 ${(c*1.30).toFixed(3)} ${h}.0 / 0.70) 0%, ` +
  `oklch(0.720 ${(c*1.05).toFixed(3)} ${h}.0 / 0.40) 28%, ` +
  `oklch(0.860 ${(c*0.70).toFixed(3)} ${h}.0 / 0.14) 56%, ` +
  `oklch(0.940 ${(c*0.50).toFixed(3)} ${h}.0 / 0) 82%)`;

const DAY_RIG = {
  '--key-img' : dayKey(),
  '--fill-img': 'dayFill(lv.kh, lv.kc * 0.42)',
  '--key-int' : 0.92,
  '--fill-int': 0.66,
  '--soft'    : '82px',          /* unchanged from Night */
  '--grain'   : 0.20,            /* .09 without Tooth */
  '--stars'   : 0,
  '--blend'   : 'screen',
  '--blend2'  : 'multiply'       /* the whole fix, in one token */
};


/* ── 5 · Cast shadow ───────────────────────────────────────────────────
   Five stops, not three. Tight and genuinely dark where the surface
   meets the ground, then progressively wider and softer. This is what
   separates "a light theme" from "photographed", and it is the highest
   quality-per-byte change in the whole file.

   Set as --drop in Day. Night keeps `none`.                          */

const DAY_DROP =
  '0 .5px .5px oklch(.44 .050 66/.30), ' +
  '0 1.5px 2px oklch(.47 .050 66/.20), ' +
  '0 4px 5px oklch(.50 .045 66/.15), ' +
  '0 11px 17px oklch(.52 .040 66/.13), ' +
  '0 28px 56px oklch(.55 .045 66/.17)';

/* The previous three-stop value. Keep it only if you need a fallback
   for a surface where the five-stop version is too heavy — but say
   which, in the report, rather than deciding quietly.               */
const DAY_DROP_OLD =
  '0 1px 1px oklch(.55 .03 66/.13), 0 3px 6px oklch(.55 .03 66/.09), ' +
  '0 16px 34px oklch(.55 .04 66/.13)';


/* ── 6 · Sheen ─────────────────────────────────────────────────────────
   Two layers: a broad gloss falling from the top edge, and one narrow
   diagonal specular streak. Set as --sheen-img in Day; `none` at Night
   and under Manual.                                                  */

const DAY_SHEEN =
  'linear-gradient(174deg, oklch(1 0 0/.66) 0%, oklch(1 0 0/.24) 13%, ' +
  'oklch(1 0 0/.05) 29%, transparent 50%), ' +
  'linear-gradient(116deg, transparent 30%, oklch(1 0 0/.26) 45%, transparent 60%)';


/* ── 7 · Putting it together ───────────────────────────────────────────
   The whole Day branch, as the engine runs it. `isManual` is the only
   thing that switches it off — Aurora in Day falls through to here, by
   design (see §3 of the brief).                                      */

function applyDay(set, deck, id, lv) {
  const G = dayGround(id);

  set('--ground',  `oklch(${G.g})`);
  set('--raised',  `oklch(${G.rz})`);
  set('--line',    `oklch(${G.l})`);
  set('--panel',   `oklch(${DAY.p})`);
  set('--t3',      `oklch(${DAY.t3})`);
  set('--t2',      `oklch(${DAY.t2})`);
  set('--t1',      `oklch(${DAY.t1})`);

  set('--key-img',  dayKey());
  set('--fill-img', dayFill(lv.kh, lv.kc * 0.42));
  set('--key-int',  0.92);
  set('--fill-int', 0.66);
  set('--soft',     '82px');
  set('--stars',    0);
  set('--grain',    0.20);
  set('--blend',    'screen');
  set('--blend2',   'multiply');

  set('--drop',      DAY_DROP);
  set('--sheen-img', DAY_SHEEN);

  deck.setAttribute('data-tooth', '1');
}
