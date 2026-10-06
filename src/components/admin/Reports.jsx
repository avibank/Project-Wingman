/* =============================================================================
   REPORTS — what the pill in the corner has been collecting.
   -----------------------------------------------------------------------------
   The owner, 2026-10-06: "I can't see it if someone presses it as an admin."
   Everything the pill sends, plus the lines `recover.js` and `canary.js` write
   from phones nobody here can hold, newest first.

   THE SENTENCE LEADS. A report's value is what the student said; the route,
   the viewport and the user agent are supporting evidence and are set in the
   quiet tier underneath it. A row with no sentence still says where and when,
   because "this page is wrong" with a route attached is the report this
   feature was built for.

   A DEVICE ROW IS MARKED DIFFERENTLY ON PURPOSE. Nobody pressed anything: the
   app noticed its own stylesheet had not arrived and said so. Those are the
   ones worth opening first, and they are the reason this screen exists at all
   — one had been sitting unread since the styling problem was last chased by
   hand.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchReports, setReportStatus, kindOf, detailOf } from "../../lib/reportsStore.js";
import { toast } from "../../features/bookmarks/toastBus.js";
import "./reports.css";

const KIND = {
  device: { word: "Device", line: "The app reported itself — a stylesheet or the layout did not arrive." },
  page: { word: "Page", line: "A student pressed the pill." },
  content: { word: "Content", line: "A report about something somebody posted." },
};

const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString();
};

/* The device out of a user agent, in the words somebody would use for it.
   Not a parser — a label, and it says so when it cannot tell. */
function device(ua) {
  if (!ua) return null;
  const os = /iPhone|iPad|iPod/.test(ua) ? "iPhone or iPad"
    : /Android/.test(ua) ? "Android"
      : /Macintosh/.test(ua) ? "Mac"
        : /Windows/.test(ua) ? "Windows" : null;
  const br = /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox"
      : /Safari\//.test(ua) ? "Safari" : null;
  return [os, br].filter(Boolean).join(" · ") || null;
}

export default function Reports() {
  const [status, setStatus] = useState("open");
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchReports({ status }).then((r) => {
      setState({ loading: false, rows: r.rows, error: r.ok ? null : r.error });
    });
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const move = async (row, to) => {
    const was = state.rows;
    /* The screen changes first and the server follows, the way savesStore does:
       if it refuses, the row comes back and the admin is told. */
    setState((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== row.id) }));
    const r = await setReportStatus(row.id, to);
    if (!r.ok) {
      setState((s) => ({ ...s, rows: was }));
      toast(r.error || "That did not save.");
    }
  };

  const counts = useMemo(() => {
    const out = { device: 0, page: 0, content: 0 };
    for (const r of state.rows) out[kindOf(r)] += 1;
    return out;
  }, [state.rows]);

  return (
    <div className="rep">
      <header className="rep-head">
        <div>
          <h1>Reports</h1>
          <p>
            Everything the &ldquo;Something&rsquo;s wrong here&rdquo; pill has sent, and every
            time the app noticed its own stylesheet had not arrived. Newest first.
          </p>
        </div>
        <div className="rep-filters" role="group" aria-label="Which reports">
          {[["open", "Open"], ["actioned", "Done"], ["dismissed", "Dismissed"], [null, "All"]].map(([id, label]) => (
            <button key={label} type="button" aria-pressed={status === id}
                    onClick={() => { setStatus(id); setOpenId(null); }}>{label}</button>
          ))}
          <button type="button" className="rep-refresh" onClick={load}>Refresh</button>
        </div>
      </header>

      {state.rows.length > 0 && (
        <p className="rep-count">
          {[["device", counts.device], ["page", counts.page], ["content", counts.content]]
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${KIND[k].word.toLowerCase()}${n === 1 ? "" : "s"}`)
            .join(" · ")}
        </p>
      )}

      {state.loading && <p className="rep-empty">Reading the last hundred&hellip;</p>}

      {!state.loading && state.error && (
        <p className="rep-empty">
          The reports did not load. <button type="button" className="linkish" onClick={load}>Try again</button>
          <small>{state.error}</small>
        </p>
      )}

      {/* §10: an empty list names its next action rather than its emptiness. */}
      {!state.loading && !state.error && !state.rows.length && (
        <p className="rep-empty">
          {status === "open"
            ? "Nothing waiting. Anything a student sends from the pill lands here, and so does the app when a stylesheet fails to arrive."
            : "Nothing under this filter — try Open, or All."}
        </p>
      )}

      <ol className="rep-list">
        {state.rows.map((row) => {
          const k = kindOf(row);
          const d = detailOf(row);
          const dev = device(d.rest.ua);
          const shown = openId === row.id;
          return (
            <li key={row.id} className={`rep-row is-${k}`}>
              <div className="rep-top">
                <span className={`rep-kind is-${k}`}>{KIND[k].word}</span>
                <code className="rep-where">{row.target_id || "—"}</code>
                <span className="rep-when">{when(row.created_at)}</span>
              </div>

              {d.said
                ? <p className="rep-said">{d.said}</p>
                : <p className="rep-said rep-quiet">{KIND[k].line}</p>}

              <div className="rep-meta">
                {dev && <span>{dev}</span>}
                {d.rest.viewport && <span>{d.rest.viewport}</span>}
                <span>{row.reporter_id === "anonymous" ? "Not signed in" : row.reporter_id}</span>
                <button type="button" className="rep-more" aria-expanded={shown}
                        onClick={() => setOpenId(shown ? null : row.id)}>
                  {shown ? "Less" : "Everything it sent"}
                </button>
              </div>

              {shown && (
                <pre className="rep-raw">{JSON.stringify({ ...row, reason: d.rest }, null, 2)}</pre>
              )}

              {row.status === "open" && (
                <div className="rep-acts">
                  <button type="button" onClick={() => move(row, "actioned")}>Mark done</button>
                  <button type="button" className="rep-dismiss" onClick={() => move(row, "dismissed")}>Dismiss</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
