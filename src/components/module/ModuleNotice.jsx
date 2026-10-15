/* =============================================================================
   THE ONE-TIME NOTICE, as a strip above the module's tabs.
   -----------------------------------------------------------------------------
   The rule is in `lib/notice.js`; this draws it. The split is the house one —
   a rule that lives in a component is a rule somebody tidying the markup can
   change.

   IT IS RENDERED BY BOTH BRANCHES OF ModuleScreen. The ported screen is on for
   everybody (`library.batches` is everyone:true) and the app's own is still
   there behind that flag, so a notice on only one of them would vanish the day
   the flag moved — the same class of mistake as a `data-tour` name put on one
   render branch of a card that has three.
   ========================================================================= */
import { useUserProgress } from "../../lib/userProgress.jsx";
import { NOTICE_KEY, noticeFor } from "../../lib/notice.js";

export default function ModuleNotice() {
  const progress = useUserProgress();
  /* Nothing is drawn until the progress document has arrived. Without this it
     flashes on every load for people who dismissed it long ago, which is the
     one thing a notice shown once must not do — the stamp reminder in
     ProfileMenu waits for the same reason. */
  if (!progress.loaded) return null;

  const notice = noticeFor(progress.get(NOTICE_KEY, null));
  if (!notice) return null;

  return (
    <div className="modnote" role="status">
      <svg className="modnote__i" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.9v4.6M12 15.6v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <p className="modnote__t">
        <b>{notice.lead}</b> <span>{notice.rest}</span>
      </p>
      <button type="button" className="modnote__x is-inline"
              aria-label="Dismiss this notice"
              onClick={() => progress.set(NOTICE_KEY, notice.id)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <style>{`
        .modnote {
          display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 11px; align-items: center;
          margin: 16px 0 0; padding: 11px 10px 11px 14px;
          background: var(--panel); border: 1px solid var(--line);
          /* A FILLED TOP EDGE, which is how this app marks something as live.
             §"No glow rings. Active reads structurally — a filled top edge." */
          border-top: 2px solid var(--active);
          border-radius: 13px;
        }
        .modnote__i { color: var(--active); flex: none; }
        .modnote__t { margin: 0; min-width: 0; font-size: 13.5px; line-height: 1.5; }
        /* THE QUIET HALF TAKES --t2, NOT --t3. --t3 is right for a 10px
           uppercase mark; this is a sentence read as words, and the pairs this
           repo has already measured under 4.5:1 were all of exactly that
           mistake. */
        .modnote__t b { font-weight: 600; color: var(--t1); }
        .modnote__t span { color: var(--t2); }
        .modnote__x {
          position: relative; display: grid; place-items: center;
          width: 30px; height: 30px; min-height: 0; padding: 0;
          border: 0; border-radius: 8px; background: none;
          color: var(--t3); cursor: pointer; transition: background .14s, color .14s;
        }
        .modnote__x:hover { background: var(--raised); color: var(--t1); }
        /* IT PAYS FOR ITS OWN OPT-OUT. §12 gives every button a 44px floor and
           '.is-inline' is the way out of it; app.css keeps a named list of the
           controls that take the opt-out and restore the TARGET with a
           pseudo-element, and this does the same for itself rather than
           growing that list from another file. The box stays 30px and nothing
           visible moves. */
        .modnote__x::after {
          content: ""; position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          width: max(100%, var(--tap, 44px)); height: max(100%, var(--tap, 44px));
        }
        @media (max-width: 560px) {
          .modnote { align-items: start; padding-top: 12px; }
          .modnote__i, .modnote__x { margin-top: 1px; }
        }
        .app.smooth-air .modnote__x { transition: none; }
      `}</style>
    </div>
  );
}
