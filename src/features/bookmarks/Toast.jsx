import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { onToast } from './toastBus';

/* The app's one toast. The bus it listens to is in toastBus.js — see its
   header for why the two are apart. Mounted once, near the app root, so a
   toast raised on the way out of a screen survives the navigation. */
export { toast } from './toastBus';

export function BookmarksToastHost() {
  const [t, setT] = useState(null);
  useEffect(() => onToast(setT), []);
  useEffect(() => { if (!t) return undefined; const h = setTimeout(() => setT(null), t.ms); return () => clearTimeout(h); }, [t]);
  if (!t) return null;
  return createPortal(
    <div className="bm bm-toast" role="status" key={t.key}>
      {t.icon && <span className="bm-tb">{t.icon}</span>}
      <span>{t.message}</span>
      {t.action && <button type="button" onClick={() => { setT(null); t.action.fn(); }}>{t.action.label}</button>}
    </div>,
    document.body,
  );
}
