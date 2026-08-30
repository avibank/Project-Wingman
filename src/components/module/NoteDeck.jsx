import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { mmss } from "./lessonState.js";
import "./deck.css";

// Notes are a card deck, not a list. One card at a time, one side only — the
// note and its timestamp, no question and no answer.
//
// ORDERED BY TIMESTAMP, NOT BY WHEN THEY WERE WRITTEN. A note added at 2:00
// after one written at 9:00 comes first, deliberately: flipping through the
// deck re-walks the lesson rather than re-walking the evening you wrote them.
export default function NoteDeck({ notes, onSeek, onDelete, jumpTo }) {
  const ordered = [...notes].sort((a, b) => a.t - b.t);
  const [i, setI] = useState(0);
  const wrapRef = useRef(null);

  // Saving a note jumps the deck to that card, so the student sees it landed
  // rather than wondering where it went.
  useEffect(() => {
    if (!jumpTo) return;
    const k = ordered.findIndex((n) => n.id === jumpTo);
    if (k >= 0) setI(k);
  }, [jumpTo, notes.length]);

  useEffect(() => { if (i > ordered.length - 1) setI(Math.max(0, ordered.length - 1)); }, [ordered.length]);

  // Arrows move the deck when focus is not in a field — the same guard the
  // player uses, because a left arrow while typing should move a caret.
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!wrapRef.current) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setI((v) => Math.min(ordered.length - 1, v + 1)); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ordered.length]);

  if (ordered.length === 0) {
    return (
      <div className="deck" ref={wrapRef}>
        <div className="card card-empty">
          <p>
            A line typed while the video runs becomes a card, pinned to that
            second. Flipping through them afterwards walks the lesson again.
          </p>
        </div>
      </div>
    );
  }

  const n = ordered[Math.min(i, ordered.length - 1)];

  return (
    <div className="deck" ref={wrapRef}>
      {/* Fixed height, and long notes scroll INSIDE the card — the deck must
          not change height as you flip through it. */}
      <div className="card">
        <button type="button" className="card-t" onClick={() => onSeek(n.t)}
                aria-label={`Play from ${mmss(n.t)}`}>
          {mmss(n.t)}
        </button>
        <div className="card-body">{n.body || "You marked this moment"}</div>
        <button type="button" className="card-del" onClick={() => onDelete(n.id)}
                aria-label="Delete this note">
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <div className="deck-nav">
        <button type="button" className="deck-arrow" disabled={i === 0}
                onClick={() => setI(i - 1)} aria-label="Previous note">
          <ChevronLeft aria-hidden="true" />
        </button>

        <div className="deck-dots" role="group" aria-label="Notes">
          {ordered.map((c, k) => (
            <button key={c.id} type="button" className="deck-dot" data-on={k === i ? "1" : "0"}
                    onClick={() => setI(k)} aria-label={`Note at ${mmss(c.t)}`}
                    aria-current={k === i} />
          ))}
        </div>

        <span className="deck-count">{i + 1} of {ordered.length}</span>

        <button type="button" className="deck-arrow" disabled={i === ordered.length - 1}
                onClick={() => setI(i + 1)} aria-label="Next note">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
