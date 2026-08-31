import Dial from "./Dial.jsx";
import { CautionMark } from "./Instruments.jsx";
import { isBelow, readingWords, PASS_PCT } from "../../lib/minimums.js";

/* ============================================================================
   §6 — QUIZ RESULTS.

   "Centred, short. Master Caution above if below minimums, then the score at
   display size, then one line of verdict, then the dial, then the average
   moving, then the actions. Nothing else."

   The copy, in full, from the brief:
     4 of 8 · 25 under your bar · Average 61% → 63% · Re-check · Back to Module 1

   This is the ONE place the dial animates (§3). The needle sweeps from the old
   average to the new one, which is the only moment where the movement carries
   information rather than decoration — and it is the reason the results dial
   is 170px while the Library's is 58px.

   A RETAKE MOVES NOTHING. Only the first attempt at a quiz is scored, so a
   retake has no new average to sweep to. Saying so is the honest thing and it
   is already how the rest of the surface behaves; the dial is simply not
   animated and the average line is omitted rather than showing an arrow
   between two identical numbers.
   ========================================================================= */

export default function QuizResults({
  title, right, total, minimums = PASS_PCT,
  averageBefore = null, averageAfter = null,
  retake = false, moduleName, onRecheck, onLeave, movedNote = null,
}) {
  const pct = total > 0 ? Math.round((right / total) * 100) : null;
  const below = isBelow(pct, minimums);
  const moved = !retake && averageBefore !== null && averageAfter !== null
    && averageBefore !== averageAfter;

  return (
    <div className="quiz qresults">
      <div className="quiz-head">
        <span className="quiz-name">{title}</span>
        <button type="button" className="quiz-leave" onClick={onLeave}>Close</button>
      </div>

      <div className="qr-body">
        {/* §2 — the lamp, above the score, when the sitting fell below the
            user's own bar. Not below the pass mark: their bar. */}
        {below && <div className="qr-lamp"><CautionMark /></div>}

        <p className="qr-score">{right} of {total}</p>

        {/* §6 — ONE line of verdict. */}
        <p className="qr-verdict">
          {pct === null ? "Nothing to score yet"
            : below ? readingWords(pct, minimums)
              : pct === minimums ? "Exactly on your bar" : readingWords(pct, minimums)}
        </p>

        {/* §3 — the dial at 170px, sweeping from the old average to the new. */}
        <div className="qr-dial">
          <Dial size={170}
                average={averageAfter}
                from={averageBefore}
                last={pct}
                minimums={minimums}
                animate={moved}
                label={`Your average. ${readingWords(averageAfter, minimums)}.`} />
        </div>

        {/* §6 — the average moving. Omitted entirely when nothing moved, rather
            than drawn as an arrow between two equal numbers. */}
        {moved ? (
          <p className="qr-move">
            Average <b>{averageBefore}%</b> → <b>{averageAfter}%</b>
          </p>
        ) : averageAfter !== null ? (
          <p className="qr-move">Average <b>{averageAfter}%</b></p>
        ) : movedNote ? (
          <p className="qr-move">{movedNote}</p>
        ) : null}

        {retake && (
          <p className="qr-note">
            A retake does not move the average — that reads your first attempt
            at each quiz.
          </p>
        )}
      </div>

      <div className="qr-acts">
        {below && onRecheck && (
          <button type="button" className="q-btn" data-primary="" onClick={onRecheck}>
            Re-check
          </button>
        )}
        <button type="button" className="q-btn" onClick={onLeave}>
          {moduleName ? `Back to ${moduleName}` : "Back to the module"}
        </button>
      </div>
    </div>
  );
}
