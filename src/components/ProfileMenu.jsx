import { useState, useEffect, useRef } from "react";
import { User, FlaskConical, ChevronRight, LogIn, ShieldCheck, TrendingUp, BookMarked } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useIsAdmin } from "../lib/admin.js";

function ProfileMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { isSignedIn, user } = useUser();
  const isAdmin = useIsAdmin();

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
          <button className="profile-row profile-row--auth" onClick={() => go(isSignedIn ? "profile" : "auth")}>
            <LogIn size={15} />
            <span className="profile-row-truncate">{isSignedIn ? (user.username || user.fullName || "Pilot") : "Sign In"}</span>
            {isAdmin && <span className="profile-admin-badge"><ShieldCheck size={10} /> ADMIN</span>}
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          <div className="profile-divider" />
          <button className="profile-row" onClick={() => go("progress")}>
            <TrendingUp size={15} />
            <span>Progress</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          <button className="profile-row" onClick={() => go("bookmarks")}>
            <BookMarked size={15} />
            <span>Bookmarks</span>
            <ChevronRight size={14} className="profile-row-arrow" />
          </button>
          {isAdmin && (
            <>
              <div className="profile-divider" />
              <button className="profile-row" onClick={() => go("features")}>
                <FlaskConical size={15} />
                <span>Features</span>
                <ChevronRight size={14} className="profile-row-arrow" />
              </button>
            </>
          )}
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
        .profile-row-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-admin-badge { display: flex; align-items: center; gap: 3px; flex-shrink: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 20px; padding: 2px 6px; }
        .profile-divider { height: 1px; background: var(--border-soft); margin: 6px 4px; }
      `}</style>
    </div>
  );
}

export default ProfileMenu;
