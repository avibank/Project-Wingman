// §2.4 — the MODULE screen's flight profile. One silhouette for every module: takeoff, climb,
// cruise, descent, landing.
//
// The reference build measures the path with a hidden <svg> and
// getPointAtLength. This does the same arithmetic in plain JS instead, for two
// reasons: nothing here needs a DOM, so the whole thing can be checked in node
// the way routeGeometry is; and a hidden measuring SVG in a React tree is a
// node somebody eventually deletes without knowing what it was for.
//
// Nothing in this file knows about React, colour, or the app.
//
// Named moduleProfile, not flightProfile: lib/flightProfile.js already exists
// and draws the Flight Deck's profile for Home and Profile. Two different
// drawings of the same idea at two different scales — this one is measured,
// arc-length addressed and carries an aircraft; that one is a decorative
// silhouette. Merging them would serve neither.

export const VB = { w: 640, h: 122 };

// The silhouette. Ground at y=97, cruise at y=26.
export const PATH =
  "M18,97 L86,97 C142,97 158,26 212,26 L430,26 C484,26 500,97 556,97 L622,97";

// Where each phase begins, in viewBox x. Used to place waypoints by phase
// rather than by raw distance, so "mid-climb" means mid-climb at any length.
const BX = { climb: 86, cruise: 212, descent: 430, land: 556 };

// The runway thresholds — short bars at each end, outside the flown path.
export const THRESHOLDS = [
  { x1: 4, x2: 18, y: 97 },
  { x1: 622, x2: 636, y: 97 },
];

/* ------------------------------------------------------------ the geometry */
/* The path as segments, so a point at a given distance is a lookup rather than
   a DOM call. Cubics are flattened into steps; 240 per curve puts the error
   well under a tenth of a pixel at any width this renders at. */
const SEG = [
  { kind: "L", a: [18, 97], b: [86, 97] },
  { kind: "C", a: [86, 97], c1: [142, 97], c2: [158, 26], b: [212, 26] },
  { kind: "L", a: [212, 26], b: [430, 26] },
  { kind: "C", a: [430, 26], c1: [484, 26], c2: [500, 97], b: [556, 97] },
  { kind: "L", a: [556, 97], b: [622, 97] },
];
const STEPS = 240;

const cubic = (s, t) => {
  const u = 1 - t;
  const x = u * u * u * s.a[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.b[0];
  const y = u * u * u * s.a[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.b[1];
  return [x, y];
};
const lerp2 = (s, t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
const at = (s, t) => (s.kind === "C" ? cubic(s, t) : lerp2(s, t));

// One cumulative table of {len, x, y}, built once at module load.
const TABLE = (() => {
  const rows = [{ len: 0, x: 18, y: 97 }];
  let total = 0;
  for (const s of SEG) {
    const n = s.kind === "C" ? STEPS : 1;
    let prev = at(s, 0);
    for (let i = 1; i <= n; i++) {
      const p = at(s, i / n);
      total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      rows.push({ len: total, x: p[0], y: p[1] });
      prev = p;
    }
  }
  return rows;
})();

export const TOTAL = TABLE[TABLE.length - 1].len;

/* A point at a distance along the path. Binary search, then linear
   interpolation between the two samples either side. */
export function pointAt(len) {
  const L = Math.max(0, Math.min(TOTAL, len));
  let lo = 0, hi = TABLE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TABLE[mid].len < L) lo = mid; else hi = mid;
  }
  const a = TABLE[lo], b = TABLE[hi];
  const span = b.len - a.len;
  const f = span > 0 ? (L - a.len) / span : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/* The distance at which the path first reaches an x. */
function lenAtX(x) {
  let lo = 0, hi = TOTAL;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (pointAt(m).x < x) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

export const L = {
  start: 0,
  climb0: lenAtX(BX.climb),
  cruise0: lenAtX(BX.cruise),
  desc0: lenAtX(BX.descent),
  land0: lenAtX(BX.land),
  end: TOTAL,
};

const mix = (a, b, f) => a + (b - a) * f;

/* §2.4 — where the chapters sit. Takeoff and landing hold no chapter: takeoff
   is always the start state and landing always means complete, so a chapter on
   either would make "not started" and "chapter 1" the same picture. */
export function waypointLens(n) {
  if (n <= 0) return [];
  const climbMid = mix(L.climb0, L.cruise0, 0.5);
  const descMid = mix(L.desc0, L.land0, 0.5);
  if (n === 1) return [mix(L.cruise0, L.desc0, 0.5)];
  if (n === 2) return [climbMid, descMid];
  if (n === 3) return [climbMid, mix(L.cruise0, L.desc0, 0.5), descMid];
  // 4+ — first on the climb, last on the descent, the rest across cruise.
  const out = [climbMid];
  const k = n - 2;
  for (let i = 0; i < k; i++) out.push(mix(L.cruise0, L.desc0, (i + 1) / (k + 1)));
  out.push(descMid);
  return out;
}

/* §2.5 — position is anchored to the waypoints, never to a raw percentage, so
   a three-chapter module jumps in thirds and a twelve-chapter one creeps. */
export const anchors = (n) => [L.start, ...waypointLens(n), L.end];

/* The tangent, sampled either side rather than hard-coded per phase — the
   aircraft noses up on the climb and down on the descent because the path says
   so, not because a lookup table says so. */
export function tangentAt(len) {
  const a = pointAt(Math.max(0, len - 1.2));
  const b = pointAt(Math.min(TOTAL, len + 1.2));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/* §2.5 — the scale factor between the rendered width and the viewBox. Every
   stroke width, dash length, radius and the aircraft's own scale is divided by
   it, or the route renders at about one pixel on a phone. */
export const scaleFor = (renderedW) => (renderedW || VB.w) / VB.w;
export const px = (v, scale) => +(v / (scale || 1)).toFixed(2);

/* §2.4 — below a minimum rendered spacing the individual waypoints are dropped
   and the profile carries position on its own. Counting dots that have merged
   into a dotted line is worse than not offering them to be counted. */
export const MIN_WP_GAP = 15;
export function showWaypoints(wps, scale) {
  if (wps.length < 2) return true;
  let gap = Infinity;
  for (let i = 1; i < wps.length; i++) gap = Math.min(gap, wps[i] - wps[i - 1]);
  return gap * scale >= MIN_WP_GAP;
}

/* §2.4/§5 — the graphic carries no text, so the label carries it instead.
   Text-free is a visual decision, not an accessibility one. */
export function profileLabel(n, step) {
  const total = anchors(n).length - 1;
  const idx = Math.max(0, Math.min(total, step));
  if (idx === 0) return "Flight profile. Not started.";
  if (idx === total) return "Flight profile. Module complete.";
  return `Flight profile. Chapter ${idx} of ${n}, in progress.`;
}

/* Everything a renderer needs for one state, computed in one place. */
export function profileState(n, step, renderedW) {
  const A = anchors(n);
  const idx = Math.max(0, Math.min(A.length - 1, step));
  const here = A[idx];
  const wps = waypointLens(n);
  const scale = scaleFor(renderedW);
  const complete = idx === A.length - 1;
  const started = idx > 0;
  const angle = tangentAt(here);
  const p = pointAt(here);
  // Lifted off the line along the normal while in flight, so the waypoint
  // underneath stays visible and countable. Zero on the ground at either end,
  // or a parked aircraft floats.
  const lift = idx === 0 || complete ? 0 : px(8, scale);
  const nr = (angle * Math.PI) / 180;
  return {
    idx, here, wps, scale, complete, started, angle,
    x: p.x + Math.sin(nr) * lift,
    y: p.y - Math.cos(nr) * lift,
    behind: here,
    showWps: showWaypoints(wps, scale),
    label: profileLabel(n, step),
  };
}
