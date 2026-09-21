/* =============================================================================
   THE WALKTHROUGH — twelve slides you swipe through.
   -----------------------------------------------------------------------------
   One full-screen layer with a strip of slides in it. Moving between slides is
   ONE transform on that strip, and while a finger or a mouse is dragging it
   the transform is written straight to the element: no React render per
   pointer move, no route change, nothing to load. That is the whole of why
   this is smooth where the spotlight version it replaces was not.

   · A SWIPE FOLLOWS THE FINGER and settles on release: past a fifth of the
     width, or flicked, it goes on; otherwise it springs back. Past either end
     it resists (a third of the travel) rather than stopping dead.
   · A VERTICAL DRAG IS LEFT ALONE. The first few pixels decide the axis, and
     `touch-action: pan-y` lets a long slide scroll on a short phone.
   · The arrow keys, Enter and the two buttons do the same thing as a swipe.
     Escape skips.
   · Smooth Air and prefers-reduced-motion mean NO motion: the strip jumps and
     the drawings stand still (tour.css).

   · THE APP UNDERNEATH IS HIDDEN while it is up, once it has faded in. It
     is covered completely, but it was still animating and repainting: in the
     harness the Flight Deck drew four frames a second behind this layer, and
     sixty once it was hidden (measured, 2026-09-21). That, not this file, was
     most of what felt slow. It comes back as the walkthrough fades out, so
     leaving is a crossfade rather than a cut.

   Finishing it and skipping it are both an answer. App.jsx settles the tour
   either way and, for a student with no stamp yet, opens the licence next.
   ========================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SLIDES } from "./tourSteps.js";
import Scene from "./Scenes.jsx";
import "./tour.css";

const EASE = "cubic-bezier(.22,1,.36,1)";
const still = () =>
  Boolean(document.querySelector(".app.smooth-air"))
  || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Tour({ onClose, onDone, hasStamp = false }) {
  const n = SLIDES.length;
  const [i, setI] = useState(0);
  const at = useRef(0);
  const view = useRef(null);
  const track = useRef(null);
  const drag = useRef(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const app = document.querySelector(".app");
    const t = setTimeout(() => app?.setAttribute("data-tour", "1"), still() ? 0 : 400);
    return () => { clearTimeout(t); app?.removeAttribute("data-tour"); };
  }, []);

  /* Out the way it came in: the app is shown again underneath, and this layer
     fades off it before the answer is given. */
  const leave = useCallback((then) => {
    if (leaving) return;
    document.querySelector(".app")?.removeAttribute("data-tour");
    if (still()) { then?.(); return; }
    setLeaving(true);
    setTimeout(() => then?.(), 280);
  }, [leaving]);
  const skip = useCallback(() => leave(onClose), [leave, onClose]);
  const finish = useCallback(() => leave(onDone), [leave, onDone]);

  /* Where the strip is. `dx` is a finger's offset from the resting place. */
  const place = useCallback((to, dx = 0, animate = true) => {
    const el = track.current;
    if (!el) return;
    const w = view.current?.clientWidth || window.innerWidth;
    el.style.transition = animate && !still() ? `transform 560ms ${EASE}` : "none";
    el.style.transform = `translate3d(${-to * w + dx}px,0,0)`;
  }, []);

  const goTo = useCallback((to) => {
    const t = Math.max(0, Math.min(n - 1, to));
    at.current = t;
    setI(t);
    place(t);
  }, [n, place]);

  const next = useCallback(() => {
    if (at.current + 1 < n) goTo(at.current + 1); else finish();
  }, [n, goTo, finish]);
  const back = useCallback(() => goTo(at.current - 1), [goTo]);

  useLayoutEffect(() => {
    place(at.current, 0, false);
    const onResize = () => place(at.current, 0, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [place]);

  /* Focus goes to the dialog, so a screen reader starts at its name and the
     first key press works, without a ring drawn round Next before anybody
     has touched anything. */
  const rootRef = useRef(null);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Escape") { e.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, back, skip]);

  /* ---------------------------------------------------------- the swipe */
  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a, input")) return;
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
      if (d.axis === "x") view.current?.setPointerCapture?.(e.pointerId);
    }
    if (d.axis !== "x") return;
    /* The last tenth of a second of the drag, for its speed at release. */
    d.trail.push({ x: e.clientX, t: e.timeStamp });
    while (d.trail.length > 2 && e.timeStamp - d.trail[0].t > 100) d.trail.shift();
    const atEdge = (at.current === 0 && dx > 0) || (at.current === n - 1 && dx < 0);
    d.dx = atEdge ? dx / 3 : dx;
    place(at.current, d.dx, false);
  };
  const up = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || d.axis !== "x") return;
    const w = view.current?.clientWidth || window.innerWidth;
    /* A FLICK IS MEASURED OVER TIME, not between two events. Moves can arrive
       in a burst with no time between them, and one pixel over no time is an
       infinite speed: a slow 40px drag read as a flick until this. */
    const a = d.trail[0];
    const z = d.trail[d.trail.length - 1];
    const span = z.t - a.t;
    const vx = span >= 20 ? (z.x - a.x) / span : 0;
    const far = Math.abs(d.dx) > w * 0.2;
    const flick = Math.abs(vx) > 0.45 && Math.abs(d.dx) > 24;
    if ((far || flick) && d.dx < 0 && at.current < n - 1) goTo(at.current + 1);
    else if ((far || flick) && d.dx > 0 && at.current > 0) goTo(at.current - 1);
    else place(at.current);
  };

  const last = i === n - 1;
  return (
    <div className={`tour${leaving ? " is-leaving" : ""}`} ref={rootRef} tabIndex={-1}
         role="dialog" aria-modal="true" aria-label="A walkthrough of Wingman">
      <header className="tour-top">
        <span className="tour-brand">Wingman</span>
        <button type="button" className="tour-skip" onClick={skip}>Skip walkthrough</button>
      </header>

      <div className="tour-view" ref={view} aria-roledescription="carousel"
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="tour-track" ref={track}>
          {SLIDES.map((s, k) => (
            <section key={s.id} className={`tour-slide${k === i ? " is-on" : ""}`}
                     role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`}
                     aria-hidden={k !== i} inert={k !== i ? "" : undefined}>
              <div className="tour-scene"><Scene id={s.id} on={k === i} /></div>
              <div className="tour-copy">
                <p className="tour-count">{k + 1} of {n}</p>
                <h2 className="tour-title">{s.title}</h2>
                <p className="tour-body">{s.body}</p>
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="tour-foot">
        <button type="button" className="tour-back" onClick={back} disabled={i === 0}>Back</button>
        <div className="tour-dots" aria-hidden="true">
          {SLIDES.map((s, k) => <i key={s.id} className={k === i ? "on" : k < i ? "was" : undefined} />)}
        </div>
        <button type="button" className="tour-next" onClick={next}>
          {last ? (hasStamp ? "Done" : "Create my licence") : "Next"}
        </button>
      </footer>
      <p className="tour-hint" aria-hidden="true">Swipe, or use the arrow keys</p>
    </div>
  );
}
