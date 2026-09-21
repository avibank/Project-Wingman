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

   THE CARD DOES NOT MOVE. It used to follow the light, placed beside each
   target once the light had settled and gliding there by transform, and the
   owner's word for it was that it "lags around": every step, the thing you
   are reading set off across the screen a beat after you pressed Next. So it
   is docked, at the foot of the window (or as a sheet on a phone), and the
   page is scrolled so the target sits clear of it. Only when a target cannot
   be scrolled clear, because the screen does not scroll there (the Ready
   Room's composer is fixed to the bottom of the window), does the card move
   to the top instead, and then it fades across rather than travelling.

   The app underneath is the real one with the demo's class in it, and it is
   not pressable while the tutorial is up. Swipe the card, use the arrows,
   or press Next. It can always be skipped.
   Smooth Air and prefers-reduced-motion: the light jumps, nothing eases.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";
import { STEPS } from "./steps.js";
import "./guide.css";

const PAD = 8;           // how far the light spills past its target
const TAU = 120;         // ms: the easing time constant of the light
const TAU_CLOSE = 55;    // ms: closing for a screen change, faster, so it is shut before the screen swaps
const GAP = 16;          // the docked card's distance from the window's edge
const CARD_W = 600;      // the docked card's width on a wide screen
const TOP_CLEAR = 84;    // below the app bar: the highest a target is scrolled to
const still = () =>
  Boolean(document.querySelector(".app.smooth-air"))
  || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const phone = () => window.innerWidth < 700;

/* A target is an element, or a few that are lit as one (a function in a step
   may return an array: the player's three buttons, say). */
const rectOf = (t) => {
  if (!Array.isArray(t)) return t.getBoundingClientRect();
  const rs = t.map((e) => e.getBoundingClientRect());
  const left = Math.min(...rs.map((r) => r.left));
  const top = Math.min(...rs.map((r) => r.top));
  return { left, top, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
};
const connected = (t) => (Array.isArray(t) ? t.every((e) => e.isConnected) : t.isConnected);
/* The first thing on the list that is on the page and has a size. Every match
   of a selector is tried, not just the first: a closed chapter's rows are in
   the page at no height, ahead of the open one's. */
const sized = (t) => {
  if (!t || (Array.isArray(t) && (!t.length || t.some((e) => !e)))) return false;
  const r = rectOf(t);
  return r.width > 4 && r.height > 4;
};
const pick = (list = []) => {
  for (const f of list) {
    const el = typeof f === "function" ? f() : [...document.querySelectorAll(f)].find(sized);
    if (sized(el)) return el;
  }
  return null;
};
const padded = (r) => ({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
function scroller(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n).overflowY;
    if ((s === "auto" || s === "scroll") && n.scrollHeight > n.clientHeight + 4) return n;
  }
  return null;
}
/* Where the docked card sits, as a rect, for a card `h` tall. */
function dockRect(side, h) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = phone() ? 0 : GAP;
  const w = phone() ? vw : Math.min(CARD_W, vw - 32);
  return { x: (vw - w) / 2, y: side === "top" ? m : vh - m - h, w, h };
}
const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/* How to show `el` beside a card `h` tall: which edge the card docks on, and
   how far to scroll. The foot of the window, with the target centred in the
   room above the card, whenever the page can scroll it there; the top when
   it cannot; and whichever covers less of it when neither is clear. */
function plan(el, h) {
  const r = rectOf(el);
  const vh = window.innerHeight;
  const box = scroller(Array.isArray(el) ? el[0] : el);
  const cur = box ? box.scrollTop : window.scrollY;
  const max = box ? box.scrollHeight - box.clientHeight : document.documentElement.scrollHeight - vh;
  const option = (side) => {
    const band = dockRect(side, h);
    const lo = side === "top" ? band.y + band.h + 20 : TOP_CLEAR;
    const hi = side === "top" ? vh - 20 : band.y - 20;
    const want = lo + Math.max(0, (hi - lo - r.height) / 2);
    let delta = Math.max(-cur, Math.min(max - cur, r.top - want));
    if (Math.abs(delta) < 24) delta = 0;
    const lit = padded({ left: r.left, top: r.top - delta, width: r.width, height: r.height });
    return { side, delta, covered: overlap(lit, band) };
  };
  const bottom = option("bottom");
  if (!bottom.covered) return bottom;
  const top = option("top");
  return top.covered < bottom.covered ? top : bottom;
}
function scrollBy(el, delta) {
  if (!delta) return;
  const box = scroller(Array.isArray(el) ? el[0] : el);
  const behavior = still() ? "auto" : "smooth";
  if (box) box.scrollBy({ top: delta, behavior });
  else window.scrollBy({ top: delta, behavior });
}

export default function Guide({ go, warm, onLeave, hasStamp = false, guest = false }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [dock, setDock] = useState("bottom");
  const [away, setAway] = useState(false);
  const [, setWidth] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const panels = useRef([]);       // top, bottom, left, right
  const ring = useRef(null);
  const card = useRef(null);
  const target = useRef(null);     // element being lit, or null
  const hole = useRef(null);       // where the hole is now
  const docked = useRef("bottom"); // the edge the card is on, or going to
  const swap = useRef(0);
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

  /* The card changes edge by fading out, and in again on the other side. It
     never travels across the screen. */
  const dockTo = useCallback((side) => {
    if (docked.current === side) return;
    docked.current = side;
    clearTimeout(swap.current);
    if (still()) { setDock(side); return; }
    setAway(true);
    swap.current = setTimeout(() => { setDock(side); setAway(false); }, 170);
  }, []);
  useEffect(() => () => clearTimeout(swap.current), []);

  /* A phone turned on its side is a different screen: the sheet or the card. */
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
      const goal = el && connected(el) ? padded(rectOf(el)) : closed();
      const k = still() ? 1 : 1 - Math.exp(-dt / (el ? TAU : TAU_CLOSE));
      const h = hole.current;
      h.x += (goal.x - h.x) * k;
      h.y += (goal.y - h.y) * k;
      h.w += (goal.w - h.w) * k;
      h.h += (goal.h - h.h) * k;
      paint(h);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ----------------------------------------------------- going to a step */
  useEffect(() => {
    let live = true;
    let timer = 0;
    let check = 0;
    target.current = null;          // the hole closes towards the middle
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
    const cardH = () => card.current?.offsetHeight || 220;
    /* Once any scroll has finished: if the page could not put the target
       where the plan said (it grew, or a column opened), the card takes the
       other edge rather than sit on what it is describing. */
    const settle = (el) => {
      if (!live || !connected(el)) return;
      const lit = padded(rectOf(el));
      const here = docked.current;
      const there = here === "top" ? "bottom" : "top";
      if (overlap(lit, dockRect(here, cardH())) > overlap(lit, dockRect(there, cardH()))) dockTo(there);
    };
    const hunt = () => {
      if (!live) return;
      if (!onScreen()) { if (++tries < 60) timer = setTimeout(hunt, 80); return; }
      if (step.act && !acted) { acted = true; step.act(); timer = setTimeout(hunt, 320); return; }
      if (!step.find) { dockTo("bottom"); return; }   // nothing to light: the whole screen dims
      const el = pick(step.find);
      if (el) {
        const p = plan(el, cardH());
        dockTo(p.side);
        scrollBy(el, p.delta);
        target.current = el;
        check = setTimeout(() => settle(el), p.delta ? 700 : 120);
        return;
      }
      if (++tries > 50) { dockTo("bottom"); return; }  // never a light on nothing
      timer = setTimeout(hunt, 80);
    };
    /* Pressing something (opening a chat) renders too, so it waits for the
       closed light as a screen change does. */
    timer = setTimeout(hunt, moving || step.act ? 320 : 40);
    return () => { live = false; clearTimeout(timer); clearTimeout(check); clearTimeout(navTimer); };
  }, [i]);

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

  const finish = guest ? "Create my account" : hasStamp ? "Done" : "Create my licence";
  /* Where you are: the page, and how far through it. A dot a step stopped
     fitting once every page had its own steps. */
  const ofPage = STEPS.filter((s) => s.section === step.section).length;
  const onPage = STEPS.slice(0, i + 1).filter((s) => s.section === step.section).length;

  return (
    <div className="dg" role="dialog" aria-modal="true" aria-label="A tour of Wingman">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="dg-panel" aria-hidden="true" ref={(el) => { panels.current[k] = el; }} />
      ))}
      <div className="dg-ring" ref={ring} aria-hidden="true" />

      <div ref={card} className={`dg-card${phone() ? " is-sheet" : ""}${away ? " is-away" : ""}`} data-dock={dock}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="dg-bar" aria-hidden="true"><i style={{ transform: `scaleX(${(i + 1) / STEPS.length})` }} /></div>
        <div className="dg-top">
          <span className="dg-kicker">
            {step.section}
            {ofPage > 1 && <span className="dg-count">{onPage} of {ofPage}</span>}
          </span>
          <button type="button" className="dg-skip is-inline" onClick={() => onLeave?.("leave")}>Skip</button>
        </div>

        <div key={i} className={`dg-body ${dir > 0 ? "from-right" : "from-left"}`} aria-live="polite">
          <h2 className="dg-title">{step.title}</h2>
          <p className="dg-text">{step.text}</p>
          {step.note && <p className="dg-note">{step.note}</p>}
        </div>

        <div className="dg-acts">
          <button type="button" className="dg-back is-inline" onClick={back} disabled={i === 0}>Back</button>
          <span />
          <button type="button" className="dg-next" onClick={next}>{last ? finish : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
