/* =============================================================================
   THE PATTERN FINISHES — the tile, the spiral, their six colours each.
   -----------------------------------------------------------------------------
   `src/lib/finishPattern.js` is a plain module for the same reason `studioModel.js`
   is: the parts worth holding here are geometry and a colour conversion, and
   both are things a tidy-up can break in a way nobody sees until the pattern
   is on somebody's screen. So this imports it and DRIVES it.

   The two bugs it was written against are already in its history:
   · the blades were authored about the origin and rotated about the hub, so
     the first render drew a grid and a rosette and no blades at all;
   · and the second drew them 86 long in a 120 half-tile, so every motif
     crossed its rule into the neighbour's square.
   Both are geometry, both looked fine in code, and both are caught below.

   Run: npm run check:pattern
   ========================================================================= */
import { readFileSync } from "node:fs";
import { LIVERIES, deckVars } from "../src/lib/liveryEngine.js";
import { oklchHex, rotorTile, tribalTile, tribalHue, TRIBAL } from "../src/lib/finishPattern.js";
import { FINISHES, OFFERED_FINISHES, offeredFinish, finishVars, isPattern } from "../src/lib/finishEngine.js";
import { patternLayer, tieDye, DYE } from "../src/lib/finishPattern.js";

let pass = 0;
const fails = [];
const ok = (name, what, good, detail = "") => {
  if (good) { pass += 1; console.log(`  ok   ${name} · ${what}`); return; }
  fails.push(`${name} · ${what}${detail ? ` — ${detail}` : ""}`);
  console.log(`  FAIL ${name} · ${what}${detail ? ` — ${detail}` : ""}`);
};

/* The tile comes back as a percent-encoded data: URL; read it as SVG. */
const svgOf = (url) => decodeURIComponent(url.replace(/^data:image\/svg\+xml,/, ""));

console.log("the colour conversion");
{
  /* Black, white and a known mid blue. If this drifts, every tile is the
     wrong colour and nothing else in here would notice. */
  ok("hex", "black and white come out as black and white",
     oklchHex(0, 0, 0) === "#000000" && oklchHex(1, 0, 0) === "#ffffff",
     `${oklchHex(0, 0, 0)} / ${oklchHex(1, 0, 0)}`);
  const blue = oklchHex(0.68, 0.13, 254);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
  ok("hex", "a mid blue is blue — b > g > r, and in gamut",
     b > g && g > r && [r, g, b].every((v) => v >= 0 && v <= 255), blue);
  ok("hex", "a colour outside sRGB is clamped rather than wrapped",
     /^#[0-9a-f]{6}$/.test(oklchHex(0.95, 0.4, 140)), oklchHex(0.95, 0.4, 140));
}

console.log("\nthe geometry");
{
  const svg = svgOf(rotorTile({ blade: "#111111", dart: "#222222", hub: "#333333", rule: "#444444" }).url);
  const paths = [...svg.matchAll(/<path d="(M0,-[\d.]+[^"]*)"[^>]*transform="translate\(120 120\) rotate\((\d+)\)"/g)];
  ok("tile", "four blades and four darts, each carried to the hub before it is turned",
     paths.length === 8 && paths.filter((p) => /C/.test(p[1])).length === 4,
     `${paths.length} placed paths`);
  ok("tile", "and they are at the four diagonals and the four axes",
     [45, 135, 225, 315].every((d) => svg.includes(`rotate(${d})`))
     && [0, 90, 180, 270].every((d) => svg.includes(`rotate(${d})`)));

  /* EVERY ELEMENT INSIDE ITS OWN SQUARE. The furthest point of any path
     authored about the origin has to clear the 120 half-tile, or the motif
     crosses the rule into its neighbour. Read out of the path data rather
     than asserted as a constant, so editing a path is what moves it. */
  const reach = (d) => Math.max(...[...d.matchAll(/-?[\d.]+/g)].map((m) => Math.abs(Number(m[0]))));
  const worst = Math.max(...paths.map((p) => reach(p[1])));
  ok("tile", "nothing reaches past its own square", worst < 120, `furthest point is ${worst} of 120`);
  ok("tile", "and there is air left round it", worst < 100, `furthest point is ${worst}`);

  ok("tile", "the corner rosette is quartered across all four corners, so tiles join",
     ["0\" cy=\"0", "240\" cy=\"0", "0\" cy=\"240", "240\" cy=\"240"].every((c) => svg.includes(c)));
  ok("tile", "the grid is drawn on all four edges, at half weight for the join",
     /M0,0 H240 M0,240 H240 M0,0 V240 M240,0 V240/.test(svg));
  ok("tile", "it is one tile, not a field of gradients",
     (svg.match(/<svg/g) || []).length === 1 && !/gradient/i.test(svg));
  ok("tile", "and nothing in it moves",
     !/<animate|animation|@keyframes|dur=/.test(svg));
}

console.log("\na version for each colour");
{
  const seen = new Map();
  for (const L of LIVERIES) {
    for (const variant of ["night", "day"]) {
      const accent = deckVars(L.id, variant).vars["--active"];
      const url = tribalTile(accent, variant).url;
      const svg = svgOf(url);
      const hexes = [...new Set([...svg.matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]))];
      ok(L.id, `${variant}: drawn in four tones of its own hue`, hexes.length === 4, hexes.join(" "));
      seen.set(`${L.id}/${variant}`, hexes.join(""));
    }
    /* The hue IS the livery's accent hue, not a table somebody has to keep. */
    const accent = deckVars(L.id, "night").vars["--active"];
    const h = Number(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(accent)[1]);
    ok(L.id, "its hue is the accent's own, so a seventh livery needs no entry",
       Math.abs(tribalHue(accent) - h) < 0.001);
  }
  ok("colours", "and no two liveries get the same tile",
     new Set(seen.values()).size === seen.size, `${new Set(seen.values()).size} of ${seen.size} distinct`);
  /* DAY IS NOT NIGHT. On a lit ground the pattern has to go darker than the
     paper; inverting nothing would leave it invisible. */
  ok("colours", "day is drawn darker than night rather than the same",
     TRIBAL.day.hubL < TRIBAL.night.hubL && TRIBAL.day.dartL < TRIBAL.night.dartL);
}

console.log("\nwhat it must not do");
{
  ok("tokens", "it moves no token at all — the palette is Standard's",
     Object.keys(finishVars("sky", "night", "tribal", "oklch(.68 .13 254)")).length === 0,
     "a finish that only adds a layer must not touch the measured palette");
  ok("tokens", "so every contrast pair already measured for Standard still holds",
     JSON.stringify(finishVars("beacon", "day", "tribal", "oklch(.67 .15 24)")) === "{}");

  const layer = patternLayer("tribal", "oklch(0.6800 0.1303 253.95)", "night");
  ok("layer", "it is delivered as one repeating image, like the ruled lines are",
     /^url\("data:image\/svg\+xml,/.test(layer.backgroundImage) && layer.backgroundRepeat === "repeat");
  ok("layer", "and it carries no blend mode to bleach the hub",
     !("mixBlendMode" in layer) && !("filter" in layer));

  ok("faint", `the default strength is faint but not gone (${TRIBAL.alpha})`,
     TRIBAL.alpha >= 0.08 && TRIBAL.alpha <= 0.22, String(TRIBAL.alpha));

  const deck = readFileSync("src/components/Deck.jsx", "utf8");
  ok("deck", "the layer sits with the rules — behind content, in front of the lamps",
     /\.tribal \{[^}]*z-index: 1/.test(deck) && /\.tribal \{[^}]*pointer-events: none/.test(deck));
  ok("deck", "and Deck is told what to draw rather than knowing which finish asked",
     /function Deck\(\{ aurora, rules, tribal \}\)/.test(deck) && !/finishPattern/.test(deck));
}

console.log("\nand aurora is out, not deleted");
{
  ok("aurora", "it is not offered", !OFFERED_FINISHES.some((f) => f.id === "aurora"));
  ok("aurora", "but it is still in FINISHES and still drawn, so putting it back is one line",
     FINISHES.some((f) => f.id === "aurora"));
  ok("aurora", "an account stored on it reads back as Standard rather than painting nothing",
     offeredFinish("aurora") === null);
  ok("aurora", "and its palette still resolves, so check:contrast keeps measuring it",
     Object.keys(finishVars("sky", "night", "aurora", "oklch(.68 .13 254)")).length > 0);
  ok("tribal", "the new finish IS offered, and says what it is",
     OFFERED_FINISHES.some((f) => f.id === "tribal" && /blades/.test(f.line)));
  ok("tiedye", "and so is the spiral", OFFERED_FINISHES.some((f) => f.id === "tiedye"));
}

console.log("\nthe spiral");
{
  const svgOfDye = (url) => decodeURIComponent(url.replace(/^data:image\/svg\+xml,/, ""));
  const svg = svgOfDye(tieDye("oklch(0.6800 0.1303 253.95)", "night", 1).url);

  /* IT WOUND TOO LITTLE THE FIRST TIME and read as a dartboard. Each ring is
     turned further than the one inside it, and the turn has to be at least a
     wedge or the eye finds the annuli before it finds the spiral. Read out of
     the drawn geometry: the first wedge of each ring must not start where the
     first wedge of the ring inside it did. */
  const firsts = [...svg.matchAll(/<path d="M500,500 L([\d.]+),([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const angles = firsts.map(([x, y]) => (Math.atan2(y - 500, x - 500) * 180) / Math.PI);
  const turned = angles.slice(1).filter((a, i) => Math.abs(a - angles[i]) > 1).length;
  ok("dye", "every ring is turned against the one inside it — it is a spiral, not a dartboard",
     turned >= angles.length - 2, `${turned} of ${angles.length - 1} turns`);

  /* IT WAS A DISC ON A GROUND the first time, with four dark corners: the
     rings are inscribed in a square box, so the outer one has to reach past
     the diagonal (0.707 of the box) to fill it. */
  const radii = [...svg.matchAll(/A([\d.]+),/g)].map((m) => +m[1]);
  ok("dye", "and it reaches past the corners rather than leaving a disc",
     Math.max(...radii) > 500 * Math.SQRT2 * 0.99, `outer radius ${Math.max(...radii).toFixed(0)} of 707 needed`);

  ok("dye", "the colour bleeds and the crinkle stays sharp",
     /feGaussianBlur/.test(svg) && /filter="url\(%23w\)"/.test(svg)
     && svg.indexOf("<rect") > svg.indexOf("filter=\"url(%23w)\""));
  ok("dye", "and nothing in it moves", !/<animate|dur=/.test(svg));

  /* IT IS NOT A RAINBOW. Each livery runs a band around ITS OWN hue — six
     liveries that all came out rainbow would not be six liveries. */
  const hueSpread = (accent) => {
    const s2 = svgOfDye(tieDye(accent, "night", 1).url);
    const hexes = [...new Set([...s2.matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]))]
      .filter((h) => h !== "#ffffff" && h !== "#000000");
    const hues = hexes.map((h) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx === mn) return null;
      const d = mx - mn;
      const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return ((x * 60) + 360) % 360;
    }).filter((x) => x !== null);
    /* The widest gap between neighbouring hues, round the circle: a band
       leaves one big gap, a rainbow leaves none. */
    const sorted = [...hues].sort((a, b) => a - b);
    let gap = 360 - (sorted.at(-1) - sorted[0]);
    for (let i = 1; i < sorted.length; i += 1) gap = Math.max(gap, sorted[i] - sorted[i - 1]);
    return gap;
  };
  for (const [id, accent] of [["sky", "oklch(0.68 0.13 253.95)"], ["beacon", "oklch(0.6733 0.1506 24.15)"],
    ["runway", "oklch(0.6433 0.1139 144.95)"]]) {
    const gap = hueSpread(accent);
    ok("dye", `${id} runs a band around its own hue rather than the spectrum`, gap > 90,
       `widest unused arc is ${gap.toFixed(0)}deg — under 90 is a rainbow`);
  }

  ok("dye", "it is drawn centred and uncut rather than tiled — a spiral has one centre",
     patternLayer("tiedye", "oklch(.68 .13 254)", "night").backgroundRepeat === "no-repeat");
  ok("dye", "it is fainter than the tile by default, because it fills where the tile leaves ground",
     DYE.alpha < TRIBAL.alpha, `${DYE.alpha} vs ${TRIBAL.alpha}`);
  ok("dye", "day is lighter than night, because on cream a dark band is a stain",
     DYE.day.lightFrom > DYE.night.lightFrom);

  ok("pattern", "both finishes are named as patterns, so App knows to load them lazily",
     isPattern("tribal") && isPattern("tiedye") && !isPattern("manual") && !isPattern(null));
  const app = readFileSync("src/App.jsx", "utf8");
  ok("pattern", "and App is the only place that imports the pattern module, lazily",
     /import\("\.\/lib\/finishPattern\.js"\)/.test(app));
  const fe = readFileSync("src/lib/finishEngine.js", "utf8");
  ok("pattern", "the entry's finish engine does NOT import it, which is what keeps it off first paint",
     !/finishPattern/.test(fe.replace(/\/\*[\s\S]*?\*\//g, "")));
}

console.log(`\npattern: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
