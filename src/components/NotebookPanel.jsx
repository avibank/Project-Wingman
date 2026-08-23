import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, Flag, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useIsAdmin } from "../lib/admin.js";
import { displayNameFor, COLLAPSE_SCORE } from "../lib/social.js";
import {
  fetchAnnotations, addAnnotation, updateAnnotation, deleteAnnotation,
  castVote, fetchMyVotes, flagAnnotation, resolveFlag,
  fetchHides, setChapterHidden, dismissAnnotation, fetchDismissals,
} from "../lib/notebook.js";

// Community annotations for one chapter. The official study material is locked
// and lives in data.js — nothing here can edit it.
function NotebookPanel({ chapter, moduleCode, prefs, onCountChange }) {
  const { isSignedIn, user } = useUser();
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState([]);
  const [votes, setVotes] = useState({});
  const [dismissed, setDismissed] = useState(new Set());
  const [hideAll, setHideAll] = useState(false);
  const [scope, setScope] = useState("permanent");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async () => {
    const data = await fetchAnnotations(chapter.id);
    setRows(data);
    onCountChange?.(data.length);
    if (user?.id) {
      setVotes(await fetchMyVotes(user.id, data.map((r) => r.id)));
      setDismissed(new Set((await fetchDismissals(user.id)).map((d) => d.annotation_id)));
      const hides = await fetchHides(user.id);
      setHideAll(hides.some((h) => h.chapter_id === chapter.id || h.chapter_id === null));
    }
  }, [chapter.id, user?.id, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!isSignedIn || !draft.trim()) return;
    setBusy(true);
    const created = await addAnnotation({ chapterId: chapter.id, moduleCode, body: draft, user, prefs });
    setBusy(false);
    if (created) { setDraft(""); load(); }
  };

  const vote = async (row, value) => {
    if (!isSignedIn) return;
    const next = await castVote(row.id, user.id, value);
    setVotes((v) => ({ ...v, [row.id]: next }));
    load();
  };

  const flag = async (row) => {
    if (!isSignedIn) return;
    const reason = window.prompt("What looks wrong? (optional — the author never sees who flagged this)");
    if (reason === null) return;
    await flagAnnotation(row.id, user.id, reason);
    load();
  };

  const toggleHideAll = async () => {
    const next = !hideAll;
    setHideAll(next);
    await setChapterHidden(user?.id, chapter.id, next, scope);
  };

  const dismiss = async (row) => {
    await dismissAnnotation(user?.id, row.id, scope);
    setDismissed((d) => new Set(d).add(row.id));
  };

  const saveEdit = async (row) => {
    const updated = await updateAnnotation(row.id, user.id, editText);
    if (updated) { setEditingId(null); load(); }
  };

  const visible = rows.filter((r) => !dismissed.has(r.id));

  return (
    <div className="nb">
      <div className="nb-controls">
        <button className={`nb-toggle ${hideAll ? "is-on" : ""}`} onClick={toggleHideAll} disabled={!isSignedIn}>
          <EyeOff size={13} /> {hideAll ? "Community notes hidden" : "Hide community notes"}
        </button>
        <label className="nb-scope">
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="How long should hiding last">
            <option value="permanent">Remember</option>
            <option value="session">This session</option>
          </select>
        </label>
      </div>

      {hideAll ? (
        <p className="nb-empty">Official material only. Turn community notes back on above.</p>
      ) : (
        <>
          {visible.length === 0 && <p className="nb-empty">Add the first note — the next pilot through will thank you.</p>}
          {visible.map((row) => {
            const collapsed = row.score <= COLLAPSE_SCORE && !expanded.has(row.id);
            const mine = row.user_id === user?.id;
            return (
              <article key={row.id} className={`nb-item ${collapsed ? "is-collapsed" : ""}`}>
                {collapsed ? (
                  <button className="nb-showanyway" onClick={() => setExpanded((s) => new Set(s).add(row.id))}>
                    Note hidden by community score — show anyway
                  </button>
                ) : (
                  <>
                    <div className="nb-votes">
                      <button className={`nb-vote ${votes[row.id] === 1 ? "is-on" : ""}`} onClick={() => vote(row, 1)} aria-label="Upvote">
                        <ChevronUp size={15} />
                      </button>
                      <span className="nb-score">{row.score}</span>
                      <button className={`nb-vote ${votes[row.id] === -1 ? "is-on" : ""}`} onClick={() => vote(row, -1)} aria-label="Downvote">
                        <ChevronDown size={15} />
                      </button>
                    </div>
                    <div className="nb-body">
                      <div className="nb-meta">
                        <span className="nb-author">{displayNameFor(row)}</span>
                        {row.status === "under_review" && <span className="nb-status is-review"><AlertTriangle size={11} /> Under review</span>}
                        {row.status === "confirmed" && <span className="nb-status is-ok"><ShieldCheck size={11} /> Confirmed</span>}
                        {row.status === "corrected" && <span className="nb-status is-corrected"><ShieldCheck size={11} /> Corrected</span>}
                      </div>
                      {editingId === row.id ? (
                        <>
                          <textarea className="nb-edit" value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                          <div className="nb-actions">
                            <button className="nb-link" onClick={() => saveEdit(row)}>Save</button>
                            <button className="nb-link" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <p className="nb-text">{row.body}</p>
                      )}
                      {row.correction_note && <p className="nb-correction">Instructor note: {row.correction_note}</p>}
                      <div className="nb-actions">
                        {mine && editingId !== row.id && (
                          <>
                            <button className="nb-link" onClick={() => { setEditingId(row.id); setEditText(row.body); }}>Edit</button>
                            <button className="nb-link" onClick={async () => { await deleteAnnotation(row.id, user.id); load(); }}>Delete</button>
                          </>
                        )}
                        {!mine && <button className="nb-link" onClick={() => flag(row)}><Flag size={11} /> Flag as possibly wrong</button>}
                        {!mine && <button className="nb-link" onClick={() => dismiss(row)}>Dismiss</button>}
                        {isAdmin && row.status === "under_review" && (
                          <>
                            <button className="nb-link" onClick={async () => { await resolveFlag(row.id, "confirmed"); load(); }}>Mark confirmed</button>
                            <button
                              className="nb-link"
                              onClick={async () => {
                                const note = window.prompt("Correction note (optional)");
                                await resolveFlag(row.id, "corrected", note);
                                load();
                              }}
                            >
                              Mark corrected
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </>
      )}

      <div className="nb-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isSignedIn ? "Add a note for this chapter…" : "Sign in to add a note"}
          rows={3}
          disabled={!isSignedIn}
        />
        <button className="nb-post" onClick={submit} disabled={!isSignedIn || busy || !draft.trim()}>
          {busy ? "Saving…" : "Add note"}
        </button>
      </div>

      <style>{`
        .nb-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .nb-toggle { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border-soft);
          border-radius: var(--r-sm); padding: 8px 12px; color: var(--muted); font-size: 12px; cursor: pointer; min-height: 38px; }
        .nb-toggle.is-on { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); background: var(--accent-soft); }
        .nb-scope select { background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--text-soft);
          font-size: 12px; padding: 8px 10px; min-height: 38px; }
        .nb-item { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--border-soft); }
        .nb-item.is-collapsed { padding: 8px 0; }
        .nb-showanyway { background: none; border: none; color: var(--muted2); font-size: 12px; cursor: pointer; text-align: left; padding: 4px 0; }
        .nb-showanyway:hover { color: var(--muted); }
        .nb-votes { display: flex; flex-direction: column; align-items: center; gap: 1px; flex-shrink: 0; }
        .nb-vote { background: none; border: none; color: var(--muted2); cursor: pointer; padding: 2px; line-height: 0; border-radius: 4px; }
        .nb-vote:hover { color: var(--text-soft); }
        .nb-vote.is-on { color: var(--accent); }
        .nb-score { font-family: var(--font-mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .nb-body { flex: 1; min-width: 0; }
        .nb-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
        .nb-author { font-size: 12px; color: var(--text); font-weight: 600; }
        .nb-status { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-ui); font-size: 12px; padding: 2px 7px; border-radius: var(--r-pill); }
        .nb-status.is-review { color: #D9A441; background: rgba(217,164,65,0.12); }
        .nb-status.is-ok { color: var(--accent); background: var(--accent-soft); }
        .nb-status.is-corrected { color: var(--accent); background: var(--accent-soft); }
        .nb-text { font-size: 14px; line-height: 1.55; color: var(--text-soft); margin: 0; white-space: pre-wrap; }
        .nb-correction { font-size: 12px; color: var(--accent-muted); margin: 6px 0 0; }
        .nb-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 7px; }
        .nb-link { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--muted2);
          font-size: 12px; cursor: pointer; padding: 4px 0; }
        .nb-link:hover { color: var(--text-soft); }
        .nb-edit, .nb-composer textarea { width: 100%; background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm);
          color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 10px; box-shadow: var(--shadow-inset); resize: vertical; }
        .nb-composer { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
        .nb-post { align-self: flex-end; background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm);
          padding: 10px 16px; font-weight: 600; font-size: 12px; cursor: pointer; min-height: 40px; }
        .nb-post:disabled { opacity: 0.5; cursor: not-allowed; }
        .nb-empty { font-size: 12px; color: var(--muted); padding: 8px 0 4px; margin: 0; }
      `}</style>
    </div>
  );
}

export default NotebookPanel;
