/* =============================================================================
   INVITE YOUR CLASS — a link, and a way to send it out of the app.
   -----------------------------------------------------------------------------
   The owner (2026-09-23): "invite your class should prompt with a link to send
   outside of the app". It used to open the module's question board, which is a
   reasonable place to be and not an invitation: nothing about it could be sent
   to somebody who is not here yet.

   THE LINK IS THE MODULE'S. There is no class to join — every module is open,
   and 0011's `my_modules` works out who studies what from what they have
   actually done. So what a classmate is sent is the module itself: it opens
   the app on Module 13d, the walkthrough shows them round before they decide
   anything, and when they make an account they turn up on the Crew wall for
   that module, which is what the person doing the inviting wanted.

   SENDING IT IS THE PLATFORM'S JOB, and `lib/outside.js` already knows how to
   ask on each one: the share sheet on a phone, the clipboard on a desktop, and
   the link in a field that can be copied by hand where neither works. That
   last one is why the field is always on screen rather than only after a
   failure — half this class is on an iPhone, and an in-app browser that
   refuses both is a real Tuesday.

   Nothing here claims a success it did not see: every line under the buttons
   is the outcome `share()` reported.
   ========================================================================= */
import { useEffect, useRef, useState } from "react";
import { share, SHARED, COPIED, CANCELLED } from "../lib/outside.js";
import { path as routePath } from "../lib/routes.js";

export default function InviteSheet({ moduleCode, moduleName = "this module", onClose }) {
  const [said, setSaid] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef(null);
  const sheetRef = useRef(null);

  const origin = (typeof window !== "undefined" && window.location?.origin) || "https://www.wingman.institute";
  const link = `${origin}${routePath.module(moduleCode || "")}`;

  /* Esc closes it, and the first thing under the fingers is the link itself. */
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", key);
    fieldRef.current?.focus({ preventScroll: true });
    fieldRef.current?.select();
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const send = async () => {
    setBusy(true);
    const r = await share(link, `Wingman — ${moduleName}`);
    setBusy(false);
    if (r === SHARED) { onClose?.(); return; }          // their own sheet said it
    setSaid(r === COPIED ? "Link copied. Paste it into your class group."
      : r === CANCELLED ? "It is still here when you want it."
      : "Copy it from the box above and paste it into your class group.");
    if (r !== COPIED) { fieldRef.current?.focus(); fieldRef.current?.select(); }
  };

  return (
    <div className="iv" role="dialog" aria-labelledby="iv-title" aria-modal="true">
      <button className="iv-scrim" onClick={onClose} aria-label="Close" />
      <div className="iv-sheet" ref={sheetRef}>
        <h2 id="iv-title" className="iv-title">Invite your class</h2>
        <p className="iv-note">
          This link opens {moduleName} on Wingman. Send it to the group chat your class
          already uses — whoever taps it gets a look round the whole app before they
          decide anything, and once they have an account they appear here on Crew,
          chapter by chapter, and on the boards beside you.
        </p>

        <label className="iv-field">
          <span className="iv-lbl">The link</span>
          <input ref={fieldRef} className="iv-input" type="text" readOnly value={link}
                 onFocus={(e) => e.target.select()} onClick={(e) => e.target.select()} />
        </label>

        <div className="iv-acts">
          <button type="button" className="iv-btn iv-btn--primary" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send the link"}
          </button>
          <button type="button" className="iv-btn" onClick={onClose}>Done</button>
        </div>
        {said && <p className="iv-said" role="status">{said}</p>}
      </div>

      <style>{`
        .iv { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; }
        .iv-scrim { position: absolute; inset: 0; background: color-mix(in oklab, var(--ground), transparent 25%); border: none; padding: 0; }
        .iv-sheet { position: relative; width: 100%; max-width: 640px; margin: 0 auto;
          background: var(--surface-1); border-radius: 12px 12px 0 0;
          padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); }
        .iv-title { margin: 0 0 10px; font-family: var(--font-ui); font-size: 19px; color: var(--text-1); }
        .iv-note { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: var(--text-2); }
        .iv-field { display: grid; gap: 6px; margin-bottom: 16px; }
        .iv-lbl { font-family: var(--font-mono); font-size: 11px; letter-spacing: .09em;
          text-transform: uppercase; color: var(--text-3); }
        .iv-input { width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--hairline); background: var(--surface-2); color: var(--text-1);
          font-family: var(--font-mono); font-size: 14px; }
        .iv-acts { display: grid; gap: 8px; }
        .iv-btn { min-height: 44px; padding: 10px 16px; border-radius: 12px; border: none;
          background: var(--surface-2); color: var(--text-1); font-size: 16px; cursor: pointer; }
        .iv-btn--primary { background: var(--warm); color: var(--surface-0); }
        .iv-btn:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }
        .iv-said { margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: var(--text-2); }
        @media (min-width: 700px) {
          .iv { align-items: center; }
          .iv-sheet { border-radius: 14px; }
        }
      `}</style>
    </div>
  );
}
