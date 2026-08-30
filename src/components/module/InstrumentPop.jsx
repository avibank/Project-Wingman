import { useEffect, useRef } from "react";
import { Accuracy, Calibration, MasterCaution } from "./Instruments.jsx";

// §2.3 — what a pressed indicator opens.
//
// A POPOVER, not a modal: no page dim, no focus trap, closes on an outside
// click or Escape. Dimming the page to explain a 38px dial would make reading
// an instrument feel like an interruption.
//
// Idle indicators stay pressable, deliberately. A dark lamp is exactly the
// thing a new student needs explained, and an explanation you can only reach
// once something has gone wrong is an explanation nobody gets.

const NAMES = {
  accuracy: "Accuracy",
  calibration: "Calibration",
  caution: "Master Caution",
};

/* The reading in plain words. Every one of these is also the indicator's
   accessible name, so the popover says out loud what a screen reader is
   already being told. */
function words(kind, d) {
  if (kind === "accuracy") {
    if (d.mean == null) return "No reading yet — take a quiz and the needle comes alive.";
    const dev = Math.round(d.mean - d.passMark);
    if (dev === 0) return "Exactly on your target.";
    return `Averaging ${Math.round(d.mean)} out of 100. That is ${Math.abs(dev)} `
      + `${Math.abs(dev) === 1 ? "point" : "points"} ${dev < 0 ? "under" : "over"} `
      + `the ${d.passMark} pass mark.`;
  }
  if (kind === "calibration") {
    if (!d.hasData) return "Nothing recorded yet.";
    if (!d.count) return "Clear — nothing to re-check.";
    return `${d.count} question${d.count === 1 ? "" : "s"} ready to re-check.`;
  }
  return d.count
    ? `${d.count} question${d.count === 1 ? "" : "s"} you have missed and not yet put right.`
    : "All clear. Nothing needs you.";
}

/* The action, and whether there is one to offer. */
function action(kind, d) {
  if (kind === "accuracy") return { label: "See your quiz record", to: "library", on: true };
  if (kind === "calibration") {
    return { label: d.count ? "Re-check now" : "Nothing to re-check", to: "recheck", on: Boolean(d.count) };
  }
  return { label: d.count ? "Put them right" : "Nothing to put right", to: "caution", on: Boolean(d.count) };
}

export default function InstrumentPop({ kind, data, anchor, onClose, onGo }) {
  const ref = useRef(null);

  // Escape closes, and focus goes back where it came from — §5.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchor?.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose, anchor]);

  useEffect(() => { ref.current?.focus(); }, []);

  const a = action(kind, data);
  // Anchored to the indicator that opened it, and clamped so it cannot hang
  // off either edge on a narrow screen.
  const r = anchor?.getBoundingClientRect();
  const W = 286;
  const left = r
    ? Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2))
    : 8;
  const arrow = r ? Math.max(14, Math.min(W - 24, r.left + r.width / 2 - left - 5)) : 24;

  return (
    <div className="pop" ref={ref} tabIndex={-1} role="dialog" aria-label={NAMES[kind]}
         style={{ left: `${left}px`, top: r ? `${r.bottom + window.scrollY + 10}px` : "auto",
                  "--arrow": `${arrow}px` }}>
      <h3>{NAMES[kind]}</h3>

      {/* The same instrument, enlarged. Not a diagram of it — the thing
          itself, so what you learn here is what you read out there. */}
      <div className="pop-big">
        <div className="pop-scaler">
          {kind === "accuracy" && <Accuracy mean={data.mean} passMark={data.passMark} />}
          {kind === "calibration" && <Calibration count={data.count} hasData={data.hasData} />}
          {kind === "caution" && <MasterCaution count={data.count} />}
        </div>
      </div>

      <p className="pop-reading">{words(kind, data)}</p>

      <button type="button" className="pop-act" disabled={!a.on}
              onClick={() => { onGo?.(a.to); onClose(); }}>
        {a.label}
      </button>
    </div>
  );
}
