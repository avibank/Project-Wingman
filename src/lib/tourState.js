/* =============================================================================
   PUTTING A SCREEN INTO THE STATE A TOUR STEP NEEDS.
   -----------------------------------------------------------------------------
   `pane` and `panelTab` on a step are instructions to the page, not routes:
   the Ready Room has to be showing the right-seat list, or a squadron's chat,
   or a module's threads, before the tour frames the rail beside it — and it
   has to get there IN PLACE, with no page transition, because the handoff is
   explicit that a pane switch must not fade.

   SO IT IS AN EVENT, NOT A PROP. The alternative was threading a `tourPane`
   prop from App through the Ready Room to its rail, which every screen the
   tour ever wants to pose would then have to carry for the sake of a feature
   that is off for all but a few seconds of a student's life. A page listens
   for `wm-tour:pane` if it can honour one and ignores it otherwise, and the
   tour is none the wiser either way.

   THE PROMISE RESOLVES ON THE NEXT FRAME rather than on an acknowledgement.
   A page that does not listen would otherwise hang the tour for good, and a
   step whose pane did not change still has a target to frame.

   AND THE REQUEST IS ALSO LEFT WHERE A PAGE CAN FIND IT, which is the half
   that was missing. The step that opens the Ready Room navigates and then
   asks for a pane in the same breath, and the Ready Room is a lazy chunk —
   so the event was dispatched into a window with nothing listening yet, and
   the room came up on whatever pane it defaults to. Measured: four Ready
   Room steps, all four showing the module threads. A page now reads the
   standing request when it mounts AND listens for later ones, so the order
   of the two stops mattering. `pageName` is what that page is, so a stale
   request belonging to another screen is never applied.

   THE DETAIL IS THE BARE VALUE. It was `{ pane }`, and every listener read
   `e.detail` as the string the doc comments here promise — so nothing moved
   and nothing said why. One shape, and it is the documented one.
   ========================================================================= */
const nextFrame = () => new Promise((res) => { requestAnimationFrame(() => requestAnimationFrame(res)); });

/* The standing request per page, read by a screen that mounts after the ask. */
const pending = { pane: null, panelTab: null };

function announce(name, key, value) {
  pending[key] = value;
  try { window.dispatchEvent(new CustomEvent(name, { detail: value })); } catch { /* no CustomEvent */ }
  return nextFrame();
}

/** `right-seat` · `squadron:<slug>` · `module:<code>` */
export const setTourPane = (pane) => announce("wm-tour:pane", "pane", pane);

/** `logbook` · `comments` */
export const setTourPanelTab = (tab) => announce("wm-tour:panel-tab", "panelTab", tab);

/** What a page mounting now should put itself into, or null. */
export const tourPane = () => pending.pane;
export const tourPanelTab = () => pending.panelTab;

/** Dropped when the tour ends, so nothing it asked for outlives it. */
export function clearTourState() { pending.pane = null; pending.panelTab = null; }
