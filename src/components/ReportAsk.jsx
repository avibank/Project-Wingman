/* The composer behind the pill in the corner.
   -----------------------------------------------------------------------------
   ITS OWN CHUNK, because the pill is on every screen and this is only ever
   needed after somebody presses it. The entry chunk sits exactly on its
   budget — adding a sheet nobody has opened to every first paint is what put
   it 4KB over on the way in. It arrives in the time it takes the scrim to
   appear, and until it does the pill simply looks pressed.
   ========================================================================= */
import { useEffect, useRef } from "react";

export default function ReportAsk({ note, onNote, onSend, onClose }) {
  const box = useRef(null);
  useEffect(() => {
    box.current?.focus();
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <>
      {/* The scrim is a BUTTON so a click away closes it without a handler on
          the document, which would also catch the pill's own click and reopen
          what it just shut. */}
      <button type="button" className="rpt-scrim" data-diff-ignore=""
              aria-label="Close" onClick={onClose} />
      <div className="rpt-ask" data-diff-ignore="" role="dialog" aria-label="Report a problem">
        <label htmlFor="rpt-note">What&rsquo;s wrong?</label>
        <textarea id="rpt-note" ref={box} rows={3} value={note}
                  placeholder="The page you are on comes with it, so just say what went wrong."
                  onChange={(e) => onNote(e.target.value)} />
        <div className="rpt-acts">
          <button type="button" className="rpt-cancel" onClick={onClose}>Not now</button>
          <button type="button" className="rpt-send" onClick={onSend}>Send it</button>
        </div>
      </div>
      <style>{`
        .rpt-scrim { position: fixed; inset: 0; z-index: 56; border: 0; padding: 0;
          background: oklch(0 0 0 / .28); cursor: default; }
        .rpt-ask { position: fixed; left: 12px; bottom: 68px; z-index: 57;
          width: min(340px, calc(100vw - 24px));
          background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
          padding: 13px 14px 12px; box-shadow: var(--shadow, var(--drop, none));
          display: grid; gap: 9px; }
        .rpt-ask label { font: 600 13px var(--font-ui); color: var(--t1); }
        .rpt-ask textarea { width: 100%; box-sizing: border-box; resize: vertical;
          min-height: 68px; padding: 9px 10px; border-radius: 10px;
          border: 1px solid var(--line); background: var(--ground); color: var(--t1);
          font: 400 13.5px/1.45 var(--font-ui); }
        .rpt-ask textarea::placeholder { color: var(--t3); }
        .rpt-acts { display: flex; justify-content: flex-end; gap: 8px; }
        .rpt-acts button { min-height: var(--tap, 44px); padding: 8px 14px;
          border-radius: 999px; font: 600 13px var(--font-ui); cursor: pointer; }
        .rpt-cancel { border: 1px solid var(--line); background: none; color: var(--t2); }
        .rpt-cancel:hover { color: var(--t1); }
        .rpt-send { border: 1px solid var(--active-fill); background: var(--active-fill);
          color: var(--ground); }
        .app.theme-light[data-paper] .rpt-send {
          background: var(--active-text); border-color: var(--active-text); }
      `}</style>
    </>
  );
}
