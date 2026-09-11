/* The reader is a route, and the four parts of the chrome are a page.
 *
 * They bind listeners to `window` and `document` and never take them off,
 * which is right for a page and wrong for a route: a listener that outlives
 * the reader fires against elements that are gone, and the student meets it as
 * a dead click somewhere else in the app.
 *
 * The obvious fix is to thread an AbortSignal through every registration —
 * about twenty-five edits across three parts, every one of them a place the
 * chrome can drift from the file it was copied from. HANDOVER's one rule is
 * that the chrome is finished and gets copied, so the edits happen here
 * instead, once, in code the chrome never sees.
 *
 * capture() patches the four things a part can use to outlive itself, runs the
 * part, puts them back, and hands you one function that undoes everything the
 * part registered. It works because every one of those registrations happens
 * synchronously while the closure runs: nothing else on the page can slip in
 * between the patch and the restore, because nothing else runs.
 */

export function capture(run) {
  const undo = [];

  /* WINDOW AND DOCUMENT, AND DELIBERATELY NOT EVERY TARGET.
   *
   * These are the ones that can outlive the reader: an element listener dies
   * with the element React removes, and needs no bookkeeping.
   *
   * Patching `EventTarget.prototype` instead does catch element listeners too,
   * and was tried — it is the wrong trade. The patch is global for the length
   * of the mount, so it also records anything ELSE that registers in that
   * window, and React's own delegated listeners on the portal's container are
   * exactly that. Teardown would then remove React's listeners and break the
   * app around the reader. Recording more than you own is worse than
   * recording less.
   *
   * Each handler is stamped as well as recorded. Nothing in the reader reads
   * the mark; it is there so a test can ask which listeners on the page are
   * the chrome's, which is otherwise unanswerable — the router, analytics,
   * identity and React's delegation all live on the same targets. */
  const realWinAdd = window.addEventListener;
  const realDocAdd = document.addEventListener;
  const mark = (f) => { if (typeof f === "function") { try { f.__chrome = true; } catch { /* frozen */ } } };
  window.addEventListener = function (...a) {
    mark(a[1]);
    undo.push(() => window.removeEventListener(...a));
    return realWinAdd.apply(window, a);
  };
  document.addEventListener = function (...a) {
    mark(a[1]);
    undo.push(() => document.removeEventListener(...a));
    return realDocAdd.apply(document, a);
  };

  const realMO = window.MutationObserver;
  const realRO = window.ResizeObserver;
  const realTimeout = window.setTimeout;
  const realInterval = window.setInterval;

  window.MutationObserver = class extends realMO {
    constructor(...a) { super(...a); undo.push(() => this.disconnect()); }
  };
  if (realRO) {
    window.ResizeObserver = class extends realRO {
      constructor(...a) { super(...a); undo.push(() => this.disconnect()); }
    };
  }
  window.setTimeout = function (...a) {
    const id = realTimeout.apply(window, a);
    undo.push(() => clearTimeout(id));
    return id;
  };
  window.setInterval = function (...a) {
    const id = realInterval.apply(window, a);
    undo.push(() => clearInterval(id));
    return id;
  };

  let out;
  try {
    out = run();
  } finally {
    window.addEventListener = realWinAdd;
    document.addEventListener = realDocAdd;
    window.MutationObserver = realMO;
    if (realRO) window.ResizeObserver = realRO;
    window.setTimeout = realTimeout;
    window.setInterval = realInterval;
  }

  return { out, off: () => { while (undo.length) { try { undo.pop()(); } catch { /* gone already */ } } } };
}
