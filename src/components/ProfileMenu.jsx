import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useUserProgress } from "../lib/userProgress.jsx";
import { useFlags } from "../lib/flags.js";
import { FLY_SOLO_KEY } from "../lib/flySolo.js";
import Avatar from "./Avatar.jsx";
import { useSavesCount } from "../features/bookmarks/deck.js";

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
  /* A compass rose, for being shown around. Outline like the rest — every row
     here is a door rather than a state. */
  tour: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.8 7.2 8.9 8.9 7.2 12.8l3.9-1.7z" stroke="currentColor"
            strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  /* The same bookmark the feature draws everywhere else, at this menu's own
     20x20. Outline, because the row is a door rather than a state. */
  bookmark: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.5 3.2h9v13.6l-4.5-3.3-4.5 3.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  gear: (
    <svg className="mi" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4M15.2 15.2l-1.4-1.4M6.2 6.2 4.8 4.8"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
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

// Fly solo hides the photo and shows initials instead. It is a display
// preference, not a delete: the Clerk image stays intact, so turning Fly solo
// off returns the photo. The separate "Use initials" switch this replaced has
// been removed.

/* `profile` is this account's pilot_profiles row, handed down from App. It
   used to read Clerk's user.imageUrl here, which is never null — so the app
   bar has always drawn Clerk's generated grey glyph and never this app's
   initials, whatever colour anybody picked. See src/lib/avatar.js. */
function ProfileMenu({ onNavigate, profile = null, profileLoading = false }) {
  const { isSignedIn, user } = useUser();
  const saved = useSavesCount("all");
  const progress = useUserProgress();
  const { isAdmin } = useFlags();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // contains(), never identity: a real click lands on the inner
    // span.avbtn-face, not on the button, so `e.target !== avbtn` would open
    // the menu and close it again in the same tick.
    const onDown = (e) => {
      const btn = wrapRef.current?.querySelector(".avbtn");
      if (menuRef.current?.contains(e.target) || btn?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      wrapRef.current?.querySelector(".avbtn")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const walk = (e) => {
    const items = [...(menuRef.current?.querySelectorAll("button") || [])];
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  };

  const go = (page) => { setOpen(false); onNavigate(page); };
  const flySolo = progress.get(FLY_SOLO_KEY, false);
  const label = user?.username || user?.fullName || "Pilot";
  /* Fly solo hides your own face from everybody, and that includes the copy
     of it you are looking at — otherwise the one place it is still shown is
     the one place you would check. */
  const face = flySolo ? null : profile;
  /* THE SAME NAME THE CARD USES, so the same person is not "AR" on their
     licence and "S" in the bar. The profile's is authoritative; Clerk's is
     only the fallback for an account whose row has not arrived. */
  const faceName = profile?.real_name || profile?.callsign || label;

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
        {isSignedIn
          ? <Avatar profile={face} name={faceName} size={32} loading={profileLoading} />
          : (
            /* Signed out there is nobody to draw, so it stays the glyph —
               initials for an account that does not exist would be a face
               invented out of nothing. */
            <span className="avbtn-face">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
                <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" strokeWidth="1.7"
                      strokeLinecap="round" />
              </svg>
            </span>
          )}
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
          {ICON.prefs}<span className="mlabel">Preferences</span>
        </button>
        <button role="menuitem" type="button" onClick={() => go("appearance")}>
          {ICON.look}<span className="mlabel">Appearance</span>
        </button>
        {/* BOOKMARKS, WHERE SETTINGS WAS. Settings was a page with two things
            on it — the callsign field and the blocked list — and it took a
            pass just to give it a door at all. The callsign was already on the
            Licence tab with the server-side uniqueness check, and the blocked
            list has moved to Preferences, into the box about how you are
            social; so the page held nothing of its own and is gone. /settings
            still resolves, to here.

            The count is what makes this row worth its place: a menu item that
            says how much is behind it is a reason to open it. It is blank
            rather than "0" when there is nothing — §10, never state a zero. */}
        <button role="menuitem" type="button" onClick={() => go("bookmarks")}>
          {ICON.bookmark}<span className="mlabel">Bookmarks</span>
          {saved > 0 && <span className="mcount">{saved}</span>}
        </button>

        {/* THE WAY BACK INTO THE TOUR. It runs once on its own and then never
            again, which is right — and leaves nowhere to find it from, which
            is not. A student who skipped it on day one, or who wants the
            Library explained again in week three, presses this. */}
        <button role="menuitem" type="button" onClick={() => go("tour")}>
          {ICON.tour}<span className="mlabel">Show me around</span>
        </button>

        {/* No Sign out here. The Licence tab carries it, with "On this
            device only" under it, which is the better place for the one
            irreversible thing in the menu. */}
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
        .menu { position: absolute; right: 0; top: 48px; width: 210px; z-index: 40; padding: 7px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
          border-top-color: var(--edge-hi);
          box-shadow: 0 20px 44px var(--shadow-c); backdrop-filter: blur(14px); }
        /* IT OPENS AND IT CLOSES. The menu was the hidden attribute and nothing
           else, so it appeared and vanished in one frame. It stays a hidden
           attribute — the accessibility tree still sees one menu, open or not —
           and the display change is let through a transition (allow-discrete)
           so there is something to animate on the way out as well as in. It
           grows from the avatar it hangs from. */
        .menu { transform-origin: top right; }
        .menu[hidden] { display: none; opacity: 0; transform: translateY(-4px) scale(.97); }
        @media (prefers-reduced-motion: no-preference) {
          .menu {
            transition: opacity .14s var(--wg-fade-in), transform .22s var(--wg-spring),
                        display .22s allow-discrete, overlay .22s allow-discrete;
          }
          @starting-style { .menu:not([hidden]) { opacity: 0; transform: translateY(-4px) scale(.97); } }
        }
        .app.smooth-air .menu { transition: none; }
        .menu button { display: flex; width: 100%; align-items: center; gap: 11px; background: none;
          border: 0; border-radius: 9px; padding: 6px 9px; color: var(--t1);
          font-size: calc(13.5px * var(--scale, 1)); cursor: pointer; text-align: left;
          transition: background .14s; }
        .menu button:hover { background: var(--raised); }
        .menu .mi { width: 16px; height: 16px; flex: none; color: var(--t2); }
        .menu .mlabel { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .menu .chev { color: var(--t3); font-size: 16px; line-height: 1; }
        /* How much is behind the row. Tabular, like every other numeral here,
           and --t3 because it is a quantity rather than a state — the row is
           not lit by having things in it. */
        .menu .mcount { font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums;
          color: var(--t3); flex: none; }
        .menu .sep { display: block; height: 1px; background: var(--line); margin: 4px 5px; }
        .admin { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--active);
          color: var(--active); border-radius: 999px; padding: 3px 9px; font-family: var(--font-mono);
          font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; }
        .admin.small { padding: 2px 7px; font-size: 8.5px; }
      `}</style>
    </span>
  );
}

export default ProfileMenu;
