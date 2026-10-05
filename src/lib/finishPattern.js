/* =============================================================================
   THE TURBINE — the pattern behind the "Tie-dye" finish.
   -----------------------------------------------------------------------------
   THIS FILE IS NEVER IMPORTED BY finishEngine.js, AND THAT IS THE POINT.
   The entry chunk sat exactly on its 680KB budget, and pulling the tile code
   in through finishEngine — which every screen needs — put it 3KB over. A
   pattern is only drawn for the one finish that asks for it, so App imports
   this lazily when that finish is on and holds the layer in state. Neither
   pattern reaches first paint, `check:bundle` is what holds that, and the
   budget was NOT raised to fit — its own header says a budget you are
   already failing gets disabled inside a week.

   The cost is stated rather than hidden: a student whose finish is a pattern
   gets the deck for a frame or two before the pattern arrives. Both are
   faint backgrounds by design, so what that looks like is a wallpaper fading
   up, and it is the same bargain the reader's pdf.js already takes.

   ---
   -----------------------------------------------------------------------------
   THE TRIBAL TILE WAS HERE AND IS GONE (owner, 2026-10-04: "kill tribal").
   It shipped and was killed the same day; `git show` has it if it is ever
   wanted. This is not the Aurora case and does not get Aurora's treatment —
   that one is kept standing because it has shipped, been withdrawn and been
   reinstated twice, so its renderers earn their place. A finish that lasted
   one day leaves nothing worth keeping warm.

   WHAT IT DRAWS, and why it is this and not the reference traced. The
   reference is a deco floor tile: four cream petals round a gold rosette,
   gold darts between them, thin rules boxing each tile. Drawn literally it
   is somebody else's tile. Drawn as this app's own it is a FOUR-BLADE
   ROTOR — a hub, four blades at the diagonals, four pitch-link darts on the
   axes, a boxed grid — which is the same geometry and the same rhythm, and
   it is the thing these students are studying. Module 13d opens on rotary
   wing. The reference's bones, this app's subject.

   IT IS ONE HUE, NOT TWO, and that is the house rule rather than a
   limitation. The reference gets its charm from gold on navy, and §Design's
   two-layer colour is explicit: the module hue is wayfinding and `--presence`
   amber is presence and action. A wallpaper painted in the presence amber
   would spend the one colour this app reserves for "something is happening
   here" on something that is never happening. So the blades, the darts and
   the hub are the LIVERY's own hue at different lightnesses and chromas,
   walked a few degrees the way `AUR.cH` walks it — and on Gauge amber that
   lands exactly on the reference's gold, which is the nicest accident in
   here.

   IT IS A TILE, NOT A FIELD, for the reason the starfield is: one SVG the
   browser decodes once and repeats beats hundreds of gradients rasterised
   across a full-viewport layer. And it does not move at all — there is no
   animation to turn off for Smooth Air, which is the cheapest way to obey
   §Design's last line.

   COLOURS ARE EMITTED AS HEX, not oklch. The tile is a data: URL, and what
   is inside one is parsed in its own document where a colour this app's
   tokens would have resolved is just a string. So the OKLCH is converted
   here, once, at generation.
   ========================================================================= */

/* ---------- OKLCH → sRGB hex, so a data: URL can carry it ---------------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const toSrgb = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(v) * 255);
};
export function oklchHex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return `#${[r, g, bb].map((x) => toSrgb(x).toString(16).padStart(2, "0")).join("")}`;
}

/* ---------- the geometry -------------------------------------------------
   Authored on a 240 box with the hub at its centre, because every element is
   placed by rotating one path about that centre — four blades at the
   diagonals, four darts on the axes — and 4-fold symmetry is what makes the
   tile read as a tile rather than as a picture that happens to repeat.

   The corner rosette is a QUARTER drawn at each corner. Four tiles meeting
   complete it, which is the join: without something crossing the seam the
   grid reads as separate squares and the eye finds the edges. */
/** The hue a pattern is drawn in: the livery's accent's own, read off it
 *  rather than tabled, so a seventh livery needs no entry here. */
export function patternHue(accent) {
  const m = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(String(accent || ""));
  return m ? Number(m[1]) : 250;
}


/* ===========================================================================
   THE SPIRAL — the pattern behind the "Tie-dye" finish.
   ---------------------------------------------------------------------------
   The owner handed over a classic spiral tie-dye (2026-10-04) and asked for
   it "with each livery using its own colours and hues".

   AND IT IS A JET TURBINE (owner, 2026-10-04: "tie dye should be a mix of
   what i sent and a jet turbine, clear yet background"). So the dye is the
   colour and the turbine is the form: over the wound bands sits a fan disc —
   a spinner, a ring of blades swept from it, a containment ring and a nozzle
   ring outside that. The two are the same drawing because they share a
   centre and a direction of turn, which is the only way a mix of them is a
   thing rather than two things on top of each other.

   "CLEAR YET BACKGROUND" is a contradiction worth stating as two numbers
   rather than splitting the difference. The FORM is drawn hard — blade edges
   crisp, rings true — so it reads as a turbine the moment you look at it;
   the whole layer is then taken down to single-digit opacity so it never
   competes. Blurring the blades to make them "subtle" would have lost the
   turbine and kept the haze, which is the worst of both.

   SO IT IS NOT A RAINBOW, and that is the whole translation. The reference
   gets its energy from running the entire spectrum, which is exactly what
   this app's two-layer colour rule forbids a background from doing — six
   liveries that all came out rainbow would not be six liveries. Each one
   instead runs a BAND around its own accent: the hue sweeps ±`spread`
   degrees as the spiral turns, so Sky runs blue through cyan and violet,
   Beacon runs red through orange and magenta, and the shape is the
   reference's while the colour is the livery's.

   HOW A SPIRAL IS DRAWN WITHOUT A SHADER. A real tie-dye is colour as a
   function of angle AND radius — turn the cloth and the bands wind outwards
   — and no CSS gradient does both. One conic gradient gives wedges; one
   radial gives rings. Rings of wedges, each ring turned a little further
   than the one inside it, give the wind: `RINGS` annuli, each a conic
   gradient of `ARMS` wedges, each rotated by its own index. That is a real
   spiral rather than a picture of one, and it costs one SVG.

   IT IS NOT TILED. A spiral has a centre; repeating it would put a seam
   through every one. It is one image stretched over the layer with
   `slice`, which is how the reference photograph would behave if you hung
   it behind the app.

   CRINKLE IS THE OTHER HALF. A tie-dye is dyed through folded cloth, so the
   bands break into radial streaks rather than running clean. `SPOKES` thin
   wedges of varying alpha, seeded rather than random, do that — and seeded
   matters for the same reason it does in the aurora: a field that re-rolls
   every render crawls.
=========================================================================== */
/* RINGS AND ARMS ARE WHY THE FIRST CUT WAS A DARTBOARD. Nine rings of
   fourteen wedges draw visible annuli and visible pie slices; the eye finds
   the grid before it finds the spiral. Sixteen of twenty-six, wound harder
   and blurred, is dye. The spokes stay sharp on top — in real tie-dye the
   crinkle lines ARE the crisp part, because they are where the cloth was
   folded and the dye did not reach. */
const SP = { rings: 16, arms: 26, spokes: 90 };
/* The fan. Blades is a real fan count — a big turbofan runs 18 to 26 — and
   the sweep is what makes them blades rather than spokes: each one leans
   into the direction of turn, the same direction the dye winds, so the two
   halves of this drawing agree about which way the thing is rotating. */
/* THE DISC HAS TO SURVIVE THE CROP. The field is one square drawn `cover`
   over the window, so on a wide screen the square is scaled to the WIDTH and
   the top and bottom are cut away — at a tip radius of .47 the fan ran off
   both edges and what was left read as a few arcs rather than as a fan. At
   .30 the whole disc is inside the shortest viewport this app supports, so
   it is still a turbine on a laptop and on a phone. */
const FAN = { blades: 22, sweep: 26, hubR: 0.055, rootR: 0.085, tipR: 0.30, ringR: 0.335, nozzleR: 0.385 };
/* "CLEAR YET BACKGROUND" IS TWO NUMBERS, not one compromise, and this is the
   pair. The whole layer goes to single-digit opacity, so the only way the
   turbine survives is for the FORM to carry far more weight than the colour
   inside the image: the fan is drawn strong and the dye is pulled back under
   it. The first cut had them the other way round and the fan washed out. */
const FAN_INK = { blade: 0.58, edge: 0.88, ring: 0.62, nozzle: 0.34, root: 0.46, spinner: 0.9 };
const DYE_UNDER = 0.72;
/* The ring stack has to reach past the corners or the pattern is a disc on a
   ground, with four dark corners — `slice` cannot help, because the circle is
   inscribed in the box rather than filling it. 0.78 of the box takes the
   outer ring beyond the diagonal (0.707). */
const REACH = 0.78;

/* Deterministic jitter, the aurora's own. */
const jit = (s) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

/**
 * One spiral, as a data: URL.
 *
 * `hue` is the livery's accent hue and everything is placed around it.
 * `spread` is how far the band wanders either side of it — the dial between
 * "one colour, wound" and "a rainbow", and the reason this reads as the
 * livery rather than as a tie-dye poster.
 */
export function spiralDye({ hue, spread = 54, lightFrom = 0.34, lightTo = 0.80, chroma = 0.14, alpha = 1, box = 1000 }) {
  const c = box / 2;
  const turns = [];
  for (let r = SP.rings - 1; r >= 0; r -= 1) {
    const outer = (box * REACH * (r + 1)) / SP.rings;
    /* Each ring is turned further than the one inside it, and THAT OFFSET IS
       THE SPIRAL: without it this is a dartboard, and with too little of it
       it is still a dartboard that someone has nudged. A full wedge of twist
       per ring is what makes an arm visibly wind from the centre out. */
    const twist = r * (360 / SP.arms) * 1.15;
    const wedges = [];
    for (let a = 0; a < SP.arms; a += 1) {
      const t = a / SP.arms;
      /* The hue wanders with the angle and drifts on with the radius, so a
         band does not close on itself — a closed band reads as a target. */
      const h = hue + Math.sin(t * Math.PI * 2) * spread + (r / SP.rings) * spread * 0.5;
      const L = lightFrom + (lightTo - lightFrom) * (0.5 + 0.5 * Math.sin((t + r * 0.17) * Math.PI * 2));
      const a0 = (a * 360) / SP.arms + twist;
      const a1 = ((a + 1) * 360) / SP.arms + twist + 1.6;   // overlap, so no hairline shows between wedges
      const p0 = [c + outer * Math.cos((a0 * Math.PI) / 180), c + outer * Math.sin((a0 * Math.PI) / 180)];
      const p1 = [c + outer * Math.cos((a1 * Math.PI) / 180), c + outer * Math.sin((a1 * Math.PI) / 180)];
      wedges.push(`<path d="M${c},${c} L${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${outer.toFixed(1)},${outer.toFixed(1)} 0 0 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)} Z" fill="${oklchHex(L, chroma, h)}"/>`);
    }
    turns.push(wedges.join(""));
  }
  /* The crinkle: thin radial streaks, lighter and darker, seeded. */
  let crinkle = "";
  for (let i = 0; i < SP.spokes; i += 1) {
    const ang = (i * 360) / SP.spokes + jit(i + 3) * 4;
    const w = 0.4 + jit(i + 11) * 1.5;
    const up = jit(i + 7) > 0.5;
    const op = (0.05 + jit(i + 5) * 0.16).toFixed(3);
    crinkle += `<rect x="${(c - w / 2).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${box}"`
      + ` fill="${up ? "#ffffff" : "#000000"}" opacity="${op}"`
      + ` transform="rotate(${ang.toFixed(1)} ${c} ${c})"/>`;
  }
  /* THE BLEED IS WHAT MAKES IT DYE. Hard-edged wedges read as a chart however
     they are coloured; cloth wicks. One blur over the colour only — the
     crinkle sits on top of it sharp, because a fold line is the one crisp
     thing in a real tie-dye. It costs nothing per frame: this is rasterised
     once when the browser decodes the image, like the starfield. */
  /* ---- the fan disc ------------------------------------------------------
     Drawn OVER the dye and never blurred. Each blade is a quadrilateral from
     root to tip whose trailing edge lags its leading edge by `sweep` degrees,
     which is camber; the pair of arcs closing it makes the root and tip
     follow the discs they sit on rather than cutting straight across. */
  const ink = oklchHex(lightTo, chroma * 0.5, hue);
  const shade = oklchHex(lightFrom * 0.8, chroma * 0.6, hue);
  const pol = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  };
  const R = (k) => box * FAN[k];
  let fan = "";
  for (let i = 0; i < FAN.blades; i += 1) {
    const a0 = (i * 360) / FAN.blades;
    const w = 360 / FAN.blades;
    const lead = a0;
    const trail = a0 + w * 0.62;
    fan += `<path d="M${pol(R("rootR"), lead)} L${pol(R("tipR"), lead + FAN.sweep)}`
      + ` A${R("tipR").toFixed(1)},${R("tipR").toFixed(1)} 0 0 1 ${pol(R("tipR"), trail + FAN.sweep)}`
      + ` L${pol(R("rootR"), trail)}`
      + ` A${R("rootR").toFixed(1)},${R("rootR").toFixed(1)} 0 0 0 ${pol(R("rootR"), lead)} Z"`
      + ` fill="${ink}" opacity="${FAN_INK.blade}"/>`
      /* The lit leading edge. A blade you can see the edge of reads as metal;
         a flat silhouette reads as a paper cut-out. */
      + `<path d="M${pol(R("rootR"), lead)} L${pol(R("tipR"), lead + FAN.sweep)}"`
      + ` stroke="${ink}" stroke-width="${(box / 460).toFixed(2)}" opacity="${FAN_INK.edge}" fill="none"/>`;
  }
  const ring = (r, o, wdt) => `<circle cx="${c}" cy="${c}" r="${R(r).toFixed(1)}" fill="none"`
    + ` stroke="${ink}" stroke-width="${wdt}" opacity="${o}"/>`;
  const disc = `<g>${fan}`
    + ring("ringR", String(FAN_INK.ring), (box / 260).toFixed(2))    // containment ring
    + ring("nozzleR", String(FAN_INK.nozzle), (box / 430).toFixed(2))  // nozzle, outside it
    + ring("rootR", String(FAN_INK.root), (box / 520).toFixed(2))    // where the blades root
    /* The spinner, with the painted swirl every fan has on it so you can see
       at a glance that it is turning. */
    + `<circle cx="${c}" cy="${c}" r="${R("hubR").toFixed(1)}" fill="${shade}" opacity=".7"/>`
    + `<path d="M${pol(R("hubR") * 0.92, 0)} A${(R("hubR") * 0.92).toFixed(1)},${(R("hubR") * 0.92).toFixed(1)} 0 1 1 ${pol(R("hubR") * 0.92, 200)}"`
    + ` stroke="${ink}" stroke-width="${(box / 290).toFixed(2)}" fill="none" opacity="${FAN_INK.spinner}"/>`
    + `</g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}"`
    + ` preserveAspectRatio="xMidYMid slice">`
    + `<defs><filter id="w" x="-10%" y="-10%" width="120%" height="120%">`
    + `<feGaussianBlur stdDeviation="${(box / 46).toFixed(1)}"/></filter></defs>`
    + `<g opacity="${alpha}"><g opacity="${DYE_UNDER}"><g filter="url(%23w)">${turns.join("")}</g>${crinkle}</g>${disc}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22")}`;
}

/* Day needs a lighter, lower-chroma spiral for the same reason the tile does:
   on cream, a band dyed for a dark ground is a stain. */
export const DYE = {
  /* The same "faint but noticeable" dial as the tile, and a lower number: a
     spiral fills the whole layer where the tile leaves ground between its
     motifs, so the same alpha reads about twice as strong. */
  alpha: 0.11,
  spread: 54,
  night: { lightFrom: 0.30, lightTo: 0.76, chroma: 0.145 },
  day: { lightFrom: 0.52, lightTo: 0.90, chroma: 0.110 },
};

/** The finished spiral for a livery, as `{ url }`. */
export function tieDye(accent, variant = "night", alpha = DYE.alpha) {
  const k = variant === "day" ? DYE.day : DYE.night;
  return { url: spiralDye({ hue: patternHue(accent), spread: DYE.spread, alpha, ...k }) };
}

/* ---------------------------------------------------------------------------
   The one door. App asks for a layer by name and gets a style object in the
   shape Deck takes, so neither App nor Deck knows a spiral from a tile.
--------------------------------------------------------------------------- */
export function patternLayer(kind, accent, variant, opts = {}) {
  if (kind === "tiedye") {
    const d = tieDye(accent, variant, opts.alpha ?? DYE.alpha);
    /* COVER, CENTRED, NOT REPEATED — a spiral has one centre and tiling it
       would put a seam through every copy. */
    return { backgroundImage: `url("${d.url}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
  }
  return null;
}
