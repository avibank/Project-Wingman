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

/* NOTHING MAY BE NAMED. The rebuild's whole premise is that no element is
   lifted out of the root snapshot, because a named element leaves a hole its
   own size and any incoming layer scaled below 1 shrinks away from that hole
   and shows through to nothing. Re-adding a name is the one edit that would
   quietly bring the flicker back. */
const { readFileSync } = await import("node:fs");
const css = readFileSync("src/styles/app.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
if (/view-transition-name\s*:/.test(css)) {
  fail.push("app.css names an element again — a named element leaves a hole in "
    + "both root snapshots; if anything animates in below scale 1 it will show "
    + "through to nothing. Scale must be >= 1, or do not name it");
}
/* And the scale must stay at or above 1 for the same reason. */
const from = css.match(/--wg-from:\s*([\d.]+)/);
if (!from) fail.push("--wg-from is gone; the incoming scale is unset");
else if (Number(from[1]) < 1) {
  fail.push(`--wg-from is ${from[1]}, below 1 — the incoming page will shrink `
    + "away from its own edges and expose the page beneath it");
}

console.log("transitions: two overlapping navigations, plus the two invariants the rebuild rests on");
if (fail.length) {
  for (const f of fail) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log("  a superseded transition tears down nothing; nothing is named; the incoming scale is >= 1");
console.log("MATCH");
