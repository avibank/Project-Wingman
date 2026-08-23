import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchChapterPresence } from "../lib/presence.js";
import { fetchProfiles, fetchBlocks } from "../lib/squadron.js";
import { sendMessage } from "../lib/comms.js";

// §7.6 — the completion screen carries exactly one social prompt, and only
// when at least one visible squadron member is genuinely on this chapter now.
// Otherwise it stays quiet. Never a prompt fired at an empty room.

function CompletionTip({ chapterId, chapterCode, moduleCode }) {
  const { user, isSignedIn } = useUser();
  const [present, setPresent] = useState(0);
  const [tip, setTip] = useState("");
  const [state, setState] = useState("idle");   // idle | writing | sent

  useEffect(() => {
    if (!isSignedIn || !chapterId) return;
    let live = true;
    (async () => {
      const rows = await fetchChapterPresence(chapterId, user?.id);
      if (!live) return;
      const [profs, blocked] = await Promise.all([
        fetchProfiles(rows.map((r) => r.user_id)),
        user?.id ? fetchBlocks(user.id) : Promise.resolve([]),
      ]);
      if (!live) return;
      // §8.3 invisible and §9 blocked users are not "someone in your squadron".
      setPresent(rows.filter((r) => !profs[r.user_id]?.invisible && !blocked.includes(r.user_id)).length);
    })().catch(() => {});
    return () => { live = false; };
  }, [isSignedIn, chapterId, user?.id]);

  if (!present) return null;

  if (state === "sent") {
    return <p className="ct-done">Left on {chapterCode} for whoever's next.</p>;
  }

  return (
    <section className="ct">
      <p className="ct-ask">
        {present === 1
          ? "Someone in your squadron is on this chapter now. Leave them a tip?"
          : `${present} pilots in your squadron are on this chapter now. Leave them a tip?`}
      </p>

      {state === "idle" ? (
        <button className="ct-open" onClick={() => setState("writing")}>Leave a tip</button>
      ) : (
        <>
          <textarea
            className="ct-note" rows={3} value={tip}
            placeholder={`The thing that made ${chapterCode} click for you.`}
            onChange={(e) => setTip(e.target.value)}
          />
          <div className="ct-actions">
            <button
              className="ct-send" disabled={!tip.trim()}
              onClick={async () => {
                await sendMessage({
                  moduleCode, userId: user.id, body: tip.trim(), chapterId,
                });
                setState("sent");
              }}
            >Send it</button>
            <button className="ct-cancel" onClick={() => setState("idle")}>Not now</button>
          </div>
        </>
      )}

      <style>{`
        .ct { margin: 20px 0 0; padding: 14px; border-radius: 14px; background: var(--surface-1);
          box-shadow: inset 3px 0 0 var(--warm); }
        .ct-ask { font-size: 16px; line-height: 1.55; color: var(--text-1); margin: 0 0 12px; max-width: 46ch; }
        .ct-open, .ct-send { min-height: 44px; padding: 0 16px; border: none; border-radius: 12px;
          cursor: pointer; background: var(--warm); color: var(--surface-0);
          font-size: 16px; font-weight: 500; }
        .ct-send:disabled { background: var(--surface-2); color: var(--text-3); cursor: default; }
        .ct-cancel { min-height: 44px; padding: 0 14px; border: none; border-radius: 12px;
          cursor: pointer; background: none; color: var(--text-3); font-size: 16px; }
        .ct-note { width: 100%; resize: vertical; min-height: 72px; padding: 10px 12px;
          border: none; border-radius: 10px; background: var(--surface-2); color: var(--text-1);
          font-family: var(--font-ui); font-size: 16px; line-height: 1.5; }
        .ct-note:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
        .ct-actions { display: flex; gap: 8px; margin-top: 12px; }
        .ct-done { font-size: 14px; color: var(--text-2); margin: 20px 0 0; }
      `}</style>
    </section>
  );
}

export default CompletionTip;
