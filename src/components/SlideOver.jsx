import { useEffect } from "react";
import { X } from "lucide-react";

// Shared right-hand slide-over. The notebook and discussion open here rather
// than rendering inline, so the study material stays the dominant content.
function SlideOver({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="slideover-root">
      <div className="slideover-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="slideover" role="dialog" aria-label={title}>
        <header className="slideover-head">
          <div>
            <h2 className="slideover-title">{title}</h2>
            {subtitle && <p className="slideover-sub">{subtitle}</p>}
          </div>
          <button className="slideover-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="slideover-body">{children}</div>
      </aside>
      <style>{`
        .slideover-root { position: fixed; inset: 0; z-index: 40; }
        .slideover-scrim { position: absolute; inset: 0; background: rgba(4,9,18,0.55); backdrop-filter: blur(2px); }
        .slideover { position: absolute; top: 0; right: 0; bottom: 0; width: min(460px, 100%); display: flex; flex-direction: column;
          background: var(--elev-1); border-left: 1px solid var(--border); box-shadow: -18px 0 44px rgba(0,0,0,0.4);
          animation: slideoverIn 0.22s cubic-bezier(0.22,1,0.36,1); }
        @keyframes slideoverIn { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .slideover-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          padding: 18px 18px 14px; border-bottom: 1px solid var(--border-soft); }
        .slideover-title { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); margin: 0; }
        .slideover-sub { font-size: 12px; color: var(--muted); margin: 3px 0 0; }
        .slideover-close { background: none; border: none; color: var(--muted); cursor: pointer; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center; border-radius: var(--r-sm); }
        .slideover-close:hover { color: var(--text); background: var(--elev-2); }
        .slideover-body { flex: 1; overflow-y: auto; padding: 16px 18px 24px; }
        .app.reduce-motion .slideover { animation: none; }
        @media (prefers-reduced-motion: reduce) { .slideover { animation: none; } }
        @media (max-width: 560px) { .slideover { width: 100%; } }
      `}</style>
    </div>
  );
}

export default SlideOver;
