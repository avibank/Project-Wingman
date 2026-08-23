import { SEGMENT } from "../lib/progressModel.js";

// §9.1.1 — one segment per chapter, so the count is read without a label.
// It is also the chapter selector: one object, two jobs.
//
// This is why the 25% radial was wrong for the model — a single percentage
// cannot express two chapters part-finished at once, and that is the normal
// state of studying.

function SegmentedBar({ segments, currentId, onPick, labels = false }) {
  if (!segments.length) return null;
  return (
    <div className="segbar">
      <ul className="segbar-track" role="list">
        {segments.map((s) => (
          <li key={s.id} className="segbar-cell">
            <button
              className={`segbar-seg is-${s.fill} ${s.id === currentId ? "is-current" : ""}`}
              onClick={() => onPick?.(s)}
              aria-label={`${s.code} ${s.title} — ${
                s.fill === SEGMENT.FULL ? "quiz passed"
                : s.fill === SEGMENT.HALF ? "in progress" : "not started"}`}
            >
              <span className="segbar-fill" aria-hidden="true" />
            </button>
            {labels && <span className="segbar-label" aria-hidden="true">{s.code}</span>}
          </li>
        ))}
      </ul>

      <style>{`
        .segbar { width: 100%; }
        .segbar-track { display: flex; gap: 4px; list-style: none; margin: 0; padding: 0; }
        .segbar-cell { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
        /* §9.1.3 — 8-10px visually, 44px of touch target. */
        .segbar-seg { position: relative; display: block; width: 100%; height: 44px;
          padding: 17px 0; background: none; border: none; cursor: pointer; }
        .segbar-fill { display: block; height: 10px; border-radius: 6px;
          background: none; box-shadow: inset 0 0 0 1px var(--hairline-bevel);
          overflow: hidden; position: relative; }
        /* half = brief watched. The fill is literally half the segment. */
        .segbar-seg.is-half .segbar-fill::before,
        .segbar-seg.is-full .segbar-fill::before {
          content: ""; position: absolute; inset: 0 auto 0 0;
          background: var(--text-secondary); border-radius: 6px; }
        .segbar-seg.is-half .segbar-fill::before { right: 50%; }
        .segbar-seg.is-full .segbar-fill::before { right: 0; }
        /* §9.1.1 — the current chapter carries the accent; everything else is neutral. */
        .segbar-seg.is-current .segbar-fill { box-shadow: inset 0 0 0 1px var(--accent-interactive); }
        .segbar-seg.is-current.is-half .segbar-fill::before,
        .segbar-seg.is-current.is-full .segbar-fill::before { background: var(--accent-interactive); }
        .segbar-seg:hover .segbar-fill { box-shadow: inset 0 0 0 1px var(--text-secondary); }
        .segbar-label { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
          text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}

export default SegmentedBar;
