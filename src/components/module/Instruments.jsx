import { useLayoutEffect, useRef, useState } from "react";
import { mmss } from "./lessonState.js";
import {
  H, PAD, pathFor, pointAt, showDots, labelX as clampLabel,
} from "../../lib/routeGeometry.js";

// The three instruments on the hero strip. Each names itself on its own face,
// so no cell carries a caption, a value line or a "press for…" hint — the
// pressability is in the object: a raised edge, a hover, and a real translate
// on :active.
//
// Every colour here is a token. There is not a hex value in this file, and an
// SVG is exactly the place that rule is easiest to break.

// ---------------------------------------------------------------- 1 · ACCURACY
// A centre-zero ammeter. Centre of the arc is the pass mark; left is below it,
// right is above. The needle shows deviation, and the number on the face is the
// deviation too — not the raw percentage, because the figure a student can act
// on is how far off the pass mark they are.
export function Accuracy({ mean, passMark = 75, onPress }) {
  const has = mean != null;
  const dev = has ? Math.round(mean - passMark) : null;
  // ±25 points fills the arc. Beyond that it pins, which is what a real
  // instrument does rather than running off its own scale.
  const t = has ? Math.max(-1, Math.min(1, dev / 25)) : 0;
  const angle = t * 60;                       // degrees from vertical
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 60, cy = 58, r = 34;
  const nx = cx + Math.cos(rad) * r, ny = cy + Math.sin(rad) * r;

  const label = has
    ? `Accuracy ${dev >= 0 ? "+" : ""}${dev} against a pass mark of ${passMark}`
    : "Accuracy — no quizzes taken yet";

  return (
    <button type="button" className="inst" onClick={onPress} aria-label={label}>
      <svg className="inst-face" viewBox="0 0 120 72" role="img" aria-hidden="true">
        <text className="inst-plate" x="60" y="13" textAnchor="middle">ACCURACY</text>
        {/* the scale, and the half above the pass mark marked as good */}
        <path className="inst-arc" d="M 25 58 A 35 35 0 0 1 95 58" fill="none" />
        <path className="inst-arc-ok" d="M 60 23 A 35 35 0 0 1 95 58" fill="none" />
        <line className="inst-tick" x1="60" y1="21" x2="60" y2="27" />
        <text className="inst-end" x="22" y="68" textAnchor="start">UNDER</text>
        <text className="inst-end" x="98" y="68" textAnchor="end">OVER</text>
        {has && <line className="inst-needle" x1={cx} y1={cy} x2={nx} y2={ny} />}
        <circle className="inst-pivot" cx={cx} cy={cy} r="3.5" />
        <text className="inst-read" x="60" y="50" textAnchor="middle">
          {has ? `${dev >= 0 ? "+" : ""}${dev}` : "--"}
        </text>
      </svg>
    </button>
  );
}

// ------------------------------------------------------------- 2 · RETENTION
// A workshop calibration tag: punched hole, a banded header, the date it was
// last checked, and the holding count on the body.
export function Retention({ holding, due, lastChecked, onPress }) {
  const has = holding > 0 || due > 0;
  const label = has
    ? `Retention — ${holding} questions holding, ${due ? `${due} due for re-check` : "all in date"}`
    : "Retention — nothing to re-check yet";

  return (
    <button type="button" className="inst" onClick={onPress} aria-label={label}>
      <div className="tag" data-empty={has ? undefined : ""}>
        <span className="tag-hole" aria-hidden="true" />
        <span className="tag-band">
          <span>CALIBRATION</span>
          <span className="tag-date">{lastChecked || "—"}</span>
        </span>
        {has ? (
          <span className="tag-body">
            <span className="tag-n">{holding}</span>
            <span className="tag-w">HOLDING</span>
            <span className={due ? "tag-due" : "tag-ok"}>
              {due ? `${due} DUE` : "ALL IN DATE"}
            </span>
          </span>
        ) : (
          <span className="tag-body">
            <span className="tag-w tag-first">FIRST FLIGHT</span>
            <span className="tag-ok">NOTHING TO RE-CHECK YET</span>
          </span>
        )}
      </div>
    </button>
  );
}

// --------------------------------------------------------- 3 · MASTER CAUTION
// A square annunciator. Lit in the caution token above zero, and deliberately
// dark below it — ALL CLEAR rather than a blank face, so an unlit lamp reads as
// nothing wrong instead of something broken.
export function MasterCaution({ count, onPress }) {
  const lit = count > 0;
  return (
    <button type="button" className="inst" onClick={onPress}
            aria-label={lit
              ? `Master caution — ${count} questions to put right`
              : "Master caution — all clear"}>
      <span className="ann" data-lit={lit ? "1" : "0"}>
        <span className="ann-w">MASTER</span>
        <span className="ann-w">CAUTION</span>
        <span className="ann-n">{lit ? count : "ALL CLEAR"}</span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ THE ROUTE
// A shallow climb, a long cruise, a descent that lands ON the ground at the
// right edge. Height carries no data — it is a route, not a chart, and nothing
// is encoded in the vertical axis.
export function Route({ chapters = [], atIndex = 0, started = false }) {
  // Measured rather than stretched. preserveAspectRatio="none" would squash a
  // 1000-unit box into whatever width the card has, turning the waypoint dots
  // into ellipses and the label into condensed type. Drawing 1:1 against the
  // real width costs one observer and distorts nothing.
  const wrapRef = useRef(null);
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.max(240, Math.round(el.getBoundingClientRect().width));
      setW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The geometry moved to lib/routeGeometry.js so it can be measured at forty
  // chapters and a narrow card without rendering anything.
  const d = pathFor(W);
  const n = Math.max(1, chapters.length);
  const at = (i) => pointAt(i, n, W);
  const here = at(Math.max(0, Math.min(n - 1, atIndex)));
  // Clamped against the width of THIS label, not a fixed guess: the string
  // grows with the chapter number and the bound has to grow with it.
  const labelText = `CHAPTER ${atIndex + 1} · YOU ARE HERE`;
  const labelX = clampLabel(here.x, W, labelText);
  // Past the point where waypoints are further apart than they are wide, the
  // dots stop being waypoints and become a dotted rule. The line carries the
  // route on its own and only the current position stays marked.
  const dots = showDots(n, W);

  return (
    <div className="route-wrap" ref={wrapRef}>
      <svg className="route-line" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
           role="img"
           aria-label={started
             ? `Route through ${n} chapters, currently on chapter ${atIndex + 1}`
             : `Route through ${n} chapters, not started`}>
        {/* ahead — dashed and muted. Before any progress this is the whole line. */}
        <path className="route-ahead" d={d} fill="none" />
        {started && (
          <>
            <defs>
              <clipPath id="route-behind">
                <rect x="0" y="0" width={here.x} height={H} />
              </clipPath>
            </defs>
            <path className="route-behind" d={d} fill="none" clipPath="url(#route-behind)" />
          </>
        )}

        {dots && chapters.map((c, i) => {
          const p = at(i);
          return <circle key={c.id || i} className="route-dot"
                         data-passed={started && i <= atIndex ? "1" : "0"}
                         cx={p.x} cy={p.y} r="5" />;
        })}

        <circle className="route-here-ring" cx={here.x} cy={here.y} r="9" />
        <circle className="route-here" cx={here.x} cy={here.y} r="4.5" />
        <text className="route-label" x={labelX} y={here.y - 20} textAnchor="middle">
          {labelText}
        </text>
      </svg>
    </div>
  );
}

export const minutesWord = (secs) => `${Math.max(1, Math.round((secs || 0) / 60))} min`;
export const stamp = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;
};
export { mmss };
