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

/* THE HOLE, AND WHY THIS LAYER MAY DO WHAT THE LAST ONE COULD NOT.
 *
 * Naming an element lifts it out of the root snapshot and leaves a transparent
 * hole its own size. An incoming layer that animates in below scale 1 has
 * shrunk away from that hole, and what shows through is nothing at all — not
 * the old page. That was the flicker in the previous layer and it was
 * geometric, which is why re-timing never fixed it.
 *
 * Mission Control scales in from 0.89, so it is only safe because the OUTGOING
 * layer covers the hole meanwhile: it scales UP, so it is always larger than
 * the box, and it does not finish fading until --wg-exit-fade. Worked through
 * at 1280px, the incoming layer is 70px short per side at 0ms, 7px at 200ms,
 * 1.5px at 250ms, and back to full at 301ms — exactly when the outgoing layer
 * goes.
 *
 * So the invariant is not "nothing is named" any more. It is: IF the incoming
 * scale is below 1, the exit fade must outlast the time it takes to grow back.
 * Shorten the exit fade, or deepen the scale, and the hole opens.
 */
const num = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)`));
  return m ? Number(m[1]) : null;
};
const scaleIn = num("wg-scale-in");
const scaleOut = num("wg-scale-out");
const settle = num("wg-settle");
const exitFade = num("wg-exit-fade");

if (scaleIn === null || scaleOut === null || settle === null || exitFade === null) {
  fail.push("one of --wg-scale-in / --wg-scale-out / --wg-settle / --wg-exit-fade is missing");
} else {
  if (scaleOut <= 1) {
    fail.push(`--wg-scale-out is ${scaleOut}; the outgoing layer must scale UP (>1) or it `
      + "stops covering the hole the incoming layer shrinks away from");
  }
  if (scaleIn < 1) {
    /* How far through the spring before the incoming layer covers its own box
       again. The spring reaches 1 near the end, so require the exit fade to
       cover most of the settle — 0.6 is the point where the shortfall is under
       a pixel at 1280px. */
    const ratio = exitFade / settle;
    if (ratio < 0.6) {
      fail.push(`--wg-exit-fade is ${exitFade}ms of a ${settle}ms settle (${ratio.toFixed(2)}). `
        + `With --wg-scale-in at ${scaleIn} the incoming layer is still short when the outgoing `
        + "one disappears, and the gap shows through to nothing");
    }
  }
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
console.log(`  superseded transitions tear down nothing; scale-in ${scaleIn} is covered by `
    + `scale-out ${scaleOut} for ${exitFade}ms of a ${settle}ms settle`);
console.log("MATCH");
