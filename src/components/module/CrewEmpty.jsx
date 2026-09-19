/* =============================================================================
   CREW, WITH NOBODY ELSE ON THE MODULE YET.
   -----------------------------------------------------------------------------
   MARKUP COPIED FROM THE REFERENCE, element for element and class for class —
   `crewEmpty()` in docs/launch/code/14-crew-and-empty-state.js, which is
   itself lifted out of reference/01-module-lesson-crew.html. The stylesheet
   is that build's own, scoped into ref-module.css by npm run ref:css and
   imported by the screen; nothing here sets a layout rule.

   WHY IT IS NOT A SENTENCE. The tab used to draw chapter walls with "No
   stamps yet" in each, which says what is missing three times and what Crew
   is not at all. §2 of the handoff: "An empty Crew tab would be bad; a dead
   one is worse." So it says what Crew is, why it helps, shows the shape it
   will take, and gives two ways to fill it — the ghost rows are the same
   three facts a full wall carries, drawn faint.
   ========================================================================= */

/* The reference's own three rows, in its own words. */
const GHOST = [
  ["Chapter 1", "who has signed it off"],
  ["Chapter 2", "who is on it right now"],
  ["Chapter 3", "who is ahead of you"],
];

export default function CrewEmpty({ moduleName = "this module", onFind, onInvite }) {
  return (
    <div className="cempty">
      <div className="ce-h">
        <h3>Nobody else on {moduleName} yet</h3>
        <p>
          Crew is the class for this module: who&rsquo;s studying it, which chapter
          they&rsquo;re on, and whose stamp is on each chapter. It&rsquo;s how you find
          someone at the same point as you when you&rsquo;re stuck.
        </p>
      </div>

      {/* The shape it will take, drawn faint. aria-hidden because it is a
          picture of a list rather than a list — a screen reader reading three
          chapters with no people in them would be describing nothing. */}
      <div className="ce-ghost" aria-hidden="true">
        {GHOST.map(([chapter, what], i) => (
          <div className="ce-row" key={chapter}>
            <div><b>{chapter}</b><span>{what}</span></div>
            <div className="ce-faces">
              {[0, 1, 2].map((n) => (
                <span className="ce-face" key={n} style={{ animationDelay: `${n * 0.12}s` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ce-do">
        <button type="button" className="pill pri" onClick={onFind}>Find a squadron</button>
        <button type="button" className="pill" onClick={onInvite}>Invite your class</button>
      </div>

      <p className="ce-note">
        The moment somebody else opens {moduleName}, they appear here. Your own stamp
        shows on every chapter you sign off, whether anyone else is here or not.
      </p>
    </div>
  );
}
