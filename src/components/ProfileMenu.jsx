import { useEffect, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useFlags } from "../lib/flags.js";

// §6 / §7 — the avatar opens a menu, not the page. Ported from
// docs/reference/wingman-poc.html with three corrections you asked for:
//
//   1. The POC has two adjacent .sep spans after the account row (lines
//      390-391). That is a bug; one separator.
//   2. The POC's account row icon is a mirrored sign-out door, near-identical
//      to the row three below it. A person glyph instead.
//   3. Features sits above Sign out with its own separator, admin-gated.
//      Order: account, settings, admin, leave.
//
// The account row IS the Licence link — there is no separate Licence row.

const ICON = {
  person: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16.2a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  prefs: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="6" r="1.8" fill="currentColor" /><circle cx="13" cy="10" r="1.8" fill="currentColor" />
      <circle cx="7" cy="14" r="1.8" fill="currentColor" />
    </svg>
  ),
  look: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3.5v13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" opacity=".55" />
    </svg>
  ),
  features: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 2.5v5.2L4.3 15a1.6 1.6 0 0 0 1.4 2.5h8.6a1.6 1.6 0 0 0 1.4-2.5L12 7.7V2.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 2.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  signout: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12 4H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6M9 10h8m0 0-3-3m3 3-3 3"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const initialsOf = (user) =>
  (user?.fullName || user?.username || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// "Use initials" is a display preference, not a delete: the Clerk image stays
// intact so toggling back returns the photo.
export const USE_INITIALS_KEY = "pw-use-initials";

function ProfileMenu({ onNavigate }) {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const progress = useUserProgress();
  const { isAdmin } = useFlags();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !wrapRef.current?.querySelector(".avbtn")?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      wrapRef.current?.querySelector(".avbtn")?.focus();
    };
    document.addEventListener("click", onDown);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector("button")?.focus();
    return () => { document.removeEventListener("click", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const walk = (e) => {
    const items = [...(menuRef.current?.querySelectorAll("button") || [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  };

  const go = (page) => { setOpen(false); onNavigate(page); };
  const useInitials = progress.get(USE_INITIALS_KEY, false);
  const photo = !useInitials && user?.imageUrl ? user.imageUrl : null;
  const label = user?.username || user?.fullName || "Pilot";

  return (
    <span className="menuwrap" ref={wrapRef}>
      <button
        className="avbtn is-inline"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label="Account menu"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <span className={`avbtn-face ${photo ? "has" : ""}`}
              style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
          {photo ? null : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
              <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" strokeWidth="1.7"
                    strokeLinecap="round" />
            </svg>
          )}
        </span>
      </button>

      <div className="menu" id="account-menu" role="menu" aria-label="Account"
           hidden={!open} ref={menuRef} onKeyDown={walk}>
        {/* The account row is the Licence link. */}
        <button role="menuitem" type="button" onClick={() => go(isSignedIn ? "licence" : "auth")}>
          {ICON.person}
          <span className="mlabel">{isSignedIn ? label : "Sign in"}</span>
          {isAdmin && <span className="admin small">Admin</span>}
          <span className="chev">›</span>
        </button>

        <span className="sep" />
        <button role="menuitem" type="button" onClick={() => go("preferences")}>
          {ICON.prefs}<span className="mlabel">Preferences</span><span className="chev">›</span>
        </button>
        <button role="menuitem" type="button" onClick={() => go("appearance")}>
          {ICON.look}<span className="mlabel">Appearance</span><span className="chev">›</span>
        </button>

        {isAdmin && (
          <>
            <span className="sep" />
            <button role="menuitem" type="button" onClick={() => go("features")}>
              {ICON.features}<span className="mlabel">Features</span><span className="chev">›</span>
            </button>
          </>
        )}

        {isSignedIn && (
          <>
            <span className="sep" />
            <button role="menuitem" type="button" onClick={() => { setOpen(false); signOut(); }}>
              {ICON.signout}<span className="mlabel">Sign out</span>
            </button>
          </>
        )}
      </div>

      <style>{`
        .menuwrap { position: relative; }
        .avbtn { width: 40px; height: 40px; min-height: 40px; border-radius: 50%;
          border: 1px solid var(--line); background: color-mix(in oklab, var(--panel), transparent 25%);
          color: var(--t2); display: grid; place-items: center; cursor: pointer; padding: 0;
          transition: background .16s, border-color .16s, color .16s; }
        .avbtn:hover { border-color: var(--t3); color: var(--t1); background: var(--raised); }
        .avbtn[aria-expanded="true"] { border-color: var(--active); color: var(--t1); }
        .avbtn-face { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
          background-size: cover; background-position: center; font-family: var(--font-mono);
          font-size: 12px; color: var(--t2); }
        .avbtn-face.has { background-color: var(--active-fill); color: var(--ground); }
        .menu { position: absolute; right: 0; top: 48px; width: 262px; z-index: 40; padding: 7px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
          border-top-color: var(--edge-hi);
          box-shadow: 0 20px 44px var(--shadow-c); backdrop-filter: blur(14px); }
        .menu[hidden] { display: none; }
        .menu button { display: flex; width: 100%; align-items: center; gap: 11px; background: none;
          border: 0; border-radius: 9px; padding: 10px 11px; color: var(--t1);
          font-size: calc(13.5px * var(--scale, 1)); cursor: pointer; text-align: left;
          transition: background .14s; }
        .menu button:hover { background: var(--raised); }
        .menu .mi { width: 19px; height: 19px; flex: none; color: var(--t2); }
        .menu .mlabel { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .menu .chev { color: var(--t3); font-size: 16px; line-height: 1; }
        .menu .sep { display: block; height: 1px; background: var(--line); margin: 6px 5px; }
        .admin { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--active);
          color: var(--active); border-radius: 999px; padding: 3px 9px; font-family: var(--font-mono);
          font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; }
        .admin.small { padding: 2px 7px; font-size: 8.5px; }
      `}</style>
    </span>
  );
}

export default ProfileMenu;
