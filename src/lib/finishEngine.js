// The Finish system. A livery is a colour; a finish is a material.
//
// Ported verbatim from the Livery Engine II reference (design/wingman-finish-
// source.js). Every number here was arrived at against reference photography:
// do not re-derive, round, tidy or substitute. If a value looks odd it is
// deliberate.
//
// Kept out of liveryEngine.js on purpose. That file is the stock, checked
// token for token against the POC by scripts/check-livery.mjs, and a finish
// must never be able to move it: finishVars() returns overrides that are
// layered on top, and returns nothing at all for the None finish.


const ok = (s) => `oklch(${s})`;


/* ---------- manual finish ---------- */
// One step down in lightness, keeping hue and chroma. Used where the accent
// has to be read rather than filled.
const darkenL = (c, by) =>
  String(c).replace(/oklch\(\s*([\d.]+)/, (_, L) => `oklch(${Math.max(0, Number(L) - by).toFixed(4)}`);

export const MAN = {
  // t3 carries the smallest text that means anything — timestamps, the word
  // Next, an unselected tab. Manual was outside the contrast matrix until Part
  // 12 put it in one, and it was failing in both modes on ink that had never
  // been measured against this paper: .5600 read 3.91:1 on the microfiche
  // ground and .545 read 4.49:1 on the cream. Lifted and darkened to clear 4.5
  // with headroom. Nothing else in the palette moves.
  N: { g: ".1600 .0060 85", p: ".2050 .0070 85/.80", rz: ".2450 .0080 85/.88", l: ".3600 .0100 85/.90", t3: ".6100 .0080 85", t2: ".7400 .0070 85", t1: ".9200 .0060 85", grain: .15 },
  D: { g: ".966 .010 85", p: ".992 .005 85/.88", rz: ".950 .011 85/.92", l: ".876 .014 85/.94", t3: ".505 .010 85", t2: ".395 .011 85", t1: ".215 .012 85", grain: .17 },
};





/* ---------- generators ---------- */

// Why the light choice is being overridden, or null when it is not. A nullable
// string rather than a flag: the card renders whatever it is given and knows
// nothing about which finish produced it. Aurora is the only source today.
export function lightOverride(finish) {
  return finish === "aurora" ? "Aurora is a night sky." : null;
}

export const FINISHES = [
  { id: null, name: "Standard", line: "The livery, as it is." },
  { id: "aurora", name: "Aurora", line: "Polar route, no traffic, nothing to do but look up." },
  { id: "manual", name: "Manual", line: "Everything you need is in here somewhere." },
];

/* THE PATTERN FINISHES ARE GONE (owner, 2026-10-05: "kill tye dye, just have
   manual and standard"). Tribal lasted a day and Tie-dye two, and both are
   DELETED rather than filtered — `src/lib/finishPattern.js`, the demo desk and
   `check:pattern` with them. Aurora is the one that stays standing while
   unoffered, because it has shipped, been withdrawn and been reinstated
   twice: its renderers have earned the room. A finish nobody ever chose has
   not, and git has all three.

   What this leaves is two finishes and the deliberately-unoffered third, which
   is what the launch handoff always said it would be. */

/* AURORA IS NOT OFFERED (owner, 2026-10-04: "remove aurora"). It was taken
   out on 2026-09-21, put back on 2026-09-29 ("reintroduce aurora as a finish
   like it was"), and is out again — which is the third time this one line has
   moved, so it is written to move cleanly rather than to be clever.

   IT IS A FILTER, NOT A DELETION, every time. Aurora stays in FINISHES,
   every renderer keeps drawing it, and check:contrast, check:surfaces and
   test:bm keep measuring it — so nothing about it rots while it is out, and
   putting it back is this line again. Deleting the renderers to "tidy up"
   is what would make the next reinstatement a rewrite.

   `offeredFinish` is the other half: an account stored on Aurora reads back
   as Standard rather than painting nothing, which is what makes withdrawing
   a finish safe at all.

   AURORA IS STILL A NIGHT SKY while it is unoffered. App.jsx forces the
   night variant on it and `lightOverride` says so, and neither rule was ever
   conditional on the finish being offered — which is what keeps `?finish=`
   and the harness honest. */
export const OFFERED_FINISHES = FINISHES.filter((f) => f.id !== "aurora");
export const offeredFinish = (id) => (OFFERED_FINISHES.some((f) => f.id === (id ?? null)) ? (id ?? null) : null);

/**
 * Token overrides for a finish, layered over deckVars().
 * Returns an empty object for None, which is what keeps None byte-identical.
 */


export function finishVars(liveryId, variant, finish, accent, resolve = null) {
  const night = variant !== "day";

  /* AURORA IS RESOLVED BY SOMEBODY ELSE, and that is a bundle decision rather
     than a design one (2026-10-06). Its spec table is six liveries of curtain
     prose and it was in the ENTRY CHUNK, on every first paint, for a finish
     that is not offered — `check:bundle` had been naming it for two days.
     It lives in `src/lib/auroraFinish.js` now and is passed IN.

     The app never passes it, and cannot need to: App runs the stored finish
     through `offeredFinish` first, so "aurora" does not reach here while it
     is unoffered. `check:contrast`, `check:surfaces`, `check:tokens`,
     `check:lesson-contrast` and the dev ground harness all pass `auroraVars`,
     which is what keeps every one of them measuring the real thing.

     OFFERING IT AGAIN IS TWO LINES: the filter above, and this resolver from
     App — lazily, the way the pattern finishes were. */
  if (finish === "aurora") return resolve ? resolve(liveryId, variant) : {};

  if (finish === "manual") {
    const m = night ? MAN.N : MAN.D;
    return {
      "--ground": ok(m.g), "--panel": ok(m.p), "--raised": ok(m.rz), "--line": ok(m.l),
      "--t3": ok(m.t3), "--t2": ok(m.t2), "--t1": ok(m.t1),
      // The light rig is off entirely. A printed page has no atmosphere, and
      // faking one is what made Day look wrong.
      "--key-int": "0", "--fill-int": "0", "--stars": "0",
      // ---- Manual-only tokens, for the paper world -------------------------
      // The sketch ink the indicators are drawn in, the dart's two colours, and
      // the two sheets showing behind the folder. Named here rather than
      // inlined in the CSS so check:tokens can see them and so the Day and
      // Night pairs sit beside each other.
      "--sketch-ink": night ? "oklch(.80 .008 85)" : "oklch(.40 .012 85)",
      "--sketch-hatch": night ? "oklch(.80 .008 85 / .18)" : "oklch(.40 .012 85 / .22)",
      "--paper-fill": night ? "oklch(.30 .010 85)" : "oklch(.985 .006 85)",
      "--paper-edge": night ? "oklch(.82 .008 85)" : "oklch(.42 .012 85)",
      "--stack-1": night ? "oklch(.2350 .0080 85)" : "oklch(.955 .010 85)",
      "--stack-2": night ? "oklch(.2650 .0080 85)" : "oklch(.930 .012 85)",
      // The folder tab's bottom border has to match the card's SOLID colour,
      // not the translucent --panel, or the seam shows through it.
      "--panel-solid": night ? "oklch(.2050 .0070 85)" : "oklch(.992 .005 85)",
      // The lamp keeps --caution in every finish; this is only its outline.
      "--caution-edge": "oklch(.48 .09 72.6)",

      // The ported value, in both modes. What changes is the material, not the
      // amount: in Day the deck carries Tooth, so this same .17 is multiplied
      // through a directional desaturated turbulence and reads as paper fibre.
      // As overlay-blended isotropic noise it read as digital speckle on a
      // light ground, which is what made the page look grey rather than cream.
      // Night keeps overlay: the microfiche ground is dark, where it is right.
      "--grain": String(m.grain),
      // Manual replaces the stock entirely: no gloss, no cast shadow, no tooth.
      // It has its own --paper-drop in the finish CSS.
      "--sheen-img": "none", "--drop": "none",
      "--active": accent, "--active-fill": accent,
      // Paper is not the deck: the same accent that reads on a lit ground is
      // too pale on cream. Darkened for Day only, on the same reasoning as
      // --active-text in the livery engine.
      "--active-text": night ? accent : darkenL(accent, 0.13),
    };
  }

  return {};
}

// The ruled pad, in the livery's ink. Only meaningful under Manual.
export function ruledLayer(accent, day) {
  const a27 = accent.replace(/\)$/, " / .30)");
  const a45 = accent.replace(/\)$/, " / .45)");
  return {
    opacity: day ? .55 : .34,
    backgroundImage:
      `repeating-linear-gradient(180deg, transparent 0 27px, ${a27} 27px 28px),`
      + ` linear-gradient(90deg, transparent 0 76px, ${a45} 76px 77px, transparent 77px)`,
  };
}
