import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './bookmarks.css';
import './bm-app.css';
import { BmLink, useGo } from './nav';
import { IconLeft, IconPlay, IconQuestion, IconCards, IconVideo, IconPage, IconBookmark } from './icons';
import { content, routes, useContentVersion } from './content';
import { calmClass } from './motion';
import { useModuleSaves, FOLDERS, KINDS } from './useSaves';
import FolderCover from './FolderCover';
import ModulePicker from './ModulePicker';
import PractiseSheet from './PractiseSheet';
import TestPile from './TestPile';

const ICONS = { question: <IconQuestion />, card: <IconCards />, video: <IconVideo />, page: <IconPage /> };

/** Keeps the chosen module in the URL (?m=) so folders, back links and refreshes agree.
 *  Written through the app's go() with replace, not the router's setSearchParams:
 *  one navigation path (see nav.jsx), and changing which module you are looking
 *  at should not stack a history entry per glance. */
export function useModuleParam() {
  const loc = useLocation();
  const go = useGo();
  useContentVersion();                                   // the fallback arrives with the content
  const sp = new URLSearchParams(loc.search);
  const m = sp.get('m') || content.currentModuleId() || 'all';
  const set = (id) => { sp.set('m', id); go(`${loc.pathname}?${sp}`, { replace: true, keepScroll: true }); };
  return [m, set];
}

/** Rolls a number to its new value (e.g. when the module changes). */
function Rolling({ n }) {
  const [shown, setShown] = useState(n);
  useEffect(() => {
    if (shown === n) return; const from = shown, t0 = performance.now(); let raf;
    const step = (now) => { const p = Math.min(1, (now - t0) / 450), e = 1 - (1 - p) ** 3; setShown(Math.round(from + (n - from) * e)); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [n, shown]);
  return <span>{shown}</span>;
}

export default function BookmarksPage() {
  const nav = useGo();
  const [moduleId, setModule] = useModuleParam();
  const { byKind, total, ready } = useModuleSaves(moduleId);
  const [sheet, setSheet] = useState(null); // {type:'practise'|'test', items}
  const modName = (id) => content.modules().find((m) => m.id === id)?.name ?? '';
  useEffect(() => { content.track?.('bookmarks_opened', { moduleId }); }, [moduleId]);

  const play = (kind) => {
    const l = byKind[kind]; if (!l.length) return;
    if (kind === 'question') { content.track?.('practise_started', { from: 'bookmarks' }); return setSheet({ type: 'practise', items: l.map((x) => x.q) }); }
    if (kind === 'card') { content.track?.('test_started', { from: 'bookmarks' }); return setSheet({ type: 'test', items: l.map((x) => x.q) }); }
    if (kind === 'video') { const v = l.find((x) => x.at > 0 && x.at < x.lesson.durationSeconds - 5) ?? l[0]; return nav(routes.lessonAt(v.lesson.id, v.at)); }
    const p = l[0]; nav(routes.readerAt(p.paper.id, p.page));
  };

  if (!ready) return <section className={`bm bm-page${calmClass()}`} aria-busy="true" />;

  return (
    <section className={`bm bm-page${total ? ' bm-wide bm-home' : ''}${calmClass()}`}>
      <BmLink className="bm-back" to={routes.flightDeck()}><IconLeft />Flight Deck</BmLink>
      <div className="bm-head"><div>
        <h1 className="bm-h1">Bookmarks</h1>
        <div className="bm-sub">{total ? <><Rolling n={total} /> saved in</> : 'Nothing yet in'} <ModulePicker value={moduleId} onChange={setModule} /></div>
      </div></div>

      {!total ? (
        <div className="bm-empty">Tap <span className="bm-mk"><IconBookmark /></span> on a quiz question, a study card, a lesson or a page, and it lands here.</div>
      ) : (
        <div className="bm-folders">
          {KINDS.map((kind, i) => {
            const items = byKind[kind].map((x) => (x.kind === 'page' ? { ...x, moduleName: modName(x.row.module_id) } : x));
            const f = FOLDERS[kind];
            return (
              <div className="bm-folder" style={{ '--i': i }} key={kind}>
                <button type="button" className="bm-open-f" onClick={() => nav(`${routes.folder(f.slug)}?m=${moduleId}`)} aria-label={`${f.name}, ${items.length} saved`}>
                  <FolderCover items={items} kind={kind} icon={ICONS[kind]} offset={i * 650} />
                  <div className="bm-fname">{f.name}<span className="bm-count">{items.length || ''}</span></div>
                </button>
                {items.length > 0 && <PlayButton label={f.action} onClick={() => play(kind)} />}
              </div>
            );
          })}
        </div>
      )}
      {sheet?.type === 'practise' && <PractiseSheet questions={sheet.items} onClose={() => setSheet(null)} />}
      {sheet?.type === 'test' && <TestPile cards={sheet.items} onClose={() => setSheet(null)} />}
    </section>
  );
}

/** Play button pinned to the bottom-right corner of its cover (measured, so it follows the cover at every size). */
function PlayButton({ label, onClick }) {
  const ref = useRef(null);
  const [top, setTop] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const place = () => { const c = el.parentElement.querySelector('.bm-cover'); if (c) setTop(c.offsetTop + c.offsetHeight - 58); };
    place(); const ro = new ResizeObserver(place); ro.observe(el.parentElement); return () => ro.disconnect();
  }, []);
  return <button ref={ref} type="button" className="bm-fplay" style={{ top: top ?? undefined }} aria-label={label} title={label} onClick={onClick}><IconPlay /></button>;
}
