import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconRight } from './icons';
import { letter, plural } from './content';
import { calmClass } from './motion';
import { findSave, removeSave, restoreSave } from './savesStore';
import { toast } from './toastBus';
import FinishPanel from './FinishPanel';

/** "Practise these": saved questions one at a time, answer, see the right one, move on. */
export default function PractiseSheet({ questions, onClose }) {
  const [run, setRun] = useState(0);
  const [k, setK] = useState(0);
  const [pick, setPick] = useState(null);
  const [got, setGot] = useState(() => new Set());
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const restart = () => { setRun((r) => r + 1); setK(0); setPick(null); setGot(new Set()); };
  const q = questions[k];
  const done = k >= questions.length;

  const answer = (j) => { if (pick != null) return; setPick(j); if (j === q.answerIndex) setGot((g) => new Set(g).add(q.id)); };
  const next = () => { setPick(null); setK((x) => x + 1); };
  const savedGot = [...got].map((id) => findSave('question', id)).filter(Boolean);
  const unsave = async () => {
    const rows = savedGot; onClose();
    const res = await Promise.all(rows.map((r) => removeSave(r)));
    const ok = res.filter((r) => r.ok).map((r) => r.row);
    if (ok.length) toast(`${plural(ok.length, 'question')} unsaved`, { action: { label: 'Undo', fn: () => ok.forEach(restoreSave) } });
  };

  return createPortal(
    <div className={`bm bm-scrim${calmClass()}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bm-sheet" role="dialog" aria-modal="true" aria-label="Practise saved questions" key={run}>
        <div className="bm-sheet-h">
          <div className="bm-dots">{questions.map((x, j) => <span key={x.id} className={j <= k ? 'is-on' : ''} />)}</div>
          <button type="button" className="bm-x" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        {done ? (
          <FinishPanel gotAll={got.size === questions.length} gotNone={got.size === 0}
            onUnsave={savedGot.length ? unsave : null} unsaveLabel={got.size === questions.length ? 'Unsave all of these' : 'Unsave the ones I got'}
            onAgain={restart} onDone={onClose} />
        ) : (
          <div className="bm-step" key={q.id}>
            <div className="bm-mono" style={{ marginBottom: 8 }}>Chapter {q.chapter} quiz</div>
            <div className="bm-stem">{q.stem}</div>
            {q.options.map((o, j) => {
              const cls = pick == null ? '' : j === q.answerIndex ? ' is-right' : j === pick ? ' is-wrong' : ' is-dim';
              return (
                <button key={j} type="button" className={`bm-ans${cls}`} disabled={pick != null} onClick={() => answer(j)}>
                  <b>{letter(j)}</b>{o}
                  {pick != null && j === q.answerIndex && <span className="bm-res">Correct</span>}
                  {pick != null && j === pick && j !== q.answerIndex && <span className="bm-res">Your pick</span>}
                </button>
              );
            })}
            <div className="bm-sheet-f">{pick != null && <button type="button" className="bm-btn is-primary" onClick={next} autoFocus>{k + 1 < questions.length ? 'Next' : 'Finish'}<IconRight /></button>}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
