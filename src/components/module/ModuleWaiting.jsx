/* =============================================================================
   WAITING ON THE MATERIAL.
   -----------------------------------------------------------------------------
   The beta opens with four named modules and nothing inside them, because the
   owner's own course material goes in from here. That is a real state the app
   has to be good at, not a gap to be papered over: a tester who opens Module 1
   on day one sees this, and what they decide about the product they decide
   here.

   SO IT IS THE SAME COMPONENT AS CREW'S EMPTY STATE, down to the class names
   — `cempty`, `ce-h`, `ce-ghost`, `ce-note` in ref-module.css. Crew's was
   designed and signed off; a second empty-state vocabulary invented for the
   Library would make the two tabs of one screen look like two products.

   THREE RULES IT KEEPS, all of them already the app's:

   · NEVER STATE AN ABSENCE. "No lessons yet" says what is missing and nothing
     else. Every heading here names what lands in the slot instead.
   · NEVER A ZERO COUNT (CLAUDE.md, Voice). "0 quizzes, one per chapter" is
     what the Library said before this file existed.
   · SHOW THE SHAPE IT WILL TAKE. The ghost rows are the rows that will be
     there, drawn faint — the same trick Crew uses, and the reason its empty
     tab reads as a shelf rather than a fault. They are `aria-hidden`, because
     a screen reader announcing three chapters that do not exist is describing
     nothing.

   NO BUTTONS. Adding a chapter is a content change made by the owner, not an
   action a student can take, and a button that opens nothing is the one thing
   the launch rules forbid outright. The Crew empty state has two buttons
   because a student really can go and find a squadron; there is no equivalent
   here, so there is no control.
   ========================================================================= */

/* The faint rows. `ce-blk` is a rectangle where Crew's `ce-face` is a circle —
   a lesson row ends in a thumbnail and a status, not in people. */
function Ghost({ rows }) {
  return (
    <div className="ce-ghost" aria-hidden="true">
      {rows.map(([title, what], i) => (
        <div className="ce-row" key={title}>
          <div><b>{title}</b><span>{what}</span></div>
          <div className="ce-faces">
            <span className="ce-blk" style={{ animationDelay: `${i * 0.12}s` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* THE LESSONS TAB. Reached by opening any module, so it is the first inside
   view of the product a tester gets. */
export function LessonsWaiting({ moduleName = "This module" }) {
  return (
    <div className="cempty">
      <div className="ce-h">
        <h3>{moduleName} starts here</h3>
        <p>
          Chapters land in this list as they go up, each one carrying its lessons
          and its quiz. Open one and it stays open while you work through it.
        </p>
      </div>

      <Ghost rows={[
        ["Chapter 1", "its lessons, then its quiz"],
        ["Chapter 2", "opens when you get there"],
        ["Chapter 3", "and so on, to the end of the module"],
      ]} />

      <p className="ce-note">
        Everything you finish is signed off on the row you finished it on, and the
        Flight Deck picks the module back up where you left it.
      </p>
    </div>
  );
}

/* THE LIBRARY, with no chapters to draw quizzes from. One block for the whole
   tab rather than an empty heading over each section: three headings with
   nothing under them is three times the emptiness, and the Papers slot below
   this says its own piece. */
export function QuizzesWaiting() {
  return (
    <div className="cempty">
      <div className="ce-h">
        <h3>Quizzes land here</h3>
        <p>
          One quiz for every chapter, and the same questions again as a set of
          cards you can flip. Both appear the moment a chapter does.
        </p>
      </div>

      <Ghost rows={[
        ["Chapter 1 quiz", "sit it, then check what you missed"],
        ["Chapter 1 cards", "the same questions, the other way round"],
      ]} />
    </div>
  );
}

/* PAPERS — THE SLOT, WITH THE READER PAUSED.
   ---------------------------------------------------------------------------
   The reader is paused and not one line of it is reachable: no chunk in the
   build, no route, no marks, nothing that opens a file. What the owner asked
   for is that the SLOT survives the pause — somewhere for handouts to land,
   so the Library reads as two shelves with one of them still on its way
   rather than as a Library that is only quizzes.

   So this is the section and nothing behind it. There is no "Add a paper"
   button, because adding one needs the ingest path that is paused with the
   reader, and a button that cannot finish what it starts is worse than no
   button. Turning the papers switch back on (the one variable in
   .env.example, resolved in flags.js) puts the real section, the uploader
   and every existing mark back in its place; LibraryTab decides which of the
   two to draw, so this file never asks. */
export function PapersSlot() {
  return (
    <section className="libsplit" aria-labelledby="lsec-papers">
      <div className="lsec">
        <div>
          <h2 id="lsec-papers">Papers</h2>
          <p>Handouts, notes and past papers for this module</p>
        </div>
      </div>

      <div className="cempty">
        <Ghost rows={[
          ["Module handout", "read it, mark it, keep what matters"],
          ["Chapter 1 notes", "filed under the chapter it belongs to"],
        ]} />
        <p className="ce-note">
          The shelf is here and the papers are on their way. When they land they
          open in Wingman rather than in a download, so what you mark on one stays
          with it.
        </p>
      </div>
    </section>
  );
}
