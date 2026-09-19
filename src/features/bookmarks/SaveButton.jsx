import { useRef } from 'react';
import { IconBookmark } from './icons';
import { useGo } from './nav';
import { addSave, removeSave, restoreSave, findSave } from './savesStore';
import { useSavesState, FOLDERS } from './useSaves';
import { toast } from './toastBus';
import { routes } from './content';

/**
 * The one bookmark control. Put it on: each quiz question (kind="question"),
 * each study card (kind="card"), the lesson player bar (kind="video", pass getAtSeconds),
 * and the paper reader (kind="page", pass page).
 * Same icon everywhere: outline = not saved, filled = saved.
 */
export default function SaveButton({ kind, moduleId, refId, chapter = null, page = null, getAtSeconds, className = '', label = null }) {
  useSavesState();                                   // re-render when saves change
  const nav = useGo();
  const btn = useRef(null);
  const saved = findSave(kind, refId, page);
  const folder = FOLDERS[kind];
  const pop = () => { const b = btn.current; if (!b) return; b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); };

  async function onClick(e) {
    e.stopPropagation();
    pop();
    if (saved && kind !== 'video') {
      const r = await removeSave(saved);
      if (r.ok) toast(`Removed from ${folder.name}`, { action: { label: 'Undo', fn: () => restoreSave(r.row) } });
      return;
    }
    // A saved lesson tapped again moves its saved second rather than unsaving, because the student is marking a new moment.
    if (saved && kind === 'video') {
      const at = Math.floor(getAtSeconds?.() ?? 0);
      if (Math.abs(at - (saved.at_seconds ?? 0)) < 2) {
        const r = await removeSave(saved);
        if (r.ok) toast(`Removed from ${folder.name}`, { action: { label: 'Undo', fn: () => restoreSave(r.row) } });
        return;
      }
    }
    const r = await addSave({ kind, moduleId, refId, chapter, page, atSeconds: kind === 'video' ? Math.floor(getAtSeconds?.() ?? 0) : null });
    if (r.ok) toast(`Saved to ${folder.name}`, { icon: <IconBookmark on />, action: { label: 'View', fn: () => nav(`${routes.folder(folder.slug)}?m=${moduleId}`) } });
  }

  return (
    <button ref={btn} type="button" className={`bm-save${saved ? '' : ' is-off'} ${className}`}
      aria-pressed={!!saved} aria-label={saved ? `Remove from ${folder.name}` : `Save to ${folder.name}`} title={saved ? 'Remove bookmark' : 'Bookmark'}
      onClick={onClick}>
      <IconBookmark on={!!saved} />
      {/* Words only where the surface asks for them. The lesson's title row
          used to be one of those, beside two other labelled pills; §3 made it
          a round icon button next to the sign-off stamp, so it passes no
          label and this renders nothing. */}
      {label && <span>{saved ? label.on : label.off}</span>}
    </button>
  );
}
