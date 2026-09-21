/* =============================================================================
   THE GUIDE — the demo, walked step by step over the real screens.
   -----------------------------------------------------------------------------
   A light round the part being explained, and a card saying what it is, why
   it is there and how to use it. The screens underneath are the real ones,
   with the demo's class in them, and they are not pressable while the guide
   is up: a click would wander off the walk, and anything it could write is
   the demo's anyway.

   · MOVING IS THE APP'S OWN NAVIGATION (`go`), so a step on another screen
     arrives with the same transition every screen change has.
   · IT WAITS FOR ITS TARGET, then scrolls it into view and follows it while
     the page settles. A step whose target never appears shows its card over
     the dimmed screen rather than pointing at nothing.
   · THE CARD IS SWIPED. It follows a finger or a mouse and settles; a fifth of
     its width, or a flick, goes on or back. The arrow keys and the buttons do
     the same. Escape leaves.
   · Everything that moves is transform and opacity. Smooth Air and
     prefers-reduced-motion mean no motion at all (guide.css).
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { STEPS } from "./steps.js";
import "./guide.css";

const PAD = 10;
const still = () =>
  Boolean(document.querySelector(".app.smooth-air"))
  || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const phone = () => window.innerWidth < 700;

function findTarget(list = []) {
  for (const sel of list) {
    const el = document.querySelector(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) return el;
    }
  }
  return null;
}

export default function Guide({ go, onLeave, hasStamp = false }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const [box, setBox] = useState(null);          // the lit rect, or null
  const [ready, setReady] = useState(false);     // the target has been looked for
  const [cardSize, setCardSize] = useState({ w: 420, h: 260 });
  const [dir, setDir] = useState(1);
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  const drag = useRef(null);

  /* Not pressable underneath, for as long as the guide is up. */
  useEffect(() => {
    const app = document.querySelector(".app");
    app?.setAttribute("data-demo", "1");
    return () => app?.removeAttribute("data-demo");
  }, []);

  /* ------------------------------------------------ going to a step */
  useEffect(() => {
    let live = true;
    let timer = 0;
    setReady(false);
    targetRef.current = null;
    if (step.where && window.location.pathname !== step.where) go(step.where);
    let acted = false;
    let tries = 0;
    const hunt = () => {
      if (!live) return;
      const onScreen = !step.where || window.location.pathname === step.where;
      if (onScreen && step.act && !acted) { acted = true; step.act(); timer = setTimeout(hunt, 350); return; }
      const el = onScreen ? findTarget(step.find) : null;
      if (el || (onScreen && !step.find)) {
        targetRef.current = el;
        if (el) {
          el.scrollIntoView({ block: phone() ? "start" : "center", inline: "nearest", behavior: still() ? "auto" : "smooth" });
        }
        setReady(true);
        return;
      }
      if (++tries > 45) { setReady(true); return; }   // never a light on nothing
      timer = setTimeout(hunt, 80);
    };
    timer = setTimeout(hunt, 60);
    return () => { live = false; clearTimeout(timer); };
  }, [i]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------------------ following the target */
  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    let settle = 0;
    const measure = () => {
      const el = targetRef.current;
      if (!el || !el.isConnected) { setBox(null); return; }
      const r = el.getBoundingClientRect();
      setBox((was) => (was && Math.abs(was.top - r.top) < 0.5 && Math.abs(was.left - r.left) < 0.5
        && Math.abs(was.width - r.width) < 0.5 && Math.abs(was.height - r.height) < 0.5
        ? was : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    /* Every frame for the first 900ms, while a smooth scroll and a screen
       transition settle; after that only when the page moves. */
    const start = performance.now();
    const loop = () => { measure(); if (performance.now() - start < 900) raf = requestAnimationFrame(loop); };
    loop();
    const onMove = () => { cancelAnimationFrame(settle); settle = requestAnimationFrame(measure); };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(settle);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [ready, i]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    setCardSize((was) => (was.w === w && was.h === h ? was : { w, h }));
  }, [i, ready]);

  /* ----------------------------------------------------- moving */
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

  /* ------------------------------------------------- the swipe */
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
      if (d.axis === "x") cardRef.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    d.trail.push({ x: e.clientX, t: e.timeStamp });
    while (d.trail.length > 2 && e.timeStamp - d.trail[0].t > 100) d.trail.shift();
    const edge = (i === 0 && dx > 0) || (i === STEPS.length - 1 && dx < 0);
    d.dx = edge ? dx / 3 : dx;
    if (cardRef.current) { cardRef.current.style.setProperty("--drag", `${d.dx}px`); cardRef.current.dataset.dragging = "1"; }
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (cardRef.current) { cardRef.current.style.setProperty("--drag", "0px"); delete cardRef.current.dataset.dragging; }
    if (!d || d.id !== e.pointerId || d.axis !== "x") return;
    const a = d.trail[0];
    const z = d.trail[d.trail.length - 1];
    const span = z.t - a.t;
    const vx = span >= 20 ? (z.x - a.x) / span : 0;
    const far = Math.abs(d.dx) > (cardRef.current?.offsetWidth || 400) * 0.2;
    const flick = Math.abs(vx) > 0.45 && Math.abs(d.dx) > 24;
    if ((far || flick) && d.dx < 0) next();
    else if ((far || flick) && d.dx > 0) back();
  };

  /* -------------------------------------------- where things go */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const lit = box && ready && {
    x: Math.max(4, box.left - PAD),
    y: Math.max(4, box.top - PAD),
    w: Math.min(vw - 8, box.width + PAD * 2),
    h: Math.min(vh - 8, box.height + PAD * 2),
  };
  const { w: cw, h: ch } = cardSize;
  let cardAt;
  if (phone()) {
    cardAt = { x: 0, y: vh - ch };
  } else if (!lit) {
    cardAt = { x: (vw - cw) / 2, y: (vh - ch) / 2 };
  } else {
    const gap = 18;
    const right = vw - (lit.x + lit.w) - gap;
    const left = lit.x - gap;
    const below = vh - (lit.y + lit.h) - gap;
    const above = lit.y - gap;
    const midY = Math.min(vh - ch - 16, Math.max(16, lit.y + lit.h / 2 - ch / 2));
    const midX = Math.min(vw - cw - 16, Math.max(16, lit.x + lit.w / 2 - cw / 2));
    if (right >= cw + 16) cardAt = { x: lit.x + lit.w + gap, y: midY };
    else if (left >= cw + 16) cardAt = { x: lit.x - gap - cw, y: midY };
    else if (below >= ch + 16) cardAt = { x: midX, y: lit.y + lit.h + gap };
    else if (above >= ch + 16) cardAt = { x: midX, y: lit.y - gap - ch };
    else cardAt = { x: vw - cw - 20, y: vh - ch - 20 };   // over a big target, in its corner
  }

  const inSection = STEPS.filter((s) => s.section === step.section);
  const nth = inSection.indexOf(step) + 1;
  const last = i === STEPS.length - 1;

  return (
    <div className="dg" role="dialog" aria-modal="true" aria-label="A walkthrough of Wingman">
      {lit
        ? <div className="dg-light" style={{ transform: `translate3d(${lit.x}px,${lit.y}px,0)`, width: lit.w, height: lit.h }} aria-hidden="true" />
        : <div className="dg-dim" aria-hidden="true" />}

      <div ref={cardRef} className={`dg-card${phone() ? " is-sheet" : ""}`}
           style={{ transform: `translate3d(calc(${Math.round(cardAt.x)}px + var(--drag, 0px)),${Math.round(cardAt.y)}px,0)` }}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="dg-top">
          <span className="dg-kicker">{step.section}{inSection.length > 1 ? ` · ${nth} of ${inSection.length}` : ""}</span>
          <button type="button" className="dg-leave is-inline" onClick={() => onLeave?.("leave")}>Leave demo</button>
        </div>
        <div className="dg-bar" aria-hidden="true"><i style={{ transform: `scaleX(${(i + 1) / STEPS.length})` }} /></div>

        <div key={i} className={`dg-body ${dir > 0 ? "from-right" : "from-left"}`} aria-live="polite">
          <h2 className="dg-title">{step.title}</h2>
          {step.body
            ? step.body.map((p, k) => <p key={k} className="dg-p">{p}</p>)
            : (
              <dl className="dg-wwh">
                <dt>What</dt><dd>{step.what}</dd>
                <dt>Why</dt><dd>{step.why}</dd>
                <dt>How</dt><dd>{step.how}</dd>
              </dl>
            )}
        </div>

        <div className="dg-acts">
          <button type="button" className="dg-back" onClick={back} disabled={i === 0}>Back</button>
          <span className="dg-count">{i + 1} / {STEPS.length}</span>
          <button type="button" className="dg-next" onClick={next}>
            {last ? (hasStamp ? "Back to my account" : "Create my licence") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
