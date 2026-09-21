import { useEffect, useState } from 'react';
import './bookmarks.css';
import './bm-app.css';
import { BmLink } from './nav';
import { IconLeft, IconPlay } from './icons';
import { content, routes, plural, useContentVersion } from './content';
import { calmClass } from './motion';
import { useSavesState } from './useSaves';
import { isSaved } from './savesStore';
import StudyPad from './StudyPad';
import TestPile from './TestPile';

/** /m/:moduleId/library/cards/:chapter — one chapter's study cards.
 *  The chapter's own `cards` when it has them, its quiz questions when it does
 *  not (2026-09-21): `content.cardSet` decides, so this page and the Library row
 *  that opens it always agree on the set. */
export default function CardSetPage({ moduleId, chapter }) {
  const ch = Number(chapter);
  useSavesState();
  useContentVersion();                                   // the set arrives with the content chunk
  const [test, setTest] = useState(false);
  /* undefined means "the content chunk has not landed", which is not the same
     as "this chapter has no quiz" — saying the second while the first is true
     shows "Card set not found" for a set that is about to appear. */
  const loaded = content.cardSet(moduleId, ch);
  const questions = loaded ?? [];
  const waiting = loaded === undefined;
  const found = questions.length > 0;
  useEffect(() => { if (found) content.track?.('card_set_opened', { moduleId, chapter: ch }); }, [moduleId, ch, found]);
  const n = questions.filter((q) => isSaved('card', q.id)).length;

  return (
    <section className={`bm bm-page bm-grow${calmClass()}`} style={{ maxWidth: 820 }}>
      <BmLink className="bm-back" to={routes.library(moduleId)}><IconLeft />Library</BmLink>
      {waiting ? (
        <div className="bm-empty" aria-busy="true" />
      ) : !questions.length ? (
        <><h1 className="bm-h1">Card set not found</h1>
          <div className="bm-empty">This chapter has no quiz yet, so there are no cards to flip. <BmLink className="bm-link" to={routes.library(moduleId)}>Back to the Library</BmLink></div></>
      ) : (<>
        <div className="bm-head">
          <div><h1 className="bm-h1">{content.chapterTitle(moduleId, ch)} cards</h1><div className="bm-sub">{plural(questions.length, 'card')} · {n ? `${n} saved` : 'None saved'}</div></div>
          <button type="button" className="bm-btn is-primary" onClick={() => { content.track?.('test_started', { from: 'set' }); setTest(true); }}><IconPlay />Test yourself</button>
        </div>
        <StudyPad questions={questions} moduleId={moduleId} mode="set" />
        {test && <TestPile cards={questions} onClose={() => setTest(false)} />}
      </>)}
    </section>
  );
}
