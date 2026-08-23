import { useState, useRef, useEffect } from "react";
import { ArrowBigUp, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { displayNameFor } from "../lib/social.js";
import { REACTION_KINDS } from "../lib/discussion.js";

export function timeAgo(iso) {
  // A missing or unparseable timestamp used to render "NaNmo ago" to the user.
  // There is nothing honest to say about when something happened if we do not
  // know, so say nothing rather than a number that is not one.
  //
  // The falsy check is not redundant with isFinite: new Date(null) is the epoch,
  // not NaN, so a null timestamp read as "689mo ago" rather than failing loudly.
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  // A clock skewed forward should not read as a negative age either.
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

// Composer that stays out of the way until focused.
export function Composer({ placeholder, onSubmit, autoFocus = false, compact = false, seed = "", seedKey = 0 }) {
  const [open, setOpen] = useState(autoFocus);
  const [text, setText] = useState(seed);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  // A tapped prompt opens the composer already filled in, so the blank page
  // never has to be faced.
  useEffect(() => {
    if (!seedKey) return;
    setText(seed);
    setOpen(true);
  }, [seedKey, seed]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await onSubmit(text.trim());
    setBusy(false);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button className={`composer-collapsed ${compact ? "is-compact" : ""}`} onClick={() => setOpen(true)}>
        {placeholder}
      </button>
    );
  }
  return (
    <div className={`composer ${compact ? "is-compact" : ""}`}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !text.trim() && setOpen(false)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
      />
      <div className="composer-actions">
        <button className="btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(""); setOpen(false); }}>Cancel</button>
        <button className="btn-solid" onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={busy || !text.trim()}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// One comment plus its replies. Nesting is drawn with an indent and a
// connecting rail rather than a nested card.
export function Comment({ node, depth = 0, myVote, onVote, onReply, onDelete, reactions = {}, mine: myChips, onChip }) {
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const mine = node.user_id === user?.id;
  const replies = node.replies || [];

  return (
    <div className={`cmt ${depth ? "is-nested" : ""}`}>
      <div className="cmt-main">
        <span className="cmt-avatar">{initials(displayNameFor(node))}</span>
        <div className="cmt-body">
          <div className="cmt-head">
            <span className="cmt-name">{displayNameFor(node)}</span>
            {node.is_admin && <span className="cmt-badge">instructor</span>}
            <span className="cmt-time">{timeAgo(node.created_at)}</span>
            {replies.length > 0 && (
              <button className="cmt-collapse" onClick={() => setCollapsed((c) => !c)}>
                <ChevronDown size={12} style={{ transform: collapsed ? "rotate(-90deg)" : "none" }} />
                {collapsed ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "Hide"}
              </button>
            )}
          </div>
          <p className="cmt-text">{node.body}</p>
          <div className="cmt-actions">
            <button className={`cmt-vote ${myVote === 1 ? "is-on" : ""}`} onClick={() => onVote(node, myVote === 1 ? 0 : 1)}>
              <ArrowBigUp size={14} />
              <span>{node.score ?? 0}</span>
            </button>
            <button className="cmt-act" onClick={() => setReplying((r) => !r)}>
              <MessageSquare size={12} /> Reply
            </button>
            {mine && (
              <button className="cmt-act cmt-del" onClick={() => onDelete(node)}>
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
          {/* two-second participation: a tap, not a paragraph */}
          <div className="cmt-chips">
            {REACTION_KINDS.map(({ kind, label }) => {
              const on = myChips?.has(kind);
              const count = reactions[kind] || 0;
              return (
                <button key={kind} className={`chip-r ${on ? "is-on" : ""}`} onClick={() => onChip?.(node, kind, on)}>
                  {label}{count > 0 && <span className="chip-n">{count}</span>}
                </button>
              );
            })}
          </div>
          {replying && (
            <Composer
              compact
              autoFocus
              placeholder="Write a reply"
              onSubmit={async (t) => { await onReply(node, t); setReplying(false); }}
            />
          )}
        </div>
      </div>
      {!collapsed && replies.length > 0 && (
        <div className="cmt-children">
          {replies.map((r) => (
            <Comment key={r.id} node={r} depth={depth + 1} myVote={r.myVote} onVote={onVote} onReply={onReply}
              onDelete={onDelete} reactions={r.reactions} mine={r.myChips} onChip={onChip} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ThreadStyles() {
  return (
    <style>{`
      /* composer */
      .composer-collapsed { width: 100%; text-align: left; background: var(--well); border: 1px solid var(--border-soft);
        border-radius: var(--r-md); padding: 12px 14px; color: var(--muted); font-size: 14px; cursor: text; min-height: 44px; }
      .composer-collapsed:hover { border-color: var(--border); }
      .composer-collapsed.is-compact { padding: 9px 12px; font-size: 12px; min-height: 38px; margin-top: 8px; }
      .composer { display: flex; flex-direction: column; gap: 8px; }
      .composer.is-compact { margin-top: 8px; }
      .composer textarea { width: 100%; resize: vertical; background: var(--well); border: 1px solid var(--border);
        border-radius: var(--r-md); color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 11px 13px; }
      .composer textarea:focus { outline: none; border-color: var(--accent-dim); }
      .composer-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .btn-ghost { background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 8px 12px; min-height: 38px; }
      .btn-ghost:hover { color: var(--text); }
      .btn-solid { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm);
        padding: 8px 15px; font-weight: 600; font-size: 12px; cursor: pointer; min-height: 38px; }
      .btn-solid:disabled { opacity: 0.45; cursor: not-allowed; }

      /* comment */
      .cmt { position: relative; }
      .cmt-main { display: flex; gap: 10px; padding: 10px 0; }
      .cmt-avatar { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--elev-2);
        color: var(--accent); display: flex; align-items: center; justify-content: center;
        font-family: var(--font-display); font-weight: 600; font-size: 12px; }
      .cmt-body { flex: 1; min-width: 0; }
      /* one metadata row, not one row per field */
      .cmt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
      .cmt-name { color: var(--text); font-weight: 600; }
      .cmt-badge { font-size: 12px; color: var(--accent); border: 1px solid var(--accent-dim); border-radius: var(--r-pill); padding: 1px 7px; }
      .cmt-time { color: var(--muted2); }
      .cmt-collapse { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; color: var(--muted2);
        font-size: 12px; cursor: pointer; padding: 2px 4px; }
      .cmt-collapse:hover { color: var(--text-soft); }
      .cmt-text { font-size: 14px; line-height: 1.55; color: var(--text-soft); margin: 4px 0 0; white-space: pre-wrap; }
      .cmt-actions { display: flex; align-items: center; gap: 4px; margin-top: 6px; }
      /* vote is one control with its count inline */
      .cmt-vote { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--muted);
        font-size: 12px; cursor: pointer; padding: 5px 8px; border-radius: var(--r-sm); font-variant-numeric: tabular-nums; }
      .cmt-vote:hover { background: var(--elev-2); color: var(--text-soft); }
      .cmt-vote.is-on { color: var(--accent); }
      .cmt-act { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--muted);
        font-size: 12px; cursor: pointer; padding: 5px 8px; border-radius: var(--r-sm); }
      .cmt-act:hover { background: var(--elev-2); color: var(--text-soft); }
      /* destructive affordance stays hidden until the author is on the comment */
      .cmt-del { opacity: 0; transition: opacity 180ms ease; }
      .cmt:hover > .cmt-main .cmt-del,
      .cmt-del:focus-visible { opacity: 1; }
      .cmt-del:hover { color: var(--bad); }
      .cmt-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
      .chip-r { display: inline-flex; align-items: center; gap: 5px; background: none; border: 1px solid var(--border-soft);
        border-radius: var(--r-pill); padding: 4px 11px; color: var(--muted); font-size: 12px; cursor: pointer;
        min-height: 30px; transition: border-color 180ms ease, color 180ms ease, background 180ms ease; }
      .chip-r:hover { border-color: var(--border-hover); color: var(--text-soft); }
      .chip-r.is-on { color: var(--presence); border-color: color-mix(in srgb, var(--presence) 40%, transparent);
        background: var(--presence-soft); }
      .chip-n { font-variant-numeric: tabular-nums; opacity: 0.8; }
      .app.reduce-motion .chip-r { transition: none; }

      /* nesting: indent plus a connecting rail */
      .cmt-children { margin-left: 13px; padding-left: 16px; border-left: 1px solid var(--border-soft); }
      @media (max-width: 560px) { .cmt-children { margin-left: 6px; padding-left: 10px; } }
      .app.reduce-motion .cmt-del { transition: none; }
    `}</style>
  );
}
