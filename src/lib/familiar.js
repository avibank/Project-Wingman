/* ============================================================================
   Wingman — familiar patterns
   The borrowed interaction models, and the snappiness rules.

   Copy the pure functions verbatim. Do not re-derive them.

   THE ONE IDEA THIS FILE IS BUILT ON

   Familiarity does not come from using many familiar patterns. It comes from
   using ONE recognisable model per surface, consistently — and never borrowing
   the visual language with it.

   The live site currently borrows from four places at once: a YouTube-ish
   player, Instagram-ish circle avatars, iOS-ish segmented pills, Material-ish
   underlined tabs. Four idioms across three tabs. A student cannot say "this is
   like X", so nothing transfers and the borrowing costs clarity instead of
   buying it.

   So: take WHERE THINGS SIT and WHAT HAPPENS WHEN YOU PRESS THEM from the app
   people already know. Type, colour, hairlines and the single accent stay
   Wingman's. YouTube's comment behaviour, in Instrument Sans.

     lesson page   -> a watch page (uula, Udemy, every YouTube playlist)
     the route     -> Netflix's episode list
     comments      -> YouTube's comment thread
     People        -> WhatsApp's chat list
     Library       -> Drive's list view
   ========================================================================= */


/* ============================================================================
   1 · RELATIVE TIME — the most-used social pattern there is
   ----------------------------------------------------------------------------
   Rule: under a week it is relative. Over a week it is a date.
   ========================================================================= */

/* The thresholds below are the ones people have internalised from a decade of
   chat apps. Do not invent new ones — "3.2 hours ago" is instantly foreign.

   Past a week, relative time stops helping and starts making people count:
   "37 days ago" is worse than "23 Jul". Every chat app switches over. */
export function ago(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, (now - then) / 1000);

  if (s < 45)      return 'just now';
  if (s < 90)      return '1 min ago';
  const m = s / 60;
  if (m < 45)      return `${Math.round(m)} min ago`;
  if (m < 90)      return '1 hour ago';
  const h = m / 60;
  if (h < 22)      return `${Math.round(h)} hours ago`;
  if (h < 36)      return 'yesterday';
  const d = h / 24;
  if (d < 7)       return `${Math.round(d)} days ago`;

  const dt = new Date(then);
  const sameYear = dt.getFullYear() === new Date(now).getFullYear();
  return dt.toLocaleDateString(undefined,
    sameYear ? { day: 'numeric', month: 'short' }
             : { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Compute it CLIENT-SIDE, on render. Never cache the string — a server-rendered
   "2 min ago" that has been sitting in a cache for an hour is worse than no
   timestamp at all. Keep the ISO string in the data; the words are a view. */

/* Re-render the visible ones on a slow interval so "just now" does not sit
   there for an hour. One timer for the whole page, never one per row. */
export const AGO_TICK_MS = 60000;


/* ============================================================================
   2 · AVATARS — drawn, never uploaded
   ----------------------------------------------------------------------------
   Rule: initials plus a stable hue, generated from the id.
   ========================================================================= */

/* No uploads means no file storage, no moderation, no cropping tool, and — the
   one that actually matters — no empty-avatar state on day one. Everybody has
   a face from the moment they sign up. */

export function initials(callsign) {
  const parts = String(callsign || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/* A PALETTE, not a hash straight to 0–360. This matters and it is easy to get
   wrong: hashing to an arbitrary hue produces near-neighbours. The first
   version of this put "Callsign Four" at hue 176 and "Callsign Five" at 188 —
   twelve degrees apart, and those two share the initials CF. Two people who
   look identical is exactly the failure the colour was there to prevent.

   Ten hues, none closer than 30°, each picked to hold contrast on both a light
   and a dark fill. With eleven students some will share a colour — that is
   normal and every document app does it — but nobody gets a colour that is
   *almost* someone else's. */
export const AV_HUES = [252, 22, 145, 300, 62, 196, 338, 108, 268, 38];

function hash32(s) {
  let h = 2166136261;                                   // FNV-1a, good avalanche
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Same person, same colour, forever, on every device, with no lookup table. */
export const hueFor = id => AV_HUES[hash32(id) % AV_HUES.length];

/* TWO PEOPLE WILL SOMETIMES SHARE A COLOUR, and that is correct rather than a
   bug to design away. Ten buckets and eleven students makes a collision likely;
   the seed data already has one (Callsign Two and Callsign Nine both land on
   300). It cannot be avoided while the colour is computable from the id alone
   with no lookup — and giving up that property would cost far more than it
   saves.

   It is safe because **the callsign is always beside the avatar**. What must
   never happen is a screen where the avatar is the only way to tell two people
   apart. Check that, not uniqueness. */

/* INITIALS COLLIDE, AND THAT IS FINE.
   "Callsign Four" and "Callsign Five" are both CF. The hue separates them, and
   the full callsign is always beside the avatar in every list — so the avatar
   is decoration, never identification. Never build a UI where the avatar is the
   only way to tell two people apart. */
export const avatarStyle = (id) =>
  `--av-h:${hueFor(id)}`;   // the CSS does the rest, per livery and mode


/* ============================================================================
   3 · THUMBNAILS — Netflix's list, and the state fix that comes with it
   ----------------------------------------------------------------------------
   Rule: every lesson row carries a picture and a duration. Watched state lives
   in the progress bar and NOWHERE else.
   ========================================================================= */

/* WHY THIS MATTERS MORE THAN IT LOOKS.

   Measured on the live module screen: Chapter 1, 2 and 3 are all 27px, weight
   700, at three different lightnesses — contrast 5.0, 15.4 and 8.0. The
   lightness encodes STATE (done / here / not started). But every reader alive
   reads dimmer as LESS IMPORTANT. So the screen tells a first-year that
   Chapter 2 matters and the others do not.

   Netflix's episode list has been teaching people the other grammar for
   fifteen years: titles stay one brightness, and a bar under the picture says
   how far you got. One channel, one job. Adopting the list fixes the
   legibility problem as a side effect. */

export const DONE_AT = 0.9;   // 90% watched. Same flag a manual mark writes.

export const progressPct = (watchedS, durationS) =>
  !durationS ? 0 : Math.min(100, Math.max(0, (watchedS / durationS) * 100));

export const isDone = (lesson) =>
  !!lesson.doneManually || progressPct(lesson.watchedS, lesson.durationS) >= DONE_AT * 100;

export const isStarted = (lesson) => (lesson.watchedS || 0) > 0;

/* Deterministic placeholder tiles, until there is real video.

   There is no content yet, so the first-run rendering IS the product. A
   generated tile reads as "not yet"; a grey box with a broken-image icon reads
   as "broken". Seeded from the id so it never changes between renders — the
   same rule as the aurora starfield, and for the same reason. */
/* Tiles do NOT use the avatar palette — different job, opposite requirement.
   Avatars want ten well-separated buckets so two people never look nearly
   alike. Tiles want a wide continuous spread so twenty-four of them in a column
   do not repeat. Sharing the palette put all 24 lessons on 10 hues, which read
   as four or five tiles copied down the list. */
export function thumbTile(lessonId) {
  const h = hash32(lessonId) % 360;
  const h2 = (h + 38) % 360;
  const tilt = 120 + (hash32(lessonId + '~tilt') % 90);
  return { '--tile-a': h, '--tile-b': h2, '--tile-tilt': `${tilt}deg` };
}

/* When real videos arrive, set lesson.thumb to a URL and nothing else changes.
   Serve them at 2x the rendered box (256x144) and no larger — a full-resolution
   frame per row is the classic way a list becomes slow. */
export const THUMB_W = 128, THUMB_H = 72;

/* mm:ss for a duration badge, the way every video site writes it */
export function clock(s) {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}


/* ============================================================================
   4 · PRESENCE — the cheapest way to make eleven people feel like a room
   ----------------------------------------------------------------------------
   Rule: one quiet line per lesson saying who else has been here.
   ========================================================================= */

/* Needs nobody online, is full on day one, and is the single most familiar
   signal that other humans exist in a piece of software — WhatsApp's "last
   seen", Netflix's "continue watching", the read receipt.

   It is also the answer to a problem that has no other answer: the outer ring
   of the social layer has to work with zero classmates online. */
export function presenceFor(presence, lessonId, people, me = 'u_you', now = Date.now()) {
  const rows = presence
    .filter(p => p.lessonId === lessonId && p.userId !== me)
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!rows.length) return null;
  const who = rows.map(r => people.find(p => p.id === r.userId)).filter(Boolean);
  /* Name people while naming them still fits — "Alice and Bob" is warm,
     "2 others" is a statistic. Past two, fall back to a count. */
  const label =
    who.length === 1 ? `${who[0].callsign} was here ${ago(rows[0].at, now)}` :
    who.length === 2 ? `${who[0].callsign} and ${who[1].callsign} have been here` :
    `${who[0].callsign} and ${who.length - 1} others have been here`;
  return { people: who.slice(0, 3), more: Math.max(0, who.length - 3), label };
}

/* NO ONLINE DOTS. "Callsign Two is online right now" is a different feature
   with a websocket behind it and a privacy question in front of it, and Fly
   solo has to be able to switch it off. Presence here is past tense only. */


/* ============================================================================
   5 · COMMENT THREADS — YouTube's shape
   ----------------------------------------------------------------------------
   Rule: avatar · name · relative time / body / Reply, and replies hidden
   behind one expander.
   ========================================================================= */

/* Replies start COLLAPSED behind "3 replies", because that is what everyone
   has seen ten thousand times, and because an expanded thread pushes the next
   question off the screen. Expanding is per-thread and lives in memory only —
   nobody wants yesterday's expansions restored. */
export function toggleReplies(open, threadId) {
  const next = new Set(open);
  next.has(threadId) ? next.delete(threadId) : next.add(threadId);
  return next;
}

export const replyCountLabel = n =>
  n === 0 ? null : n === 1 ? '1 reply' : `${n} replies`;

/* The timestamp inside a comment is a LINK THAT SEEKS, in the accent colour.
   YouTube taught everyone this: a time in a comment is pressable. We already
   built the behaviour — making it look like the thing people know is free. */
export const seekLabel = t => clock(t);

/* OPTIMISTIC POSTING — this is most of what "snappy" means in practice.

   The comment appears the instant you press Post, in a pending state, and the
   server confirms underneath. It does NOT wait for a round trip, and there is
   no spinner. If the post fails, the row stays with a quiet "Tap to retry"
   rather than vanishing — never delete something a person typed. */
export function optimisticPost(list, row) {
  return [...list, { ...row, pending: true, failed: false }];
}
export function settlePost(list, tempId, saved) {
  return list.map(r => r.id === tempId ? { ...saved, pending: false, failed: false } : r);
}
export function failPost(list, tempId) {
  return list.map(r => r.id === tempId ? { ...r, pending: false, failed: true } : r);
}


/* ============================================================================
   6 · THE PEOPLE LIST — WhatsApp's shape
   ----------------------------------------------------------------------------
   Rule: avatar · one full line of title · a preview line · relative time and an
   unread dot on the right. Sections with plain headers.
   ========================================================================= */

/* THE MEASURED BUG THIS FIXES.

   On the live People tab, 7 of 7 thread titles are truncated — 424px of text
   into 253px, 382 into 176. Every single question is cut mid-sentence, and the
   question is the content.

   WhatsApp gives the title a whole line and truncates the PREVIEW. If something
   has to be cut, it is never the thing the row is about. */

export function peopleRows(threads, replies, people, moduleId, me = 'u_you', lastSeen = {}, now = Date.now()) {
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  const inIt = t => t.authorId === me || replies.some(r => r.threadId === t.id && r.authorId === me);
  const waiting = t => !replies.some(r => r.threadId === t.id);
  const rs = t => replies.filter(r => r.threadId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const rows = threads.filter(t => t.moduleId === moduleId).map(t => {
    const rr = rs(t);
    const last = rr.length ? rr[rr.length - 1] : null;
    const lastAt = last ? last.createdAt : t.createdAt;
    const foreign = [
      ...(t.authorId === me ? [] : [t.createdAt]),
      ...rr.filter(r => r.authorId !== me).map(r => r.createdAt)
    ];
    const lastForeign = foreign.length ? foreign[foreign.length - 1] : null;
    return {
      id: t.id,
      author: byId[t.authorId],
      title: t.body,                                   // one full line, never cut to nothing
      // No name means no prefix. `?? ''` put a bare colon in front of the last
      // reply — ": Test 2" — whenever the replier had not set a callsign.
      preview: last
        ? (byId[last.authorId]?.callsign
            ? `${byId[last.authorId].callsign}: ${last.body}` : last.body)
        : null,
      when: ago(lastAt, now),
      replies: rr.length,
      anchored: t.lessonId != null,
      watchAt: t.lessonId != null ? { lessonId: t.lessonId, seconds: t.t } : null,
      band: inIt(t) ? 0 : waiting(t) ? 1 : 2,
      unread: inIt(t) && lastForeign !== null && lastForeign > (lastSeen[t.id] || ''),
      lastAt
    };
  });

  rows.sort((a, b) => a.band - b.band || b.lastAt.localeCompare(a.lastAt));
  return rows;
}

/* Plain section headers, which is what a chat app does and what a tab bar of
   filters is not. "Waiting for an answer" is a sentence; a chip labelled
   "Waiting" is a thing you have to learn. */
export const BANDS = ['Your threads', 'Waiting for an answer', 'Everything else'];

export function groupRows(rows) {
  return BANDS.map((title, band) => ({ title, band, rows: rows.filter(r => r.band === band) }))
              .filter(g => g.rows.length);
}


/* ============================================================================
   7 · ROW ACTIONS — the three-dot menu
   ----------------------------------------------------------------------------
   Rule: row actions live behind one overflow button, always visible.
   ========================================================================= */

/* A GAP I LEFT. Edit and delete on a note were hover-only, and hover does not
   exist on a phone — which is most of the beta. The three-dot menu is the
   familiar answer, it is a 44px target, and it still works when a third action
   arrives. */
export const rowActions = (kind) =>
  kind === 'note'
    ? [{ id: 'edit', label: 'Edit note' },
       { id: 'publish', label: 'Ask everyone' },
       { id: 'delete', label: 'Delete', danger: true }]
    : [{ id: 'reply', label: 'Reply' },
       { id: 'watch', label: 'Watch at this moment' }];
/* A comment gets no delete here. It exists in People and someone may have
   answered it. */


/* ============================================================================
   8 · SNAPPY — with numbers, so it can be checked
   ----------------------------------------------------------------------------
   "Snappy" is not a feeling you add at the end. It is four mechanisms.
   ========================================================================= */

/* 1 · NOTHING WAITS FOR THE NETWORK TO SHOW A RESULT.
       Posting, saving a note, marking done, switching tab — all optimistic.
       See §5. A spinner is an apology; avoid needing one. */

/* 2 · TABS DO NOT REFETCH.
       Notes and Comments are both rendered and toggled with `hidden`. Switching
       is a style change, not a data fetch, so it is instant forever. With six
       lessons and forty comments there is nothing to virtualise — do not. */
export const TAB_KEEP_MOUNTED = true;

/* 3 · NO LAYOUT SHIFT, EVER.
       Every thumbnail has explicit width/height and an aspect-ratio. Every
       skeleton row is exactly the height of the real row it replaces. A list
       that reflows when it loads reads as slow even when it is fast. */

/* 4 · PREFETCH ONE STEP AHEAD.
       The next lesson's metadata and thumbnail, when the current player passes
       halfway or the row scrolls into view. One step, never the whole module —
       prefetching everything is how you make the first paint slow to make the
       second one fast. */
export const PREFETCH_AT = 0.5;

export function shouldPrefetchNext(player, lesson) {
  if (!lesson?.durationS) return false;
  return player.playing && (player.seconds / lesson.durationS) >= PREFETCH_AT;
}

/* Budgets, so "snappy" is checkable rather than arguable:
     tap feedback visible        <= 1 frame  (16ms) — CSS :active, never JS
     tab switch                  <= 100ms
     optimistic row appears      <= 1 frame
     route row -> video showing  <= 300ms on a warm cache
     no interaction transition   >  240ms                                    */


/* ============================================================================
   9 · THE WHEEL BUG — measured on the live site, and it is mine
   ----------------------------------------------------------------------------
   Rule: a wheel over the player scrolls the page.
   ========================================================================= */

/* WHAT IS WRONG NOW.

   The page scrolls inside `.deck`, but the player is position:fixed in its own
   layer ABOVE the router — which I specified, and which is right for the mini
   player. The consequence I did not specify: the video is not inside the
   scroller, so a wheel over it finds nothing to scroll.

   Probed at five points on the live lesson page: everywhere else reaches
   `.deck`; over the <video> the result is literally nothing. The video is 402px
   of an 888px viewport — the middle 45% of the screen, and exactly where the
   cursor sits after you press play.

   So on a laptop, scrolling down to your own notes appears to do nothing. This
   is the kind of bug that makes an app feel broken without anyone being able to
   name why. */

export function forwardWheel(layerEl, getScroller) {
  const onWheel = e => {
    const s = getScroller();
    if (!s) return;
    const before = s.scrollTop;
    s.scrollTop = before + e.deltaY;
    if (s.scrollTop !== before) e.preventDefault();   // only if we actually moved
  };
  layerEl.addEventListener('wheel', onWheel, { passive: false });
  return () => layerEl.removeEventListener('wheel', onWheel);
}

/* TOUCH IS ALREADY CORRECT AND MUST STAY THAT WAY.
   `touch-action: none` belongs on the note bar's drag handle and NOWHERE else.
   Put it on the player layer and dragging a finger up the video stops scrolling
   the page — the same bug, worse, on the devices most of the beta will use. */


/* ============================================================================
   10 · WHAT NOT TO BORROW
   ----------------------------------------------------------------------------
   · Likes and upvotes. With eleven people it is not a quality signal, it is a
     popularity ranking of your friends — and a question sitting at zero reads
     as a bad question, so people stop asking.
   · Streaks. They work by making you afraid to lose something, and the people
     who break one are usually having a bad week. A guilt machine on a study
     tool in exam season is the wrong trade. Keep the number if you want it,
     drop the loss language: "14 days logged", never "don't lose your streak".
   · Feeds, stories, follower counts, online dots.
   · The progress blob. uula's largest right-hand element is a soft shape
     reading 0% — on a first visit, which is every visit for a while, it is a
     giant zero. Words, not percentages.
   · A promo above the content.
   ========================================================================= */
