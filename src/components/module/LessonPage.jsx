import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { nextAfterLesson, nextLabel, nextWhere } from "./nextUp.js";
import { mmss } from "./lessonState.js";
import { useSession } from "../../lib/session.jsx";
import {
  initials, hueFor, ago, replyCountLabel, toggleReplies,
} from "../../lib/familiar.js";
import {
  observeSlot, commentsFor, repliesFor,
  deleteNote, removeThread, postReply, newId,
} from "../../lib/lessonSurface.js";
import { logEntries, filterLog } from "../../lib/lessonLog.js";
import "./module.css";
import "./lesson.css";
import "./ref-lesson.css";
import "./familiar.css";
import { useUserProgress } from "../../lib/userProgress.jsx";
import { FLY_SOLO_KEY } from "../../lib/flySolo.js";
import LogTab, { downloadLog } from "./LogTab.jsx";
import SaveButton from "../../features/bookmarks/SaveButton.jsx";
import { useTabPill, useSwitchIn } from "../../lib/tabMotion.js";
import SignOff from "./SignOff.jsx";
import Avatar from "../Avatar.jsx";
import "./deck.css";

// A time inside a comment is pressable — [2:17] or a bare 2:17. YouTube taught
// everyone that, and the seek already exists, so looking like the known thing
// costs one regex. The text is SPLIT rather than replaced, so nothing is ever
// rendered as raw HTML.
const T_RE = /\[?(\d{1,2}):([0-5]\d)\]?/g;
function seekable(text, onSeek) {
  const out = [];
  let last = 0, m;
  T_RE.lastIndex = 0;
  while ((m = T_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const secs = Number(m[1]) * 60 + Number(m[2]);
    out.push(
      <button key={`${m.index}-${secs}`} type="button" className="tseek"
              onClick={() => onSeek(secs)}>{`${m[1]}:${m[2]}`}</button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// The lesson page. Four things, in this order, at every width:
//
//     lesson name  ->  player  ->  what comes next  ->  Notes | Comments
//
// A first year opens this and sees a video and a next button. Everything else
// lives inside the player or under one tab strip of two plain words. There is
// no sidebar, no margin column, no edge rail and no transcript — those were
// cancelled after a legibility review, because five novel surfaces before
// thirty seconds of video is the thing that intimidates, not any one of them.
//
// The player is NOT rendered here. This page renders an empty sized slot and
// the one player, which lives above the router, positions itself over it.
const LESSON_TABS = ["notes", "comments"];   // "notes" is the Logbook tab's id

export default function LessonPage({
  module: mod, chapters, chapter, lesson, state, people = [], chapterNo = null,
  stamp = null, tilt = 0, seat = null, myFace = null,
  onBack, onOpenLesson, onOpenQuiz, onSeekSaved, onComplete, onMarkDone, done,
}) {
  const { session, mutate, dispatchPlayer, setStage, requestSeek, setTab,
          clearWatch, pending, postOptimistic, me } = useSession();
  const slotRef = useRef(null);
  const watch = session.watchAt?.lessonId === lesson.id ? session.watchAt : null;

  // The slot is what is watched, not the player — the player leaves it.
  useEffect(() => {
    if (!slotRef.current) return undefined;
    return observeSlot(slotRef.current, dispatchPlayer, slotRef.current.closest(".deck"));
  }, [dispatchPlayer]);

  // Hand the player this lesson, the slot to sit over, and where to report.
  useEffect(() => {
    setStage({
      lesson,
      slotEl: slotRef.current,
      // The mini player needs these to route back to this lesson from any page.
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterNo,
      moduleCode: mod.code || mod.id,
      // Whoever is in the right seat right now. The player draws their marks
      // teal and cannot know this on its own — the seat belongs to the
      // account, not to the video.
      seatId: seat?.partnerId || null,
      // One step ahead: the player prefetches this at halfway.
      next: nextAfterLesson(chapters, chapter.id, lesson.id, state)?.lesson || null,
      // Arriving from "Watch at 2:17" opens at that second instead of where
      // you left off — it is the only bridge from People back to the moment,
      // so it has to win over the saved position.
      resume: watch && lesson.duration
        ? watch.seconds / lesson.duration
        : state?.pos?.[lesson.id]?.pct || 0,
      onProgress: (p) => onSeekSaved?.(lesson.id, p),
      onSeek: (p) => onSeekSaved?.(lesson.id, p),
      onComplete: () => onComplete?.(lesson.id),
    });
    dispatchPlayer({ type: "load", lessonId: lesson.id, moduleId: mod.code || mod.id, seconds: 0 });
    if (watch) clearWatch();
    return () => setStage(null);
  }, [lesson.id, seat?.partnerId]);

  const next = nextAfterLesson(chapters, chapter.id, lesson.id, state);
  const hiddenCount = (chapter.lessons || [])
    .filter((l) => l.id !== lesson.id && l.id !== next?.lesson?.id).length;
  const tab = session.tab;
  /* The rule under the selected tab travels to the other one, and what the
     tab shows comes in from the side it sits on (tabMotion.js). */
  const ltabsRef = useRef(null);
  const ltabBodyRef = useRef(null);
  useTabPill(ltabsRef, tab);
  useSwitchIn(ltabBodyRef, tab, LESSON_TABS);
  // `me`, not the default. notesFor filters by author and defaults to the
  // historical "u_you"; new notes are stamped with the real id, so omitting it
  // here made every note vanish the instant it was saved.
  const comments = commentsFor(session.threads, lesson.id);

  /* §3 — THE LOGBOOK'S ROWS, and the same ones the player draws on its
     progress bar. One derivation, two readers: a list that disagreed with the
     bar directly above it would be two answers to one question. */
  const seatName = seat
    ? (people.find((p) => p.id === seat.partnerId)?.callsign || "Right seat")
    : null;
  const entries = logEntries(session.notes, session.threads, lesson.id, me,
                             seat?.partnerId || null);
  const [logFilter, setLogFilter] = useState("all");
  /* A filter fixed on somebody who has left the seat would show an empty list
     with no way back to it, because the chip that set it is gone. */
  useEffect(() => { if (!seat && logFilter === "seat") setLogFilter("all"); }, [seat, logFilter]);
  // §3.3 — watching to the end ARMS the stamp; the person applies it. Same
  // threshold the completion rule already uses, read from the saved position
  // so it survives a reload rather than only arming inside one sitting.
  const watchedToEnd = done || (state?.pos?.[lesson.id]?.pct || 0) >= 0.9;

  // `added` still feeds the sign-off stamp. The watcher count and the
  // "who was here" block that used to read presence are both gone, so this
  // screen no longer takes the presence prop at all.
  const added = lesson.addedAt
    ? new Date(lesson.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;

  /* THE COMPOSER IS THE COMMENTS TAB'S, and only the Comments tab's.
     §3 makes writing a private note the player bar's job: press the stamp,
     the video pauses, and the floating bar opens at the second you were on.
     The shared field that used to serve both tabs is gone with it, and so is
     the whole "one field, two drafts" problem it created — a note typed into
     a public box one tab-switch from being posted. There is now no way to
     write a note into anything public, because the two do not share a field.
     The timestamp chip went the same way: a comment carries a moment when you
     asked it FROM the player, which is what the diamond button does. */
  const composerRef = useRef(null);
  const [commentDraft, setCommentDraft] = useState("");
  const draft = commentDraft;
  const setDraft = setCommentDraft;
  // Same two conditions the app bar's avatar uses, so the composer can never
  // show a face the top of the screen is hiding.
  const { user: clerkUser } = useUser();
  const progress = useUserProgress();
  /* The composer's face is the same one everything else draws — it read
     Clerk's user.imageUrl, which is never null, so it always showed Clerk's
     grey glyph. src/lib/avatar.js says why. */
  const faceProfile = progress.get(FLY_SOLO_KEY, false) ? null : myFace;
  // §4 — open on desktop and tablet, closed on a phone. Read once at mount:
  // this is a starting position, not a live binding to the width.
  // What collapsing actually hides. The current row and the next one always
  // show, so a two-lesson chapter hides nothing and must not offer to.
  /* §3 — "Below 860px … Up next becomes collapsible". Open above that width
     where it is a column of its own, shut below it where it sits on top of
     the Logbook. Read once at mount: a starting position, not a live binding
     to the width. */
  const [listOpen, setListOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 860);
  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    const id = newId('T');
    postOptimistic(id, (st) => ({ ...st, threads: [...st.threads, {
      id, moduleId: mod.code || mod.id, lessonId: lesson.id,
      t: 0, body: text, authorId: me, createdAt: new Date().toISOString(),
    }]}));
    setDraft("");
  };

  return (
    /* `.lessonpage`, not `.lesson` — `.lesson` is the reference's GRID inside
       this wrapper, and lesson.css's own page rules had the same name. */
    <div className="mscreen lessonpage ref-les">
      {/* Up, not history. Tap a question in People and land here: history-back
          returns you to People, up takes you to the module. Up is predictable,
          cannot loop, and doubles as the breadcrumb this page was missing —
          and it is labelled with the destination, never a bare arrow. */}
      <button type="button" className="up" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        {chapter.title} · {mod.name}
      </button>

      {/* §3.1 — CONCEPT B. Video left, the notes and comments panel in a
          sticky column beside it, up-next below the video. It is the only
          arrangement where notes and comments are visible without scrolling,
          which is the point of a study app.

          This reverses the single centred column. That brief argued the whole
          page is the player; this one observes that the panel then starts
          around 800px down and the thing students came to write in lives below
          the fold. The areas are named, so the arrangement can be swapped
          again without touching the components. */}
      {/* THE REFERENCE'S OWN GRID: `minmax(0,1fr) 300px`, with the player, the
          title and the logbook card stacked in `.col` and up next as an
          `aside` beside them. It was a named-area grid of `.pl`, `.mt`, `.sd`
          and `.pn` inside a full-width `main` — the same arrangement under
          different names, 84px wider, and with none of the design's spacing.
          The aside is still sticky (lesson.css), so the list stays with you
          while the comments scroll past. */}
      <div className="lesson" data-ref="lesson">
      <div className="col">
      <div className="player">
        {/* An empty sized box. Never move the video node into it. */}
        <div className="player-slot" ref={slotRef} />
      </div>


      <div className="title-row">
        {/* §3.3 — the title and the sign-off share a line, the stamp
            right-aligned with no words beside it. It writes the same one
            boolean the 90%-watched rule writes: one flag, two writers. */}
          <h1 className="lesson-name">{lesson.title}</h1>
          {/* THERE IS ONE BOOKMARK ON THIS PAGE, AND IT IS IN THE PLAYER BAR.
              A second one sat here beside the sign-off — the same control,
              the same saves store, so the two could never disagree, but a
              student looking at two bookmark buttons on one screen has to
              work out whether they do different things. The design has one,
              in the control bar next to the note button, on the thing it
              acts on and at the second it refers to. See PlayerLayer.jsx. */}
          <SignOff
            armed={watchedToEnd}
            stamped={done}
            stamp={stamp}
            tilt={tilt}
            when={added || null}
            onApply={() => onMarkDone?.(lesson.id, true)}
            onVoid={() => {
              // Asks before voiding — a signed-off lesson is a record.
              if (window.confirm("Void the sign-off on this lesson?")) {
                onMarkDone?.(lesson.id, false);
              }
            }}
          />
        {/* The chapter-and-watchers line that sat here is gone. The chapter is
            already named on the up-next rail and in the breadcrumb above the
            player, so it was a third statement of the same fact, and the
            watcher count was pushing the title away from the video it names. */}

        {/* THE THREE PILLS THAT SAT HERE ARE GONE, and each went somewhere
            better rather than away: Save is on the title's line above, and
            "Ask a question" and "Mark this moment" are the diamond and the
            rectangle in the player's own bar — on the thing they act on,
            rather than a scroll below the second they refer to. */}
      </div>


      <div className="card logcard">
        {/* Presence, and the face. WhatsApp's "last seen" and Netflix's
            "continue watching" — the most familiar signal that other humans
            exist in a piece of software, and the only one that works with zero
            classmates online, because it is past tense. No online dots.

            IT LIVES WITH THE COMMENTS NOW. It is a row of three — avatar, two
            lines, a button — and it used to sit in the lesson list, which is a
            294px rail once that list moved to the left. At that width its name
            wrapped to four lines and its sentence broke to two words a line.
            The one action it offers is "ask everyone", so the top of the
            thread it opens is where it belongs. */}
        {/* The "Callsign X was here" block is gone. It was a presence report
            with an invitation attached, sitting between the title and the tab
            strip, and it was most of what pushed the panel down the page. The
            tab strip is the top of this card now. */}

        <div className="tabs" role="tablist" aria-label="Logbook and comments" ref={ltabsRef}>
          <button type="button" className="tab" role="tab" aria-selected={tab === "notes"}
                  onClick={() => setTab("notes")}>
            <span className="tab-pill" aria-hidden="true" />
            Logbook {entries.length > 0 && <small>{entries.length}</small>}
          </button>
          <button type="button" className="tab" role="tab" aria-selected={tab === "comments"}
                  onClick={() => setTab("comments")}>
            <span className="tab-pill" aria-hidden="true" />
            Comments {comments.length > 0 && <small>{comments.length}</small>}
          </button>

          {/* §3.3/§3.5 — Export lives in the notes header. There is no overflow
              menu: three items behind a menu is three items nobody finds. */}
          {tab === "notes" && entries.length > 0 && (
            <button type="button" className="link"
                    onClick={() => downloadLog(lesson.title, filterLog(entries, logFilter))}>
              Export
            </button>
          )}
        </div>

        {/* Comments only — a note is written in the player's own bar. */}
        {tab === "comments" && (
        <div className="composer" data-vis="public">
          {/* YOUR ACCOUNT ICON, and the same one the app bar shows rather than a
              second idea of what you look like. Initials were wrong here: the
              module's people list does not contain you, so it fell through to
              "You" and rendered a lone "Y". Photo when Clerk has one and Fly
              Solo is off, the person glyph otherwise — which is exactly what
              the avatar in the top bar does.
              The timestamp control that used to sit here is gone: a comment
              posts plain unless "Mark this moment" set one, which is the only
              time a moment was ever meant to be attached. */}
          <Avatar className="composer-av" profile={faceProfile}
                  name={myFace?.real_name || myFace?.callsign
                        || clerkUser?.username || clerkUser?.fullName} size={34} />
          <textarea ref={composerRef} className="composer-field" rows={1} value={draft}
                    // A placeholder is not a label. It is only a fallback for
                    // the accessible name, and it disappears the moment there
                    // is any text — so a screen reader reaching a half-typed
                    // note announced an unlabelled edit field. Says the same
                    // thing the placeholder does, and says it whatever is typed.
                    aria-label="Ask the module a question about this lesson"
                    placeholder="Ask the module…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitDraft(); }
                    }} />
          {/* Only once there is something to confirm. */}
          {draft.trim() && (
            <div className="composer-acts">
              <button type="button" className="composer-act"
                      onClick={() => setDraft("")}>Cancel</button>
              <button type="button" className="composer-act" data-primary="" onClick={submitDraft}>
                Post
              </button>
            </div>
          )}
        </div>
        )}

        <div className="ltab-body" ref={ltabBodyRef}>
        {tab === "notes"
          ? <LogTab entries={entries} filter={logFilter} onFilter={setLogFilter}
                    seat={seat ? { ...seat, name: seatName } : null}
                    stamp={stamp}
                    onSeek={requestSeek}
                    /* A note is yours and private; a question is yours and
                       public, and removing it takes the thread with it. Both
                       are only ever offered on a row you wrote. */
                    onDelete={(e) => mutate((st) => (e.kind === "ask"
                      ? removeThread(st, e.id) : deleteNote(st, e.id)))} />
          : <CommentsTab comments={comments} replies={session.replies}
                         onReport={(l) => {
                           // The existing reporter already carries the route
                           // and the state; this only has to point at it.
                           const b = document.querySelector(".rpt");
                           if (b) b.click(); else console.info("Problem report", { lesson: l.id });
                         }}
                         lesson={lesson}
                         people={people} onSeek={requestSeek} mutate={mutate}
                         pending={pending} postOptimistic={postOptimistic} me={me} />}
        </div>
      </div>

      </div>

      <aside className="card next" data-open={listOpen ? "true" : "false"}>

        {/* §4 — the video list. On a phone it is COLLAPSED by default showing
            only the next item, because expanded it pushes the notes and
            comments down and defeats the point of putting them beside the
            video in the first place. The toggle only exists at that width. */}
        <div className="next-h" data-hides={hiddenCount > 0 ? "1" : undefined}>
          <b>{chapter.title}</b>
          <button type="button" className="tog"
                  aria-expanded={listOpen ? "true" : "false"}
                  onClick={() => setListOpen((v) => !v)}>
            {listOpen ? "Fewer" : `${hiddenCount} more`}
            <ChevronLeft aria-hidden="true" />
          </button>
        </div>
        <ol>
          {(chapter.lessons || []).map((l) => {
            const isHere = l.id === lesson.id;
            const isNext = next?.lesson?.id === l.id;
            return (
              <li key={l.id}>
                <button type="button" className="nx"
                        data-here={isHere ? "1" : undefined}
                        data-next={isNext ? "1" : undefined}
                        aria-current={isHere ? "true" : undefined}
                        onClick={() => onOpenLesson(chapter, l)}>
                  <span className="t">{l.title}</span>
                  {isHere && <span className="now">Playing</span>}
                </button>
              </li>
            );
          })}
        </ol>

        {/* ONLY WHEN IT IS NOT ALREADY IN THE LIST ABOVE. The rail lists this
            chapter's lessons, so when the next one is in this chapter this row
            repeated a line the eye had just read — "Lesson 2" listed, then
            "NEXT Lesson 2" underneath it. It earns its place when the next
            thing is in a DIFFERENT chapter, which the list cannot show. */}
        {(!next || next.chapter?.id !== chapter.id) && (
        <div className="next-up">
          {next ? (
            <>
              <span className="next-label">Next</span>
              <a className="next-title" href="#next"
                 onClick={(e) => {
                   e.preventDefault();
                   if (next.kind === "quiz") onOpenQuiz(next.chapter);
                   else onOpenLesson(next.chapter, next.lesson);
                 }}>{nextLabel(next)}</a>
              <span className="next-meta">{nextWhere(next)}</span>
            </>
          ) : <span className="next-label">Last in this module</span>}
        </div>
        )}

      </aside>

      </div>
    </div>
  );
}


// The public half. Same rows People shows — one table, two queries — in moment
// order, because scrolling this list is scrubbing the video above it.
// YouTube's comment thread: avatar, name, relative time, body, Reply — with
// replies collapsed behind one expander, because that is what everyone has
// seen ten thousand times and because an expanded thread pushes the next
// question off the screen.
function CommentsTab({ comments, replies, lesson, people, onSeek, mutate, pending, postOptimistic, onReport, me }) {
  // Author ids are the storage key; a callsign is what a person reads. One
  // resolver so a row never shows "u_five" to a student.
  const who = (id) =>
    id === me ? "You" : (people.find((p) => p.id === id)?.callsign || "Someone");
  // §3.5 — the instructor badge, "where it applies". One resolver, so a badge
  // can never appear beside a name the same lookup failed to resolve.
  const teaches = (id) => people.find((p) => p.id === id)?.role === "instructor";
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [openReplies, setOpenReplies] = useState(() => new Set());

  return (
    <>
      {/* NO COMPOSER HERE. LessonPage renders ONE above the tab strip, serving
          both Notes and Comments — that is the stated design, and this tab was
          rendering a SECOND one underneath it. Two boxes for one job, stacked,
          with copy that did not even agree: "Everyone on Module 1 sees this."
          above "Everyone on Module 1 sees this, in People." The reply composer
          further down stays; it belongs to one comment rather than to the tab. */}

      {/* Nothing is rendered for an empty list. The site this is modelled on
          says nothing there either, and the composer directly above it is
          already the invitation — a sentence explaining that the list is empty
          is the thing the voice rule calls stating an absence.
          (A JSX comment cannot be the branch of a ternary: it parses as a
          second expression. It goes above.) */}
      {comments.length === 0 ? null : (
        <ul className="llist">
          {comments.map((c) => {
            const rs = repliesFor(replies, c.id);
            const isOpen = openReplies.has(c.id);
            return (
              <li key={c.id} className="cmt"
                  /* Only a row that HAS replies draws the connector. A line
                     running down to nothing is worse than no line. */
                  data-threaded={rs.length > 0 && isOpen ? "1" : undefined}
                  data-pending={pending?.[c.id] === "pending" ? "1" : undefined}
                  data-failed={pending?.[c.id] === "failed" ? "1" : undefined}>
                <span className="av" aria-hidden="true" style={{ "--av-h": hueFor(c.authorId) }}>
                  {initials(who(c.authorId))}
                </span>
                <div className="cmt-main">
                  <div className="cmt-head">
                    <span className="cmt-name">{who(c.authorId)}</span>
                    {teaches(c.authorId) && <span className="cmt-badge">Instructor</span>}
                    <span className="cmt-when">{ago(c.createdAt)}</span>
                    {/* A time inside a comment is pressable — YouTube taught
                        everyone that, and the behaviour already existed here. */}
                    <button type="button" className="cmt-seek" onClick={() => onSeek(c.t)}>
                      {mmss(c.t)}
                    </button>
                  </div>
                  <p className="cmt-body">{seekable(c.body, onSeek)}</p>
                  <div className="cmt-acts">
                    {pending?.[c.id] === "failed" ? (
                      /* It stays, with a way back. Never delete what someone
                         typed because a network dropped. */
                      <button type="button" className="cmt-retry"
                              onClick={() => postOptimistic(c.id, (s) => ({ ...s, threads: [...s.threads] }))}>
                        Not sent — tap to retry
                      </button>
                    ) : (
                      <button type="button" className="cmt-act" onClick={() => setReplyTo(c.id)}>Reply</button>
                    )}
                  </div>

                  {/* The replies toggle is the FOOT of the thread, on its own
                      line, rather than a third item in the action row. Inline
                      it competed with Reply for the same spot and the count
                      read as another button instead of as a way in. */}
                  {rs.length > 0 && (
                    <div className="cmt-foot">
                      <button type="button" className="cmt-expand" aria-expanded={isOpen}
                              onClick={() => setOpenReplies((o) => toggleReplies(o, c.id))}>
                        <ChevronDown aria-hidden="true" />
                        {replyCountLabel(rs.length)}
                      </button>
                    </div>
                  )}

                  <ul className="cmt-replies" hidden={!isOpen}>
                    {rs.map((r) => (
                      <li key={r.id} className="cmt-reply">
                        <span className="av" data-size="sm" aria-hidden="true"
                              style={{ "--av-h": hueFor(r.authorId) }}>
                          {initials(who(r.authorId))}
                        </span>
                        <span>
                          <span className="cmt-head">
                            <span className="cmt-name">{who(r.authorId)}</span>
                            {teaches(r.authorId) && <span className="cmt-badge">Instructor</span>}
                            <span className="cmt-when">{ago(r.createdAt)}</span>
                          </span>
                          <p className="cmt-body">{seekable(r.body, onSeek)}</p>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {replyTo === c.id && (
                    <div className="compose" data-vis="public">
                      <span className="compose-t" />
                      <textarea className="compose-field" rows={1} value={replyBody} autoFocus
                                placeholder="Answer this" onChange={(e) => setReplyBody(e.target.value)} />
                      <div className="compose-acts">
                        <button type="button" className="compose-act" data-primary=""
                                onClick={() => {
                                  if (!replyBody.trim()) return;
                                  mutate((s2) => postReply(s2, { threadId: c.id, body: replyBody }));
                                  setReplyBody(""); setReplyTo(null);
                                  setOpenReplies((o) => new Set(o).add(c.id));
                                }}>Reply</button>
                        <button type="button" className="compose-act" onClick={() => setReplyTo(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* §3.3/§3.5 — report a problem sits at the FOOT of the comments, quietly.
          It is not an overflow menu and it is not a button competing with the
          composer: somebody reaching for it has already scrolled past
          everything else looking for it. */}
      <p className="lreport">
        Something wrong with this lesson?{" "}
        <button type="button" className="lreport-go"
                onClick={() => onReport?.(lesson)}>Report a problem</button>
      </p>
    </>
  );
}
