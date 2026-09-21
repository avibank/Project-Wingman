/* =============================================================================
   THE TOUR — a light moving round a building the student is standing in.
   -----------------------------------------------------------------------------
   THE SPOTLIGHT IS ONE ELEMENT WITH AN ENORMOUS SHADOW. `box-shadow: 0 0 0
   9999px` on a box the size of the target dims everything except what is
   inside it, in one compositor-friendly paint — no four-rectangle overlay to
   keep in step, no SVG mask to re-generate on every scroll, and the whole
   thing tweens between targets because it is one box moving.

   IT NEVER COVERS WHAT IT IS POINTING AT. `pointer-events: none` on the
   spotlight, so the control underneath stays pressable; the tour is over the
   app, not in front of it.

   IT WAITS FOR ITS TARGET RATHER THAN ASSUMING IT. Steps change route, routes
   load lazily, and a card pointing at the place a button will be in 400ms is
   the tour looking broken on the one screen that has to look right. It polls
   for the selector, scrolls it into view, and if it never arrives it SKIPS the
   step — content arrives module by module and a tour that breaks the day a
   chapter is added is worse than no tour.

   MOTION IS THE APP'S. Smooth Air and prefers-reduced-motion mean NO motion,
   not less: the spotlight jumps, the card appears, everything else is
   identical. That is `.smooth-air` and the media query at the foot of
   tour.css, not a branch in here.
   ========================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";
import { STEPS, placeOf } from "./tourSteps.js";
import "./tour.css";

const GAP = 14;            // between the spotlight and the card
const PAD = 8;             // how far the light spills past the target
const TRIES = 26;          // ~2.6s of waiting for a target to arrive

export default function Tour({ open, onClose, onDone, go, at = 0 }) {
  const [i, setI] = useState(at);
  const [box, setBox] = useState(null);      // the target's rect, or null while hunting
  const [skipped, setSkipped] = useState(false);
  const cardRef = useRef(null);
  /* Its real height, read after it paints. Until then the placement uses a
     sane default and corrects on the next frame, which is one frame nobody
     sees because the card fades in over a third of a second. */
  const [cardH, setCardH] = useState(0);
  const step = STEPS[i];

  /* --------------------------------------------------- finding the target */
  useEffect(() => {
    if (!open || !step) return undefined;
    let live = true;
    let tries = 0;
    setBox(null);
    setSkipped(false);

    /* The step's own address first. `go` is the app's navigate, so the move
       gets the same transition every other navigation does. */
    if (step.where && window.location.pathname !== step.where) go?.(step.where);

    const hunt = () => {
      if (!live) return;
      const el = document.querySelector(step.find);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        const r = el.getBoundingClientRect();
        if (r.width && r.height) { setBox(r); return; }
      }
      tries += 1;
      if (tries > TRIES) {
        /* NEVER A CARD POINTING AT NOTHING. */
        if (step.optional || true) { setSkipped(true); }
        return;
      }
      setTimeout(hunt, 100);
    };
    const t = setTimeout(hunt, 260);
    return () => { live = false; clearTimeout(t); };
  }, [open, i, step, go]);

  /* A skipped step moves on by itself, so the tour never stalls. */
  useEffect(() => {
    if (!skipped) return undefined;
    const t = setTimeout(() => (i + 1 < STEPS.length ? setI(i + 1) : onDone?.()), 140);
    return () => clearTimeout(t);
  }, [skipped, i, onDone]);

  /* The light follows the target when the page moves under it. */
  useEffect(() => {
    if (!open || !box || !step) return undefined;
    /* ONLY WHEN IT HAS ACTUALLY MOVED. `setBox` with a fresh rect on every
       scroll event re-renders, which re-runs this effect, which rebinds the
       listener — and `scrollIntoView` above fires scroll events of its own, so
       the two chase each other and the tour never settles. A pixel of
       tolerance is the difference between following the page and spinning. */
    const track = () => {
      const el = document.querySelector(step.find);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      setBox((was) => (was
        && Math.abs(was.top - r.top) < 1 && Math.abs(was.left - r.left) < 1
        && Math.abs(was.width - r.width) < 1 && Math.abs(was.height - r.height) < 1
        ? was : r));
    };
    window.addEventListener("resize", track);
    window.addEventListener("scroll", track, true);
    return () => { window.removeEventListener("resize", track); window.removeEventListener("scroll", track, true); };
  }, [open, step]);

  const next = useCallback(() => {
    if (!step) return;
    if (step.goes) go?.(step.goes);
    if (i + 1 < STEPS.length) setI(i + 1); else onDone?.();
  }, [step, i, go, onDone]);

  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  /* Escape leaves, Enter goes on, and the arrows walk it — the same keys the
     rest of the app answers. */
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
      else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, next, back, onClose]);

  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, i]);

  /* Measured every time the words change, because the words are what make it
     tall — step 12 is three lines longer than step 1. */
  useEffect(() => {
    if (!open) return undefined;
    const read = () => { const h = cardRef.current?.offsetHeight; if (h && h !== cardH) setCardH(h); };
    const raf = requestAnimationFrame(read);
    window.addEventListener("resize", read);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", read); };
  }, [open, i, cardH]);

  if (!open || !step) return null;

  const below = placeOf(step) === "below";
  const light = box && {
    left: Math.max(6, box.left - PAD),
    top: Math.max(6, box.top - PAD),
    width: Math.min(window.innerWidth - 12, box.width + PAD * 2),
    height: box.height + PAD * 2,
  };
  /* THE CARD IS CLAMPED AGAINST ITS OWN MEASURED HEIGHT, not a guess at one.
     The first version assumed 190-200px and clamped to `innerHeight - 200`,
     which is fine until the target is TALL: the licence card lights a 686px
     box, the card goes below it, and 700 + its real height is off the bottom
     of a 900px window. Measured, three of twelve steps put the card where
     nobody could read it.

     So the height comes from the card itself after its first paint, and when
     the target is too tall for the card to sit outside it at all, the card
     goes OVER the lit area rather than beyond the window — a card on top of
     what it is describing is readable, and a card below the fold is not. */
  const ch = cardH || 210;
  const room = window.innerHeight;
  const wanted = below ? box && box.bottom + GAP : box && box.top - GAP - ch;
  const card = box && {
    top: Math.max(12, Math.min(room - ch - 12, wanted)),
    left: Math.max(12, Math.min(window.innerWidth - 352, box.left + box.width / 2 - 170)),
  };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="A tour of Wingman">
      {light && <div className="tour-light" style={light} aria-hidden="true" />}
      {!light && <div className="tour-dim" aria-hidden="true" />}

      <div className="tour-card" ref={cardRef} tabIndex={-1} style={card || { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
        <p className="tour-count">{i + 1} of {STEPS.length}</p>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-acts">
          {i > 0 && <button type="button" className="tour-back is-inline" onClick={back}>Back</button>}
          <span className="tour-grow" />
          <button type="button" className="tour-skip is-inline" onClick={onClose}>Find your own way</button>
          <button type="button" className="tour-next" onClick={next}>
            {step.last ? "Start flying" : (step.action || "Next")}
          </button>
        </div>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((s, n) => <i key={s.id} className={n === i ? "on" : n < i ? "was" : ""} />)}
        </div>
      </div>
    </div>
  );
}
