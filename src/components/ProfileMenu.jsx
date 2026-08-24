import { useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { ChevronRight, ShieldCheck } from "lucide-react";

// §6 — the avatar opens a menu, not the page.
//
// The account row with the ADMIN chip → Licence · separator · Preferences ·
// Appearance · separator · Sign out. Progress and Bookmarks are deliberately
// not here.
//
// §9 — aria-haspopup / aria-expanded, escape closes, click-outside closes,
// arrow keys walk it, and focus moves into the first item on open.

const ITEMS = [
  { id: "licence", label: "Licence" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
];

function ProfileMenu({ onNavigate }) {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const isAdmin = user?.publicMetadata?.role === "admin";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); wrapRef.current?.querySelector(".avatar-btn")?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Focus moves into the first item on open.
    requestAnimationFrame(() => listRef.current?.querySelector("[data-item]")?.focus());
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const walk = (e) => {
    const items = [...(listRef.current?.querySelectorAll("[data-item]") || [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
  };

  const go = (page) => { setOpen(false); onNavigate(page); };
  const name = user?.username || user?.fullName || "Pilot";
  const initials = (user?.fullName || user?.username || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="avatar-menu" ref={wrapRef}>
      {/* §7 — the ring lights only when the menu is open. */}
      <button
        className={`avatar-btn is-inline ${open ? "is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your licence and settings"
        onClick={() => setOpen((o) => !o)}
      >
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" />
          : <span className="avatar-initials">{initials || "··"}</span>}
      </button>

      {open && (
        <div className="avatar-drop" role="menu" ref={listRef} onKeyDown={walk}>
          <button className="drop-account" role="menuitem" data-item tabIndex={0}
                  onClick={() => go(isSignedIn ? "licence" : "auth")}>
            <span className="drop-account-name">{isSignedIn ? name : "Sign in"}</span>
            {isAdmin && <span className="drop-admin"><ShieldCheck size={10} /> ADMIN</span>}
            <ChevronRight size={14} className="drop-arrow" />
          </button>

          <div className="drop-rule" />
          {ITEMS.map((it) => (
            <button key={it.id} className="drop-row" role="menuitem" data-item tabIndex={-1}
                    onClick={() => go(it.id)}>
              <span>{it.label}</span>
              <ChevronRight size={14} className="drop-arrow" />
            </button>
          ))}

          {isSignedIn && (
            <>
              <div className="drop-rule" />
              <button className="drop-row" role="menuitem" data-item tabIndex={-1} onClick={() => signOut()}>
                <span>Sign out</span>
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <div className="drop-rule" />
              <button className="drop-row" role="menuitem" data-item tabIndex={-1} onClick={() => go("features")}>
                <span>Features</span>
                <ChevronRight size={14} className="drop-arrow" />
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        .avatar-menu { position: relative; }
        /* §7 — the windsock pill and the avatar are both 40px with the same
           border and the same glass fill, so they read as a set. */
        .avatar-btn { width: 40px; height: 40px; min-height: 40px; padding: 0; border-radius: 50%;
          background: var(--panel); border: 1px solid var(--line); color: var(--t2);
          display: grid; place-items: center; cursor: pointer; overflow: hidden; }
        .avatar-btn img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-initials { font-family: var(--font-mono); font-size: 12px; letter-spacing: .04em; }
        .avatar-btn.is-open { border-color: var(--active); box-shadow: 0 0 0 1px var(--active); color: var(--t1); }

        .avatar-drop { position: absolute; top: calc(100% + 8px); right: 0; width: 232px; z-index: 50;
          background: var(--panel); border: 1px solid var(--line); border-top-color: var(--edge-hi);
          border-bottom-color: var(--edge-lo); border-radius: var(--r-panel); padding: 7px;
          box-shadow: 0 12px 28px var(--shadow-c); }
        .drop-account { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
          background: none; border: 0; border-radius: var(--r-control); padding: 8px 9px; cursor: pointer;
          color: var(--t1); font-size: 13px; font-weight: 600; text-align: left; }
        .drop-account-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .drop-admin { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono);
          font-size: 8.5px; letter-spacing: .12em; color: var(--ground); background: var(--active-fill);
          border-radius: 3px; padding: 2px 5px; }
        .drop-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px;
          background: none; border: 0; border-radius: var(--r-control); padding: 8px 9px; cursor: pointer;
          color: var(--t2); font-size: 13px; text-align: left; }
        .drop-row span:first-child { flex: 1; }
        .drop-account:hover, .drop-row:hover, .drop-row:focus-visible, .drop-account:focus-visible {
          background: var(--raised); color: var(--t1); }
        .drop-arrow { color: var(--t3); flex: none; }
        .drop-rule { height: 1px; background: var(--line); margin: 5px 2px; }
      `}</style>
    </div>
  );
}

export default ProfileMenu;
