/* =============================================================================
   THE LOGBOOK — §3 of the launch handoff, in place of the notes carousel.
   -----------------------------------------------------------------------------
   One list, in moment order, of everything on this lesson that is yours or
   your right seat's: press a stamp to seek the video to it, press the bin to
   remove your own. What each row IS lives in src/lib/lessonLog.js; this file
   only draws it.

   WHY THE CAROUSEL WENT. A deck shows one note at a time, which is the wrong
   shape for the question a student actually asks here — "what did I mark on
   this lesson?" — and it cannot show a second author at all. The deck's own
   virtue, that flipping through it re-walks the lesson, survives: the list is
   in moment order for exactly that reason.

   EVERY CLASS IS PREFIXED lg-. `.entry`, `.chip`, `.log`, `.st` and `.del` are
   the design's names and all five already paint something else in this app —
   the Crew tab shipped 38px-wide pills for exactly this reason, and that one
   only reached the deploy because the collision was same-specificity and
   source order decided it.
   ========================================================================= */
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { LOG_FILTERS, filterLog, exportText, exportName } from "../../lib/lessonLog.js";
import { drawLogStamp, logTilt } from "../../lib/logStamp.js";
import { mmss } from "./lessonState.js";
import { downloadBlob, downloadSaid } from "../../lib/outside.js";
import { toast } from "../../features/bookmarks/toastBus.js";
import "./log.css";

/* One row's stamp. dangerouslySetInnerHTML for the same reason <Stamp> uses
   it: the markup is assembled from fixed paths in logStamp.js and the only
   variable parts are a clock and a three-character code, both cleaned there. */
function RowStamp({ kind, t, code, seed }) {
  const svg = useMemo(() => drawLogStamp(kind, t, { code, seed }), [kind, t, code, seed]);
  return <span className="lg-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function LogTab({
  entries, filter, onFilter, onSeek, onDelete, seat = null, stamp = null,
}) {
  const seed = stamp?.seed || 1;
  const shown = filterLog(entries, filter);

  return (
    <div className="lgbook">
      {/* §3 — All / Mine / the right seat. The third chip exists only while
          somebody is in the seat: a filter for a person who is not there is a
          control that can never do anything, and this app treats that as a
          launch blocker rather than a harmless extra. */}
      <div className="lg-chips" role="group" aria-label="Filter the logbook">
        {LOG_FILTERS.map((f) => {
          if (f === "seat" && !seat) return null;
          return (
            <button key={f} type="button" className="lg-chip is-inline"
                    aria-pressed={filter === f}
                    onClick={() => onFilter(f)}>
              {f === "seat" && <span className="lg-dot" aria-hidden="true" />}
              {f === "all" ? "All" : f === "me" ? "Mine" : `${seat.name} · right seat`}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        /* Names the next action inside the sentence, and never the count. */
        <p className="lg-empty">
          {filter === "seat"
            ? `What ${seat?.name || "your right seat"} asks on this lesson lands here.`
            : "Press the stamp in the player to log this moment."}
        </p>
      ) : (
        <ul className="lg-list">
          {shown.map((e) => (
            <li key={e.id} className="lg-entry" data-kind={e.kind}>
              <button type="button" className="lg-st"
                      style={{ "--lg-tilt": `${logTilt(seed, e.id)}deg` }}
                      onClick={() => onSeek(e.t)}
                      aria-label={`Play from ${mmss(e.t)}`}>
                <RowStamp kind={e.kind} t={e.t} code={stamp?.code} seed={seed} />
              </button>
              <div className="lg-main">
                <p className="lg-body">{e.body || "Pinned — press the stamp to come back to it."}</p>
                <div className="lg-who">
                  {e.kind === "seat"
                    ? `${seat?.name || "Right seat"} · asked the module`
                    : e.kind === "ask"
                      ? "You · posted to the module threads"
                      : "You · only you see this"}
                </div>
              </div>
              {e.mine ? (
                <button type="button" className="lg-del" onClick={() => onDelete(e)}
                        aria-label={e.kind === "ask"
                          ? `Remove your question at ${mmss(e.t)}`
                          : `Remove your stamp at ${mmss(e.t)}`}>
                  <Trash2 aria-hidden="true" />
                </button>
              ) : <span />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* §3 — "Export must work: produce a real download." What is written is what
   is on screen: the filter decides the list, and the list decides the file. */
export async function downloadLog(lessonTitle, entries) {
  /* THROUGH THE ONE HELPER. This built its own anchor and revoked the object
     URL on the line after `a.click()` — Safari and iOS frequently cancel the
     download, because the URL is gone before the fetch has begun. The anchor
     was also never appended to the document, which some browsers require.
     `downloadBlob` does both, and on a phone offers the share sheet first,
     which is how a file reaches the Files app on an iPhone. */
  const blob = new Blob([exportText(lessonTitle, entries)], { type: "text/plain" });
  const name = exportName(lessonTitle);
  const said = downloadSaid(await downloadBlob(blob, name), name);
  if (said) toast(said);
}
