import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchMissStats } from "../lib/quizStats.js";
import { fetchMessages, sendMessage } from "../lib/comms.js";

// §9.3.3 — the debrief replaces "Light turbulence · Retake set", which was a
// dead end: no score, no way onward, and a status word instead of a number.
//
// This is the moment of maximum reflection and it produces a permanent
// artefact, which makes it the highest-value social surface on the academic
// side. Everything here is either the score, a way onward, or the note.

function Debrief({ chapterCode, chapterId, moduleCode, correct, total, missedIds = [], nextChapter, onReview, onNext, onRetake }) {
  const { user, isSignedIn } = useUser();
  const [trips, setTrips] = useState(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [notes, setNotes] = useState([]);
  const [openNotes, setOpenNotes] = useState(false);
  const missedOne = missedIds.length === 1;

  useEffect(() => {
    let live = true;
    // "trips most people" is an aggregate over the question you actually missed —
    // true whether or not anybody is online, which is the point of §9.3.2's
    // anonymous numbers.
    if (missedIds.length) {
      fetchMissStats(missedIds[0]).then((s) => live && setTrips(s)).catch(() => {});
    }
    fetchMessages({ moduleCode, chapterId, userId: user?.id, limit: 30 })
      .then((rows) => live && setNotes((rows || []).filter((r) => !r.is_system)))
      .catch(() => {});
    return () => { live = false; };
  }, [chapterId, moduleCode, user?.id, missedIds.join(",")]);

  return (
    <section className="db">
      <h2 className="db-title">Debrief — {chapterCode}</h2>

      {/* §8.3 — a number, not "Light turbulence". */}
      <p className="db-score">
        {correct} of {total} correct.
        {trips && trips.missers > 1 &&
          ` ${missedOne ? "The one you missed" : "The first one you missed"} trips most people — ${trips.missers} others have too.`}
      </p>

      <div className="db-actions">
        {missedIds.length > 0 && (
          <button className="db-go" onClick={() => onReview(missedIds[0])}>
            {missedOne ? "Review the one you missed" : `Review the ${missedIds.length} you missed`}
          </button>
        )}
        {nextChapter
          ? <button className="db-go" onClick={() => onNext(nextChapter)}>Next: {nextChapter.code} →</button>
          : <button className="db-quiet-btn" onClick={onRetake}>Retake this set</button>}
      </div>

      {isSignedIn && (
        sent ? (
          <p className="db-quiet">Left on {chapterCode} for whoever flies it next.</p>
        ) : (
          <div className="db-note">
            <label className="db-label" htmlFor="db-note-input">Leave a note for the next pilot</label>
            <textarea
              id="db-note-input" className="db-input" rows={2} value={note}
              placeholder={`The thing that made ${chapterCode} click.`}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="db-go" disabled={!note.trim()}
              onClick={async () => {
                await sendMessage({ moduleCode, userId: user.id, body: note.trim(), chapterId });
                setSent(true);
              }}
            >Leave it</button>
          </div>
        )
      )}

      {notes.length > 0 && (
        <details className="db-notes" open={openNotes} onToggle={(e) => setOpenNotes(e.target.open)}>
          <summary>{notes.length} debrief {notes.length === 1 ? "note" : "notes"} from other pilots</summary>
          <ul className="db-notes-list">
            {notes.map((n) => <li key={n.id}>{n.body}</li>)}
          </ul>
        </details>
      )}

      <style>{`
        .db { display: flex; flex-direction: column; gap: 16px; padding: 24px 0;
          max-width: 66ch; margin: 0 auto; text-align: left; }
        .db-title { font-size: 20px; font-weight: 500; color: var(--text-primary); margin: 0; }
        .db-score { font-size: 16px; line-height: 1.55; color: var(--text-primary); margin: 0; }
        .db-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .db-go { min-height: 48px; padding: 0 16px; border: none; border-radius: 8px; cursor: pointer;
          background: var(--accent-interactive); color: var(--bg-ground); font-size: 16px; font-weight: 500; }
        .db-go:disabled { background: var(--bg-raised); color: var(--text-tertiary); cursor: default; }
        .db-quiet-btn { min-height: 48px; padding: 0 16px; border: none; border-radius: 8px; cursor: pointer;
          background: var(--bg-raised); color: var(--text-primary); font-size: 16px; }
        .db-quiet { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .db-note { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .db-label { font-size: 14px; color: var(--text-secondary); }
        .db-input { width: 100%; resize: vertical; min-height: 56px; padding: 10px 12px; border: none;
          border-radius: 8px; background: var(--bg-raised); color: var(--text-primary);
          font-size: 16px; line-height: 1.5; }
        .db-input:focus { outline: 2px solid var(--accent-interactive); outline-offset: -1px; }

        .db-notes summary { cursor: pointer; font-size: 14px; color: var(--text-secondary); min-height: 44px;
          display: flex; align-items: center; }
        .db-notes-list { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 1px;
          background: var(--hairline); border-radius: 8px; overflow: hidden; }
        .db-notes-list li { background: var(--bg-panel); padding: 12px 14px; font-size: 14px;
          line-height: 1.55; color: var(--text-primary); }
      `}</style>
    </section>
  );
}

export default Debrief;
