/* THE TRANSITION LAYER'S BOOKKEEPING, driven rather than read.
 *
 * Two failure modes here are invisible: they produce no console error, no
 * exception and no failed build. They show up only as a flicker while moving
 * back and forth quickly, which is the hardest kind of bug to attribute.
 *
 *   the superseded teardown   Navigate again before the first transition
 *                             settles and both are alive at once. The first
 *                             one's `finished` promise then settles — as a
 *                             rejection, because it was aborted — and used to
 *                             run the teardown unconditionally. That deleted
 *                             data-vt and stripped the shared names belonging
 *                             to the SECOND transition, which was still
 *                             running, so every per-kind rule stopped matching
 *                             between one frame and the next.
 *
 *   the duplicate name        A view-transition-name has to be unique in the
 *                             document. Two overlapping navigations can each
 *                             want to name a card `wg-morph`; when both hold
 *                             it the browser aborts the whole transition and
 *                             says nothing.
 *
 * Both are pure bookkeeping, so both can be driven here without a browser: no
 * frames, no rAF, no snapshots. That matters because the two are only
 * reproducible under a race in a real window, which is exactly the thing that
 * does not fit in a test loop.
 */
const el = () => ({ style: { viewTransitionName: "" } });
globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
globalThis.window = { matchMedia: () => ({ matches: false }) };

const m = await import(new URL("../src/lib/viewTransition.js", import.meta.url).href);

const fail = [];
const A = el(), B = el();

const a = m.beginTransition("fwd");
m.markShared(A, "wg-morph");
if (document.documentElement.dataset.vt !== "fwd") fail.push("the first kind was not applied");

const b = m.beginTransition("back");
m.markShared(B, "wg-morph");
if (document.documentElement.dataset.vt !== "back") fail.push("the second kind did not replace the first");
if (A.style.viewTransitionName === B.style.viewTransitionName && A.style.viewTransitionName)
  fail.push("two elements hold one name at once — the browser aborts the transition outright");

// The first transition settles LATE. It must touch nothing.
if (m.endTransition(a) !== false) fail.push("a superseded transition was allowed to tear down");
if (document.documentElement.dataset.vt !== "back")
  fail.push("a superseded transition deleted the live transition's kind");
if (B.style.viewTransitionName !== "wg-morph")
  fail.push("a superseded transition stripped the live transition's shared name");

// The live one settles and cleans up after both.
if (m.endTransition(b) !== true) fail.push("the live transition did not tear down");
if (document.documentElement.dataset.vt !== undefined) fail.push("the kind outlived its transition");
if (B.style.viewTransitionName !== "") fail.push("a shared name outlived its transition");
if (A.style.viewTransitionName !== "") fail.push("an evicted name was never cleared");

// A name left behind collides with the next navigation, so the backstop has to
// work with nothing marked at all.
try { m.clearMorph(); m.clearMorph(); } catch (e) { fail.push("clearMorph is not safe to call twice: " + e.message); }

console.log("transitions: two overlapping navigations, 11 assertions on kind and shared-name lifetime");
if (fail.length) {
  for (const f of fail) console.log("  " + f);
  console.log("MISMATCH");
  process.exit(1);
}
console.log("MATCH");
