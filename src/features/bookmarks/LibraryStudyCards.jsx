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

   `done/total` IS DRAWN NOW, and it took a writer. Nothing in this app counted
   a flipped card, so the row showed the total alone for a day; `cardsSeen.js`
   records a card the moment its answer is turned over and this reads it. The
   number is of the cards in the set, by question id, so a set that gains a
   card does not renumber what has already been done.
   ========================================================================= */
import './bookmarks.css';
import './bm-app.css';
import '../../components/module/ref-module.css';
import { BmLink } from './nav';
import { content, routes, plural, useContentVersion } from './content';
import { useSavesState } from './useSaves';
import { isSaved } from './savesStore';
import { useUserProgress } from '../../lib/userProgress.jsx';
import { seenCount } from './cardsSeen';

export default function LibraryStudyCards({ moduleId }) {
  useSavesState();
  useContentVersion();
  const progress = useUserProgress();
  /* THE CARD SET, NOT THE QUIZ (2026-09-21). A chapter may carry its own
     cards now, and when it does they are the set — Module 13d's first
     chapter has 170 cards beside a 40-question quiz. `cardSet` makes that
     choice, falling back to the quiz questions for a chapter without cards,
     so this row and the page it opens always count the same set. */
  const chapters = content.cardChapters(moduleId) ?? [];
  const sets = chapters.map((ch) => {
    const qs = content.cardSet(moduleId, ch) ?? [];
    return {
      ch, n: qs.length,
      kept: qs.filter((q) => isSaved('card', q.id)).length,
      done: seenCount(progress, qs.map((q) => q.id)),
    };
  }).filter((s) => s.n > 0);
  // Nothing to flip yet: the section does not appear, so there is nothing to click into.
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
              <div className="lt">{content.chapterTitle(moduleId, s.ch)} cards</div>
              <div className="ls">
                {s.kept ? `${s.kept} kept for another look` : `${plural(s.n, 'card')} · not started`}
              </div>
            </span>
            <span className="rt">
              {/* Nothing in front of the total until at least one has been
                  turned over: "0/8" is a zero count, and the line beside it
                  already says the set has not been started. */}
              {s.done > 0 && <span className="sc">{s.done}/{s.n}</span>}
              <span className="act-o">Test yourself</span>
            </span>
          </BmLink>
        ))}
      </div>
    </div>
  );
}
