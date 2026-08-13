import { useState, useEffect, useRef } from "react";
import { User, Palette, SlidersHorizontal, Settings, FlaskConical, ChevronRight } from "lucide-react";

function ProfileMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (page) => {
    setOpen(false);
    onNavigate(page);
  };

  return (
    <div className="profile-menu" ref={ref}>
      <button className="profile-avatar" onClick={() => setOpen((o) => !o)} aria-label="Profile menu" aria-expanded={open}>
        <User size={16} />
      </button>
      {open && (
        <div className="profile-dropdown">
          <button className="profile-row" onClick={() => go("personalize")}>
            <Palette size={15} />
            <span>Personalize</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          <button className="profile-row" onClick={() => go("accessibility")}>
            <SlidersHorizontal size={15} />
            <span>Accessibility</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          <button className="profile-row" onClick={() => go("account")}>
            <Settings size={15} />
            <span>Account Settings</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          <button className="profile-row" onClick={() => go("features")}>
            <FlaskConical size={15} />
            <span>Features</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
        </div>
      )}
      <style>{`
        .profile-menu { position: relative; }
        .profile-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--avatar-bg); border: 1px solid var(--border); color: var(--accent); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .profile-avatar:hover { border-color: var(--accent); }
        .profile-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: var(--panel); border: 1px solid var(--border-hover); border-radius: 14px; padding: 10px; box-shadow: 0 12px 28px rgba(0,0,0,0.25); z-index: 50; animation: profileIn 0.15s ease-out; }
        @keyframes profileIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .profile-row { display: flex; align-items: center; gap: 10px; width: 100%; background: transparent; border: none; color: var(--text); font-size: 13px; padding: 9px 8px; border-radius: 8px; cursor: pointer; text-align: left; }
        .profile-row:hover { background: var(--panel-alt); }
        .profile-row-arrow { margin-left: auto; color: var(--muted2); }
      `}</style>
    </div>
  );
}

export default ProfileMenu;
