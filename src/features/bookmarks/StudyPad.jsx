import { useEffect, useRef, useState } from 'react';
import { IconLeft, IconRight, IconFlip, IconBookmark } from './icons';
import { letter } from './content';
import { findSave, addSave, removeSave, restoreSave } from './savesStore';
import { useSavesState } from './useSaves';
import { toast } from './toastBus';
import { useUserProgress } from '../../lib/userProgress.jsx';
import { markSeen } from './cardsSeen';

/** The two faces of a study card. Front: the question. Back: the right answer (and the author's explanation, only if the question has one). */
export function CardFaces({ q }) {
  return (<>
    <div className="bm-face"><div className="bm-lbl">Chapter {q.chapter} quiz</div><div className={`bm-term${q.stem.length > 40 ? ' is-long' : ''}`}>{q.stem}</div><span className="bm-turn"><IconFlip /></span></div>
    <div className="bm-face is-back"><div className="bm-lbl">Answer</div>
      <div><div className="bm-answer">{letter(q.answerIndex)}. {q.options[q.answerIndex]}</div>{q.explanation ? <p className="bm-meta" style={{ textTransform: 'none', fontFamily: 'inherit', fontSize: '1rem', marginTop: 10 }}>{q.explanation}</p> : null}</div>
      <span className="bm-turn"><IconFlip /></span></div>
  </>);
}

/**
 * Flip-through pad. The top card flips up and away like a notepad page to reveal the next.
 * Tap the card to turn it over. Swipe (or arrow keys) to move. The bookmark sits on the card.
 * mode "set": bookmark toggles saving this card. mode "saved": bookmark removes it (with Undo).
 */
export default function StudyPad({ questions, moduleId, mode }) {
  useSavesState();
  const progress = useUserProgress();
  const [k, setK] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const pad = useRef(null);
  /* BOTH REFS ABOVE THE EARLY RETURN. p0 was declared below `if (!cur) return
     null`, so the render after the LAST card was unsaved — n drops, k is still
     pointing past the end, cur is undefined — ran one hook fewer than the one
     before it and React threw. Reachable in two taps from the Study cards
     folder: go to the last card, remove it. */
  const p0 = useRef(null);
  const n = questions.length;
  useEffect(() => { if (k > n - 1) setK(Math.max(0, n - 1)); }, [n, k]);
  const go = (d) => { const j = k + d; if (j < 0 || j >= n) return; setFlipped(false); setK(j); };
  const cur = questions[k];
  /* TURNING A CARD OVER IS WHAT COUNTS IT. One place, so the pointer, the
     keyboard and anything added later all record the same event — and it is
     the card being FLIPPED, not the card being reached, because seeing the
     answer is the exercise. `markSeen` writes nothing when it already knows. */
  const flip = () => setFlipped((f) => { if (!f) markSeen(progress, questions[k]?.id); return !f; });
  if (!cur) return null;
  const saved = findSave('card', cur.id);

  async function toggle(e) {
    e.stopPropagation();
    const b = e.currentTarget; b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
    if (saved) { const r = await removeSave(saved); if (r.ok) toast('Removed from Study cards', { action: { label: 'Undo', fn: () => restoreSave(r.row) } }); }
    else if (mode === 'set') { const r = await addSave({ kind: 'card', moduleId, refId: cur.id, chapter: cur.chapter }); if (r.ok) toast('Saved to Study cards', { icon: <IconBookmark on /> }); }
  }

  const down = (e) => { if (e.target.closest('button')) return; p0.current = { x: e.clientX, y: e.clientY }; };
  const up = (e) => {
    if (!p0.current) return; const dx = e.clientX - p0.current.x, dy = e.clientY - p0.current.y; p0.current = null;
    if (Math.abs(dx) > 50 || dy < -50) go(dx > 0 && Math.abs(dx) > Math.abs(dy) ? -1 : 1);
    else if (dy > 50) go(-1);
    else if (e.target.closest('.bm-pc')) flip();
  };
  const keys = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
  };

  return (
    <div className="bm-pad" ref={pad} tabIndex={0} onKeyDown={keys} aria-label="Study cards. Arrow keys move, space turns the card over" aria-roledescription="card deck">
      <div className="bm-pad-stage" onPointerDown={down} onPointerUp={up}>
        {questions.map((q, j) => {
          const d = j - k;
          // translateZ keeps the 3D paint order matching the stack; without it a card behind can paint over the top one
          const style = { zIndex: 100 - j, transform: d <= 0 ? undefined : `translateY(${d * 20}px) scale(${1 - d * 0.03}) translateZ(${-40 * d}px)` };
          return (
            <div key={q.id} className={`bm-pc${d < 0 ? ' is-gone' : ''}${d > 3 ? ' is-hidden' : ''}`} style={style} aria-hidden={d !== 0}>
              <div className={`bm-pc-in${d === 0 && flipped ? ' is-flipped' : ''}`}><CardFaces q={q} /></div>
            </div>
          );
        })}
        {(mode === 'set' || saved) && (
          <button type="button" className={`bm-save bm-pd-mark${saved ? '' : ' is-off'}`} onClick={toggle}
            aria-pressed={!!saved} aria-label={saved ? 'Remove from Study cards' : 'Save to Study cards'}><IconBookmark on={!!saved} /></button>
        )}
        <span className="bm-pd-n" aria-live="polite">{k + 1} / {n}</span>
        <button type="button" className="bm-round bm-pd-arrow is-prev" disabled={k === 0} onClick={() => go(-1)} aria-label="Previous card"><IconLeft /></button>
        <button type="button" className="bm-round bm-pd-arrow is-next" disabled={k === n - 1} onClick={() => go(1)} aria-label="Next card"><IconRight /></button>
      </div>
    </div>
  );
}
