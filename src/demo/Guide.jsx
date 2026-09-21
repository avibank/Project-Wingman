/* =============================================================================
   THE TUTORIAL — a light moving over the real app, and a small card.
   -----------------------------------------------------------------------------
   The owner (2026-09-21): sweet, clean, explanatory, and smoother than the
   first version. What made that one stutter, measured rather than guessed:

   · THE LIGHT WAS A 200vmax BOX-SHADOW whose width and height transitioned.
     Every frame of every move repainted the whole screen.
   · IT WAS CHASING ITSELF. While the page scrolled the target moved every
     frame, and each new position restarted a 550ms CSS transition, so the
     light lagged and wobbled behind anything that moved.

   So the dim is FOUR SOLID PANELS round a hole, and each is only ever moved
   and scaled by transform: the compositor does it, nothing repaints. One
   loop reads the target every frame and eases the hole towards it
   (1 - e^(-dt/τ)), which follows a scroll as smoothly as it glides between
   targets, with nothing to restart. Between screens the hole closes to the
   centre like an iris, and opens again on the next target when it arrives.
   The card is placed only once the light has settled, so it never jitters,
   and it glides there by transform.

   The app underneath is the real one with the demo's class in it, and it is
   not pressable while the tutorial is up. Swipe the card, use the arrows,
   or press Next. It can always be skipped.
   Smooth Air and prefers-reduced-motion: the light jumps, nothing eases.
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STEPS } from "./steps.js";
import "./guide.css";

const PAD = 8;           // how far the light spills past its target
const TAU = 120;         // ms: the easing time constant of the light
const TAU_CLOSE = 55;    // ms: closing for a screen change, faster, so it is shut before the screen swaps
const SWEEP_MS = 1800;   // a sweep step's dwell on each target
const still = () =>
  Boolean(document.querySelector(".app.smooth-air"))
  || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const phone = () => window.innerWidth < 700;

const pick = (list = []) => {
  for (const f of list) {
    const el = typeof f === "function" ? f() : document.querySelector(f);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) return el;
    }
  }
  return null;
};
const padded = (r) => ({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
const union = (els) => {
  const rs = els.map((e) => e.getBoundingClientRect());
  const x = Math.min(...rs.map((r) => r.left));
  const y = Math.min(...rs.map((r) => r.top));
  return { left: x, top: y, width: Math.max(...rs.map((r) => r.right)) - x, height: Math.max(...rs.map((r) => r.bottom)) - y };
};
function scroller(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n).overflowY;
    if ((s === "auto" || s === "scroll") && n.scrollHeight > n.clientHeight + 4) return n;
  }
  return null;
}
/* Into view, and clear of the card: centred on a wide screen, centred in the
   part above the sheet on a phone. */
function bringIntoView(el, sheetH) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const room = phone() ? vh - sheetH - 16 : vh;
  const want = Math.max(72, (room - r.height) / 2);
  const delta = r.top - want;
  if (Math.abs(delta) < 24) return;
  const box = scroller(el);
  const behavior = still() ? "auto" : "smooth";
  if (box) box.scrollBy({ top: delta, behavior });
  else window.scrollBy({ top: delta, behavior });
}

export default function Guide({ go, warm, onLeave, hasStamp = false, guest = false }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [cardAt, setCardAt] = useState(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const panels = useRef([]);       // top, bottom, left, right
  const ring = useRef(null);
  const card = useRef(null);
  const target = useRef(null);     // element being lit, or null
  const sweepEls = useRef(null);   // a sweep step's elements, for placing the card
  const hole = useRef(null);       // where the hole is now
  const settledAt = useRef(null);  // the rect the card was last placed against
  const drag = useRef(null);

  /* EVERY SCREEN IT WILL VISIT IS LOADED WHILE THE FIRST STEP IS READ, so a
     move between screens never waits for code. Measured before this: the
     step from the Flight Deck into a module took its worst frame at 133ms,
     which was the module screen's chunk arriving. */
  useEffect(() => {
    const t = setTimeout(() => warm?.([...new Set(STEPS.map((s) => s.where).filter(Boolean))]), 500);
    return () => clearTimeout(t);
  }, [warm]);

  /* Not pressable underneath, for as long as the tutorial is up. */
  useEffect(() => {
    const app = document.querySelector(".app");
    app?.setAttribute("data-demo", "1");
    return () => app?.removeAttribute("data-demo");
  }, []);

  /* Where the card goes against a lit rect (null: the middle of the screen). */
  const place = useCallback((r) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.current?.offsetWidth || 360;
    const ch = card.current?.offsetHeight || 220;
    if (phone()) return { x: 0, y: vh - ch };
    if (!r) return { x: (vw - cw) / 2, y: (vh - ch) / 2 };
    const gap = 20;
    const clampX = (x) => Math.min(vw - cw - 16, Math.max(16, x));
    const clampY = (y) => Math.min(vh - ch - 16, Math.max(16, y));
    const midX = clampX(r.x + r.w / 2 - cw / 2);
    const midY = clampY(r.y + r.h / 2 - ch / 2);
    if (vh - (r.y + r.h) - gap >= ch + 16) return { x: midX, y: r.y + r.h + gap };
    if (r.y - gap >= ch + 16) return { x: midX, y: r.y - gap - ch };
    if (vw - (r.x + r.w) - gap >= cw + 16) return { x: r.x + r.w + gap, y: midY };
    if (r.x - gap >= cw + 16) return { x: r.x - gap - cw, y: midY };
    return { x: vw - cw - 24, y: vh - ch - 24 };
  }, []);

  /* ---------------------------------------------------- the light's loop */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const closed = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 });
    if (!hole.current) hole.current = closed();
    const paint = (h) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      /* EVERY EDGE ON A WHOLE DEVICE PIXEL. Four panels meeting on fractional
         edges each antialias their own side, and the seam shows as a line
         across the whole window (measured: a one-pixel overlap drew a dark
         one, no overlap drew a light one). Snapped, they meet exactly. */
      const dpr = window.devicePixelRatio || 1;
      const snap = (v) => Math.round(v * dpr) / dpr;
      const x = snap(Math.max(0, Math.min(vw, h.x)));
      const y = snap(Math.max(0, Math.min(vh, h.y)));
      const w = snap(Math.max(0, Math.min(vw - x, h.w)));
      const hh = snap(Math.max(0, Math.min(vh - y, h.h)));
      const [t, b, l, r] = panels.current;
      if (!t) return;
      t.style.transform = `scale(1,${y / vh})`;
      b.style.transform = `translate3d(0,${y + hh}px,0) scale(1,${(vh - y - hh) / vh})`;
      l.style.transform = `translate3d(0,${y}px,0) scale(${x / vw},${hh / vh})`;
      r.style.transform = `translate3d(${x + w}px,${y}px,0) scale(${(vw - x - w) / vw},${hh / vh})`;
      const g = ring.current;
      if (g) {
        g.style.transform = `translate3d(${x}px,${y}px,0)`;
        g.style.width = `${w}px`;
        g.style.height = `${hh}px`;
        g.style.opacity = w > 6 && hh > 6 ? "1" : "0";
      }
    };
    const tick = (now) => {
      const dt = Math.min(64, now - prev);
      prev = now;
      const el = target.current;
      const goal = el && el.isConnected ? padded(el.getBoundingClientRect()) : closed();
      const k = still() ? 1 : 1 - Math.exp(-dt / (el ? TAU : TAU_CLOSE));
      const h = hole.current;
      h.x += (goal.x - h.x) * k;
      h.y += (goal.y - h.y) * k;
      h.w += (goal.w - h.w) * k;
      h.h += (goal.h - h.h) * k;
      paint(h);
      /* The card is placed once the light has arrived, and again only if the
         target itself has moved on (a scroll, a resize). */
      const arrived = Math.abs(goal.x - h.x) + Math.abs(goal.y - h.y) + Math.abs(goal.w - h.w) + Math.abs(goal.h - h.h) < 2;
      if (arrived && el) {
        const basis = sweepEls.current?.length ? padded(union(sweepEls.current)) : goal;
        const was = settledAt.current;
        if (!was || Math.abs(was.x - basis.x) + Math.abs(was.y - basis.y) + Math.abs(was.w - basis.w) + Math.abs(was.h - basis.h) > 6) {
          settledAt.current = basis;
          setCardAt(place(basis));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const onResize = () => { settledAt.current = null; };
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [place]);

  /* ----------------------------------------------------- going to a step */
  useEffect(() => {
    let live = true;
    let timer = 0;
    let sweepTimer = 0;
    target.current = null;          // the hole closes towards the middle
    sweepEls.current = null;
    settledAt.current = null;
    /* A NEW SCREEN IS SHOWN ONLY ONCE THE LIGHT HAS CLOSED. Rendering a
       screen is the one thing here that can hold a frame, and done under a
       closed iris nothing is moving to stutter; the light opens when the
       screen is there. */
    const moving = step.where && window.location.pathname !== step.where;
    let navTimer = 0;
    if (moving) navTimer = setTimeout(() => { if (live) go(step.where); }, still() ? 0 : 260);
    let acted = false;
    let tries = 0;
    const onScreen = () => !step.where || window.location.pathname === step.where;
    const hunt = () => {
      if (!live) return;
      if (!onScreen()) { if (++tries < 60) timer = setTimeout(hunt, 80); return; }
      if (step.act && !acted) { acted = true; step.act(); timer = setTimeout(hunt, 320); return; }
      if (step.sweep) {
        const els = step.sweep.map((s) => pick([s])).filter(Boolean);
        if (els.length) {
          sweepEls.current = els;
          bringIntoView(els[0].parentElement || els[0], card.current?.offsetHeight || 0);
          let k = 0;
          target.current = els[0];
          const on = () => { if (!live) return; k = (k + 1) % els.length; target.current = els[k]; sweepTimer = setTimeout(on, SWEEP_MS); };
          sweepTimer = setTimeout(on, SWEEP_MS);
          return;
        }
      } else if (step.find) {
        const el = pick(step.find);
        if (el) { bringIntoView(el, card.current?.offsetHeight || 0); target.current = el; return; }
      } else {
        return;                     // a step with nothing to light: the whole screen dims
      }
      if (++tries > 50) { setCardAt(place(null)); return; }   // never a light on nothing
      timer = setTimeout(hunt, 80);
    };
    /* Pressing something (opening a chat) renders too, so it waits for the
       closed light as a screen change does. */
    timer = setTimeout(hunt, moving || step.act ? 320 : 40);
    return () => { live = false; clearTimeout(timer); clearTimeout(sweepTimer); clearTimeout(navTimer); };
  }, [i]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* A step with no target has its card in the middle straight away. */
  useLayoutEffect(() => {
    if (!step.find && !step.sweep) setCardAt(place(null));
  }, [i, place, step.find, step.sweep]);

  /* --------------------------------------------------------------- moving */
  const next = useCallback(() => {
    if (i + 1 < STEPS.length) { setDir(1); setI(i + 1); } else onLeave?.("finish");
  }, [i, onLeave]);
  const back = useCallback(() => { if (i > 0) { setDir(-1); setI(i - 1); } }, [i]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Escape") { e.preventDefault(); onLeave?.("leave"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, back, onLeave]);

  /* ------------------------------------------------------------ the swipe */
  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, axis: null, trail: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") card.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.trail.push({ x: e.clientX, t: e.timeStamp });
    while (d.trail.length > 2 && e.timeStamp - d.trail[0].t > 100) d.trail.shift();
    const edge = (i === 0 && dx > 0) || (last && dx < 0);
    d.dx = edge ? dx / 3 : dx;
    if (card.current) { card.current.style.setProperty("--drag", `${d.dx}px`); card.current.dataset.dragging = "1"; }
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (card.current) { card.current.style.setProperty("--drag", "0px"); delete card.current.dataset.dragging; }
    if (!d || d.id !== e.pointerId || d.axis !== "x") return;
    const a = d.trail[0];
    const z = d.trail[d.trail.length - 1];
    const span = z.t - a.t;
    const vx = span >= 20 ? (z.x - a.x) / span : 0;
    const far = Math.abs(d.dx) > (card.current?.offsetWidth || 360) * 0.2;
    const flick = Math.abs(vx) > 0.45 && Math.abs(d.dx) > 24;
    if ((far || flick) && d.dx < 0) next();
    else if ((far || flick) && d.dx > 0) back();
  };

  const at = cardAt || { x: (window.innerWidth - 360) / 2, y: window.innerHeight };
  const finish = guest ? "Create my account" : hasStamp ? "Done" : "Create my licence";

  return (
    <div className="dg" role="dialog" aria-modal="true" aria-label="A tour of Wingman">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="dg-panel" aria-hidden="true" ref={(el) => { panels.current[k] = el; }} />
      ))}
      <div className="dg-ring" ref={ring} aria-hidden="true" />

      <div ref={card} className={`dg-card${phone() ? " is-sheet" : ""}`}
           style={{ transform: `translate3d(calc(${Math.round(at.x)}px + var(--drag, 0px)),${Math.round(at.y)}px,0)` }}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="dg-top">
          <span className="dg-kicker">{step.section}</span>
          <button type="button" className="dg-skip is-inline" onClick={() => onLeave?.("leave")}>Skip</button>
        </div>

        <div key={i} className={`dg-body ${dir > 0 ? "from-right" : "from-left"}`} aria-live="polite">
          <h2 className="dg-title">{step.title}</h2>
          <p className="dg-text">{step.text}</p>
          {step.note && <p className="dg-note">{step.note}</p>}
        </div>

        <div className="dg-acts">
          <button type="button" className="dg-back is-inline" onClick={back} disabled={i === 0}>Back</button>
          <div className="dg-dots" aria-hidden="true">
            {STEPS.map((s, k) => <i key={k} className={k === i ? "on" : k < i ? "was" : undefined} />)}
          </div>
          <button type="button" className="dg-next" onClick={next}>{last ? finish : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
