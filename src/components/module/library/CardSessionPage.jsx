/* =============================================================================
   THE CARDS ROUTE, WHEN THE PORT IS ON — what feeds `CardSession`.
   -----------------------------------------------------------------------------
   `/m/:moduleId/library/cards/:chapter`. §2 of the handoff replaces the old
   cards page ("M13 Batch 6 — Full Set · pages 352–491" + "Test yourself") with
   the demo's session, and this is the join between the two: the chapter's card
   set on one side, the student's own three stores on the other.

   NOTHING NEW IS STORED. §7 asks for write-backs "to the student's account
   (not localStorage)", and all three already exist and already go through
   `merge_progress` and the `saves` table:
     · Got it      → `markGot(id, true)`  — takes it off the missed pile
     · Not yet     → `markGot(id, false)` — puts it back on
     · either      → `markSeen(id)`, which is what `seen` on the Library's
                     Cards thumbnail counts, so the row is right when you
                     come back out
     · the bookmark→ `saves`, kind "card" (migration 0028), which is the same
                     row the Bookmarks screen lists
   So "on close → `seen += got + again`" is satisfied card by card as it
   happens rather than totted up at the door, which also means a session that
   is abandoned half way keeps what it earned.

   THE ANSWER IS THE RIGHT OPTION, AND NOTHING ELSE (§5: "Back face = answer
   only"). The explanation a question carries belongs to the drill, where a
   student has just got it wrong and came for exactly that; a card is a prompt
   and its answer.
   ========================================================================= */
import { useEffect, useMemo } from "react";
import CardSession from "./CardSession.jsx";
import "./port.css";
import { content, routes, useContentVersion } from "../../../features/bookmarks/content.js";
import { useUserProgress } from "../../../lib/userProgress.jsx";
import { seenMap, gotMap, markSeen, markGot } from "../../../features/bookmarks/cardsSeen.js";
import { useSavesState } from "../../../features/bookmarks/useSaves.js";
import { isSaved, findSave, addSave, removeSave } from "../../../features/bookmarks/savesStore.js";
import { BmLink } from "../../../features/bookmarks/nav.jsx";

export default function CardSessionPage({ moduleId, chapter, onClose }) {
  const ch = Number(chapter);
  const progress = useUserProgress();
  useSavesState();
  useContentVersion();

  /* undefined means the content chunk has not landed, which is not the same as
     "this chapter has nothing to flip" — the old page's distinction, kept. */
  const loaded = content.cardSet(moduleId, ch);
  const waiting = loaded === undefined;
  const questions = loaded ?? [];

  const cards = useMemo(() => questions.map((q) => ({
    id: q.id,
    q: q.stem,
    a: (q.options || [])[q.answerIndex] ?? "",
  })), [questions]);

  const seen = seenMap(progress);
  const got = gotMap(progress);
  /* Read once per card set rather than per render: `isSaved` walks the store's
     rows, and `useSavesState` above already re-renders this component whenever
     those rows change, so the set is rebuilt exactly when it can differ. */
  const saved = useMemo(
    () => new Set(cards.filter((c) => isSaved("card", c.id)).map((c) => c.id)),
    [cards],
  );

  useEffect(() => {
    /* The event the old cards page already declared — opening a set is the
       same fact however it is drawn, and `track` refuses a name it does not
       know rather than inventing one. */
    if (cards.length) content.track?.("card_set_opened", { moduleId, chapter: ch });
  }, [moduleId, ch, cards.length]);

  if (waiting) return <div className="bm-empty" aria-busy="true" />;

  /* §10, and `check:doors` enforces it: an empty state names its NEXT ACTION
     inside the sentence, not the absence. "Nothing to flip here yet" failed
     that rule by name on the way in — it says what is missing and leaves the
     student holding it. Both lines carry a verb and a real destination now,
     and the quiz is the honest suggestion: every batch has one. */
  if (!cards.length) {
    return (
      <section className="bm bm-page" style={{ maxWidth: 820 }}>
        <h1 className="bm-h1">Take the quiz while these cards are written</h1>
        <div className="bm-empty">
          Every batch gets a card set and this one is still being made.{" "}
          <BmLink className="bm-link" to={routes.library(moduleId)}>Open the Library</BmLink>
        </div>
      </section>
    );
  }

  const keep = (id) => {
    const row = findSave("card", id);
    if (row) { removeSave(row); return; }
    addSave({ kind: "card", moduleId, refId: id, chapter: ch });
  };

  return (
    <CardSession
      cards={cards}
      name={content.cardSetName(moduleId, ch)}
      seen={seen} got={got} saved={saved}
      onGot={(id) => { markSeen(progress, id); markGot(progress, id, true); }}
      onMissed={(id) => { markSeen(progress, id); markGot(progress, id, false); }}
      onToggleSave={keep}
      onClose={onClose}
    />
  );
}
