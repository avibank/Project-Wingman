import { useEffect, useRef, useState } from 'react';
import { IconDown } from './icons';
import { content } from './content';
import { useSavesState } from './useSaves';

/** "18 saved in [Module 1 ▾]" — the picker is the module name itself. */
export default function ModulePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { rows } = useSavesState();
  const mods = content.modules();
  const name = value === 'all' ? 'All modules' : (mods.find((m) => m.id === value)?.name ?? 'Module');
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const count = (id) => rows.filter((r) => id === 'all' || r.module_id === id).length;
  return (
    <div className="bm-switch" ref={box}>
      <button type="button" className="bm-switch-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{name}<IconDown /></button>
      {open && (
        <div className="bm-switch-list" role="listbox">
          {[...mods, { id: 'all', name: 'All modules' }].map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={value === m.id} className="bm-opt" onClick={() => { onChange(m.id); setOpen(false); }}>
              {m.name}<span className="bm-n">{count(m.id)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
