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
      <p className="modnote__t">
        <b>{notice.lead}</b><span>{notice.rest}</span>
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
          /* The icon column is as wide as the dismiss control, so the words sit
             truly centred between them. */
          position: relative;
          margin: 14px auto 0; padding: 9px 26px;
          /* Only as wide as its words, centred over the card. */
          width: fit-content; max-width: 100%;
          /* SOFT AMBER (owner, 2026-11-14), a fixed hue rather than the livery's
             so a notice reads as a notice in every livery. A tint of amber over
             the panel, with the filled top edge this app uses for "live". */
          --amber: oklch(.8 .13 78);
          background: color-mix(in oklab, var(--amber) 13%, var(--panel));
          border: 1px solid color-mix(in oklab, var(--amber) 32%, var(--line));
          border-top: 2px solid var(--amber);
          border-radius: 13px;
        }
        .app.theme-light .modnote { --amber: oklch(.7 .14 72); }
        .modnote__i { color: var(--amber); flex: none; justify-self: center; }
        .modnote__t { margin: 0; min-width: 0; font-size: 13px; line-height: 1.45; text-align: center; text-wrap: balance; }
        .modnote__t b, .modnote__t span { display: block; }
        /* THE QUIET HALF TAKES --t2, NOT --t3. --t3 is right for a 10px
           uppercase mark; this is a sentence read as words, and the pairs this
           repo has already measured under 4.5:1 were all of exactly that
           mistake. */
        .modnote__t b { font-weight: 600; color: var(--t1); }
        .modnote__t span { color: var(--t2); }
        .modnote__x {
          position: absolute; top: 3px; right: 3px; display: grid; place-items: center;
          width: 24px; height: 24px; min-height: 0; padding: 0;
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
        .app.smooth-air .modnote__x { transition: none; }
      `}</style>
    </div>
  );
}
