/* MOTION FOR SWITCHES INSIDE A PAGE: tabs, segmented views and filters.
 *
 * A navigation is a view transition (viewTransition.js). A switch that does not
 * change the address — Notes to Comments under a lesson, Marks to Pages in the
 * reader's panel, a chapter chip over the Library's papers — has no snapshot to
 * animate between, and swapped its content in one frame. These give it the
 * same movement the module tabs have, from the same tokens: the incoming
 * content slides the panel's travel in from the side it came from, on the
 * settle spring, and fades in; a filter, where nothing moved sideways, only
 * fades. Transform and opacity only, and nothing at all when motion is off.
 */
import { useLayoutEffect, useRef } from "react";
import { motionOff } from "./viewTransition.js";

/* The motion tokens, read where the element is. They only exist while motion
   is allowed, which is also the only time anything here runs. */
const token = (el, name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;
const ms = (el, name, fallback) => parseFloat(token(el, name, "")) || fallback;

/* An engine that cannot parse linear() easing still gets the movement. */
function run(el, frames, opts) {
  try { return el.animate(frames, opts); } catch { return el.animate(frames, { ...opts, easing: "ease-out" }); }
}

/* THE SELECTED TAB'S PILL TRAVELS TO THE NEXT TAB.
 *
 * A tab strip marks the selected tab with a pill behind its label, or a rule
 * under it. Change tabs and it used to blink out of one tab and into the
 * other; now it slides across on the same spring as the panel below, so the
 * eye is carried from the tab you pressed to the panel it opened.
 *
 * IT MOVES IN THE PAGE, NOT AS A VIEW-TRANSITION LAYER, and that was measured
 * rather than chosen. Given a view-transition-name of its own, the pill became
 * a layer painted ABOVE the tab strip — every named layer paints over the
 * element it was lifted out of — so it slid across the labels and washed them
 * out for the whole movement, and sat on the new tab's label until the end.
 * In the page it stays where the stylesheet puts it, under every label, and
 * during a tab change the page is still live under the panel's slide, so the
 * movement shows through exactly as drawn. It also moves where there are no
 * view transitions at all.
 *
 * Transform only: a translate from the old tab's position and a horizontal
 * scale from its width, both settling to nothing.
 *
 * The strip's CSS holds its end of it: a pill sits at z-index -1 inside a
 * tablist that isolates, so every pill paints below every label — one sliding
 * past a neighbouring tab passes under its word, not over it — and it scales
 * from its left edge.
 */
const PILL = '[aria-selected="true"] .tab-pill';

/* `pill` is the new tab's pill, already drawn; `tab` is the tab it belongs to
   and `from` the tab that held the old one. The old pill is gone by now, so
   where it WAS is worked out from its tab, which is still there: the new pill
   sits on its tab with some inset, and the old one sat on its tab with the
   same inset. Measured at the moment of the switch, not remembered from an
   earlier one, so a resize or a font arriving in between cannot throw it. */
export function slidePill(pill, tab, from) {
  if (!pill || !tab || !from || from === tab || !from.isConnected || motionOff()) return;
  if (typeof pill.animate !== "function") return;
  const p = pill.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  const f = from.getBoundingClientRect();
  if (!p.width || !f.width) return;
  const dx = f.left + (p.left - t.left) - p.left;
  const sx = (f.width + (p.width - t.width)) / p.width;
  if (Math.abs(dx) < 0.5 && Math.abs(sx - 1) < 0.005) return;
  run(pill, [{ transform: `translateX(${dx}px) scaleX(${sx})`, offset: 0 }],
      { duration: ms(pill, "--wg-settle", 418), easing: token(pill, "--wg-spring", "ease-out") });
}

export function useTabPill(listRef, selected) {
  const was = useRef(null);
  useLayoutEffect(() => {
    const pill = listRef.current?.querySelector(PILL);
    const tab = pill?.closest('[role="tab"]') || null;
    const from = was.current;
    was.current = tab;
    slidePill(pill, tab, from);
  }, [listRef, selected]);
}

/* THE CONTENT OF A SWITCH ARRIVES. `dir` is "next" when the new content sits
   further along the strip than the old (it comes in from the right), "prev"
   the other way, and "fade" for a filter, which narrows a list without moving
   through anything. Single keyframes, so each animation runs from the offset
   to whatever the element already is rather than to a guess at it. */
export function switchIn(el, dir) {
  if (!el || typeof el.animate !== "function" || motionOff()) return;
  const fadeIn = token(el, "--wg-fade-in", "ease-out");
  if (dir === "next" || dir === "prev") {
    const travel = token(el, "--wg-panel-travel", "12px");
    run(el, [{ transform: `translateX(${dir === "next" ? travel : `calc(${travel} * -1)`})`, offset: 0 }],
        { duration: ms(el, "--wg-settle", 418), easing: token(el, "--wg-spring", "ease-out") });
    run(el, [{ opacity: 0, offset: 0 }], { duration: ms(el, "--wg-enter-fade", 260), easing: fadeIn });
    return;
  }
  run(el, [{ opacity: 0, offset: 0 }], { duration: 160, easing: fadeIn });
}

/* The same, for a React switch: runs after the new content is committed and
   before it is painted, whenever `value` changes — never on the first render,
   which is the page arriving and belongs to the navigation. With an `order`
   the direction comes from it; without one the switch is a filter and fades. */
export function useSwitchIn(ref, value, order = null) {
  const was = useRef(value);
  const orderRef = useRef(order);
  orderRef.current = order;
  useLayoutEffect(() => {
    const from = was.current;
    was.current = value;
    if (from === value) return;
    const o = orderRef.current;
    switchIn(ref.current, o ? (o.indexOf(value) > o.indexOf(from) ? "next" : "prev") : "fade");
  }, [ref, value]);
}
