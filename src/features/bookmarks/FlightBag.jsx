import { useEffect, useId, useRef } from 'react';
import './bookmarks.css';
import './bm-app.css';
import { useGo } from './nav';
import { routes } from './content';
import { calmClass, isCalm } from './motion';
import { useModuleSaves } from './useSaves';

/**
 * Flight Deck hero instrument: the briefcase. Replaces the current "A BOOKMARK FILLS THE BAG." cell content.
 * Empty: plain grey case, latches shut, no text. Filled: lit in the livery, latches sprung, three sheets
 * standing in the opening that riffle one at a time; the count underneath (just the number).
 * A new save drops a sheet in and the case takes the weight. Tap opens Bookmarks on the hero's module.
 */
export default function FlightBag({ moduleId }) {
  const nav = useGo();
  const { total } = useModuleSaves(moduleId);
  const svg = useRef(null), num = useRef(null), prev = useRef(total), live = useRef(null);
  const clip = `bmclip-${useId().replace(/:/g, '')}`, lip = `bmlip-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const el = svg.current; if (!el) return;
    const p = prev.current; prev.current = total;
    clearTimeout(live.current); el.classList.remove('is-live');
    if (total > 0) live.current = setTimeout(() => el.classList.add('is-live'), p === 0 ? 900 : 0);
    if (total > p && p > 0 && !isCalm()) { el.classList.remove('is-take'); void el.getBoundingClientRect(); el.classList.add('is-take'); }
    if (total !== p && total && p && num.current) { num.current.classList.remove('is-roll'); void num.current.offsetWidth; num.current.classList.add('is-roll'); }
    return () => clearTimeout(live.current);
  }, [total]);

  return (
    <button type="button" className={`bm bm-bagcell${calmClass()}`} onClick={() => nav(`${routes.bookmarks()}?m=${moduleId}`)}
      aria-label={total ? `Bookmarks, ${total} saved` : 'Bookmarks, nothing saved yet'}>
      <svg ref={svg} className={`bm-bag${total ? ' is-full' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <clipPath id={clip}><rect x="10" y="-20" width="44" height="69" /></clipPath>
          <linearGradient id={lip} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".32" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
        </defs>
        <ellipse className="bg-shadow" cx="32" cy="55" rx="18" ry="2.2" />
        <g className="bg-case">
          <path className="bg-lug" d="M23.5 22.5v-2M40.5 22.5v-2" />
          <path className="bg-handle" d="M23.5 20.5v-4.5a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v4.5" />
          <path className="bg-wall" d="M16.5 22h31a3.5 3.5 0 0 1 3.5 3.5V31H13v-5.5a3.5 3.5 0 0 1 3.5-3.5z" />
          <g className="bg-inside" clipPath={`url(#${clip})`}>
            <g className="bg-sh bg-s1"><rect x="17.5" y="16" width="13" height="19.5" rx="1.2" /><path d="M20.3 20h7.4M20.3 22.8h5" /></g>
            <g className="bg-sh bg-s3"><rect x="34" y="17" width="12.5" height="18.5" rx="1.2" /><path d="M36.8 21h7M36.8 23.8h4.5" /></g>
            <g className="bg-sh bg-s2"><rect x="25.5" y="14.5" width="13.5" height="21" rx="1.2" /><path className="bg-fold" d="M35.5 14.5h3.5v3.5z" /><path d="M28.3 18.7h7.8M28.3 21.5h7.8M28.3 24.3h5" /></g>
          </g>
          <g className="bg-drop"><rect x="26" y="9" width="12" height="20" rx="1.2" /></g>
          <path className="bg-front" d="M12.5 27h39v19.5a4.5 4.5 0 0 1-4.5 4.5H17a4.5 4.5 0 0 1-4.5-4.5z" />
          <rect className="bg-lip" x="13.6" y="28.1" width="36.8" height="3.2" fill={`url(#${lip})`} />
          <path className="bg-seam" d="M12.5 38h39" />
          <rect className="bg-latch" x="20" y="36.2" width="5" height="3.6" rx="1" /><rect className="bg-latch" x="39" y="36.2" width="5" height="3.6" rx="1" />
        </g>
      </svg>
      <span className="bm-bagn"><span ref={num}>{total || ''}</span></span>
    </button>
  );
}
