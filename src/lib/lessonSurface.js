/* ============================================================================
   Wingman — the lesson surface
   Notes · Comments · the player · the mini player · navigation

   Copy the pure functions verbatim. Do not re-derive them.

   Every rule here is one sentence. Nothing predicts, guesses or gets clever —
   the moment one of these starts being smart, the student starts managing the
   app instead of studying.

   THREE OBJECTS. Keep them straight and the rest follows.

     note    private, yours, {lessonId, t}. Body may be EMPTY — a bare pin is
             a timestamp, and filling it in later is how it becomes a note.
             Editable forever. Never has replies.
     thread  public. lessonId + t set -> a comment: under that video AND in
             People. lessonId null -> a module post: People only.
     reply   belongs to a thread. Never to a moment. Never gets a mark.
   ========================================================================= */


/* ============================================================================
   1 · SESSION STORE — state that outlives the route
   ----------------------------------------------------------------------------
   All of this lives ABOVE the router. The mini player is site-wide: it keeps
   playing across the Flight Deck, People, Licence, everywhere. If any of this
   is created inside a page component it dies on the first navigation.
   ========================================================================= */

export const initialSession = {
  player: {
    lessonId: null,
    moduleId: null,
    seconds: 0,
    playing: false,
    dock: 'none',          // 'inline' | 'mini' | 'none'
    rate: 1,
    volume: 1,
    muted: false,
    fullscreen: false
  },

  // the note bar: composing a new note, or editing an existing one
  bar: null,               // null | { lessonId, t, body, noteId|null, resumeOnClose }

  // where the bar sits inside the player, as a fraction of the free space
  barPos: { fx: 0.5, fy: 0.78 },

  hud: null,               // null | { kind:'volume'|'rate', value, shownAt }
  banner: null,            // null | { noteIds, expanded, resumeOnClose }
  tab: 'notes',            // 'notes' | 'comments'

  notes: [],
  threads: [],
  replies: []
};


/* ============================================================================
   2 · THE PLAYER STATE
   ----------------------------------------------------------------------------
   Rule: the player docks when its inline slot leaves the viewport AND the
   video is playing. It comes back when the slot does. CLOSING STOPS IT.
   ========================================================================= */

export const DOCK_THRESHOLD = 0.4;
export const MINI_W = 320;
export const MINI_MARGIN = 24;
export const DOCK_MS = 260;

export function playerReducer(p, ev) {
  switch (ev.type) {

    case 'load':
      if (p.lessonId === ev.lessonId) return { ...p, dock: 'inline' };
      return { ...p, lessonId: ev.lessonId, moduleId: ev.moduleId,
               seconds: ev.seconds ?? 0, playing: false, dock: 'inline' };

    case 'slot':
      if (ev.visible) return { ...p, dock: 'inline' };
      // THE WHOLE DESIGN IS THIS LINE: a paused video never follows you.
      return { ...p, dock: p.playing ? 'mini' : 'none' };

    case 'play':  return { ...p, playing: true };
    case 'pause': return { ...p, playing: false };

    /* CLOSE MEANS STOP. Not "hide", not "not now" — the X on the mini player
       is how you stop watching. Position is kept, so going back to the lesson
       shows the inline player paused exactly where you left it.

       There is no "closedByUser" flag any more and there must not be one: with
       close stopping playback, the docking rule already refuses to re-dock,
       because it only ever docks something that is playing. One rule doing two
       jobs is better than two rules agreeing. */
    case 'close': return { ...p, playing: false, dock: 'none' };

    case 'time':
    case 'seek':  return { ...p, seconds: ev.seconds };

    case 'rate':  return { ...p, rate: ev.rate };
    // eslint-disable-next-line no-use-before-define
    case 'volume':return { ...p, volume: clamp01(ev.volume), muted: ev.volume === 0 };
    case 'mute':  return { ...p, muted: ev.muted };
    case 'fullscreen': return { ...p, fullscreen: ev.on };

    default: return p;
  }
}

export function observeSlot(slotEl, dispatch, root) {
  // ROOT IS THE SCROLLER, not the viewport. With the shell back they are two
  // different boxes — the shell reserves a header row, so the scroller is
  // shorter than the screen — and an observer measuring against the viewport
  // calls the slot visible while it is already scrolled up behind the header.
  // That disagreement between the observer root and the real scroller is
  // exactly what made the mini player dock inconsistently before.
  const io = new IntersectionObserver(
    ([e]) => dispatch({ type: 'slot', visible: e.intersectionRatio >= DOCK_THRESHOLD }),
    { threshold: [0, DOCK_THRESHOLD, 1], root: root || null }
  );
  io.observe(slotEl);
  return () => io.disconnect();
}

/* The mini player has exactly two controls.
   Tap the body -> go back to the lesson, at the position it is at.
   Tap the X    -> stop.
   Nothing else. No scrub, no note button, no speed. It is a way back, not a
   second player. */
export const miniTarget = p =>
  p.lessonId ? { lessonId: p.lessonId, moduleId: p.moduleId, seconds: p.seconds } : null;

/* SITE-WIDE, AND THE THING THAT COMES WITH IT.

   On a phone the mini bar is docked above the tab bar on EVERY page. Every
   scrollable page must reserve that height while it is up, or the last row of
   every list on the site sits permanently behind it. Set it once, on the app
   shell, and let pages read it:

     document.body.style.setProperty('--mini-h', dock === 'mini' ? '64px' : '0px');
     // and every page: padding-bottom: calc(var(--pad-b) + var(--mini-h));

   Invisible in a mockup. Annoying on every screen if it is missed. */

const clamp01 = v => Math.min(1, Math.max(0, v));


/* ============================================================================
   3 · SPEED, VOLUME, AND THE KEYMAP
   ----------------------------------------------------------------------------
   No captions control. Subtitles are deferred, not decided against — leave
   <track> support on the element, just render no button while there are no
   tracks. Re-adding it later should be a button, not a rebuild.
   ========================================================================= */

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/* Persist the choice per account. Someone who watches at 1.5 watches
   everything at 1.5, and re-choosing it every lesson is a small insult. */

export const VOLUME_STEP = 0.05;
export const HUD_MS = 1000;

/* THE ONE THING THAT SHIPS BROKEN IF IT IS MISSED.

   Shortcuts must be dead while anything is being typed into. Otherwise typing
   the word "fine" in a note goes fullscreen, jumps back ten seconds and mutes
   the video. Nobody tests typing a word with an f in it. */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/* Returns an action, or null if the key is not ours. Wire it on the document,
   not the player, so it works whether or not the player has focus. */
export function keyAction(e) {
  if (isTypingTarget(e.target)) return null;      // <- the guard, first, always
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  switch (e.key) {
    case ' ': case 'k': case 'K': return { type: 'toggle' };
    case 'ArrowUp':    return { type: 'volume', delta:  VOLUME_STEP };
    case 'ArrowDown':  return { type: 'volume', delta: -VOLUME_STEP };
    case 'm': case 'M':return { type: 'mute' };
    case 'ArrowLeft':  return { type: 'seek', delta:  -5 };
    case 'ArrowRight': return { type: 'seek', delta:   5 };
    case 'j': case 'J':return { type: 'seek', delta: -10 };
    case 'l': case 'L':return { type: 'seek', delta:  10 };
    case 'f': case 'F':return { type: 'fullscreen' };
    case 'n': case 'N':return { type: 'note' };
    case 'Escape':     return { type: 'escape' };
    default: return null;
  }
}

/* The on-screen indicator, the way a video site does it: a slab in the middle
   of the frame for about a second. Volume and speed share it — two HUDs that
   look different for the same class of feedback is noise. */
export function showHud(session, kind, value) {
  return { ...session, hud: { kind, value, shownAt: Date.now() } };
}
export const hudLabel = hud =>
  !hud ? '' :
  hud.kind === 'rate' ? `${hud.value}×` :
  hud.value === 0 ? 'Muted' : `${Math.round(hud.value * 100)}%`;


/* ============================================================================
   4 · THE PLAYER SIZE
   ----------------------------------------------------------------------------
   Rule: fullscreen fills. Windowed is big enough to watch and control, small
   enough not to crowd — and that is a different number on a phone and on a
   large monitor.
   ========================================================================= */

/* The mechanism is HEIGHT-driven, not width-driven, and that is the whole
   trick. "Not crowding you" really means "I can see the video and the row
   under it without scrolling", which is a statement about viewport height.
   Sizing by width alone gives you a letterbox on a laptop and a wall on a
   monitor.

     width = min(100%, --player-max-w, --player-max-h * 16/9)

   with two tokens per breakpoint. See wingman-lesson-source.css.

     phone   <768    full width, no height cap  (portrait is width-limited anyway)
     tablet  768+    max-height 52vh, max-width 100%
     desktop 1120+   max-height 64vh, max-width 1180px

   Worked through: 1440x900 -> 576px tall -> 1024 wide. 1920x1080 -> 691 tall
   -> 1229, capped to 1180. Laptop 1440x800 -> 512 -> 910. Tablet 1024x768
   landscape -> 399 -> 710. The page measure follows the player rather than a
   fixed number, so the video and its words always share an edge. */


/* ============================================================================
   5 · NOTES — the pin IS the timestamp
   ----------------------------------------------------------------------------
   Rule: the pen button pauses the video and opens a one-line bar at that
   second. Closing saves, empty included. A pin can be filled in at any time,
   forever.
   ========================================================================= */

/* Two taps gets you a pin: open, close. No typing.
   The real cost of taking notes during a lesson is not typing speed — it is
   that writing makes you miss the next thing. A pin costs nothing in the
   moment and still says "something happened here" three weeks later. */

export function openBar(session, { lessonId, seconds }) {
  if (session.bar) return session;
  return {
    ...session,
    player: { ...session.player, playing: false },       // pause on open
    bar: {
      lessonId,
      t: Math.floor(seconds),        // exact, because the video is stopped
      body: '',
      noteId: null,                  // null = new
      resumeOnClose: session.player.playing
    }
  };
}

/* FILLING IN A PIN — the path that was missing, and the reason pins work.
   Same bar, same everything, seeded with what is already there. The video
   seeks to the note's moment so you can see what you were looking at. */
export function editNote(session, noteId) {
  const n = session.notes.find(x => x.id === noteId);
  if (!n) return session;
  return {
    ...session,
    player: { ...session.player, playing: false, seconds: n.t },
    banner: null,
    bar: { lessonId: n.lessonId, t: n.t, body: n.body, noteId: n.id,
           resumeOnClose: false }    // you came here to read, not to keep watching
  };
}

/* Closing SAVES — including an empty body on a new note. Discard is separate
   and explicit. Editing an existing note down to nothing turns it back into a
   pin; it does not delete it. Deleting is its own button. */
export function closeBar(session, { authorId = 'u_you' } = {}) {
  const b = session.bar;
  if (!b) return session;
  const body = b.body.trim();
  const notes = b.noteId
    ? session.notes.map(n => n.id === b.noteId
        ? { ...n, body, updatedAt: new Date().toISOString() } : n)
    : [...session.notes, {
        id: `N${Date.now().toString(36)}`, lessonId: b.lessonId, t: b.t,
        body, authorId, createdAt: new Date().toISOString()
      }];
  return { ...session, notes, bar: null,
           player: { ...session.player, playing: b.resumeOnClose } };
}

export function discardBar(session) {
  const b = session.bar;
  if (!b) return session;
  return { ...session, bar: null,
           player: { ...session.player, playing: b.resumeOnClose } };
}

export function deleteNote(session, noteId) {
  return { ...session,
           notes: session.notes.filter(n => n.id !== noteId),
           bar: session.bar?.noteId === noteId ? null : session.bar };
}

/* The back door to community notes: publish one and it becomes a comment —
   the same anchored public object every question already uses. There is no
   separate "community note" type and there should not be one. */
export function publishNote(session, noteId, { moduleId }) {
  const n = session.notes.find(x => x.id === noteId);
  if (!n || !n.body) return session;        // a bare pin has nothing to say yet
  return { ...session,
    notes: session.notes.filter(x => x.id !== noteId),
    threads: [...session.threads, {
      id: `T${Date.now().toString(36)}`, moduleId, lessonId: n.lessonId,
      t: n.t, body: n.body, authorId: n.authorId,
      createdAt: new Date().toISOString() }] };
}

export const notesFor = (notes, lessonId, me = 'u_you') =>
  notes.filter(n => n.lessonId === lessonId && n.authorId === me)
       .sort((a, b) => a.t - b.t);

export const isPin = n => !n.body;


/* ============================================================================
   6 · THE NOTE BAR, AND DRAGGING IT
   ----------------------------------------------------------------------------
   Rule: the bar is one line that grows as you type, and you can drag it
   anywhere inside the player so it never covers the thing you are writing
   about.
   ========================================================================= */

export const BAR_MIN_W = 260;
export const BAR_MAX_LINES = 5;     // then it scrolls inside itself
export const BAR_NUDGE = 0.02;      // arrow-key step, as a fraction
export const BAR_NUDGE_BIG = 0.10;  // with shift

/* POSITION IS STORED AS A FRACTION OF THE FREE SPACE, NOT AS PIXELS.

   This is the one idea that makes free dragging survive the real world. Store
   fx and fy in 0..1 of (player size - bar size), and the bar is mathematically
   incapable of leaving the frame at any size. Resize the window, rotate the
   phone, go fullscreen and come back — it lands in the same relative place and
   is always fully visible.

   Store pixels instead and going fullscreen throws the bar into the corner, or
   off the edge entirely on the way back. */
export function barPosition(frac, player, bar) {
  const freeX = Math.max(0, player.width  - bar.width);
  const freeY = Math.max(0, player.height - bar.height);
  return { x: clamp01(frac.fx) * freeX, y: clamp01(frac.fy) * freeY };
}

export function barFraction(px, player, bar) {
  const freeX = Math.max(1, player.width  - bar.width);
  const freeY = Math.max(1, player.height - bar.height);
  return { fx: clamp01(px.x / freeX), fy: clamp01(px.y / freeY) };
}

export function nudgeBar(frac, key, shift) {
  const d = shift ? BAR_NUDGE_BIG : BAR_NUDGE;
  switch (key) {
    case 'ArrowLeft':  return { ...frac, fx: clamp01(frac.fx - d) };
    case 'ArrowRight': return { ...frac, fx: clamp01(frac.fx + d) };
    case 'ArrowUp':    return { ...frac, fy: clamp01(frac.fy - d) };
    case 'ArrowDown':  return { ...frac, fy: clamp01(frac.fy + d) };
    default: return frac;
  }
}

/* DRAGGING — five things, and four of them are the ones that get missed.

   1 · Pointer events, not mouse and touch separately. One code path covers
       mouse, finger and pen, and setPointerCapture means the drag survives
       the pointer leaving the bar.

   2 · The handle is the timestamp chip, NOT the whole bar. Dragging from the
       text field would select text instead of moving, on every platform.

   3 · Arrow keys move it when the handle has focus. A control that can only
       be dragged cannot be used without a pointer at all, and this one holds
       the student's own writing.

   4 · Clamp against the VISUAL viewport on a phone. When the keyboard opens
       the visible area shrinks and a bar positioned against the layout
       viewport ends up underneath it — you are typing into something you
       cannot see. window.visualViewport is the one to read.

   5 · Position persists per device, like text size. localStorage, not the
       account — where you like the bar depends on the screen in front of you.

   Sketch:

     handle.addEventListener('pointerdown', e => {
       handle.setPointerCapture(e.pointerId);
       const p = playerEl.getBoundingClientRect();
       const b = barEl.getBoundingClientRect();
       const off = { x: e.clientX - b.left, y: e.clientY - b.top };
       const move = ev => setFrac(barFraction(
         { x: ev.clientX - p.left - off.x, y: ev.clientY - p.top - off.y },
         p, { width: b.width, height: b.height }));
       handle.addEventListener('pointermove', move);
       handle.addEventListener('pointerup', () => {
         handle.removeEventListener('pointermove', move);
         save(frac);
       }, { once: true });
     });

   No inertia, no snapping, no animation on the drag itself — a dragged thing
   that keeps moving after you let go feels broken. */

export const DEFAULT_BAR_POS = { fx: 0.5, fy: 0.78 };


/* ============================================================================
   7 · THE BANNER
   ----------------------------------------------------------------------------
   Rule: passing your own note during playback shows a brief banner. It does
   NOT pause. Tapping it expands it, and expanding is what pauses.
   ========================================================================= */

export const BANNER_MS = 7000;
export const SEEK_TOLERANCE = 1.5;
export const CLUSTER_S = 4;

/* Forward playback only. A seek fires nothing — otherwise scrubbing through a
   lesson throws every note you ever wrote at you at once. */
export function notesCrossed(prevT, nextT, notes) {
  if (nextT <= prevT) return [];
  if (nextT - prevT > SEEK_TOLERANCE) return [];
  return notes.filter(n => n.t > prevT && n.t <= nextT).sort((a, b) => a.t - b.t);
}

export function bannerFrom(crossed, notes) {
  if (!crossed.length) return null;
  const first = crossed[0];
  const together = notes.filter(n => n.t >= first.t && n.t <= first.t + CLUSTER_S)
                        .sort((a, b) => a.t - b.t);
  return { noteIds: together.map(n => n.id), expanded: false };
}

/* A pin with no words still says something useful — that is the point of pins. */
export function bannerLabel(banner, notes) {
  const ns = banner.noteIds.map(id => notes.find(n => n.id === id)).filter(Boolean);
  if (ns.length > 1) return `${ns.length} notes here`;
  return ns[0] ? (ns[0].body || 'You marked this moment') : '';
}

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
    player: { ...session.player,
      playing: b.expanded ? !!b.resumeOnClose : session.player.playing } };
}

/* An expanded banner is where a pin usually gets filled in — "Add a note" on
   it calls editNote(). That is the whole loop: pin it now, pass it later,
   write it then. */

/* COMMENTS NEVER GET BANNERS. Your notes announce themselves because you wrote
   them and you want them back. Someone else's question passing by is not
   something you asked for, and a lesson with forty comments would be
   unwatchable. The mark on the bar is enough for those. */


/* ============================================================================
   8 · MARKS ON THE BAR
   ----------------------------------------------------------------------------
   Rule: one mark per note and one per thread. Never per reply. Marks closer
   than a finger merge, and the cluster is the tap target.
   ========================================================================= */

export const MARK_MIN_PX = 8;
export const HIT_PX = 44;

/* Clustering IS the hit-target fix. Two marks 3px apart cannot both carry a
   44px target without overlapping, so merge first and give the cluster one
   target. Solving them separately is how you get a tap that opens the wrong
   note. */
export function markClusters(items, durationS, barWidthPx) {
  if (!durationS || !barWidthPx) return [];
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const out = [];
  for (const it of sorted) {
    const px = (it.t / durationS) * barWidthPx;
    const last = out[out.length - 1];
    if (last && px - last.px < MARK_MIN_PX) {
      last.items.push(it);
      if (it.kind === 'thread') last.kind = 'thread';   // the public one wins
    } else {
      out.push({ px, pct: (it.t / durationS) * 100, kind: it.kind, items: [it] });
    }
  }
  return out;
}

export function lessonMarks(notes, threads, lessonId, me = 'u_you') {
  return [
    ...notesFor(notes, lessonId, me).map(n => ({ t: n.t, kind: 'note', id: n.id })),
    /* commentsFor is a const arrow declared below, and clamp01 likewise.
       Nothing calls either at module-evaluation time, so there is no temporal
       dead zone in practice, and this file is copied verbatim from the brief
       rather than reordered to please a linter. */
    // eslint-disable-next-line no-use-before-define
    ...commentsFor(threads, lessonId).map(c => ({ t: c.t, kind: 'thread', id: c.id }))
  ];
}


/* ============================================================================
   9 · COMMENTS AND THREADS
   ----------------------------------------------------------------------------
   ONE THREAD, TWO QUERIES. The comment under the video and the thread in
   People are the same row. The lesson asks "what is on this lesson", People
   asks "what is in this module". Nothing copies, nothing syncs, nothing can
   drift, because there is only one of it.

   Do not build two tables and a job that keeps them matching. That is the
   obvious implementation and it is the one that ends up showing different
   reply counts in two places.
   ========================================================================= */

/* Under the video: anchored threads only, in MOMENT order — never newest
   first. Scrolling the list is scrubbing the video, and the list matches the
   bar directly above it. */
export const commentsFor = (threads, lessonId) =>
  threads.filter(t => t.lessonId === lessonId && t.t !== null && t.t !== undefined)
         .sort((a, b) => a.t - b.t);

export const repliesFor = (replies, threadId) =>
  replies.filter(r => r.threadId === threadId)
         .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export function postComment(session, { moduleId, lessonId, seconds, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, threads: [...session.threads, {
    id: `T${Date.now().toString(36)}`, moduleId, lessonId,
    t: Math.floor(seconds), body: text, authorId,
    createdAt: new Date().toISOString() }] };
}

/* Posting from People: no lesson, no moment. This is the whole of the one-way
   rule — a module post has no lessonId, so no lesson query can ever return it.
   Nobody has to remember the rule; there is no data to hang the wrong query
   on. Do not add a check for it. */
export function postModulePost(session, { moduleId, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, threads: [...session.threads, {
    id: `T${Date.now().toString(36)}`, moduleId, lessonId: null,
    t: null, body: text, authorId, createdAt: new Date().toISOString() }] };
}

/* A reply belongs to the thread. No moment, no mark, wherever it was written.
   Written in People it appears under the video; written under the video it
   appears in People. Same row, two queries. */
export function postReply(session, { threadId, body, authorId = 'u_you' }) {
  const text = body.trim();
  if (!text) return session;
  return { ...session, replies: [...session.replies, {
    id: `${threadId}.R${Date.now().toString(36)}`, threadId,
    body: text, authorId, createdAt: new Date().toISOString() }] };
}

/* A comment cannot be un-asked from this screen. It exists in People and
   someone may have answered it. */

export const isAnchored = t => t.lessonId !== null && t.lessonId !== undefined;
export const isWaiting = (thread, replies) => !replies.some(r => r.threadId === thread.id);
export const isIn = (thread, replies, me = 'u_you') =>
  thread.authorId === me || replies.some(r => r.threadId === thread.id && r.authorId === me);

export const lastActivity = (thread, replies) => {
  const rs = repliesFor(replies, thread.id);
  return rs.length ? rs[rs.length - 1].createdAt : thread.createdAt;
};

/* The last thing that happened here that WASN'T you. Null if the only activity
   is your own.

   This is what a badge must be measured against. Measured against plain
   lastActivity, a question you asked that nobody has answered badges itself —
   a dot on every thread you start, forever, which is how People turns
   permanently red. Found by running the rule against the seed data, not by
   reading it. */
export function lastActivityBy(thread, replies, me = 'u_you') {
  const events = [
    ...(thread.authorId === me ? [] : [thread.createdAt]),
    ...repliesFor(replies, thread.id).filter(r => r.authorId !== me).map(r => r.createdAt)
  ];
  return events.length ? events[events.length - 1] : null;
}

/* Threads you are in, then ones nobody has answered, then the rest. The middle
   band is what turns eleven people into eleven people helping each other
   rather than everyone posting into silence. Newest-first is wrong here. */
export function orderThreads(threads, replies, moduleId, me = 'u_you') {
  const band = t => isIn(t, replies, me) ? 0 : isWaiting(t, replies) ? 1 : 2;
  return threads.filter(t => t.moduleId === moduleId)
    .sort((a, b) => band(a) - band(b) ||
      lastActivity(b, replies).localeCompare(lastActivity(a, replies)));
}

/* A thread badges ONLY if you are in it AND somebody else has done something
   since you last looked. Both halves are required — dropping the second badges
   your own unanswered questions back at you. */
export function badges(threads, replies, moduleId, me = 'u_you', lastSeen = {}) {
  return orderThreads(threads, replies, moduleId, me)
    .filter(t => isIn(t, replies, me))
    .filter(t => {
      const last = lastActivityBy(t, replies, me);
      return last !== null && last > (lastSeen[t.id] || '');
    })
    .map(t => t.id);
}

export const watchAt = thread =>
  isAnchored(thread) ? { lessonId: thread.lessonId, seconds: thread.t } : null;


/* ============================================================================
   10 · GOING BACK
   ----------------------------------------------------------------------------
   Rule: every screen except the Flight Deck carries a labelled back arrow to
   its PARENT.
   ========================================================================= */

/* Up, not history — and the difference matters in a case that happens
   constantly. Tap a question in People, land in a lesson. History-back returns
   you to People. Up takes you to the module.

   Up is predictable, it can never loop, and it doubles as the breadcrumb the
   lesson page was missing. The browser's own back button still does history
   for anyone who wants it — we are not replacing that, we are adding the thing
   it cannot do. */
export function upFrom(route) {
  switch (route.kind) {
    case 'lesson':  return { kind: 'module', moduleId: route.moduleId, label: route.moduleName };
    case 'quiz':    return { kind: 'module', moduleId: route.moduleId, label: route.moduleName };
    case 'module':  return { kind: 'deck', label: 'Flight Deck' };
    case 'licence': return { kind: 'deck', label: 'Flight Deck' };
    case 'people':  return { kind: 'module', moduleId: route.moduleId, label: route.moduleName };
    case 'deck':    return null;                       // the top. No arrow here.
    default:        return { kind: 'deck', label: 'Flight Deck' };
  }
}

/* The label is the destination, never the word "Back": `← Module 1`, not `←`.
   A bare arrow makes you find out where it goes by pressing it. */


/* ============================================================================
   11 · WHAT IS NOT HERE, AND MUST NOT COME BACK
   ----------------------------------------------------------------------------
   · No windows. No draggable PANELS, resize handles, minimise chrome, or a
     tab bar of open documents. (The note bar is draggable; it is one line of
     the student's own writing over their own video, not a window over the
     app.)
   · No sidebar, no margin column, no edge document rail, no split pane.
   · No transcript.
   · No separate "community note" type — publishing a note makes it a comment.
   · No nested reply trees.
   · No banners for other people's comments.
   · No module chat room. Threads are individually addressable and silent
     unless you are in them.
   · No "closedByUser" flag. Close stops playback; the dock rule does the rest.
   ========================================================================= */


/* ============================================================================
   12 · WIRING — adapt this, it is not verbatim
   ============================================================================

   const SessionCtx = createContext(null);

   function SessionProvider({ children }) {
     const [session, setSession] = useState(initialSession);
     const dispatchPlayer = useCallback(
       ev => setSession(s => ({ ...s, player: playerReducer(s.player, ev) })), []);

     useEffect(() => {
       const onKey = e => {
         const a = keyAction(e);           // returns null while typing
         if (!a) return;
         e.preventDefault();
         ...
       };
       document.addEventListener('keydown', onKey);
       return () => document.removeEventListener('keydown', onKey);
     }, []);

     return (
       <SessionCtx.Provider value={{ session, setSession, dispatchPlayer }}>
         {children}
         <PlayerLayer />        // the one <video>, above the router, site-wide
       </SessionCtx.Provider>
     );
   }

   PERSISTENCE
     notes, threads, replies   server
     player.seconds            server, per lesson — resume is the point of it
     rate, volume              server, per account — they follow you
     barPos                    localStorage, per device — where you like the bar
                               depends on the screen in front of you
     bar, banner, hud, tab     memory only
   ========================================================================= */

/* ---------------------------------------------------------------------------
   §3.1 — the comment-density silhouette above the progress bar.

   What it is for: the places a lesson is HARD are the places people stop and
   ask, and that signal already exists in the comments — it just has no shape.
   A silhouette turns "47 comments somewhere in this lesson" into "the trouble
   is at 6:10", which is a thing you can scrub to.

   Deliberately a silhouette and not a chart: no axis, no numbers, no tooltip.
   It answers one question — where does this lesson get hard — and a reader who
   wants the exact count can open the comments, which is one tap away.

   Returns null below a floor, because a curve drawn from four comments is not a
   signal, it is four comments. A shape that looks like data but is noise is
   worse than nothing: it gets believed.
*/
export const DENSITY_MIN = 8;        // comments needed before a shape is drawn
export const DENSITY_BUCKETS = 48;

export function densityBuckets(times, durationS, buckets = DENSITY_BUCKETS) {
  if (!durationS || durationS <= 0) return null;
  const ts = (times || []).filter((t) => Number.isFinite(t) && t >= 0 && t <= durationS);
  if (ts.length < DENSITY_MIN) return null;

  const raw = new Array(buckets).fill(0);
  for (const t of ts) {
    const i = Math.min(buckets - 1, Math.floor((t / durationS) * buckets));
    raw[i] += 1;
  }
  // A three-tap smooth. Without it the curve is a comb — one comment makes a
  // spike as tall as a genuine cluster, and the eye reads height as importance.
  const smooth = raw.map((_, i) => {
    const a = raw[i - 1] ?? 0, b = raw[i], c = raw[i + 1] ?? 0;
    return (a + b * 2 + c) / 4;
  });
  const peak = Math.max(...smooth);
  if (peak <= 0) return null;
  // Normalised to its own peak: this compares moments WITHIN one lesson and
  // never across lessons, so a quiet lesson is not drawn as a flat line.
  return smooth.map((v) => v / peak);
}

/* A closed path in a 0..w by 0..h box, flat-bottomed so it reads as a
   silhouette rather than a line chart. Pure geometry — the caller owns the
   colour, and there is no colour in this file. */
export function densityPath(norm, w, h) {
  if (!norm?.length || w <= 0 || h <= 0) return null;
  const n = norm.length;
  const x = (i) => (i / (n - 1)) * w;
  const y = (v) => h - v * h;
  let d = `M 0 ${h} L ${x(0)} ${y(norm[0])}`;
  // Catmull-Rom to cubic: a smooth ridge with no control points to author.
  for (let i = 0; i < n - 1; i++) {
    const p0 = norm[Math.max(0, i - 1)], p1 = norm[i], p2 = norm[i + 1], p3 = norm[Math.min(n - 1, i + 2)];
    const x1 = x(i) + (x(i + 1) - x(Math.max(0, i - 1))) / 6;
    const y1 = y(p1) + (y(p2) - y(p0)) / 6;
    const x2 = x(i + 1) - (x(Math.min(n - 1, i + 2)) - x(i)) / 6;
    const y2 = y(p2) - (y(p3) - y(p1)) / 6;
    d += ` C ${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x(i + 1).toFixed(2)} ${y(p2).toFixed(2)}`;
  }
  return `${d} L ${w} ${h} Z`;
}

/* Where the lesson gets hard, in words, for the label a screen reader gets —
   the curve is aria-hidden, so this is the whole of it for anyone not looking. */
export function densityLabel(norm, durationS) {
  if (!norm?.length || !durationS) return null;
  let best = 0;
  for (let i = 1; i < norm.length; i++) if (norm[i] > norm[best]) best = i;
  const at = Math.round(((best + 0.5) / norm.length) * durationS);
  // Formatted here rather than importing mmss: that lives in the components
  // layer, and a lib reaching up into components is the wrong direction.
  const clock = `${Math.floor(at / 60)}:${String(at % 60).padStart(2, "0")}`;
  return `Most questions are asked around ${clock}`;
}
