import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { chaptersForModule } from "../data.js";
import {
  fetchMessages, sendMessage, fetchPinned, pinToChapter, unpin,
  fetchReactions, fetchMyReactions, toggleReaction, groupMessages,
  maybePostOpener, takeRateSlot,
} from "../lib/comms.js";
import { WINGMAN_ID, WINGMAN_NAME } from "../data/openers.js";
import { fetchProfiles, fetchSquadron, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";
import PilotSheet from "./PilotSheet.jsx";

// §7.8 — a channel, not a forum. No threads, no upvotes, no accepted answers,
// no karma, no reputation. Three aviation-native additions and nothing else:
// a chapter chip, pinning to a chapter, and filtering to the chapter you're on.

const EMOJI = ["👍", "🙏", "🔥", "😂", "🤔"];

const dayLabel = (iso) => {
  const d = new Date(iso), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return "Today";
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};
const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Comms({ moduleCode, currentChapterId = null }) {
  const { user, isSignedIn } = useUser();
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [reactions, setReactions] = useState({});
  const [mine, setMine] = useState({});
  const [pinned, setPinned] = useState([]);
  const [squadron, setSquadron] = useState(null);
  const [filterToChapter, setFilterToChapter] = useState(false);
  const [chipChapter, setChipChapter] = useState(null);
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState(null);
  const [sending, setSending] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const endRef = useRef(null);

  const chapters = chaptersForModule(moduleCode);
  const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c]));

  const load = useCallback(async () => {
    const rows = await fetchMessages({
      moduleCode,
      chapterId: filterToChapter ? currentChapterId : null,
      userId: user?.id,
    });
    setMessages(rows);
    const ids = rows.map((r) => r.id);
    const [profs, react, my, pins, sq] = await Promise.all([
      fetchProfiles(rows.map((r) => r.user_id)),
      fetchReactions(ids),
      fetchMyReactions(user?.id, ids),
      fetchPinned(moduleCode, currentChapterId),
      user?.id ? fetchSquadron(user.id, moduleCode) : Promise.resolve(null),
    ]);
    setProfiles(profs); setReactions(react); setMine(my); setPinned(pins); setSquadron(sq);
  }, [moduleCode, currentChapterId, filterToChapter, user?.id]);

  useEffect(() => { load().catch(console.error); }, [load]);

  // §8.1 — offered once per mount. The RPC decides whether the channel is
  // actually quiet; this only asks.
  useEffect(() => {
    if (!isSignedIn || !currentChapterId) return;
    let live = true;
    maybePostOpener(moduleCode, currentChapterId)
      .then((id) => { if (live && id) load(); })
      .catch(() => {});
    return () => { live = false; };
  }, [isSignedIn, moduleCode, currentChapterId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const marked = Object.fromEntries(
    assignMarkings(
      Object.values(profiles).map((p) => ({ ...p, joined_at: p.created_at || new Date(0).toISOString() })),
      hueOf
    ).map((p) => [p.user_id, p])
  );
  const who = (id) => marked[id] || { user_id: id, callsign: "Pilot", livery: "dawn-patrol", marking: "solid" };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const allowed = await takeRateSlot(user.id, "message", 30);
    if (!allowed) {
      setSending(false);
      setRateLimited(true);
      return;
    }
    setDraft("");
    const saved = await sendMessage({
      moduleCode, squadronId: squadron?.id, userId: user.id, body, chapterId: chipChapter,
    });
    setSending(false);
    if (saved) { setMessages((m) => [...m, saved]); setChipChapter(null); }
    else setDraft(body);   // put it back rather than losing what they typed
  };

  const react = async (id, emoji) => {
    const on = mine[id]?.has(emoji);
    setMine((m) => {
      const next = new Set(m[id] || []);
      on ? next.delete(emoji) : next.add(emoji);
      return { ...m, [id]: next };
    });
    setReactions((r) => ({
      ...r, [id]: { ...(r[id] || {}), [emoji]: Math.max(0, ((r[id]?.[emoji]) || 0) + (on ? -1 : 1)) },
    }));
    await toggleReaction(id, user.id, emoji, on);
  };

  const groups = groupMessages(messages);
  const currentChapter = chapterById[currentChapterId];

  return (
    <div
      className="cm"
      // §2.12 — the squadron's livery paints this surface for the duration.
      // Scoped to the container, so the rest of the cockpit stays yours (§2.8).
      data-livery={squadron?.livery || undefined}
      data-variant={squadron?.livery ? (document.documentElement.getAttribute("data-variant") || "night") : undefined}
    >
      <header className="cm-head">
        <h2 className="cm-title">Comms</h2>
        {currentChapter && (
          <button
            className={`cm-filter ${filterToChapter ? "is-on" : ""}`}
            aria-pressed={filterToChapter}
            onClick={() => setFilterToChapter((v) => !v)}
          >
            {filterToChapter ? `Showing ${currentChapter.code}` : `Filter to ${currentChapter.code}`}
          </button>
        )}
      </header>

      {pinned.length > 0 && (
        <section className="cm-pins">
          <p className="cm-pins-head">Pinned to {currentChapter?.code}</p>
          {pinned.map((p) => (
            <div key={p.id} className="cm-pin">
              <span className="cm-pin-edge" style={{ "--edge": `var(--tail-${who(p.user_id).livery})` }} aria-hidden="true" />
              <span className="cm-pin-body">{p.body}</span>
              <button className="cm-pin-undo" onClick={() => unpin(p.id).then(load)}>Unpin</button>
            </div>
          ))}
        </section>
      )}

      <div className="cm-log">
        {groups.length === 0 && (
          // §10 — names the action, and never reports an absence.
          <p className="cm-quiet">
            {currentChapter
              ? `Say what you're stuck on in ${currentChapter.code} — this channel is your module's.`
              : "Open a chapter and ask about it here — this channel is your module's."}
          </p>
        )}

        {groups.map((g) =>
          g.type === "day" ? (
            <div key={g.id} className="cm-day"><span>{dayLabel(g.at)}</span></div>
          ) : (
            <article key={g.id} className={`cm-group ${g.user_id === WINGMAN_ID ? "is-system" : ""}`}>
              {g.user_id === WINGMAN_ID ? (
                <span className="cm-wingman-mark" aria-hidden="true" />
              ) : (
                <button className="cm-avatar" onClick={() => setSheet(who(g.user_id))}>
                  <Tail name={who(g.user_id).callsign} livery={who(g.user_id).livery}
                    marking={who(g.user_id).marking} size={36} staff={who(g.user_id).is_staff} />
                </button>
              )}
              <div className="cm-stack">
                <p className="cm-meta">
                  <span className="cm-sender">
                    {g.user_id === WINGMAN_ID ? WINGMAN_NAME : who(g.user_id).callsign}
                  </span>
                  {g.user_id === WINGMAN_ID && <span className="cm-badge">app</span>}
                  <span className="cm-time">{clock(g.at)}</span>
                </p>
                {g.messages.map((m) => {
                  const ch = chapterById[m.chapter_id];
                  const rx = reactions[m.id] || {};
                  return (
                    <div key={m.id} className="cm-msg">
                      {/* §2.8 — a 2px leading edge in the sender's warm channel.
                          The only place another livery touches a message. */}
                      <span className="cm-edge"
                        style={{ "--edge": m.user_id === WINGMAN_ID ? "var(--cold)" : `var(--tail-${who(m.user_id).livery})` }}
                        aria-hidden="true" />
                      <div className="cm-bubble">
                        {ch && <span className="cm-chip">{ch.code}</span>}
                        <span className="cm-body">{m.body}</span>
                      </div>
                      <div className="cm-tools">
                        {EMOJI.map((e) => {
                          const n = rx[e] || 0;
                          const on = mine[m.id]?.has(e);
                          if (!n && !on) return null;
                          return (
                            <button key={e} className={`cm-react ${on ? "is-mine" : ""}`} onClick={() => react(m.id, e)}>
                              {e} <span className="cm-react-n">{n}</span>
                            </button>
                          );
                        })}
                        <details className="cm-more">
                          <summary aria-label="React or pin">+</summary>
                          <div className="cm-more-panel">
                            {EMOJI.map((e) => (
                              <button key={e} className="cm-react" onClick={() => react(m.id, e)}>{e}</button>
                            ))}
                            {currentChapterId && m.pinned_to !== currentChapterId && (
                              <button className="cm-pinbtn" onClick={() => pinToChapter(m.id, currentChapterId).then(load)}>
                                Pin to {currentChapter?.code}
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )
        )}
        <div ref={endRef} />
      </div>

      {isSignedIn && (
        <div className="cm-composer">
          {chipChapter && (
            <button className="cm-chip cm-chip--draft" onClick={() => setChipChapter(null)}>
              {chapterById[chipChapter]?.code} ×
            </button>
          )}
          <textarea
            className="cm-input"
            value={draft}
            rows={1}
            placeholder="Message your module"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {currentChapterId && !chipChapter && (
            <button className="cm-attach" onClick={() => setChipChapter(currentChapterId)}>
              {currentChapter?.code}
            </button>
          )}
          <button className="cm-send" onClick={send} disabled={!draft.trim() || sending}>Send</button>
        </div>
      )}

      {rateLimited && (
        <p className="cm-rate">You've sent a lot in the last hour. Give it a few minutes.</p>
      )}

      {sheet && <PilotSheet pilot={sheet} channelId={moduleCode} onClose={() => setSheet(null)} onChanged={load} />}

      <TailStyles />
      <style>{`

        /* §8.1 — Wingman is the app speaking, so it gets a cold mark and a
           badge, never a tail. A tail would make it look like a person. */
        .cm-wingman-mark { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: color-mix(in oklab, var(--cold) 18%, var(--surface-2));
          border: 1px solid color-mix(in oklab, var(--cold) 34%, transparent); }
        .cm-badge { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em;
          text-transform: uppercase; padding: 1px 5px; border-radius: 4px;
          background: var(--surface-2); color: var(--cold); }
        .cm-rate { font-size: 13px; color: var(--text-2); margin: 0; padding: 8px 14px; }
        .cm { display: flex; flex-direction: column; min-height: 0; }
        .cm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 12px 16px; border-radius: 16px 16px 0 0;
          background: color-mix(in oklab, var(--warm) 14%, var(--surface-2)); }
        .cm-title { font-family: var(--font-ui); font-size: 16px; font-weight: 500; color: var(--text-1); margin: 0; }
        .cm-filter { min-height: 36px; padding: 0 12px; border-radius: 999px; border: none; cursor: pointer;
          font-family: var(--font-mono); font-size: 12px; background: var(--surface-2); color: var(--text-2); }
        .cm-filter.is-on { background: var(--warm); color: var(--surface-0); }

        .cm-pins { padding: 10px 16px; background: var(--surface-1); border-bottom: 1px solid var(--hairline); }
        .cm-pins-head { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.05em;
          text-transform: uppercase; color: var(--text-3); margin: 0 0 8px; }
        .cm-pin { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
        .cm-pin-edge { width: 2px; align-self: stretch; background: var(--edge); border-radius: 2px; flex-shrink: 0; }
        .cm-pin-body { flex: 1; font-size: 14px; color: var(--text-2); min-width: 0; }
        .cm-pin-undo { min-height: 36px; padding: 0 10px; border: none; background: none;
          color: var(--text-3); font-size: 13px; cursor: pointer; }

        .cm-log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;
          background: var(--surface-1); }
        .cm-quiet { font-size: 14px; line-height: 1.55; color: var(--text-2); margin: 0; max-width: 46ch; }
        .cm-day { display: flex; align-items: center; gap: 12px; color: var(--text-3);
          font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; }
        .cm-day::before, .cm-day::after { content: ""; flex: 1; height: 1px; background: var(--hairline); }

        .cm-group { display: flex; gap: 10px; align-items: flex-start; }
        .cm-avatar { background: none; border: none; padding: 2px 0 0; cursor: pointer; flex-shrink: 0;
          min-width: 36px; min-height: 36px; }
        .cm-stack { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .cm-meta { display: flex; align-items: baseline; gap: 8px; margin: 0 0 2px; }
        .cm-sender { font-size: 14px; color: var(--text-1); }
        .cm-time { font-family: var(--font-mono); font-size: 11px; color: var(--text-3);
          font-variant-numeric: tabular-nums; }

        .cm-msg { display: flex; align-items: flex-start; gap: 8px; }
        .cm-edge { width: 2px; align-self: stretch; background: var(--edge); border-radius: 2px; flex-shrink: 0; }
        .cm-bubble { flex: 1; min-width: 0; font-size: 15px; line-height: 1.5; color: var(--text-1);
          overflow-wrap: anywhere; }
        .cm-chip { display: inline-block; font-family: var(--font-mono); font-size: 11px;
          padding: 1px 6px; margin-right: 6px; border-radius: 5px;
          background: var(--surface-2); color: var(--cold); vertical-align: 1px; }
        .cm-chip--draft { align-self: center; border: none; cursor: pointer; min-height: 32px; }

        .cm-tools { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .cm-react { min-height: 32px; padding: 0 7px; border-radius: 999px; border: none; cursor: pointer;
          background: var(--surface-2); color: var(--text-2); font-size: 13px; }
        .cm-react.is-mine { background: color-mix(in srgb, var(--warm) 22%, var(--surface-2)); color: var(--text-1); }
        .cm-react-n { font-family: var(--font-mono); font-size: 11px; font-variant-numeric: tabular-nums; }
        .cm-more { position: relative; }
        .cm-more summary { list-style: none; cursor: pointer; width: 32px; height: 32px;
          display: grid; place-items: center; border-radius: 999px; color: var(--text-3); }
        .cm-more summary::-webkit-details-marker { display: none; }
        .cm-more-panel { position: absolute; right: 0; top: 34px; z-index: 5; display: flex; gap: 4px;
          padding: 6px; border-radius: 12px; background: var(--surface-2); box-shadow: var(--shadow-2); }
        .cm-pinbtn { min-height: 32px; padding: 0 10px; border: none; border-radius: 8px; cursor: pointer;
          background: var(--surface-1); color: var(--text-2); font-size: 13px; white-space: nowrap; }

        .cm-composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px;
          background: var(--surface-1); border-top: 1px solid var(--hairline); border-radius: 0 0 16px 16px; }
        .cm-input { flex: 1; resize: none; min-height: 44px; max-height: 140px; padding: 12px;
          border-radius: 12px; border: none; background: var(--surface-2); color: var(--text-1);
          font-family: var(--font-ui); font-size: 15px; line-height: 1.4; }
        .cm-input:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .cm-attach { min-height: 44px; padding: 0 10px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--surface-2); color: var(--cold); font-family: var(--font-mono); font-size: 12px; }
        .cm-send { min-height: 44px; padding: 0 16px; border: none; border-radius: 12px; cursor: pointer;
          background: var(--warm); color: var(--surface-0); font-size: 15px; font-weight: 500; }
        .cm-send:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }
      `}</style>
    </div>
  );
}

export default Comms;
