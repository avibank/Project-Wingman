// The flight profile every module card carries. It is a climb-cruise-descent,
// not a bar. Ported from the reference rig; kept pure so the geometry can be
// checked without a DOM.
//
// Drawn at true pixel size: the caller measures clientWidth/clientHeight and
// sets the viewBox to match with preserveAspectRatio="none". Never scale a
// fixed viewBox — the stroke weights distort.

import { smooth } from "./liveryEngine.js";

export const STAR = "M0,-4 L1.15,-1.15 L4,0 L1.15,1.15 L0,4 L-1.15,1.15 L-4,0 L-1.15,-1.15 Z";
export const PLANE =
  "M0,-6 L1.5,-1.4 L7.5,.6 L7.5,2.2 L1.5,1.2 L1.1,4.6 L3,5.8 L3,7 L0,6.3 L-3,7 L-3,5.8 L-1.1,4.6 L-1.5,1.2 L-7.5,2.2 L-7.5,.6 L-1.5,-1.4 Z";

const PHASES = [
  [0, 0.001, "at the gate"], [0.001, 0.08, "takeoff roll"], [0.08, 0.30, "climbing"],
  [0.30, 0.70, "cruise"], [0.70, 0.92, "on descent"], [0.92, 0.999, "short final"],
  [0.999, 2, "chocks in"],
];
export function phaseName(t) {
  for (const [a, b, name] of PHASES) if (t >= a && t < b) return name;
  return "chocks in";
}

// Chapter i sits at t = .08 + .84*(i/(n-1)) — the cruise, with the ground roll
// and the landing kept clear at either end.
export const chapterT = (i, n) => (n > 1 ? 0.08 + 0.84 * (i / (n - 1)) : 0.5);

/**
 * @param crew  null, or [{ini, pr}] — formation marks above the line. Their
 *              presence drops the cruise altitude to make headroom for labels.
 * @param big   the wide formation drawing rather than a card thumbnail.
 * @param C     the solid semantic map from deckVars().
 */
export function profileSVG(W, H, prog, chapters, crew, big, C) {
  const hasForm = !!(crew && crew.length);
  const pad = Math.max(4, W * 0.035), x0 = pad, x1 = W - pad;
  const base = H - (big ? 10 : 6), top = hasForm ? 22 : 7;

  const Y = (t) => {
    if (t <= 0.08) return base;                                    // ground roll
    if (t < 0.30) return base - (base - top) * smooth((t - 0.08) / 0.22);  // climb
    if (t < 0.70) return top;                                      // cruise
    if (t < 0.92) return top + (base - top) * smooth((t - 0.70) / 0.22);   // descent
    return base;                                                   // landed
  };
  const X = (t) => x0 + (x1 - x0) * t;
  const seg = (a, b) => {
    let d = `M${X(a).toFixed(1)},${Y(a).toFixed(1)}`;
    const st = Math.max(2, Math.round((b - a) * 120));
    for (let k = 1; k <= st; k++) { const t = a + (b - a) * k / st; d += ` L${X(t).toFixed(1)},${Y(t).toFixed(1)}`; }
    return d;
  };

  const sw = big ? 2.8 : 2.4, ss = big ? 0.78 : 0.62;
  const reveal = big ? "" : "reveal";

  let g = `<g class="${reveal}"><path d="${seg(0, 1)}" fill="none" stroke="${C.line}"` +
    ` stroke-width="1" stroke-dasharray="3 3"/></g>`;

  if (prog > 0.002) {
    g += `<path d="${seg(0, prog)}" fill="none" stroke="${C.t2}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    g += `<g class="${reveal}"><path d="${seg(0, prog)}" fill="none" stroke="${C.active}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }

  // Notches are hidden when they are too crowded to read.
  if (chapters && (x1 - x0) / chapters > 20) {
    let rest = "", lit = "";
    for (let i = 0; i < chapters; i++) {
      const t = chapterT(i, chapters), on = prog >= t - 0.001;
      const tf = `translate(${X(t).toFixed(1)},${Y(t).toFixed(1)}) scale(${ss})`;
      rest += `<g transform="${tf}"><path d="${STAR}" fill="${on ? C.t2 : "none"}" stroke="${on ? C.t2 : C.line}" stroke-width="${on ? 0 : 1.1}"/></g>`;
      lit += `<g transform="${tf}"><path d="${STAR}" fill="${on ? C.active : "none"}" stroke="${on ? C.active : C.line}" stroke-width="${on ? 0 : 1.1}"/></g>`;
    }
    g += rest + `<g class="${reveal}">${lit}</g>`;
  }

  // Formation — crew marks above the line, each on a leader line with initials
  // over it. Position, never pace.
  if (hasForm) {
    g += crew.map((c) => {
      const x = X(c.pr).toFixed(1), y = Y(c.pr).toFixed(1), t = (Y(c.pr) - 13).toFixed(1);
      return `<line x1="${x}" y1="${y}" x2="${x}" y2="${t}" stroke="${C.line}" stroke-width="1"/>` +
        `<circle cx="${x}" cy="${t}" r="2.4" fill="${C.t2}"/>` +
        `<text x="${x}" y="${(Y(c.pr) - 19).toFixed(1)}" text-anchor="middle"` +
        ` font-family="Geist Mono, monospace" font-size="9" letter-spacing=".6"` +
        ` fill="${C.t1}" opacity=".7">${c.ini}</text>`;
    }).join("");
  }

  // Nothing flown yet: the route is drawn, but there is no aircraft on it.
  // A machine parked at the threshold reads as a zero; an empty route reads as
  // a route.
  if (prog <= 0) return g;

  // The aircraft rotates to the local slope.
  const e = 0.008;
  const ang = Math.atan2(
    Y(Math.min(1, prog + e)) - Y(Math.max(0, prog - e)),
    X(Math.min(1, prog + e)) - X(Math.max(0, prog - e))) * 180 / Math.PI;
  g += `<g class="${big ? "" : "plane"}" transform="translate(${X(prog).toFixed(1)},${(Y(prog) - 8).toFixed(1)})` +
    ` rotate(${(90 + ang).toFixed(1)}) scale(${big ? 0.9 : 0.62})"><path d="${PLANE}" fill="${C.on}"/></g>`;
  return g;
}
