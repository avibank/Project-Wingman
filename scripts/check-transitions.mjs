/* THE TRANSITION LAYER'S BOOKKEEPING, driven rather than read.
 *
 * The layer was rebuilt around a single pair of root snapshots with nothing
 * named, which removed the duplicate-name failure this file used to also
 * cover. One invisible failure remains, and it is the one that survives any
 * choreography:
 *
 *   the superseded teardown   Navigate again before the first transition
 *                             settles and both are alive at once. The first
 *                             one's `finished` promise then settles — as a
 *                             rejection, because it was aborted — and would
 *                             run the teardown unconditionally, deleting the
 *                             data-vt belonging to the SECOND transition while
 *                             it was still running. Its rules stop matching
 *                             between one frame and the next.
 *
 * It produces no console error, no exception and no failed build, and it only
 * reproduces under a race in a real window — which is exactly what does not
 * fit in a test loop. It is pure bookkeeping, so it can be driven here with no
 * browser, no frames and no snapshots.
 */
globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
globalThis.window = { matchMedia: () => ({ matches: false }) };

const m = await import(new URL("../src/lib/viewTransition.js", import.meta.url).href);

const fail = [];

const a = m.beginTransition("move");
if (document.documentElement.dataset.vt !== "move") fail.push("the first kind was not applied");

const b = m.beginTransition("theme");
if (document.documentElement.dataset.vt !== "theme") fail.push("the second kind did not replace the first");

// The first transition settles LATE. It must touch nothing.
if (m.endTransition(a) !== false) fail.push("a superseded transition was allowed to tear down");
if (document.documentElement.dataset.vt !== "theme")
  fail.push("a superseded transition deleted the live transition's kind");

// The live one settles and cleans up.
if (m.endTransition(b) !== true) fail.push("the live transition did not tear down");
if (document.documentElement.dataset.vt !== undefined) fail.push("the kind outlived its transition");

// And a third, to prove the counter keeps working rather than latching.
const c = m.beginTransition("move");
if (m.endTransition(c) !== true) fail.push("the counter latched after one round");
if (document.documentElement.dataset.vt !== undefined) fail.push("the third kind outlived its transition");

import { readFileSync } from "node:fs";
/* Comments are stripped first: this file's own explanation quotes the numbers
   it is checking, and matching that quote would read the prose instead of the
   declaration. */
const css = readFileSync("src/styles/app.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* THE ONE RULE THE WHOLE LAYER RESTS ON: NO LAYER EVER SCALES BELOW 1.
 *
 * Naming an element lifts it out of the root snapshot and leaves a transparent
 * hole exactly its size. A layer smaller than its own box has shrunk away from
 * that hole, and what shows through is nothing at all — not the old page, not
 * the background. Nothing.
 *
 * That single fact has caused this layer's last three defects. First the
 * flicker, when the incoming screen arrived from 0.988. Then the ghost: the
 * incoming screen came from 0.89, so the OUTGOING one had to stay opaque for
 * 301ms to cover it, and an old screen lingering blurred over a new one for
 * three tenths of a second is exactly what a ghost is. Then the same thing from
 * the other end, where going back shrank the outgoing layer to 0.923 and
 * uncovered its own hole — modelled at 36px on the way in and 28px on the way
 * back.
 *
 * Keeping every scale at or above 1 removes all three at once, and it is what
 * lets the exit fade be short: nothing needs covering, so the old screen can
 * leave as fast as it likes. The depth survives — the outgoing grows away from
 * you and the incoming settles forward onto its true size — because opposite
 * directions do not require one of them to be small.
 *
 * So this asserts the rule rather than the numbers. Any scale below 1, in any
 * direction, brings back a hole and with it a reason to slow the fade down.
 */
const scales = [...css.matchAll(/--wg-scale-(out|in):\s*([\d.]+)/g)]
  .map((m) => ({ which: m[1], value: Number(m[2]) }));

if (scales.length < 2) {
  fail.push("--wg-scale-out / --wg-scale-in are missing");
}
for (const s of scales) {
  if (s.value < 1) {
    fail.push(`--wg-scale-${s.which} is ${s.value}, below 1. A named layer smaller than its own `
      + "box shows through to nothing, and the only way to hide that is to keep the other layer "
      + "opaque over it — which is the ghost");
  }
}

/* :not() MUST NOT APPEAR ON A VIEW-TRANSITION SELECTOR.
 *
 * The minifier strips it. A view-transition pseudo-element can only attach to
 * the originating element, so lightningcss treats everything qualifying it as
 * redundant and drops the whole compound —
 *
 *   html[data-vt]:not([data-vt="theme"]):not([data-vt="setting"])::view-transition-old(root)
 *   becomes
 *   ::view-transition-old(root)
 *
 * — which is true of the `html` part and emphatically false of the attribute
 * selectors that decide WHICH KIND of transition is running. Every rule guarded
 * that way silently applied to every kind in the built CSS, and the last one in
 * the file won.
 *
 * That is why the dev server and production disagreed, and why fix after fix
 * verified locally and changed nothing on the deployed site. Plain attribute
 * selectors survive intact, so kinds are enumerated instead. It is longer and
 * it works.
 */
for (const m of css.matchAll(/([^{}\n]*::view-transition[^{}\n]*)\{/g)) {
  if (/:not\(/.test(m[1])) {
    fail.push(`${m[1].trim().slice(0, 70)} uses :not() on a view-transition selector. The `
      + "minifier drops the qualifier, so the rule applies to every kind in the built CSS. "
      + "Enumerate the kinds instead");
  }
}

/* NOTHING COMPOSITES ADDITIVELY BY DEFAULT, AND NOTHING DIMMED EVER DOES.
 *
 * The user agent's own stylesheet sets mix-blend-mode: plus-lighter on these
 * pseudo-elements. That is the correct default for the plain cross-fade it
 * ships with — the two halves are the same picture, and summing them holds
 * coverage at one the whole way across — and it is wrong for a screen change.
 *
 * Both screens carry brightness() while they move: the outgoing one dims as it
 * recedes and the incoming one arrives dimmed and resolves. Summed, two layers
 * at 0.76 make 1.52, and that is the brightness spike — an addition, not a
 * colour.
 *
 * So the universal rule is normal blending, and it has to be universal:
 * setting it per-layer is how it went wrong, three rules named it and the
 * other thirteen inherited the additive default.
 *
 * BUT A PAIR THAT IS NOT DIMMED WANTS THE ADDITION BACK, deliberately. A pane
 * or a tab panel crossfades two different pictures with no filter on either,
 * and under normal blending two layers at part opacity never cover the whole:
 * at the midpoint both are faint and the room behind shows through — the dip
 * on every tab and every pane. Old at 1 - e(t) and new at e(t), added, is
 * exactly one at every instant. That only holds when BOTH halves fade on the
 * same duration and the same curve, and it is only safe on a layer with no
 * filter animating on it. Those are the two things asserted: plus-lighter is
 * allowed on a named layer only if no filter keyframe runs on that name, and
 * only if its fade-out and fade-in are the same clock.
 */
if (!/::view-transition-old\(\*\)[\s\S]{0,80}mix-blend-mode:\s*normal/.test(css)) {
  fail.push("no universal mix-blend-mode: normal on the transition layers. The user agent "
    + "defaults them to plus-lighter, which is additive, and both screens dim while they "
    + "move — so they sum past one at the crossover and the page flashes");
}
{
  const rules = [...css.matchAll(/([^{}]*::view-transition[^{}]*)\{([^}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const namesIn = (sel) => [...sel.matchAll(/::view-transition-(?:old|new|group|image-pair)\(([\w*-]+)\)/g)].map((m) => m[1]);
  /* WHICH KINDS A RULE SPEAKS FOR. A rule with no html[data-vt] qualifier
     speaks for all of them, and `^=` speaks for a family — so "morph" and
     "fwd" are different conversations, and a layer may add in one while it is
     dimmed in the other. That is the whole reason this is per kind: the
     screen change recedes behind a brightness and must never sum, and the
     module morph carries no filter at all and must. */
  const kindsOf = (sel) => {
    const exact = [...sel.matchAll(/data-vt="([\w]+)"/g)].map((m) => m[1]);
    const family = [...sel.matchAll(/data-vt\^="([\w]+)"/g)].map((m) => `${m[1]}*`);
    const both = [...exact, ...family];
    return both.length ? both : ["*"];
  };
  const overlaps = (a, b) =>
    a === "*" || b === "*" || a === b
    || (a.endsWith("*") && b.startsWith(a.slice(0, -1)))
    || (b.endsWith("*") && a.startsWith(b.slice(0, -1)));
  const filtered = new Set([...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)]
    .filter((k) => /filter\s*:/.test(k[2])).map((k) => k[1]));
  const additive = [];      // { kind, name }
  const dimmed = [];        // { kind, name }
  const fades = [];         // { kind, name, dir, clock }
  for (const r of rules) {
    const names = namesIn(r.sel);
    const kinds = kindsOf(r.sel);
    const pairs = kinds.flatMap((kind) => names.map((name) => ({ kind, name })));
    if (/plus-lighter/.test(r.body)) additive.push(...pairs);
    const anim = r.body.match(/animation\s*:([^;]*)/)?.[1] || "";
    if ([...filtered].some((k) => new RegExp(`\\b${k}\\b`).test(anim))) dimmed.push(...pairs);
    for (const part of anim.split(",")) {
      // duration, curve and any delay: the whole clock, not just its length
      const f = part.trim().match(/^(.+?)\s+both\s+(wgFadeOut|wgFadeIn)$/);
      if (!f) continue;
      const clock = f[1].replace(/\s+/g, " ");
      const dir = f[2] === "wgFadeOut" ? "out" : "in";
      for (const pair of pairs) fades.push({ ...pair, dir, clock });
    }
  }
  const seen = new Set();
  for (const { kind, name } of additive) {
    const key = `${kind}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (name === "*" || name === "root") {
      fail.push(`::view-transition-*(${name}) composites with plus-lighter. The universal rule is `
        + "normal; only a named, undimmed pair on one clock may add");
      continue;
    }
    if (dimmed.some((d) => d.name === name && overlaps(kind, d.kind))) {
      fail.push(`${name} composites with plus-lighter${kind === "*" ? "" : ` on ${kind}`} and has a filter `
        + "animating on it — two dimmed layers added together are brighter than either, which is the spike");
    }
    const mine = fades.filter((f) => f.name === name && overlaps(kind, f.kind));
    const out = new Set(mine.filter((f) => f.dir === "out").map((f) => f.clock));
    const into = new Set(mine.filter((f) => f.dir === "in").map((f) => f.clock));
    if (!(out.size === 1 && into.size === 1 && [...out][0] === [...into][0])) {
      fail.push(`${name} composites with plus-lighter${kind === "*" ? "" : ` on ${kind}`} but its halves do not `
        + `fade on one clock (out: ${[...out].join(" | ") || "none"}; in: ${[...into].join(" | ") || "none"}). `
        + "Added, two different fades overshoot one somewhere and the layer flashes");
    }
  }
}

/* THE BACKGROUND HOLDS STILL, and that is two separate declarations.
 *
 * First, the OLD root must not animate. Two layers fading past each other do
 * not sum to one — at the midpoint both sit near half and the pair thins — so
 * a cross-faded root pulses everything in it on every navigation: the
 * background, the topbar, the runway lights. None of those is what is being
 * navigated. Held at full opacity with the new one fading in on top, the two
 * always sum to full coverage, and where the root is identical the result is
 * no change at all.
 *
 * Second, the ambient layer is named so it is lifted out of the root entirely
 * and frozen. It is one continuous element across every route and it drifts
 * under its own animations; two snapshots of a drifting starfield 200ms apart
 * are not the same picture, and dissolving between them is a stutter.
 */
/* THE ROOT PAINTS ONCE on a navigation. Holding the old root and fading the new
   over it is a correct dissolve for opaque pixels and wrong for translucent
   ones: a pixel with alpha p under a layer fading at o covers o*p + p*(1-o*p),
   which is more than p. The topbar's pills sit at .87 and .585, so they
   densify by about a fifth at half-fade — the flash on the icons. Dropping the
   old side is the only version with no artefact, and there is nothing to
   dissolve: between two routes the topbar is nearly always identical. */
const navRoot = css.match(/html\[data-vt="fwd"\]::view-transition-old\(root\)[\s\S]{0,600}?\{([^}]*)\}/);
if (!navRoot || !/display:\s*none/.test(navRoot[1])) {
  fail.push("the old root is still painted on a navigation. Stacked on the new one it "
    + "over-covers every translucent pixel in the chrome — the topbar pills densify by about "
    + "a fifth at half-fade, which is the flash on the icons");
}
/* THE BACKGROUND MUST NOT BE NAMED. It was, so it would hold still, and that
   pinned it at the cost of its blend mode: .deck-light isolates and its
   pseudo-elements screen, so lifting it into its own snapshot made them
   composite against a transparent backdrop instead of the dark ground. Screen
   over nothing does not restrain the glow, it renders it at full strength —
   and the topbar's translucent pills sit on top of it, which is why the
   brightness appeared on the icons and nowhere else.
   It does not need a name to be still: it lives in the root, and the root
   paints once on a navigation. */
if (/\.deck-light[^{]*\{\s*view-transition-name/.test(css)) {
  fail.push("the ambient background is named again. It isolates and blends with screen, so "
    + "lifting it into its own snapshot composites that glow against a transparent backdrop "
    + "and it blows out — visible as a brightness spike on the topbar's translucent icons");
}
/* AND EXACTLY ONE COPY IS PAINTED. .deck-light is a transparent container whose
   pseudo-elements SCREEN light onto what is behind them — additive by design.
   Holding both its old and new snapshots at full opacity paints that glow
   twice, and two screens stacked are brighter than one: the page lifts for the
   length of the transition and drops back when the old snapshot goes. A pinned
   pair must drop one side rather than hold both. */
for (const name of ["wg-rail"]) {
  const re = new RegExp(`::view-transition-old\\(${name}\\)[^}]*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m || !/display:\s*none/.test(m[1])) {
    fail.push(`::view-transition-old(${name}) is still painted. A pinned layer renders on both `
      + "sides, so anything translucent or additive in it is composited twice and the page "
      + "brightens for the length of the transition");
  }
}

/* THE CHROME NEVER TRAVELS WITH THE SCREEN. The app bar is named now — the
   Ready Room has none, so without a layer of its own it blinked out and back —
   and a named bar present on both sides of a move must paint once and stand
   still, exactly like the rail above. Only when it is alone in its group, on
   the way into or out of the room, may it move. The brand and the avatar are
   never named on their own. */
{
  const held = (side, want) => {
    const m = css.match(new RegExp(`::view-transition-${side}\\(wg-topbar\\)\\s*\\{([^}]*)\\}`));
    return m && want.test(m[1]);
  };
  if (!held("old", /display:\s*none/) || !held("new", /animation:\s*none/)) {
    fail.push("the app bar is not held when it is on both sides of a move — without its old "
      + "side dropped and its new side still, the furniture crossfades or travels with the screen");
  }
}
if (/view-transition-name:\s*wg-(brand|avatar)/.test(css)) {
  fail.push("a piece of the chrome is named on its own — the brand and the avatar belong to the "
    + "app bar's layer, and named apart they would move against it");
}

console.log("transitions: two overlapping navigations, plus the geometry Mission Control rests on");
if (fail.length) {
  for (const f of fail) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log(`  superseded transitions tear down nothing; all ${scales.length} scales at or above 1 `
  + `(${scales.map((s) => s.value).join(", ")}) so no layer uncovers its own hole`);
console.log("MATCH");
