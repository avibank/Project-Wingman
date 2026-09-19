import './bookmarks.css';
import './bm-app.css';
import { BmLink } from './nav';
import { content, routes, plural, useContentVersion } from './content';
import { useSavesState } from './useSaves';
import { isSaved } from './savesStore';

/**
 * The new "Study cards" section of a module's Library tab. Mount it between Quizzes and Papers,
 * inside the same Library card, matching the other sections' spacing (the live Library already draws the card).
 */
export default function LibraryStudyCards({ moduleId }) {
  useSavesState();
  useContentVersion();
  const chapters = content.quizChapters(moduleId) ?? [];
  const sets = chapters.map((ch) => { const qs = content.quizQuestions(moduleId, ch) ?? []; return { ch, n: qs.length, saved: qs.filter((q) => isSaved('card', q.id)).length }; }).filter((s) => s.n > 0);
  if (!sets.length) return null; // no quizzes yet: the section doesn't appear, so there's nothing to click into
  return (
    <div className="bm bm-lib-section">
      <div className="bm-lh"><h2>Study cards</h2><div className="bm-sub">One set per quiz</div></div>
      {sets.map((s) => (
        <BmLink key={s.ch} className="bm-lrow" to={routes.cardSet(moduleId, s.ch)}>
          <span className="bm-minipad" aria-hidden="true"><i /><i /><i /></span>
          <span className="bm-lbody"><b>Chapter {s.ch} cards</b><span>{plural(s.n, 'card')}{s.saved ? ` · ${s.saved} saved` : ''}</span></span>
          <span className="bm-pill">Open</span>
        </BmLink>
      ))}
    </div>
  );
}
