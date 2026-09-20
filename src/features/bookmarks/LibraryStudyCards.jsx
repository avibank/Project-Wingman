/* =============================================================================
   STUDY CARDS, IN THE LIBRARY — the reference's row, not a doc icon.
   -----------------------------------------------------------------------------
   Bug 12: these rows used the quiz's document glyph, read "8 cards · 1 saved"
   and offered an "Open" button. The reference (renderLibrary in
   docs/launch/code/13-module-tabs-and-library.js) draws something else
   entirely, and every part of it says something the old row did not:

     · the STACKED THUMBNAIL — three cards fanned, the count on the front one —
       in the same 62px slot a lesson's picture and a quiz's answer sheet
       occupy, so the three kinds of row in this Library line up.
     · "Chapter N cards"
     · the status line: "N kept for another look" once anything is kept, and
       "N cards · not started" before that. "Kept" is the word the card itself
       uses when you keep one; "saved" was a third word for the same act.
     · done/total, and "Test yourself" — which is what the set is FOR. "Open"
       describes a door rather than the thing behind it.

   ONE NUMBER IS NOT DRAWN, and it is stated rather than faked: nothing in this
   app counts how many of a set's cards have been flipped, so there is no
   `done` to put in front of the total. The reference shows `done/total` beside
   the button; this shows the total alone until something writes that count.
   See docs/launch/DECISIONS.md.
   ========================================================================= */
import './bookmarks.css';
import './bm-app.css';
import '../../components/module/ref-module.css';
import { BmLink } from './nav';
import { content, routes, plural, useContentVersion } from './content';
import { useSavesState } from './useSaves';
import { isSaved } from './savesStore';

export default function LibraryStudyCards({ moduleId }) {
  useSavesState();
  useContentVersion();
  const chapters = content.quizChapters(moduleId) ?? [];
  const sets = chapters.map((ch) => {
    const qs = content.quizQuestions(moduleId, ch) ?? [];
    return { ch, n: qs.length, kept: qs.filter((q) => isSaved('card', q.id)).length };
  }).filter((s) => s.n > 0);
  // No quizzes yet: the section does not appear, so there is nothing to click into.
  if (!sets.length) return null;
  return (
    <div className="ref-mod libsplit">
      <div className="lsec">
        <div>
          <h2>Study cards</h2>
          <p>Flip a chapter&rsquo;s cards and keep the ones worth another look</p>
        </div>
      </div>
      <div className="papers">
        {sets.map((s) => (
          <BmLink key={s.ch} className="lrow" to={routes.cardSet(moduleId, s.ch)}>
            {/* Three cards and the count on the front one. aria-hidden: the
                number is in the row's own words directly beside it. */}
            <span className="th cards-thumb" aria-hidden="true">
              <i /><i /><i /><b>{s.n}</b>
            </span>
            <span>
              <div className="lt">Chapter {s.ch} cards</div>
              <div className="ls">
                {s.kept ? `${s.kept} kept for another look` : `${plural(s.n, 'card')} · not started`}
              </div>
            </span>
            <span className="rt"><span className="act-o">Test yourself</span></span>
          </BmLink>
        ))}
      </div>
    </div>
  );
}
