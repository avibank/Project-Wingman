import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchMessages, sendMessage } from "../lib/comms.js";
import { groupMessages } from "../lib/commsGrouping.js";
import { splitQuestions, answeredStrip, composerPlaceholder, SQUAWK, SQUAWK_LABEL } from "../lib/questions.js";
import { markAnswer, setQuestion, markVerified, canVerify } from "../lib/readyRoom.js";
import { fetchProfiles, assignMarkings } from "../lib/squadron.js";
import Tail, { TailStyles, hueOf } from "./Tail.jsx";

// §9.3.4 — chat-shaped and live, but calmer. Ready Room mechanics, academic
// manners: no haptics, no arrival animation, muted rather than warm. A
// conversation happening in a library.
//
// The novel part is that the atom is a question. Settled knowledge collects at
// the top; chatter flows past below and is allowed to disappear.

const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso) => {
  const d = new Date(iso), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return "Today";
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

function ChapterComments({ chapterId, chapterCode, moduleCode, onSignIn }) {
  const { user, isSignedIn } = useUser();
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [draft, setDraft] = useState("");
  const [asQuestion, setAsQuestion] = useState(false);
  const [squawk, setSquawk] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [openStrip, setOpenStrip] = useState(false);
  const [sending, setSending] = useState(false);
  const myStanding = profiles[user?.id]?.status;
  const endRef = useRef(null);

  const load = useCallback(async () => {
    if (!chapterId) return;
    const rows = await fetchMessages({ moduleCode, chapterId, userId: user?.id, limit: 200 });
    setMessages(rows);
    setProfiles(await fetchProfiles(rows.map((r) => r.user_id)));
  }, [chapterId, moduleCode, user?.id]);

  useEffect(() => { load().catch(console.error); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const marked = Object.fromEntries(
    assignMarkings(
      Object.values(profiles).map((p) => ({ ...p, joined_at: p.created_at || new Date(0).toISOString() })),
      hueOf
    ).map((p) => [p.user_id, p])
  );
  const who = (id) => marked[id] || { user_id: id, callsign: "Pilot", livery: "dawn-patrol", marking: "solid" };

  const { open } = splitQuestions(messages);
  const strip = answeredStrip(messages);
  const groups = groupMessages(messages.filter((m) => !m.is_system));

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    const saved = await sendMessage({ moduleCode, userId: user.id, body, chapterId });
    if (saved) {
      if (asQuestion) await setQuestion(saved.id, true, squawk);
      if (replyTo) await markAnswer(saved.id, replyTo.id, replyTo.user_id === user.id ? user.id : replyTo.user_id);
      setAsQuestion(false);
      setSquawk(null);
      setReplyTo(null);
      await load();
    } else {
      setDraft(body);   // put it back rather than losing what they typed
    }
    setSending(false);
  };

  return (
    <section className="cc">
      {/* §9.3.4 — settled knowledge at the top. Answered questions collapse to
          a strip so a week-old answer is still findable. */}
      {strip.length > 0 && (
        <details className="cc-strip" open={openStrip} onToggle={(e) => setOpenStrip(e.target.open)}>
          <summary>Answered here: {strip.map((q) => q.body.slice(0, 34)).join(" · ")}</summary>
          <ul>
            {strip.map((q) => (
              <li key={q.id}>
                <p className="cc-strip-q">{q.body}</p>
                {q.answers.map((a) => (
                  <p key={a.id} className={`cc-strip-a ${a.is_verified ? "is-verified" : ""}`}>
                    {a.is_verified && <span className="cc-verified">Verified</span>}
                    {a.body}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}

      {open.length > 0 && (
        <p className="cc-open">
          {open.length} {open.length === 1 ? "question" : "questions"} here still waiting on an answer.
        </p>
      )}

      <div className="cc-log">
        {groups.length === 0 && (
          // §8.4 — an invitation, and §9.4.4's norm-setting line.
          <p className="cc-quiet">
            Nobody here has it figured out yet. Ask the dumb question about {chapterCode}.
          </p>
        )}
        {groups.map((g) =>
          g.type === "day" ? (
            <div key={g.id} className="cc-day"><span>{dayLabel(g.at)}</span></div>
          ) : (
            <article key={g.id} className={`cc-group ${g.user_id === user?.id ? "is-own" : ""}`}>
              <Tail name={who(g.user_id).callsign} livery={who(g.user_id).livery}
                marking={who(g.user_id).marking} size={32} staff={who(g.user_id).is_staff} />
              <div className="cc-stack">
                <p className="cc-meta">
                  <span className="cc-sender">{who(g.user_id).callsign}</span>
                  <span className="cc-time">{clock(g.at)}</span>
                </p>
                {g.messages.map((m) => (
                  <div key={m.id} className={`cc-msg ${m.is_question ? "is-question" : ""}`}>
                    {m.is_question && <span className="cc-tag">Question</span>}
                    {m.is_verified && <span className="cc-verified">Verified</span>}
                    <span className="cc-body">{m.body}</span>
                    {isSignedIn && m.is_question && !m.resolved_at && m.user_id !== user?.id && (
                      <button className="cc-answer" onClick={() => setReplyTo(m)}>Answer this</button>
                    )}
                    {/* §11 — a confident, upvoted, incorrect explanation of
                        compressor stall recovery is worse than no explanation.
                        Only CFI standing can mark one verified. */}
                    {canVerify(myStanding) && !m.is_question && !m.is_verified && (
                      <button className="cc-answer" onClick={async () => { await markVerified(m.id, user.id); load(); }}>
                        Mark verified
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </article>
          )
        )}
        <div ref={endRef} />
      </div>

      {isSignedIn ? (
        <div className="cc-composer">
          {replyTo && (
            <button className="cc-replying" onClick={() => setReplyTo(null)}>
              Answering “{replyTo.body.slice(0, 40)}” ×
            </button>
          )}
          <textarea
            className="cc-input" rows={1} value={draft}
            placeholder={composerPlaceholder("chapter")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <div className="cc-actions">
            {/* §9.3.4 — any message can be marked a question. */}
            <button
              className={`cc-mark ${asQuestion ? "is-on" : ""}`}
              aria-pressed={asQuestion}
              onClick={() => setAsQuestion((v) => !v)}
            >{asQuestion ? "Asking a question" : "Mark as a question"}</button>
            {/* §9.4.2 — a code is optional, and only means anything on a
                question. Plain language beside it, because 7600 is jargon
                until someone has used it once. */}
            {asQuestion && (
              <span className="cc-squawks">
                {[SQUAWK.RADIO_FAILURE, SQUAWK.EMERGENCY].map((code) => (
                  <button
                    key={code}
                    className={`cc-squawk ${squawk === code ? "is-on" : ""}`}
                    aria-pressed={squawk === code}
                    title={SQUAWK_LABEL[code]}
                    onClick={() => setSquawk((v) => (v === code ? null : code))}
                  >{code}</button>
                ))}
              </span>
            )}
            <button className="cc-send" onClick={send} disabled={!draft.trim() || sending}>Send</button>
          </div>
        </div>
      ) : (
        <button className="cc-signin" onClick={onSignIn}>Sign in to join the conversation</button>
      )}

      <TailStyles />
      <style>{`
        .cc { display: flex; flex-direction: column; gap: 12px; max-width: 66ch; margin: 0 auto; }

        .cc-strip { background: var(--bg-panel); border-radius: var(--r-panel); padding: 4px 14px; }
        .cc-strip summary { cursor: pointer; min-height: 44px; display: flex; align-items: center;
          font-size: 14px; color: var(--text-secondary); }
        .cc-strip ul { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 12px; }
        .cc-strip-q { font-size: 14px; color: var(--text-primary); margin: 0; }
        .cc-strip-a { font-size: 14px; line-height: 1.55; color: var(--text-secondary); margin: 4px 0 0; }
        .cc-open { font-size: 14px; color: var(--text-secondary); margin: 0; }

        .cc-log { display: flex; flex-direction: column; gap: 14px; }
        .cc-quiet { font-size: 16px; line-height: 1.55; color: var(--text-secondary); margin: 0; }
        .cc-day { display: flex; align-items: center; gap: 12px; color: var(--text-tertiary); font-size: 12px; }
        .cc-day::before, .cc-day::after { content: ""; flex: 1; height: 1px; background: var(--hairline); }

        .cc-group { display: flex; gap: 10px; align-items: flex-start; }
        .cc-stack { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .cc-meta { display: flex; align-items: baseline; gap: 8px; margin: 0 0 2px; }
        .cc-sender { font-size: 14px; color: var(--text-primary); }
        .cc-time { font-size: 12px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
        /* §9.3.4 — own messages tinted, the convention people already have. */
        .cc-group.is-own .cc-stack { background: var(--bg-panel); border-radius: var(--r-control); padding: 8px 12px; }

        .cc-msg { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
          font-size: 16px; line-height: 1.55; color: var(--text-primary); overflow-wrap: anywhere; }
        .cc-msg.is-question { box-shadow: inset 3px 0 0 var(--accent-interactive);
          padding-left: 10px; border-radius: 2px; }
        .cc-tag, .cc-verified { font-family: var(--font-mono); font-size: 12px;
          padding: 1px 6px; border-radius: var(--r-chip); background: var(--bg-raised);
          color: var(--text-secondary); }
        /* §11 — verified reads as different in kind, not just louder. */
        .cc-verified { color: var(--bg-ground); background: var(--accent-interactive); }
        .cc-answer { min-height: 44px; padding: 0 10px; border: none; border-radius: var(--r-control);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; }
        .cc-answer:hover { color: var(--text-primary); background: var(--bg-raised); }

        .cc-composer { display: flex; flex-direction: column; gap: 8px; }
        .cc-replying { align-self: flex-start; min-height: 44px; padding: 0 10px; border: none;
          border-radius: var(--r-chip); background: var(--bg-raised); color: var(--text-secondary);
          font-size: 14px; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .cc-input { width: 100%; resize: none; min-height: 44px; max-height: 140px; padding: 12px;
          border: none; border-radius: var(--r-control); background: var(--bg-raised);
          color: var(--text-primary); font-size: 16px; line-height: 1.4; }
        .cc-input:focus { outline: 2px solid var(--accent-interactive); outline-offset: -1px; }
        .cc-actions { display: flex; gap: 8px; justify-content: space-between; }
        .cc-mark { min-height: 44px; padding: 0 12px; border: none; border-radius: var(--r-control);
          background: var(--bg-raised); color: var(--text-secondary); font-size: 14px; cursor: pointer; }
        .cc-squawks { display: inline-flex; gap: 4px; }
        .cc-squawk { min-height: 44px; padding: 0 10px; border: none; border-radius: var(--r-control);
          background: var(--bg-raised); color: var(--text-secondary);
          font-family: var(--font-mono); font-size: 14px; cursor: pointer; }
        .cc-squawk.is-on { background: var(--accent-interactive); color: var(--bg-ground); }
        .cc-mark.is-on { background: var(--accent-interactive); color: var(--bg-ground); }
        .cc-send { min-height: 44px; padding: 0 16px; border: none; border-radius: var(--r-control);
          background: var(--accent-interactive); color: var(--bg-ground); font-size: 16px;
          font-weight: 500; cursor: pointer; }
        .cc-send:disabled { background: var(--bg-raised); color: var(--text-tertiary); cursor: default; }
        .cc-signin { min-height: 44px; padding: 0 14px; border: none; border-radius: var(--r-control);
          background: var(--bg-raised); color: var(--text-primary); font-size: 16px; cursor: pointer; }
      `}</style>
    </section>
  );
}

export default ChapterComments;
