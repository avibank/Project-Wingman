import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { initialSession, playerReducer, DEFAULT_BAR_POS } from "./lessonSurface.js";
import { useUserProgress } from "./userProgress.jsx";
import { fetchDiscussion, insertThread, insertReply, deleteThread, deleteReply } from "./threads.js";
import { configured as backendConfigured } from "./supabaseClient.js";

// Session state for the lesson surface, and it lives ABOVE the router.
//
// That placement is the whole reason the mini player can exist. If any of this
// were created inside a lesson page component it would be torn down the first
// time anyone navigated, which is exactly the moment the feature has to keep
// working. The <video> node itself is mounted once by PlayerLayer, a sibling
// of the routed content, and is never re-parented — re-parenting a video
// restarts playback in every browser, and not restarting playback is the
// entire point.
//
// What persists and what does not, from the brief:
//   notes                    -> the account, through the progress store. They
//                               are private and have exactly one reader, so
//                               the account IS the right home for them and
//                               moving them to lesson_notes would buy nothing.
//   threads, replies         -> lesson_threads / lesson_replies, SHARED. See
//                               threads.js. They used to live in the progress
//                               store, which is per account — which meant a
//                               question was visible only to the person who
//                               asked it and the module could not answer
//                               anyone. That was the whole defect.
//   player.seconds           -> the account, per lesson (pw-lesson-pos)
//   tab, banner, composer    -> memory only
const NOTES_KEY = "pw-notes";
// Where threads and replies USED to live, per account. Read exactly once now,
// to hand anything an account still holds over to the shared tables — see
// adoptLegacy below. Never written again.
const THREADS_KEY = "pw-threads";
const REPLIES_KEY = "pw-replies";
const ADOPTED_KEY = "pw-threads-adopted";
const SEEN_KEY = "pw-thread-seen";
const SEEDED_KEY = "pw-lesson-seeded";
// Per account: someone who watches at 1.5 watches everything at 1.5, and
// re-choosing it every lesson is a small insult.
const RATE_KEY = "pw-rate";
const VOLUME_KEY = "pw-volume";
// Per DEVICE, not per account. Where you like the note bar depends on the
// screen in front of you, so it lives in localStorage like text size.
const BAR_POS_KEY = "pw-bar-pos";

const readBarPos = () => {
  try {
    const raw = localStorage.getItem(BAR_POS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.fx === "number" && typeof v.fy === "number" ? v : DEFAULT_BAR_POS;
  } catch { return DEFAULT_BAR_POS; }
};

/* The rows added and removed between two versions of a collection, sent on to
   the server one at a time. Fire-and-forget by design: the row is already on
   screen, postOptimistic is watching for the failure, and awaiting here would
   make the composer wait on the network to clear itself. */
function diffWrite(before, after, add, remove) {
  if (before === after) return;
  const was = new Map((before || []).map((r) => [r.id, r]));
  const is = new Map((after || []).map((r) => [r.id, r]));
  for (const [id, row] of is) if (!was.has(id)) add(row);
  for (const id of was.keys()) if (!is.has(id)) remove(id);
}

/* The fixture, and anything an account still holds from before identity was
   real, is authored by the literal "u_you". That string was the current user
   for as long as there was only ever one; now `me` is a Clerk id, so those
   rows belong to nobody and the surfaces that filter by author simply drop
   them — the seeded notes vanish, and the demo threads say "You" while the
   Mine filter reports none, which is the display and the filter disagreeing
   about the same fact.

   Rewritten once, on the way in. Notes and the demo discussion only: nothing
   here is written to a shared table, so this cannot re-attribute anybody
   else's post. */
const LEGACY_ME = "u_you";
const mine = (rows, me) => (rows || []).map((r) => (
  r.authorId === LEGACY_ME ? { ...r, authorId: me } : r));

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const progress = useUserProgress();
  // THE ONE OWNER OF "who am I" for the whole lesson surface.
  //
  // This was the string "u_you" written out by hand in five files. That is
  // fine while every thread is private — you are the only person in your own
  // copy — and it is exactly wrong the moment the table is shared, because
  // every account would author, own and be badged for the same id. Clerk's id
  // is what the user_id columns hold everywhere else in this codebase, so it
  // is what they hold here.
  //
  // Signed out falls back to "u_you": the seeded demo is authored by it and
  // nothing signed out can write to the shared tables anyway.
  const { user } = useUser();
  const me = user?.id || "u_you";
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [session, setSession] = useState(() => ({ ...initialSession, barPos: readBarPos() }));

  // What the lesson page is currently showing: its lesson, the empty slot the
  // player is positioned over, and the callbacks the player reports through.
  // Held in a ref as well as state because the player reads it every frame
  // while positioning and must not re-subscribe to do it.
  const [stage, setStageState] = useState(null);
  const stageRef = useRef(null);
  const setStage = useCallback((next) => { stageRef.current = next; setStageState(next); }, []);

  const dispatchPlayer = useCallback(
    (ev) => setSession((s) => ({ ...s, player: playerReducer(s.player, ev) })), []);

  // Notes, threads and replies are read once into session and written back on
  // every change. Session is the live copy so the surface re-renders on the
  // frame it changes; the store is the durable one.
  const loaded = progress.loaded;
  const hydrated = useRef(false);
  useEffect(() => {
    if (!loaded || hydrated.current) return;
    hydrated.current = true;
    setSession((s) => ({
      ...s,
      notes: mine(progress.get(NOTES_KEY, []), me),
      // threads and replies are NOT read here any more — they come from the
      // shared tables, per module, in loadDiscussion below. Reading the stale
      // per-account copy first would flash one student's private history and
      // then replace it, which looks exactly like data loss.
      // Speed and volume follow the account across devices; the bar's position
      // does not, and was read from localStorage at mount.
      player: {
        ...s.player,
        rate: progress.get(RATE_KEY, 1),
        volume: progress.get(VOLUME_KEY, 1),
      },
    }));
  }, [loaded, progress, me]);

  // The seeded content's notes and threads are demo data, so they are written
  // once and then owned by the account like anything else — otherwise deleting
  // a seeded note would bring it back on the next reload.
  // Guarded by a ref as well as the stored flag, and the ref is the one that
  // matters. A failed write makes the provider revert every key in the patch —
  // right for a setting, wrong here: it deleted pw-lesson-seeded, so seedFrom
  // ran a second time and overwrote threads with the seed, taking a comment
  // somebody had just typed with it. Measured: post with the network down and
  // the row appeared, then vanished.
  const seeded = useRef(false);
  // Set only when the fixture's discussion is standing in for a missing
  // backend. While it is, the shared tables are left alone entirely — the demo
  // must not be able to write to them, and a real fetch must not wipe it.
  // With a backend configured this stays false and the tables are the source.
  const seededDiscussion = useRef(false);
  const seedFrom = useCallback((content) => {
    if (!content || !loaded) return;
    // THE DEMO DISCUSSION ONLY FILLS IN FOR A MISSING BACKEND.
    //
    // content.test is `everyone: true` — it is on in production right now — so
    // gating the shared tables on "is the fixture loaded" would have switched
    // the real discussion off for every real user while every check still
    // passed. The fixture supplies STRUCTURE (lessons, quizzes, papers), and
    // that is orthogonal to whether the discussion is real.
    //
    // So: a configured backend wins, always, and the demo comments are not
    // used at all — an empty room says "open the first thread", which is true,
    // where forty invented comments from invented callsigns in a real shared
    // room would not be. With no backend the fixture is all there is, and
    // without it the room in local dev is permanently and misleadingly empty.
    //
    // Either way these rows go into MEMORY and are never written anywhere.
    // ONCE per load, and the guard is the point. seedFrom's identity changes
    // whenever the progress store does — that is, after every single progress
    // write — so an unguarded seed here re-ran constantly and reset threads to
    // the fixture, silently deleting a comment the moment anything else saved.
    // Measured: post a comment, open the Ready Room, come back, and it was
    // gone and the count had dropped.
    if (!backendConfigured && !seededDiscussion.current) {
      seededDiscussion.current = true;
      setSession((s) => ({
        ...s,
        threads: mine(content.threads || [], me),
        replies: mine(content.replies || [], me),
      }));
    }

    if (seeded.current || progress.get(SEEDED_KEY, false)) return;
    seeded.current = true;
    // Claim hydration before writing. Child effects run before the parent's,
    // so App's seed call lands FIRST and the hydrate effect below would then
    // read the store back — except progress.get reads React state, which lags
    // its own set by a render, so it read the empty value and wiped the seed.
    // The notes and threads vanished on the next load and the tabs lost their
    // counts. One of the two has to own the first write, and it is this one.
    hydrated.current = true;
    progress.set(SEEDED_KEY, true);
    const seededNotes = mine(content.notes || [], me);
    progress.set(NOTES_KEY, seededNotes);
    setSession((s) => ({ ...s, notes: seededNotes }));

    // The seeded watch state, so every route-row state is visible on a first
    // run — three lessons done, three part-watched, the rest untouched. Merged
    // rather than assigned: a lesson the account already has a position for
    // keeps it, so seeding can never overwrite real progress.
    const pos = { ...progress.get("pw-lesson-pos", {}) };
    let touched = false;
    for (const m of content.modules || []) {
      for (const c of m.chapters || []) {
        for (const l of c.lessons || []) {
          if (!l.watchedS || !l.durationS || pos[l.id]) continue;
          pos[l.id] = { pct: Math.min(1, l.watchedS / l.durationS) };
          touched = true;
        }
      }
    }
    if (touched) progress.set("pw-lesson-pos", pos);
  }, [loaded, progress, me]);

  // One writer per collection. `mutate` takes any of the pure functions from
  // lessonSurface.js — they all take a session and return a new one — applies
  // it, and persists whichever of the three collections it changed.
  const mutate = useCallback((fn) => {
    setSession((s) => {
      const next = fn(s);
      if (next === s) return s;
      if (next.notes !== s.notes) progress.set(NOTES_KEY, next.notes);
      // Threads and replies go to the shared tables, and they go a ROW AT A
      // TIME. The pure functions in lessonSurface.js all take a session and
      // return a new one with a row added or removed, so the difference
      // between the two arrays is exactly the write to make. Diffing here
      // rather than changing those functions keeps them pure, keeps every call
      // site untouched, and means there is still one way to post.
      //
      // Writing the whole array instead would be the progress clobber again in
      // a new table: two students posting a minute apart would each send their
      // own full copy and the second would erase the first.
      if (!seededDiscussion.current) {
        diffWrite(s.threads, next.threads, insertThread, deleteThread);
        diffWrite(s.replies, next.replies, insertReply, deleteReply);
      }
      return next;
    });
  }, [progress]);

  // Optimistic posting, which is most of what "snappy" means in practice.
  //
  // The row is on screen the instant Post is pressed, marked pending, and the
  // store settles underneath. If the write fails the row STAYS and is marked
  // failed — never delete something a person typed — and Retry re-runs the
  // same write. The progress provider reverts its own state on a failed save,
  // which is right for a setting and wrong for a sentence someone wrote, so
  // the pending set is tracked here rather than inferred from the store.
  const [pending, setPending] = useState(() => ({}));
  // Read by loadDiscussion, which is not allowed to depend on this state: a
  // poll must not get a new identity every time a row settles.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const postOptimistic = useCallback((id, fn) => {
    setPending((m) => ({ ...m, [id]: "pending" }));
    mutate(fn);
    // The store batches and flushes on its own clock; one turn later it has
    // either taken the write or set saveError.
    setTimeout(() => {
      setPending((m) => {
        const next = { ...m };
        if (progressRef.current?.saveError) next[id] = "failed";
        else delete next[id];
        return next;
      });
    }, 900);
  }, [mutate]);
  const clearPending = useCallback((id) => {
    setPending((m) => { const n = { ...m }; delete n[id]; return n; });
  }, []);

  const markSeen = useCallback((threadId) => {
    const seen = progress.get(SEEN_KEY, {});
    progress.set(SEEN_KEY, { ...seen, [threadId]: new Date().toISOString() });
  }, [progress]);

  /* ------------------------------------------------------ the shared read */
  // One module's discussion, from the shared tables. Called by the app when the
  // active module changes; the rows for that module are replaced and every
  // other module's are left alone, so moving between modules and back does not
  // refetch what is already here or drop what is.
  const loadDiscussion = useCallback(async (moduleId) => {
    if (!moduleId || seededDiscussion.current) return;
    const { threads, replies, failed } = await fetchDiscussion(moduleId, me);
    // A failed read leaves what is on screen alone. Replacing it with an empty
    // list would read as "this module has no discussion", which is a much
    // worse lie than a stale one.
    if (failed) return;
    /* A ROW STILL IN FLIGHT IS NOT A ROW THE SERVER FORGOT.

       This read replaces every local row for the module with what came back,
       which was safe while it ran once on entry and is not safe now that it
       runs on a timer. A poll landing between "post appeared on screen" and
       "insert returned" would take the post away, and it would come back on
       the next poll — the row someone just typed, blinking. Anything still
       pending (or failed, which must never be dropped) is held. */
    const held = pendingRef.current || {};
    const fetchedThreads = new Set(threads.map((t) => t.id));
    const fetchedReplies = new Set(replies.map((r) => r.id));
    /* A row is held if the write may not have landed yet.

       `pending` is the precise signal and clears about 900ms after posting.
       The minute of grace behind it is for the case that signal cannot cover:
       an insert slower than that, racing a read that was already in flight
       when it started. Only your own rows, only if the server did not return
       them, and only for a minute — long enough that nothing anyone typed can
       blink out, short enough that a genuinely failed write is not pretended
       into existence for the rest of the session. */
    const GRACE_MS = 60000;
    const young = (row) => row.authorId === me
      && Date.parse(row.createdAt) > Date.now() - GRACE_MS;
    const holdThread = (t) => held[t.id] != null || (young(t) && !fetchedThreads.has(t.id));
    const holdReply = (r) => held[r.id] != null || (young(r) && !fetchedReplies.has(r.id));

    setSession((s) => {
      // This module's local rows give way to the fetched ones; every other
      // module's are untouched, and anything in flight is held either way.
      const keptThreads = (s.threads || [])
        .filter((t) => t.moduleId !== moduleId || holdThread(t));
      const haveThread = new Set(keptThreads.map((t) => t.id));

      // Replies are keyed by thread, not by module, so they are pruned by the
      // threads they belong to rather than by a moduleId they do not carry.
      const keptReplies = (s.replies || [])
        .filter((r) => holdReply(r) || !fetchedThreads.has(r.threadId));
      const haveReply = new Set(keptReplies.map((r) => r.id));

      const nextThreads = [...keptThreads, ...threads.filter((t) => !haveThread.has(t.id))];
      const nextReplies = [...keptReplies, ...replies.filter((r) => !haveReply.has(r.id))];

      /* A POLL THAT FOUND NOTHING MUST CHANGE NOTHING.

         These are fresh arrays every time, so returning them unconditionally
         would give session a new identity every 20 seconds and re-render the
         whole app — including whatever is playing — to say that nothing has
         happened. The signature carries bestReplyId because marking an answer
         is a change to a row that is otherwise identical. */
      // Sorted, because the merge moves a module's rows to the end of the list
      // and the room loads four modules in turn — so a plain join would report
      // a change on every cycle purely from the order rotating.
      const sig = (ts, rs) =>
        `${ts.map((t) => `${t.id}:${t.bestReplyId || ""}`).sort().join(",")}`
        + `|${rs.map((r) => r.id).sort().join(",")}`;
      if (sig(nextThreads, nextReplies) === sig(s.threads || [], s.replies || [])) return s;

      return { ...s, threads: nextThreads, replies: nextReplies };
    });
  }, [me]);

  // Anything this account wrote back when threads were per-account gets handed
  // to the shared tables once, then the flag is set and this never runs again.
  // The alternative is abandoning it in place, which loses posts people wrote
  // and would be invisible — they simply would not be there any more.
  const adopting = useRef(false);
  useEffect(() => {
    if (!loaded || adopting.current || seededDiscussion.current) return;
    if (progress.get(ADOPTED_KEY, false)) return;
    const oldThreads = progress.get(THREADS_KEY, []);
    const oldReplies = progress.get(REPLIES_KEY, []);
    adopting.current = true;
    // WHAT MUST NOT BE ADOPTED: the fixture. The previous seedFrom wrote the
    // demo discussion straight into pw-threads, so every account that has ever
    // opened this app is holding all 24 demo threads at that key — and six of
    // them are authored by "u_you". Publishing those would put invented
    // comments from invented callsigns into a real shared room, permanently,
    // once per account. Author alone cannot tell them apart.
    //
    // The id shape can, and the rule is ALL DIGITS AFTER THE PREFIX. The
    // fixture ships fixed numeric ids and it ships TWO schemes — T001..T024
    // and T1000..T1013 — so a digit-count rule misses half of them; matching
    // /^T\d{3}$/ would have published fourteen demo threads. Every id this app
    // generates is `T` + Date.now().toString(36) + six random base36 chars,
    // and the base36 epoch has begun with a letter since 2004 and does so
    // until 2059, so a generated id always contains a letter and can never be
    // all digits. Verified against the fixture in scripts/check-threads.mjs
    // rather than reasoned about, because reasoning about it is what produced
    // the digit-count version.
    //
    // Both conditions have to hold: fixture-shaped ids are skipped, and only
    // rows this account actually wrote are adopted. It fails closed.
    const fixtureThread = (id) => /^T\d+$/.test(String(id || ""));
    const fixtureReply = (id) => /^T\d+\.R\d+$/.test(String(id || ""));
    const mineOnly = (r) => r.authorId === "u_you" || r.authorId === me;
    const takeThreads = oldThreads.filter((t) => !fixtureThread(t.id) && mineOnly(t));
    const takeReplies = oldReplies.filter((r) => !fixtureReply(r.id) && mineOnly(r));
    if (!takeThreads.length && !takeReplies.length) { progress.set(ADOPTED_KEY, true); return; }
    (async () => {
      // Sequential and best-effort. An id that is already there fails on the
      // primary key, which is the correct outcome for a re-run and is why the
      // flag is set regardless of individual results.
      for (const t of takeThreads) await insertThread({ ...t, authorId: me });
      for (const r of takeReplies) await insertReply({ ...r, authorId: me });
      progress.set(ADOPTED_KEY, true);
    })();
  }, [loaded, progress, me]);

  // Rows in both lists seek the video, and the video is owned by the layer.
  // The request travels as state so the two never hold references to each
  // other: the list asks for a second, the layer applies it and clears it.
  // The bar's position is written on drop rather than on every pointermove:
  // a drag is sixty writes a second otherwise.
  const setBarPos = useCallback((frac, persist) => {
    setSession((s) => ({ ...s, barPos: frac }));
    if (persist) { try { localStorage.setItem(BAR_POS_KEY, JSON.stringify(frac)); } catch { /* private mode */ } }
  }, []);

  const setRate = useCallback((rate) => {
    progress.set(RATE_KEY, rate);
    setSession((s) => ({ ...s, player: { ...s.player, rate } }));
  }, [progress]);

  const setVolume = useCallback((volume, muted) => {
    progress.set(VOLUME_KEY, volume);
    setSession((s) => ({ ...s, player: { ...s.player, volume, muted: muted ?? volume === 0 } }));
  }, [progress]);

  const requestSeek = useCallback(
    (seconds) => setSession((s) => ({ ...s, seekTo: { seconds, at: Date.now() } })), []);
  const clearSeek = useCallback(() => setSession((s) => ({ ...s, seekTo: null })), []);

  // "Watch at 2:17" from People. It travels as a pending target rather than a
  // seek, because the lesson has not mounted yet and its video has no duration
  // to seek within — the lesson page turns it into the same resume the player
  // already applies on loadedmetadata.
  const requestWatch = useCallback(
    (target) => setSession((s) => ({ ...s, watchAt: target })), []);
  const clearWatch = useCallback(() => setSession((s) => ({ ...s, watchAt: null })), []);

  const value = useMemo(() => ({
    session, setSession, mutate, dispatchPlayer, me, loadDiscussion,
    stage, setStage, stageRef,
    seedFrom, markSeen, requestSeek, clearSeek, requestWatch, clearWatch,
    setBarPos, setRate, setVolume, pending, postOptimistic, clearPending,
    lastSeen: progress.get(SEEN_KEY, {}),
    setTab: (tab) => setSession((s) => ({ ...s, tab })),
  }), [session, stage, mutate, dispatchPlayer, me, loadDiscussion, setStage, seedFrom, markSeen,
       requestSeek, clearSeek, requestWatch, clearWatch,
       setBarPos, setRate, setVolume, pending, postOptimistic, clearPending, progress]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
