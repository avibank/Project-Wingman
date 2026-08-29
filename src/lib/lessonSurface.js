/* ============================================================================
   Wingman — the lesson surface
   Notes · Comments · the lesson appearance · the mini player

   Copy the pure functions verbatim. Do not re-derive them.

   Everything here is a single-sentence rule. Nothing predicts, guesses or gets
   clever. That is deliberate: the moment one of these starts being smart, the
   student starts managing it instead of studying.

   THREE OBJECTS. Keep them straight and the rest follows.

     note    private, yours, anchored to {lessonId, t}. Body may be EMPTY —
             a bare pin is allowed and is the point. Never has replies.
     thread  public. lessonId + t set -> a comment, under that video AND in
             People. lessonId null -> a module post, People only.
     reply   belongs to a thread. Never to a moment. Never gets a mark.
   ========================================================================= */


/* ============================================================================
   1 · SESSION STORE — state that outlives the route
   ----------------------------------------------------------------------------
   All of this lives ABOVE the router. If any of it is created inside a lesson
   page component, the mini player breaks the first time anyone navigates.
   ========================================================================= */

export const initialSession = {
  // the one player
  player: {
    lessonId: null,
    seconds: 0,
    playing: false,
    dock: 'none',        // 'inline' | 'mini' | 'none'
    closedByUser: false
  },

  // the note composer, open or not
  composer: null,        // null | { lessonId, t, body, resumeOnClose }

  // the banner currently showing
  banner: null,          // null | { noteIds: [...], expanded: bool, shownAt: ms }

  // which tab under the video
  tab: 'notes',          // 'notes' | 'comments'

  notes: [],
  threads: [],
  replies: []
};


/* ============================================================================
   2 · THE MINI PLAYER
   ----------------------------------------------------------------------------
   Rule: it docks when the inline slot leaves the viewport AND the video is
   playing. It comes back when the slot does. Nothing else triggers it.
   ========================================================================= */

export const DOCK_THRESHOLD = 0.4;   // slot is "gone" below 40% visible
export const MINI_W = 320;           // desktop corner width, px
export const MINI_MARGIN = 24;       // from the viewport edge
export const DOCK_MS = 260;          // matches --t-base

export function playerReducer(p, ev) {
  switch (ev.type) {

    case 'load':
      // A different lesson always takes the player. There is never a second one.
      if (p.lessonId === ev.lessonId) return { ...p, dock: 'inline' };
      return { lessonId: ev.lessonId, seconds: ev.seconds ?? 0,
               playing: false, dock: 'inline', closedByUser: false };

    case 'slot':
      if (ev.visible) return { ...p, dock: 'inline', closedByUser: false };
      // THE WHOLE DESIGN IS THIS LINE: a paused video never follows you.
      if (p.playing && !p.closedByUser) return { ...p, dock: 'mini' };
      return { ...p, dock: 'none' };

    case 'play':  return { ...p, playing: true };
    case 'pause': return { ...p, playing: false };

    // Close means "not now", not "never". The flag clears when the real
    // player is back on screen, so it never argues and never needs a setting.
    case 'close': return { ...p, playing: false, dock: 'none', closedByUser: true };

    case 'time':  return { ...p, seconds: ev.seconds };
    case 'seek':  return { ...p, seconds: ev.seconds };

    default: return p;
  }
}

/* One observer per lesson page, watching the EMPTY SLOT — not the player,
   because the player leaves it. */
export function observeSlot(slotEl, dispatch) {
  const io = new IntersectionObserver(
    ([e]) => dispatch({ type: 'slot', visible: e.intersectionRatio >= DOCK_THRESHOLD }),
    { threshold: [0, DOCK_THRESHOLD, 1] }
  );
  io.observe(slotEl);
  return () => io.disconnect();
}

/* WHERE THE PLAYER LIVES — the one engineering constraint in this file.

   The <video> is rendered ONCE, in the app shell, above the router. The lesson
   page renders an empty sized slot. Position the player over that slot with a
   transform against its measured rect:

     const r = slotEl.getBoundingClientRect();
     layer.style.width = r.width + 'px';
     layer.style.transform = `translate(${r.left}px, ${r.top}px)`;

   NEVER move the <video> node between parents. Re-parenting a video restarts
   playback in every browser, and that is the exact thing this feature exists
   to prevent.

   Transform and width only. Never animate filter, opacity, backdrop-filter or
   box-shadow on the player layer — an element composited over live video that
   cannot composite alone re-rasterises every frame. Same measurement that
   removed the aurora animation.

   And on the <video> itself: aspect-ratio, NEVER height:auto. A video whose
   metadata has not arrived collapses to zero height, and every position
   measured against it lands wrong for the first second of the page. */


/* ============================================================================
   3 · NOTES
   ----------------------------------------------------------------------------
   Rule: the icon in the player's control bar pauses the video and opens the
   composer. Closing saves. An empty body is a valid note — a bare pin.
   ========================================================================= */

/* Two taps gets you a pin: open, close. No typing required.
   That is what makes note-taking actually easy rather than nominally easy —
   the cost of writing during a lesson is missing the next thing, and a pin
   costs nothing. You fill it in on the second watch, or never. */

export function openComposer(session, { lessonId, seconds }) {
  if (session.composer) return session;                 // already open
  return {
    ...session,
    player: { ...session.player, playing: false },       // pause on open
    composer: {
      lessonId,
      t: Math.floor(seconds),   // exact, because the video is stopped
      body: '',
      resumeOnClose: session.player.playing
    }
  };
}

/* Closing SAVES — including an empty body. Discard is a separate, explicit
   action. This is what he asked for and it is what makes the pin cheap. */
export function closeComposer(session, { authorId = 'u_you' } = {}) {
  const c = session.composer;
  if (!c) return session;
  const note = {
    id: `N${Date.now().toString(36)}`,
    lessonId: c.lessonId,
    t: c.t,
    body: c.body.trim(),        // may be '' — that is a pin, not a bug
    authorId,
    createdAt: new Date().toISOString()
  };
  return {
    ...session,
    notes: [...session.notes, note],
    composer: null,
    player: { ...session.player, playing: c.resumeOnClose }
  };
}

export function discardComposer(session) {
  const c = session.composer;
  if (!c) return session;
  return { ...session, composer: null,
           player: { ...session.player, playing: c.resumeOnClose } };
}

/* Marked forever unless you remove it. Deleting your own note is free — it is
   yours and nobody has replied to it. */
export function deleteNote(session, noteId) {
  return { ...session, notes: session.notes.filter(n => n.id !== noteId) };
}

/* The back door to community notes: publish one. It becomes a comment — the
   same anchored, public object everyone else's questions use. There is no
   separate "community note" type and there should not be one. */
export function publishNote(session, noteId, { moduleId }) {
  const n = session.notes.find(x => x.id === noteId);
  if (!n || !n.body) return session;          // a bare pin has nothing to publish
  const thread = {
    id: `T${Date.now().toString(36)}`,
    moduleId,
    lessonId: n.lessonId,
    t: n.t,
    body: n.body,
    authorId: n.authorId,
    createdAt: new Date().toISOString()
  };
  return { ...session,
           notes: session.notes.filter(x => x.id !== noteId),
           threads: [...session.threads, thread] };
}

export const notesFor = (notes, lessonId, me = 'u_you') =>
  notes.filter(n => n.lessonId === lessonId && n.authorId === me)
       .sort((a, b) => a.t - b.t);


/* ============================================================================
   4 · THE BANNER
   ----------------------------------------------------------------------------
   Rule: passing your own note during playback shows a brief banner. It does
   NOT pause. Tapping it expands it, and expanding is what pauses.
   ========================================================================= */

export const BANNER_MS = 7000;        // then it fades on its own
export const SEEK_TOLERANCE = 1.5;    // a jump bigger than this is a seek, not playback
export const CLUSTER_S = 4;           // notes this close share one banner

/* Which notes were crossed between two ticks.

   Forward playback only. A seek does NOT fire banners for everything it jumped
   over — otherwise scrubbing through a lesson throws every note you ever wrote
   at you at once. */
export function notesCrossed(prevT, nextT, notes) {
  if (nextT <= prevT) return [];                       // backwards or still
  if (nextT - prevT > SEEK_TOLERANCE) return [];       // that was a seek
  return notes.filter(n => n.t > prevT && n.t <= nextT)
              .sort((a, b) => a.t - b.t);
}

/* One banner at a time. Notes within CLUSTER_S of the first share it, and the
   banner says how many rather than stacking two boxes on top of each other. */
export function bannerFrom(crossed, notes) {
  if (!crossed.length) return null;
  const first = crossed[0];
  const together = notes
    .filter(n => n.t >= first.t && n.t <= first.t + CLUSTER_S)
    .sort((a, b) => a.t - b.t);
  return { noteIds: together.map(n => n.id), expanded: false, shownAt: Date.now() };
}

/* What the banner reads. A pin with no text still says something useful —
   that is the point of pins. */
export function bannerLabel(banner, notes) {
  const ns = banner.noteIds.map(id => notes.find(n => n.id === id)).filter(Boolean);
  if (ns.length > 1) return `${ns.length} notes here`;
  const n = ns[0];
  if (!n) return '';
  return n.body || 'You marked this moment';
}

/* Expanding is the only thing that stops the video. Closing resumes it if it
   was playing when you tapped. */
export function expandBanner(session) {
  if (!session.banner) return session;
  return { ...session,
           banner: { ...session.banner, expanded: true, resumeOnClose: session.player.playing },
           player: { ...session.player, playing: false } };
}

export function dismissBanner(session) {
  const b = session.banner;
  if (!b) return session;
  return { ...session, banner: null,
           player: { ...session.player, playing: b.expanded ? !!b.resumeOnClose : session.player.playing } };
}

/* COMMENTS NEVER GET BANNERS. Your notes announce themselves because you wrote
   them and you want them back. Someone else's question passing by is not
   something you asked for, and a lesson with forty comments would be
   unwatchable. The mark on the bar is enough for those. */


/* ============================================================================
   5 · MARKS ON THE BAR
   ----------------------------------------------------------------------------
   Rule: one mark per note and one mark per thread — never per reply. Marks
   closer together than a finger get clustered, and the cluster is the hit
   target.
   ========================================================================= */

export const MARK_MIN_PX = 8;    // closer than this and they merge
export const HIT_PX = 44;        // the invisible tap area on every cluster

/* Clustering IS the hit-target fix. Two marks 3px apart cannot both have a
   44px target without overlapping, so merge them first and give the cluster
   one target. Solve it once, not twice. */
export function markClusters(items, durationS, barWidthPx) {
  if (!durationS || !barWidthPx) return [];
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const out = [];
  for (const it of sorted) {
    const px = (it.t / durationS) * barWidthPx;
    const last = out[out.length - 1];
    if (last && px - last.px < MARK_MIN_PX) {
      last.items.push(it);
      // a cluster holding any thread reads as a thread — the public one wins,
      // because it is the one another person is waiting on
      if (it.kind === 'thread') last.kind = 'thread';
    } else {
      out.push({ px, pct: (it.t / durationS) * 100, kind: it.kind, items: [it] });
    }
  }
  return out;
}

/* Everything that earns a mark on this lesson's bar: your notes, plus the
   comments anchored to it. Replies contribute nothing. */
/* commentsFor is declared further down as a const arrow. Nothing calls this at
   module-evaluation time, so there is no temporal dead zone in practice, and
   the file is copied verbatim from the brief rather than reordered. */
export function lessonMarks(notes, threads, lessonId, me = 'u_you') {
  return [
    ...notesFor(notes, lessonId, me).map(n => ({ t: n.t, kind: 'note', id: n.id })),
    // eslint-disable-next-line no-use-before-define
    ...commentsFor(threads, lessonId).map(c => ({ t: c.t, kind: 'thread', id: c.id }))
  ];
}


/* ============================================================================
   6 · COMMENTS AND THREADS
   ----------------------------------------------------------------------------
   ONE THREAD, TWO QUERIES. The comment under the video and the thread in
   People are the same row. The lesson asks "what is on this lesson", People
   asks "what is in this module". Nothing copies. Nothing syncs. Nothing can
   drift out of agreement, because there is only one of it.

   Do not build two tables and a job that keeps them matching. That is the
   version that ends up showing different reply counts in two places.
   ========================================================================= */

/* Under the video: anchored threads only, in MOMENT order.

   Not newest-first. Ordering by moment means scrolling the comment list is
   scrubbing the video, and the list matches the bar above it. Newest-first
   breaks that connection immediately and there is no way to get it back. */
export const commentsFor = (threads, lessonId) =>
  threads.filter(t => t.lessonId === lessonId && t.t !== null && t.t !== undefined)
         .sort((a, b) => a.t - b.t);

export const repliesFor = (replies, threadId) =>
  replies.filter(r => r.threadId === threadId)
         .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/* Posting from under a video: the moment is wherever the playhead is. */
export function postComment(session, { moduleId, lessonId, seconds, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, threads: [...session.threads, {
    id: `T${Date.now().toString(36)}`, moduleId, lessonId,
    t: Math.floor(seconds), body: text, authorId,
    createdAt: new Date().toISOString()
  }]};
}

/* Posting from People: no lesson, no moment. This is the whole of the
   one-way rule — a module post has no lessonId, so no lesson query can ever
   return it. Nobody has to remember the rule; there is nothing to attach. */
export function postModulePost(session, { moduleId, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, threads: [...session.threads, {
    id: `T${Date.now().toString(36)}`, moduleId, lessonId: null,
    t: null, body: text, authorId,
    createdAt: new Date().toISOString()
  }]};
}

/* A reply belongs to the thread. It gets no moment and no mark, wherever it
   was written from. A reply typed in People appears under the video, and a
   reply typed under the video appears in People — same row, two queries. */
export function postReply(session, { threadId, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, replies: [...session.replies, {
    id: `${threadId}.R${Date.now().toString(36)}`, threadId,
    body: text, authorId, createdAt: new Date().toISOString()
  }]};
}

/* A comment cannot be un-asked. It exists in People and someone may have
   answered it. Deleting is a separate, later, explicit action — not this
   button. */

export const isAnchored = t => t.lessonId !== null && t.lessonId !== undefined;
export const isWaiting = (thread, replies) =>
  !replies.some(r => r.threadId === thread.id);

export function isIn(thread, replies, me = 'u_you') {
  return thread.authorId === me || replies.some(r => r.threadId === thread.id && r.authorId === me);
}

export const lastActivity = (thread, replies) => {
  const rs = repliesFor(replies, thread.id);
  return rs.length ? rs[rs.length - 1].createdAt : thread.createdAt;
};

/* The last thing that happened here that WASN'T you. Returns null if the only
   activity on the thread is your own.

   This is what a badge has to be measured against. Measured against plain
   lastActivity, a question you asked and nobody has answered badges itself —
   you get a dot for your own post, forever, on every thread you start. That is
   how People turns permanently red, which is the failure the module chat room
   was rejected for. Found by testing the rule against the seed data, not by
   reading it. */
export function lastActivityBy(thread, replies, me = 'u_you') {
  const events = [
    ...(thread.authorId === me ? [] : [thread.createdAt]),
    ...repliesFor(replies, thread.id).filter(r => r.authorId !== me).map(r => r.createdAt)
  ];
  return events.length ? events[events.length - 1] : null;
}

/* PEOPLE ORDER — and newest-first is the wrong default here.

   Threads you are in, then the ones nobody has answered, then the rest. The
   middle band is what turns eleven people into eleven people helping each
   other rather than everyone posting into silence. */
export function orderThreads(threads, replies, moduleId, me = 'u_you') {
  const band = t => isIn(t, replies, me) ? 0 : isWaiting(t, replies) ? 1 : 2;
  return threads
    .filter(t => t.moduleId === moduleId)
    .sort((a, b) =>
      band(a) - band(b) ||
      lastActivity(b, replies).localeCompare(lastActivity(a, replies)));
}

/* UNREAD DISCIPLINE — this is load-bearing, not a nicety.

   Every comment on every lesson now becomes a thread in People. If each one
   badged, People would be permanently red within a week and people would stop
   opening it — which is precisely the failure the module chat room was
   rejected for.

   A thread badges ONLY if you are in it AND somebody else has done something
   since you last looked. Everything else waits quietly to be found; "someone
   asked on a lesson you finished" is a soft dismissible row, never a badge.

   Both halves are required. Dropping the second one badges your own unanswered
   questions back at you. */
export function badges(threads, replies, moduleId, me = 'u_you', lastSeen = {}) {
  return orderThreads(threads, replies, moduleId, me)
    .filter(t => isIn(t, replies, me))
    .filter(t => {
      const last = lastActivityBy(t, replies, me);
      return last !== null && last > (lastSeen[t.id] || '');
    })
    .map(t => t.id);
}

/* From People back to the moment. This is the only bridge, so it has to work:
   opening an anchored thread opens that lesson, at that second, with the
   thread open under the video. */
export const watchAt = thread =>
  isAnchored(thread) ? { lessonId: thread.lessonId, seconds: thread.t } : null;


/* ============================================================================
   7 · WHAT IS NOT HERE, AND MUST NOT COME BACK
   ----------------------------------------------------------------------------
   · No windows. No draggable panels, resize handles, minimise chrome, or a
     tab bar of open documents. Cancelled, not deferred.
   · No sidebar, no margin column, no right-edge document rail, no split pane.
     Cancelled after a first-year legibility review: five novel surfaces on one
     screen is the thing that intimidates, not any one of them.
   · No transcript.
   · No separate "community note" type — publishing a note makes it a comment.
   · No module chat room. Threads are individually addressable and only badge
     when you are in one. That is what keeps this from becoming the room that
     was already rejected.
   · No percentage, no progress ring, no badge count on the lesson screen.
   ========================================================================= */


/* ============================================================================
   8 · WIRING — adapt this, it is not verbatim
   ============================================================================

   const SessionCtx = createContext(null);

   function SessionProvider({ children }) {
     const [session, setSession] = useState(initialSession);
     const dispatchPlayer = useCallback(
       ev => setSession(s => ({ ...s, player: playerReducer(s.player, ev) })), []);
     return (
       <SessionCtx.Provider value={{ session, setSession, dispatchPlayer }}>
         {children}
         <PlayerLayer />        // the one <video>, above the router
       </SessionCtx.Provider>
     );
   }

   // lesson page
   const slotRef = useRef(null);
   useEffect(() => observeSlot(slotRef.current, dispatchPlayer), []);
   useEffect(() => dispatchPlayer({ type: 'load', lessonId, seconds: resume }), [lessonId]);

   // banner, driven off timeupdate — throttle to about 4/s, keep the previous t
   const prev = useRef(0);
   function onTimeUpdate(t) {
     const crossed = notesCrossed(prev.current, t, notesFor(session.notes, lessonId));
     prev.current = t;
     if (crossed.length && !session.banner)
       setSession(s => ({ ...s, banner: bannerFrom(crossed, s.notes) }));
   }

   PERSISTENCE
     notes    server, per user. They are the student's own work.
     threads  server, per module. Public.
     replies  server, per thread.
     player.seconds  server, per lesson — resume is the point of it.
     tab, banner, composer  memory only.
   ========================================================================= */
