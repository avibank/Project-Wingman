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
const rootOld = css.match(/html\[data-vt\]::view-transition-old\(root\)\s*\{([^}]*)\}/);
if (!rootOld) {
  fail.push("no rule holds the old root still — the background will cross-fade with the content");
} else if (!/animation:\s*none/.test(rootOld[1])) {
  fail.push("the old root animates again. Two layers fading past each other thin at the midpoint, "
    + "so the background and the topbar pulse on every navigation");
}
if (!/\.deck-light\s*\{\s*view-transition-name:\s*wg-bg/.test(css)) {
  fail.push("the ambient background is no longer named — it goes back into the root snapshot "
    + "and dissolves between two different moments of its own drift");
}
if (!/::view-transition-(old|new)\(wg-bg\)[^}]*animation:\s*none/.test(css)) {
  fail.push("wg-bg is named but not frozen; naming it alone only changes which layer it stutters in");
}

/* And the chrome must stay out of it: naming the topbar or the rail would make
   the furniture travel with the screen. */
if (/view-transition-name:\s*wg-(topbar|brand|avatar)/.test(css)) {
  fail.push("the chrome is named again — the topbar and the background belong to the root "
    + "snapshot, which only crossfades, so nothing outside the screen appears to move");
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
