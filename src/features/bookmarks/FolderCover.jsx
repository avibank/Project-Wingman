import { useEffect, useRef } from 'react';
import { isCalm } from './motion';
import { fmtTime } from './content';

const DUR = 3200; // ms each item stays up

/** One slide's content. Only facts the app stores: the question, the page number, the lesson title. */
function Face({ it }) {
  if (it.kind === 'question') return (<div className="bm-cv is-q"><div className="bm-tag">Chapter {it.q.chapter}</div><div className="bm-stem">{it.q.stem}</div><div /></div>);
  if (it.kind === 'card') return (<div className="bm-cv is-c"><div className="bm-tag">Chapter {it.q.chapter}</div><div className="bm-term">{it.q.stem}</div></div>);
  if (it.kind === 'page') return (<div className="bm-cv is-p"><div className="bm-tag">Page</div><div className="bm-big">{it.page}</div><div className="bm-state">{it.moduleName}</div></div>);
  return (<>
    <VideoArt lesson={it.lesson} at={it.at} />
    <div className="bm-cv is-v"><div className="bm-vt">{it.lesson.title}</div><div className="bm-vm">{fmtTime(it.lesson.durationSeconds)}</div></div>
  </>);
}
export function VideoArt({ lesson, at }) {
  const pct = lesson.durationSeconds ? Math.min(1, (at ?? 0) / lesson.durationSeconds) : 0;
  return (<div className="bm-frame" style={lesson.thumbnailUrl ? { backgroundImage: `url(${lesson.thumbnailUrl})` } : undefined}>
    {pct > 0 && <span className="bm-pb" style={{ width: `${pct * 100}%` }} />}
  </div>);
}

/**
 * The folder cover: plays through the newest items like stories.
 * Folders start a beat apart (offset) so they never all change together. Hover or focus holds it.
 */
export default function FolderCover({ items, kind, icon, offset = 0 }) {
  const root = useRef(null);
  const list = items.slice(0, 5);
  const n = list.length;

  useEffect(() => {
    const el = root.current; if (!el || n < 2 || isCalm()) return;
    const folder = el.closest('.bm-folder');
    let hold = false, i = 0, e = -offset, last = performance.now(), raf = 0;
    const slides = () => el.querySelectorAll('.bm-slide'); const bars = () => el.querySelectorAll('.bm-bars b');
    const on = () => (hold = true), off = () => (hold = false);
    folder?.addEventListener('mouseenter', on); folder?.addEventListener('mouseleave', off);
    folder?.addEventListener('focusin', on); folder?.addEventListener('focusout', off);
    const show = (j) => {
      const s = slides(), b = bars(), old = s[i];
      old.classList.remove('is-on'); old.classList.add('is-off'); setTimeout(() => old.classList.remove('is-off'), 700);
      s[j].classList.add('is-on'); b.forEach((x, k) => (x.style.width = k < j ? '100%' : '0%')); i = j; e = 0;
    };
    const loop = (now) => {
      const dt = Math.min(now - last, 100); last = now;
      if (!hold && !document.hidden) e += dt;
      const b = bars()[i]; if (b) b.style.width = `${Math.max(0, Math.min(1, e / DUR)) * 100}%`;
      if (e >= DUR) show((i + 1) % n);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); folder?.removeEventListener('mouseenter', on); folder?.removeEventListener('mouseleave', off); folder?.removeEventListener('focusin', on); folder?.removeEventListener('focusout', off); };
  }, [n, offset, list.map((x) => x.row.id).join()]);

  if (!n) return (<div className="bm-cover"><div className="bm-empty-cover">{icon}</div></div>);
  return (
    <div ref={root} className={`bm-cover${kind === 'video' ? ' is-video' : ''}`}>
      <div className="bm-slides">
        {n > 1 && <div className="bm-bars">{list.map((x) => <i key={x.row.id}><b /></i>)}</div>}
        {list.map((it, k) => <div key={it.row.id} className={`bm-slide${k === 0 ? ' is-on' : ''}`}><Face it={it} /></div>)}
      </div>
    </div>
  );
}
