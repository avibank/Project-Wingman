import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchChapterPresence } from "../lib/presence.js";
import { fetchProfiles, fetchBlocks, assignMarkings } from "../lib/squadron.js";
import { computeGlow } from "../lib/glow.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";
import PilotSheet from "./PilotSheet.jsx";

// §7.6 — the chapter body's one social element, and it is not an element: it is
// the lighting. No counter, no faces, no notification. Tapping it opens the
// faces, which is user-initiated and so does not break the social-free rule.

const POLL_MS = 60_000;

function StudyGlow({ chapterId, ownLivery = "dawn-patrol", enabled = true, onSayHi }) {
  const { user } = useUser();
  const [others, setOthers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!chapterId || !enabled) { setOthers([]); return; }
    let live = true;

    const read = async () => {
      const rows = await fetchChapterPresence(chapterId, user?.id);
      if (!live) return;
      const blocked = user?.id ? await fetchBlocks(user.id) : [];
      if (!live) return;
      const map = await fetchProfiles(rows.map((r) => r.user_id));
      if (!live) return;
      setProfiles(map);
      setOthers(
        rows
          // §8.3 — invisible users do not warm the room and are not counted.
          .filter((r) => !map[r.user_id]?.invisible && !blocked.includes(r.user_id))
          .map((r) => ({ ...r, livery: map[r.user_id]?.livery || "dawn-patrol" }))
          .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
      );
    };

    read().catch(() => {});
    timer.current = setInterval(() => read().catch(() => {}), POLL_MS);
    return () => { live = false; clearInterval(timer.current); };
  }, [chapterId, enabled, user?.id]);

  // The chapter body must remain fully usable at 0% glow (§7.6).
  if (!enabled) return null;

  const { n, hue, alpha } = computeGlow({ others, ownLivery });
  const marked = assignMarkings(
    others.slice(0, 8).map((o) => ({
      ...o,
      callsign: profiles[o.user_id]?.callsign || o.display_name || "Pilot",
      is_staff: profiles[o.user_id]?.is_staff || false,
      joined_at: o.last_seen,
    })),
    hueOf
  );

  const vars = { "--glow-h": hue, "--glow-a": alpha };

  return (
    <>
      <div className="glow" style={vars} aria-hidden="true" />
      {/* The lighting layer never takes clicks -- a fixed overlay that did would
          swallow every control under it. The tap target is a small in-flow
          affordance the host places, so the glow itself stays atmospheric. */}
      {n > 0 && (
        <button className="glow-tap" style={vars} onClick={() => setOpen(true)}>
          <span className="glow-tap-mark" aria-hidden="true" />
          <span className="sr-only">{n} {n === 1 ? "pilot is" : "pilots are"} on this chapter. Open.</span>
        </button>
      )}

      {open && (
        <div className="glow-sheet" role="dialog" aria-label="On this chapter">
          <div className="glow-sheet-inner">
            <h2 className="glow-sheet-title">On this chapter</h2>
            <ul className="glow-faces">
              {marked.map((p) => (
                <li key={p.user_id}>
                  <button className="glow-face" onClick={() => setSheet(p)}>
                    <Tail name={p.callsign} livery={p.livery} marking={p.marking} size={44} staff={p.is_staff} />
                    <span className="glow-face-name">{p.callsign}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="glow-sheet-actions">
              {onSayHi && (
                <button className="glow-hi" onClick={() => { onSayHi(marked); setOpen(false); }}>Say hi</button>
              )}
              <button className={`glow-close ${onSayHi ? "" : "is-only"}`} onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <PilotSheet
          pilot={sheet}
          chapterId={chapterId}
          onClose={() => setSheet(null)}
          onChanged={() => setOthers((o) => o.filter((x) => x.user_id !== sheet.user_id))}
        />
      )}

      <TailStyles />
      <style>{`
        /* A gradient is not an animatable value. Registering the two inputs
           makes them interpolate, and the gradient recomputes per frame. */
        @property --glow-h { syntax: '<number>'; inherits: true; initial-value: 55; }
        @property --glow-a { syntax: '<number>'; inherits: true; initial-value: 0.03; }
        .glow { position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(90% 60% at 50% 0%,
            oklch(0.80 0.135 var(--glow-h) / var(--glow-a)) 0%, transparent 70%);
          transition: --glow-h 2s linear, --glow-a 2s linear; }
        .glow-tap { display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; background: none; border: none; cursor: pointer; padding: 0; }
        /* §7.6 — no counter and no faces on the body. A single warm point, in
           the colour the room is already lit in. */
        .glow-tap-mark { width: 7px; height: 7px; border-radius: 50%;
          background: oklch(0.80 0.135 var(--glow-h));
          box-shadow: 0 0 0 3px oklch(0.80 0.135 var(--glow-h) / 0.22); }
        @media (prefers-reduced-motion: reduce) { .glow-tap-mark { box-shadow: none; outline: 2px solid currentColor; } }

        .glow-sheet { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end;
          background: color-mix(in oklab, var(--ground), transparent 30%); }
        .glow-sheet-inner { width: 100%; background: var(--surface-1);
          border-radius: 12px 12px 0 0; padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
          margin: 0 auto; max-width: 640px; }
        .glow-sheet-title { font-family: var(--font-ui); font-size: 20px; font-weight: 500;
          color: var(--text-1); margin: 0 0 16px; }
        .glow-faces { list-style: none; display: flex; flex-wrap: wrap; gap: 16px 12px; padding: 0; margin: 0 0 24px; }
        .glow-faces li { display: flex; width: 64px; }
        .glow-face { display: flex; flex-direction: column; align-items: center; gap: 6px;
          width: 100%; background: none; border: none; padding: 4px 0; cursor: pointer; min-height: 44px; }
        .glow-face-name { font-size: 12px; color: var(--text-3); max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .glow-sheet-actions { display: flex; gap: 10px; }
        .glow-hi { flex: 1; min-height: 48px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-family: var(--font-ui);
          font-size: 16px; font-weight: 500; }
        .glow-close { min-height: 48px; padding: 0 18px; border: none; border-radius: 12px;
          cursor: pointer; background: var(--surface-2); color: var(--text-2); font-size: 16px; }
        .glow-close.is-only { flex: 1; }

        @media (prefers-reduced-motion: reduce) { .glow { transition: none; } }
      `}</style>
    </>
  );
}

export default StudyGlow;
