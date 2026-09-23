import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconCheck, IconFlip, IconShuffle } from './icons';
import { plural } from './content';
import { calmClass } from './motion';
import { findSave, removeSave, restoreSave } from './savesStore';
import { toast } from './toastBus';
import { CardFaces } from './StudyPad';
import FinishPanel from './FinishPanel';
import { useUserProgress } from '../../lib/userProgress.jsx';
import { dealOrder, markGot } from './cardsSeen';

/** "Test yourself": swipe right if you've got it, left if not yet. Tap to turn the card. */
export default function TestPile({ cards: initial, onClose }) {
  const progress = useUserProgress();
  /* WHAT SLIPPED LAST TIME IS DEALT FIRST (owner, 2026-09-23: study cards
     should save your progress). The outcome of every card is kept by id, and
     it is spent on the order rather than on a score — this screen has never
     shown one and still does not. Shuffle overrides it, which is what Shuffle
     is for. The order is worked out ONCE, on the way in, so a card does not
     move under your thumb the moment you answer it. */
  const [cards, setCards] = useState(() => dealOrder(progress, initial));
  const [k, setK] = useState(0);
  const [flip, setFlip] = useState(false);
  const [got, setGot] = useState(() => new Set());
  const [fly, setFly] = useState(null); // {id, dir}
  const drag = useRef({ x0: null, dx: 0 });
  const topRef = useRef(null);
  const done = k >= cards.length;

  const fling = (yes) => {
    if (done || fly) return; const c = cards[k];
    if (yes) setGot((g) => new Set(g).add(c.id));
    markGot(progress, c.id, yes);
    setFly({ id: c.id, dir: yes ? 1 : -1 });
    setTimeout(() => { setFly(null); setFlip(false); setK((x) => x + 1); }, 380);
  };
  useEffect(() => {
    const keys = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') fling(true); else if (e.key === 'ArrowLeft') fling(false); else if (e.key === ' ') { e.preventDefault(); setFlip((f) => !f); } };
    document.addEventListener('keydown', keys); return () => document.removeEventListener('keydown', keys);
  });
  const restart = () => { setK(0); setFlip(false); setGot(new Set()); };
  const shuffle = () => { setCards((c) => [...c].sort(() => Math.random() - 0.5)); restart(); toast('Shuffled'); };

  const pd = (e) => { const t = topRef.current; if (!t) return; drag.current = { x0: e.clientX, dx: 0 }; t.classList.add('is-drag'); t.setPointerCapture(e.pointerId); };
  const pm = (e) => { const t = topRef.current; if (!t || drag.current.x0 == null) return; drag.current.dx = e.clientX - drag.current.x0; t.style.transform = `translateX(${drag.current.dx}px) rotate(${drag.current.dx / 24}deg)`; };
  const pu = () => { const t = topRef.current; if (!t || drag.current.x0 == null) return; const dx = drag.current.dx; drag.current.x0 = null; t.classList.remove('is-drag'); t.style.transform = '';
    if (Math.abs(dx) > 90) fling(dx > 0); else if (Math.abs(dx) < 6) setFlip((f) => !f); };

  const savedGot = [...got].map((id) => findSave('card', id)).filter(Boolean);
  const unsave = async () => {
    const rows = savedGot; onClose();
    const res = await Promise.all(rows.map((r) => removeSave(r)));
    const ok = res.filter((r) => r.ok).map((r) => r.row);
    if (ok.length) toast(`${plural(ok.length, 'card')} unsaved`, { action: { label: 'Undo', fn: () => ok.forEach(restoreSave) } });
  };

  return createPortal(
    <div className={`bm bm-scrim${calmClass()}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {done ? (
        <div className="bm-sheet" role="dialog" aria-modal="true" aria-label="Finished">
          <div className="bm-sheet-h"><span /><button type="button" className="bm-x" onClick={onClose} aria-label="Close"><IconX /></button></div>
          <FinishPanel gotAll={got.size === cards.length} gotNone={got.size === 0}
            onUnsave={savedGot.length ? unsave : null} unsaveLabel={got.size === cards.length ? 'Unsave all of these' : 'Unsave the ones I got'}
            onAgain={restart} onDone={onClose} />
        </div>
      ) : (
        <div className="bm-deck" role="dialog" aria-modal="true" aria-label="Test yourself">
          <div className="bm-deck-top"><span className="bm-mono">{k + 1} / {cards.length}</span>
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="bm-x" onClick={shuffle} aria-label="Shuffle"><IconShuffle /></button><button type="button" className="bm-x" onClick={onClose} aria-label="Close"><IconX /></button></div></div>
          <div className="bm-pile">
            {cards.map((c, j) => {
              const d = j - k; if (d < 0 || d > 3) return null;
              const flying = fly?.id === c.id;
              return (
                <div key={c.id} ref={d === 0 ? topRef : null} data-d={d} className={`bm-dc${flying ? ' is-fly' : ''}`} style={{ zIndex: 10 - d, ...(flying ? { transform: `translate(${fly.dir * 130}%,-4%) rotate(${fly.dir * 14}deg)`, opacity: 0 } : {}) }}
                  onPointerDown={d === 0 ? pd : undefined} onPointerMove={d === 0 ? pm : undefined} onPointerUp={d === 0 ? pu : undefined}>
                  <div className="bm-pad-stage" style={{ aspectRatio: 'auto', height: '100%' }}>
                    <div className="bm-pc"><div className={`bm-pc-in${d === 0 && flip ? ' is-flipped' : ''}`}><CardFaces q={c} turn={false} /></div></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bm-deck-nav">
            <button type="button" className="bm-round is-no" onClick={() => fling(false)} aria-label="Not yet"><IconX /></button>
            <button type="button" className="bm-round is-sm" onClick={() => setFlip((f) => !f)} aria-label="Turn the card"><IconFlip /></button>
            <button type="button" className="bm-round is-yes" onClick={() => fling(true)} aria-label="Got it"><IconCheck /></button>
          </div>
          <div className="bm-hint">Swipe right if you've got it, left if not yet</div>
        </div>
      )}
    </div>,
    document.body,
  );
}
