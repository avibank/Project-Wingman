import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { chapterX, clusterByPixel, initials, profileY, routePath } from "./route.js";

/* The module's flight profile with the people on it.
   Dashed trail, a circle at every chapter as a resting point, faces above the
   stops. Everything is measured in pixels so nothing stretches out of shape.

   Only people with a chapter are on the route. Somebody in your squadron who
   is not studying right now has no position, and drawing them at chapter
   "null" would put a face at NaN. */
export function RouteStrip({
  chapters,
  youChapter,
  people,          // [{ id, name, chapter, seat }]
  sourceLabel,     // "Your squadron" | "Also on Module 1" | ...
  onOpenPerson,
  onFindSeat,
}) {
  const hostRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [openStack, setOpenStack] = useState(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = people.filter((p) => p.chapter != null);

  useEffect(() => { setOpenStack(null); }, [chapters, youChapter, placed.length, width]);

  const h = hostRef.current?.clientHeight || 190;
  const tight = width < 470;
  const PADX = tight ? 12 : 16;
  const TOPPAD = tight ? 56 : 76;
  const BOTPAD = tight ? 24 : 38;

  const sx = (width - PADX * 2) / 134;
  const sy = (h - TOPPAD - BOTPAD) / 75;
  const mapX = (x) => PADX + (x - 5) * sx;
  const mapY = (x) => TOPPAD + (profileY(x) - 7) * sy;

  const youX = chapterX(youChapter - 1, chapters);
  const youPx = mapX(youX);
  const stops = (width - PADX * 2) / Math.max(1, chapters - 1) > 15;
  const roomy = width > 430;

  const groups = width ? clusterByPixel(placed, chapters, mapX, tight ? 34 : 42) : [];

  return (
    <div className="bog-card">
      <div className="bog-rhead">
        <span className="bog-rname">On your route</span>
        <span className="bog-rsrc">{sourceLabel}</span>
      </div>

      <div className="bog-route" ref={hostRef}>
        {width > 0 && (
          <svg viewBox={`0 0 ${width} ${h}`} aria-hidden="true">
            <defs>
              <clipPath id="bog-flown">
                <rect x="0" y="0" width={youPx.toFixed(1)} height={h} />
              </clipPath>
            </defs>
            <path d={routePath(mapX, mapY)} fill="none" stroke="var(--line)"
                  strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 7" />
            <path d={routePath(mapX, mapY)} fill="none" stroke="var(--active)"
                  strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 7"
                  clipPath="url(#bog-flown)" />

            {stops && Array.from({ length: chapters }, (_, k) => {
              const cx = chapterX(k, chapters);
              const px = mapX(cx), py = mapY(cx);
              const done = cx <= youX + 0.01;
              const here = Math.abs(cx - youX) < 0.01;
              if (here) {
                return (
                  <g key={k}>
                    <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={tight ? 6 : 7}
                            fill="var(--ground)" stroke="var(--active)" strokeWidth="2" />
                    <circle cx={px.toFixed(1)} cy={py.toFixed(1)} r={tight ? 2.6 : 3} fill="var(--active)" />
                  </g>
                );
              }
              return (
                <circle key={k} cx={px.toFixed(1)} cy={py.toFixed(1)} r={tight ? 4.2 : 5}
                        fill={done ? "var(--active)" : "var(--ground)"}
                        stroke={done ? "var(--active)" : "var(--line)"} strokeWidth="1.6" />
              );
            })}
          </svg>
        )}

        {groups.map((g) => {
          const key = g.members.map((m) => m.id).join(",");
          const style = { left: `${g.px.toFixed(1)}px`, top: `${mapY(g.x).toFixed(1)}px` };
          const lift = Math.abs(g.px - youPx) < 44 ? "" : undefined;

          if (g.members.length === 1) {
            const p = g.members[0];
            return (
              <div className="bog-mark" key={key} data-seat={p.seat ? "" : undefined}
                   data-lift={lift} style={style}>
                <button className="bog-av is-inline" type="button"
                        onClick={() => onOpenPerson?.(p)}
                        aria-label={`${p.name}, chapter ${g.chapters[0]}`}>
                  {initials(p.name)}
                </button>
                {roomy && <span className="bog-who">{p.name.slice(0, 8)}</span>}
              </div>
            );
          }

          if (openStack === key) {
            return (
              <div className="bog-mark" key={key} data-lift={lift} style={style}>
                <span className="bog-fanpod">
                  {g.members.map((m) => (
                    <button className="bog-podface is-inline" type="button" key={m.id}
                            data-seat={m.seat ? "" : undefined}
                            onClick={() => onOpenPerson?.(m)} aria-label={m.name}>
                      {initials(m.name)}
                    </button>
                  ))}
                </span>
              </div>
            );
          }

          return (
            <div className="bog-mark" key={key} data-lift={lift} style={style}>
              <button className="bog-av is-inline" type="button" data-count=""
                      aria-expanded="false"
                      onClick={() => setOpenStack(key)}
                      aria-label={`${g.members.length} people around chapter ${g.chapters[0]}`}>
                {g.members.length}
              </button>
            </div>
          );
        })}

        {width > 0 && (
          <div className="bog-mark" data-you=""
               style={{ left: `${youPx.toFixed(1)}px`, top: `${mapY(youX).toFixed(1)}px` }}>
            <span className="bog-av bog-you" aria-label={`You, chapter ${youChapter}`}>YOU</span>
            {roomy && <span className="bog-who">Ch {youChapter}</span>}
          </div>
        )}
      </div>

      {placed.length === 0 && (
        <div className="bog-alone">
          <p>A right seat puts someone on this route.</p>
          <button className="bog-btn is-inline" type="button" onClick={onFindSeat}>Find a right seat</button>
        </div>
      )}
    </div>
  );
}
