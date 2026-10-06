/* =============================================================================
   LESSONS — a player waiting for its first video. Ported 2026-10-06.
   -----------------------------------------------------------------------------
   The demo's `lessons()`, element for element. No list, no batch structure and
   no route strip: this tab is one block saying the videos are being made and
   one button to the place the work actually is.

   THE CLAPPERBOARD'S ARM SNAPS EVERY FOUR SECONDS, which is a CSS animation on
   `.lb-arm` and therefore off under Smooth Air and `prefers-reduced-motion`
   like everything else here — §Design's last line, obeyed by not writing any
   JavaScript that moves.

   §10: it never says there are no lessons. It says what is coming and names
   the next action inside the sentence.
   ========================================================================= */
import "./lessons.css";

const PLAY = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4l13 8-13 8z" />
  </svg>
);

export default function LessonsWaiting({ moduleName, onOpenLibrary }) {
  return (
    <div className="lib2">
      <div className="lb-lessons">
        <div className="lb-player">
          <span className="lb-grain" />
          <span className="lb-rec">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinejoin="round">
              <rect x="3" y="9" width="18" height="11" rx="1.5" />
              <g className="lb-arm">
                <path d="M3 9l1.2-4.6L21 4l-.8 3.2z" />
                <path d="M8 4.3L6.6 8.6M13 4.2l-1.4 4.4M18 4.1l-1.4 4.4" />
              </g>
            </svg>
            IN PRODUCTION
          </span>
          <div className="lb-mid">
            <span className="lb-playbtn">{PLAY}</span>
            <h3>Video lessons are on the way</h3>
            <p>They&rsquo;ll appear here as they&rsquo;re made.</p>
          </div>
          <div className="lb-ctrl" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
            <span className="lb-track" />
            <span>--:--</span>
          </div>
        </div>
        <div className="lb-foot">
          <span>Everything for {moduleName} is in the Library for now.</span>
          <button type="button" className="lb-btn" onClick={onOpenLibrary}>Open the Library</button>
        </div>
      </div>
    </div>
  );
}
