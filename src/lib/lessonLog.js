/* ============================================================================
   THE LESSON'S LOGBOOK — what a student put on a lesson, and who put it there.
   ----------------------------------------------------------------------------
   §3 of the launch handoff replaces the notes carousel with a logbook: one
   list, in moment order, with a filter for All / Mine / the person in your
   right seat, a stamp you can press to seek, and an Export that produces a
   real file.

   THREE KINDS, AND THEY ARE THE THREE OBJECTS THE LESSON ALREADY HAS. Nothing
   new is stored to make this list:

     note   your private note. lessonSurface's `note` — {lessonId, t, body},
            read by exactly one person, kept in user_progress.
     ask    a question you asked FROM the player. That is a thread with a
            lessonId and a t — the same public object a comment is — so an Ask
            is a comment you wrote with the video paused, and it appears in the
            module's Ready Room threads because that is where threads live.
     seat   the same public object, written by whoever is in your right seat
            right now.

   WHAT IS DELIBERATELY NOT HERE: the partner's NOTES. The demo shows Sara's
   private notes in your logbook; this app cannot, and should not pretend to.
   Notes are private by promise (CLAUDE.md: "they have exactly one reader"),
   and there is no sharing surface to change that. What the right seat can
   honestly contribute is what they said in public on this lesson, which is
   real, is already on the page, and is theirs. The teal filter therefore only
   exists while somebody is actually in the seat — an empty chip that can never
   fill is a dead control, and this file is where that rule is kept true.

   NOT src/lib/logbook.js, WHICH IS A DIFFERENT THING WITH THE SAME NAME. That
   one is the progress page's analysis — accuracy over time, the weakest
   module, questions missed twice — and §9.5 calls its page the Logbook too.
   Both names come from briefs, both are the word a student would use, and
   both pages are real. They do not collide on screen today only because
   page.logbook and nav.root are off; see docs/launch/BUGS.md.

   ONE DERIVATION, TWO READERS. The list under the video and the marks on the
   progress bar are the same rows: a logbook that disagreed with the bar above
   it would be two answers to one question. This supersedes lessonSurface's
   `lessonMarks`, whose rule — one mark per note, one per thread, never per
   reply — is kept word for word below; it could not say WHOSE, and the bar now
   has to draw three colours.
   ========================================================================= */
import { notesFor, commentsFor, closeBar, postComment } from './lessonSurface.js';

export const LOG_FILTERS = ['all', 'me', 'seat'];

/* One mark per note and one per thread. Never per reply. */
export function logEntries(notes, threads, lessonId, me = 'u_you', seatId = null) {
  const rows = [
    ...notesFor(notes, lessonId, me).map(n => ({
      id: n.id, t: n.t, kind: 'note', mine: true, authorId: n.authorId,
      body: n.body, createdAt: n.createdAt,
    })),
    ...commentsFor(threads, lessonId)
      .filter(c => c.authorId === me || (seatId && c.authorId === seatId))
      .map(c => ({
        id: c.id, t: c.t, kind: c.authorId === me ? 'ask' : 'seat',
        mine: c.authorId === me, authorId: c.authorId,
        body: c.body, createdAt: c.createdAt,
      })),
  ];
  return rows.sort((a, b) => a.t - b.t || String(a.id).localeCompare(String(b.id)));
}

/* `me` is MINE, not "notes". A question you asked is yours as much as a note
   is, and a filter called Mine that hid half of what you wrote would be
   lying about the word. */
export function filterLog(entries, filter) {
  if (filter === 'me') return entries.filter(e => e.mine);
  if (filter === 'seat') return entries.filter(e => e.kind === 'seat');
  return entries;
}

/* The bar reads the same rows. Kind is what decides the shape and the colour:
   a rectangle for a note, a violet diamond for a question, teal for the seat. */
export const logMarks = entries =>
  entries.map(e => ({ t: e.t, kind: e.kind, id: e.id }));

/* ------------------------------------------------------------------ export
   A REAL FILE, which is the whole of §3's requirement — plain text, in the
   order the list is in, so what lands in the file is what was on screen.
   The kind is spelled out rather than drawn, because a text file cannot
   carry a violet diamond and a reader three weeks later still has to be able
   to tell a question from a note. */
const two = n => String(n).padStart(2, '0');
export const clock = s =>
  `${Math.floor(Math.max(0, s) / 60)}:${two(Math.floor(Math.max(0, s) % 60))}`;

const WHO = { note: 'note', ask: 'asked', seat: 'right seat' };

export function exportText(lessonTitle, entries) {
  const lines = entries.map(e =>
    `[${clock(e.t)}] (${WHO[e.kind] || 'note'}) ${e.body || '—'}`);
  return `${lessonTitle}\n\n${lines.join('\n')}\n`;
}

/* A filename a file manager will accept on every platform we ship to, and one
   that still says which lesson it came from. */
export const exportName = lessonTitle =>
  `${String(lessonTitle).replace(/[^\w -]/g, '').trim() || 'Lesson'} — logbook.txt`;

/* --------------------------------------------------------------- saving one
   WHAT THE BAR WRITES, decided in one place. A note closes the way it always
   has (lessonSurface's closeBar, which saves even an empty body — a bare pin
   is a timestamp). An Ask with nothing typed writes NOTHING: a note with no
   words is still a useful mark on the bar, but a question with no words is not
   a question, and posting it would put an empty row in front of the whole
   module. It closes with nothing written, which is what the X does too, so an
   Ask you thought better of costs you nothing either way.

   THAT REFUSAL IS postComment's, AND IT IS NOT REPEATED HERE. An `if (!body)`
   in front of the call reads like care and is a second owner of one rule: it
   passed every test with the line deleted, because postComment already returns
   the session untouched, and a guard that cannot be observed is a guard nobody
   can maintain. Both paths below therefore leave the bar closed and the video
   back where it was. */
export function commitBar(session, { authorId = 'u_you', moduleId } = {}) {
  const b = session.bar;
  if (!b) return session;
  if (b.kind !== 'ask') return closeBar(session, { authorId });
  const posted = postComment(session, {
    moduleId, lessonId: b.lessonId, seconds: b.t, body: b.body, authorId,
  });
  return { ...posted, bar: null,
           player: { ...posted.player, playing: b.resumeOnClose } };
}
