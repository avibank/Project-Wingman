import { IconCheck } from './icons';

/** End of a practice run or a test. Encouraging, no scores, no stats. */
export default function FinishPanel({ gotAll, gotNone, onUnsave, unsaveLabel, onAgain, onDone }) {
  const h = gotAll ? 'Clean run.' : gotNone ? 'Worth another pass soon.' : 'Getting there.';
  const p = gotAll ? 'All of it has stuck.' : gotNone ? 'These are staying right here for the next go.' : 'The ones that slipped stay saved for next time.';
  return (
    <div className="bm-done">
      <div className="bm-seal"><IconCheck /></div>
      <h2>{h}</h2><p>{p}</p>
      <div className="bm-sheet-f">
        {onUnsave && <button type="button" className="bm-btn is-ghost" onClick={onUnsave}>{unsaveLabel}</button>}
        <button type="button" className="bm-btn is-ghost" onClick={onAgain}>Go again</button>
        <button type="button" className="bm-btn is-primary" onClick={onDone} autoFocus>Done</button>
      </div>
    </div>
  );
}
