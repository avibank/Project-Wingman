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
      notes: progress.get(NOTES_KEY, []),
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
  }, [loaded, progress]);

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
    if (!backendConfigured) {
      setSession((s) => ({
        ...s,
        threads: content.threads || [],
        replies: content.replies || [],
      }));
      seededDiscussion.current = true;
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
    progress.set(NOTES_KEY, content.notes || []);
    setSession((s) => ({ ...s, notes: content.notes || [] }));

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
  }, [loaded, progress]);

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
    const keep = (rows) => (rows || []).filter((r) => r.moduleId !== moduleId);
    setSession((s) => {
      const mine = new Set(threads.map((t) => t.id));
      return {
        ...s,
        threads: [...keep(s.threads), ...threads],
        // Replies are keyed by thread, not by module, so they are pruned by
        // the threads they belong to rather than by a moduleId they do not
        // carry.
        replies: [
          ...(s.replies || []).filter((r) => !mine.has(r.threadId)
            && !threads.some((t) => t.id === r.threadId)),
          ...replies,
        ],
      };
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
    if (!oldThreads.length && !oldReplies.length) { progress.set(ADOPTED_KEY, true); return; }
    (async () => {
      // Sequential and best-effort. An id that is already there fails on the
      // primary key, which is the correct outcome for a re-run and is why the
      // flag is set regardless of individual results.
      for (const t of oldThreads) await insertThread({ ...t, authorId: t.authorId === "u_you" ? me : t.authorId });
      for (const r of oldReplies) await insertReply({ ...r, authorId: r.authorId === "u_you" ? me : r.authorId });
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
