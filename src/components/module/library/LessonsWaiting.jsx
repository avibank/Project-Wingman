/* =============================================================================
   LESSONS — a player waiting for its first video.
   -----------------------------------------------------------------------------
   The demo's `lessons()`, element for element and class for class. No list, no
   batch structure and no route strip: this tab is one block saying the videos
   are being made and one button to the place the work actually is.

   THE CLASS NAMES ARE THE DEMO'S and the rules come from the generated
   `port.css`, which is the demo's whole stylesheet with every selector
   prefixed. `lessons.css` — the hand-renamed `.lb-*` copy the first port
   needed — is gone with them.

   THE CLAPPERBOARD'S ARM SNAPS EVERY FOUR SECONDS, which is a CSS animation on
   `.arm` and therefore off under Smooth Air and `prefers-reduced-motion` like
   everything else here — obeyed by not writing any JavaScript that moves.

   IT IS STILL FOR A MODULE WITH NO VIDEO, NOT FOR WHOEVER HAS THE FLAG ON, and
   that is a deliberate divergence from §2 of the handoff. §2 reads "Lessons tab
   → demo `lessons()` output" without a condition, which is right for the course
   as it ships — it has no videos. Made unconditional it would also put "video
   lessons are on the way" over the demo course's TWELVE lessons, which is a bug
   this screen has already had: see CLAUDE.md, "The waiting screen is for a
   module with no video". `ModuleScreen` asks the module (`hasLessons`) and the
   flag only decides which of the two screens answers; `check:states` holds
   that condition and would fail if it were dropped.

   §10: it never says there are no lessons. It says what is coming and names
   the next action inside the sentence.
   ========================================================================= */
import { PLAY } from "./thumbs.jsx";

export default function LessonsWaiting({ moduleName, onOpenLibrary }) {
  return (
    <div className="lessons">
      <div className="player">
        <span className="grain" />
        <span className="rec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.7" strokeLinejoin="round">
            <rect x="3" y="9" width="18" height="11" rx="1.5" />
            <g className="arm">
              <path d="M3 9l1.2-4.6L21 4l-.8 3.2z" />
              <path d="M8 4.3L6.6 8.6M13 4.2l-1.4 4.4M18 4.1l-1.4 4.4" />
            </g>
          </svg>
          IN PRODUCTION
        </span>
        <div className="mid">
          <span className="playbtn">{PLAY}</span>
          <h3>Video lessons are on the way</h3>
          <p>They&rsquo;ll appear here as they&rsquo;re made.</p>
        </div>
        <div className="ctrl" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
          <span className="track" />
          <span>--:--</span>
        </div>
      </div>
      <div className="foot">
        <span>Everything for {moduleName} is in the Library for now.</span>
        <button type="button" className="btn" onClick={onOpenLibrary}>Open the Library</button>
      </div>
    </div>
  );
}
